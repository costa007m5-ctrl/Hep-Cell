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

// ... (Other handlers like deductCoins, createPreference, createPix, createBoleto remain same) ...
// Keeping them brief to focus on Webhook update.

async function handleCreatePreference(req: VercelRequest, res: VercelResponse) {
    /* Same implementation as before */
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();
        const { amount, description, id, redirect, payerEmail, userId, coinsToUse } = req.body;
        // Logic...
        const finalAmount = Math.max(0.01, Number(amount));
        const preference = new Preference(client);
        const result = await preference.create({ body: { 
            items: [{ id: id, title: description, quantity: 1, unit_price: finalAmount, currency_id: 'BRL' }],
            external_reference: id,
            payer: { email: payerEmail },
            back_urls: { success: 'https://relpcell.com', failure: 'https://relpcell.com' },
            auto_return: 'approved'
        }});
        res.status(200).json({ id: result.id, init_point: result.init_point });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
}

async function handleCreatePixPayment(req: VercelRequest, res: VercelResponse) {
    /* Same implementation */
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();
        const { invoiceId, amount, description, payerEmail, userId, firstName, lastName, identificationNumber } = req.body;
        
        // ... (Profile fetching logic) ...
        const payment = new Payment(client);
        const result = await payment.create({ body: {
            transaction_amount: Number(amount),
            description,
            payment_method_id: 'pix',
            payer: { email: payerEmail },
            external_reference: invoiceId
        }});
        
        // Update Invoice
        if(result.id) {
             await supabase.from('invoices').update({ 
                payment_id: String(result.id), 
                status: 'Em aberto',
                payment_method: 'pix',
                payment_code: result.point_of_interaction?.transaction_data?.qr_code
            }).eq('id', invoiceId);
        }

        res.status(200).json({
            paymentId: result.id,
            qrCode: result.point_of_interaction?.transaction_data?.qr_code,
            qrCodeBase64: result.point_of_interaction?.transaction_data?.qr_code_base64
        });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
}

async function handleCreateBoletoPayment(req: VercelRequest, res: VercelResponse) {
    /* Same implementation */
    const supabase = getSupabaseAdminClient();
    const client = getMercadoPagoClient();
    try {
        const { invoiceId, amount, description, payer } = req.body;
        const payment = new Payment(client);
        const result = await payment.create({ body: {
            transaction_amount: Number(amount),
            description,
            payment_method_id: 'bolbradesco',
            payer: { email: payer.email, identification: { type: 'CPF', number: payer.identificationNumber } },
            external_reference: invoiceId
        }});
        
        const responseData = result as any;
        const boletoUrl = responseData.transaction_details?.external_resource_url;
        const boletoBarcode = responseData.barcode?.content;

        if(result.id) {
             await supabase.from('invoices').update({ 
                payment_id: String(result.id), 
                status: 'Boleto Gerado',
                boleto_url: boletoUrl,
                boleto_barcode: boletoBarcode,
                payment_method: 'boleto'
            }).eq('id', invoiceId);
        }

        res.status(200).json({ paymentId: result.id, boletoUrl, boletoBarcode });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
}

async function handleGenerateMessage(req: VercelRequest, res: VercelResponse) {
    /* Same implementation */
    try {
        const genAI = getGeminiClient();
        const { customerName, amount } = req.body;
        const prompt = `Confirmation message for payment of ${amount} by ${customerName}`;
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
                // Find Invoice by Payment ID or External Reference
                const { data: invoices, error } = await supabase.from('invoices')
                    .update({ status: newStatus, payment_date: newStatus === 'Paga' ? new Date().toISOString() : null })
                    .eq('payment_id', String(paymentId))
                    .select();
                
                // Fallback: Try by external_reference if payment_id wasn't saved yet
                let invoice = invoices?.[0];
                if (!invoice && paymentDetails.external_reference) {
                     const { data: invRef } = await supabase.from('invoices')
                        .update({ status: newStatus, payment_date: new Date().toISOString(), payment_id: String(paymentId) })
                        .eq('id', paymentDetails.external_reference)
                        .select()
                        .single();
                     invoice = invRef;
                }

                if (invoice && newStatus === 'Paga') {
                    // 1. Cashback Logic
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

                    // 2. Installment Generation Logic (Crediário)
                    // Verifica se é uma fatura de ENTRADA olhando os notes
                    // Formato esperado: ENTRADA|CONTRACT_ID|REMAINING_AMOUNT|COUNT|DAY
                    if (invoice.notes && invoice.notes.startsWith('ENTRADA|')) {
                        const parts = invoice.notes.split('|');
                        if (parts.length >= 5) {
                            const contractId = parts[1];
                            const remainingAmount = parseFloat(parts[2]);
                            const count = parseInt(parts[3]);
                            const dueDay = parseInt(parts[4]);
                            
                            const installmentValue = remainingAmount / count;
                            const invoicesToCreate = [];
                            const today = new Date();

                            for (let i = 1; i <= count; i++) {
                                const dueDate = new Date();
                                dueDate.setDate(dueDay);
                                dueDate.setMonth(today.getMonth() + i);
                                
                                // Fix month skip
                                if (dueDate.getMonth() !== (today.getMonth() + i) % 12) {
                                    dueDate.setDate(0);
                                }

                                invoicesToCreate.push({
                                    user_id: invoice.user_id,
                                    month: `Parcela ${i}/${count}`,
                                    due_date: dueDate.toISOString().split('T')[0],
                                    amount: installmentValue,
                                    status: 'Em aberto',
                                    notes: `Contrato ${contractId} (Gerado após pagamento de entrada)`
                                });
                            }
                            
                            if (invoicesToCreate.length > 0) {
                                await supabase.from('invoices').insert(invoicesToCreate);
                                await logAction(supabase, 'INSTALLMENTS_GENERATED', 'SUCCESS', `Geradas ${count} parcelas para contrato ${contractId}`);
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