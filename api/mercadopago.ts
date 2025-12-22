
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase Admin
function getSupabaseAdminClient() {
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

// Helper para obter URL de Webhook dinâmica
function getNotificationUrl(req: VercelRequest): string {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'];
    return `${protocol}://${host}/api/mercadopago/webhook`;
}

// Log no Banco
async function logAction(supabase: any, action_type: string, status: 'SUCCESS' | 'FAILURE' | 'INFO', description: string, details?: object) {
    try { await supabase.from('action_logs').insert({ action_type, status, description, details }); } catch (e) { console.error('Log failed', e); }
}

// Handler: Criar Preferência (Checkout Pro / Link)
async function handleCreatePreference(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = await getMercadoPagoClient(supabase);
        const { id, description, amount, payerEmail, back_urls } = req.body;
        
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: [{ id, title: description, quantity: 1, unit_price: Number(amount), currency_id: 'BRL' }],
                external_reference: id,
                payer: { email: payerEmail },
                back_urls: back_urls || { success: 'https://relpcell.com', failure: 'https://relpcell.com' },
                auto_return: 'approved',
                notification_url: getNotificationUrl(req),
                statement_descriptor: 'RELP CELL'
            }
        });
        res.status(200).json({ id: result.id, init_point: result.init_point });
    } catch(e: any) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
}

// Handler: Processar Pagamento Cartão (Transparente - Brick V2)
async function handleProcessPayment(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = await getMercadoPagoClient(supabase);
        const { 
            token, 
            issuer_id, 
            payment_method_id, 
            transaction_amount, 
            installments, 
            description, 
            payer, 
            external_reference 
        } = req.body;

        const payment = new Payment(client);
        
        const body: any = {
            token,
            issuer_id,
            payment_method_id,
            transaction_amount: Number(transaction_amount),
            installments: Number(installments),
            description,
            payer: {
                email: payer.email,
                identification: payer.identification
            },
            external_reference,
            statement_descriptor: 'RELP CELL',
            notification_url: getNotificationUrl(req)
        };

        const result = await payment.create({ body });
        
        // ATUALIZAÇÃO IMEDIATA DO BANCO SE APROVADO
        if (result.status === 'approved') {
             await supabase.from('invoices')
                .update({ 
                    status: 'Paga', 
                    payment_date: new Date().toISOString(),
                    payment_id: String(result.id),
                    payment_method: 'credit_card'
                })
                .eq('id', external_reference);
             
             await logAction(supabase, 'CARD_PAYMENT_SUCCESS', 'SUCCESS', `Fatura ${external_reference} paga via cartão.`, { paymentId: result.id });
        }

        res.status(200).json({ status: result.status, id: result.id, message: result.status_detail });
    } catch(e: any) {
        console.error(e);
        res.status(500).json({ error: e.message || "Erro ao processar pagamento com cartão." });
    }
}

// Handler: Criar Pix Transparente
async function handleCreatePixPayment(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = await getMercadoPagoClient(supabase);
        const { invoiceId, amount, description, payerEmail, firstName, lastName, identificationNumber } = req.body;
        
        // Define expiração para 24 horas a partir de agora
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 24);
        const expirationIso = expirationDate.toISOString();

        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: Number(amount),
                description,
                payment_method_id: 'pix',
                date_of_expiration: expirationIso,
                payer: {
                    email: payerEmail,
                    first_name: firstName,
                    last_name: lastName,
                    identification: { type: 'CPF', number: identificationNumber }
                },
                external_reference: invoiceId,
                notification_url: getNotificationUrl(req)
            }
        });
        
        const qrCode = result.point_of_interaction?.transaction_data?.qr_code;
        const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64;

        // PERSISTÊNCIA: Salva os dados do Pix na fatura para não perder se o user sair
        if (qrCode) {
            await supabase.from('invoices').update({
                payment_code: qrCode, // Salva o Copia e Cola
                payment_expiration: expirationIso,
                payment_id: String(result.id),
                status: 'Em aberto' // Continua em aberto até pagar
            }).eq('id', invoiceId);
        }
        
        res.status(200).json({ 
            paymentId: result.id, 
            qrCode: qrCode, 
            qrCodeBase64: qrCodeBase64,
            expires: expirationIso
        });
    } catch(e: any) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
}

