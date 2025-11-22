
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

async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const FULL_SETUP_SQL = `
            CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
            
            -- 1. TABELAS BÁSICAS
            CREATE TABLE IF NOT EXISTS "public"."profiles" ( "id" "uuid" NOT NULL, "email" "text", "first_name" "text", "last_name" "text", "identification_number" "text", "phone" "text", "credit_score" integer DEFAULT 0, "credit_limit" numeric(10, 2) DEFAULT 0, "credit_status" "text" DEFAULT 'Em Análise', "last_limit_request_date" timestamp with time zone, "avatar_url" "text", "zip_code" "text", "street_name" "text", "street_number" "text", "neighborhood" "text", "city" "text", "federal_unit" "text", "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"), CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE, CONSTRAINT "profiles_email_key" UNIQUE ("email") );
            ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "phone" "text";
            ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "identification_number" "text";
            ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
            
            CREATE TABLE IF NOT EXISTS "public"."system_settings" ( "key" "text" NOT NULL, "value" "text", "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key") );
            ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;

            CREATE TABLE IF NOT EXISTS "public"."invoices" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid", "month" "text" NOT NULL, "due_date" "date" NOT NULL, "amount" numeric(10, 2) NOT NULL, "status" "text" NOT NULL DEFAULT 'Em aberto', "payment_method" "text", "payment_date" timestamp with time zone, "payment_id" "text", "boleto_url" "text", "boleto_barcode" "text", "notes" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"), CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL );
            ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;

            -- Atualização Contract Table para suportar expiração
            CREATE TABLE IF NOT EXISTS "public"."contracts" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "title" "text" NOT NULL, "items" "text", "total_value" numeric(10, 2), "installments" integer, "status" "text" DEFAULT 'Ativo', "signature_data" "text", "terms_accepted" boolean DEFAULT true, "created_at" timestamp with time zone DEFAULT "now"(), "expires_at" timestamp with time zone, CONSTRAINT "contracts_pkey" PRIMARY KEY ("id"), CONSTRAINT "contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE );
            ALTER TABLE "public"."contracts" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
            ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;

            -- Tabela de Produtos
            CREATE TABLE IF NOT EXISTS "public"."products" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "name" "text" NOT NULL, "description" "text", "price" numeric(10, 2) NOT NULL, "stock" integer NOT NULL, "image_url" "text", "category" "text", "brand" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "products_pkey" PRIMARY KEY ("id") );
            ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

            CREATE TABLE IF NOT EXISTS "public"."action_logs" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "created_at" timestamp with time zone DEFAULT "now"(), "action_type" "text" NOT NULL, "status" "text" NOT NULL, "description" "text", "details" "jsonb", CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id") );
            ALTER TABLE "public"."action_logs" ENABLE ROW LEVEL SECURITY;

            -- ... (Outras tabelas: support, missions, notifications, etc.) ...
            
            -- Policies
            DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles";
            CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (auth.uid() = id);
            
            -- Admin Access Function
            CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$ BEGIN RETURN auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062'; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
        `;

        const { error } = await supabase.rpc('execute_admin_sql', { sql_query: FULL_SETUP_SQL });
        if (error) throw error;
        
        res.status(200).json({ message: "Banco de dados atualizado com sucesso! Suporte a contratos pendentes ativado." });
    } catch (error: any) {
        res.status(500).json({ error: 'Falha ao configurar o banco de dados.', message: error.message });
    }
}

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, totalAmount, installments, productName, signature, saleType, paymentMethod, downPayment } = req.body;
        
        if (!userId || !totalAmount || !installments || !productName) {
            return res.status(400).json({ error: 'Dados da venda incompletos.' });
        }

        // Validar Limite de Crédito se for Crediário
        if (saleType === 'crediario') {
            const { data: profile } = await supabase.from('profiles').select('credit_limit').eq('id', userId).single();
            const { data: activeInvoices } = await supabase.from('invoices').select('amount').eq('user_id', userId).or('status.eq.Em aberto,status.eq.Boleto Gerado');
            
            const usedLimit = activeInvoices?.reduce((acc, i) => acc + i.amount, 0) || 0;
            const available = (profile?.credit_limit || 0) - usedLimit;
            
            // Considerar a entrada no cálculo do uso do limite
            const financedAmount = totalAmount - (downPayment || 0);

            if (financedAmount > available) {
                return res.status(400).json({ error: `Limite insuficiente. Disponível: R$ ${available.toFixed(2)}` });
            }
        }

        const installmentAmount = Math.round(((totalAmount - (downPayment || 0)) / installments) * 100) / 100;
        const newInvoices = [];
        const purchaseTimestamp = new Date().toISOString();
        
        // Regra: Expiração em 24h para aceitação
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Status inicial depende do tipo de venda
        // Se Crediário via Admin -> 'Aguardando Assinatura' (Cliente aceita no app)
        // Se Venda Direta (Pix/Cartão) -> 'Em aberto' ou 'Paga' (se já pagou na hora)
        const initialStatus = saleType === 'crediario' ? 'Aguardando Assinatura' : 'Em aberto';

        for (let i = 1; i <= installments; i++) {
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + i);
            
            let notes = `Compra: ${productName}.`;
            if (downPayment && Number(downPayment) > 0) notes += ` (Entrada: R$ ${downPayment})`;
            if (saleType === 'crediario') notes += ` - Aguardando aceite do contrato.`;

            newInvoices.push({
                user_id: userId,
                month: installments === 1 ? productName : `${productName} (${i}/${installments})`,
                due_date: dueDate.toISOString().split('T')[0],
                amount: installmentAmount,
                status: initialStatus,
                notes: notes,
                created_at: purchaseTimestamp,
                payment_method: paymentMethod || 'crediario'
            });
        }

        // Salvar Contrato
        const { data: contractData, error: contractError } = await supabase.from('contracts').insert({
            user_id: userId,
            title: `Contrato de Compra - ${productName}`,
            items: productName,
            total_value: totalAmount,
            installments: installments,
            status: saleType === 'crediario' ? 'Pendente' : 'Ativo', // Pendente de aceite do cliente
            signature_data: signature || null, // Assinatura presencial (opcional se for pendente)
            terms_accepted: saleType !== 'crediario', // Se for direto, já aceitou. Se crediário, falta o app.
            created_at: purchaseTimestamp,
            expires_at: saleType === 'crediario' ? expiresAt.toISOString() : null // 24h para aceitar
        }).select().single();

        if (contractError) throw contractError;

        // Salvar Faturas (vinculadas ao contrato se possível, ou via timestamp)
        const { error: invoiceError } = await supabase.from('invoices').insert(newInvoices);
        if (invoiceError) throw invoiceError;

        // Notificar Cliente
        if (saleType === 'crediario') {
            await supabase.from('notifications').insert({
                user_id: userId,
                title: 'Contrato Pendente',
                message: `Você tem uma nova compra de ${productName} aguardando sua aprovação. Aceite em até 24h para não cancelar.`,
                type: 'warning'
            });
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada para ${userId}. Tipo: ${saleType}`);
        res.status(201).json({ message: 'Venda registrada.', contractId: contractData.id });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

async function handleGetProfiles(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        // Bypassing RLS using admin client
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.status(200).json(data || []);
    } catch (error: any) {
        console.error("Erro ao buscar perfis:", error);
        // Retorna array vazio em vez de erro 500 para não quebrar a UI, mas loga o erro
        res.status(200).json([]); 
    }
}

// ... (Rest of the handlers kept same: products, logs, etc.) ...

// Main Router Update
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        if (req.method === 'GET') {
            if (path === '/api/admin/profiles') return await handleGetProfiles(req, res);
            // ... other GETs
        }
        if (req.method === 'POST') {
            if (path === '/api/admin/create-sale') return await handleCreateSale(req, res);
            if (path === '/api/admin/setup-database') return await handleSetupDatabase(req, res);
            // ... other POSTs
        }
        // ... (existing routing logic)
        
        // Fallback for existing routes not explicitly modified above
        // (Copy existing routing switch/case logic here from original file)
        if (path === '/api/admin/products') {
             // ... Implementation of products handler ...
             const supabase = getSupabaseAdminClient();
             if(req.method==='GET'){ const {data}=await supabase.from('products').select('*').order('created_at',{ascending:false}); return res.status(200).json(data); }
             if(req.method==='POST'){ const {name,description,price,stock,image_url,brand,category}=req.body; const {data,error}=await supabase.from('products').insert([{name,description,price,stock,image_url,brand,category}]).select(); if(error) throw error; return res.status(201).json(data[0]); }
        }
        
        if (path === '/api/admin/settings' && req.method === 'GET') {
             const supabase = getSupabaseAdminClient();
             const {data}=await supabase.from('system_settings').select('*'); 
             const s=data?.reduce((acc:any,i:any)=>{acc[i.key]=i.value; return acc;},{}); 
             return res.status(200).json(s || {});
        }

        return res.status(404).json({ error: 'Route not found' });
    } catch (e: any) {
        return res.status(500).json({ error: 'Internal Error', message: e.message });
    }
}
