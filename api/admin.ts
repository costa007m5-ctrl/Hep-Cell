
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
        // Retorna null em vez de erro para permitir tratamento gracioso
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

// Função de análise de crédito reutilizável
async function runCreditAnalysis(supabase: SupabaseClient, genAI: GoogleGenAI | null, userId: string) {
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileError) throw profileError;
    const { data: invoices, error: invoicesError } = await supabase.from('invoices').select('status, amount, due_date').eq('user_id', userId);
    if (invoicesError) throw invoicesError;

    // Fallback se o Gemini não estiver configurado
    if (!genAI) {
        return {
            credit_score: 500,
            credit_limit: 200.00,
            credit_status: "Análise Manual Necessária (IA Indisponível)"
        };
    }

    const prompt = `Analise o crédito de um cliente com os seguintes dados: - Histórico de Faturas: ${JSON.stringify(invoices)}. Com base nisso, forneça um score de crédito (0-1000), um limite de crédito (em BRL, ex: 1500.00), e um status de crédito ('Excelente', 'Bom', 'Regular', 'Negativado'). O limite de crédito deve ser por PARCELA, ou seja, o valor máximo que cada parcela de uma compra pode ter. Retorne a resposta APENAS como um objeto JSON válido assim: {"credit_score": 850, "credit_limit": 500.00, "credit_status": "Excelente"}. Não adicione nenhum outro texto.`;

    const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
    const text = response.text;
    if (!text) {
        throw new Error("A resposta da IA para análise de crédito estava vazia.");
    }
    const analysis = JSON.parse(text.trim());

    // Atualiza perfil
    const { data: updatedProfile, error: updateError } = await supabase.from('profiles').update({ credit_score: analysis.credit_score, credit_limit: analysis.credit_limit, credit_status: analysis.credit_status }).eq('id', userId).select().single();
    if (updateError) throw updateError;
    
    // Grava histórico de score se houve mudança
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

