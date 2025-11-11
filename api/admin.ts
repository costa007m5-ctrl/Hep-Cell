import type { VercelRequest, VercelResponse } from '@vercel/node';
import { URL } from 'url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

// --- Funções Auxiliares de Validação e Clientes ---
function getSupabaseAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('As variáveis de ambiente do Supabase (URL e Service Role Key) não estão configuradas no servidor.');
    }
    return createClient(supabaseUrl, supabaseServiceKey);
}

function getGeminiClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error('A chave da API do Gemini (API_KEY) não está configurada no servidor.');
    }
    return new GoogleGenAI({ apiKey });
}

async function logAction(supabase: ReturnType<typeof getSupabaseAdminClient>, type: string, status: 'SUCCESS' | 'FAILURE', description: string, details?: object) {
    const { error } = await supabase.from('action_logs').insert({
        action_type: type,
        status: status,
        description: description,
        details: details || {}
    });
    if (error) {
        console.error("Falha ao registrar log de ação:", error);
    }
}

// --- Script SQL Completo para Setup do Banco de Dados ---
const fullSetupSQL = `
-- Habilita a extensão pgcrypto se ainda não estiver habilitada (necessária para gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABELA DE FATURAS (INVOICES)
CREATE TABLE IF NOT EXISTS public.invoices ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, month text NOT NULL, due_date date NOT NULL, amount numeric(10,2) NOT NULL, status text NOT NULL DEFAULT 'Em aberto'::text, payment_method text NULL, payment_date timestamptz NULL, payment_id text NULL, boleto_url text NULL, boleto_barcode text NULL, notes text NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NULL, CONSTRAINT invoices_pkey PRIMARY KEY (id), CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE );

-- 2. TABELA DE PERFIS (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles ( id uuid NOT NULL, email text NULL, first_name text NULL, last_name text NULL, identification_type text NULL, identification_number text NULL, zip_code text NULL, street_name text NULL, street_number text NULL, neighborhood text NULL, city text NULL, federal_unit text NULL, updated_at timestamptz NULL, CONSTRAINT profiles_pkey PRIMARY KEY (id), CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE );

-- 3. TABELA DE LOGS DE AÇÕES (ACTION_LOGS)
CREATE TABLE IF NOT EXISTS public.action_logs ( id uuid NOT NULL DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), action_type text NOT NULL, status text NOT NULL, description text NULL, details jsonb NULL, CONSTRAINT action_logs_pkey PRIMARY KEY (id) );

-- 4. FUNÇÃO PARA CRIAR PERFIL (VIA RPC/WEBHOOK)
CREATE OR REPLACE FUNCTION public.handle_new_user_creation(user_id uuid, user_email text)
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (user_id, user_email)
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. FUNÇÃO E GATILHOS PARA ATUALIZAR 'updated_at'
CREATE OR REPLACE FUNCTION public.moddatetime() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ language 'plpgsql';
DROP TRIGGER IF EXISTS handle_updated_at ON public.invoices;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE PROCEDURE public.moddatetime();
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.moddatetime();

-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS DE SEGURANÇA PARA 'INVOICES'
DROP POLICY IF EXISTS "Allow service_role full access on invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow admin full access on invoices" ON public.invoices;
DROP POLICY IF EXISTS "Enable read access for own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Enable update for own invoices" ON public.invoices;
CREATE POLICY "Allow service_role full access on invoices" ON public.invoices FOR ALL TO service_role;
CREATE POLICY "Allow admin full access on invoices" ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062') WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
CREATE POLICY "Enable read access for own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);

-- 8. POLÍTICAS DE SEGURANÇA PARA 'PROFILES'
DROP POLICY IF EXISTS "Allow service_role full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read/write for own profile" ON public.profiles;
CREATE POLICY "Allow service_role full access on profiles" ON public.profiles FOR ALL TO service_role;
CREATE POLICY "Allow admin full access on profiles" ON public.profiles FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062') WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
CREATE POLICY "Enable read/write for own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 9. POLÍTICAS DE SEGURANÇA PARA 'ACTION_LOGS'
DROP POLICY IF EXISTS "Allow service_role full access on action_logs" ON public.action_logs;
DROP POLICY IF EXISTS "Allow admin full access on action_logs" ON public.action_logs;
CREATE POLICY "Allow service_role full access on action_logs" ON public.action_logs FOR ALL TO service_role;
CREATE POLICY "Allow admin full access on action_logs" ON public.action_logs FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062') WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
`.trim();

