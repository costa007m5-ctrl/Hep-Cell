
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";
import { MercadoPagoConfig, Payment } from 'mercadopago';

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

async function getMercadoPagoClient(supabase: any) {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'mp_access_token').single();
    const accessToken = data?.value || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
    return new MercadoPagoConfig({ accessToken });
}

function extractJson(text: string) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return null;
    }
}

// --- HANDLERS ---

async function handleChat(req: VercelRequest, res: VercelResponse) {
    const { message, context } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const systemInstruction = context || "Você é o assistente virtual da Relp Cell.";
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: message,
            config: { systemInstruction, maxOutputTokens: 300 }
        });
        return res.json({ reply: response.text || "Desculpe, não entendi." });
    } catch (error: any) {
        return res.status(500).json({ error: "Erro no processamento da IA." });
    }
}

async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const systemInstruction = "Você é um especialista em extração de dados de produtos. Receba um texto bruto com especificações e retorne um JSON estrito com os campos: name, brand, model, processor, ram, storage, display, os, camera, battery, connectivity, color, description_short (resumo comercial).";
        
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: rawText,
            config: { 
                systemInstruction, 
                responseMimeType: "application/json" 
            }
        });

        const jsonText = response.text || "{}";
        const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '');
        
        return res.json(JSON.parse(cleanJson));
    } catch (error: any) {
        return res.status(500).json({ error: "Erro ao processar com IA." });
    }
}

