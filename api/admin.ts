
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

async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "Texto base é obrigatório." });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Você é o mestre de inventário da Relp Cell. Analise: "${rawText}".
            Extraia o máximo de informações técnicas possíveis em JSON conforme a estrutura do banco.`,
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
                        length: { type: Type.NUMBER },
                        package_content: { type: Type.STRING }
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

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        -- Adição de colunas para produtos Relp Cell v7.0
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS description_short TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS highlights TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS secondary_images TEXT[];
        ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT;
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
        ALTER TABLE products ADD COLUMN IF NOT EXISTS promotional_price NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS max_installments INTEGER DEFAULT 12;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS pix_discount_percent NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'pronta_entrega';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS product_class TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_lead_time INTEGER;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_manufacturer INTEGER;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_store INTEGER;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS certifications TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS package_content TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS legal_info TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS exchange_policy TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS internal_notes TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_highlight BOOLEAN DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados sincronizado!" });
    } catch (e: any) { 
        return res.status(500).json({ error: e.message }); 
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();

    try {
        if (path.includes('/test-supabase')) {
            const { error } = await supabase.from('profiles').select('id').limit(1);
            return res.json({ success: !error, message: error ? error.message : "Conectado" });
        }
        if (path.includes('/test-gemini')) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'ping' });
            return res.json({ success: true, message: "IA Ativa" });
        }
        if (path.includes('/setup-database')) return await handleSetupDatabase(res);
        if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);

        if (req.method === 'GET' && path.includes('/products')) {
            const { data } = await supabase.from('products').select('*').order('name');
            return res.json(data || []);
        }

        if (req.method === 'POST' && path.includes('/products')) {
            const { id, created_at, ...payload } = req.body;
            
            // Força tipos corretos para o banco
            const sanitized = {
                ...payload,
                price: Number(payload.price || 0),
                promotional_price: Number(payload.promotional_price || 0),
                cost_price: Number(payload.cost_price || 0),
                stock: Number(payload.stock || 0),
                min_stock_alert: Number(payload.min_stock_alert || 0),
                weight: Number(payload.weight || 0),
                height: Number(payload.height || 0),
                width: Number(payload.width || 0),
                length: Number(payload.length || 0),
                warranty_manufacturer: Number(payload.warranty_manufacturer || 0),
                warranty_store: Number(payload.warranty_store || 0),
                max_installments: Number(payload.max_installments || 12),
                pix_discount_percent: Number(payload.pix_discount_percent || 0)
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
        return res.status(500).json({ error: e.message });
    }
}
