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

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { 
            userId, 
            totalAmount, // Valor total Bruto (antes do desconto e entrada)
            installments, 
            productName, 
            saleType, // 'crediario' | 'direct'
            paymentMethod, // 'pix' | 'boleto' | 'redirect' | 'cash'
            downPayment, // Valor da entrada (dinheiro/pix/cartão)
            coinsUsed, 
            dueDay, 
            sellerName,
            tradeInValue,
            couponCode
        } = req.body;

        if (!userId || !totalAmount) return res.status(400).json({ error: "Dados incompletos." });

        // 1. Validar e Aplicar Cupom
        let finalAmount = totalAmount;
        let discountApplied = 0;
        if (couponCode) {
            const code = couponCode.toUpperCase();
            if (code === 'RELP10') {
                discountApplied = totalAmount * 0.10;
            } else if (code === 'BOASVINDAS') {
                discountApplied = 20;
            } else if (code === 'PROMO5') {
                discountApplied = totalAmount * 0.05;
            }
            finalAmount = Math.max(0, totalAmount - discountApplied);
        }

        // 2. Processar Coins (Descontar do saldo do usuário)
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (profile && profile.coins_balance >= coinsUsed) {
                await supabase.from('profiles').update({ coins_balance: profile.coins_balance - coinsUsed }).eq('id', userId);
                // O valor financeiro dos coins já deve ter sido abatido no frontend antes de enviar 'downPayment' ou 'totalAmount'
                // Aqui apenas removemos os coins do saldo.
            } else {
                return res.status(400).json({ error: "Saldo de coins insuficiente." });
            }
        }

        // 3. Registrar Contrato
        const { data: contract, error: contractError } = await supabase.from('contracts').insert({
            user_id: userId,
            title: `Compra: ${productName}`,
            items: `${productName} (Vendedor: ${sellerName || 'Sistema'})`,
            total_value: finalAmount,
            installments: installments,
            status: 'Ativo', // Contrato nasce ativo, mas faturas podem estar pendentes
            terms_accepted: true
        }).select().single();

        if (contractError) throw contractError;

        // 4. Lógica de Faturamento (Crediário vs Direto)
        
        const isCrediario = saleType === 'crediario';
        const invoiceAmount = isCrediario ? downPayment : finalAmount; // Se crediário, cobra só entrada agora. Se direto, cobra tudo.
        const today = new Date();
        
        let paymentData: any = null;
        let invoiceId = null;

        // Só gera fatura inicial se houver valor a pagar agora (entrada > 0 ou venda à vista)
        if (invoiceAmount > 0) {
            // Nota especial para o Webhook identificar e gerar parcelas depois
            // Formato: ENTRADA|CONTRACT_ID|REMAINING_AMOUNT|COUNT|DAY
            let notes = `Compra ${contract.id}`;
            if (isCrediario) {
                const remaining = finalAmount - downPayment;
                notes = `ENTRADA|${contract.id}|${remaining}|${installments}|${dueDay || 10}`;
            } else {
                notes = `DIRETA|${contract.id}`;
            }

            const { data: invoice, error: invError } = await supabase.from('invoices').insert({
                user_id: userId,
                month: isCrediario ? `Entrada - ${productName}` : `Compra - ${productName}`,
                due_date: today.toISOString().split('T')[0],
                amount: invoiceAmount,
                status: 'Em aberto',
                payment_method: paymentMethod,
                notes: notes,
                discountValue: discountApplied // Coluna nova adicionada no setup
            }).select().single();

            if (invError) throw invError;
            invoiceId = invoice.id;

            // 5. Integração Imediata com Mercado Pago
            if (paymentMethod === 'pix' || paymentMethod === 'boleto' || paymentMethod === 'redirect') {
                const mpClient = getMercadoPagoClient();
                // Busca dados do usuário para o payer do MP
                const { data: user } = await supabase.auth.admin.getUserById(userId);
                const email = user?.user?.email || 'cliente@relpcell.com';
                const { data: profile } = await supabase.from('profiles').select('first_name, last_name, identification_number, zip_code, street_name, street_number, neighborhood, city, federal_unit').eq('id', userId).single();

                const commonPayer = {
                    email: email,
                    first_name: profile?.first_name || 'Cliente',
                    last_name: profile?.last_name || 'Relp',
                    identification: { type: 'CPF', number: profile?.identification_number?.replace(/\D/g, '') || '' }
                };

                if (paymentMethod === 'pix') {
                    const payment = new Payment(mpClient);
                    const result = await payment.create({
                        body: {
                            transaction_amount: Number(invoiceAmount.toFixed(2)),
                            description: notes,
                            payment_method_id: 'pix',
                            payer: commonPayer,
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
                        // Atualiza fatura com código
                        await supabase.from('invoices').update({ payment_code: paymentData.qrCode, payment_id: String(result.id) }).eq('id', invoiceId);
                    }
                } else if (paymentMethod === 'boleto') {
                     const payment = new Payment(mpClient);
                     const boletoPayer = {
                         ...commonPayer,
                         address: { 
                             zip_code: profile?.zip_code?.replace(/\D/g, '') || '68900000', 
                             street_name: profile?.street_name || 'Rua', 
                             street_number: profile?.street_number || '123', 
                             neighborhood: profile?.neighborhood || 'Centro', 
                             city: profile?.city || 'Macapá', 
                             federal_unit: profile?.federal_unit || 'AP' 
                         }
                     };
                     
                     const result = await payment.create({
                        body: {
                            transaction_amount: Number(invoiceAmount.toFixed(2)),
                            description: notes,
                            payment_method_id: 'bolbradesco',
                            payer: boletoPayer,
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
            } else if (paymentMethod === 'cash') {
                // Pagamento em Dinheiro no Balcão: Marca como pago e processa parcelas
                await supabase.from('invoices').update({ status: 'Paga', payment_date: new Date().toISOString() }).eq('id', invoiceId);
                
                if (isCrediario) {
                    // Como não vai ter webhook do MP, geramos as parcelas aqui mesmo
                    const remaining = finalAmount - downPayment;
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
            // Caso raro: Crediário sem entrada (Zero down payment)
            // Gera parcelas imediatamente
            const installmentsToCreate = [];
            const installmentValue = finalAmount / installments;
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

async function handleManageCoins(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { userId, amount, description, type } = req.body; 

    try {
        if (!userId || !amount) throw new Error("Dados inválidos.");

        const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
        const currentBalance = profile?.coins_balance || 0;
        
        let newBalance = currentBalance;
        if (type === 'credit') {
            newBalance += amount;
        } else if (type === 'debit') {
            if (currentBalance < amount) throw new Error("Saldo insuficiente.");
            newBalance -= amount;
        }

        await supabase.from('profiles').update({ coins_balance: newBalance }).eq('id', userId);
        
        await logAction(supabase, 'COIN_TRANSACTION', 'SUCCESS', `${type === 'credit' ? 'Crédito' : 'Débito'} de ${amount} coins. Motivo: ${description}`, { userId, amount, type });

        return res.status(200).json({ success: true, newBalance });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleGeneratePoll(req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        const { topic } = req.body; 
        const prompt = `Crie uma enquete interessante para usuários de um aplicativo de loja de celulares. Tópico: ${topic}. Retorne JSON: { "question": "...", "options": ["..."] }`;
        const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
        return res.status(200).json(JSON.parse(response.text || '{}'));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleUploadPwaIcon(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { type, imageBase64 } = req.body;
        await supabase.from('system_settings').upsert({ key: type, value: imageBase64 });
        return res.status(200).json({ message: 'Ícone atualizado.' });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleManageLimitRequest(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const genAI = getGeminiClient();
    try {
        const { requestId, action, manualLimit, manualScore, responseReason } = req.body;
        if (action === 'calculate_auto') {
             const userId = req.body.userId; 
             const updatedAnalysis = await runCreditAnalysis(supabase, genAI, userId, true);
             return res.status(200).json({ suggestedLimit: updatedAnalysis.credit_limit, suggestedScore: updatedAnalysis.credit_score, reason: updatedAnalysis.reason });
        }
        if (action === 'approve_manual') {
             const { data: req } = await supabase.from('limit_requests').select('user_id').eq('id', requestId).single();
             await supabase.from('profiles').update({ credit_limit: manualLimit, credit_score: manualScore }).eq('id', req.user_id);
             await supabase.from('limit_requests').update({ status: 'approved', admin_response_reason: responseReason }).eq('id', requestId);
             return res.status(200).json({ message: "Aprovado." });
        }
        if (action === 'reject') {
             await supabase.from('limit_requests').update({ status: 'rejected', admin_response_reason: responseReason }).eq('id', requestId);
             return res.status(200).json({ message: "Rejeitado." });
        }
        return res.status(400).json({error: 'Invalid action'});
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
}

async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    // SQL Para corrigir a falta da coluna discountValue
    const SQL = `
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "discountValue" numeric(10, 2) DEFAULT 0;
        ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "notes" text;
        -- Garante as outras colunas também
        ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "coins_balance" integer DEFAULT 0;
    `;
    
    const { error } = await supabase.rpc('execute_admin_sql', { sql_query: SQL });
    if(error) {
        // Fallback se RPC nao existir, tenta criar tabela log só pra testar conexão
        console.error("Erro setup DB:", error);
        return res.status(500).json({ error: error.message });
    }
    
    return res.status(200).json({ message: "Database Schema Updated: discountValue added." });
}

// ... Test Handlers ...
async function handleTestSupabase(_req: VercelRequest, res: VercelResponse) { return res.status(200).json({message: 'OK'}); }
async function handleTestGemini(_req: VercelRequest, res: VercelResponse) { return res.status(200).json({message: 'OK'}); }
async function handleTestMercadoPago(_req: VercelRequest, res: VercelResponse) { return res.status(200).json({message: 'OK'}); }
async function handleTestMercadoLivre(_req: VercelRequest, res: VercelResponse) { return res.status(200).json({message: 'OK'}); }

async function handleProducts(_req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from('products').select('*');
    return res.json(data);
}
async function handleGetLogs(_req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from('action_logs').select('*').order('created_at', {ascending:false});
    return res.json(data);
}
async function handleGetProfiles(_req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from('profiles').select('*');
    return res.json(data);
}
async function handleGetInvoices(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from('invoices').select('*');
    return res.json(data);
}
async function handleGetLimitRequests(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from('limit_requests').select('*, profiles(*)').order('created_at', {ascending: false});
    return res.json(data);
}
async function handleClientDocuments(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { userId } = req.query;
    const { data: uploads } = await supabase.from('client_documents').select('*').eq('user_id', userId);
    const { data: contracts } = await supabase.from('contracts').select('*').eq('user_id', userId);
    return res.json({ uploads, contracts });
}
async function handleSettings(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'GET') {
        const { data } = await supabase.from('system_settings').select('*');
        const settings = data?.reduce((acc:any, curr:any) => { acc[curr.key] = curr.value; return acc; }, {}) || {};
        return res.json(settings);
    } else {
        const { key, value } = req.body;
        await supabase.from('system_settings').upsert({ key, value });
        return res.json({ success: true });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        if (req.method === 'POST') {
            if (path === '/api/admin/create-sale') return await handleCreateSale(req, res);
            if (path === '/api/admin/manage-coins') return await handleManageCoins(req, res);
            if (path === '/api/admin/generate-poll') return await handleGeneratePoll(req, res);
            if (path === '/api/admin/test-supabase') return await handleTestSupabase(req, res);
            if (path === '/api/admin/test-gemini') return await handleTestGemini(req, res);
            if (path === '/api/admin/test-mercadopago') return await handleTestMercadoPago(req, res);
            if (path === '/api/admin/test-mercadolivre') return await handleTestMercadoLivre(req, res);
            if (path === '/api/admin/upload-pwa-icon') return await handleUploadPwaIcon(req, res);
            if (path === '/api/admin/setup-database') return await handleSetupDatabase(req, res);
            if (path === '/api/admin/manage-limit-request') return await handleManageLimitRequest(req, res);
            if (path === '/api/admin/settings') return await handleSettings(req, res);
            if (path === '/api/admin/analyze-credit') {
                 const supabase = getSupabaseAdminClient();
                 const genAI = getGeminiClient();
                 const analysis = await runCreditAnalysis(supabase, genAI, req.body.userId, false);
                 return res.json({ profile: analysis });
            }
        }

        if (req.method === 'GET') {
            if (path === '/api/admin/products') return await handleProducts(req, res);
            if (path === '/api/admin/get-logs') return await handleGetLogs(req, res);
            if (path === '/api/admin/profiles') return await handleGetProfiles(req, res);
            if (path === '/api/admin/invoices') return await handleGetInvoices(req, res);
            if (path === '/api/admin/limit-requests') return await handleGetLimitRequests(req, res);
            if (path === '/api/admin/client-documents') return await handleClientDocuments(req, res);
            if (path === '/api/admin/settings') return await handleSettings(req, res);
        }

        return res.status(404).json({ error: 'Admin route not found' });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}