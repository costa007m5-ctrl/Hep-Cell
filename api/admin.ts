
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

// Inicialização segura do Supabase Admin
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// --- HANDLERS DE DIAGNÓSTICO (Para os indicadores ficarem VERDES) ---

async function testSupabase(res: VercelResponse) {
    try {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw error;
        return res.json({ message: "Conexão Estável", status: "ok" });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro de Conexão: " + e.message });
    }
}

async function testGemini(res: VercelResponse) {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API_KEY não configurada no ambiente.");
        
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Diga apenas: ONLINE',
        });
        return res.json({ message: `IA Ativa: ${response.text}`, status: "ok" });
    } catch (e: any) {
        return res.status(500).json({ error: "IA Offline: " + e.message });
    }
}

async function testMercadoPago(res: VercelResponse) {
    try {
        const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!token) throw new Error("Token MP não configurado.");
        
        const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Token inválido ou expirado.");
        return res.json({ message: "API Financeira Ativa", status: "ok" });
    } catch (e: any) {
        return res.status(500).json({ error: "MP Offline: " + e.message });
    }
}

// --- HANDLERS DE FUNCIONALIDADES ---

async function handleChat(req: VercelRequest, res: VercelResponse) {
    const { message, context } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Contexto: ${context}\n\nPergunta do Cliente: ${message}`,
            config: {
                systemInstruction: "Você é o RelpBot, assistente da Relp Cell. Seja amigável, curto e ajude com faturas e crédito."
            }
        });
        return res.json({ reply: response.text });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        // SQL para garantir estrutura mínima
        const sql = `
            CREATE TABLE IF NOT EXISTS action_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at TIMESTAMPTZ DEFAULT now(),
                action_type TEXT,
                status TEXT,
                description TEXT,
                details JSONB
            );
            
            ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 500;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
            
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
        return res.json({ success: true, message: "Banco sincronizado!", error });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();

    // Roteamento de Diagnóstico
    if (path.includes('/test-supabase')) return await testSupabase(res);
    if (path.includes('/test-gemini')) return await testGemini(res);
    if (path.includes('/test-mercadopago')) return await testMercadoPago(res);
    if (path.includes('/setup-database')) return await handleSetupDatabase(res);

    // Roteamento de Chat
    if (path.includes('/chat')) return await handleChat(req, res);

    // Roteamento de Dados (GET)
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
        if (path.includes('/settings')) {
            const { data } = await supabase.from('system_settings').select('*');
            const settings = data?.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});
            return res.json(settings || {});
        }
        if (path.includes('/get-logs')) {
            const { data } = await supabase.from('action_logs').select('*').order('created_at', { ascending: false }).limit(50);
            return res.json(data || []);
        }
    }

    // Roteamento de Ações (POST)
    if (req.method === 'POST') {
        if (path.includes('/settings')) {
            const { key, value } = req.body;
            const { error } = await supabase.from('system_settings').upsert({ key, value });
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true });
        }
        
        if (path.includes('/products')) {
            const product = req.body;
            const { id, created_at, ...data } = product;
            let query;
            if (id && id !== "" && id !== "null") {
                query = supabase.from('products').update(data).eq('id', id);
            } else {
                query = supabase.from('products').insert(data);
            }
            const { error, data: result } = await query.select();
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, data: result });
        }
    }

    return res.status(404).json({ error: 'Endpoint não implementado: ' + path });
}
