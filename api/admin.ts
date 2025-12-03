import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, Payment } from 'mercadopago';
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
            tradeInValue
        } = req.body;

        if (!userId || !totalAmount) return res.status(400).json({ error: "Dados incompletos." });

        // 1. Processar Coins (Se houver uso)
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (profile && profile.coins_balance >= coinsUsed) {
                await supabase.from('profiles').update({ coins_balance: profile.coins_balance - coinsUsed }).eq('id', userId);
                await logAction(supabase, 'COIN_USAGE', 'SUCCESS', `Usou ${coinsUsed} coins na compra de ${productName}`, { userId });
            } else {
                return res.status(400).json({ error: "Saldo de coins insuficiente." });
            }
        }

        // 2. Criar registro do Contrato/Venda
        const { data: contract, error: contractError } = await supabase.from('contracts').insert({
            user_id: userId,
            title: `Compra: ${productName}`,
            items: `${productName} (Vendedor: ${sellerName || 'Sistema'})`,
            total_value: totalAmount,
            installments: installments,
            status: saleType === 'crediario' ? 'Ativo' : 'Ativo', // Venda direta já nasce ativa
            terms_accepted: true
        }).select().single();

        if (contractError) throw contractError;

        const invoicesToCreate = [];
        const today = new Date();

        // 3. Gerar Fatura de Entrada (se houver valor em dinheiro/pix)
        if (downPayment > 0) {
            invoicesToCreate.push({
                user_id: userId,
                month: `Entrada - ${productName}`,
                due_date: today.toISOString().split('T')[0],
                amount: downPayment,
                status: 'Paga', // Entrada no caixa é paga na hora
                payment_method: 'dinheiro_ou_pix_presencial',
                payment_date: today.toISOString(),
                notes: `Entrada da compra ${contract.id}`
            });
        }

        // 4. Gerar Parcelas (Se for crediário)
        if (saleType === 'crediario' && installments > 0) {
            const installmentValue = totalAmount / installments; // Total financiado / parcelas
            
            for (let i = 1; i <= installments; i++) {
                // Calcular data de vencimento
                const dueDate = new Date();
                dueDate.setDate(dueDay || 10); // Dia fixo ou 10
                dueDate.setMonth(today.getMonth() + i); // Próximos meses
                
                // Ajuste de ano se virar
                if (dueDate.getMonth() !== (today.getMonth() + i) % 12) {
                    // Caso pule mês (ex: 31 jan -> 28 fev), ajusta para o último dia
                    dueDate.setDate(0); 
                }

                const monthName = dueDate.toLocaleString('pt-BR', { month: 'long' });
                const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

                invoicesToCreate.push({
                    user_id: userId,
                    month: `Parcela ${i}/${installments} - ${monthCapitalized}`,
                    due_date: dueDate.toISOString().split('T')[0],
                    amount: installmentValue,
                    status: 'Em aberto',
                    notes: `Parcela referente a ${productName}`
                });
            }
        } 
        // 5. Se for Venda Direta total (sem entrada separada, tudo pago)
        else if (saleType === 'direct' && downPayment >= totalAmount) {
             // Já cobrido pela lógica de Entrada acima se downPayment == totalAmount.
             // Se downPayment for 0 e totalAmount > 0 (ex: pagou tudo com coins?), criar invoice zerada ou paga.
             if (downPayment === 0) {
                 invoicesToCreate.push({
                    user_id: userId,
                    month: `Compra à Vista - ${productName}`,
                    due_date: today.toISOString().split('T')[0],
                    amount: totalAmount, // Valor original
                    status: 'Paga',
                    payment_method: 'coins_ou_total',
                    payment_date: today.toISOString(),
                    notes: 'Pago integralmente (Coins/Outros)'
                });
             }
        }

        if (invoicesToCreate.length > 0) {
            const { error: invError } = await supabase.from('invoices').insert(invoicesToCreate);
            if (invError) throw invError;
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada para ${userId}: ${productName}`, { contractId: contract.id });

        return res.status(200).json({ success: true, message: "Venda realizada com sucesso!", status: 'Concluído' });

    } catch (e: any) {
        console.error("Erro venda:", e);
        return res.status(500).json({ error: e.message });
    }
}

async function handleManageCoins(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { userId, amount, description, type } = req.body; // type: 'credit' or 'debit'

    try {
        if (!userId || !amount) throw new Error("Dados inválidos.");

        // Busca saldo atual
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
        
        // Loga a transação
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

        const prompt = `
            Crie uma enquete interessante para usuários de um aplicativo de loja de celulares e pagamentos (Relp Cell).
            Tópico: ${topic || 'Geral (Melhorias, Produtos ou Feedback)'}
            
            Retorne APENAS um JSON no seguinte formato:
            {
                "question": "A pergunta da enquete aqui?",
                "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"]
            }
            A pergunta deve ser curta e engajadora. Gere entre 2 a 4 opções.
        `;

        const response = await generateContentWithRetry(genAI, {
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        const text = response.text;
        if (!text) throw new Error("IA não retornou resposta.");
        
        const pollData = JSON.parse(text.trim());
        return res.status(200).json(pollData);

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleUploadPwaIcon(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { type, imageBase64 } = req.body;
        if (!type || !imageBase64) {
            return res.status(400).json({ error: 'Tipo e imagem são obrigatórios.' });
        }
        const validTypes = ['pwa_icon_192', 'pwa_icon_512', 'pwa_icon_192_maskable', 'pwa_icon_512_maskable'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Tipo de ícone inválido.' });
        }
        const { error } = await supabase.from('system_settings').upsert({
            key: type,
            value: imageBase64
        });
        if (error) throw error;
        await logAction(supabase, 'PWA_ICON_UPDATE', 'SUCCESS', `Ícone PWA ${type} atualizado.`);
        return res.status(200).json({ message: 'Ícone atualizado com sucesso.' });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleManageLimitRequest(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const genAI = getGeminiClient();
    try {
        const { requestId, action, manualLimit, manualScore, responseReason } = req.body;
        if (!requestId && action !== 'calculate_auto') return res.status(400).json({ error: "ID da solicitação obrigatório." });
        let request: any = null;
        if (requestId) {
            const { data } = await supabase.from('limit_requests').select('*').eq('id', requestId).single();
            request = data;
        }
        if (action === 'reject') {
            await supabase.from('limit_requests').update({ 
                status: 'rejected',
                admin_response_reason: responseReason
            }).eq('id', requestId);
            return res.status(200).json({ message: "Rejeitado." });
        }
        if (action === 'approve_manual') {
            await supabase.from('profiles').update({ credit_limit: manualLimit, credit_score: manualScore }).eq('id', request.user_id);
            await supabase.from('limit_requests').update({ status: 'approved', admin_response_reason: responseReason }).eq('id', requestId);
            return res.status(200).json({ message: "Aprovado." });
        } 
        if (action === 'calculate_auto') {
             const userId = request ? request.user_id : req.body.userId;
             const updatedAnalysis = await runCreditAnalysis(supabase, genAI, userId, true);
             return res.status(200).json({ 
                 suggestedLimit: updatedAnalysis.credit_limit, 
                 suggestedScore: updatedAnalysis.credit_score,
                 reason: updatedAnalysis.reason
             });
        }
        return res.status(400).json({ error: "Ação inválida" });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const FULL_SETUP_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions"; 

ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "coins_balance" integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS "public"."polls" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "question" "text" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."polls" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view polls" ON "public"."polls";
CREATE POLICY "Public view polls" ON "public"."polls" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manage polls" ON "public"."polls";
CREATE POLICY "Admin manage polls" ON "public"."polls" FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS "public"."poll_options" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "poll_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "votes" integer DEFAULT 0,
    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE
);
ALTER TABLE "public"."poll_options" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view poll options" ON "public"."poll_options";
CREATE POLICY "Public view poll options" ON "public"."poll_options" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manage poll options" ON "public"."poll_options";
CREATE POLICY "Admin manage poll options" ON "public"."poll_options" FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS "public"."poll_votes" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "poll_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
);
ALTER TABLE "public"."poll_votes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users vote once" ON "public"."poll_votes";
CREATE POLICY "Users vote once" ON "public"."poll_votes" FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own votes" ON "public"."poll_votes";
CREATE POLICY "Users view own votes" ON "public"."poll_votes" FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS "public"."app_changelog" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "version" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "date" timestamp with time zone DEFAULT "now"(),
    "type" "text",
    "is_public" boolean DEFAULT true,
    CONSTRAINT "app_changelog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."app_changelog" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true;
ALTER TABLE "public"."app_changelog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read changelog" ON "public"."app_changelog";
CREATE POLICY "Public read changelog" ON "public"."app_changelog" FOR SELECT USING (is_public = true OR auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admin manage changelog" ON "public"."app_changelog";
CREATE POLICY "Admin manage changelog" ON "public"."app_changelog" FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS "public"."profiles" ( "id" "uuid" NOT NULL, "email" "text", "first_name" "text", "last_name" "text", "identification_number" "text", "phone" "text", "credit_score" integer DEFAULT 0, "credit_limit" numeric(10, 2) DEFAULT 0, "credit_status" "text" DEFAULT 'Em Análise', "last_limit_request_date" timestamp with time zone, "avatar_url" "text", "zip_code" "text", "street_name" "text", "street_number" "text", "neighborhood" "text", "city" "text", "federal_unit" "text", "preferred_due_day" integer DEFAULT 10, "internal_notes" "text", "salary" numeric(10, 2) DEFAULT 0, "referral_code" "text", "coins_balance" integer DEFAULT 0, "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"), CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE, CONSTRAINT "profiles_email_key" UNIQUE ("email"), CONSTRAINT "profiles_referral_code_key" UNIQUE ("referral_code") ); 
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "coins_balance" integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS "public"."system_settings" ( "key" "text" NOT NULL, "value" "text", CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key") );
ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read settings" ON "public"."system_settings";
CREATE POLICY "Public read settings" ON "public"."system_settings" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manage settings" ON "public"."system_settings";
CREATE POLICY "Admin manage settings" ON "public"."system_settings" FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS "public"."limit_requests" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "requested_amount" numeric(10, 2), "current_limit" numeric(10, 2), "justification" "text", "status" "text" DEFAULT 'pending', "admin_response_reason" "text", "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "limit_requests_pkey" PRIMARY KEY ("id"), CONSTRAINT "limit_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); 
ALTER TABLE "public"."limit_requests" ADD COLUMN IF NOT EXISTS "admin_response_reason" "text"; 
ALTER TABLE "public"."limit_requests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."limit_requests" ENABLE ROW LEVEL SECURITY; 
DROP POLICY IF EXISTS "Users view own limit requests" ON "public"."limit_requests";
DROP POLICY IF EXISTS "Users create own limit requests" ON "public"."limit_requests";
CREATE POLICY "Users view own limit requests" ON "public"."limit_requests" FOR SELECT USING (auth.uid() = user_id); 
CREATE POLICY "Users create own limit requests" ON "public"."limit_requests" FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS "public"."contracts" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "items" "text",
    "total_value" numeric(10, 2),
    "installments" integer,
    "status" "text" DEFAULT 'pending_signature',
    "signature_data" "text",
    "terms_accepted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);
ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own contracts" ON "public"."contracts";
DROP POLICY IF EXISTS "Users update own contracts" ON "public"."contracts";
CREATE POLICY "Users view own contracts" ON "public"."contracts" FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own contracts" ON "public"."contracts" FOR UPDATE USING (auth.uid() = user_id);

INSERT INTO "public"."app_changelog" (version, title, description, type, is_public, date)
SELECT 'v2.4', 'Relp Coins e Cashback', 'Agora você ganha coins em todas as compras e pagamentos! Use para abater valores.', 'feature', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "public"."app_changelog" WHERE title = 'Relp Coins e Cashback');
    `;
    const { error } = await supabase.rpc('execute_admin_sql', { sql_query: FULL_SETUP_SQL });
    if (error) throw error;
    await logAction(supabase, 'DATABASE_SETUP', 'SUCCESS', 'Database RLS policies updated with Coins system.');
    res.status(200).json({ message: "Banco de dados e Coins atualizados com sucesso!" });
}

