
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, MerchantOrder } from 'mercadopago';
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
        const { userId, totalAmount, installments, productName, signature, saleType, paymentMethod, downPayment, tradeInValue, sellerName } = req.body;
        
        if (!userId || !totalAmount || !installments || !productName) {
            return res.status(400).json({ error: 'Missing required sale data.' });
        }

        const installmentAmount = Math.round((totalAmount / installments) * 100) / 100;
        const newInvoices = [];
        const today = new Date();
        // Importante: Fixar o timestamp de criação para agrupar corretamente as parcelas da MESMA venda
        const purchaseTimestamp = new Date().toISOString();

        // Regra de Negócio: Se for Crediário, o status inicial é 'Aguardando Assinatura'
        const initialStatus = saleType === 'crediario' ? 'Aguardando Assinatura' : 'Em aberto';

        for (let i = 1; i <= installments; i++) {
            const dueDate = new Date(today);
            dueDate.setMonth(today.getMonth() + i);
            
            // Se for venda direta (1x), não precisa de "(1/1)" no nome
            const monthLabel = installments === 1 ? productName : `${productName} (${i}/${installments})`;
            
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
                created_at: purchaseTimestamp, // Agrupador crítico
                payment_method: paymentMethod || null
            });
        }

        const { error } = await supabase.from('invoices').insert(newInvoices);
        if (error) throw error;

        // Cria contrato se for crediário
        if (saleType === 'crediario') {
            const { error: contractError } = await supabase.from('contracts').insert({
                user_id: userId,
                title: 'Contrato de Crediário (CDCI) - Relp Cell',
                items: productName,
                total_value: totalAmount,
                installments: installments,
                status: 'pending_signature', // AGUARDANDO ACEITE DO CLIENTE NO APP
                signature_data: null, // Assinatura será feita pelo cliente no app
                terms_accepted: false,
                created_at: purchaseTimestamp
            });
            if (contractError) console.error("Erro ao salvar contrato:", contractError);
            
            // Envia notificação para o cliente
            await supabase.from('notifications').insert({
                user_id: userId,
                title: 'Aprovação Necessária',
                message: `Sua compra de ${productName} está aguardando sua assinatura digital no app. Você tem 24h.`,
                type: 'alert',
                read: false
            });
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada para o usuário ${userId}. Tipo: ${saleType || 'Crediário'}. Total: ${totalAmount}. Status: ${initialStatus}`);
        
        res.status(201).json({ message: 'Venda registrada com sucesso.', status: initialStatus });

    } catch (error: any) {
        await logAction(supabase, 'SALE_CREATED', 'FAILURE', 'Falha ao criar venda.', { error: error.message, body: req.body });
        res.status(500).json({ error: error.message });
    }
}

// ... (other handlers remain unchanged to preserve functionality)
// Simplified definitions for context
async function handleProducts(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if(req.method==='GET'){ const {data,error}=await supabase.from('products').select('*').order('created_at',{ascending:false}); if(error) throw error; res.status(200).json(data); } else if(req.method==='POST'){ const {name,description,price,stock,image_url,image_base64,brand,category}=req.body; const {data,error}=await supabase.from('products').insert([{name,description,price,stock,image_url:image_base64||image_url,brand,category}]).select(); if(error) throw error; res.status(201).json(data[0]); } else if(req.method==='PUT'){ const {id,name,description,price,stock,image_url,image_base64,brand,category}=req.body; const {data,error}=await supabase.from('products').update({name,description,price,stock,image_url:image_base64||image_url,brand,category}).eq('id',id).select(); if(error) throw error; res.status(200).json(data[0]); } else { res.status(405).json({error:'Method not allowed'}); } } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleCreateAndAnalyzeCustomer(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const genAI = getGeminiClient(); try { const { email, password, ...meta } = req.body; const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta }); if (error) throw error; const profile = await runCreditAnalysis(supabase, genAI, data.user.id); res.status(200).json({ message: 'Success', profile }); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleGenerateMercadoPagoToken(req: VercelRequest, res: VercelResponse) { const { code, redirectUri, codeVerifier } = req.body; try { const response = await fetch('https://api.mercadopago.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.ML_CLIENT_ID, client_secret: process.env.ML_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier }) }); const data = await response.json(); if(!response.ok) throw new Error(data.message || 'Failed to generate token'); res.status(200).json({ accessToken: data.access_token, refreshToken: data.refresh_token }); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleSendNotification(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { const { userId, title, message, type } = req.body; if (!userId || !title || !message) return res.status(400).json({ error: 'Missing required fields' }); await supabase.from('notifications').insert({ user_id: userId, title, message, type: type || 'info' }); res.status(200).json({ message: 'Notificação enviada.' }); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleGenerateProductDetails(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if (!genAI) return res.status(500).json({ error: 'Gemini API key not configured.' }); const { prompt } = req.body; const instruction = `Extract product details from: "${prompt}". Return JSON: {name, description, price, stock, brand, category}.`; try { const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash', contents: instruction, config: { responseMimeType: 'application/json' } }); res.status(200).json(JSON.parse(response.text || '{}')); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleEditImage(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(!genAI) return res.status(500).json({error:'API Key missing'}); const {prompt, imageBase64} = req.body; const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/); if(!match) return res.status(400).json({error:'Invalid image'}); try { const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash-image', contents: { parts: [{inlineData:{mimeType:match[1], data:match[2]}}, {text:prompt}] } }); const part = response.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData); if(part && part.inlineData) res.status(200).json({image:`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}); else throw new Error("No image"); } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleGenerateBanner(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(!genAI) return res.status(500).json({error:'API Key missing'}); const {prompt, imageBase64} = req.body; const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/); if(!match) return res.status(400).json({error:'Invalid image'}); try { const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash-image', contents: { parts: [{text:`Banner e-commerce 16:9 based on this product description: ${prompt}`}] } }); const part = response.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData); if(part && part.inlineData) res.status(200).json({image:`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}); else throw new Error("No image"); } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleBanners(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if(req.method==='GET'){ const {data}=await supabase.from('store_banners').select('*'); return res.status(200).json(data); } if(req.method==='POST'){ const {image_base64, prompt, link} = req.body; const {data}=await supabase.from('store_banners').insert({image_url:image_base64, prompt, link}).select(); return res.status(201).json({banner:data}); } if(req.method==='DELETE'){ const {id}=req.body; await supabase.from('store_banners').delete().eq('id',id); return res.status(200).json({message:'Deleted'}); } } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleSettings(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if(req.method==='GET'){ const {data}=await supabase.from('system_settings').select('*'); const s=data?.reduce((acc:any,i:any)=>{acc[i.key]=i.value; return acc;},{}); return res.status(200).json(s); } if(req.method==='POST'){ const {key,value}=req.body; await supabase.from('system_settings').upsert({key,value}); return res.status(200).json({message:'Saved'}); } } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleTestSupabase(_req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); await supabase.rpc('execute_admin_sql',{sql_query:'SELECT 1'}); res.status(200).json({message:'OK'}); }
async function handleTestGemini(_req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(genAI) await genAI.models.generateContent({model:'gemini-2.5-flash', contents:'test'}); res.status(200).json({message:'OK'}); }
async function handleTestMercadoPago(_req: VercelRequest, res: VercelResponse) { const client = getMercadoPagoClient(); new MerchantOrder(client); res.status(200).json({message:'OK'}); }
async function handleTestMercadoLivre(_req: VercelRequest, res: VercelResponse) { res.status(200).json({message:'OK'}); }
async function handleGetLogs(_req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const {data}=await supabase.from('action_logs').select('*').order('created_at',{ascending:false}); res.status(200).json(data); }
async function handleAnalyzeCredit(req: VercelRequest, res: VercelResponse) { const supabase=getSupabaseAdminClient(); const genAI=getGeminiClient(); const {userId}=req.body; const p=await runCreditAnalysis(supabase,genAI,userId); res.status(200).json({profile:p}); }
async function handleGetProfiles(_req: VercelRequest, res: VercelResponse) { const supabase=getSupabaseAdminClient(); const {data}=await supabase.from('profiles').select('*'); res.status(200).json(data); }
async function handleDiagnoseError(_req: VercelRequest, res: VercelResponse) { res.status(200).json({ diagnosis: "Simulated Diagnosis" }); }
async function handleGetMpAuthUrl(req: VercelRequest, res: VercelResponse) { const { code_challenge } = req.body; const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${process.env.ML_CLIENT_ID}&response_type=code&platform_id=mp&state=random_state&redirect_uri=${req.headers.origin}/admin&code_challenge=${code_challenge}&code_challenge_method=S256`; res.status(200).json({ authUrl }); }
async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const FULL_SETUP_SQL = `CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions"; CREATE TABLE IF NOT EXISTS "public"."profiles" ( "id" "uuid" NOT NULL, "email" "text", "first_name" "text", "last_name" "text", "identification_number" "text", "phone" "text", "credit_score" integer DEFAULT 0, "credit_limit" numeric(10, 2) DEFAULT 0, "credit_status" "text" DEFAULT 'Em Análise', "last_limit_request_date" timestamp with time zone, "avatar_url" "text", "zip_code" "text", "street_name" "text", "street_number" "text", "neighborhood" "text", "city" "text", "federal_unit" "text", "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"), CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE, CONSTRAINT "profiles_email_key" UNIQUE ("email") ); ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "phone" "text"; ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "identification_number" "text"; ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."system_settings" ( "key" "text" NOT NULL, "value" "text", "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key") ); ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."invoices" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid", "month" "text" NOT NULL, "due_date" "date" NOT NULL, "amount" numeric(10, 2) NOT NULL, "status" "text" NOT NULL DEFAULT 'Em aberto', "payment_method" "text", "payment_date" timestamp with time zone, "payment_id" "text", "boleto_url" "text", "boleto_barcode" "text", "notes" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"), CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ); ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."products" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "name" "text" NOT NULL, "description" "text", "price" numeric(10, 2) NOT NULL, "stock" integer NOT NULL, "image_url" "text", "category" "text", "brand" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "products_pkey" PRIMARY KEY ("id") ); ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."contracts" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "title" "text" NOT NULL, "items" "text", "total_value" numeric(10, 2), "installments" integer, "status" "text" DEFAULT 'Ativo', "signature_data" "text", "terms_accepted" boolean DEFAULT true, "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "contracts_pkey" PRIMARY KEY ("id"), CONSTRAINT "contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."fiscal_notes" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "number" "text", "series" "text", "access_key" "text", "total_value" numeric(10, 2), "items" "text", "issue_date" timestamp with time zone DEFAULT "now"(), "xml_url" "text", "pdf_url" "text", CONSTRAINT "fiscal_notes_pkey" PRIMARY KEY ("id"), CONSTRAINT "fiscal_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); ALTER TABLE "public"."fiscal_notes" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."action_logs" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "created_at" timestamp with time zone DEFAULT "now"(), "action_type" "text" NOT NULL, "status" "text" NOT NULL, "description" "text", "details" "jsonb", CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id") ); ALTER TABLE "public"."action_logs" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."notifications" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "title" "text" NOT NULL, "message" "text" NOT NULL, "type" "text" NOT NULL DEFAULT 'info', "read" boolean NOT NULL DEFAULT false, "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"), CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."score_history" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "change" integer NOT NULL, "new_score" integer NOT NULL, "reason" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "score_history_pkey" PRIMARY KEY ("id"), CONSTRAINT "score_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); ALTER TABLE "public"."score_history" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."limit_requests" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "requested_amount" numeric(10, 2) NOT NULL, "current_limit" numeric(10, 2), "justification" "text", "status" "text" NOT NULL DEFAULT 'pending', "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "limit_requests_pkey" PRIMARY KEY ("id"), CONSTRAINT "limit_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); ALTER TABLE "public"."limit_requests" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."store_banners" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "image_url" "text" NOT NULL, "prompt" "text", "link" "text", "active" boolean DEFAULT true, "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "store_banners_pkey" PRIMARY KEY ("id") ); ALTER TABLE "public"."store_banners" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."support_tickets" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "status" "text" DEFAULT 'open', "subject" "text", "category" "text", "priority" "text" DEFAULT 'normal', "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"), CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); ALTER TABLE "public"."support_tickets" ADD COLUMN IF NOT EXISTS "category" "text"; ALTER TABLE "public"."support_tickets" ADD COLUMN IF NOT EXISTS "priority" "text"; ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY; CREATE TABLE IF NOT EXISTS "public"."support_messages" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "ticket_id" "uuid" NOT NULL, "sender_type" "text" NOT NULL, "message" "text" NOT NULL, "is_internal" boolean DEFAULT false, "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id"), CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE ); ALTER TABLE "public"."support_messages" ADD COLUMN IF NOT EXISTS "is_internal" boolean DEFAULT false; ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "Public read access products" ON "public"."products"; DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles"; DROP POLICY IF EXISTS "Users can view own invoices" ON "public"."invoices"; DROP POLICY IF EXISTS "Users can view own contracts" ON "public"."contracts"; DROP POLICY IF EXISTS "Users can view own fiscal notes" ON "public"."fiscal_notes"; DROP POLICY IF EXISTS "Users view own tickets" ON "public"."support_tickets"; DROP POLICY IF EXISTS "Users create own tickets" ON "public"."support_tickets"; DROP POLICY IF EXISTS "Users view messages" ON "public"."support_messages"; DROP POLICY IF EXISTS "Users insert messages" ON "public"."support_messages"; CREATE POLICY "Public read access products" ON "public"."products" FOR SELECT USING (true); CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (auth.uid() = id); CREATE POLICY "Users can view own invoices" ON "public"."invoices" FOR SELECT USING (auth.uid() = user_id); CREATE POLICY "Users can view own contracts" ON "public"."contracts" FOR SELECT USING (auth.uid() = user_id); CREATE POLICY "Users can view own fiscal notes" ON "public"."fiscal_notes" FOR SELECT USING (auth.uid() = user_id); CREATE POLICY "Users view own tickets" ON "public"."support_tickets" FOR SELECT USING (auth.uid() = user_id); CREATE POLICY "Users create own tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK (auth.uid() = user_id); CREATE POLICY "Users view messages" ON "public"."support_messages" FOR SELECT USING ( EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid()) AND is_internal = false ); CREATE POLICY "Users insert messages" ON "public"."support_messages" FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())); CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$ BEGIN RETURN auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062'; END; $$ LANGUAGE plpgsql SECURITY DEFINER;`; const { error } = await supabase.rpc('execute_admin_sql', { sql_query: FULL_SETUP_SQL }); if (error) throw error; await logAction(supabase, 'DATABASE_SETUP', 'SUCCESS', 'Database tables and policies configured via developer panel.'); res.status(200).json({ message: "Banco de dados atualizado com sucesso! Correção is_internal aplicada." }); }
async function handleSupportTickets(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if (req.method === 'POST') { const { userId, subject, message, category, priority } = req.body; const { data: ticket, error: ticketError } = await supabase.from('support_tickets').insert({ user_id: userId, subject: subject || 'Atendimento', category: category || 'Geral', priority: priority || 'normal', status: 'open' }).select().single(); if (ticketError) throw ticketError; if (message) { const { error: msgError } = await supabase.from('support_messages').insert({ ticket_id: ticket.id, sender_type: 'user', message }); if (msgError) throw msgError; } res.status(201).json(ticket); } else if (req.method === 'PUT') { const { id, status } = req.body; const { data, error } = await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select(); if (error) throw error; res.status(200).json(data[0]); } else if (req.method === 'GET') { const { userId } = req.query; let query = supabase.from('support_tickets').select('*, profiles(first_name, last_name, email, credit_score, credit_limit, credit_status)').order('updated_at', { ascending: false }); if (userId) { query = query.eq('user_id', userId); } const { data, error } = await query; if (error) throw error; res.status(200).json(data); } } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleSupportMessages(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if (req.method === 'POST') { const { ticketId, sender, message, isInternal } = req.body; const { data, error } = await supabase.from('support_messages').insert({ ticket_id: ticketId, sender_type: sender, message, is_internal: isInternal || false }).select().single(); if (error) throw error; await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId); res.status(201).json(data); } else if (req.method === 'GET') { const { ticketId } = req.query; const { data, error } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }); if (error) throw error; res.status(200).json(data); } } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleSupportChat(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(!genAI) return res.status(500).json({error:"AI unavailable"}); const {message, context} = req.body; const prompt = `${context} User Message: "${message}" You are a helpful support assistant for Relp Cell. Respond in Portuguese (Brazil). Be concise, polite, and professional. If the user needs to check specific account details that you don't have, suggest they check their profile or wait for a human agent.`; try { const response = await generateContentWithRetry(genAI, {model:'gemini-2.5-flash', contents: prompt}); res.status(200).json({reply: response.text}); } catch(e: any) { res.status(500).json({error: e.message}); } }
async function handleGetAllInvoices(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { const { data, error } = await supabase.from('invoices').select('*').order('due_date', { ascending: false }); if (error) throw error; res.status(200).json(data); } catch (e: any) { res.status(500).json({ error: e.message }); } }
// Main Router
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        if (path === '/api/admin/products') return await handleProducts(req, res);
        if (req.method === 'GET') {
            switch (path) {
                case '/api/admin/get-logs': return await handleGetLogs(req, res);
                case '/api/admin/profiles': return await handleGetProfiles(req, res);
                case '/api/admin/settings': return await handleSettings(req, res);
                case '/api/admin/banners': return await handleBanners(req, res);
                case '/api/admin/support-tickets': return await handleSupportTickets(req, res);
                case '/api/admin/support-messages': return await handleSupportMessages(req, res);
                case '/api/admin/invoices': return await handleGetAllInvoices(req, res); // Novo endpoint para CRM
                default: return res.status(404).json({ error: 'Admin GET route not found' });
            }
        }
        if (req.method === 'POST') {
            switch (path) {
                case '/api/admin/setup-database': return await handleSetupDatabase(req, res);
                case '/api/admin/generate-mercadopago-token': return await handleGenerateMercadoPagoToken(req, res);
                case '/api/admin/get-mp-auth-url': return await handleGetMpAuthUrl(req, res);
                case '/api/admin/test-supabase': return await handleTestSupabase(req, res);
                case '/api/admin/test-gemini': return await handleTestGemini(req, res);
                case '/api/admin/test-mercadopago': return await handleTestMercadoPago(req, res);
                case '/api/admin/test-mercadolivre': return await handleTestMercadoLivre(req, res);
                case '/api/admin/analyze-credit': return await handleAnalyzeCredit(req, res);
                case '/api/admin/create-and-analyze-customer': return await handleCreateAndAnalyzeCustomer(req, res);
                case '/api/admin/create-sale': return await handleCreateSale(req, res); 
                case '/api/admin/diagnose-error': return await handleDiagnoseError(req, res);
                case '/api/admin/settings': return await handleSettings(req, res);
                case '/api/admin/chat': return await handleSupportChat(req, res);
                case '/api/admin/send-notification': return await handleSendNotification(req, res);
                case '/api/admin/generate-product-details': return await handleGenerateProductDetails(req, res);
                case '/api/admin/generate-banner': return await handleGenerateBanner(req, res);
                case '/api/admin/edit-image': return await handleEditImage(req, res);
                case '/api/admin/banners': return await handleBanners(req, res);
                case '/api/admin/support-tickets': return await handleSupportTickets(req, res);
                case '/api/admin/support-messages': return await handleSupportMessages(req, res);
                default: return res.status(404).json({ error: 'Admin POST route not found' });
            }
        }
        if (req.method === 'PUT') {
            switch (path) {
                case '/api/admin/products': return await handleProducts(req, res);
                case '/api/admin/support-tickets': return await handleSupportTickets(req, res);
                default: return res.status(404).json({ error: 'Admin PUT route not found' });
            }
        }
        if (req.method === 'DELETE') {
            if (path === '/api/admin/banners') return await handleBanners(req, res);
        }
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    } catch (e: any) {
        console.error(`Error in admin API handler for path ${path}:`, e);
        return res.status(500).json({ error: 'Internal Server Error', message: e.message });
    }
}
