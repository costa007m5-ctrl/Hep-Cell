import type { VercelRequest, VercelResponse } from '@vercel/node';
import { URL } from 'url';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import type { Invoice } from '../src/types';

// --- Funções Auxiliares ---
function getSupabaseAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase env vars missing.');
    return createClient(supabaseUrl, supabaseServiceKey);
}

function getMercadoPagoClient() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error('MP Access Token missing.');
    return new MercadoPagoConfig({ accessToken });
}

function getGeminiClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error('Gemini API Key missing.');
    return new GoogleGenAI({ apiKey });
}

async function logAction(supabase: SupabaseClient, action_type: string, status: 'SUCCESS' | 'FAILURE', description: string, details?: object) {
    try { await supabase.from('action_logs').insert({ action_type, status, description, details }); } catch (e) { console.error('Log failed', e); }
}

async function deductCoins(supabase: SupabaseClient, userId: string, coinsToUse: number): Promise<void> {
    if (coinsToUse <= 0) return;
    const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
    if (!profile || profile.coins_balance < coinsToUse) {
        throw new Error(`Saldo de coins insuficiente.`);
    }
    await supabase.from('profiles').update({ coins_balance: profile.coins_balance - coinsToUse }).eq('id', userId);
}

async function handleCreatePreference(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();
        const { amount, description, id, redirect, payerEmail, userId, coinsToUse } = req.body;

        if (!amount || !description || !id) return res.status(400).json({ error: 'Dados incompletos.' });

        if (coinsToUse && userId) {
            await deductCoins(supabase, userId, coinsToUse);
        }

        const finalAmount = Math.max(0.01, Number(amount));

        const preference = new Preference(client);
        const preferenceBody: any = {
            items: [{ id: id, title: description, quantity: 1, unit_price: finalAmount, currency_id: 'BRL' }],
            external_reference: id,
            statement_descriptor: "RELP CELL",
            binary_mode: true,
        };

        if (payerEmail) preferenceBody.payer = { email: payerEmail };

        if (redirect) {
            const origin = req.headers.origin || 'https://relpcell.com';
            preferenceBody.back_urls = { success: `${origin}?payment_status=success`, failure: `${origin}?payment_status=failure`, pending: `${origin}?payment_status=pending` };
            preferenceBody.auto_return = 'approved';
        }
        const result = await preference.create({ body: preferenceBody });
        res.status(200).json({ id: result.id, init_point: result.init_point });
    } catch (error: any) {
        console.error('Erro MP Preference:', error);
        res.status(500).json({ error: error.message });
    }
}

async function handleCreatePixPayment(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();
        const { invoiceId, amount, description, payerEmail, userId, firstName, lastName, identificationNumber, coinsToUse } = req.body;

        if (!invoiceId || !amount || !userId) return res.status(400).json({ message: 'Dados incompletos.' });

        let profile = { first_name: firstName, last_name: lastName, identification_number: identificationNumber };
        if (!firstName || !identificationNumber) {
            const { data } = await supabase.from('profiles').select('first_name, last_name, identification_number').eq('id', userId).single();
            if (!data) return res.status(400).json({ code: 'INCOMPLETE_PROFILE', message: 'Perfil incompleto.' });
            profile = data;
        }

        if (coinsToUse) {
            await deductCoins(supabase, userId, coinsToUse);
        }

        const transactionAmount = Number(Number(amount).toFixed(2));

        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: transactionAmount,
                description: description,
                payment_method_id: 'pix',
                external_reference: invoiceId,
                payer: {
                    email: payerEmail,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    identification: { type: 'CPF', number: profile.identification_number!.replace(/\D/g, '') }
                }
            }
        });

        if (!result.id || !result.point_of_interaction?.transaction_data) throw new Error('Erro API MP Pix.');

        await supabase.from('invoices').update({ 
            payment_id: String(result.id), 
            status: 'Em aberto',
            payment_method: 'pix',
            payment_code: result.point_of_interaction.transaction_data.qr_code,
            payment_expiration: result.date_of_expiration
        }).eq('id', invoiceId);

        res.status(200).json({
            paymentId: result.id,
            qrCode: result.point_of_interaction.transaction_data.qr_code,
            qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64,
            expires: result.date_of_expiration,
        });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
}

