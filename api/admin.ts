
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { URL } from 'url';

function getSupabaseAdminClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase environment variables missing.');
    return createClient(supabaseUrl, supabaseServiceKey);
}

function getGeminiClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error('API_KEY do Gemini não configurada.');
    return new GoogleGenAI({ apiKey });
}

async function handleTestSupabase(req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw error;
        return res.json({ message: "Supabase Conectado e Tabelas Acessíveis." });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleTestGemini(req: VercelRequest, res: VercelResponse) {
    try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Responda apenas "OK"',
        });
        return res.json({ message: `Gemini Ativo: ${response.text}` });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    const SQL_COMMANDS = `
-- 1. Função crítica para execução de SQL administrativo (DEVE SER RODADA MANUALMENTE NO DASHBOARD SE FALHAR)
-- CREATE OR REPLACE FUNCTION execute_admin_sql(sql_query text) RETURNS void AS $$ BEGIN EXECUTE sql_query; END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Colunas de Endereço e Perfis
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS federal_unit TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_score INTEGER DEFAULT 0;

-- 3. Tabelas de Sistema
CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT);
INSERT INTO system_settings (key, value) VALUES ('interest_rate', '0'), ('cashback_percentage', '1.5') ON CONFLICT DO NOTHING;

-- 4. Notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    title TEXT,
    message TEXT,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Habilitar RLS e Políticas de Leitura Pública para Produtos
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view for products" ON products;
CREATE POLICY "Public view for products" ON products FOR SELECT USING (true);

-- 6. Políticas para Perfis
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
    `;

    try {
        const { error } = await supabase.rpc('execute_admin_sql', { sql_query: SQL_COMMANDS });
        
        if (error) {
            return res.status(500).json({ 
                error: `Erro SQL: ${error.message}. Aviso: Certifique-se de que a função 'execute_admin_sql' foi criada no SQL Editor do Supabase.` 
            });
        }

        return res.json({ success: true, message: "Banco de dados sincronizado e políticas RLS configuradas!" });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === 'POST') {
        if (path.endsWith('/test-supabase')) return await handleTestSupabase(req, res);
        if (path.endsWith('/test-gemini')) return await handleTestGemini(req, res);
        if (path.endsWith('/setup-database')) return await handleSetupDatabase(req, res);
    }

    if (req.method === 'GET') {
        if (path.endsWith('/profiles')) {
             const supabase = getSupabaseAdminClient();
             const { data } = await supabase.from('profiles').select('*');
             return res.json(data || []);
        }
        if (path.endsWith('/invoices')) {
             const supabase = getSupabaseAdminClient();
             const { data } = await supabase.from('invoices').select('*');
             return res.json(data || []);
        }
        if (path.endsWith('/settings')) {
            const supabase = getSupabaseAdminClient();
            const { data } = await supabase.from('system_settings').select('*');
            const settings = data?.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc; }, {}) || {};
            return res.json(settings);
        }
    }

    return res.status(404).json({ error: 'Endpoint admin não encontrado.' });
}
