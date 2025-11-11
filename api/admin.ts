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
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
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

-- 3. TABELA DE PRODUTOS (PRODUCTS)
CREATE TABLE IF NOT EXISTS public.products ( id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL, description text NULL, price numeric(10, 2) NOT NULL, stock integer NOT NULL DEFAULT 0, image_url text NULL, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT products_pkey PRIMARY KEY (id) );

-- 4. TABELA DE LOGS DE AÇÕES (ACTION_LOGS)
CREATE TABLE IF NOT EXISTS public.action_logs ( id uuid NOT NULL DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), action_type text NOT NULL, status text NOT NULL, description text NULL, details jsonb NULL, CONSTRAINT action_logs_pkey PRIMARY KEY (id) );

-- 5. FUNÇÃO PARA CRIAR PERFIL (VIA RPC/WEBHOOK)
CREATE OR REPLACE FUNCTION public.handle_new_user_creation(user_id uuid, user_email text)
RETURNS void AS $$ BEGIN INSERT INTO public.profiles (id, email) VALUES (user_id, user_email) ON CONFLICT (id) DO NOTHING; END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNÇÃO E GATILHOS PARA ATUALIZAR 'updated_at'
CREATE OR REPLACE FUNCTION public.moddatetime() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ language 'plpgsql';
DROP TRIGGER IF EXISTS handle_updated_at ON public.invoices; CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE PROCEDURE public.moddatetime();
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles; CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.moddatetime();

-- 7. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- 8. POLÍTICAS DE SEGURANÇA (GERAL)
DROP POLICY IF EXISTS "Allow service_role full access" ON public.invoices; CREATE POLICY "Allow service_role full access" ON public.invoices FOR ALL TO service_role;
DROP POLICY IF EXISTS "Allow service_role full access" ON public.profiles; CREATE POLICY "Allow service_role full access" ON public.profiles FOR ALL TO service_role;
DROP POLICY IF EXISTS "Allow service_role full access" ON public.products; CREATE POLICY "Allow service_role full access" ON public.products FOR ALL TO service_role;
DROP POLICY IF EXISTS "Allow service_role full access" ON public.action_logs; CREATE POLICY "Allow service_role full access" ON public.action_logs FOR ALL TO service_role;
DROP POLICY IF EXISTS "Allow admin full access" ON public.invoices; CREATE POLICY "Allow admin full access" ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062') WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
DROP POLICY IF EXISTS "Allow admin full access" ON public.profiles; CREATE POLICY "Allow admin full access" ON public.profiles FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062') WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
DROP POLICY IF EXISTS "Allow admin full access" ON public.products; CREATE POLICY "Allow admin full access" ON public.products FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062') WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
DROP POLICY IF EXISTS "Allow admin full access" ON public.action_logs; CREATE POLICY "Allow admin full access" ON public.action_logs FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062') WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');

