
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, MerchantOrder } from 'mercadopago';
import { URL } from 'url';
import { Buffer } from 'buffer';

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
        return null; 
    }
    return new GoogleGenAI({ apiKey });
}

function getMercadoPagoClient() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('Mercado Pago Access Token is not set.');
    }
    return new MercadoPagoConfig({ accessToken });
}

async function logAction(supabase: SupabaseClient, action_type: string, status: 'SUCCESS' | 'FAILURE', description: string, details?: object) {
    try {
        const { error } = await supabase.from('action_logs').insert({ action_type, status, description, details });
        if (error) console.error(`Failed to log action: ${action_type}`, error);
    } catch (e) { console.error("Log error", e); }
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

async function runCreditAnalysis(supabase: SupabaseClient, genAI: GoogleGenAI | null, userId: string) {
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

    const prompt = `Analise o crédito de um cliente com os seguintes dados: - Histórico de Faturas: ${JSON.stringify(invoices)}. Com base nisso, forneça um score de crédito (0-1000), um limite de crédito (em BRL, ex: 1500.00), e um status de crédito ('Excelente', 'Bom', 'Regular', 'Negativado'). O limite de crédito deve ser por PARCELA, ou seja, o valor máximo que cada parcela de uma compra pode ter. Retorne a resposta APENAS como um objeto JSON válido assim: {"credit_score": 850, "credit_limit": 500.00, "credit_status": "Excelente"}. Não adicione nenhum outro texto.`;

    const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
    
    const text = response.text;
    if (!text) {
        throw new Error("A resposta da IA para análise de crédito estava vazia.");
    }
    const analysis = JSON.parse(text.trim());

    const { data: updatedProfile, error: updateError } = await supabase.from('profiles').update({ credit_score: analysis.credit_score, credit_limit: analysis.credit_limit, credit_status: analysis.credit_status }).eq('id', userId).select().single();
    if (updateError) throw updateError;
    
    if (profile.credit_score !== analysis.credit_score) {
        const change = analysis.credit_score - (profile.credit_score || 0);
        await supabase.from('score_history').insert({
            user_id: userId,
            change: change,
            new_score: analysis.credit_score,
            reason: change > 0 ? 'Análise automática: Perfil positivo' : 'Análise automática: Ajuste de crédito'
        });
    }

    await logAction(supabase, 'CREDIT_ANALYSIS', 'SUCCESS', `Análise de crédito para ${profile.email}. Status: ${analysis.credit_status}, Limite: ${analysis.credit_limit}`);
    return updatedProfile;
}

// --- Handlers ---

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, totalAmount, installments, productName, signature, saleType, paymentMethod, downPayment, tradeInValue, sellerName, selectedDay } = req.body;
        
        if (!userId || !totalAmount || !installments || !productName) {
            return res.status(400).json({ error: 'Missing required sale data.' });
        }

        const installmentAmount = Math.round((totalAmount / installments) * 100) / 100;
        const newInvoices = [];
        const today = new Date();
        const purchaseTimestamp = new Date().toISOString();

        const initialStatus = saleType === 'crediario' ? 'Aguardando Assinatura' : 'Em aberto';

        // Lógica de Datas
        let baseDate = new Date(today);
        
        if (saleType === 'crediario' && selectedDay) {
            // Configurar para o dia escolhido. 
            // Se o dia escolhido já passou no mês atual ou é muito próximo (ex: hoje dia 2, escolheu dia 5), joga pro próximo.
            // Regra simples: Primeira parcela sempre daqui a ~30 dias
            baseDate.setDate(baseDate.getDate() + 20); // Avança 20 dias para garantir o mês correto
            
            // Ajusta para o dia escolhido no mês calculado
            if (baseDate.getDate() > selectedDay) {
                 baseDate.setMonth(baseDate.getMonth() + 1);
            }
            baseDate.setDate(selectedDay);
        } else {
            // Venda direta ou cartão: 30 dias padrão
            baseDate.setDate(baseDate.getDate() + 30);
        }

        for (let i = 0; i < installments; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(baseDate.getMonth() + i);
            
            const monthLabel = installments === 1 ? productName : `${productName} (${i+1}/${installments})`;
            
            let notes = saleType === 'direct' 
                ? `Compra direta via ${paymentMethod}.` 
                : `Referente a compra de ${productName} parcelada em ${installments}x.`;

            if (downPayment && Number(downPayment) > 0) {
                notes += ` (Entrada: R$ ${Number(downPayment).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
            }
            
            if (tradeInValue && Number(tradeInValue) > 0) {
                notes += ` (Trade-In: R$ ${Number(tradeInValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
            }
            
            if (sellerName) {
                notes += ` [Vendedor: ${sellerName}]`;
            }

            newInvoices.push({
                user_id: userId,
                month: monthLabel,
                due_date: dueDate.toISOString().split('T')[0],
                amount: installmentAmount,
                status: initialStatus,
                notes: notes,
                created_at: purchaseTimestamp,
                payment_method: paymentMethod || null
            });
        }

        const { error } = await supabase.from('invoices').insert(newInvoices);
        if (error) throw error;

        if (saleType === 'crediario') {
            const { error: contractError } = await supabase.from('contracts').insert({
                user_id: userId,
                title: 'Contrato de Crediário (CDCI) - Relp Cell',
                items: productName,
                total_value: totalAmount,
                installments: installments,
                status: 'pending_signature',
                signature_data: signature, // Pode vir preenchido se o admin coletou na hora
                terms_accepted: true,
                created_at: purchaseTimestamp
            });
            if (contractError) console.error("Erro ao salvar contrato:", contractError);
            
            await supabase.from('notifications').insert({
                user_id: userId,
                title: 'Nova Compra',
                message: `Sua compra de ${productName} foi registrada. Verifique seus contratos.`,
                type: 'success',
                read: false
            });
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada para o usuário ${userId}. Tipo: ${saleType || 'Crediário'}. Total: ${totalAmount}. Dia Venc: ${selectedDay || 'Padrão'}`);
        
        res.status(201).json({ message: 'Venda registrada com sucesso.', status: initialStatus });

    } catch (error: any) {
        await logAction(supabase, 'SALE_CREATED', 'FAILURE', 'Falha ao criar venda.', { error: error.message, body: req.body });
        res.status(500).json({ error: error.message });
    }
}

async function handleSignContract(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { contractId, signature, userId } = req.body;
        if (!contractId || !signature || !userId) {
            return res.status(400).json({ error: 'Dados incompletos para assinatura.' });
        }

        const { data: contract, error: findError } = await supabase
            .from('contracts')
            .select('*')
            .eq('id', contractId)
            .eq('user_id', userId)
            .single();

        if (findError || !contract) {
            return res.status(404).json({ error: 'Contrato não encontrado.' });
        }

        const { error: updateContractError } = await supabase
            .from('contracts')
            .update({ 
                status: 'Ativo', 
                signature_data: signature, 
                terms_accepted: true,
                updated_at: new Date().toISOString() 
            })
            .eq('id', contractId);

        if (updateContractError) throw updateContractError;

        const contractTime = new Date(contract.created_at).getTime();
        const startTime = new Date(contractTime - 10000).toISOString(); 
        const endTime = new Date(contractTime + 10000).toISOString();

        const { error: updateInvoicesError } = await supabase
            .from('invoices')
            .update({ status: 'Em aberto' })
            .eq('user_id', userId)
            .eq('status', 'Aguardando Assinatura')
            .gte('created_at', startTime)
            .lte('created_at', endTime);

        if (updateInvoicesError) throw updateInvoicesError;

        await logAction(supabase, 'CONTRACT_SIGNED', 'SUCCESS', `Contrato ${contractId} assinado pelo usuário ${userId}.`);
        res.status(200).json({ message: 'Contrato assinado e compra liberada com sucesso!' });

    } catch (error: any) {
        await logAction(supabase, 'CONTRACT_SIGNED', 'FAILURE', `Falha na assinatura do contrato.`, { error: error.message });
        res.status(500).json({ error: error.message });
    }
}

// --- Date Change Requests Handling ---

async function handleDueDateRequests(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    if (req.method === 'GET') {
        // List pending requests
        const { data, error } = await supabase
            .from('due_date_requests')
            .select('*, profiles(first_name, last_name, email)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
            
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    } 
    
    if (req.method === 'PUT') {
        // Approve/Reject
        const { requestId, action, adminNotes } = req.body;
        
        if (!requestId || !action) return res.status(400).json({ error: 'Missing fields' });
        
        try {
            // 1. Get Request Details
            const { data: request } = await supabase.from('due_date_requests').select('*').eq('id', requestId).single();
            if (!request) return res.status(404).json({ error: 'Request not found' });

            // 2. Update Request Status
            const status = action === 'approve' ? 'approved' : 'rejected';
            await supabase.from('due_date_requests').update({ status, admin_notes: adminNotes, updated_at: new Date().toISOString() }).eq('id', requestId);

            if (action === 'approve') {
                // 3. Logic to update future invoice dates
                const newDay = request.requested_day;
                
                // Get open invoices
                const { data: invoices } = await supabase
                    .from('invoices')
                    .select('id, due_date')
                    .eq('user_id', request.user_id)
                    .eq('status', 'Em aberto');

                if (invoices && invoices.length > 0) {
                    for (const inv of invoices) {
                        const currentDueDate = new Date(inv.due_date);
                        // Se a data atual for maior que hoje (fatura futura), altera
                        if (currentDueDate > new Date()) {
                            // Mantém o mês e ano, altera o dia.
                            // Cuidado com meses que não tem dia 31 etc. (Mas aqui é 5, 15, 25 então ok)
                            const newDate = new Date(currentDueDate.getFullYear(), currentDueDate.getMonth(), newDay);
                            
                            // Se a nova data for anterior à data original no mesmo mês e já tiver passado ou for muito perto, 
                            // talvez pular pro próximo?
                            // Simplificação: Apenas muda o dia do mês correspondente.
                            
                            await supabase.from('invoices').update({ due_date: newDate.toISOString().split('T')[0] }).eq('id', inv.id);
                        }
                    }
                }
                
                await supabase.from('notifications').insert({
                    user_id: request.user_id,
                    title: 'Vencimento Alterado',
                    message: `Sua solicitação foi aprovada. Suas próximas faturas vencerão no dia ${newDay}.`,
                    type: 'success'
                });
            } else {
                 await supabase.from('notifications').insert({
                    user_id: request.user_id,
                    title: 'Solicitação Negada',
                    message: `A alteração de vencimento foi negada. Motivo: ${adminNotes || 'Política interna'}.`,
                    type: 'alert'
                });
            }

            await logAction(supabase, 'DATE_CHANGE_PROCESSED', 'SUCCESS', `Solicitação ${requestId} processada: ${status}`);
            return res.status(200).json({ success: true });

        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }
}

async function handleProducts(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if(req.method==='GET'){ const {data,error}=await supabase.from('products').select('*').order('created_at',{ascending:false}); if(error) throw error; res.status(200).json(data || []); } else if(req.method==='POST'){ const {name,description,price,stock,image_url,image_base64,brand,category,barcode}=req.body; const {data,error}=await supabase.from('products').insert([{name,description,price,stock,image_url:image_base64||image_url,brand,category,barcode}]).select(); if(error) throw error; res.status(201).json(data[0]); } else if(req.method==='PUT'){ const {id,name,description,price,stock,image_url,image_base64,brand,category,barcode}=req.body; const {data,error}=await supabase.from('products').update({name,description,price,stock,image_url:image_base64||image_url,brand,category,barcode}).eq('id',id).select(); if(error) throw error; res.status(200).json(data[0]); } else { res.status(405).json({error:'Method not allowed'}); } } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleCreateAndAnalyzeCustomer(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const genAI = getGeminiClient(); try { const { email, password, ...meta } = req.body; const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta }); if (error) throw error; const profile = await runCreditAnalysis(supabase, genAI, data.user.id); res.status(200).json({ message: 'Success', profile }); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleGenerateMercadoPagoToken(req: VercelRequest, res: VercelResponse) { const { code, redirectUri, codeVerifier } = req.body; try { const response = await fetch('https://api.mercadopago.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.ML_CLIENT_ID, client_secret: process.env.ML_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier }) }); const data = await response.json(); if(!response.ok) throw new Error(data.message || 'Failed to generate token'); res.status(200).json({ accessToken: data.access_token, refreshToken: data.refresh_token }); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleSendNotification(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { const { userId, title, message, type } = req.body; if (!userId || !title || !message) return res.status(400).json({ error: 'Missing required fields' }); await supabase.from('notifications').insert({ user_id: userId, title, message, type: type || 'info' }); res.status(200).json({ message: 'Notificação enviada.' }); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleGenerateProductDetails(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if (!genAI) return res.status(500).json({ error: 'Gemini API key not configured.' }); const { prompt } = req.body; const instruction = `Extract product details from: "${prompt}". Return JSON: {name, description, price, stock, brand, category}.`; try { const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash', contents: instruction, config: { responseMimeType: 'application/json' } }); res.status(200).json(JSON.parse(response.text || '{}')); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleEditImage(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(!genAI) return res.status(500).json({error:'API Key missing'}); const {prompt, imageBase64} = req.body; const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/); if(!match) return res.status(400).json({error:'Invalid image'}); try { const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash-image', contents: { parts: [{inlineData:{mimeType:match[1], data:match[2]}}, {text:prompt}] } }); const part = response.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData); if(part && part.inlineData) res.status(200).json({image:`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}); else throw new Error("No image"); } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleGenerateBanner(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(!genAI) return res.status(500).json({error:'API Key missing'}); const {prompt, imageBase64} = req.body; const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/); if(!match) return res.status(400).json({error:'Invalid image'}); try { const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash-image', contents: { parts: [{inlineData:{mimeType:match[1], data:match[2]}}, {text:prompt}] } }); const part = response.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData); if(part && part.inlineData) res.status(200).json({image:`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, suggestedLink: ''}); else throw new Error("No image"); } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleGetLogs(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const { data, error } = await supabase.from('action_logs').select('*').order('created_at', { ascending: false }).limit(50); if (error) return res.status(500).json({ error: error.message }); res.status(200).json(data); }
async function handleGetProfiles(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const { data, error } = await supabase.from('profiles').select('*'); if (error) return res.status(500).json({ error: error.message }); res.status(200).json(data); }
async function handleGetInvoices(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const { data, error } = await supabase.from('invoices').select('*'); if (error) return res.status(500).json({ error: error.message }); res.status(200).json(data); }
async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    // This endpoint is called by the frontend to trigger updates. The actual logic is executed via SQL editor but we can return success.
    res.status(200).json({ message: "Database setup instructions available in Developer Tab." });
}
async function handleSupportTickets(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); if (req.method === 'GET') { const { data } = await supabase.from('support_tickets').select('*, profiles(first_name, last_name, email, credit_score, credit_limit, credit_status)').order('updated_at', { ascending: false }); res.status(200).json(data); } else if (req.method === 'PUT') { const { id, status } = req.body; await supabase.from('support_tickets').update({ status }).eq('id', id); res.status(200).json({ success: true }); } }
async function handleSupportMessages(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); if (req.method === 'GET') { const { ticketId } = req.query; const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }); res.status(200).json(data); } else if (req.method === 'POST') { const { ticketId, sender, message, isInternal } = req.body; await supabase.from('support_messages').insert({ ticket_id: ticketId, sender_type: sender, message, is_internal: isInternal || false }); await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId); res.status(200).json({ success: true }); } }
async function handleChat(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if (!genAI) return res.status(500).json({ error: 'Gemini not configured' }); const { message, context } = req.body; try { const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); const chat = model.startChat({ history: [{ role: 'user', parts: [{ text: context || 'You are a helpful assistant.' }] }] }); const result = await chat.sendMessage(message); res.status(200).json({ reply: result.response.text() }); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleSettings(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); if (req.method === 'GET') { const { data } = await supabase.from('app_settings').select('*'); const settings = data?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}); res.status(200).json(settings || {}); } else if (req.method === 'POST') { const { key, value } = req.body; await supabase.from('app_settings').upsert({ key, value }, { onConflict: 'key' }); res.status(200).json({ success: true }); } }
async function handleBanners(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); if (req.method === 'GET') { const { data } = await supabase.from('store_banners').select('*').order('created_at', { ascending: false }); res.status(200).json(data || []); } else if (req.method === 'POST') { const { image_base64, prompt, link } = req.body; 
    const buffer = Buffer.from(image_base64.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    const fileName = `banner_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage.from('banners').upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) { 
        console.error("Storage upload failed, saving base64 to DB (fallback)");
        await supabase.from('store_banners').insert({ image_url: image_base64, prompt, link, active: true }); 
    } else {
        const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(fileName);
        await supabase.from('store_banners').insert({ image_url: publicUrl, prompt, link, active: true });
    }
    res.status(200).json({ success: true }); } else if (req.method === 'DELETE') { const { id } = req.body; await supabase.from('store_banners').delete().eq('id', id); res.status(200).json({ success: true }); } }

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname.replace('/api/admin', '');

    res.setHeader('Access-Control-Allow-Credentials', "true");
    res.setHeader('Access-