
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";
import { MercadoPagoConfig, Payment } from 'mercadopago';

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Inicializa Mercado Pago (Dinâmico: Banco ou Env)
async function getMercadoPagoClient(supabase: any) {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'mp_access_token').single();
    const accessToken = data?.value || process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!accessToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
    return new MercadoPagoConfig({ accessToken });
}

// Helper para extração segura de JSON da IA
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
        const systemInstruction = context || "Você é o assistente virtual da Relp Cell. Responda de forma curta, útil e amigável.";
        
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: message,
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 300,
            }
        });

        return res.json({ reply: response.text || "Desculpe, não entendi." });
    } catch (error: any) {
        console.error("Chat Error:", error);
        return res.status(500).json({ error: "Erro no processamento da IA." });
    }
}

async function handleUpdateOrderStatus(req: VercelRequest, res: VercelResponse) {
    const { orderId, status, notes } = req.body; // Adicionado notes
    const supabase = getSupabaseAdmin();

    try {
        const updateData: any = { status };
        if (notes) {
            updateData.tracking_notes = notes; // Salva a observação
        }

        const { error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

        if (error) throw error;

        // Opcional: Criar notificação para o usuário
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
    const { userId, amount, action } = req.body; // action: 'add' | 'remove' | 'set'

    try {
        const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
        if (!profile) throw new Error("Perfil não encontrado.");

        let newBalance = profile.coins_balance || 0;
        const val = Math.abs(parseInt(amount));

        if (action === 'add') newBalance += val;
        else if (action === 'remove') newBalance = Math.max(0, newBalance - val);
        else if (action === 'set') newBalance = val;

        const { error } = await supabase.from('profiles').update({ coins_balance: newBalance }).eq('id', userId);
        if (error) throw error;

        // Log da ação
        await supabase.from('action_logs').insert({
            action_type: 'ADMIN_COIN_ADJUST',
            status: 'SUCCESS',
            description: `Admin ajustou coins do user ${userId}. Ação: ${action} ${val}. Novo Saldo: ${newBalance}.`
        });

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
        // 1. Processar Uso de Coins (Desconto) - ISSO MANTÉM, POIS É GASTO
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (!profile || profile.coins_balance < coinsUsed) {
                throw new Error("Saldo de Relp Coins insuficiente.");
            }
            // Deduzir coins usados na compra
            await supabase.from('profiles').update({ 
                coins_balance: profile.coins_balance - coinsUsed 
            }).eq('id', userId);
        }

        // 2. Criar Contrato (Se houver assinatura - Crediário)
        let contractId = null;
        if (signature) {
            const contractText = `CONTRATO DE COMPRA E VENDA - RELP CELL\n\n` +
                `CLIENTE: ${userId}\nPRODUTO: ${productName}\n` +
                `VALOR TOTAL: R$ ${totalAmount}\n` +
                `FORMA DE PAGAMENTO: ${saleType === 'crediario' ? 'CREDIÁRIO PRÓPRIO' : 'À VISTA'}\n` +
                `PARCELAS: ${installments}x\n` +
                `ENTREGA EM: ${address.street}, ${address.number} - ${address.neighborhood}\n\n` +
                `Declaro estar ciente das taxas de juros e multas por atraso descritas nos Termos de Uso.`;

            const { data: contract, error: contractError } = await supabase.from('contracts').insert({
                user_id: userId,
                title: `Contrato - ${productName}`,
                items: contractText,
                total_value: totalAmount,
                status: 'Assinado',
                signature_data: signature,
                terms_accepted: true
            }).select('id').single();

            if (contractError) throw contractError;
            contractId = contract.id;
        }

        // 3. Gerar Faturas
        const invoices = [];
        const today = new Date();

        // Fatura de Entrada
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

        // Parcelas ou Valor Integral
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

        const { error: invoicesError } = await supabase.from('invoices').insert(invoices);
        if (invoicesError) throw invoicesError;

        // 4. Registrar Pedido
        await supabase.from('orders').insert({
            user_id: userId,
            status: 'processing',
            total: totalAmount,
            payment_method: saleType === 'direct' ? paymentMethod : 'crediario',
            address_snapshot: address,
            items_snapshot: [{ name: productName, price: totalAmount }],
            tracking_notes: "Aguardando confirmação de pagamento para iniciar processo." // Nota inicial
        });

        // REMOVIDO: A geração de coins agora acontece SOMENTE no Webhook do Mercado Pago (pagamento confirmado)
        // ou manualmente pelo admin. Não geramos coins na criação do pedido "Em Aberto".

        return res.json({ success: true, paymentData: { type: saleType, invoicesCreated: invoices.length } });

    } catch (error: any) {
        console.error("Erro ao criar venda:", error);
        return res.status(500).json({ error: error.message || "Erro ao processar venda." });
    }
}

async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "Texto base é obrigatório." });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Você é o mestre de inventário da Relp Cell. Analise: "${rawText}".
            Extraia o máximo de informações técnicas possíveis em JSON conforme a estrutura do banco.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        model: { type: Type.STRING },
                        category: { type: Type.STRING },
                        sku: { type: Type.STRING },
                        condition: { type: Type.STRING },
                        description: { type: Type.STRING },
                        processor: { type: Type.STRING },
                        ram: { type: Type.STRING },
                        storage: { type: Type.STRING },
                        display: { type: Type.STRING },
                        battery: { type: Type.STRING },
                        camera: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        weight: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        length: { type: Type.NUMBER },
                        package_content: { type: Type.STRING }
                    }
                }
            }
        });

        const data = extractJson(response.text || '{}');
        return res.json(data || { error: "IA não gerou JSON válido" });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, price NUMERIC, created_at TIMESTAMPTZ DEFAULT now());
        CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, status TEXT, total NUMERIC, payment_method TEXT, address_snapshot JSONB, items_snapshot JSONB, tracking_notes TEXT, created_at TIMESTAMPTZ DEFAULT now());
        CREATE TABLE IF NOT EXISTS invoices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, month TEXT, due_date DATE, amount NUMERIC, status TEXT, notes TEXT, payment_date TIMESTAMPTZ, payment_id TEXT, boleto_url TEXT, boleto_barcode TEXT, created_at TIMESTAMPTZ DEFAULT now());
        CREATE TABLE IF NOT EXISTS contracts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, items TEXT, total_value NUMERIC, status TEXT, signature_data TEXT, terms_accepted BOOLEAN, created_at TIMESTAMPTZ DEFAULT now());
        -- Garantir colunas
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_notes TEXT;
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados sincronizado!" });
    } catch (e: any) { 
        return res.status(500).json({ error: e.message }); 
    }
}

