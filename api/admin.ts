
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { URL } from 'url';

function getSupabaseAdminClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Handler de Diagnóstico Supabase
async function handleTestSupabase(req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw error;
        return res.json({ message: "Conexão Estável" });
    } catch (e: any) { return res.status(500).json({ error: "Erro no Banco: " + e.message }); }
}

// Handler de Diagnóstico Gemini
async function handleTestGemini(req: VercelRequest, res: VercelResponse) {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Responda: ONLINE',
        });
        return res.json({ message: "IA Operacional: " + response.text });
    } catch (e: any) { return res.status(500).json({ error: "Erro na IA: " + e.message }); }
}

// Handler de Setup Automático
async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const SQL = `
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS internal_notes TEXT;
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_status TEXT DEFAULT 'Ativo';
        CREATE TABLE IF NOT EXISTS negotiations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES profiles(id),
            message TEXT,
            admin_id TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        );
    `;
    try {
        const { error } = await supabase.rpc('execute_admin_sql', { sql_query: SQL });
        if (error) throw error;
        return res.json({ message: "Banco Sincronizado!" });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    // Roteamento de Diagnóstico
    if (path.includes('/test-supabase')) return await handleTestSupabase(req, res);
    if (path.includes('/test-gemini')) return await handleTestGemini(req, res);
    if (path.includes('/setup-database')) return await handleSetupDatabase(req, res);

    const supabase = getSupabaseAdminClient();

    // CRM e Financeiro
    if (req.method === 'GET') {
        if (path.includes('/profiles')) {
            const { data } = await supabase.from('profiles').select('*').order('first_name');
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
        if (path.includes('/products')) {
            const { data } = await supabase.from('products').select('*').order('name');
            return res.json(data || []);
        }
    }

    if (req.method === 'POST') {
        if (path.includes('/pay-invoice')) {
            const { invoiceId } = req.body;
            await supabase.from('invoices').update({ status: 'Paga', payment_date: new Date().toISOString() }).eq('id', invoiceId);
            return res.json({ success: true });
        }
        if (path.includes('/delete-invoice')) {
            const { invoiceId } = req.body;
            await supabase.from('invoices').delete().eq('id', invoiceId);
            return res.json({ success: true });
        }
        if (path.includes('/add-negotiation')) {
            const { userId, message } = req.body;
            await supabase.from('negotiations').insert({ user_id: userId, message });
            return res.json({ success: true });
        }
        if (path.includes('/products')) {
            const product = req.body;
            const { error } = await supabase.from('products').upsert(product);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true });
        }
    }

    return res.status(404).json({ error: 'Rota administrativa não encontrada: ' + path });
}
