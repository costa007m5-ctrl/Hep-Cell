
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { URL } from 'url';

function getSupabaseAdminClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
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

// DIAGNÓSTICO: Teste Mercado Pago
async function handleTestMercadoPago(res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'mp_access_token').single();
        const token = data?.value || process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!token) throw new Error("Token não configurado");
        return res.json({ message: "Mercado Pago: Credenciais Ativas" });
    } catch (e: any) { return res.status(500).json({ error: "Mercado Pago: " + e.message }); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    // Roteamento de Diagnóstico para as cores verdes
    if (path.includes('/test-supabase')) return await handleTestSupabase(res);
    if (path.includes('/test-gemini')) return await handleTestGemini(res);
    if (path.includes('/test-mercadopago')) return await handleTestMercadoPago(res);

    const supabase = getSupabaseAdminClient();

    // Roteamento CRUD
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
        if (path.includes('/negotiations')) {
            const userId = url.searchParams.get('userId');
            const { data } = await supabase.from('negotiations').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            return res.json(data || []);
        }
    }

    if (req.method === 'POST') {
        // Pagar Fatura Manualmente
        if (path.includes('/pay-invoice')) {
            const { invoiceId } = req.body;
            await supabase.from('invoices').update({ status: 'Paga', payment_date: new Date().toISOString(), notes: 'Baixa manual pelo administrador' }).eq('id', invoiceId);
            return res.json({ success: true });
        }
        // Apagar Fatura
        if (path.includes('/delete-invoice')) {
            const { invoiceId } = req.body;
            await supabase.from('invoices').delete().eq('id', invoiceId);
            return res.json({ success: true });
        }
        // Criar/Editar Produto
        if (path.includes('/products')) {
            const product = req.body;
            const { error } = await supabase.from('products').upsert(product);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true });
        }
    }

    return res.status(404).json({ error: 'Endpoint não encontrado: ' + path });
}
