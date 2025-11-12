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
        throw new Error('Gemini API key (API_KEY) is not set.');
    }
    // Fix: Initialize GoogleGenAI with a named apiKey parameter.
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

const SETUP_SQL = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
    CREATE TABLE IF NOT EXISTS "public"."profiles" ( "id" "uuid" NOT NULL, "email" "text", "first_name" "text", "last_name" "text", "identification_type" "text", "identification_number" "text", "zip_code" "text", "street_name" "text", "street_number" "text", "neighborhood" "text", "city" "text", "federal_unit" "text", "credit_score" integer, "credit_limit" numeric(10, 2), "credit_status" "text", "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"), CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE, CONSTRAINT "profiles_email_key" UNIQUE ("email") );
    ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."products" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "name" "text" NOT NULL, "description" "text", "price" numeric(10, 2) NOT NULL, "stock" integer NOT NULL, "image_url" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "products_pkey" PRIMARY KEY ("id") );
    ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."invoices" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid", "month" "text" NOT NULL, "due_date" "date" NOT NULL, "amount" numeric(10, 2) NOT NULL, "status" "text" NOT NULL DEFAULT 'Em aberto'::"text", "payment_method" "text", "payment_date" timestamp with time zone, "payment_id" "text", "boleto_url" "text", "boleto_barcode" "text", "notes" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"), CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL );
    ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."action_logs" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "created_at" timestamp with time zone DEFAULT "now"(), "action_type" "text" NOT NULL, "status" "text" NOT NULL, "description" "text", "details" "jsonb", CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id") );
    ALTER TABLE "public"."action_logs" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow users to read their own profile" ON "public"."profiles";
    CREATE POLICY "Allow users to read their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
    DROP POLICY IF EXISTS "Allow users to update their own profile" ON "public"."profiles";
    CREATE POLICY "Allow users to update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));
    DROP POLICY IF EXISTS "Allow public read access to products" ON "public"."products";
    CREATE POLICY "Allow public read access to products" ON "public"."products" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Allow users to view their own invoices" ON "public"."invoices";
    CREATE POLICY "Allow users to view their own invoices" ON "public"."invoices" FOR SELECT USING (("auth"."uid"() = "user_id"));
    CREATE OR REPLACE FUNCTION public.handle_new_user_creation(user_id uuid, user_email text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO public.profiles (id, email)
      VALUES (user_id, user_email);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
`;


// --- Route Handlers ---

async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { error } = await supabase.rpc('execute_admin_sql', { sql_query: SETUP_SQL });
        if (error) throw error;
        await logAction(supabase, 'DATABASE_SETUP', 'SUCCESS', 'Database tables and policies configured via developer panel.');
        res.status(200).json({ message: "Banco de dados configurado com sucesso! Tabelas e políticas de segurança foram aplicadas." });
    } catch (error: any) {
        await logAction(supabase, 'DATABASE_SETUP', 'FAILURE', 'Failed to configure database.', { error: error.message });
        res.status(500).json({ error: 'Falha ao configurar o banco de dados.', message: error.message });
    }
}

async function handleTestSupabase(req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.rpc('execute_admin_sql', { sql_query: 'SELECT 1;' });
        if (error) throw new Error(`Conectado, mas a função RPC 'execute_admin_sql' falhou ou não existe. Detalhes: ${error.message}`);
        res.status(200).json({ message: 'Conexão com Supabase e função RPC estão funcionando.' });
    } catch (error: any) {
        res.status(500).json({ message: `Falha na conexão com Supabase: ${error.message}` });
    }
}

async function handleTestGemini(req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
        res.status(200).json({ message: 'API do Gemini respondeu com sucesso.' });
    } catch (error: any) {
        res.status(500).json({ message: `Falha na conexão com Gemini: ${error.message}` });
    }
}

async function handleTestMercadoPago(req: VercelRequest, res: VercelResponse) {
    try {
        const client = getMercadoPagoClient();
        const merchantOrder = new MerchantOrder(client);
        await merchantOrder.search();
        res.status(200).json({ message: 'API do Mercado Pago respondeu com sucesso.' });
    } catch (error: any) {
        res.status(500).json({ message: `Falha na conexão com Mercado Pago: ${error.message}` });
    }
}

async function handleGetLogs(req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase.from('action_logs').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
}

async function handleAnalyzeCredit(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const genAI = getGeminiClient();
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    try {
        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (profileError) throw profileError;
        const { data: invoices, error: invoicesError } = await supabase.from('invoices').select('status, amount, due_date').eq('user_id', userId);
        if (invoicesError) throw invoicesError;

        const prompt = `Analyze the credit of a client with the following data: - Profile: ${JSON.stringify(profile)} - Invoices: ${JSON.stringify(invoices)}. Based on this data, provide a credit score (0-1000), a credit limit (in BRL, e.g., 1500.00), and a credit status ('Excelente', 'Bom', 'Regular', 'Negativado'). Return the response ONLY as a valid JSON object like this: {"credit_score": 850, "credit_limit": 5000.00, "credit_status": "Excelente"}. Do not add any other text.`;

        const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
        // Fix: Safely access text property from Gemini response.
        const analysis = JSON.parse(response.text.trim());

        const { data: updatedProfile, error: updateError } = await supabase.from('profiles').update({ credit_score: analysis.credit_score, credit_limit: analysis.credit_limit, credit_status: analysis.credit_status }).eq('id', userId).select().single();
        if (updateError) throw updateError;
        
        await logAction(supabase, 'CREDIT_ANALYSIS', 'SUCCESS', `Credit analysis performed for user ${profile.email}. Status: ${analysis.credit_status}, Limit: ${analysis.credit_limit}`);
        res.status(200).json({ message: 'Análise de crédito concluída com sucesso!', profile: updatedProfile });
    } catch (error: any) {
        await logAction(supabase, 'CREDIT_ANALYSIS', 'FAILURE', `Failed credit analysis for user ${userId}.`, { error: error.message });
        res.status(500).json({ error: 'Falha na análise de crédito.', message: error.message });
    }
}

async function handleProducts(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        if (req.method === 'GET') {
            const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return res.status(200).json(data);
        }
        if (req.method === 'POST') {
            const { error } = await supabase.from('products').insert([req.body]);
            if (error) throw error;
            return res.status(201).json({ message: "Product created." });
        }
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleGetProfiles(req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase.from('profiles').select('*').order('first_name');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, totalAmount, installments } = req.body;
        if (!userId || !totalAmount || !installments) {
            return res.status(400).json({ error: 'Missing required sale data.' });
        }
        
        const installmentAmount = Math.round((totalAmount / installments) * 100) / 100;
        const newInvoices = [];
        const today = new Date();

        for (let i = 1; i <= installments; i++) {
            const dueDate = new Date(today);
            dueDate.setMonth(today.getMonth() + i);
            newInvoices.push({ user_id: userId, month: `Parcela ${i}/${installments}`, due_date: dueDate.toISOString().split('T')[0], amount: installmentAmount, status: 'Em aberto', notes: `Referente a compra parcelada em ${installments}x.` });
        }

        const { error } = await supabase.from('invoices').insert(newInvoices);
        if (error) throw error;

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Sale created for user ${userId} in ${installments} installments.`);
        res.status(201).json({ message: 'Sale created and invoices generated.' });
    } catch (error: any) {
        await logAction(supabase, 'SALE_CREATED', 'FAILURE', 'Failed to create sale.', { error: error.message, body: req.body });
        res.status(500).json({ error: error.message });
    }
}

