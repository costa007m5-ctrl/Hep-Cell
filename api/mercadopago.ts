import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase Admin
function getSupabaseAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Inicializa Mercado Pago
function getMercadoPagoClient() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN!;
    if (!accessToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
    return new MercadoPagoConfig({ accessToken });
}

// Log no Banco
async function logAction(supabase: any, action_type: string, status: 'SUCCESS' | 'FAILURE', description: string, details?: object) {
    try { await supabase.from('action_logs').insert({ action_type, status, description, details }); } catch (e) { console.error('Log failed', e); }
}

// Handler: Criar Preferência (Checkout Pro / Link)
async function handleCreatePreference(req: VercelRequest, res: VercelResponse) {
    const client = getMercadoPagoClient();
    const { id, description, amount, payerEmail, back_urls } = req.body;
    try {
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: [{ id, title: description, quantity: 1, unit_price: Number(amount), currency_id: 'BRL' }],
                external_reference: id,
                payer: { email: payerEmail },
                back_urls: back_urls || { success: 'https://relpcell.com', failure: 'https://relpcell.com' },
                auto_return: 'approved'
            }
        });
        res.status(200).json({ id: result.id, init_point: result.init_point });
    } catch(e: any) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
}

// Handler: Criar Pix Transparente
async function handleCreatePixPayment(req: VercelRequest, res: VercelResponse) {
    const client = getMercadoPagoClient();
    const { invoiceId, amount, description, payerEmail, firstName, lastName, identificationNumber } = req.body;
    try {
        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: Number(amount),
                description,
                payment_method_id: 'pix',
                payer: {
                    email: payerEmail,
                    first_name: firstName,
                    last_name: lastName,
                    identification: { type: 'CPF', number: identificationNumber }
                },
                external_reference: invoiceId
            }
        });
        
        res.status(200).json({ 
            paymentId: result.id, 
            qrCode: result.point_of_interaction?.transaction_data?.qr_code, 
            qrCodeBase64: result.point_of_interaction?.transaction_data?.qr_code_base64 
        });
    } catch(e: any) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
}

// Handler: Criar Boleto Transparente
async function handleCreateBoletoPayment(req: VercelRequest, res: VercelResponse) {
    const client = getMercadoPagoClient();
    const { invoiceId, amount, description, payer } = req.body;
    try {
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
                external_reference: invoiceId
            }
        });
        res.status(200).json({ 
            paymentId: result.id, 
            boletoUrl: result.transaction_details?.external_resource_url,
            boletoBarcode: result.barcode?.content 
        });
    } catch(e: any) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
}

// Handler: Webhook (Recebe notificações do MP e GERA PARCELAS)
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();
        const { body } = req;

        if (body?.type === 'payment' && body.data?.id) {
            const paymentId = body.data.id;
            const payment = new Payment(client);
            const paymentDetails = await payment.get({ id: paymentId });
            
            if (paymentDetails && paymentDetails.status === 'approved') {
                // 1. Atualiza fatura para Paga
                const { data: invoices } = await supabase.from('invoices')
                    .update({ status: 'Paga', payment_date: new Date().toISOString() })
                    .eq('payment_id', String(paymentId))
                    .select();
                
                if (invoices && invoices.length > 0) {
                    const invoice = invoices[0];
                    
                    // 2. Aplicar Cashback
                    const { data: setting } = await supabase.from('system_settings').select('value').eq('key', 'cashback_percentage').single();
                    const cashbackPercent = parseFloat(setting?.value || '1.5');
                    const amountPaid = paymentDetails.transaction_amount || invoice.amount;
                    const coinsEarned = Math.floor(amountPaid * (cashbackPercent / 100) * 100);

                    if (coinsEarned > 0) {
                        const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', invoice.user_id).single();
                        await supabase.from('profiles').update({ coins_balance: (profile?.coins_balance || 0) + coinsEarned }).eq('id', invoice.user_id);
                    }

                    // 3. CRÍTICO: Gerar Parcelas Restantes do Crediário
                    // Formato da nota: ENTRADA|CONTRACT_ID|REMAINING_AMOUNT|INSTALLMENTS|DUE_DAY
                    if (invoice.notes && invoice.notes.startsWith('ENTRADA|')) {
                        try {
                            const parts = invoice.notes.split('|');
                            const contractId = parts[1];
                            const remainingAmount = parseFloat(parts[2]);
                            const count = parseInt(parts[3]);
                            const dueDay = parseInt(parts[4]);
                            
                            if (remainingAmount > 0 && count > 1) { // count > 1 porque 1 seria a entrada já paga
                                const installmentValue = remainingAmount / count;
                                const invoicesToCreate = [];
                                const today = new Date();

                                for (let i = 1; i <= count; i++) {
                                    const dueDate = new Date();
                                    dueDate.setMonth(today.getMonth() + i); // Mês seguinte
                                    
                                    // Ajuste para o dia de vencimento escolhido
                                    // Se o dia for > 28, ajusta para evitar pular mês (ex: fev)
                                    const targetDay = Math.min(dueDay, 28);
                                    dueDate.setDate(targetDay);
                                    
                                    invoicesToCreate.push({
                                        user_id: invoice.user_id,
                                        month: `Parcela ${i}/${count}`, // Nome limpo
                                        due_date: dueDate.toISOString().split('T')[0],
                                        amount: installmentValue,
                                        status: 'Em aberto',
                                        notes: `Contrato ${contractId}` // Link para agrupamento
                                    });
                                }
                                
                                const { error: insertError } = await supabase.from('invoices').insert(invoicesToCreate);
                                if(insertError) throw insertError;
                                
                                await logAction(supabase, 'INSTALLMENTS_GENERATED', 'SUCCESS', `Geradas ${count} parcelas automáticas.`, { contractId });
                            }
                        } catch (genError: any) {
                            console.error("Erro gerando parcelas:", genError);
                            await logAction(supabase, 'INSTALLMENTS_ERROR', 'FAILURE', `Erro ao gerar parcelas: ${genError.message}`);
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

// Router Principal do Arquivo
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url || '';
  
  if (path.includes('webhook')) return await handleWebhook(req, res);
  if (path.includes('create-preference')) return await handleCreatePreference(req, res);
  if (path.includes('create-pix-payment')) return await handleCreatePixPayment(req, res);
  if (path.includes('create-boleto-payment')) return await handleCreateBoletoPayment(req, res);

  return res.status(404).json({error: 'Route not found in mercadopago.ts'});
}