import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, MerchantOrder } from 'mercadopago';
import { URL } from 'url';
// FIX: Import Buffer to resolve 'Cannot find name 'Buffer'' error.
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
        throw new Error('Gemini API key (API_KEY) is not set.');
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
async function runCreditAnalysis(supabase: SupabaseClient, genAI: GoogleGenAI, userId: string) {
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileError) throw profileError;
    const { data: invoices, error: invoicesError } = await supabase.from('invoices').select('status, amount, due_date').eq('user_id', userId);
    if (invoicesError) throw invoicesError;

    const prompt = `Analise o crédito de um cliente com os seguintes dados: - Histórico de Faturas: ${JSON.stringify(invoices)}. Com base nisso, forneça um score de crédito (0-1000), um limite de crédito (em BRL, ex: 1500.00), e um status de crédito ('Excelente', 'Bom', 'Regular', 'Negativado'). O limite de crédito deve ser por PARCELA, ou seja, o valor máximo que cada parcela de uma compra pode ter. Retorne a resposta APENAS como um objeto JSON válido assim: {"credit_score": 850, "credit_limit": 500.00, "credit_status": "Excelente"}. Não adicione nenhum outro texto.`;

    const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
    const text = response.text;
    if (!text) {
        throw new Error("A resposta da IA para análise de crédito estava vazia.");
    }
    const analysis = JSON.parse(text.trim());

    const { data: updatedProfile, error: updateError } = await supabase.from('profiles').update({ credit_score: analysis.credit_score, credit_limit: analysis.credit_limit, credit_status: analysis.credit_status }).eq('id', userId).select().single();
    if (updateError) throw updateError;
    
    await logAction(supabase, 'CREDIT_ANALYSIS', 'SUCCESS', `Análise de crédito para ${profile.email}. Status: ${analysis.credit_status}, Limite: ${analysis.credit_limit}`);
    return updatedProfile;
}

const SETUP_SQL = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
    
    -- Tabela de Configurações do Sistema (Juros, etc)
    CREATE TABLE IF NOT EXISTS "public"."system_settings" (
        "key" "text" NOT NULL,
        "value" "text",
        "updated_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
    );
    ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Perfis (Profiles) - Estrutura Robusta com ALTER TABLE
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
    ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Produtos (Products)
    CREATE TABLE IF NOT EXISTS "public"."products" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "name" "text" NOT NULL, "description" "text", "price" numeric(10, 2) NOT NULL, "stock" integer NOT NULL, "image_url" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "products_pkey" PRIMARY KEY ("id") );
    ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

    -- Tabela de Faturas (Invoices) - Estrutura Robusta com ALTER TABLE
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

    -- Tabela de Logs de Ação (Action Logs)
    CREATE TABLE IF NOT EXISTS "public"."action_logs" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "created_at" timestamp with time zone DEFAULT "now"(), "action_type" "text" NOT NULL, "status" "text" NOT NULL, "description" "text", "details" "jsonb", CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id") );
    ALTER TABLE "public"."action_logs" ENABLE ROW LEVEL SECURITY;

    -- Políticas de Segurança para Clientes
    DROP POLICY IF EXISTS "Allow users to read their own profile" ON "public"."profiles";
    CREATE POLICY "Allow users to read their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
    DROP POLICY IF EXISTS "Allow users to update their own profile" ON "public"."profiles";
    CREATE POLICY "Allow users to update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));
    DROP POLICY IF EXISTS "Allow public read access to products" ON "public"."products";
    CREATE POLICY "Allow public read access to products" ON "public"."products" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Allow users to view their own invoices" ON "public"."invoices";
    CREATE POLICY "Allow users to view their own invoices" ON "public"."invoices" FOR SELECT USING (("auth"."uid"() = "user_id"));
    DROP POLICY IF EXISTS "Allow public read access to settings" ON "public"."system_settings";
    CREATE POLICY "Allow public read access to settings" ON "public"."system_settings" FOR SELECT USING (true);

    -- Políticas de Segurança para o Administrador (Acesso Total)
    -- O ID do administrador está fixado no componente de login.
    CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
    BEGIN
      RETURN auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    DROP POLICY IF EXISTS "Allow admin full access to profiles" ON "public"."profiles";
    CREATE POLICY "Allow admin full access to profiles" ON "public"."profiles" FOR ALL USING (is_admin());
    
    DROP POLICY IF EXISTS "Allow admin full access to invoices" ON "public"."invoices";
    CREATE POLICY "Allow admin full access to invoices" ON "public"."invoices" FOR ALL USING (is_admin());
    
    DROP POLICY IF EXISTS "Allow admin full access to products" ON "public"."products";
    CREATE POLICY "Allow admin full access to products" ON "public"."products" FOR ALL USING (is_admin());

    DROP POLICY IF EXISTS "Allow admin full access to action logs" ON "public"."action_logs";
    CREATE POLICY "Allow admin full access to action logs" ON "public"."action_logs" FOR ALL USING (is_admin());

    DROP POLICY IF EXISTS "Allow admin full access to settings" ON "public"."system_settings";
    CREATE POLICY "Allow admin full access to settings" ON "public"."system_settings" FOR ALL USING (is_admin());

    -- Função para criar perfil ao registrar novo usuário
    CREATE OR REPLACE FUNCTION public.handle_new_user_creation(user_id uuid, user_email text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO public.profiles (id, email)
      VALUES (user_id, user_email);
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

        await logAction(supabase, 'DATABASE_SETUP', 'SUCCESS', 'Database tables and policies configured via developer panel.');
        res.status(200).json({ message: "Banco de dados configurado com sucesso! Tabelas e políticas de segurança foram aplicadas." });
    } catch (error: any) {
        await logAction(supabase, 'DATABASE_SETUP', 'FAILURE', 'Failed to configure database.', { error: error.message });
        res.status(500).json({ error: 'Falha ao configurar o banco de dados.', message: error.message });
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
            await supabase.auth.admin.deleteUser(user.id);
            throw new Error(`Supabase Profile Error: ${profileError.message}`);
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
        if (req.method === 'POST') {
            const { image_base64, ...productData } = req.body;
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
                if (uploadError) throw new Error(`Supabase Storage Error: ${uploadError.message}`);

                const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
                imageUrl = publicUrlData.publicUrl;
            }

            const { error } = await supabase.from('products').insert([{ ...productData, image_url: imageUrl }]);
            if (error) throw error;

            await logAction(supabase, 'PRODUCT_CREATED', 'SUCCESS', `Produto '${productData.name}' foi criado.`);
            
            return res.status(201).json({ message: "Product created." });
        }
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    } catch (error: any) {
        if (req.method === 'POST') {
            await logAction(supabase, 'PRODUCT_CREATED', 'FAILURE', 'Falha ao criar produto.', { error: error.message, productData: req.body });
        }
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
        
        // O totalAmount já deve incluir juros calculados no frontend, mas para segurança
        // poderíamos recalcular aqui. Para flexibilidade, confiamos no valor enviado por enquanto.
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