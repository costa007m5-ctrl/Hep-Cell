
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { URL } from 'url';

function getSupabaseAdminClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase environment variables missing.');
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Handlers do Backend Admin
async function handlePayInvoice(req: VercelRequest, res: VercelResponse) {
    const { invoiceId } = req.body;
    const supabase = getSupabaseAdminClient();
    try {
        const { error } = await supabase.from('invoices').update({ 
            status: 'Paga', 
            payment_date: new Date().toISOString(),
            notes: 'Baixa manual via Painel Admin'
        }).eq('id', invoiceId);
        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleDeleteInvoice(req: VercelRequest, res: VercelResponse) {
    const { invoiceId } = req.body;
    const supabase = getSupabaseAdminClient();
    try {
        const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === 'POST') {
        if (path.endsWith('/pay-invoice')) return await handlePayInvoice(req, res);
        if (path.endsWith('/delete-invoice')) return await handleDeleteInvoice(req, res);
        
        // Mantém os anteriores
        if (path.endsWith('/setup-database')) {
             // ... lógica de setup ...
        }
    }

    if (req.method === 'GET') {
        const supabase = getSupabaseAdminClient();
        if (path.endsWith('/profiles')) {
             const { data } = await supabase.from('profiles').select('*').order('first_name');
             return res.json(data || []);
        }
        if (path.endsWith('/invoices')) {
             const { data } = await supabase.from('invoices').select('*').order('due_date', { ascending: false });
             return res.json(data || []);
        }
    }

    return res.status(404).json({ error: 'Endpoint admin não encontrado.' });
}
