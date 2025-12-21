
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Função auxiliar para garantir que o JSON da IA seja limpo antes do parse
function cleanAiJson(text: string) {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

// --- IA: AUTO PREENCHIMENTO ULTRA DETALHADO ---
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "Texto base é obrigatório." });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analise as especificações técnicas deste produto eletrônico: "${rawText}".
            
            REGRAS DE CONVERSÃO E EXTRAÇÃO:
            1. DIMENSÕES: Se estiver em mm, divida por 10 para obter cm.
            2. PESO: Retorne o número puro em gramas (g).
            3. SKU: Crie um código único curto (ex: IPH-15-PR).
            4. PREÇO: Se não houver preço no texto, sugira um valor de mercado realista.
            
            Retorne RIGOROSAMENTE apenas o objeto JSON, sem textos explicativos.`,
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
                        description_short: { type: Type.STRING },
                        highlights: { type: Type.STRING },
                        processor: { type: Type.STRING },
                        ram: { type: Type.STRING },
                        storage: { type: Type.STRING },
                        display: { type: Type.STRING },
                        os: { type: Type.STRING },
                        camera: { type: Type.STRING },
                        battery: { type: Type.STRING },
                        connectivity: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        weight: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        length: { type: Type.NUMBER },
                        package_content: { type: Type.STRING }
                    },
                    required: ["name", "price"]
                }
            }
        });

        const cleanedJson = cleanAiJson(response.text || '{}');
        return res.json(JSON.parse(cleanedJson));
    } catch (e: any) {
        console.error("Erro Gemini:", e);
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

// --- TESTES DE CONEXÃO ---
async function handleTestSupabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw error;
        return res.json({ success: true, message: "Conexão com Banco de Dados OK" });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro no Banco: " + e.message });
    }
}

async function handleTestGemini(res: VercelResponse) {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "Diga 'OPERACIONAL'",
        });
        return res.json({ success: true, message: "IA Ativa: " + response.text });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

async function handleTestMercadoPago(res: VercelResponse) {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ error: "Token MP ausente no ambiente." });
    return res.json({ success: true, message: "Gateway Pronto" });
}

// --- SETUP E REPARO ---
async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_highlight BOOLEAN DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT TRUE;
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco sincronizado!" });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    
    // Rotas de Teste (Status)
    if (path.includes('/test-supabase')) return await handleTestSupabase(res);
    if (path.includes('/test-gemini')) return await handleTestGemini(res);
    if (path.includes('/test-mercadopago')) return await handleTestMercadoPago(res);
    
    // Rotas de IA
    if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);
    
    // Rotas de Configuração
    if (path.includes('/setup-database')) return await handleSetupDatabase(res);
    if (path.includes('/settings')) {
        const supabase = getSupabaseAdmin();
        if (req.method === 'GET') {
            const { data } = await supabase.from('system_settings').select('*');
            return res.json(data?.reduce((acc: any, c: any) => ({...acc, [c.key]: c.value}), {}) || {});
        }
        if (req.method === 'POST') {
            const { key, value } = req.body;
            const { error } = await supabase.from('system_settings').upsert({ key, value });
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true });
        }
    }

    // Rotas de Produtos e Clientes
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
            let q = (id && id !== "null") ? supabase.from('products').update(data).eq('id', id) : supabase.from('products').insert(data);
            const { error } = await q;
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true });
        }
    }

    return res.status(404).json({ error: 'Endpoint Admin não encontrado' });
}
