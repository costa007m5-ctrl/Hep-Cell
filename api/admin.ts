
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
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileError) throw profileError;
    const { data: invoices, error: invoicesError } = await supabase.from('invoices').select('status, amount, due_date').eq('user_id', userId);
    if (invoicesError) throw invoicesError;

    if (!genAI) {
        return {
            credit_score: 500,
            credit_limit: 200.00,
            credit_status: "Análise Manual Necessária (IA Indisponível)"
        };
    }

    const hasHistory = invoices && invoices.length > 0;
    let context = "";
    
    if (!hasHistory) {
        context = "CLIENTE NOVO (SEM HISTÓRICO). REGRA RÍGIDA: Se não houver 'salary' (renda) definida no perfil ou se for 0, o limite deve ser no MÁXIMO R$ 100,00. Se tiver renda, limite = 20% da renda.";
    } else {
        context = "CLIENTE RECORRENTE. Analise o histórico de pagamentos. Se pagar em dia, pode aumentar o limite progressivamente mesmo sem comprovante de renda recente. Valorize a fidelidade.";
    }

    const prompt = `
        ${context}
        
        Dados do Cliente:
        Renda Declarada: R$ ${profile.salary || 0}
        Faturas Totais: ${invoices?.length || 0}
        Score Atual: ${profile.credit_score}
        Limite Atual: ${profile.credit_limit}

        Ação: Calcule o novo Score (0-1000) e o novo Limite de Crédito (Margem de Parcela).
        Forneça também uma razão curta para o cliente.

        Retorne JSON: {"credit_score": 850, "credit_limit": 500.00, "credit_status": "Excelente", "reason": "Motivo..."}
    `;

    const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
    const text = response.text;
    if (!text) throw new Error("IA vazia.");
    const analysis = JSON.parse(text.trim());

    if (!strictMode) {
        await supabase.from('profiles').update({ credit_score: analysis.credit_score, credit_limit: analysis.credit_limit, credit_status: analysis.credit_status }).eq('id', userId);
    }

    return analysis;
}

// --- Handlers ---

