
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
            contents: `TEXTO TÉCNICO DO PRODUTO: "${rawText}"
            
            INSTRUÇÕES OBRIGATÓRIAS DE CONVERSÃO E EXTRAÇÃO:
            1. DIMENSÕES: Se encontrar valores em milímetros (ex: 171,4 mm), você DEVE converter para centímetros dividindo por 10 (ex: 17.14). Retorne apenas o número.
            2. PESO: Extraia o peso em gramas (g). Se o texto disser "194 g", retorne o número 194.
            3. ESPECIFICAÇÕES: Identifique processador, memória RAM, armazenamento e bateria.
            4. CATEGORIA: Classifique como 'Smartphones', 'Acessórios', etc.
            
            Retorne rigorosamente um JSON no formato abaixo.`,
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
                        weight: { type: Type.NUMBER, description: "Peso em gramas" },
                        height: { type: Type.NUMBER, description: "Altura em cm" },
                        width: { type: Type.NUMBER, description: "Largura em cm" },
                        length: { type: Type.NUMBER, description: "Profundidade/Espessura em cm" },
                        description: { type: Type.STRING }
                    },
                    required: ["name", "brand", "model", "price", "weight", "height", "width", "length"]
                }
            }
        });
        return res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) {
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

// --- EXECUÇÃO DE SQL MANUAL ---
async function handleExecuteSql(req: VercelRequest, res: VercelResponse) {
    const { sql } = req.body;
    const supabase = getSupabaseAdmin();
    try {
        // Usa a RPC exec_sql que deve estar configurada no Supabase
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, data });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro no SQL: " + e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();

    if (path.includes('/execute-sql')) return await handleExecuteSql(req, res);
    if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);
    
    if (req.method === 'GET') {
        if (path.includes('/profiles')) {
            const { data } = await supabase.from('profiles').select('*').order('first_name');
            return res.json(data || []);
        }
        if (path.includes('/products')) {
            const { data } = await supabase.from('products').select('*').order('name');
            return res.json(data || []);
        }
        if (path.includes('/invoices')) {
            const { data } = await supabase.from('invoices').select('*').order('due_date', { ascending: false });
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
            // Sanitização para garantir que campos numéricos sejam números
            const sanitizedData = {
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

            let q = (id && id !== "null") ? supabase.from('products').update(sanitizedData).eq('id', id) : supabase.from('products').insert(sanitizedData);
            const { error, data: result } = await q.select();
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, data: result });
        }
    }

    return res.status(404).json({ error: 'Endpoint não encontrado' });
}
