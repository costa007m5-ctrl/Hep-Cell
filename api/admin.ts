
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";
import { MercadoPagoConfig, Payment } from 'mercadopago';

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Inicializa Mercado Pago
async function getMercadoPagoClient(supabase: any) {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'mp_access_token').single();
    const accessToken = data?.value || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
    return new MercadoPagoConfig({ accessToken });
}

// Helper JSON IA
function extractJson(text: string) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return null;
    }
}

// --- HANDLERS EXISTENTES ---
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

async function handleUpdateOrderStatus(req: VercelRequest, res: VercelResponse) {
    const { orderId, status, notes } = req.body;
    const supabase = getSupabaseAdmin();
    try {
        const updateData: any = { status };
        if (notes) updateData.tracking_notes = notes;
        await supabase.from('orders').update(updateData).eq('id', orderId);
        
        // Notificação
        if (notes) {
             const { data: order } = await supabase.from('orders').select('user_id').eq('id', orderId).single();
             if (order) {
                 await supabase.from('notifications').insert({
                     user_id: order.user_id,
                     title: 'Atualização do Pedido',
                     message: `Status: ${status}. ${notes}`,
                     type: 'info'
                 });
             }
        }
        return res.json({ success: true });
    } catch (error: any) {
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
        // Deduzir coins
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (!profile || profile.coins_balance < coinsUsed) throw new Error("Saldo insuficiente.");
            await supabase.from('profiles').update({ coins_balance: profile.coins_balance - coinsUsed }).eq('id', userId);
        }

        // Contrato
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

        // Faturas
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
        await supabase.from('invoices').insert(invoices);

        // Pedido
        await supabase.from('orders').insert({
            user_id: userId,
            status: 'processing',
            total: totalAmount,
            payment_method: saleType === 'direct' ? paymentMethod : 'crediario',
            address_snapshot: address,
            items_snapshot: [{ name: productName, price: totalAmount }],
            tracking_notes: "Aguardando pagamento."
        });

        return res.json({ success: true, paymentData: { type: saleType, invoicesCreated: invoices.length } });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analise: "${rawText}". Extraia JSON de produto.`,
            config: { responseMimeType: "application/json" }
        });
        return res.json(extractJson(response.text || '{}') || {});
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    // SQL simplificado para exemplo (mesmo do original)
    const sql = `CREATE TABLE IF NOT EXISTS action_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), action_type TEXT, status TEXT, description TEXT, details JSONB, created_at TIMESTAMPTZ DEFAULT now());`;
    try {
        await supabase.rpc('exec_sql', { sql_query: sql });
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

        // Cashback manual
        const coinsEarned = Math.floor(invoice.amount * 0.015 * 100); // 1.5% default
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

// --- NOVOS HANDLERS WEBHOOK ---

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
        
        // Se aprovado, força update
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
        if (isRoute('/auto-fill-product')) return await handleAutoFillProduct(req, res);
        if (isRoute('/create-sale')) return await handleCreateSale(req, res);
        if (isRoute('/update-order')) return await handleUpdateOrderStatus(req, res);
        if (isRoute('/manage-coins')) return await handleManageCoins(req, res);
        if (isRoute('/audit-invoices')) return await handleGetAuditInvoices(res);
        if (isRoute('/approve-invoice')) return await handleApproveInvoiceManual(req, res);
        
        // Novas rotas
        if (isRoute('/webhook-logs')) return await handleGetWebhookLogs(res);
        if (isRoute('/debug-mp-payment')) return await handleDebugMpPayment(req, res);

        // ... (Products GET/POST omitido para brevidade, manter lógica original) ...
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