async function handleDiagnoseError(req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        const { errorMessage } = req.body;
        if (!errorMessage) {
            return res.status(400).json({ error: 'errorMessage is required.' });
        }
        
        const prompt = `An admin user of a web application is facing a database error. The error message is: "${errorMessage}". Based on this error, provide a diagnosis in Portuguese. Structure your response with markdown. Start with a title "### Diagnóstico do Erro". Then a section "### Causa Provável" explaining what the error likely means in the context of Supabase/PostgreSQL. Finally, a section "### Ações Recomendadas" with clear, actionable steps for the admin to resolve the issue, like checking RLS policies, table permissions, or function definitions in their Supabase dashboard. Keep the explanation clear and targeted at a developer/admin user.`;

        const response = await genAI.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
        res.status(200).json({ diagnosis: response.text });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get diagnosis from AI.', message: error.message });
    }
}

// --- Main Router ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        if (path === '/api/admin/products') {
            return await handleProducts(req, res);
        }
        if (req.method === 'GET') {
            switch (path) {
                case '/api/admin/get-logs': return await handleGetLogs(req, res);
                case '/api/admin/profiles': return await handleGetProfiles(req, res);
                default: return res.status(404).json({ error: 'Admin GET route not found' });
            }
        }
        if (req.method === 'POST') {
            switch (path) {
                case '/api/admin/setup-database': return await handleSetupDatabase(req, res);
                case '/api/admin/test-supabase': return await handleTestSupabase(req, res);
                case '/api/admin/test-gemini': return await handleTestGemini(req, res);
                case '/api/admin/test-mercadopago': return await handleTestMercadoPago(req, res);
                case '/api/admin/analyze-credit': return await handleAnalyzeCredit(req, res);
                case '/api/admin/create-sale': return await handleCreateSale(req, res);
                case '/api/admin/diagnose-error': return await handleDiagnoseError(req, res);
                default: return res.status(404).json({ error: 'Admin POST route not found' });
            }
        }
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    } catch (e: any) {
        console.error(`Error in admin API handler for path ${path}:`, e);
        return res.status(500).json({ error: 'Internal Server Error', message: e.message });
    }
}
