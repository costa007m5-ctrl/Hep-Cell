
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

// Modificado para suportar teste com token do banco ou env
async function getMercadoPagoClient(supabase: SupabaseClient) {
    // Tenta pegar do banco primeiro
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'mp_access_token').single();
    const accessToken = data?.value || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    
    if (!accessToken) {
        throw new Error('O Access Token do Mercado Pago não está configurado.');
    }
    return new MercadoPagoConfig({ accessToken });
}

async function logAction(supabase: SupabaseClient, action_type: string, status: 'SUCCESS' | 'FAILURE', description: string, details?: object) {
    try {
        await supabase.from('action_logs').insert({ action_type, status, description, details });
    } catch (e) {
        console.error('Log error', e);
    }
}

// --- Mercado Pago OAuth Handlers ---

async function handleGetMpAuthUrl(req: VercelRequest, res: VercelResponse) {
    const { code_challenge } = req.body;
    const clientId = process.env.ML_CLIENT_ID; // Usando ML_CLIENT_ID como App ID do MP
    
    if (!clientId) return res.status(500).json({ error: 'ML_CLIENT_ID (App ID) não configurado na Vercel.' });

    const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/admin`; // Redireciona para admin para capturar o code
    // Nota: Na prática o frontend manda a redirectUri correta baseada na window.location
    
    // URL oficial de Auth do Mercado Pago
    // state e code_challenge são para segurança (PKCE)
    const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${code_challenge}&redirect_uri=${encodeURIComponent(req.body.redirectUri || redirectUri)}`;
    
    return res.json({ authUrl });
}

async function handleGenerateMpToken(req: VercelRequest, res: VercelResponse) {
    const { code, redirectUri, codeVerifier } = req.body;
    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;

    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Credenciais do App (Client ID/Secret) não configuradas.' });

    try {
        const response = await fetch('https://api.mercadopago.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code_verifier: codeVerifier // Para PKCE
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Erro MP OAuth:', data);
            throw new Error(data.message || 'Falha na autenticação com Mercado Pago');
        }

        // Salva Automaticamente no Supabase
        const supabase = getSupabaseAdminClient();
        
        await supabase.from('system_settings').upsert([
            { key: 'mp_access_token', value: data.access_token },
            { key: 'mp_public_key', value: data.public_key },
            { key: 'mp_refresh_token', value: data.refresh_token },
            { key: 'mp_user_id', value: String(data.user_id) },
            { key: 'mp_expires_in', value: String(data.expires_in) }
        ], { onConflict: 'key' });

        await logAction(supabase, 'MP_INTEGRATION', 'SUCCESS', 'Integração Mercado Pago realizada com sucesso via OAuth.');

        return res.json({ success: true, message: 'Conectado com sucesso! Tokens salvos.' });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleDisconnectMercadoPago(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const keysToRemove = ['mp_access_token', 'mp_public_key', 'mp_refresh_token', 'mp_user_id', 'mp_expires_in'];
        
        const { error } = await supabase
            .from('system_settings')
            .delete()
            .in('key', keysToRemove);

        if (error) throw error;

        await logAction(supabase, 'MP_DISCONNECT', 'SUCCESS', 'Integração Mercado Pago removida pelo admin.');
        
        return res.json({ success: true, message: 'Conta desconectada com sucesso.' });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// --- Status Test Handlers ---
async function handleTestSupabase(_req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.from('system_settings').select('key').limit(1);
        if (error) throw error;
        return res.status(200).json({ message: "Conexão com Supabase estabelecida com sucesso!" });
    } catch (e: any) {
        return res.status(500).json({ error: `Falha Supabase: ${e.message}` });
    }
}

async function handleTestGemini(_req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Ping',
        });
        if (!response.text) throw new Error("Sem resposta.");
        return res.status(200).json({ message: "Gemini OK!" });
    } catch (e: any) {
        return res.status(500).json({ error: `Falha Gemini: ${e.message}` });
    }
}

async function handleTestMercadoPago(_req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const client = await getMercadoPagoClient(supabase);
        const payment = new Payment(client);
        // Tenta buscar pagamentos recentes para validar o token
        await payment.search({ options: { limit: 1 } });
        return res.status(200).json({ message: "Mercado Pago OK!" });
    } catch (e: any) {
        return res.status(500).json({ error: `Falha MP: ${e.message}` });
    }
}

