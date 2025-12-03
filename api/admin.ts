
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { URL } from 'url';

function getSupabaseAdminClient(): SupabaseClient {
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

// ... (Outras funções auxiliares mantidas: logAction, generateContentWithRetry, etc. Se não estiverem, assuma as do arquivo original)
async function logAction(supabase: SupabaseClient, action_type: string, status: 'SUCCESS' | 'FAILURE', description: string, details?: object) {
    await supabase.from('action_logs').insert({ action_type, status, description, details });
}

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { 
            userId, 
            totalAmount, 
            installments, 
            productName, 
            saleType, 
            paymentMethod, 
            downPayment, 
            coinsUsed, 
            dueDay, 
            sellerName,
            couponCode,
            signature
        } = req.body;

        if (!userId || !totalAmount) return res.status(400).json({ error: "Dados incompletos." });

        // 1. Cupom
        let finalTotalAmount = totalAmount;
        let discountApplied = 0;
        if (couponCode) {
            const code = couponCode.toUpperCase();
            if (code === 'RELP10') discountApplied = totalAmount * 0.10;
            else if (code === 'BOASVINDAS') discountApplied = 20;
            else if (code === 'PROMO5') discountApplied = totalAmount * 0.05;
            finalTotalAmount = Math.max(0, totalAmount - discountApplied);
        }

        // 2. Coins
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (profile && profile.coins_balance >= coinsUsed) {
                await supabase.from('profiles').update({ coins_balance: profile.coins_balance - coinsUsed }).eq('id', userId);
            }
        }

        // 3. Contrato
        const { data: contract, error: contractError } = await supabase.from('contracts').insert({
            user_id: userId,
            title: `Compra: ${productName}`,
            items: `${productName} (Vendedor: ${sellerName || 'Sistema'})`,
            total_value: finalTotalAmount,
            installments: installments,
            status: saleType === 'crediario' ? 'Assinado' : 'Ativo',
            signature_data: signature,
            terms_accepted: true
        }).select().single();

        if (contractError) throw contractError;

        // 4. Fatura Inicial (Entrada ou Total)
        const isCrediario = saleType === 'crediario';
        const invoiceAmount = isCrediario ? downPayment : finalTotalAmount;
        const today = new Date();
        
        let paymentData: any = null;
        let invoiceId = null;

        if (invoiceAmount > 0) {
            let notes = `Compra Direta ${contract.id}`;
            if (isCrediario) {
                const remaining = finalTotalAmount - downPayment;
                // Webhook vai ler isso para gerar parcelas
                notes = `ENTRADA|${contract.id}|${remaining}|${installments}|${dueDay || 10}`;
            }

            const { data: invoice, error: invError } = await supabase.from('invoices').insert({
                user_id: userId,
                month: isCrediario ? `Entrada - ${productName}` : `Compra - ${productName}`,
                due_date: today.toISOString().split('T')[0],
                amount: invoiceAmount,
                status: 'Em aberto',
                payment_method: paymentMethod,
                notes: notes,
                discountValue: discountApplied
            }).select().single();

            if (invError) throw invError;
            invoiceId = invoice.id;

            // 5. Integração Mercado Pago IMEDIATA
            if (['pix', 'boleto', 'redirect'].includes(paymentMethod)) {
                const mpClient = getMercadoPagoClient();
                const { data: user } = await supabase.auth.admin.getUserById(userId);
                const email = user?.user?.email || 'cliente@relpcell.com';
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

                const payer = {
                    email: email,
                    first_name: profile?.first_name || 'Cliente',
                    last_name: profile?.last_name || 'Relp',
                    identification: { type: 'CPF', number: profile?.identification_number?.replace(/\D/g, '') || '' }
                };

                try {
                    const payment = new Payment(mpClient);
                    if (paymentMethod === 'pix') {
                        const result = await payment.create({
                            body: {
                                transaction_amount: Number(invoiceAmount.toFixed(2)),
                                description: notes,
                                payment_method_id: 'pix',
                                payer,
                                external_reference: invoiceId
                            }
                        });
                        if (result.point_of_interaction) {
                            paymentData = { type: 'pix', qrCode: result.point_of_interaction.transaction_data.qr_code, paymentId: result.id };
                            await supabase.from('invoices').update({ payment_code: paymentData.qrCode, payment_id: String(result.id) }).eq('id', invoiceId);
                        }
                    } else if (paymentMethod === 'boleto') {
                         const result = await payment.create({
                            body: {
                                transaction_amount: Number(invoiceAmount.toFixed(2)),
                                description: notes,
                                payment_method_id: 'bolbradesco',
                                payer: { ...payer, address: { zip_code: '68900000', street_name: 'Rua', street_number: '1', neighborhood: 'Centro', city: 'Macapa', federal_unit: 'AP' } },
                                external_reference: invoiceId
                            }
                        });
                        if (result.barcode) {
                             paymentData = { type: 'boleto', barcode: result.barcode.content, url: result.transaction_details?.external_resource_url, paymentId: result.id };
                             await supabase.from('invoices').update({ boleto_barcode: paymentData.barcode, boleto_url: paymentData.url, payment_id: String(result.id), status: 'Boleto Gerado' }).eq('id', invoiceId);
                        }
                    } else if (paymentMethod === 'redirect') {
                        const preference = new Preference(mpClient);
                        const result = await preference.create({
                            body: {
                                items: [{ id: invoiceId, title: `Pedido Relp Cell`, quantity: 1, unit_price: Number(invoiceAmount.toFixed(2)), currency_id: 'BRL' }],
                                payer: { email: email },
                                external_reference: invoiceId,
                                back_urls: { success: 'https://relpcell.com', failure: 'https://relpcell.com' }
                            }
                        });
                        paymentData = { type: 'redirect', url: result.init_point };
                    }
                } catch (mpError: any) {
                    console.error("Erro MP:", mpError);
                    paymentData = { type: 'error', message: 'Venda criada, mas erro ao gerar pagamento.' };
                }
            } else if (paymentMethod === 'cash') {
                // Dinheiro: Marca pago e gera parcelas JÁ
                await supabase.from('invoices').update({ status: 'Paga', payment_date: new Date().toISOString() }).eq('id', invoiceId);
                if (isCrediario) {
                    // Lógica de geração de parcelas (simplificada)
                    const remaining = finalTotalAmount - downPayment;
                    const installmentVal = remaining / installments;
                    const invs = [];
                    for(let i=1; i<=installments; i++) {
                        const d = new Date(); d.setMonth(d.getMonth() + i); d.setDate(dueDay || 10);
                        invs.push({ user_id: userId, month: `Parcela ${i}/${installments}`, due_date: d.toISOString(), amount: installmentVal, status: 'Em aberto', notes: `Contrato ${contract.id}` });
                    }
                    if(invs.length) await supabase.from('invoices').insert(invs);
                }
                paymentData = { type: 'cash' };
            }
        } else if (isCrediario) {
             // Sem entrada
             const installmentVal = finalTotalAmount / installments;
             const invs = [];
             for(let i=1; i<=installments; i++) {
                const d = new Date(); d.setMonth(d.getMonth() + i); d.setDate(dueDay || 10);
                invs.push({ user_id: userId, month: `Parcela ${i}/${installments}`, due_date: d.toISOString(), amount: installmentVal, status: 'Em aberto', notes: `Contrato ${contract.id}` });
             }
             if(invs.length) await supabase.from('invoices').insert(invs);
             paymentData = { type: 'cash', message: 'Sem entrada.' };
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada: ${productName}`, { contractId: contract.id });
        return res.status(200).json({ success: true, paymentData });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const SQL = `
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "discountValue" numeric(10, 2) DEFAULT 0;
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "notes" text;
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "payment_code" text;
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "boleto_barcode" text;
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "boleto_url" text;
        ALTER TABLE "public"."contracts" ADD COLUMN IF NOT EXISTS "signature_data" text;
    `;
    await supabase.rpc('execute_admin_sql', { sql_query: SQL });
    return res.status(200).json({ message: "Schema updated." });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === 'POST') {
        if (path === '/api/admin/create-sale') return await handleCreateSale(req, res);
        if (path === '/api/admin/setup-database') return await handleSetupDatabase(req, res);
        // ... outros handlers se necessário
    }
    return res.status(404).json({ error: 'Route not found' });
}
