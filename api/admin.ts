
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Helper para extração segura de JSON da IA
function extractJson(text: string) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return null;
    }
}

// --- IA: AUTO PREENCHIMENTO (V6.0) ---
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "Texto base é obrigatório." });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Você é o mestre de inventário da Relp Cell. Analise: "${rawText}".
            
            REGRAS OBRIGATÓRIAS:
            1. DIMENSÕES: Converta mm para cm (divida por 10).
            2. PESO: Extraia o valor em gramas.
            3. DISPLAY: Formate como "Tamanho, Tipo, Hz".
            4. SKU: Gere um código único (Ex: MOT-G06-128).
            
            Retorne JSON rigoroso conforme o schema.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        model: { type: Type.STRING },
                        category: { type: Type.STRING },
                        sku: { type: Type.STRING },
                        condition: { type: Type.STRING },
                        description: { type: Type.STRING },
                        processor: { type: Type.STRING },
                        ram: { type: Type.STRING },
                        storage: { type: Type.STRING },
                        display: { type: Type.STRING },
                        battery: { type: Type.STRING },
                        camera: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        weight: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        length: { type: Type.NUMBER }
                    }
                }
            }
        });

        const data = extractJson(response.text || '{}');
        return res.json(data || { error: "IA não gerou JSON válido" });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

// --- SETUP E REPARO (CRITICAL FIX) ---
async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS processor TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS ram TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS storage TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS battery TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS display TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS os TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS camera TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS connectivity TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS package_content TEXT;
    `;
    try {
        // Tenta executar via RPC (requer a função exec_sql no Supabase)
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados sincronizado com sucesso!" });
    } catch (e: any) { 
        return res.status(500).json({ error: "Erro ao sincronizar. Certifique-se de ter a função exec_sql no Supabase: " + e.message }); 
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();

    try {
        // --- ROTAS DE STATUS E SETUP ---
        if (path.includes('/test-supabase')) {
            const { error } = await supabase.from('profiles').select('id').limit(1);
            return res.json({ success: !error, message: error ? error.message : "Conectado" });
        }
        if (path.includes('/test-gemini')) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            const resp = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'ping' });
            return res.json({ success: true, message: "IA Ativa", details: { latency: 'OK' } });
        }
        if (path.includes('/setup-database')) return await handleSetupDatabase(res);
        if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);

        // --- ROTAS DE DADOS (PROTEÇÃO CONTRA TELA PRETA) ---
        if (req.method === 'GET') {
            if (path.includes('/profiles')) {
                const { data } = await supabase.from('profiles').select('*').order('first_name');
                return res.json(data || []);
            }
            if (path.includes('/invoices')) {
                const { data } = await supabase.from('invoices').select('*').order('due_date');
                return res.json(data || []);
            }
            if (path.includes('/products')) {
                const { data } = await supabase.from('products').select('*').order('name');
                return res.json(data || []);
            }
            if (path.includes('/limit-requests')) {
                const { data } = await supabase.from('limit_requests').select('*, profiles(*)').order('created_at', { ascending: false });
                return res.json(data || []);
            }
        }

        // --- SALVAMENTO DE PRODUTO (CORREÇÃO ERRO 500) ---
        if (req.method === 'POST' && path.includes('/products')) {
            const { id, created_at, ...payload } = req.body;
            // Sanitização de dados numéricos para evitar erro de string no banco
            const sanitized = {
                ...payload,
                price: Number(payload.price || 0),
                cost_price: Number(payload.cost_price || 0),
                stock: Number(payload.stock || 0),
                weight: Number(payload.weight || 0),
                height: Number(payload.height || 0),
                width: Number(payload.width || 0),
                length: Number(payload.length || 0)
            };

            const query = (id && id !== "null") 
                ? supabase.from('products').update(sanitized).eq('id', id)
                : supabase.from('products').insert(sanitized);

            const { error } = await query;
            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(404).json({ error: 'Endpoint não encontrado' });
    } catch (e: any) {
        console.error("Admin API Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