// Implementação da Lógica de Venda (Create Sale)
async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { 
            userId, 
            totalAmount, 
            installments, 
            productName, 
            saleType, // 'crediario' | 'direct'
            paymentMethod, 
            downPayment, // Valor da entrada (dinheiro/pix/cartão)
            coinsUsed, // Quantidade de moedas usadas
            dueDay, // Dia de vencimento preferido
            sellerName,
            couponCode,
            signature
        } = req.body;

        if (!userId || !totalAmount) return res.status(400).json({ error: "Dados incompletos." });

        // 1. Processar Cupom (Simulado no Backend para segurança)
        let finalTotalAmount = totalAmount;
        let discountApplied = 0;
        if (couponCode) {
            const code = couponCode.toUpperCase();
            if (code === 'RELP10') discountApplied = totalAmount * 0.10;
            else if (code === 'BOASVINDAS') discountApplied = 20;
            else if (code === 'PROMO5') discountApplied = totalAmount * 0.05;
            else if (code.startsWith('DESC')) {
                 const val = parseInt(code.replace('DESC', ''));
                 if(!isNaN(val)) discountApplied = (totalAmount * val) / 100;
            }
            finalTotalAmount = Math.max(0, totalAmount - discountApplied);
        }

        // 2. Processar Coins
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (profile && profile.coins_balance >= coinsUsed) {
                // Desconta do saldo
                await supabase.from('profiles').update({ coins_balance: profile.coins_balance - coinsUsed }).eq('id', userId);
                // O valor monetário do coin já foi abatido no frontend antes de enviar 'downPayment' ou 'totalAmount',
                // mas aqui garantimos que os coins foram debitados.
            } else {
                // Se não tem saldo, ignora o desconto de coins (ou lança erro)
                console.warn("Saldo de coins insuficiente.");
            }
        }

        // 3. Criar Contrato
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

        // 4. Gerar Fatura Inicial
        // Se for Crediário: Gera Fatura de ENTRADA.
        // Se for Direta: Gera Fatura TOTAL.
        const isCrediario = saleType === 'crediario';
        const invoiceAmount = isCrediario ? downPayment : finalTotalAmount;
        const today = new Date();
        
        let paymentData: any = null;
        let invoiceId = null;

        // Só gera fatura se houver valor a pagar agora (entrada > 0 ou venda à vista)
        if (invoiceAmount > 0) {
            let notes = `Compra Direta ${contract.id}`;
            if (isCrediario) {
                const remaining = finalTotalAmount - downPayment;
                // Formato especial na nota para o Webhook identificar e gerar as parcelas depois
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

            // 5. Integração IMEDIATA com Mercado Pago
            if (['pix', 'boleto', 'redirect'].includes(paymentMethod)) {
                const mpClient = getMercadoPagoClient();
                const { data: user } = await supabase.auth.admin.getUserById(userId);
                const email = user?.user?.email || 'cliente@relpcell.com';
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

                const payer = {
                    email: email,
                    first_name: profile?.first_name || 'Cliente',
                    last_name: profile?.last_name || 'Relp',
                    identification: { type: 'CPF', number: profile?.identification_number?.replace(/\D/g, '') || '00000000000' }
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
                            paymentData = {
                                type: 'pix',
                                qrCode: result.point_of_interaction.transaction_data.qr_code,
                                qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64,
                                paymentId: result.id
                            };
                            // Salva o código na fatura para consulta posterior
                            await supabase.from('invoices').update({ 
                                payment_code: paymentData.qrCode, 
                                payment_id: String(result.id) 
                            }).eq('id', invoiceId);
                        }
                    } else if (paymentMethod === 'boleto') {
                         const result = await payment.create({
                            body: {
                                transaction_amount: Number(invoiceAmount.toFixed(2)),
                                description: notes,
                                payment_method_id: 'bolbradesco', // Ou outro meio disponível
                                payer: {
                                    ...payer,
                                    address: {
                                        zip_code: profile?.zip_code?.replace(/\D/g, '') || '68900000',
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
                             await supabase.from('invoices').update({ 
                                 boleto_barcode: paymentData.barcode, 
                                 boleto_url: paymentData.url,
                                 payment_id: String(result.id),
                                 status: 'Boleto Gerado'
                             }).eq('id', invoiceId);
                        }
                    } else if (paymentMethod === 'redirect') {
                        const preference = new Preference(mpClient);
                        const result = await preference.create({
                            body: {
                                items: [{
                                    id: invoiceId,
                                    title: `Pedido Relp Cell - ${productName}`,
                                    quantity: 1,
                                    unit_price: Number(invoiceAmount.toFixed(2)),
                                    currency_id: 'BRL'
                                }],
                                payer: { email: email },
                                external_reference: invoiceId,
                                back_urls: {
                                    success: 'https://relpcell.com',
                                    failure: 'https://relpcell.com',
                                    pending: 'https://relpcell.com'
                                },
                                auto_return: 'approved'
                            }
                        });
                        paymentData = { type: 'redirect', url: result.init_point };
                    }
                } catch (mpError: any) {
                    console.error("Erro Mercado Pago:", mpError);
                    paymentData = { type: 'error', message: 'Venda criada, mas erro ao gerar pagamento no Mercado Pago. Tente pagar pela aba Faturas.' };
                }
            } else if (paymentMethod === 'cash') {
                // Dinheiro: Marca como pago imediatamente
                await supabase.from('invoices').update({ status: 'Paga', payment_date: new Date().toISOString() }).eq('id', invoiceId);
                
                // Se for crediário, gera as parcelas imediatamente já que a entrada foi paga
                if (isCrediario) {
                    const remaining = finalTotalAmount - downPayment;
                    const installmentVal = remaining / installments;
                    const invs = [];
                    for(let i=1; i<=installments; i++) {
                        const d = new Date();
                        d.setMonth(d.getMonth() + i);
                        d.setDate(dueDay || 10);
                        
                        invs.push({
                            user_id: userId,
                            month: `Parcela ${i}/${installments} - ${productName}`,
                            due_date: d.toISOString().split('T')[0],
                            amount: installmentVal,
                            status: 'Em aberto',
                            notes: `Contrato ${contract.id}`
                        });
                    }
                    if(invs.length > 0) await supabase.from('invoices').insert(invs);
                }
                paymentData = { type: 'cash' };
            }
        } else if (isCrediario) {
             // Caso raro: Crediário sem entrada (Downpayment = 0)
             const installmentVal = finalTotalAmount / installments;
             const invs = [];
             for(let i=1; i<=installments; i++) {
                const d = new Date();
                d.setMonth(d.getMonth() + i);
                d.setDate(dueDay || 10);
                
                invs.push({
                    user_id: userId,
                    month: `Parcela ${i}/${installments} - ${productName}`,
                    due_date: d.toISOString().split('T')[0],
                    amount: installmentVal,
                    status: 'Em aberto',
                    notes: `Contrato ${contract.id}`
                });
             }
             if(invs.length > 0) await supabase.from('invoices').insert(invs);
             paymentData = { type: 'cash', message: 'Sem entrada necessária.' };
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada: ${productName} para ${userId}`, { contractId: contract.id });

        return res.status(200).json({ success: true, paymentData, contractId: contract.id });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// ... Resto do arquivo (outros handlers) ...
// Função para atualizar o banco de dados (Schema)
async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    // SQL para garantir colunas
    const SQL = `
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "discountValue" numeric(10, 2) DEFAULT 0;
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "notes" text;
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "payment_code" text;
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "boleto_barcode" text;
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "boleto_url" text;
        ALTER TABLE "public"."contracts" ADD COLUMN IF NOT EXISTS "signature_data" text;
    `;
    await supabase.rpc('execute_admin_sql', { sql_query: SQL });
    return res.status(200).json({ message: "Schema updated successfully." });
}

// ... Outros Handlers existentes ...
async function handleManageCoins(req: VercelRequest, res: VercelResponse) { /* ... */ }
async function handleGeneratePoll(req: VercelRequest, res: VercelResponse) { /* ... */ }
// ... (Mantenha os outros handlers existentes como handleTestSupabase, etc) ...

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        if (req.method === 'POST') {
            if (path === '/api/admin/create-sale') return await handleCreateSale(req, res);
            if (path === '/api/admin/setup-database') return await handleSetupDatabase(req, res);
            // ... Mantenha as rotas existentes ...
            if (path === '/api/admin/manage-coins') return await handleManageCoins(req, res);
            if (path === '/api/admin/generate-poll') return await handleGeneratePoll(req, res);
        }
        
        // ... Mantenha GET ...

        return res.status(404).json({ error: 'Route not found' });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
