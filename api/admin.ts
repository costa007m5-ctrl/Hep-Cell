
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, Payment } from 'mercadopago';

// --- CONFIGURAÇÃO ---
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Credenciais Supabase ausentes.");
    return createClient(supabaseUrl, supabaseServiceKey);
}

async function getMercadoPagoClient(supabase: any) {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'mp_access_token').single();
    const accessToken = data?.value || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
    return new MercadoPagoConfig({ accessToken });
}

// --- HANDLERS ESPECÍFICOS ---

// 1. CHAT BOT
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
        return res.status(500).json({ error: "Erro no processamento da IA." });
    }
}

// 2. PEDIDOS (ADMIN)
async function handleGetOrders(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`*, profiles:user_id (first_name, last_name, email, phone)`)
            .order('created_at', { ascending: false });
        
        if (error) {
            // Se tabela não existe, retorna array vazio para não quebrar o front
            if (error.code === '42P01') return res.json([]); 
            throw error;
        }
        return res.json(data);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleUpdateOrderStatus(req: VercelRequest, res: VercelResponse) {
    const { orderId, status, notes } = req.body;
    const supabase = getSupabaseAdmin();
    try {
        const updateData: any = {};
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.tracking_notes = notes; 
        
        const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
        if (error) throw error;

        // Notifica usuário
        if (status) {
             const { data: order } = await supabase.from('orders').select('user_id').eq('id', orderId).single();
             if (order) {
                 await supabase.from('notifications').insert({
                     user_id: order.user_id,
                     title: 'Atualização do Pedido',
                     message: `Seu pedido mudou para: ${status}. ${notes ? notes : ''}`,
                     type: 'info'
                 });
             }
        }
        return res.json({ success: true });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

// 3. VENDAS (CRIAÇÃO)
async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { 
        userId, productName, totalAmount, installments, signature, 
        saleType, paymentMethod, downPayment, dueDay, address, 
        coinsUsed
    } = req.body;

    try {
        // Deduz Coins
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (profile) {
                const newBalance = Math.max(0, (profile.coins_balance || 0) - coinsUsed);
                await supabase.from('profiles').update({ coins_balance: newBalance }).eq('id', userId);
            }
        }

        // Cria Contrato
        let contractId = null;
        if (signature) {
            const { data: contract } = await supabase.from('contracts').insert({
                user_id: userId,
                title: `Contrato - ${productName}`,
                items: `Aquisição de ${productName}. Total: R$ ${totalAmount}.`,
                total_value: totalAmount,
                status: 'Assinado',
                signature_data: signature,
                terms_accepted: true
            }).select('id').single();
            contractId = contract?.id;
        }

        // Gera Faturas
        const invoices = [];
        const today = new Date();
        
        // Entrada
        if (downPayment > 0) {
            invoices.push({
                user_id: userId,
                month: `Entrada - ${productName}`,
                due_date: today.toISOString().split('T')[0],
                amount: downPayment,
                status: 'Em aberto',
                notes: `ENTRADA|${contractId || 'Direta'}|${totalAmount - downPayment}|${installments}|${dueDay}` 
            });
        }
        
        // Parcelas ou Valor Total Restante
        if (saleType === 'direct' && downPayment <= 0) {
             invoices.push({
                user_id: userId,
                month: `Compra Avulsa - ${productName}`,
                due_date: today.toISOString().split('T')[0],
                amount: totalAmount,
                status: 'Em aberto',
                notes: 'VENDA_AVISTA'
            });
        } else if (saleType === 'crediario') {
            const financedAmount = totalAmount - downPayment;
            if (financedAmount > 0) {
                const installmentValue = financedAmount / installments;
                for (let i = 1; i <= installments; i++) {
                    const dueDate = new Date();
                    dueDate.setMonth(today.getMonth() + i);
                    dueDate.setDate(dueDay || 10); 
                    invoices.push({
                        user_id: userId,
                        month: `Parcela ${i}/${installments} - ${productName}`,
                        due_date: dueDate.toISOString().split('T')[0],
                        amount: installmentValue,
                        status: 'Em aberto',
                        notes: `Contrato ${contractId}`
                    });
                }
            }
        }
        
        if (invoices.length > 0) {
            await supabase.from('invoices').insert(invoices);
        }

        // Cria Pedido na Tabela Orders (Para aparecer no painel e app)
        await supabase.from('orders').insert({
            user_id: userId,
            status: 'processing', 
            total: totalAmount,
            payment_method: saleType === 'direct' ? paymentMethod : 'crediario',
            address_snapshot: address,
            items_snapshot: [{ name: productName, price: totalAmount }],
            tracking_notes: "Aguardando processamento inicial."
        });

        return res.json({ success: true, paymentData: { type: saleType, invoicesCreated: invoices.length } });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

// 4. AUDITORIA E WEBHOOKS
async function handleGetAuditInvoices(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data } = await supabase.from('invoices')
            .select('*, profiles:user_id(first_name, last_name, email, identification_number)')
            .or('status.eq.Em aberto,status.eq.Boleto Gerado')
            .order('due_date');
        return res.json(data || []);
    } catch(e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleApproveInvoiceManual(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { invoiceId } = req.body;
    try {
        await supabase.from('invoices').update({
            status: 'Paga',
            payment_date: new Date().toISOString(),
            payment_method: 'manual_admin',
            notes: 'APROVADO MANUALMENTE PELO ADMIN'
        }).eq('id', invoiceId);
        return res.json({ success: true });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleGetWebhookLogs(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data } = await supabase.from('action_logs')
            .select('*')
            .like('action_type', 'WEBHOOK%')
            .order('created_at', { ascending: false })
            .limit(50);
        return res.json(data || []);
    } catch (e: any) { return res.json([]); } // Retorna vazio se der erro (ex: tabela nao existe)
}

async function handleDebugMpPayment(req: VercelRequest, res: VercelResponse) {
    const { paymentId } = req.body;
    const supabase = getSupabaseAdmin();
    try {
        const client = await getMercadoPagoClient(supabase);
        const payment = new Payment(client);
        const paymentDetails = await payment.get({ id: paymentId });
        return res.json(paymentDetails);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

// 5. COINS E PRODUTOS
async function handleManageCoins(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { userId, amount, action } = req.body;
    try {
        const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
        let newBalance = profile?.coins_balance || 0;
        if (action === 'add') newBalance += amount;
        if (action === 'remove') newBalance -= amount;
        if (action === 'set') newBalance = amount;
        await supabase.from('profiles').update({ coins_balance: Math.max(0, newBalance) }).eq('id', userId);
        return res.json({ success: true, newBalance });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: rawText,
            config: { 
                systemInstruction: "Extraia dados de produto para JSON: name, brand, model, processor, ram, storage, display, os, camera, battery, connectivity, color, description_short.", 
                responseMimeType: "application/json" 
            }
        });
        return res.json(JSON.parse(response.text || "{}"));
    } catch (e: any) { return res.status(500).json({ error: "Erro IA" }); }
}

// 6. CONFIGURAÇÕES E BANNERS (IA IMAGENS)
async function handleGetSettings(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data } = await supabase.from('system_settings').select('*');
        const settings = (data || []).reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
        return res.json(settings);
    } catch { return res.json({}); }
}

