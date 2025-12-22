
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";
import { MercadoPagoConfig, PaymentMethods } from 'mercadopago';

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Auxiliar para extrair JSON da IA
function extractJson(text: string) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
    } catch (e) { return null; }
}

// --- TESTE REAL GEMINI ---
async function handleTestGemini(res: VercelResponse) {
    try {
        const key = process.env.API_KEY;
        if (!key) throw new Error("API_KEY não encontrada nas variáveis de ambiente.");

        const ai = new GoogleGenAI({ apiKey: key });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "Diga apenas: OK",
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });

        if (!response.text) throw new Error("A IA respondeu, mas o conteúdo veio vazio.");

        return res.json({ 
            success: true, 
            message: "IA Hub Conectado", 
            details: { model: "gemini-3-flash-preview", status: "Operacional" } 
        });
    } catch (e: any) {
        console.error("Gemini Test Error:", e);
        return res.status(500).json({ error: "Erro Gemini: " + e.message });
    }
}

// --- TESTE REAL MERCADO PAGO ---
async function handleTestMercadoPago(res: VercelResponse) {
    try {
        const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!token) throw new Error("ACCESS_TOKEN não configurado.");

        const client = new MercadoPagoConfig({ accessToken: token });
        const paymentMethods = new PaymentMethods(client);
        
        // Tenta buscar os métodos de pagamento para validar o token
        await paymentMethods.get();

        return res.json({ 
            success: true, 
            message: "Gateway Operacional", 
            details: { status: "Autenticado" } 
        });
    } catch (e: any) {
        console.error("MP Test Error:", e);
        return res.status(500).json({ error: "Erro Mercado Pago: Token Inválido ou Expirado." });
    }
}

// --- IA: AUTO PREENCHIMENTO ---
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "Texto base vazio." });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Extraia as specs técnicas em JSON deste texto: "${rawText}". Regras: Preço deve ser número, Dimensões em CM.`,
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
                        processor: { type: Type.STRING },
                        ram: { type: Type.STRING },
                        storage: { type: Type.STRING },
                        display: { type: Type.STRING },
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
        return res.json(data);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// --- REPARO E SALVAMENTO ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();

    try {
        if (path.includes('/test-supabase')) {
            const { error } = await supabase.from('profiles').select('id').limit(1);
            return res.json({ success: !error, message: error ? "Erro de Conexão" : "Banco OK" });
        }
        if (path.includes('/test-gemini')) return await handleTestGemini(res);
        if (path.includes('/test-mercadopago')) return await handleTestMercadoPago(res);
        if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);

        // CRUD PRODUTOS COM CONVERSÃO DE TIPOS
        if (req.method === 'POST' && path.includes('/products')) {
            const { id, created_at, ...payload } = req.body;
            
            // Sanitização Total: Força campos numéricos a serem Number
            const sanitized = {
                ...payload,
                price: parseFloat(payload.price) || 0,
                cost_price: parseFloat(payload.cost_price) || 0,
                stock: parseInt(payload.stock) || 0,
                weight: parseFloat(payload.weight) || 0,
                height: parseFloat(payload.height) || 0,
                width: parseFloat(payload.width) || 0,
                length: parseFloat(payload.length) || 0,
                min_stock_alert: parseInt(payload.min_stock_alert) || 2
            };

            const q = (id && id !== "null") 
                ? supabase.from('products').update(sanitized).eq('id', id)
                : supabase.from('products').insert(sanitized);

            const { error } = await q;
            if (error) throw error;
            return res.json({ success: true });
        }

        // Listagem segura para abas (Garante retorno de array)
        if (req.method === 'GET') {
            if (path.includes('/products')) {
                const { data } = await supabase.from('products').select('*').order('name');
                return res.json(data || []);
            }
            if (path.includes('/profiles')) {
                const { data } = await supabase.from('profiles').select('*').order('created_at');
                return res.json(data || []);
            }
            if (path.includes('/invoices')) {
                const { data } = await supabase.from('invoices').select('*').order('due_date');
                return res.json(data || []);
            }
        }

        if (path.includes('/setup-database')) {
            const sql = `
                -- Tabelas Essenciais se não existirem
                CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, price NUMERIC, created_at TIMESTAMPTZ DEFAULT now());
                CREATE TABLE IF NOT EXISTS invoices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), amount NUMERIC, status TEXT, due_date DATE, user_id UUID, created_at TIMESTAMPTZ DEFAULT now());
                
                -- Colunas do Catálogo
                ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS model TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
                ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS processor TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS ram TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS storage TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS display TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS battery TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;

                -- Colunas Adicionais Invoices
                ALTER TABLE invoices ADD COLUMN IF NOT EXISTS month TEXT;
                ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
                ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;
                ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_id TEXT;
                ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT;
            `;
            const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, message: "Banco sincronizado com sucesso!" });
        }

        return res.status(404).json({ error: "Endpoint não mapeado." });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
