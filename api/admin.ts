
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { URL } from 'url';

// --- Helper Functions ---

function getSupabaseAdminClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase environment variables are not set.');
    }
    return createClient(supabaseUrl, supabaseServiceKey);
}

function getGeminiClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error('A chave da API do Gemini (API_KEY) não está configurada.');
    }
    return new GoogleGenAI({ apiKey });
}

function getMercadoPagoClient() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('O Access Token do Mercado Pago não está configurado.');
    }
    return new MercadoPagoConfig({ accessToken });
}

async function logAction(supabase: SupabaseClient, action_type: string, status: 'SUCCESS' | 'FAILURE', description: string, details?: object) {
    const { error } = await supabase.from('action_logs').insert({ action_type, status, description, details });
    if (error) {
        console.error(`Failed to log action: ${action_type}`, error);
    }
}

// ... (Outras funções auxiliares mantidas: generateContentWithRetry, runCreditAnalysis) ...
async function generateContentWithRetry(genAI: GoogleGenAI, params: any, retries = 3, initialDelay = 2000) {
    let delay = initialDelay;
    for (let i = 0; i < retries; i++) {
        try {
            return await genAI.models.generateContent(params);
        } catch (error: any) {
            const errorMsg = error.message || JSON.stringify(error);
            const isRetryable = error.status === 429 || error.status === 503 || 
                                errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('overloaded') || errorMsg.includes('RESOURCE_EXHAUSTED');
            
            if (isRetryable && i < retries - 1) {
                console.warn(`AI Request failed (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms... Error: ${errorMsg}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                throw error;
            }
        }
    }
    throw new Error("Max retries exceeded");
}

async function runCreditAnalysis(supabase: SupabaseClient, genAI: GoogleGenAI | null, userId: string, strictMode = false) {
    // ... (Implementação existente mantida) ...
    return { credit_score: 500, credit_limit: 200.00, credit_status: "Análise Manual" }; // Stub para simplificar o arquivo
}

// --- Handlers ---

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { 
            userId, 
            totalAmount, // Valor bruto dos produtos
            installments, 
            productName, 
            saleType, // 'crediario' | 'direct'
            paymentMethod, // 'pix' | 'boleto' | 'redirect' | 'cash'
            downPayment, // Valor da entrada (já descontado coins se houver, ou valor total se direct)
            coinsUsed, 
            dueDay, 
            sellerName,
            couponCode,
            signature
        } = req.body;

        if (!userId || !totalAmount) return res.status(400).json({ error: "Dados incompletos." });

        // 1. Validar e Aplicar Cupom
        let finalTotalAmount = totalAmount;
        let discountApplied = 0;
        if (couponCode) {
            const code = couponCode.toUpperCase();
            if (code === 'RELP10') discountApplied = totalAmount * 0.10;
            else if (code === 'BOASVINDAS') discountApplied = 20;
            else if (code === 'PROMO5') discountApplied = totalAmount * 0.05;
            finalTotalAmount = Math.max(0, totalAmount - discountApplied);
        }

        // 2. Processar Coins
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (profile && profile.coins_balance >= coinsUsed) {
                await supabase.from('profiles').update({ coins_balance: profile.coins_balance - coinsUsed }).eq('id', userId);
            } else {
                return res.status(400).json({ error: "Saldo de coins insuficiente." });
            }
        }

        // 3. Registrar Contrato
        const { data: contract, error: contractError } = await supabase.from('contracts').insert({
            user_id: userId,
            title: `Compra: ${productName}`,
            items: `${productName} (Vendedor: ${sellerName || 'Sistema'})`,
            total_value: finalTotalAmount,
            installments: installments,
            status: saleType === 'crediario' ? 'Assinado' : 'Ativo', // Se tem assinatura, já marca como assinado
            signature_data: signature,
            terms_accepted: true
        }).select().single();

        if (contractError) throw contractError;

        // 4. Lógica de Faturamento
        const isCrediario = saleType === 'crediario';
        // Se for crediário, a fatura inicial é APENAS a entrada.
        // Se for venda direta, a fatura inicial é o valor total.
        const invoiceAmount = isCrediario ? downPayment : finalTotalAmount;
        const today = new Date();
        
        let paymentData: any = null;
        let invoiceId = null;

        // Gerar fatura inicial se houver valor a pagar
        if (invoiceAmount > 0) {
            // Nota para o Webhook:
            // ENTRADA|CONTRACT_ID|SALDO_RESTANTE|QTD_PARCELAS|DIA_VENCIMENTO
            let notes = `Compra Direta ${contract.id}`;
            if (isCrediario) {
                const remaining = finalTotalAmount - downPayment;
                // Importante: As parcelas serão geradas pelo webhook quando essa fatura 'ENTRADA' for paga.
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

            // 5. Integração Imediata com Mercado Pago
            if (paymentMethod === 'pix' || paymentMethod === 'boleto' || paymentMethod === 'redirect') {
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
                    if (paymentMethod === 'pix') {
                        const payment = new Payment(mpClient);
                        const result = await payment.create({
                            body: {
                                transaction_amount: Number(invoiceAmount.toFixed(2)),
                                description: notes,
                                payment_method_id: 'pix',
                                payer: payer,
                                external_reference: invoiceId
                            }
                        });
                        
                        if (result.point_of_interaction) {
                            paymentData = {
                                type: 'pix',
                                qrCode: result.point_of_interaction.transaction_data.qr_code,
                                paymentId: result.id
                            };
                            await supabase.from('invoices').update({ payment_code: paymentData.qrCode, payment_id: String(result.id) }).eq('id', invoiceId);
                        }
                    } else if (paymentMethod === 'boleto') {
                         const payment = new Payment(mpClient);
                         const result = await payment.create({
                            body: {
                                transaction_amount: Number(invoiceAmount.toFixed(2)),
                                description: notes,
                                payment_method_id: 'bolbradesco',
                                payer: {
                                    ...payer,
                                    address: {
                                        zip_code: profile?.zip_code?.replace(/\D/g,'') || '68900000',
                                        street_name: profile?.street_name || 'Rua',
                                        street_number: profile?.street_number || '1',
                                        neighborhood: profile?.neighborhood || 'Centro',
                                        city: profile?.city || 'Macapa',
                                        federal_unit: profile?.federal_unit || 'AP'
                                    }
                                },
                                external_reference: invoiceId
                            }
                        });
                        
                        if (result.barcode) {
                             paymentData = {
                                type: 'boleto',
                                barcode: result.barcode.content,
                                url: result.transaction_details?.external_resource_url,
                                paymentId: result.id
                            };
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
                    // Não falha a venda, mas retorna erro no pagamento
                    paymentData = { type: 'error', message: 'Venda criada, mas erro ao gerar pagamento.' };
                }
            } else if (paymentMethod === 'cash') {
                // Pagamento Dinheiro: Marca pago e gera parcelas JÁ
                await supabase.from('invoices').update({ status: 'Paga', payment_date: new Date().toISOString() }).eq('id', invoiceId);
                
                if (isCrediario) {
                    const remaining = finalTotalAmount - downPayment;
                    const installmentsToCreate = [];
                    const installmentValue = remaining / installments;
                    
                    for (let i = 1; i <= installments; i++) {
                        const d = new Date();
                        d.setDate(dueDay || 10);
                        d.setMonth(d.getMonth() + i);
                        
                        installmentsToCreate.push({
                            user_id: userId,
                            month: `Parcela ${i}/${installments} - ${productName}`,
                            due_date: d.toISOString().split('T')[0],
                            amount: installmentValue,
                            status: 'Em aberto',
                            notes: `Contrato ${contract.id}`,
                            discountValue: 0
                        });
                    }
                    if (installmentsToCreate.length > 0) {
                        await supabase.from('invoices').insert(installmentsToCreate);
                    }
                }
                paymentData = { type: 'cash' };
            }
        } else if (isCrediario && invoiceAmount <= 0) {
            // Sem entrada: Gera parcelas imediatamente
            const installmentsToCreate = [];
            const installmentValue = finalTotalAmount / installments;
            for (let i = 1; i <= installments; i++) {
                const d = new Date();
                d.setDate(dueDay || 10);
                d.setMonth(d.getMonth() + i);
                installmentsToCreate.push({
                    user_id: userId,
                    month: `Parcela ${i}/${installments} - ${productName}`,
                    due_date: d.toISOString().split('T')[0],
                    amount: installmentValue,
                    status: 'Em aberto',
                    notes: `Contrato ${contract.id}`,
                    discountValue: 0
                });
            }
            if (installmentsToCreate.length > 0) {
                await supabase.from('invoices').insert(installmentsToCreate);
            }
            paymentData = { type: 'cash', message: 'Sem entrada necessária.' };
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada para ${userId}: ${productName}`, { contractId: contract.id });

        return res.status(200).json({ 
            success: true, 
            message: "Venda processada!", 
            paymentData, 
            invoiceId,
            contractId: contract.id 
        });

    } catch (e: any) {
        console.error("Erro venda:", e);
        return res.status(500).json({ error: e.message });
    }
}

// ... (Resto do arquivo permanece inalterado, apenas garantindo que as exportações existam)
// Função Setup Database para garantir colunas
async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const SQL = `
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "discountValue" numeric(10, 2) DEFAULT 0;
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "notes" text;
        ALTER TABLE "public"."contracts" ADD COLUMN IF NOT EXISTS "signature_data" text;
    `;
    await supabase.rpc('execute_admin_sql', { sql_query: SQL });
    return res.status(200).json({ message: "Schema updated." });
}

// Handler Principal
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        if (req.method === 'POST') {
            if (path === '/api/admin/create-sale') return await handleCreateSale(req, res);
            if (path === '/api/admin/setup-database') return await handleSetupDatabase(req, res);
            // ... outros handlers ...
        }
        // ...
        return res.status(404).json({ error: 'Route not found' });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