async function handleSaveSettings(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { key, value } = req.body;
    await supabase.from('system_settings').upsert({ key, value }, { onConflict: 'key' });
    return res.json({ success: true });
}

async function handleGetBanners(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    // Retorna todos os banners, não apenas os ativos, para gestão
    const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
    return res.json(data || []);
}

async function handleSaveBanner(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { id, image_base64, prompt, subtitle, link, position, active } = req.body;
    
    // Constrói payload dinamicamente
    const payload: any = {};
    if (image_base64) payload.image_url = image_base64; // Só atualiza imagem se enviada
    if (prompt !== undefined) payload.prompt = prompt;
    if (subtitle !== undefined) payload.subtitle = subtitle;
    if (link !== undefined) payload.link = link;
    if (position !== undefined) payload.position = position;
    if (active !== undefined) payload.active = active;

    if (id) {
        // Update
        const { error } = await supabase.from('banners').update(payload).eq('id', id);
        if (error) throw error;
    } else {
        // Insert (Imagem é obrigatória)
        if (!image_base64) return res.status(400).json({ error: "Imagem obrigatória para novo banner" });
        const { error } = await supabase.from('banners').insert({ ...payload, active: true, position: position || 'hero' });
        if (error) throw error;
    }
    
    return res.json({ success: true });
}