async function handleCreateBoletoPayment(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const client = getMercadoPagoClient();
    try {
        const { invoiceId, amount, description, payer, userId, coinsToUse } = req.body;
        if (!invoiceId || !amount || !payer) return res.status(400).json({ error: 'Dados incompletos.' });
        
        if (coinsToUse && userId) {
            await deductCoins(supabase, userId, coinsToUse);
        }

        const transactionAmount = Number(Number(amount).toFixed(2));
        
        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: transactionAmount,
                description: description,
                payment_method_id: 'bolbradesco',
                external_reference: invoiceId,
                payer: {
                    email: payer.email,
                    first_name: payer.firstName,
                    last_name: payer.lastName,
                    identification: { type: 'CPF', number: payer.identificationNumber.replace(/\D/g, '') },
                    address: {
                        zip_code: payer.zipCode.replace(/\D/g, ''),
                        street_name: payer.streetName,
                        street_number: payer.streetNumber || 'S/N',
                        neighborhood: payer.neighborhood,
                        city: payer.city,
                        federal_unit: payer.federalUnit,
                    },
                },
            },
        });

        const responseData = result as any;
        const boletoUrl = responseData.transaction_details?.external_resource_url || responseData.point_of_interaction?.transaction_data?.ticket_url;
        const boletoBarcode = responseData.barcode?.content || responseData.point_of_interaction?.transaction_data?.bar_code;
        
        if (!result.id || !boletoUrl) throw new Error('MP não retornou boleto.');

        await supabase.from('invoices').update({
            payment_id: String(result.id),
            status: 'Boleto Gerado',
            boleto_url: boletoUrl,
            boleto_barcode: boletoBarcode || null,
            payment_method: 'boleto'
        }).eq('id', invoiceId);

        res.status(200).json({ paymentId: result.id, boletoUrl, boletoBarcode });

    } catch (error: any) {
        res.status(500).json({ error: 'Falha ao gerar boleto.', message: error.message });
    }
}

async function handleGenerateMessage(req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        const { customerName, amount } = req.body;
        const prompt = `Gere uma mensagem curta de confirmação de pagamento de R$ ${amount} para ${customerName}.`;
        const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        res.status(200).json({ message: response.text });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
}

