
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// --- IA: AUTO PREENCHIMENTO ULTRA DETALHADO (VERSÃO 3.0) ---
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analise as especificações técnicas deste eletrônico: "${rawText}".
            
            REGRAS DE EXTRAÇÃO:
            1. DIMENSÕES: mm -> cm (divida por 10). Ex: 171.4mm = 17.14cm.
            2. PESO: Extraia o número em gramas.
            3. SKU: Crie um SKU único baseado na marca/modelo.
            4. CONTEÚDO: Liste o que deve vir na embalagem.
            5. PREÇO: Se não houver, estime baseado em mercado.
            
            Retorne JSON rigoroso com os campos de Produto Eletrônico.`,
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
                        condition: { type: Type.STRING, description: "novo, lacrado ou recondicionado" },
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
                        package_content: { type: Type.STRING },
                        certifications: { type: Type.STRING }
                    }
                }
            }
        });
        return res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) {
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        -- Expansão da Tabela de Produtos para o Form Completo
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS description_short TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS highlights TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS secondary_images TEXT[];
        ALTER TABLE products ADD COLUMN IF NOT EXISTS processor TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS ram TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS storage TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS display TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS os TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS camera TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS battery TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS connectivity TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS ports TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS voltage TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS promotional_price NUMERIC;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS pix_discount_percent NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'pronta_entrega';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_manufacturer INTEGER DEFAULT 12;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_store INTEGER DEFAULT 3;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS certifications TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS package_content TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS legal_info TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_highlight BOOLEAN DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados sincronizado com a versão 3.0!" });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    if (path.includes('/execute-sql')) {
        const { sql } = req.body;
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data });
    }
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
            let q = (id && id !== "null") ? supabase.from('products').update(data).eq('id', id) : supabase.from('products').insert(data);
            const { error } = await q;
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true });
        }
    }

    return res.status(404).json({ error: 'Endpoint não encontrado' });
}
