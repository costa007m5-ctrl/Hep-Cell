
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";
import { URL } from 'url';

function getSupabaseAdminClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Handler para o Assistente IA de Cadastro
async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "Texto bruto é necessário." });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Extraia as informações do seguinte produto eletrônico e retorne EXCLUSIVAMENTE um JSON válido conforme o esquema. Texto: ${rawText}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        model: { type: Type.STRING },
                        category: { type: Type.STRING },
                        condition: { type: Type.STRING },
                        description: { type: Type.STRING },
                        processor: { type: Type.STRING },
                        ram: { type: Type.STRING },
                        storage: { type: Type.STRING },
                        display: { type: Type.STRING },
                        camera: { type: Type.STRING },
                        battery: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        weight: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        length: { type: Type.NUMBER },
                        package_content: { type: Type.STRING },
                        warranty_manufacturer: { type: Type.INTEGER }
                    }
                }
            }
        });

        const extractedData = JSON.parse(response.text || '{}');
        return res.json(extractedData);
    } catch (e: any) {
        return res.status(500).json({ error: "Falha na IA: " + e.message });
    }
}

// DIAGNÓSTICO: Teste Supabase
async function handleTestSupabase(res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw error;
        return res.json({ message: "Supabase: Conexão Estável" });
    } catch (e: any) { return res.status(500).json({ error: "Erro Supabase: " + e.message }); }
}

// DIAGNÓSTICO: Teste Gemini
async function handleTestGemini(res: VercelResponse) {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Diga "ONLINE"',
        });
        return res.json({ message: "Gemini: " + response.text });
    } catch (e: any) { return res.status(500).json({ error: "Erro Gemini: " + e.message }); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);
    if (path.includes('/test-supabase')) return await handleTestSupabase(res);
    if (path.includes('/test-gemini')) return await handleTestGemini(res);

    const supabase = getSupabaseAdminClient();

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
            const product = req.body;
            const { error } = await supabase.from('products').upsert(product);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true });
        }
    }

    return res.status(404).json({ error: 'Endpoint não encontrado: ' + path });
}
