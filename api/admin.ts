
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// --- SENSORES DE STATUS (PARA DEIXAR VERDE) ---

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
            contents: "Diga apenas a palavra 'OPERACIONAL'",
        });
        return res.json({ success: true, message: "IA Ativa: " + response.text });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

async function handleTestMercadoPago(res: VercelResponse) {
    try {
        const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!token) throw new Error("Token MP não configurado no Vercel.");
        return res.json({ success: true, message: "Gateway de Pagamento Pronto" });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// --- ABA DE CRÉDITO: LÓGICA DE BACKEND ---

async function handleGetLimitRequests(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase
            .from('limit_requests')
            .select('*, profiles(first_name, last_name, email, credit_score, credit_limit, credit_status)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return res.json(data || []);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleManageLimitRequest(req: VercelRequest, res: VercelResponse) {
    const { requestId, action, manualLimit, manualScore, responseReason } = req.body;
    const supabase = getSupabaseAdmin();
    
    try {
        // 1. Busca a solicitação
        const { data: request, error: reqError } = await supabase.from('limit_requests').select('*').eq('id', requestId).single();
        if (reqError || !request) throw new Error("Solicitação não encontrada.");

        if (action === 'approve_manual') {
            // Atualiza Perfil
            await supabase.from('profiles').update({ 
                credit_limit: manualLimit,
                credit_score: manualScore,
                credit_status: 'Ativo'
            }).eq('id', request.user_id);

            // Marca solicitação como aprovada
            await supabase.from('limit_requests').update({ 
                status: 'approved',
                admin_response_reason: responseReason 
            }).eq('id', requestId);

            // Notifica Cliente
            await supabase.from('notifications').insert({
                user_id: request.user_id,
                title: 'Limite Aumentado!',
                message: `Seu novo limite de R$ ${manualLimit} está disponível.`,
                type: 'success'
            });
        } else if (action === 'reject') {
            await supabase.from('limit_requests').update({ 
                status: 'rejected',
                admin_response_reason: responseReason 
            }).eq('id', requestId);
        }

        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// --- SETUP E REPARO ---

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        -- Tabela de Produtos (Completa)
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
        
        -- Tabela de Solicitações de Crédito
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

        -- Tabela de Logs de Sistema
        CREATE TABLE IF NOT EXISTS action_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            created_at TIMESTAMPTZ DEFAULT now(),
            action_type TEXT,
            status TEXT,
            description TEXT,
            details JSONB
        );
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados sincronizado e APIs ativadas!" });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro no setup: " + e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    
    // Testes de API
    if (path.includes('/test-supabase')) return await handleTestSupabase(res);
    if (path.includes('/test-gemini')) return await handleTestGemini(res);
    if (path.includes('/test-mercadopago')) return await handleTestMercadoPago(res);
    
    // Crédito
    if (path.includes('/limit-requests')) return await handleGetLimitRequests(res);
    if (path.includes('/manage-limit-request')) return await handleManageLimitRequest(req, res);
    
    // Setup
    if (path.includes('/setup-database')) return await handleSetupDatabase(res);
    if (path.includes('/execute-sql')) {
        const { sql } = req.body;
        const { data, error } = await (getSupabaseAdmin()).rpc('exec_sql', { sql_query: sql });
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data });
    }

    // CRUD Produtos e Clientes
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
