
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
            contents: `Extraia as especificações técnicas deste produto eletrônico do seguinte texto: "${rawText}". Retorne os dados para cadastro no sistema.`,
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

// --- IA: ANÁLISE DE CRÉDITO ---
async function handleCreditAnalysisAI(requestId: string, supabase: SupabaseClient, res: VercelResponse) {
    try {
        const { data: request } = await supabase.from('limit_requests').select('*, profiles(*)').eq('id', requestId).single();
        if (!request) throw new Error("Pedido não encontrado");

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const prompt = `Analise este pedido de aumento de limite de crédito:
            Nome: ${request.profiles.first_name}
            Score Atual: ${request.profiles.credit_score}
            Limite Atual: R$ ${request.current_limit}
            Renda Declarada: R$ ${request.profiles.salary || 'Não informada'}
            Valor Solicitado: R$ ${request.requested_amount}
            Justificativa: "${request.justification}"
            
            Retorne uma sugestão prudente de novo limite e novo score, com uma justificativa amigável.`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestedLimit: { type: Type.NUMBER },
                        suggestedScore: { type: Type.NUMBER },
                        reason: { type: Type.STRING }
                    },
                    required: ["suggestedLimit", "suggestedScore", "reason"]
                }
            }
        });
        return res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();

    // Diagnósticos (Mantidos)
    if (path.includes('/test-supabase')) return res.json({ status: "ok" });
    if (path.includes('/test-gemini')) return res.json({ status: "ok" });
    if (path.includes('/setup-database')) {
        const sql = `CREATE TABLE IF NOT EXISTS limit_requests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id), requested_amount NUMERIC, current_limit NUMERIC, justification TEXT, status TEXT DEFAULT 'pending', admin_response_reason TEXT, created_at TIMESTAMPTZ DEFAULT now());`;
        await supabase.rpc('exec_sql', { sql_query: sql });
        return res.json({ success: true });
    }

    // Novos Endpoints de IA
    if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);

    // Endpoints de Crédito
    if (path.includes('/limit-requests')) {
        if (req.method === 'GET') {
            const { data } = await supabase.from('limit_requests').select('*, profiles(*)').order('created_at', { ascending: false });
            return res.json(data || []);
        }
    }

    if (path.includes('/manage-limit-request')) {
        const { requestId, action, manualLimit, manualScore, responseReason } = req.body;
        
        if (action === 'calculate_auto') {
            return await handleCreditAnalysisAI(requestId, supabase, res);
        }

        if (action === 'approve_manual' || action === 'reject') {
            const status = action === 'approve_manual' ? 'approved' : 'rejected';
            const { data: request } = await supabase.from('limit_requests').update({ status, admin_response_reason: responseReason }).eq('id', requestId).select().single();
            
            if (action === 'approve_manual' && request) {
                await supabase.from('profiles').update({ credit_limit: manualLimit, credit_score: manualScore }).eq('id', request.user_id);
                // Log de Score
                await supabase.from('score_history').insert({ user_id: request.user_id, change: manualScore - (request.current_score || 0), new_score: manualScore, reason: "Aumento de limite aprovado" });
            }
            return res.json({ success: true });
        }
    }

    if (path.includes('/client-documents')) {
        const { userId } = req.query;
        const { data: uploads } = await supabase.from('user_uploads').select('*').eq('user_id', userId);
        return res.json({ uploads });
    }

    // Roteamento Geral (GET)
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
    }

    // Roteamento Geral (POST)
    if (req.method === 'POST' && path.includes('/products')) {
        const { id, created_at, ...data } = req.body;
        let query = id && id !== "null" ? supabase.from('products').update(data).eq('id', id) : supabase.from('products').insert(data);
        const { error, data: result } = await query.select();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data: result });
    }

    return res.status(404).json({ error: 'Endpoint não implementado: ' + path });
}
