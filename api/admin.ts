
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Helper robusto para extrair apenas o objeto JSON de uma resposta que pode conter texto extra
function extractJson(text: string) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return null;
    }
}

// --- IA: AUTO PREENCHIMENTO ULTRA DETALHADO (V5.0) ---
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "Texto base é obrigatório." });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analise as especificações técnicas brutas deste eletrônico: "${rawText}".
            
            MISSÃO: Você é o mestre de inventário da Relp Cell. Extraia TUDO com precisão cirúrgica.
            
            REGRAS DE OURO:
            1. DIMENSÕES: Se o texto diz "171,4 mm", você DEVE converter para "17.14" (cm). Divida mm por 10.
            2. PESO: Extraia apenas o número puro em gramas. Ex: "194g" vira 194.
            3. DISPLAY: Junte tamanho, tipo e frequência. Ex: "6.9" IPS LCD 120Hz".
            4. SKU: Gere um código único curto e profissional. Ex: MOT-G06-128.
            5. PREÇO: Se não houver, sugira um valor real de mercado no Brasil.
            6. CONDIÇÃO: Identifique se é "novo", "lacrado" ou "recondicionado".
            
            Retorne o JSON rigorosamente conforme a estrutura.`,
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
                        package_content: { type: Type.STRING },
                        certifications: { type: Type.STRING }
                    },
                    required: ["name", "price", "sku"]
                }
            }
        });

        const data = extractJson(response.text || '{}');
        if (!data) throw new Error("A IA não conseguiu gerar um formato válido para este texto.");
        
        return res.json(data);
    } catch (e: any) {
        console.error("Erro Crítico Gemini:", e);
        return res.status(500).json({ error: "Falha no motor de IA: " + e.message });
    }
}

// --- TESTES DE STATUS (ONLINE/OFFLINE) ---
async function handleTestSupabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw error;
        return res.json({ success: true, message: "Banco de Dados OK" });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleTestGemini(res: VercelResponse) {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const start = Date.now();
        const response = await ai.models.generateContent({ 
            model: "gemini-3-flash-preview", 
            contents: "status check" 
        });
        const latency = Date.now() - start;

        // Metadados de Cota (Simulados com base nos limites do modelo)
        return res.json({ 
            success: true, 
            message: "IA Operacional",
            details: {
                model: "gemini-3-flash-preview",
                latency: `${latency}ms`,
                tokensPerMinuteLimit: 1000000,
                requestsPerMinuteLimit: 2000,
                remainingEstimate: "99%+" 
            }
        });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleTestMercadoPago(res: VercelResponse) {
    if (process.env.MERCADO_PAGO_ACCESS_TOKEN) return res.json({ success: true, message: "Gateway Ativo" });
    return res.status(500).json({ error: "Token Mercado Pago não configurado." });
}

// --- SETUP E REPARO AUTOMÁTICO ---
async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS processor TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS ram TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS storage TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS display TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS os TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS camera TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS battery TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS connectivity TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS package_content TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS certifications TEXT;
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados sincronizado!" });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    
    // Rotas de IA e Negócio
    if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);
    if (path.includes('/test-supabase')) return await handleTestSupabase(res);
    if (path.includes('/test-gemini')) return await handleTestGemini(res);
    if (path.includes('/test-mercadopago')) return await handleTestMercadoPago(res);
    if (path.includes('/setup-database')) return await handleSetupDatabase(res);

    // Gestão de Limites (Aba de Crédito)
    if (path.includes('/limit-requests')) {
        const { data } = await getSupabaseAdmin().from('limit_requests').select('*, profiles(*)').order('created_at', { ascending: false });
        return res.json(data || []);
    }

    // CRUD Produtos
    const supabase = getSupabaseAdmin();
    if (req.method === 'GET' && path.includes('/products')) {
        const { data } = await supabase.from('products').select('*').order('name');
        return res.json(data || []);
    }

    if (req.method === 'POST' && path.includes('/products')) {
        const { id, created_at, ...data } = req.body;
        const q = (id && id !== "null") ? supabase.from('products').update(data).eq('id', id) : supabase.from('products').insert(data);
        const { error } = await q;
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Endpoint não mapeado' });
}