async function handleTestMercadoLivre(_req: VercelRequest, res: VercelResponse) {
    try {
        if (!process.env.ML_CLIENT_ID) throw new Error("ML_CLIENT_ID missing");
        return res.status(200).json({ message: "Credenciais ML presentes." });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// --- Core Logic ---

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { 
            userId, totalAmount, installments, productName, saleType, 
            paymentMethod, downPayment, coinsUsed, dueDay, 
            sellerName, couponCode, signature, contractItems 
        } = req.body;

        if (!userId || !totalAmount) return res.status(400).json({ error: "Dados incompletos." });

        let finalTotalAmount = Number(totalAmount);
        let discountApplied = 0;
        
        if (couponCode) {
            const code = couponCode.toUpperCase();
            if (code === 'RELP10') discountApplied = finalTotalAmount * 0.10;
            else if (code === 'BOASVINDAS') discountApplied = 20;
            else if (code === 'PROMO5') discountApplied = finalTotalAmount * 0.05;
            else if (code === 'DESC50') discountApplied = 50;
            
            finalTotalAmount = Math.max(0, finalTotalAmount - discountApplied);
        }

        // Coins
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (profile && profile.coins_balance >= coinsUsed) {
                await supabase.from('profiles').update({ coins_balance: profile.coins_balance - coinsUsed }).eq('id', userId);
            }
        }

        // Contrato
        const { data: contract, error: contractError } = await supabase.from('contracts').insert({
            user_id: userId,
            title: `Compra: ${productName}`,
            items: contractItems || `${productName} (Vendedor: ${sellerName || 'Sistema'})`,
            total_value: finalTotalAmount,
            installments: installments,
            status: saleType === 'crediario' ? 'Assinado' : 'Ativo',
            signature_data: signature,
            terms_accepted: true
        }).select().single();

        if (contractError) throw contractError;

        // Fatura
        const isCrediario = saleType === 'crediario';
        const invoiceAmount = isCrediario ? Number(downPayment) : finalTotalAmount;
        const today = new Date();
        
        let paymentData: any = null;
        let invoiceId = null;

        // Gera Fatura de Entrada / Venda à Vista
        if (invoiceAmount > 0) {
            let notes = `Compra Direta Contrato ${contract.id}`;
            if (isCrediario) {
                const remaining = finalTotalAmount - invoiceAmount;
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

            // Integração MP
            if (['pix', 'boleto', 'redirect'].includes(paymentMethod)) {
                // Obtém cliente MP (Dinamico)
                const mpClient = await getMercadoPagoClient(supabase);
                
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
                            await supabase.from('invoices').update({ payment_code: paymentData.qrCode, payment_id: String(result.id) }).eq('id', invoiceId);
                        }
                    } else if (paymentMethod === 'boleto') {
                         const result = await payment.create({
                            body: {
                                transaction_amount: Number(invoiceAmount.toFixed(2)),
                                description: notes,
                                payment_method_id: 'bolbradesco',
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
                             const barcode = (result as any).barcode?.content;
                             paymentData = {
                                type: 'boleto',
                                barcode: barcode,
                                url: result.transaction_details?.external_resource_url,
                                paymentId: result.id
                             };
                             await supabase.from('invoices').update({ boleto_barcode: paymentData.barcode, boleto_url: paymentData.url, payment_id: String(result.id), status: 'Boleto Gerado' }).eq('id', invoiceId);
                        }
                    } else if (paymentMethod === 'redirect') {
                        const preference = new Preference(mpClient);
                        const result = await preference.create({
                            body: {
                                items: [{ id: invoiceId, title: `Pedido Relp Cell - ${productName}`, quantity: 1, unit_price: Number(invoiceAmount.toFixed(2)), currency_id: 'BRL' }],
                                payer: { email: email },
                                external_reference: invoiceId,
                                back_urls: { success: 'https://relpcell.com', failure: 'https://relpcell.com', pending: 'https://relpcell.com' },
                                auto_return: 'approved'
                            }
                        });
                        paymentData = { type: 'redirect', url: result.init_point };
                    }
                } catch (mpError: any) {
                    console.error("Erro MP:", mpError);
                    paymentData = { type: 'error', message: 'Venda registrada, mas falha ao gerar Pix/Boleto.' };
                }
            } else if (paymentMethod === 'cash') {
                await supabase.from('invoices').update({ status: 'Paga', payment_date: new Date().toISOString() }).eq('id', invoiceId);
                
                if (isCrediario) {
                    const remaining = finalTotalAmount - invoiceAmount;
                    const installmentVal = remaining / installments;
                    const invs = [];
                    for(let i=1; i<=installments; i++) {
                        const d = new Date();
                        d.setMonth(d.getMonth() + i);
                        d.setDate(Math.min(dueDay || 10, 28)); 
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
        } 
        // Crediário sem entrada (raro, mas possível se entrada for 0)
        else if (isCrediario) {
             const installmentVal = finalTotalAmount / installments;
             const invs = [];
             for(let i=1; i<=installments; i++) {
                const d = new Date();
                d.setMonth(d.getMonth() + i);
                d.setDate(Math.min(dueDay || 10, 28));
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
             paymentData = { type: 'cash', message: 'Sem entrada.' };
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda: ${productName}`, { contractId: contract.id });
        return res.status(200).json({ success: true, paymentData, contractId: contract.id });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleNegotiateDebt(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, invoiceIds, totalAmount, installments, firstDueDate, notes } = req.body;

        // 1. Busca taxa de juros de negociação
        const { data: setting } = await supabase.from('system_settings').select('value').eq('key', 'negotiation_interest').single();
        const interestRate = parseFloat(setting?.value || '0'); // %

        // 2. Aplica Juros
        const totalWithInterest = totalAmount * (1 + (interestRate / 100));
        const installmentValue = totalWithInterest / installments;

        // 3. Cria Contrato de Renegociação
        const { data: contract, error: contractError } = await supabase.from('contracts').insert({
            user_id: userId,
            title: 'Renegociação de Dívida',
            items: `Acordo de renegociação referente às faturas: ${invoiceIds.join(', ')}. Juros aplicados: ${interestRate}%. Observações: ${notes}`,
            total_value: totalWithInterest,
            installments: installments,
            status: 'pending_signature', // Cliente precisa assinar
            created_at: new Date().toISOString()
        }).select().single();

        if (contractError) throw contractError;

        // 4. Cria Novas Faturas
        const newInvoices = [];
        const firstDate = new Date(firstDueDate);

        for (let i = 0; i < installments; i++) {
            const dueDate = new Date(firstDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            
            newInvoices.push({
                user_id: userId,
                month: `Renegociação ${i + 1}/${installments}`,
                due_date: dueDate.toISOString().split('T')[0],
                amount: installmentValue,
                status: 'Aguardando Assinatura', // Só ativa após assinar
                notes: `Contrato ${contract.id}`
            });
        }
        await supabase.from('invoices').insert(newInvoices);

        // 5. Cancela Faturas Antigas
        await supabase.from('invoices').update({ status: 'Cancelado', notes: `Renegociado no Contrato ${contract.id}` }).in('id', invoiceIds);

        await logAction(supabase, 'DEBT_NEGOTIATION', 'SUCCESS', `Renegociação criada para user ${userId}. Total: ${totalWithInterest}`, { contractId: contract.id });

        return res.status(200).json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// --- NOVA FUNÇÃO: Gerenciamento Manual de Fatura ---
async function handleManageInvoice(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { invoiceId, action } = req.body; // action: 'pay' | 'cancel' | 'delete'

        if (action === 'delete') {
            await supabase.from('invoices').delete().eq('id', invoiceId);
            await logAction(supabase, 'INVOICE_MANAGE', 'SUCCESS', `Fatura ${invoiceId} excluída manualmente.`);
        } else if (action === 'pay') {
            await supabase.from('invoices').update({ 
                status: 'Paga', 
                payment_date: new Date().toISOString(),
                notes: 'Baixa manual pelo admin' 
            }).eq('id', invoiceId);
            await logAction(supabase, 'INVOICE_MANAGE', 'SUCCESS', `Fatura ${invoiceId} marcada como Paga.`);
        } else if (action === 'cancel') {
            await supabase.from('invoices').update({ 
                status: 'Cancelado', 
                notes: 'Cancelamento manual pelo admin' 
            }).eq('id', invoiceId);
            await logAction(supabase, 'INVOICE_MANAGE', 'SUCCESS', `Fatura ${invoiceId} cancelada.`);
        }

        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleManageLimitRequest(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { requestId, action, manualLimit, manualScore, responseReason } = req.body;
        if (action === 'reject') {
            await supabase.from('limit_requests').update({ status: 'rejected', admin_response_reason: responseReason }).eq('id', requestId);
        } else if (action === 'approve_manual') {
            const { data: reqData } = await supabase.from('limit_requests').select('user_id').eq('id', requestId).single();
            if (reqData) {
                await supabase.from('profiles').update({ credit_limit: manualLimit, credit_score: manualScore }).eq('id', reqData.user_id);
                await supabase.from('limit_requests').update({ status: 'approved', admin_response_reason: responseReason }).eq('id', requestId);
            }
        }
        return res.json({ success: true });
    } catch(e:any) { return res.status(500).json({ error: e.message }); }
}

async function handleSettings(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'GET') {
        const { data } = await supabase.from('system_settings').select('*');
        const settings = data?.reduce((acc:any, curr:any) => { acc[curr.key] = curr.value; return acc; }, {}) || {};
        return res.json(settings);
    } else {
        const { key, value } = req.body;
        await supabase.from('system_settings').upsert({ key, value: String(value) });
        return res.json({ success: true });
    }
}

async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    // Garante que a coluna existe para negociações
    const SQL = `ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "discountValue" numeric(10, 2) DEFAULT 0;`;
    await supabase.rpc('execute_admin_sql', { sql_query: SQL });
    return res.json({ message: "Database checked." });
}

// ... Other Handlers (Coins, Polls, Icons, Products, Logs, etc - Mantidos simplificados para caber)
async function handleManageCoins(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { userId, amount, type } = req.body;
    const { data } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
    const newBal = type === 'credit' ? (data?.coins_balance||0) + amount : (data?.coins_balance||0) - amount;
    await supabase.from('profiles').update({ coins_balance: newBal }).eq('id', userId);
    return res.json({success:true});
}
async function handleGeneratePoll(req: VercelRequest, res: VercelResponse) {
    const genAI = getGeminiClient();
    const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Crie enquete sobre: ${req.body.topic}. JSON: {question: string, options: string[]}`,
        config: { responseMimeType: 'application/json' }
    });
    return res.json(JSON.parse(response.text || '{}'));
}
async function handleUploadPwaIcon(_req: VercelRequest, res: VercelResponse) { return res.json({ok:true}); }
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
    const { data } = await supabase.from('invoices').select('*').order('due_date', { ascending: true });
    return res.json(data);
}
async function handleGetLimitRequests(_req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from('limit_requests').select('*, profiles(*)');
    return res.json(data);
}
async function handleClientDocuments(req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    const { userId } = req.query;
    const { data: uploads } = await supabase.from('client_documents').select('*').eq('user_id', userId);
    const { data: contracts } = await supabase.from('contracts').select('*').eq('user_id', userId);
    return res.json({ uploads, contracts });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        if (req.method === 'POST') {
            if (path === '/api/admin/create-sale') return await handleCreateSale(req, res);
            if (path === '/api/admin/negotiate-debt') return await handleNegotiateDebt(req, res);
            if (path === '/api/admin/manage-invoice') return await handleManageInvoice(req, res);
            if (path === '/api/admin/setup-database') return await handleSetupDatabase(req, res);
            if (path === '/api/admin/manage-coins') return await handleManageCoins(req, res);
            if (path === '/api/admin/generate-poll') return await handleGeneratePoll(req, res);
            if (path === '/api/admin/manage-limit-request') return await handleManageLimitRequest(req, res);
            if (path === '/api/admin/settings') return await handleSettings(req, res);
            if (path === '/api/admin/upload-pwa-icon') return await handleUploadPwaIcon(req, res);
            
            // Test Routes
            if (path === '/api/admin/test-supabase') return await handleTestSupabase(req, res);
            if (path === '/api/admin/test-gemini') return await handleTestGemini(req, res);
            if (path === '/api/admin/test-mercadopago') return await handleTestMercadoPago(req, res);
            if (path === '/api/admin/test-mercadolivre') return await handleTestMercadoLivre(req, res);
            
            // MP Auth Routes (NOVOS)
            if (path === '/api/admin/get-mp-auth-url') return await handleGetMpAuthUrl(req, res);
            if (path === '/api/admin/generate-mercadopago-token') return await handleGenerateMpToken(req, res);
            if (path === '/api/admin/disconnect-mercadopago') return await handleDisconnectMercadoPago(req, res);
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

        return res.status(404).json({ error: 'Route not found' });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