async function handleDeleteBanner(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { id } = req.body;
    await supabase.from('banners').delete().eq('id', id);
    return res.json({ success: true });
}

async function handleGenerateBanner(req: VercelRequest, res: VercelResponse) {
    const { imageBase64, prompt } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        // 1. Gera link sugerido com base no prompt (Texto)
        const linkResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analise este prompt de banner: "${prompt}". Retorne APENAS um link interno sugerido no formato category:Nome ou brand:Nome. Ex: category:Celulares`,
        });
        const suggestedLink = linkResponse.text?.trim() || "";

        // Retorna a imagem original (ou processada no futuro) e o link sugerido
        return res.json({ image: imageBase64, suggestedLink }); 

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// 7. DB UTILS
async function handleExecuteSql(req: VercelRequest, res: VercelResponse) {
    const { sql } = req.body;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
}

async function handleSyncMissingOrders(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { data: invoices } = await supabase.from('invoices').select('*').or('notes.ilike.%ENTRADA%,notes.ilike.%VENDA_AVISTA%');
    let count = 0;
    if (invoices) {
        for (const inv of invoices) {
            const { data: exists } = await supabase.from('orders').select('id').eq('user_id', inv.user_id).gte('created_at', new Date(new Date(inv.created_at).getTime() - 60000).toISOString()).single();
            if (!exists) {
                await supabase.from('orders').insert({
                    user_id: inv.user_id, status: 'processing', total: inv.amount, created_at: inv.created_at,
                    payment_method: 'recuperado', tracking_notes: 'Recuperado via Sync', items_snapshot: [{ name: 'Pedido Recuperado', price: inv.amount }]
                });
                count++;
            }
        }
    }
    return res.json({ success: true, recovered: count });
}

// --- ROTEADOR PRINCIPAL ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const action = req.query.action as string || '';
    const supabase = getSupabaseAdmin();

    // Normaliza rota: aceita tanto ?action=... quanto /api/admin/...
    const isRoute = (route: string) => action === route || path.includes(`/${route}`);

    try {
        // VENDAS & PEDIDOS
        if (isRoute('create-sale')) return await handleCreateSale(req, res);
        if (isRoute('get-orders')) return await handleGetOrders(res);
        if (isRoute('update-order')) return await handleUpdateOrderStatus(req, res);
        if (isRoute('sync-orders')) return await handleSyncMissingOrders(res);

        // AUDITORIA & WEBHOOKS
        if (isRoute('audit-invoices')) return await handleGetAuditInvoices(res);
        if (isRoute('approve-invoice')) return await handleApproveInvoiceManual(req, res);
        if (isRoute('webhook-logs')) return await handleGetWebhookLogs(res);
        if (isRoute('debug-mp-payment')) return await handleDebugMpPayment(req, res);

        // CONFIG & BANNERS
        if (isRoute('settings')) {
            if (req.method === 'POST') return await handleSaveSettings(req, res);
            return await handleGetSettings(res);
        }
        if (isRoute('banners')) {
            if (req.method === 'POST') return await handleSaveBanner(req, res);
            if (req.method === 'DELETE') return await handleDeleteBanner(req, res);
            return await handleGetBanners(res);
        }
        if (isRoute('generate-banner')) return await handleGenerateBanner(req, res); // IA
        if (isRoute('edit-image')) return await handleGenerateBanner(req, res); // Reusa logica

        // UTILS & DB
        if (isRoute('chat')) return await handleChat(req, res);
        if (isRoute('manage-coins')) return await handleManageCoins(req, res);
        if (isRoute('execute-sql')) return await handleExecuteSql(req, res);
        if (isRoute('auto-fill-product')) return await handleAutoFillProduct(req, res);
        
        // LISTAGEM GERAL (Fallback para tabelas)
        if (isRoute('products')) {
            const { data } = await supabase.from('products').select('*').order('created_at', {ascending: false});
            return res.json(data || []);
        }
        if (isRoute('profiles')) {
            const { data } = await supabase.from('profiles').select('*');
            return res.json(data || []);
        }
        if (isRoute('invoices')) {
            const { data } = await supabase.from('invoices').select('*');
            return res.json(data || []);
        }

        return res.status(404).json({ error: 'Endpoint desconhecido', action, path });
    } catch (e: any) {
        console.error("API Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
