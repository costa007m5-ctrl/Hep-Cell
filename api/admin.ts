
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

// Inicialização segura do Supabase Admin
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// --- IA: AUTO PREENCHIMENTO DE PRODUTO ---
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analise o seguinte texto técnico de um produto: "${rawText}". 
            Extraia os dados técnicos. 
            IMPORTANTE PARA LOGÍSTICA: 
            1. Converta dimensões de milímetros (mm) para centímetros (cm) dividindo por 10.
            2. O peso deve ser em gramas (g). Se estiver em kg, multiplique por 1000.
            3. Identifique marca, modelo, processador, RAM, armazenamento e bateria.
            4. Sugira um preço competitivo baseado no mercado brasileiro atual se não houver no texto.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        model: { type: Type.STRING },
                        category: { type: Type.STRING },
                        description: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        processor: { type: Type.STRING },
                        ram: { type: Type.STRING },
                        storage: { type: Type.STRING },
                        battery: { type: Type.STRING },
                        weight: { type: Type.NUMBER, description: "Peso em gramas (g)" },
                        height: { type: Type.NUMBER, description: "Altura em centímetros (cm)" },
                        width: { type: Type.NUMBER, description: "Largura em centímetros (cm)" },
                        length: { type: Type.NUMBER, description: "Profundidade/Espessura em centímetros (cm)" },
                        condition: { type: Type.STRING },
                        max_installments: { type: Type.NUMBER }
                    }
                }
            }
        });
        return res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) {
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

// --- SETUP DO BANCO (CORREÇÃO DE COLUNAS) ---
async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const sql = `
            -- Adiciona colunas que podem estar faltando
            ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
            
            -- Garante que as colunas de logística existem
            ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;

            CREATE TABLE IF NOT EXISTS limit_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES auth.users(id),
                requested_amount NUMERIC,
                current_limit NUMERIC,
                justification TEXT,
                status TEXT DEFAULT 'pending',
                admin_response_reason TEXT,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        `;
        
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        return res.json({ success: true, message: "Banco sincronizado e colunas (allow_reviews, min_stock, logística) criadas!", error });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();

    if (path.includes('/setup-database')) return await handleSetupDatabase(res);
    if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);
    if (path.includes('/test-supabase')) return res.json({ status: "ok" });
    if (path.includes('/test-gemini')) return res.json({ status: "ok" });

    // Roteamento de Dados
    if (req.method === 'GET') {
        if (path.includes('/profiles')) {
            const { data } = await supabase.from('profiles').select('*').order('first_name');
            return res.json(data || []);
        }
        if (path.includes('/invoices')) {
            const { data } = await supabase.from('invoices').select('*').order('due_date', { ascending: false });
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

    if (req.method === 'POST') {
        if (path.includes('/products')) {
            const product = req.body;
            const { id, created_at, ...data } = product;
            
            // Sanitização para garantir números
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

            let query;
            if (id && id !== "null") {
                query = supabase.from('products').update(sanitized).eq('id', id);
            } else {
                query = supabase.from('products').insert(sanitized);
            }
            const { error, data: result } = await query.select();
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, data: result });
        }
    }

    return res.status(404).json({ error: 'Endpoint não implementado' });
}