// --- Webhook: Processar Pagamento e CASHBACK + GERAR PARCELAS ---
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();
        const { body } = req;

        if (body.type === 'payment' && body.data?.id) {
            const paymentId = body.data.id;
            const payment = new Payment(client);
            const paymentDetails = await payment.get({ id: paymentId });
            
            if (!paymentDetails || !paymentDetails.id) return res.status(200).send('OK (Ignorado)');

            let newStatus: Invoice['status'] | null = null;
            if (paymentDetails.status === 'approved') newStatus = 'Paga';
            else if (paymentDetails.status === 'cancelled') newStatus = paymentDetails.status_detail === 'expired' ? 'Expirado' : 'Cancelado';

            if (newStatus) {
                // Busca a fatura
                const { data: invoices, error } = await supabase.from('invoices')
                    .update({ status: newStatus, payment_date: newStatus === 'Paga' ? new Date().toISOString() : null })
                    .eq('payment_id', String(paymentId))
                    .select();
                
                let invoice = invoices?.[0];
                
                // Fallback busca por referência externa se payment_id não foi salvo
                if (!invoice && paymentDetails.external_reference) {
                     const { data: invRef } = await supabase.from('invoices')
                        .update({ status: newStatus, payment_date: new Date().toISOString(), payment_id: String(paymentId) })
                        .eq('id', paymentDetails.external_reference)
                        .select()
                        .single();
                     invoice = invRef;
                }

                if (invoice && newStatus === 'Paga') {
                    // 1. Cashback
                    const { data: setting } = await supabase.from('system_settings').select('value').eq('key', 'cashback_percentage').single();
                    const cashbackPercent = parseFloat(setting?.value || '1.5');
                    const amountPaid = paymentDetails.transaction_amount || invoice.amount;
                    const coinsEarned = Math.floor(amountPaid * (cashbackPercent / 100) * 100);

                    if (coinsEarned > 0) {
                        const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', invoice.user_id).single();
                        await supabase.from('profiles').update({ coins_balance: (profile?.coins_balance || 0) + coinsEarned }).eq('id', invoice.user_id);
                        await supabase.from('notifications').insert({
                            user_id: invoice.user_id,
                            title: 'Cashback Recebido!',
                            message: `Você ganhou ${coinsEarned} Relp Coins.`,
                            type: 'success'
                        });
                    }

                    // 2. Gerar Parcelas Restantes (Se for pagamento de ENTRADA)
                    // Verifica se o campo 'notes' começa com 'ENTRADA|'
                    if (invoice.notes && invoice.notes.startsWith('ENTRADA|')) {
                        const parts = invoice.notes.split('|');
                        // Formato: ENTRADA|CONTRACT_ID|REMAINING_AMOUNT|COUNT|DAY
                        if (parts.length >= 5) {
                            const contractId = parts[1];
                            const remainingAmount = parseFloat(parts[2]);
                            const count = parseInt(parts[3]);
                            const dueDay = parseInt(parts[4]);
                            
                            // Se restam parcelas (count > 1, pois 1 seria só a entrada que já foi paga, mas na lógica de venda, count é total parcelas)
                            // A entrada é a "primeira", então geramos as count-1 restantes, ou as count se a entrada não contou como parcela 1 (depende da regra de negócio).
                            // Assumindo que 'count' no note é o número TOTAL de parcelas do financiamento.
                            
                            // Se a entrada foi paga, geramos as parcelas do saldo restante.
                            if (remainingAmount > 0 && count > 0) {
                                const installmentValue = remainingAmount / count;
                                const invoicesToCreate = [];
                                const today = new Date();

                                for (let i = 1; i <= count; i++) {
                                    const dueDate = new Date();
                                    dueDate.setDate(dueDay);
                                    dueDate.setMonth(today.getMonth() + i);
                                    
                                    // Ajuste para não pular mês (ex: 31 fev)
                                    if (dueDate.getMonth() !== (today.getMonth() + i) % 12) {
                                        dueDate.setDate(0);
                                    }

                                    invoicesToCreate.push({
                                        user_id: invoice.user_id,
                                        month: `Parcela ${i}/${count}`,
                                        due_date: dueDate.toISOString().split('T')[0],
                                        amount: installmentValue,
                                        status: 'Em aberto',
                                        notes: `Contrato ${contractId}`
                                    });
                                }
                                
                                if (invoicesToCreate.length > 0) {
                                    await supabase.from('invoices').insert(invoicesToCreate);
                                    await logAction(supabase, 'INSTALLMENTS_GENERATED', 'SUCCESS', `Geradas ${count} parcelas automáticas para contrato ${contractId}`);
                                }
                            }
                        }
                    }
                }
            }
        }
        res.status(200).send('OK');
    } catch (error: any) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: 'Erro webhook' });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === '/api/mercadopago/webhook') return await handleWebhook(req, res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method Not Allowed` });
  }

  switch (path) {
    case '/api/mercadopago/create-preference': return await handleCreatePreference(req, res);
    case '/api/mercadopago/create-pix-payment': return await handleCreatePixPayment(req, res);
    case '/api/mercadopago/create-boleto-payment': return await handleCreateBoletoPayment(req, res);
    case '/api/mercadopago/generate-message': return await handleGenerateMessage(req, res);
    default: return res.status(404).json({ error: 'Route not found' });
  }
}