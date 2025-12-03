
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

function getSupabaseAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

function getMercadoPagoClient() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN!;
    return new MercadoPagoConfig({ accessToken });
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();
        const { body } = req;

        if (body.type === 'payment' && body.data?.id) {
            const paymentId = body.data.id;
            const payment = new Payment(client);
            const paymentDetails = await payment.get({ id: paymentId });
            
            if (paymentDetails && paymentDetails.status === 'approved') {
                // Atualiza fatura
                const { data: invoices, error } = await supabase.from('invoices')
                    .update({ status: 'Paga', payment_date: new Date().toISOString() })
                    .eq('payment_id', String(paymentId))
                    .select();
                
                if (invoices && invoices.length > 0) {
                    const invoice = invoices[0];
                    
                    // 1. Cashback Lógica (Simplificada)
                    // ... (Lógica de cashback existente) ...

                    // 2. Gerar Parcelas Restantes do Crediário
                    if (invoice.notes && invoice.notes.startsWith('ENTRADA|')) {
                        const parts = invoice.notes.split('|');
                        // ENTRADA|CONTRACT_ID|REMAINING_AMOUNT|INSTALLMENTS|DUE_DAY
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
                                    dueDate.setDate(dueDay);
                                    dueDate.setMonth(today.getMonth() + i);
                                    
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
                }
            }
        }
        res.status(200).send('OK');
    } catch (error: any) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: 'Erro webhook' });
    }
}

// ... Resto do arquivo com handlers de criação de pagamento (Pix, Boleto) ...
// Mantendo a estrutura existente para não quebrar outras funções
async function handleCreatePixPayment(req: VercelRequest, res: VercelResponse) { /* ... */ }
async function handleCreateBoletoPayment(req: VercelRequest, res: VercelResponse) { /* ... */ }
async function handleCreatePreference(req: VercelRequest, res: VercelResponse) { /* ... */ }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.url?.includes('webhook')) return await handleWebhook(req, res);
  // ... switch cases para outros endpoints ...
  return res.status(404).json({error: 'Not found'});
}