const SETUP_SQL = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
    
    -- Tabela de Configurações do Sistema
    CREATE TABLE IF NOT EXISTS "public"."system_settings" (
        "key" "text" NOT NULL,
        "value" "text",
        "updated_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
    );
    ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Perfis (Profiles)
    CREATE TABLE IF NOT EXISTS "public"."profiles" (
        "id" "uuid" NOT NULL,
        "email" "text",
        "created_at" timestamp with time zone DEFAULT "now"(),
        "updated_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "profiles_email_key" UNIQUE ("email")
    );
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "first_name" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "last_name" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "identification_type" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "identification_number" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "zip_code" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "street_name" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "street_number" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "neighborhood" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "city" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "federal_unit" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "credit_score" integer;
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "credit_limit" numeric(10, 2);
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "credit_status" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "last_limit_request_date" timestamp with time zone;
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "notify_due_date" boolean DEFAULT true;
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "notify_new_invoice" boolean DEFAULT true;
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "notify_promotions" boolean DEFAULT true;
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "avatar_url" "text";
    ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Endereços (Addresses)
    CREATE TABLE IF NOT EXISTS "public"."addresses" (
        "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
        "user_id" "uuid" NOT NULL,
        "street" "text" NOT NULL,
        "number" "text" NOT NULL,
        "neighborhood" "text" NOT NULL,
        "city" "text" NOT NULL,
        "state" "text" NOT NULL,
        "zip_code" "text" NOT NULL,
        "is_default" boolean DEFAULT false,
        "created_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "addresses_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
    );
    ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Produtos (Products)
    CREATE TABLE IF NOT EXISTS "public"."products" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "name" "text" NOT NULL, "description" "text", "price" numeric(10, 2) NOT NULL, "stock" integer NOT NULL, "image_url" "text", "category" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "products_pkey" PRIMARY KEY ("id") );
    ALTER TABLE "public"."products" ADD COLUMN IF NOT EXISTS "category" "text";
    ALTER TABLE "public"."products" ADD COLUMN IF NOT EXISTS "brand" "text";
    ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Pedidos (Orders)
    CREATE TABLE IF NOT EXISTS "public"."orders" (
        "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
        "user_id" "uuid" NOT NULL,
        "status" "text" NOT NULL DEFAULT 'pending',
        "total" numeric(10, 2) NOT NULL,
        "tracking_code" "text",
        "created_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
    );
    ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

    -- Itens do Pedido (Order Items)
    CREATE TABLE IF NOT EXISTS "public"."order_items" (
        "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
        "order_id" "uuid" NOT NULL,
        "product_id" "uuid",
        "quantity" integer NOT NULL,
        "price" numeric(10, 2) NOT NULL,
        "product_name" "text",
        CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE
    );
    ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Faturas (Invoices)
    CREATE TABLE IF NOT EXISTS "public"."invoices" (
        "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
        "user_id" "uuid",
        "month" "text" NOT NULL,
        "due_date" "date" NOT NULL,
        "amount" numeric(10, 2) NOT NULL,
        "created_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL
    );
    ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "status" "text" NOT NULL DEFAULT 'Em aberto'::"text";
    ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "payment_method" "text";
    ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "payment_date" timestamp with time zone;
    ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "payment_id" "text";
    ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "boleto_url" "text";
    ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "boleto_barcode" "text";
    ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "notes" "text";
    ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Notificações (Notifications)
    CREATE TABLE IF NOT EXISTS "public"."notifications" (
        "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
        "user_id" "uuid" NOT NULL,
        "title" "text" NOT NULL,
        "message" "text" NOT NULL,
        "type" "text" NOT NULL DEFAULT 'info', -- info, warning, success, alert
        "read" boolean NOT NULL DEFAULT false,
        "created_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
    );
    ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Histórico de Score (Score History) - NOVO
    CREATE TABLE IF NOT EXISTS "public"."score_history" (
        "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
        "user_id" "uuid" NOT NULL,
        "change" integer NOT NULL,
        "new_score" integer NOT NULL,
        "reason" "text",
        "created_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "score_history_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "score_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
    );
    ALTER TABLE "public"."score_history" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Solicitações de Limite (Limit Requests) - NOVO
    CREATE TABLE IF NOT EXISTS "public"."limit_requests" (
        "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
        "user_id" "uuid" NOT NULL,
        "requested_amount" numeric(10, 2) NOT NULL,
        "current_limit" numeric(10, 2),
        "justification" "text",
        "status" "text" NOT NULL DEFAULT 'pending', -- pending, approved, rejected
        "created_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "limit_requests_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "limit_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
    );
    ALTER TABLE "public"."limit_requests" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Logs de Ação
    CREATE TABLE IF NOT EXISTS "public"."action_logs" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "created_at" timestamp with time zone DEFAULT "now"(), "action_type" "text" NOT NULL, "status" "text" NOT NULL, "description" "text", "details" "jsonb", CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id") );
    ALTER TABLE "public"."action_logs" ENABLE ROW LEVEL SECURITY;

    -- Políticas de Segurança (RLS)
    
    -- Admin Check
    CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
    BEGIN
      RETURN auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Score History RLS
    DROP POLICY IF EXISTS "Allow users to view their own score history" ON "public"."score_history";
    CREATE POLICY "Allow users to view their own score history" ON "public"."score_history" FOR SELECT USING (("auth"."uid"() = "user_id"));
    DROP POLICY IF EXISTS "Allow admin full access score history" ON "public"."score_history";
    CREATE POLICY "Allow admin full access score history" ON "public"."score_history" FOR ALL USING (is_admin());

    -- Limit Requests RLS
    DROP POLICY IF EXISTS "Allow users to create limit requests" ON "public"."limit_requests";
    CREATE POLICY "Allow users to create limit requests" ON "public"."limit_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
    DROP POLICY IF EXISTS "Allow users to view their own limit requests" ON "public"."limit_requests";
    CREATE POLICY "Allow users to view their own limit requests" ON "public"."limit_requests" FOR SELECT USING (("auth"."uid"() = "user_id"));
    DROP POLICY IF EXISTS "Allow admin full access limit requests" ON "public"."limit_requests";
    CREATE POLICY "Allow admin full access limit requests" ON "public"."limit_requests" FOR ALL USING (is_admin());

    -- Profiles (Existing)
    DROP POLICY IF EXISTS "Allow users to read their own profile" ON "public"."profiles";
    CREATE POLICY "Allow users to read their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
    DROP POLICY IF EXISTS "Allow users to update their own profile" ON "public"."profiles";
    CREATE POLICY "Allow users to update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));
    DROP POLICY IF EXISTS "Allow admin full access to profiles" ON "public"."profiles";
    CREATE POLICY "Allow admin full access to profiles" ON "public"."profiles" FOR ALL USING (is_admin());

    -- Addresses
    DROP POLICY IF EXISTS "Allow users access own addresses" ON "public"."addresses";
    CREATE POLICY "Allow users access own addresses" ON "public"."addresses" FOR ALL USING (("auth"."uid"() = "user_id"));
    DROP POLICY IF EXISTS "Allow admin access addresses" ON "public"."addresses";
    CREATE POLICY "Allow admin access addresses" ON "public"."addresses" FOR ALL USING (is_admin());

    -- Orders
    DROP POLICY IF EXISTS "Allow users access own orders" ON "public"."orders";
    CREATE POLICY "Allow users access own orders" ON "public"."orders" FOR SELECT USING (("auth"."uid"() = "user_id"));
    DROP POLICY IF EXISTS "Allow users create own orders" ON "public"."orders";
    CREATE POLICY "Allow users create own orders" ON "public"."orders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
    DROP POLICY IF EXISTS "Allow admin full access orders" ON "public"."orders";
    CREATE POLICY "Allow admin full access orders" ON "public"."orders" FOR ALL USING (is_admin());

    -- Order Items
    DROP POLICY IF EXISTS "Allow users access own order items" ON "public"."order_items";
    CREATE POLICY "Allow users access own order items" ON "public"."order_items" FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    );
    DROP POLICY IF EXISTS "Allow users create order items" ON "public"."order_items";
    CREATE POLICY "Allow users create order items" ON "public"."order_items" FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    );
    DROP POLICY IF EXISTS "Allow admin access order items" ON "public"."order_items";
    CREATE POLICY "Allow admin access order items" ON "public"."order_items" FOR ALL USING (is_admin());

    -- Products
    DROP POLICY IF EXISTS "Allow public read access to products" ON "public"."products";
    CREATE POLICY "Allow public read access to products" ON "public"."products" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Allow admin full access to products" ON "public"."products";
    CREATE POLICY "Allow admin full access to products" ON "public"."products" FOR ALL USING (is_admin());

    -- Invoices
    DROP POLICY IF EXISTS "Allow users to view their own invoices" ON "public"."invoices";
    CREATE POLICY "Allow users to view their own invoices" ON "public"."invoices" FOR SELECT USING (("auth"."uid"() = "user_id"));
    DROP POLICY IF EXISTS "Allow admin full access to invoices" ON "public"."invoices";
    CREATE POLICY "Allow admin full access to invoices" ON "public"."invoices" FOR ALL USING (is_admin());

    -- Notifications
    DROP POLICY IF EXISTS "Allow users to read their own notifications" ON "public"."notifications";
    CREATE POLICY "Allow users to read their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));
    DROP POLICY IF EXISTS "Allow users to update their own notifications" ON "public"."notifications";
    CREATE POLICY "Allow users to update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));
    DROP POLICY IF EXISTS "Allow admin full access to notifications" ON "public"."notifications";
    CREATE POLICY "Allow admin full access to notifications" ON "public"."notifications" FOR ALL USING (is_admin());

    -- Settings
    DROP POLICY IF EXISTS "Allow public read access to settings" ON "public"."system_settings";
    CREATE POLICY "Allow public read access to settings" ON "public"."system_settings" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Allow admin full access to settings" ON "public"."system_settings";
    CREATE POLICY "Allow admin full access to settings" ON "public"."system_settings" FOR ALL USING (is_admin());

    -- Action Logs
    DROP POLICY IF EXISTS "Allow admin full access to action logs" ON "public"."action_logs";
    CREATE POLICY "Allow admin full access to action logs" ON "public"."action_logs" FOR ALL USING (is_admin());

    -- Função Handle New User
    CREATE OR REPLACE FUNCTION public.handle_new_user_creation(user_id uuid, user_email text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO public.profiles (id, email)
      VALUES (user_id, user_email)
      ON CONFLICT (id) DO NOTHING;
      
      -- Inicializa histórico de score com valor padrão (500)
      INSERT INTO public.score_history (user_id, change, new_score, reason)
      VALUES (user_id, 500, 500, 'Score inicial');
      
      -- Envia notificação de boas-vindas
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (user_id, 'Bem-vindo à Relp Cell!', 'Estamos felizes em tê-lo conosco. Configure seu perfil para começar.', 'success');
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
`;


// --- Route Handlers ---

async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { error } = await supabase.rpc('execute_admin_sql', { sql_query: SETUP_SQL });
        if (error) throw error;
        
        // Inicializa configuração padrão de juros se não existir
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'interest_rate').single();
        if (!data) {
            await supabase.from('system_settings').insert({ key: 'interest_rate', value: '0' });
        }
        
        // Inicializa config de IA
        const { data: aiData } = await supabase.from('system_settings').select('value').eq('key', 'chat_model').single();
        if (!aiData) {
            await supabase.from('system_settings').insert({ key: 'chat_model', value: 'gemini-2.5-flash' });
        }

        await logAction(supabase, 'DATABASE_SETUP', 'SUCCESS', 'Database tables and policies configured via developer panel.');
        res.status(200).json({ message: "Banco de dados atualizado com sucesso! Novas tabelas criadas." });
    } catch (error: any) {
        await logAction(supabase, 'DATABASE_SETUP', 'FAILURE', 'Failed to configure database.', { error: error.message });
        res.status(500).json({ error: 'Falha ao configurar o banco de dados.', message: error.message });
    }
}

async function handleSendNotification(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, title, message, type } = req.body;

        if (!userId || !title || !message) {
            return res.status(400).json({ error: 'Missing required fields: userId, title, message' });
        }

        const { error } = await supabase.from('notifications').insert({
            user_id: userId,
            title,
            message,
            type: type || 'info'
        });

        if (error) throw error;

        await logAction(supabase, 'NOTIFICATION_SENT', 'SUCCESS', `Notificação enviada para ${userId}: ${title}`);
        res.status(200).json({ message: 'Notificação enviada com sucesso.' });
    } catch (error: any) {
        await logAction(supabase, 'NOTIFICATION_SENT', 'FAILURE', `Falha ao enviar notificação.`, { error: error.message });
        res.status(500).json({ error: error.message });
    }
}

async function handleGenerateProductDetails(req: VercelRequest, res: VercelResponse) {
    const genAI = getGeminiClient();
    if (!genAI) return res.status(500).json({ error: 'Gemini API key not configured.' });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

    try {
        // Updated prompt to ensure structured description
        const instruction = `Extract product details from the following user prompt: "${prompt}".
        Return a JSON object with the following keys:
        - name: The full commercial name of the product.
        - description: A structured description using Markdown headers (###) to separate sections. 
          Example structure:
          ### Destaques
          [Bullet points of main features]
          
          ### Ficha Técnica
          - Tela: [Details]
          - Processador: [Details]
          ...
          
          ### Itens Inclusos
          [List of items]
          
        - price: The price as a number (extract from text, e.g., "500 reais" -> 500).
        - stock: The stock quantity as a number.
        - brand: The brand of the product (e.g., Apple, Samsung, Xiaomi, Motorola). If not specified, infer from the name or set to "Genérica".
        - category: The best category for this product. Must be one of: "Celulares", "Acessórios", "Fones", "Smartwatch", "Ofertas". If unsure or if it's a discount item, use "Ofertas". Default to "Celulares" if it's a phone.
        
        If any information is missing, make a reasonable guess based on common market standards for similar products or leave blank.`;
        
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: instruction,
            config: { responseMimeType: 'application/json' }
        });

        const productData = JSON.parse(response.text || '{}');
        res.status(200).json(productData);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate product details.', message: error.message });
    }
}


async function handleSettings(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        if (req.method === 'GET') {
            const { data, error } = await supabase.from('system_settings').select('*');
            if (error) throw error;
            // Transforma array em objeto { key: value }
            const settings = data.reduce((acc: any, item: any) => {
                acc[item.key] = item.value;
                return acc;
            }, {});
            return res.status(200).json(settings);
        }

        if (req.method === 'POST') {
            const { key, value } = req.body;
            if (!key) return res.status(400).json({ error: 'Key is required' });

            const { error } = await supabase
                .from('system_settings')
                .upsert({ key, value, updated_at: new Date().toISOString() });
            
            if (error) throw error;
            await logAction(supabase, 'SETTINGS_UPDATE', 'SUCCESS', `Configuração '${key}' atualizada para '${value}'.`);
            return res.status(200).json({ message: 'Configuração salva.' });
        }
        
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

async function handleGenerateMercadoPagoToken(req: VercelRequest, res: VercelResponse) {
    const { code, redirectUri, codeVerifier } = req.body;
    const appId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;

    if (!code || !redirectUri || !codeVerifier) {
        return res.status(400).json({ error: 'Authorization code, redirect URI, and code verifier are required.' });
    }
     if (!appId || !clientSecret) {
        return res.status(500).json({ error: 'Mercado Livre App ID or Client Secret not configured on the server.' });
    }

    try {
        const response = await fetch('https://api.mercadopago.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                client_id: appId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to exchange authorization code for token.');
        }

        res.status(200).json({ accessToken: data.access_token });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate Mercado Pago token.', message: error.message });
    }
}


async function handleTestSupabase(_req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.rpc('execute_admin_sql', { sql_query: 'SELECT 1;' });
        if (error) throw new Error(`Conectado, mas a função RPC 'execute_admin_sql' falhou ou não existe. Detalhes: ${error.message}`);
        res.status(200).json({ message: 'Conexão com Supabase e função RPC estão funcionando.' });
    } catch (error: any) {
        res.status(500).json({ message: `Falha na conexão com Supabase: ${error.message}` });
    }
}

async function handleTestGemini(_req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        if (!genAI) throw new Error("Chave API_KEY não configurada.");
        await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
        res.status(200).json({ message: 'API do Gemini respondeu com sucesso.' });
    } catch (error: any) {
        res.status(500).json({ message: `Falha na conexão com Gemini: ${error.message}` });
    }
}

async function handleTestMercadoPago(_req: VercelRequest, res: VercelResponse) {
    try {
        const client = getMercadoPagoClient();
        const merchantOrder = new MerchantOrder(client);
        await merchantOrder.search();
        res.status(200).json({ message: 'API do Mercado Pago respondeu com sucesso.' });
    } catch (error: any) {
        res.status(500).json({ message: `Falha na conexão com Mercado Pago: ${error.message}` });
    }
}

async function handleTestMercadoLivre(_req: VercelRequest, res: VercelResponse) {
    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({ message: 'ML_CLIENT_ID ou ML_CLIENT_SECRET não estão configurados nas variáveis de ambiente.' });
    }

    try {
        const response = await fetch("https://api.mercadolibre.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Credenciais inválidas.');
        }

        if (!data.access_token) {
            throw new Error('Resposta de autenticação não continha um access_token.');
        }

        res.status(200).json({ message: 'Credenciais do Mercado Livre são válidas e a autenticação foi bem-sucedida.' });
    } catch (error: any) {
        res.status(500).json({ message: `Falha na autenticação com Mercado Livre: ${error.message}` });
    }
}

async function handleGetLogs(_req: VercelRequest, res: VercelResponse) {
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
        const updatedProfile = await runCreditAnalysis(supabase, genAI, userId);
        res.status(200).json({ message: 'Análise de crédito concluída com sucesso!', profile: updatedProfile });
    } catch (error: any) {
        await logAction(supabase, 'CREDIT_ANALYSIS', 'FAILURE', `Failed credit analysis for user ${userId}.`, { error: error.message });
        res.status(500).json({ error: 'Falha na análise de crédito.', message: error.message });
    }
}

async function handleCreateAndAnalyzeCustomer(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const genAI = getGeminiClient();
    const { email, password, first_name, last_name } = req.body;
    if (!email || !password || !first_name) {
        return res.status(400).json({ error: 'Email, password, and first_name are required.' });
    }

    try {
        const { data: { user }, error: userError } = await supabase.auth.admin.createUser({
            email: email, password: password, email_confirm: true,
        });
        if (userError) throw new Error(`Supabase Auth Error: ${userError.message}`);
        if (!user) throw new Error("Failed to create user in Supabase Auth.");

        const { error: profileError } = await supabase
            .from('profiles')
            .insert({ id: user.id, email, first_name, last_name });
        if (profileError) {
             const { error: updateError } = await supabase
                .from('profiles')
                .update({ first_name, last_name })
                .eq('id', user.id);
             
             if (updateError) {
                 await supabase.auth.admin.deleteUser(user.id);
                 throw new Error(`Supabase Profile Error: ${profileError.message}`);
             }
        }

        const analyzedProfile = await runCreditAnalysis(supabase, genAI, user.id);

        await logAction(supabase, 'CUSTOMER_CREATED', 'SUCCESS', `New customer ${email} created and analyzed via admin panel.`);
        res.status(201).json({ message: 'Cliente criado e analisado com sucesso!', profile: analyzedProfile });

    } catch (error: any) {
        await logAction(supabase, 'CUSTOMER_CREATED', 'FAILURE', `Failed to create new customer ${email}.`, { error: error.message });
        res.status(500).json({ error: 'Falha ao criar e analisar o cliente.', message: error.message });
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
        
        // Create or Update Product
        if (req.method === 'POST' || req.method === 'PUT') {
            const { id, image_base64, ...productData } = req.body;
            let imageUrl = productData.image_url;

            if (image_base64) {
                const bucket = 'product-images';
                const fileExt = image_base64.substring(image_base64.indexOf('/') + 1, image_base64.indexOf(';base64'));
                const filePath = `product-${Date.now()}.${fileExt}`;
                const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');

                const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, buffer, {
                    contentType: `image/${fileExt}`,
                    upsert: true
                });
                
                if (uploadError && uploadError.message.includes('Bucket not found')) {
                     await supabase.storage.createBucket(bucket, { public: true });
                     const { error: retryError } = await supabase.storage.from(bucket).upload(filePath, buffer, { contentType: `image/${fileExt}`, upsert: true });
                     if (retryError) throw new Error(`Supabase Storage Error: ${retryError.message}`);
                } else if (uploadError) {
                    throw new Error(`Supabase Storage Error: ${uploadError.message}`);
                }

                const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
                imageUrl = publicUrlData.publicUrl;
            }
            
            let error;
            if (req.method === 'PUT' && id) {
                 const { error: updateError } = await supabase.from('products').update({ ...productData, image_url: imageUrl }).eq('id', id);
                 error = updateError;
                 await logAction(supabase, 'PRODUCT_UPDATED', 'SUCCESS', `Produto '${productData.name}' foi atualizado.`);
            } else {
                 const { error: insertError } = await supabase.from('products').insert([{ ...productData, image_url: imageUrl }]);
                 error = insertError;
                 await logAction(supabase, 'PRODUCT_CREATED', 'SUCCESS', `Produto '${productData.name}' foi criado.`);
            }

            if (error) throw error;
            
            return res.status(201).json({ message: req.method === 'PUT' ? "Product updated." : "Product created." });
        }
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    } catch (error: any) {
        await logAction(supabase, 'PRODUCT_OPERATION', 'FAILURE', 'Falha ao criar/editar produto.', { error: error.message, productData: req.body });
        return res.status(500).json({ error: error.message });
    }
}

async function handleGetProfiles(_req: VercelRequest, res: VercelResponse) {
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
        const { userId, totalAmount, installments, productName } = req.body;
        if (!userId || !totalAmount || !installments || !productName) {
            return res.status(400).json({ error: 'Missing required sale data.' });
        }
        
        const installmentAmount = Math.round((totalAmount / installments) * 100) / 100;
        const newInvoices = [];
        const today = new Date();

        for (let i = 1; i <= installments; i++) {
            const dueDate = new Date(today);
            dueDate.setMonth(today.getMonth() + i);
            newInvoices.push({ user_id: userId, month: `${productName} (${i}/${installments})`, due_date: dueDate.toISOString().split('T')[0], amount: installmentAmount, status: 'Em aberto', notes: `Referente a compra de ${productName} parcelada em ${installments}x.` });
        }

        const { error } = await supabase.from('invoices').insert(newInvoices);
        if (error) throw error;

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada para o usuário ${userId} em ${installments} parcelas. Valor total: ${totalAmount}`);
        res.status(201).json({ message: 'Venda criada e faturas geradas.' });
    } catch (error: any) {
        await logAction(supabase, 'SALE_CREATED', 'FAILURE', 'Falha ao criar venda.', { error: error.message, body: req.body });
        res.status(500).json({ error: error.message });
    }
}

