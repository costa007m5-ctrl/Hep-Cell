
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

function cleanAiJson(text: string) {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

// --- IA: AUTO PREENCHIMENTO PROFISSIONAL (VERSÃO 4.0) ---
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "Texto base é obrigatório." });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Você é o mestre de inventário da Relp Cell. Analise: "${rawText}".
            
            REGRAS OBRIGATÓRIAS DE EXTRAÇÃO:
            1. DIMENSÕES: Converta mm para cm (divida por 10). Ex: 171.4mm -> 17.14. Retorne apenas o número.
            2. PESO: Extraia o valor em gramas. Ex: 194g -> 194.
            3. DISPLAY: Formate como "Tamanho, Tipo, Hz". Ex: "6.9 IPS LCD 120Hz".
            4. SKU: Gere um código único baseado no modelo (Ex: MOT-G06-128).
            5. PREÇO: Se não houver, estime baseado no mercado brasileiro.
            
            Retorne JSON rigoroso seguindo o Schema.`,
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

        const cleanedJson = cleanAiJson(response.text || '{}');
        return res.json(JSON.parse(cleanedJson));
    } catch (e: any) {
        return res.status(500).json({ error: "IA falhou: " + e.message });
    }
}

// --- TESTES DE API (PARA FICAR VERDE) ---
async function handleTestSupabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw error;
        return res.json({ success: true, message: "Banco de Dados Operacional" });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleTestGemini(res: VercelResponse) {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: "ping" });
        return res.json({ success: true, message: "Cérebro IA Online" });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleTestMercadoPago(res: VercelResponse) {
    if (process.env.MERCADO_PAGO_ACCESS_TOKEN) {
        return res.json({ success: true, message: "Gateway de Pagamento Pronto" });
    }
    return res.status(500).json({ error: "Token MP não configurado." });
}

// --- GESTÃO DE CRÉDITO ---
async function handleGetLimitRequests(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase.from('limit_requests').select('*, profiles(*)').order('created_at', { ascending: false });
        if (error) throw error;
        return res.json(data || []);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleManageLimitRequest(req: VercelRequest, res: VercelResponse) {
    const { requestId, action, manualLimit, manualScore, responseReason } = req.body;
    const supabase = getSupabaseAdmin();
    try {
        const { data: request } = await supabase.from('limit_requests').select('*').eq('id', requestId).single();
        if (!request) throw new Error("Pedido não encontrado.");

        if (action === 'approve_manual') {
            await supabase.from('profiles').update({ credit_limit: manualLimit, credit_score: manualScore, credit_status: 'Ativo' }).eq('id', request.user_id);
            await supabase.from('limit_requests').update({ status: 'approved', admin_response_reason: responseReason }).eq('id', requestId);
        } else if (action === 'reject') {
            await supabase.from('limit_requests').update({ status: 'rejected', admin_response_reason: responseReason }).eq('id', requestId);
        }
        return res.json({ success: true });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

// --- SETUP E REPARO ---
async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
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

        CREATE TABLE IF NOT EXISTS limit_requests (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id),
            requested_amount NUMERIC NOT NULL,
            current_limit NUMERIC DEFAULT 0,
            justification TEXT,
            status TEXT DEFAULT 'pending',
            admin_response_reason TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        );
    `;
    try {
        await supabase.rpc('exec_sql', { sql_query: sql });
        return res.json({ success: true, message: "Banco 4.0 Sincronizado!" });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    
    if (path.includes('/test-supabase')) return await handleTestSupabase(res);
    if (path.includes('/test-gemini')) return await handleTestGemini(res);
    if (path.includes('/test-mercadopago')) return await handleTestMercadoPago(res);
    if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);
    if (path.includes('/limit-requests')) return await handleGetLimitRequests(res);
    if (path.includes('/manage-limit-request')) return await handleManageLimitRequest(req, res);
    if (path.includes('/setup-database')) return await handleSetupDatabase(res);

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

    if (req.method === 'POST' && path.includes('/products')) {
        const { id, created_at, ...data } = req.body;
        let q = (id && id !== "null") ? supabase.from('products').update(data).eq('id', id) : supabase.from('products').insert(data);
        const { error } = await q;
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Endpoint Admin não encontrado' });
}