async function handleGetOrders(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                profiles:user_id (first_name, last_name, email, phone)
            `)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error("Erro ao buscar orders:", error);
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
        
        if (error) {
            console.error("Erro SQL update order:", error);
            throw new Error(`Erro no banco: ${error.message}`);
        }
        
        if (status) {
             const { data: order } = await supabase.from('orders').select('user_id').eq('id', orderId).single();
             if (order) {
                 const statusLabels: any = {
                     'preparing': 'está sendo preparado',
                     'shipped': 'foi enviado',
                     'out_for_delivery': 'saiu para entrega',
                     'delivered': 'foi entregue'
                 };
                 const msg = `Seu pedido ${statusLabels[status] || 'teve o status atualizado'}. ${notes ? `Obs: ${notes}` : ''}`;
                 await supabase.from('notifications').insert({
                     user_id: order.user_id,
                     title: 'Atualização do Pedido',
                     message: msg.trim(),
                     type: 'info'
                 });
             }
        }
        return res.json({ success: true });
    } catch (error: any) {
        console.error("Erro geral update order:", error);
        return res.status(500).json({ error: error.message });
    }
}

async function handleManageCoins(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { userId, amount, action } = req.body;
    try {
        const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
        if (!profile) throw new Error("Perfil não encontrado.");
        let newBalance = profile.coins_balance || 0;
        const val = Math.abs(parseInt(amount));
        if (action === 'add') newBalance += val;
        else if (action === 'remove') newBalance = Math.max(0, newBalance - val);
        else if (action === 'set') newBalance = val;
        await supabase.from('profiles').update({ coins_balance: newBalance }).eq('id', userId);
        return res.json({ success: true, newBalance });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { 
        userId, productName, totalAmount, installments, signature, 
        saleType, paymentMethod, downPayment, dueDay, address, 
        coinsUsed
    } = req.body;

    try {
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (!profile || profile.coins_balance < coinsUsed) throw new Error("Saldo insuficiente.");
            await supabase.from('profiles').update({ coins_balance: profile.coins_balance - coinsUsed }).eq('id', userId);
        }

        let contractId = null;
        if (signature) {
            const { data: contract } = await supabase.from('contracts').insert({
                user_id: userId,
                title: `Contrato - ${productName}`,
                items: `Contrato de Venda: ${productName}. Valor: ${totalAmount}.`,
                total_value: totalAmount,
                status: 'Assinado',
                signature_data: signature,
                terms_accepted: true
            }).select('id').single();
            contractId = contract?.id;
        }

        const invoices = [];
        const today = new Date();
        
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
                    dueDate.setDate(dueDay || today.getDate()); 
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

        // CRIA O PEDIDO NA TABELA ORDERS
        const orderStatus = saleType === 'direct' ? 'processing' : 'processing'; 
        const trackingNote = saleType === 'direct' ? "Aguardando pagamento para envio." : "Aguardando aprovação do crédito/entrada.";

        const { error: orderError } = await supabase.from('orders').insert({
            user_id: userId,
            status: orderStatus, 
            total: totalAmount,
            payment_method: saleType === 'direct' ? paymentMethod : 'crediario',
            address_snapshot: address,
            items_snapshot: [{ name: productName, price: totalAmount }],
            tracking_notes: trackingNote
        });

        if (orderError) {
            console.error("Erro ao criar pedido na tabela orders:", orderError);
        }

        return res.json({ success: true, paymentData: { type: saleType, invoicesCreated: invoices.length } });
    } catch (error: any) {
        console.error("Erro handleCreateSale:", error);
        return res.status(500).json({ error: error.message });
    }
}

async function handleSyncMissingOrders(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        // Busca faturas recentes que indicam inicio de venda
        const { data: invoices } = await supabase
            .from('invoices')
            .select('*')
            .or('notes.ilike.%ENTRADA%,notes.ilike.%VENDA_AVISTA%')
            .order('created_at', { ascending: false });

        if (!invoices) return res.json({ message: 'Nenhuma fatura base encontrada.' });

        let createdCount = 0;

        for (const invoice of invoices) {
            const invDate = new Date(invoice.created_at);
            const minDate = new Date(invDate.getTime() - 60000).toISOString();
            const maxDate = new Date(invDate.getTime() + 60000).toISOString();

            // Verifica se já existe um pedido para este usuário neste horário
            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id')
                .eq('user_id', invoice.user_id)
                .gte('created_at', minDate)
                .lte('created_at', maxDate)
                .maybeSingle();

            if (!existingOrder) {
                // Recupera valor total (aproximado)
                let realTotal = invoice.amount;
                let productName = 'Produto Recuperado';
                
                if (invoice.notes && invoice.notes.includes('|')) {
                    const parts = invoice.notes.split('|');
                    if(parts.length >= 3) {
                        const remaining = parseFloat(parts[2]);
                        realTotal = invoice.amount + remaining;
                    }
                }
                
                if (invoice.month.includes('-')) {
                    productName = invoice.month.split('-')[1].trim();
                }

                await supabase.from('orders').insert({
                    user_id: invoice.user_id,
                    status: 'processing',
                    total: realTotal,
                    created_at: invoice.created_at, 
                    payment_method: invoice.notes?.includes('VENDA_AVISTA') ? 'pix' : 'crediario',
                    tracking_notes: 'Pedido recuperado automaticamente.',
                    items_snapshot: [{ name: productName, price: realTotal }]
                });
                createdCount++;
            }
        }

        return res.json({ success: true, recovered: createdCount });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `CREATE TABLE IF NOT EXISTS action_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), action_type TEXT, status TEXT, description TEXT, details JSONB, created_at TIMESTAMPTZ DEFAULT now());`;
    try {
        await supabase.rpc('exec_sql', { sql_query: sql });
        return res.json({ success: true });
    } catch (e: any) { 
        return res.status(500).json({ error: e.message + " - Instale a função exec_sql no Supabase." }); 
    }
}

async function handleExecuteSql(req: VercelRequest, res: VercelResponse) {
    const { sql } = req.body;
    const supabase = getSupabaseAdmin();
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleGetAuditInvoices(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data } = await supabase.from('invoices').select('*, profiles:user_id(first_name, last_name, email, identification_number)').or('status.eq.Em aberto,status.eq.Boleto Gerado').order('due_date');
        return res.json(data);
    } catch(e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleApproveInvoiceManual(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { invoiceId } = req.body;
    try {
        const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
        if(!invoice) throw new Error("Fatura não encontrada");

        await supabase.from('invoices').update({
            status: 'Paga',
            payment_date: new Date().toISOString(),
            payment_method: 'manual_admin',
            notes: (invoice.notes || '') + ' | APROVADO MANUALMENTE'
        }).eq('id', invoiceId);

        const coinsEarned = Math.floor(invoice.amount * 0.015 * 100); 
        if (coinsEarned > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', invoice.user_id).single();
            await supabase.from('profiles').update({ coins_balance: (profile?.coins_balance || 0) + coinsEarned }).eq('id', invoice.user_id);
        }

        await supabase.from('action_logs').insert({
            action_type: 'MANUAL_INVOICE_APPROVAL',
            status: 'SUCCESS',
            description: `Admin baixou fatura ${invoiceId}.`,
            details: { invoiceId }
        });

        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleGetWebhookLogs(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase
            .from('action_logs')
            .select('*')
            .like('action_type', 'WEBHOOK%')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw error;
        return res.json(data);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleDebugMpPayment(req: VercelRequest, res: VercelResponse) {
    const { paymentId } = req.body;
    const supabase = getSupabaseAdmin();
    try {
        const client = await getMercadoPagoClient(supabase);
        const payment = new Payment(client);
        const paymentDetails = await payment.get({ id: paymentId });
        
        let updated = false;
        if (paymentDetails.status === 'approved' && paymentDetails.external_reference) {
             const { error } = await supabase.from('invoices').update({ 
                 status: 'Paga', 
                 payment_date: new Date().toISOString(), 
                 payment_id: String(paymentId) 
             }).eq('id', paymentDetails.external_reference);
             if (!error) updated = true;
        }

        return res.json({ 
            mp_status: paymentDetails.status, 
            mp_detail: paymentDetails.status_detail,
            invoice_updated: updated,
            full_data: paymentDetails
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message || "Erro MP" });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();
    const action = req.query.action || '';
    const isRoute = (route: string) => path.includes(route) || action === route.replace('/', '');

    try {
        if (isRoute('/test-supabase')) return res.json({ success: true });
        if (isRoute('/chat')) return await handleChat(req, res);
        if (isRoute('/setup-database')) return await handleSetupDatabase(res);
        if (isRoute('/execute-sql')) return await handleExecuteSql(req, res);
        if (isRoute('/auto-fill-product')) return await handleAutoFillProduct(req, res);
        if (isRoute('/create-sale')) return await handleCreateSale(req, res);
        if (isRoute('/sync-orders')) return await handleSyncMissingOrders(res); // Novo Endpoint
        if (isRoute('/get-orders')) return await handleGetOrders(res);
        if (isRoute('/update-order')) return await handleUpdateOrderStatus(req, res);
        if (isRoute('/manage-coins')) return await handleManageCoins(req, res);
        if (isRoute('/audit-invoices')) return await handleGetAuditInvoices(res);
        if (isRoute('/approve-invoice')) return await handleApproveInvoiceManual(req, res);
        if (isRoute('/webhook-logs')) return await handleGetWebhookLogs(res);
        if (isRoute('/debug-mp-payment')) return await handleDebugMpPayment(req, res);

        if (req.method === 'GET' && isRoute('/products')) {
             const { data } = await supabase.from('products').select('*');
             return res.json(data);
        }
        if (isRoute('/profiles')) {
             const { data } = await supabase.from('profiles').select('*');
             return res.json(data);
        }
        if (isRoute('/invoices')) {
             const { data } = await supabase.from('invoices').select('*');
             return res.json(data);
        }

        return res.status(404).json({ error: 'Endpoint não encontrado', path, action });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