// --- TEST HANDLERS ---

async function handleTestSupabase(_req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.from('system_settings').select('key').limit(1);
        if (error) throw error;
        return res.status(200).json({ message: "Conexão com Supabase estabelecida com sucesso! Leitura OK." });
    } catch (e: any) {
        return res.status(500).json({ error: `Falha na conexão Supabase: ${e.message}` });
    }
}

async function handleTestGemini(_req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Responda apenas com a palavra "OK" se você estiver funcionando.',
        });
        if (!response.text) throw new Error("Sem resposta da IA.");
        return res.status(200).json({ message: `Gemini respondendo: ${response.text}` });
    } catch (e: any) {
        return res.status(500).json({ error: `Falha na conexão Gemini: ${e.message}` });
    }
}

async function handleTestMercadoPago(_req: VercelRequest, res: VercelResponse) {
    try {
        const client = getMercadoPagoClient();
        const payment = new Payment(client);
        await payment.search({ options: { limit: 1, offset: 0 } });
        return res.status(200).json({ message: "Conexão com Mercado Pago validada (Access Token OK)." });
    } catch (e: any) {
        return res.status(500).json({ error: `Falha Mercado Pago: ${e.message || 'Verifique o Access Token'}` });
    }
}

async function handleTestMercadoLivre(_req: VercelRequest, res: VercelResponse) {
    try {
        const clientId = process.env.ML_CLIENT_ID;
        const clientSecret = process.env.ML_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            throw new Error("Credenciais ML_CLIENT_ID ou ML_CLIENT_SECRET não encontradas.");
        }
        const response = await fetch("https://api.mercadolibre.com/oauth/token", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret
            }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Erro API ML: ${err.message || err.error}`);
        }
        return res.status(200).json({ message: "Credenciais do Mercado Livre validadas com sucesso." });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

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