
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// --- TESTES DE CONEXÃO (PARA DEIXAR O STATUS VERDE) ---

async function handleTestSupabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados Supabase operacional." });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro Supabase: " + e.message });
    }
}

async function handleTestGemini(res: VercelResponse) {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "Diga apenas 'IA RELP OPERACIONAL'",
        });
        return res.json({ success: true, message: response.text });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro Gemini: " + e.message });
    }
}

async function handleTestMercadoPago(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'mp_access_token').single();
        const token = data?.value || process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!token) throw new Error("Token MP não configurado nas variáveis de ambiente ou banco.");
        return res.json({ success: true, message: "Gateway Mercado Pago configurado." });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro Mercado Pago: " + e.message });
    }
}

// --- IA: AUTO PREENCHIMENTO MELHORADO ---
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analise este texto: "${rawText}".
            REGRAS: 1. mm vira cm (dividido por 10). 2. Peso em gramas (número). 3. Extraia specs.
            Retorne JSON puro.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        model: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        processor: { type: Type.STRING },
                        ram: { type: Type.STRING },
                        storage: { type: Type.STRING },
                        battery: { type: Type.STRING },
                        weight: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        length: { type: Type.NUMBER },
                        description: { type: Type.STRING }
                    }
                }
            }
        });
        return res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) {
        return res.status(500).json({ error: "IA: " + e.message });
    }
}

// --- SQL MANUAL E SETUP AUTOMÁTICO ---
async function handleExecuteSql(req: VercelRequest, res: VercelResponse) {
    const { sql } = req.body;
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, data });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        -- Garante colunas de produtos
        ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
        
        -- Garante tabela de logs se não existir
        CREATE TABLE IF NOT EXISTS action_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            created_at TIMESTAMPTZ DEFAULT now(),
            action_type TEXT,
            status TEXT,
            description TEXT,
            details JSONB
        );
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco reparado e sincronizado!" });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro no setup: " + e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    
    // Roteamento de testes
    if (path.includes('/test-supabase')) return await handleTestSupabase(res);
    if (path.includes('/test-gemini')) return await handleTestGemini(res);
    if (path.includes('/test-mercadopago')) return await handleTestMercadoPago(res);
    
    // Roteamento operacional
    if (path.includes('/execute-sql')) return await handleExecuteSql(req, res);
    if (path.includes('/setup-database')) return await handleSetupDatabase(res);
    if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);

    const supabase = getSupabaseAdmin();
    if (req.method === 'GET') {
        if (path.includes('/profiles')) {
            const { data } = await supabase.from('profiles').select('*').order('first_name');
            return res.json(data || []);
        }
        if (path.includes('/products')) {
            const { data } = await supabase.from('products').select('*').order('name');
            return res.json(data || []);
        }
        if (path.includes('/settings')) {
            const { data } = await supabase.from('system_settings').select('*');
            return res.json(data?.reduce((acc: any, c: any) => ({...acc, [c.key]: c.value}), {}) || {});
        }
    }

    if (req.method === 'POST') {
        if (path.includes('/settings')) {
            const { key, value } = req.body;
            await supabase.from('system_settings').upsert({ key, value });
            return res.json({ success: true });
        }
        if (path.includes('/products')) {
            const { id, created_at, ...data } = req.body;
            let q = (id && id !== "null") ? supabase.from('products').update(data).eq('id', id) : supabase.from('products').insert(data);
            const { error } = await q;
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true });
        }
    }

    return res.status(404).json({ error: 'Endpoint não encontrado' });
}