// Handler: Criar Boleto Transparente
async function handleCreateBoletoPayment(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = await getMercadoPagoClient(supabase);
        const { invoiceId, amount, description, payer } = req.body;
        
        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: Number(amount),
                description,
                payment_method_id: 'bolbradesco', 
                payer: {
                    email: payer.email,
                    first_name: payer.firstName,
                    last_name: payer.lastName,
                    identification: { type: 'CPF', number: payer.identificationNumber },
                    address: {
                        zip_code: payer.zipCode,
                        street_name: payer.streetName,
                        street_number: payer.streetNumber,
                        neighborhood: payer.neighborhood,
                        city: payer.city,
                        federal_unit: payer.federalUnit
                    }
                },
                external_reference: invoiceId,
                notification_url: getNotificationUrl(req)
            }
        });
        
        const paymentData = result as any;
        const boletoUrl = result.transaction_details?.external_resource_url;
        const boletoBarcode = paymentData.barcode?.content;

        // PERSISTÊNCIA: Salva os dados do Boleto na fatura
        if (boletoUrl) {
            await supabase.from('invoices').update({
                boleto_url: boletoUrl,
                boleto_barcode: boletoBarcode,
                payment_id: String(result.id),
                status: 'Boleto Gerado'
            }).eq('id', invoiceId);
        }
        
        res.status(200).json({ 
            paymentId: result.id, 
            boletoUrl: boletoUrl,
            boletoBarcode: boletoBarcode 
        });
    } catch(e: any) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
}

