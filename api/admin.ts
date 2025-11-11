import type { VercelRequest, VercelResponse } from '@vercel/node';
import { URL } from 'url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

// --- Helper Functions ---
function getGeminiClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error('A chave da API do Gemini (API_KEY) não está configurada no servidor.');
    }
    return new GoogleGenAI({ apiKey });
}

// --- Handler para /api/admin/setup-database ---
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
CREATE POLICY "Allow service_role full access on invoices" ON public.invoices FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow admin full access on invoices" ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062') WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
CREATE POLICY