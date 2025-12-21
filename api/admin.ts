
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// --- IA: AUTO PREENCHIMENTO ULTRA PRECISO ---
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analise as especificações deste produto: "${rawText}".
            
            REGRAS DE CONVERSÃO OBRIGATÓRIAS:
            1. DIMENSÕES: Se o texto informar mm (milímetros), você DEVE converter para cm (centímetros) dividindo por 10. Ex: 171,4mm vira 17.14.
            2. PESO: Extraia o peso puro em gramas (g). Se disser "194g", o valor é 194.
            3. DADOS: Extraia processador, RAM, armazenamento e bateria.
            4. PREÇO: Sugira um valor de mercado se não houver no texto.
            
            Retorne RIGOROSAMENTE apenas um JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        model: { type: Type.STRING },
                        category: { type: Type.STRING },
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
                    },
                    required: ["name", "price", "weight"]
                }
            }
        });
        return res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) {
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

// --- TESTES DE CONEXÃO ---
async function handleTestSupabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) throw error;
        return res.json({ success: true, message: "Supabase Conectado." });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleTestGemini(res: VercelResponse) {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "Diga 'IA RELP ATIVA'",
        });
        return res.json({ success: true, message: response.text });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// --- SQL MANUAL E SETUP ---
async function handleExecuteSql(req: VercelRequest, res: VercelResponse) {
    const { sql } = req.body;
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            if (error.message?.includes('function exec_sql(sql_query => text) does not exist')) {
                throw new Error("Motor SQL não instalado. Siga o Passo 1 na aba Ferramentas Dev.");
            }
            throw error;
        }
        return res.json({ success: true, data });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
             if (error.message?.includes('function exec_sql(sql_query => text) does not exist')) {
                throw new Error("Motor SQL não instalado. Siga o Passo 1 na aba Ferramentas Dev.");
            }
            throw error;
        }
        return res.json({ success: true, message: "Banco de dados sincronizado!" });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    if (path.includes('/test-supabase')) return await handleTestSupabase(res);
    if (path.includes('/test-gemini')) return await handleTestGemini(res);
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
