
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

// Handler de Teste Supabase
async function handleTestSupabase(req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw error;
        return res.json({ message: "Conexão OK!" });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

// Handler de Teste Gemini
async function handleTestGemini(req: VercelRequest, res: VercelResponse) {
    try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Oi, responda apenas a palavra: ATIVO',
        });
        return res.json({ message: response.text });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

// Handler de Teste Mercado Pago
async function handleTestMercadoPago(req: VercelRequest, res: VercelResponse) {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) return res.status(500).json({ error: "Access Token não configurado." });
    return res.json({ message: "Configuração presente." });
}

// Handler Principal de SETUP
async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    // Lista de SQLs para automatizar o banco
    const SQL_COMMANDS = `
-- 1. Tabelas de Sistema
CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT);
INSERT INTO system_settings (key, value) VALUES ('interest_rate', '0'), ('cashback_percentage', '1.5') ON CONFLICT DO NOTHING;

-- 2. Colunas de Endereço Detalhado
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS federal_unit TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- 3. Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    title TEXT,
    message TEXT,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS Básico
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
    `;

    try {
        // Como o Supabase-js não permite executar SQL bruto via cliente padrão,
        // você precisa ter uma função RPC no banco chamada 'execute_admin_sql'
        // Se ela não existir, retornaremos um guia para o usuário.
        const { error } = await supabase.rpc('execute_admin_sql', { sql_query: SQL_COMMANDS });
        
        if (error) {
            // Se falhar, tentamos explicar o porquê usando IA
            const ai = getGeminiClient();
            const diag = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Explique por que este erro ocorreu no banco de dados e o que o administrador deve fazer: ${error.message}. Use português simples.`,
            });
            return res.status(500).json({ error: diag.text });
        }

        return res.json({ success: true, message: "Banco sincronizado com sucesso!" });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === 'POST') {
        if (path === '/api/admin/test-supabase') return await handleTestSupabase(req, res);
        if (path === '/api/admin/test-gemini') return await handleTestGemini(req, res);
        if (path === '/api/admin/test-mercadopago') return await handleTestMercadoPago(req, res);
        if (path === '/api/admin/setup-database') return await handleSetupDatabase(req, res);
    }

    if (req.method === 'GET') {
        if (path === '/api/admin/settings') {
            const supabase = getSupabaseAdminClient();
            const { data } = await supabase.from('system_settings').select('*');
            const settings = data?.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc; }, {}) || {};
            return res.json(settings);
        }
    }

    return res.status(404).json({ error: 'Endpoint admin não encontrado.' });
}