-- 9. POLÍTICAS DE SEGURANÇA (ESPECÍFICAS DO CLIENTE)
DROP POLICY IF EXISTS "Enable read access for own invoices" ON public.invoices; CREATE POLICY "Enable read access for own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Enable read/write for own profile" ON public.profiles; CREATE POLICY "Enable read/write for own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Enable public read access for products" ON public.products; CREATE POLICY "Enable public read access for products" ON public.products FOR SELECT TO anon, authenticated USING (true);
`.trim();


// --- Handlers de Produtos ---
async function handleGetProducts(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
}

async function handleCreateProduct(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { name, description, price, stock, image_url } = req.body;
    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ error: 'Nome, preço e estoque são obrigatórios.' });
    }
    const { data, error } = await supabase.from('products').insert({ name, description, price, stock, image_url }).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data[0]);
}

// --- Handler de Nova Venda / Análise ---
async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { customerData, saleData } = req.body;
        if (!customerData || !saleData) return res.status(400).json({ error: "Dados do cliente ou da venda estão faltando." });
        
        let userId = customerData.id;
        let userEmail = customerData.email;

        // Passo 1: Criar ou verificar usuário
        if (!userId) {
            // Verifica se o email já existe
            const { data: existingUser, error: existingUserError } = await supabase.auth.admin.getUserByEmail(userEmail);
             if (existingUserError && existingUserError.name !== 'UserNotFoundError') {
                throw new Error(`Erro ao verificar email: ${existingUserError.message}`);
            }
            if (existingUser.user) {
                 userId = existingUser.user.id;
            } else {
                const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
                    email: userEmail,
                    email_confirm: true, // Auto-confirma o email
                });
                if (createUserError) throw new Error(`Falha ao criar usuário: ${createUserError.message}`);
                userId = newUser.user.id;
                await supabase.rpc('handle_new_user_creation', { user_id: userId, user_email: userEmail });
            }
        }
        
        // Passo 2: Atualizar perfil do usuário
        const { error: profileError } = await supabase.from('profiles').upsert({ id: userId, ...customerData }, { onConflict: 'id' });
        if (profileError) throw new Error(`Falha ao salvar perfil: ${profileError.message}`);

        // Passo 3: Gerar faturas das parcelas
        const invoicesToCreate = [];
        const today = new Date();
        for (let i = 0; i < saleData.installments_count; i++) {
            const dueDate = new Date(today);
            dueDate.setMonth(dueDate.getMonth() + (i + 1));
            invoicesToCreate.push({
                user_id: userId,
                month: `${saleData.product_name} - Parcela ${i + 1}/${saleData.installments_count}`,
                amount: saleData.installment_value,
                due_date: dueDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
                status: 'Em aberto',
                notes: `Venda #${saleData.productId || 'N/A'}`
            });
        }
        const { error: invoiceError } = await supabase.from('invoices').insert(invoicesToCreate);
        if (invoiceError) throw new Error(`Falha ao gerar faturas: ${invoiceError.message}`);

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda para ${userEmail} gerada com ${saleData.installments_count} parcelas.`);
        res.status(200).json({ message: `Venda concluída e ${saleData.installments_count} faturas geradas para ${userEmail}.` });

    } catch (error: any) {
        await logAction(supabase, 'SALE_CREATED', 'FAILURE', 'Falha ao criar venda.', { error: error.message });
        res.status(500).json({ error: error.message });
    }
}

// --- Outros Handlers (Setup, Diagnóstico, Testes) ---
async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { error: rpcError } = await supabase.rpc('execute_admin_sql', { sql_query: fullSetupSQL });
        if (rpcError) throw new Error(`Falha ao executar o script SQL: ${rpcError.message}`);
        await logAction(supabase, 'DATABASE_SETUP', 'SUCCESS', 'O banco de dados foi configurado com sucesso.');
        res.status(200).json({ message: 'Tabelas, funções e políticas de segurança configuradas com sucesso!' });
    } catch (error: any) {
        await logAction(supabase, 'DATABASE_SETUP', 'FAILURE', 'Falha ao configurar o banco.', { error: error.message });
        res.status(500).json({ error: 'Erro ao configurar o banco de dados.', message: error.message });
    }
}

async function handleDiagnoseError(req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        const { errorMessage } = req.body;
        if (!errorMessage) return res.status(400).json({ error: 'Nenhuma mensagem de erro fornecida.' });
        const prompt = `Você é um especialista em Supabase e PostgreSQL. Analise o erro a seguir e forneça um diagnóstico e uma solução em português do Brasil, usando Markdown. Seções: ### Causa Provável e ### Solução Sugerida. Erro: "${errorMessage}"`;
        const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        res.status(200).json({ diagnosis: response.text });
    } catch (error: any) {
        res.status(500).json({ error: 'Falha ao comunicar com a IA.', message: error.message });
    }
}

async function handleTestSupabase(req: VercelRequest, res: VercelResponse) { /* ...código inalterado... */ }
async function handleTestGemini(req: VercelRequest, res: VercelResponse) { /* ...código inalterado... */ }
async function handleTestMercadoPago(req: VercelRequest, res: VercelResponse) { /* ...código inalterado... */ }
async function handleGetLogs(req: VercelRequest, res: VercelResponse) { /* ...código inalterado... */ }

// --- Roteador Principal ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === '/api/admin/products') {
        if (req.method === 'GET') return await handleGetProducts(req, res);
        if (req.method === 'POST') return await handleCreateProduct(req, res);
    }
    if (path === '/api/admin/get-logs') {
        if (req.method === 'GET' || req.method === 'POST') return await handleGetLogs(req, res);
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    switch (path) {
        case '/api/admin/create-sale': return await handleCreateSale(req, res);
        case '/api/admin/setup-database': return await handleSetupDatabase(req, res);
        case '/api/admin/diagnose-error': return await handleDiagnoseError(req, res);
        case '/api/admin/test-supabase': return await handleTestSupabase(req, res);
        case '/api/admin/test-gemini': return await handleTestGemini(req, res);
        case '/api/admin/test-mercadopago': return await handleTestMercadoPago(req, res);
        default: return res.status(404).json({ error: 'Admin route not found' });
    }
}
