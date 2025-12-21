
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// --- IA: AUTO PREENCHIMENTO MELHORADO (CONVERSÃO MM -> CM) ---
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analise este texto técnico: "${rawText}".
            
            REGRAS OBRIGATÓRIAS:
            1. DIMENSÕES: Se o texto informar mm (ex: 171,4 mm), você DEVE converter para cm (ex: 17.14). Divida mm por 10.
            2. PESO: Extraia apenas o número em gramas (ex: 194).
            3. PREÇO: Se não houver, sugira um preço de mercado.
            4. DADOS: Extraia processador, ram, armazenamento e bateria.
            
            Retorne apenas JSON.`,
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
                        weight: { type: Type.NUMBER, description: "Peso em g" },
                        height: { type: Type.NUMBER, description: "Altura em cm" },
                        width: { type: Type.NUMBER, description: "Largura em cm" },
                        length: { type: Type.NUMBER, description: "Espessura em cm" },
                        description: { type: Type.STRING }
                    }
                }
            }
        });
        return res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) {
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

// --- EXECUÇÃO DE SQL MANUAL E AUTOMÁTICA ---
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
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados sincronizado com sucesso!" });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
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
    }

    if (req.method === 'POST') {
        if (path.includes('/products')) {
            const { id, created_at, ...data } = req.body;
            const sanitized = {
                ...data,
                price: Number(data.price) || 0,
                cost_price: Number(data.cost_price) || 0,
                stock: Number(data.stock) || 0,
                min_stock_alert: Number(data.min_stock_alert) || 0,
                weight: Number(data.weight) || 0,
                height: Number(data.height) || 0,
                width: Number(data.width) || 0,
                length: Number(data.length) || 0
            };
            let q = (id && id !== "null") ? supabase.from('products').update(sanitized).eq('id', id) : supabase.from('products').insert(sanitized);
            const { error } = await q;
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true });
        }
    }

    return res.status(404).json({ error: 'Endpoint não encontrado' });
}