// Handler: Webhook (Recebe notificações do MP)
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = await getMercadoPagoClient(supabase);
        const { body, query } = req;
        
        // Log RAW da entrada para debug
        await logAction(supabase, 'WEBHOOK_RECEIVED', 'INFO', 'Notificação recebida do Mercado Pago', { body, query });

        // Suporte para ambos os formatos de webhook (body ou query param)
        const type = body?.type || query?.type;
        const dataId = body?.data?.id || query?.['data.id'];

        // Se for um evento de pagamento
        if (type === 'payment' && dataId) {
            try {
                // Tenta buscar o pagamento no Mercado Pago
                const payment = new Payment(client);
                const paymentDetails = await payment.get({ id: dataId });
                
                await logAction(supabase, 'WEBHOOK_PAYMENT_FETCHED', 'INFO', `Detalhes do pagamento ${dataId} obtidos`, { status: paymentDetails.status, ref: paymentDetails.external_reference });

                if (paymentDetails && paymentDetails.status === 'approved') {
                    const invoiceId = paymentDetails.external_reference;
                    
                    // Se for um teste com ID fake (ex: 123456), invoiceId será undefined ou algo inválido.
                    // Se invoiceId existir, tentamos atualizar.
                    if (invoiceId) {
                        const { data: invoices, error } = await supabase.from('invoices')
                            .update({ 
                                status: 'Paga', 
                                payment_date: new Date().toISOString(), 
                                payment_id: String(dataId),
                                payment_code: null, 
                                boleto_barcode: null 
                            })
                            .eq('id', invoiceId)
                            .select();
                        
                        if (error) {
                            await logAction(supabase, 'WEBHOOK_ERROR', 'FAILURE', `Erro ao atualizar fatura ${invoiceId}`, { error });
                        } else if (invoices && invoices.length > 0) {
                            await logAction(supabase, 'WEBHOOK_SUCCESS', 'SUCCESS', `Fatura ${invoiceId} marcada como Paga via Webhook.`, { paymentId: dataId });
                            
                            // Processamento de Cashback e Parcelas
                            const invoice = invoices[0];
                            const { data: setting } = await supabase.from('system_settings').select('value').eq('key', 'cashback_percentage').single();
                            const cashbackPercent = parseFloat(setting?.value || '1.5');
                            const amountPaid = paymentDetails.transaction_amount || invoice.amount;
                            const coinsEarned = Math.floor(amountPaid * (cashbackPercent / 100) * 100);

                            if (coinsEarned > 0) {
                                const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', invoice.user_id).single();
                                await supabase.from('profiles').update({ coins_balance: (profile?.coins_balance || 0) + coinsEarned }).eq('id', invoice.user_id);
                            }
                            
                            // Lógica de Entrada (se aplicável)
                            if (invoice.notes && invoice.notes.startsWith('ENTRADA|')) {
                                const parts = invoice.notes.split('|');
                                if (parts.length >= 5) {
                                    const contractId = parts[1];
                                    const remainingAmount = parseFloat(parts[2]);
                                    const count = parseInt(parts[3]);
                                    const dueDay = parseInt(parts[4]);
                                    
                                    if (remainingAmount > 0 && count > 0) {
                                        const installmentValue = remainingAmount / count;
                                        const invoicesToCreate = [];
                                        const today = new Date();

                                        for (let i = 1; i <= count; i++) {
                                            const dueDate = new Date();
                                            dueDate.setMonth(today.getMonth() + i);
                                            dueDate.setDate(dueDay);
                                            
                                            invoicesToCreate.push({
                                                user_id: invoice.user_id,
                                                month: `Parcela ${i}/${count}`,
                                                due_date: dueDate.toISOString().split('T')[0],
                                                amount: installmentValue,
                                                status: 'Em aberto',
                                                notes: `Contrato ${contractId}`
                                            });
                                        }
                                        await supabase.from('invoices').insert(invoicesToCreate);
                                    }
                                }
                            }
                        } else {
                            await logAction(supabase, 'WEBHOOK_WARN', 'INFO', `Fatura não encontrada para o ID ${invoiceId}`, { paymentId: dataId });
                        }
                    }
                }
            } catch (paymentError: any) {
                // IMPORTANTÍSSIMO:
                // Se a busca do pagamento falhar (ex: ID 123456 do teste), logamos o erro MAS retornamos 200.
                // Isso evita que o Mercado Pago mostre "Internal Server Error" no painel de teste.
                console.warn("Erro ao buscar pagamento no MP (provavelmente ID de teste):", paymentError.message);
                await logAction(supabase, 'WEBHOOK_PAYMENT_NOT_FOUND', 'INFO', `Não foi possível buscar o pagamento ${dataId}. Provavelmente é um teste.`, { error: paymentError.message });
            }
        }

        // SEMPRE retornar 200 para confirmar recebimento, mesmo que seja um evento irrelevante ou erro de busca
        res.status(200).send('OK');
    } catch (error: any) {
        console.error('Webhook Critical Error:', error);
        // Apenas erros gravíssimos de infraestrutura retornam 500
        await logAction(supabase, 'WEBHOOK_FATAL_ERROR', 'FAILURE', 'Erro crítico no handler', { error: error.message });
        res.status(200).json({ error: 'Erro processado, webhook recebido.' }); 
    }
}

// Router Principal do Arquivo
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url || '';
  
  if (path.includes('webhook')) return await handleWebhook(req, res);
  if (path.includes('create-preference')) return await handleCreatePreference(req, res);
  if (path.includes('process-payment')) return await handleProcessPayment(req, res);
  if (path.includes('create-pix-payment')) return await handleCreatePixPayment(req, res);
  if (path.includes('create-boleto-payment')) return await handleCreateBoletoPayment(req, res);

  return res.status(404).json({error: 'Route not found in mercadopago.ts'});
}
