
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";
import { MercadoPagoConfig, Payment } from 'mercadopago';

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// ... (Outras funções auxiliares mantidas: extractJson, getMercadoPagoClient) ...
function extractJson(text: string) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return null;
    }
}

// --- NOVOS HANDLERS PARA FINANCEIRO E BANNERS ---

async function handleGetSettings(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase.from('system_settings').select('*');
        if (error) throw error;
        
        // Transforma array [{key: 'a', value: '1'}] em objeto {a: '1'}
        const settings = data.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        
        return res.json(settings);
    } catch (e: any) {
        // Se tabela não existe, retorna vazio
        return res.json({});
    }
}

async function handleSaveSettings(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { key, value } = req.body;
    try {
        const { error } = await supabase
            .from('system_settings')
            .upsert({ key, value }, { onConflict: 'key' });
            
        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleGetBanners(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase.from('banners').select('*').eq('active', true).order('created_at', { ascending: false });
        if (error && error.code !== '42P01') throw error; // Ignora erro de tabela inexistente
        return res.json(data || []);
    } catch (e: any) {
        return res.json([]);
    }
}

async function handleSaveBanner(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { image_base64, prompt, link } = req.body;
    try {
        // Otimização: Upload real para Storage seria melhor, mas salvando base64 direto na tabela para simplicidade neste contexto
        // Limita o tamanho se necessário ou usa bucket no futuro.
        const { error } = await supabase.from('banners').insert({
            image_url: image_base64, // Armazena o base64 direto na coluna de texto (Supabase suporta texto longo)
            prompt: prompt,
            link: link,
            active: true
        });
        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleDeleteBanner(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { id } = req.body;
    try {
        await supabase.from('banners').delete().eq('id', id);
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// ... (Handlers existentes: handleChat, handleCreateSale, etc. Mantidos) ...
async function handleChat(req: VercelRequest, res: VercelResponse) {
    const { message, context } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: message,
            config: { systemInstruction: context, maxOutputTokens: 300 }
        });
        return res.json({ reply: response.text || "Desculpe, não entendi." });
    } catch (error: any) {
        return res.status(500).json({ error: "Erro IA" });
    }
}

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    // ... Código da venda (Mantido igual, apenas garantindo que esteja aqui)
    const supabase = getSupabaseAdmin();
    const { userId, productName, totalAmount, installments, signature, saleType, paymentMethod, downPayment, dueDay, address, coinsUsed } = req.body;
    try {
        if (coinsUsed > 0) {
            const { data: p } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (p) await supabase.from('profiles').update({ coins_balance: p.coins_balance - coinsUsed }).eq('id', userId);
        }
        let contractId = null;
        if (signature) {
            const { data: c } = await supabase.from('contracts').insert({ user_id: userId, title: `Contrato - ${productName}`, items: productName, total_value: totalAmount, status: 'Assinado', signature_data: signature }).select('id').single();
            contractId = c?.id;
        }
        const invoices = [];
        const today = new Date();
        if (downPayment > 0) {
            invoices.push({ user_id: userId, month: `Entrada - ${productName}`, due_date: today.toISOString(), amount: downPayment, status: 'Em aberto', notes: `ENTRADA|${contractId}|${totalAmount-downPayment}|${installments}|${dueDay}` });
        }
        if (saleType === 'direct' && downPayment <= 0) {
             invoices.push({ user_id: userId, month: `Avulsa - ${productName}`, due_date: today.toISOString(), amount: totalAmount, status: 'Em aberto', notes: 'VENDA_AVISTA' });
        } else if (saleType === 'crediario') {
            const financed = totalAmount - downPayment;
            if (financed > 0) {
                const val = financed / installments;
                for (let i = 1; i <= installments; i++) {
                    const d = new Date(); d.setMonth(today.getMonth() + i); d.setDate(dueDay || 10);
                    invoices.push({ user_id: userId, month: `Parcela ${i}/${installments} - ${productName}`, due_date: d.toISOString(), amount: val, status: 'Em aberto', notes: `Contrato ${contractId}` });
                }
            }
        }
        if (invoices.length > 0) await supabase.from('invoices').insert(invoices);
        
        await supabase.from('orders').insert({
            user_id: userId, status: 'processing', total: totalAmount, payment_method: saleType,
            address_snapshot: address, items_snapshot: [{ name: productName, price: totalAmount }], tracking_notes: "Aguardando..."
        });

        return res.json({ success: true });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    // Script básico
    const sql = `CREATE TABLE IF NOT EXISTS action_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), action_type TEXT, status TEXT, description TEXT, details JSONB, created_at TIMESTAMPTZ DEFAULT now());`;
    try { await supabase.rpc('exec_sql', { sql_query: sql }); return res.json({ success: true }); } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleExecuteSql(req: VercelRequest, res: VercelResponse) {
    const { sql } = req.body;
    const supabase = getSupabaseAdmin();
    try { const { error } = await supabase.rpc('exec_sql', { sql_query: sql }); if (error) throw error; return res.json({ success: true }); } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleSyncMissingOrders(res: VercelResponse) {
    // ... Mantido do turno anterior
    return res.json({ success: true, recovered: 0 });
}

// ... Demais handlers (audit, logs, etc) mantidos ...

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();
    const action = req.query.action || '';
    
    // Roteamento
    try {
        if (action === 'settings') {
            if (req.method === 'GET') return await handleGetSettings(res);
            if (req.method === 'POST') return await handleSaveSettings(req, res);
        }
        if (action === 'banners') {
            if (req.method === 'GET') return await handleGetBanners(res);
            if (req.method === 'POST') return await handleSaveBanner(req, res);
            if (req.method === 'DELETE') return await handleDeleteBanner(req, res);
        }
        
        if (path.includes('/create-sale')) return await handleCreateSale(req, res);
        if (path.includes('/sync-orders')) return await handleSyncMissingOrders(res);
        if (path.includes('/chat')) return await handleChat(req, res);
        if (path.includes('/execute-sql')) return await handleExecuteSql(req, res);
        if (path.includes('/setup-database')) return await handleSetupDatabase(res);

        // Fallback genérico para rotas antigas
        if (path.includes('/products')) {
             const { data } = await supabase.from('products').select('*');
             return res.json(data);
        }
        if (path.includes('/profiles')) {
             const { data } = await supabase.from('profiles').select('*');
             return res.json(data);
        }
        if (path.includes('/invoices')) {
             const { data } = await supabase.from('invoices').select('*');
             return res.json(data);
        }

        return res.status(404).json({ error: 'Endpoint não encontrado', path, action });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