// --- Handlers da API ---
async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { error: rpcError } = await supabase.rpc('execute_admin_sql', {
            sql_query: fullSetupSQL,
        });
        if (rpcError) {
            console.error("Erro na execução do RPC 'execute_admin_sql':", rpcError);
            throw new Error(`Falha ao executar o script SQL no banco de dados: ${rpcError.message}`);
        }
        await logAction(supabase, 'DATABASE_SETUP', 'SUCCESS', 'O banco de dados foi configurado com sucesso via painel de admin.');
        res.status(200).json({ message: 'Tabelas, funções e políticas de segurança configuradas com sucesso!' });
    } catch (error: any) {
        await logAction(supabase, 'DATABASE_SETUP', 'FAILURE', 'Falha ao configurar o banco de dados.', { error: error.message });
        res.status(500).json({ error: 'Erro ao configurar o banco de dados.', message: error.message });
    }
}

async function handleDiagnoseError(req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        const { errorMessage } = req.body;
        if (!errorMessage) {
            return res.status(400).json({ error: 'Nenhuma mensagem de erro fornecida.' });
        }
        const prompt = `
            Você é um especialista em Supabase e PostgreSQL. Um erro ocorreu na aplicação. Analise a seguinte mensagem de erro e forneça um diagnóstico claro e conciso em português do Brasil.
            Estruture sua resposta em Markdown com as seguintes seções:
            ### Possível Causa
            ### Sugestão de Correção
            Se o erro for sobre "permission denied" ou RLS, explique que pode ser uma política de segurança (RLS) mal configurada na tabela relevante e sugira verificar as políticas no painel do Supabase.
            Se o erro for sobre uma relação que não existe, sugira que uma tabela pode estar faltando e que o script de setup do banco de dados precisa ser executado.
            Seja direto e foque em soluções práticas.

            Mensagem de Erro: "${errorMessage}"
        `;
        const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        res.status(200).json({ diagnosis: response.text });
    } catch (error: any) {
        console.error("Erro na API de diagnóstico:", error);
        res.status(500).json({ error: 'Falha ao comunicar com a IA para diagnóstico.', message: error.message });
    }
}

async function handleTestSupabase(req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase.rpc('execute_admin_sql', { sql_query: 'SELECT 1;' });
        if (error) throw error;
        res.status(200).json({ message: 'Conexão com o Supabase e a função RPC estão funcionando corretamente.' });
    } catch (error: any) {
        res.status(500).json({ message: `Falha na conexão com o Supabase: ${error.message}` });
    }
}

async function handleTestGemini(req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: 'oi' });
        res.status(200).json({ message: 'A chave da API do Gemini é válida e a conexão foi bem-sucedida.' });
    } catch (error: any) {
        res.status(500).json({ message: `Falha na conexão com a API do Gemini: ${error.message}` });
    }
}

async function handleTestMercadoPago(req: VercelRequest, res: VercelResponse) {
    try {
        const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!accessToken) throw new Error('Access Token do Mercado Pago não encontrado.');
        
        const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Token inválido ou falha na API.');
        }
        res.status(200).json({ message: 'O Access Token do Mercado Pago é válido e a conexão foi bem-sucedida.' });
    } catch (error: any) {
        res.status(500).json({ message: `Falha na conexão com a API do Mercado Pago: ${error.message}` });
    }
}

async function handleGetLogs(req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
            .from('action_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw error;
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: `Falha ao buscar logs: ${error.message}` });
    }
}

// --- Roteador Principal ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === '/api/admin/get-logs') {
        if (req.method === 'GET' || req.method === 'POST') { // Permite POST para simplicidade com o frontend
            return await handleGetLogs(req, res);
        } else {
             res.setHeader('Allow', 'GET, POST');
            return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
        }
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    switch (path) {
        case '/api/admin/setup-database':
            return await handleSetupDatabase(req, res);
        case '/api/admin/diagnose-error':
            return await handleDiagnoseError(req, res);
        case '/api/admin/test-supabase':
            return await handleTestSupabase(req, res);
        case '/api/admin/test-gemini':
            return await handleTestGemini(req, res);
        case '/api/admin/test-mercadopago':
            return await handleTestMercadoPago(req, res);
        default:
            return res.status(404).json({ error: 'Admin route not found' });
    }
}
