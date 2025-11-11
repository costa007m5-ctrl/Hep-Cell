import type { VercelRequest, VercelResponse } from '@vercel/node';
import { URL } from 'url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

// --- Handler para /api/admin/setup-database ---
const fullSetupSQL = `
-- Habilita a extensão pgcrypto se ainda não estiver habilitada (necessária para gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- 1. TABELA DE FATURAS (INVOICES)
CREATE TABLE IF NOT EXISTS public.invoices ( id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, month text NOT NULL, due_date date NOT NULL, amount numeric(10,2) NOT NULL, status text NOT NULL DEFAULT 'Em aberto'::text, payment_method text NULL, payment_date timestamptz NULL, payment_id text NULL, boleto_url text NULL, boleto_barcode text NULL, notes text NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NULL, CONSTRAINT invoices_pkey PRIMARY KEY (id), CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE );
-- 2. TABELA DE PERFIS (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles ( id uuid NOT NULL, email text NULL, first_name text NULL, last_name text NULL, identification_type text NULL, identification_number text NULL, zip_code text NULL, street_name text NULL, street_number text NULL, neighborhood text NULL, city text NULL, federal_unit text NULL, updated_at timestamptz NULL, CONSTRAINT profiles_pkey PRIMARY KEY (id), CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE );
-- 3. FUNÇÃO PARA CRIAR PERFIL DE NOVO USUÁRIO
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$ begin insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing; return new; end; $function$;
-- TRIGGER para executar a função acima
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- 4. FUNÇÃO PARA ATUALIZAR O CAMPO 'updated_at' AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.moddatetime() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ language 'plpgsql';
-- TRIGGER para 'invoices'
DROP TRIGGER IF EXISTS handle_updated_at ON public.invoices;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE PROCEDURE public.moddatetime();
-- TRIGGER para 'profiles'
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.moddatetime();
-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- 6. POLÍTICAS DE SEGURANÇA PARA USUÁRIOS NORMAIS
DROP POLICY IF EXISTS "Enable read access for own invoices" ON public.invoices; CREATE POLICY "Enable read access for own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Enable read access for own user" ON public.profiles; CREATE POLICY "Enable read access for own user" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Enable update for own user" ON public.profiles; CREATE POLICY "Enable update for own user" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Enable insert for own user" ON public.profiles; CREATE POLICY "Enable insert for own user" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- 7. POLÍTICAS DE SEGURANÇA PARA O ADMINISTRADOR (!!! SUBSTITUA O ID !!!)
DROP POLICY IF EXISTS "Enable full access for admin" ON public.invoices; CREATE POLICY "Enable full access for admin" ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062') WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
DROP POLICY IF EXISTS "Enable full access for admin" ON public.profiles; CREATE POLICY "Enable full access for admin" ON public.profiles FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062') WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
`;
async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase environment variables are not set.');
    return res.status(500).json({ error: 'Configuração do servidor Supabase incompleta.' });
  }
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { error } = await supabaseAdmin.rpc('execute_admin_sql', { sql_query: fullSetupSQL });
    if (error) {
      console.error('Supabase RPC error:', error);
      if (error.message.includes('function execute_admin_sql() does not exist')) {
        return res.status(500).json({ 
          error: "A função de setup 'execute_admin_sql' não foi encontrada.",
          message: "Por favor, execute o 'Passo 1' na aba Desenvolvedor do painel de admin para criar a função necessária e tente novamente."
        });
      }
      throw error;
    }
    res.status(200).json({ success: true, message: 'Banco de dados configurado com sucesso!' });
  } catch (error: any) {
    console.error('Error setting up database:', error);
    res.status(500).json({ error: 'Falha ao executar o setup do banco de dados.', message: error.message });
  }
}

// --- Handler para /api/admin/test-gemini ---
async function handleTestGemini(_req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(400).json({ success: false, message: "A variável de ambiente 'API_KEY' do Gemini não foi encontrada. Verifique sua configuração na Vercel." });
  }
  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Olá' });
    if (response.text) {
      res.status(200).json({ success: true, message: 'Sucesso! A chave da API do Gemini está válida e conectada.' });
    } else {
      throw new Error('A resposta da API do Gemini foi vazia, a chave pode ser inválida.');
    }
  } catch (error: any) {
    console.error('Erro ao testar a chave do Gemini:', error);
    res.status(400).json({ success: false, message: `Falha na validação: ${error.message || 'Ocorreu um erro desconhecido.'}` });
  }
}

// --- Handler para /api/admin/test-mercadopago ---
async function handleTestMercadoPago(_req: VercelRequest, res: VercelResponse) {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(400).json({ success: false, message: "A variável de ambiente 'MERCADO_PAGO_ACCESS_TOKEN' não foi encontrada. Verifique sua configuração na Vercel." });
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      res.status(200).json({ success: true, message: 'Sucesso! O Access Token do Mercado Pago está válido e conectado.' });
    } else {
      const errorData = await response.json().catch(() => ({}));
      res.status(response.status).json({ success: false, message: `Falha na validação: ${errorData.message || 'Chave inválida ou erro de permissão.'}` });
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'A verificação expirou. O servidor do Mercado Pago não respondeu a tempo.' });
    }
    console.error('Erro ao testar a chave do Mercado Pago:', error);
    res.status(500).json({ success: false, message: 'Ocorreu um erro interno ao tentar validar a chave.' });
  }
}

// --- Handler para /api/admin/test-supabase ---
async function handleTestSupabase(_req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(400).json({ success: false, message: "As variáveis de ambiente do Supabase (URL e Service Role Key) não foram encontradas. Verifique sua configuração na Vercel." });
  }
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { error } = await supabaseAdmin.rpc('execute_admin_sql', { sql_query: 'SELECT 1;' });
    if (error) {
      if (error.message.includes('function execute_admin_sql() does not exist')) {
        return res.status(400).json({ success: false, message: "Falha na validação: A função de setup 'execute_admin_sql' não foi encontrada no banco. Execute o 'Passo 1' na aba Desenvolvedor e tente novamente." });
      }
      throw error;
    }
    res.status(200).json({ success: true, message: 'Sucesso! A conexão com o Supabase está funcionando corretamente.' });
  } catch (error: any) {
    console.error('Erro ao testar a conexão com o Supabase:', error);
    res.status(500).json({ success: false, message: `Falha na conexão: ${error.message}` });
  }
}

// --- Roteador Principal ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  switch (path) {
    case '/api/admin/setup-database':
      return await handleSetupDatabase(req, res);
    case '/api/admin/test-gemini':
      return await handleTestGemini(req, res);
    case '/api/admin/test-mercadopago':
      return await handleTestMercadoPago(req, res);
    case '/api/admin/test-supabase':
      return await handleTestSupabase(req, res);
    default:
      return res.status(404).json({ error: 'Admin route not found' });
  }
}