async function handleDiagnoseError(req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        if (!genAI) return res.status(200).json({ diagnosis: "IA não configurada para diagnóstico." });

        const { errorMessage } = req.body;
        if (!errorMessage) {
            return res.status(400).json({ error: 'errorMessage is required.' });
        }
        
        const prompt = `An admin user of a web application is facing a database error. The error message is: "${errorMessage}". Based on this error, provide a diagnosis in Portuguese. Structure your response with markdown. Start with a title "### Diagnóstico do Erro". Then a section "### Causa Provável" explaining what the error likely means in the context of Supabase/PostgreSQL. Finally, a section "### Ações Recomendadas" with clear, actionable steps for the admin to resolve the issue, like checking RLS policies, table permissions, or function definitions in their Supabase dashboard. Keep the explanation clear and targeted at a developer/admin user.`;

        const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        res.status(200).json({ diagnosis: response.text });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get diagnosis from AI.', message: error.message });
    }
}

async function handleSupportChat(req: VercelRequest, res: VercelResponse) {
    // Resposta padrão de fallback caso a IA falhe
    const fallbackReply = "Estou com uma pequena instabilidade para conectar com meu cérebro de IA, mas posso te adiantar: verifique suas faturas na aba 'Faturas' e nosso catálogo na aba 'Loja'. Se precisar de algo urgente, contate o suporte via WhatsApp.";
    const supabase = getSupabaseAdminClient();

    try {
        const genAI = getGeminiClient();
        const { message, context } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        // Se a chave da API não estiver configurada, retorna o fallback imediatamente
        if (!genAI) {
            console.warn("Chat: Gemini API key not set. Returning fallback.");
            return res.status(200).json({ reply: "O sistema de IA não está configurado no momento (Chave API ausente), mas você pode navegar pelo app normalmente." });
        }

        // 1. Busca a configuração de modelo do banco de dados
        // Usa uma query rápida para não travar o chat
        const { data: setting } = await supabase.from('system_settings').select('value').eq('key', 'chat_model').single();
        // Se não achar, usa o flash padrão
        const selectedModel = setting?.value || 'gemini-2.5-flash';

        const systemInstruction = `Você é o assistente virtual oficial da Relp Cell, uma loja de eletrônicos e serviços financeiros. 
        Seu tom é amigável, profissional e direto.
        Você pode responder sobre: status de faturas, produtos disponíveis na loja (iPhone, Samsung, Xiaomi, etc), limites de crédito e dúvidas gerais sobre o app.
        Use o contexto fornecido sobre o usuário para personalizar a resposta.
        Se não souber a resposta, oriente o usuário a entrar em contato com o suporte humano via WhatsApp.
        Contexto do Usuário: ${context || 'Visitante não logado'}`;

        // Envolve a chamada da IA em um try-catch específico para garantir que
        // erros da API do Google não derrubem a requisição sem resposta.
        try {
            const response = await genAI.models.generateContent({
                model: selectedModel, // Usa o modelo configurado dinamicamente
                contents: message,
                config: {
                    systemInstruction: systemInstruction,
                }
            });
            
            if (response && response.text) {
                 res.status(200).json({ reply: response.text });
            } else {
                 throw new Error("Resposta vazia da IA");
            }
        } catch (aiError: any) {
            console.error(`Erro na chamada do Gemini (Modelo: ${selectedModel}):`, aiError);
            // Se for erro de modelo não encontrado ou cota, tenta fallback para flash
            if (selectedModel !== 'gemini-2.5-flash') {
                 try {
                    console.log("Tentando fallback para gemini-2.5-flash...");
                    const fallbackResponse = await genAI.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: message,
                        config: { systemInstruction }
                    });
                    return res.status(200).json({ reply: fallbackResponse.text });
                 } catch (e) {
                     // Se falhar de novo, vai para o erro final
                 }
            }
            return res.status(200).json({ reply: fallbackReply });
        }

    } catch (error: any) {
        console.error("Erro geral no endpoint de chat:", error);
        // Garante que o frontend receba um JSON válido e pare de carregar
        res.status(200).json({ reply: fallbackReply });
    }
}

async function handleGetMpAuthUrl(req: VercelRequest, res: VercelResponse) {
    const mlClientId = process.env.ML_CLIENT_ID;
    if (!mlClientId) {
        return res.status(500).json({ error: 'ML_CLIENT_ID não está configurado no servidor.' });
    }
    const { code_challenge } = req.body;
    if (!code_challenge) {
        return res.status(400).json({ error: 'code_challenge is required for PKCE flow.' });
    }
    const redirectUri = req.headers.referer || `https://${req.headers.host}`;
    let authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${mlClientId}&response_type=code&platform=mp&redirect_uri=${encodeURIComponent(redirectUri)}`;
    authUrl += `&code_challenge=${code_challenge}&code_challenge_method=S256`;
    return res.status(200).json({ authUrl });
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
                case '/api/admin/settings': return await handleSettings(req, res);
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
                case '/api/admin/generate-product-details': return await handleGenerateProductDetails(req, res); // Novo Endpoint
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