async function handleGetAuditInvoices(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const { data, error } = await supabase
            .from('invoices')
            .select(`
                *,
                profiles:user_id (first_name, last_name, email, identification_number)
            `)
            .or('status.eq.Em aberto,status.eq.Boleto Gerado')
            .order('due_date', { ascending: true });

        if(error) throw error;
        return res.json(data);
    } catch(e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleApproveInvoiceManual(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { invoiceId } = req.body;

    try {
        // 1. Busca fatura
        const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
        if(!invoice) throw new Error("Fatura não encontrada");

        // 2. Atualiza para Paga
        const { error } = await supabase.from('invoices').update({
            status: 'Paga',
            payment_date: new Date().toISOString(),
            payment_method: 'manual_admin',
            notes: (invoice.notes || '') + ' | APROVADO MANUALMENTE PELO ADMIN'
        }).eq('id', invoiceId);

        if(error) throw error;

        // 3. Aplica Cashback (Igual ao Webhook)
        const { data: setting } = await supabase.from('system_settings').select('value').eq('key', 'cashback_percentage').single();
        const cashbackPercent = parseFloat(setting?.value || '1.5');
        const coinsEarned = Math.floor(invoice.amount * (cashbackPercent / 100) * 100);

        if (coinsEarned > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', invoice.user_id).single();
            await supabase.from('profiles').update({ coins_balance: (profile?.coins_balance || 0) + coinsEarned }).eq('id', invoice.user_id);
        }

        // 4. Log
        await supabase.from('action_logs').insert({
            action_type: 'MANUAL_INVOICE_APPROVAL',
            status: 'SUCCESS',
            description: `Admin aprovou manualmente fatura ${invoiceId} de R$ ${invoice.amount}`,
            details: { invoiceId, coinsEarned }
        });

        return res.json({ success: true, message: "Fatura baixada com sucesso!" });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// Handler para listar Logs de Webhook
async function handleGetWebhookLogs(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        // Busca logs dos últimos 7 dias relacionados a Webhook
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

// Handler para Debug de Pagamento MP (Replay)
async function handleDebugMpPayment(req: VercelRequest, res: VercelResponse) {
    const { paymentId } = req.body;
    const supabase = getSupabaseAdmin();
    
    try {
        const client = await getMercadoPagoClient(supabase);
        const payment = new Payment(client);
        
        // Busca no MP
        const paymentDetails = await payment.get({ id: paymentId });
        
        // Simula o webhook "na marra"
        // Se estiver aprovado, atualiza o banco
        let updateResult = null;
        
        if (paymentDetails.status === 'approved') {
            const invoiceId = paymentDetails.external_reference;
            if (invoiceId) {
                const { data, error } = await supabase.from('invoices')
                    .update({ 
                        status: 'Paga', 
                        payment_date: new Date().toISOString(), 
                        payment_id: String(paymentId),
                        payment_code: null, 
                        boleto_barcode: null 
                    })
                    .eq('id', invoiceId)
                    .select();
                
                if (error) throw error;
                updateResult = data;
                
                // Cashback (simplificado)
                if (data && data.length > 0) {
                     const invoice = data[0];
                     const { data: setting } = await supabase.from('system_settings').select('value').eq('key', 'cashback_percentage').single();
                     const cashbackPercent = parseFloat(setting?.value || '1.5');
                     const coinsEarned = Math.floor(invoice.amount * (cashbackPercent / 100) * 100);
                     if (coinsEarned > 0) {
                        const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', invoice.user_id).single();
                        await supabase.from('profiles').update({ coins_balance: (profile?.coins_balance || 0) + coinsEarned }).eq('id', invoice.user_id);
                     }
                }
            }
        }

        return res.json({ 
            mp_status: paymentDetails.status, 
            mp_detail: paymentDetails.status_detail,
            invoice_updated: !!updateResult,
            data: paymentDetails
        });

    } catch (e: any) {
        return res.status(500).json({ error: e.message || "Erro ao consultar Mercado Pago" });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();
    
    const action = req.query.action || '';
    const isRoute = (route: string) => path.includes(route) || action === route.replace('/', '');

    try {
        if (isRoute('/test-supabase')) {
            const { error } = await supabase.from('profiles').select('id').limit(1);
            return res.json({ success: !error, message: error ? error.message : "Conectado" });
        }
        if (isRoute('/chat')) return await handleChat(req, res);
        if (isRoute('/setup-database')) return await handleSetupDatabase(res);
        if (isRoute('/auto-fill-product')) return await handleAutoFillProduct(req, res);
        if (isRoute('/create-sale')) return await handleCreateSale(req, res);
        if (isRoute('/update-order')) return await handleUpdateOrderStatus(req, res);
        if (isRoute('/manage-coins')) return await handleManageCoins(req, res);
        if (isRoute('/audit-invoices')) return await handleGetAuditInvoices(res);
        if (isRoute('/approve-invoice')) return await handleApproveInvoiceManual(req, res);
        
        // Novas Rotas de Webhook Debug
        if (isRoute('/webhook-logs')) return await handleGetWebhookLogs(res);
        if (isRoute('/debug-mp-payment')) return await handleDebugMpPayment(req, res);

        // ... (GET/POST products mantidos) ...
        if (req.method === 'GET' && isRoute('/products')) {
            const { data } = await supabase.from('products').select('*').order('name');
            return res.json(data || []);
        }
        if (req.method === 'POST' && isRoute('/products')) {
            const { id, ...payload } = req.body;
            const query = (id && id !== "null") 
                ? supabase.from('products').update(payload).eq('id', id)
                : supabase.from('products').insert(payload);
            const { error } = await query;
            if (error) throw error;
            return res.json({ success: true });
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
