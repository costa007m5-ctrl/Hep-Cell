
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, MerchantOrder } from 'mercadopago';
import { URL } from 'url';

// --- Helper Functions (maintain existing) ---
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
        await supabase.from('action_logs').insert({ action_type, status, description, details });
    } catch (e) {
        console.error(`Failed to log action: ${action_type}`, e);
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
                console.warn(`AI Request failed (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                throw error;
            }
        }
    }
    throw new Error("Max retries exceeded");
}

// --- CRITICAL UPDATE: Enhanced AI Analysis with Document Verification ---
async function runCreditAnalysis(supabase: SupabaseClient, genAI: GoogleGenAI | null, userId: string, useStrictRules: boolean = true) {
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileError) throw profileError;
    
    const { data: invoices, error: invoicesError } = await supabase.from('invoices').select('status, amount, due_date, payment_date').eq('user_id', userId);
    if (invoicesError) throw invoicesError;

    // Fetch latest document
    const { data: docs } = await supabase.from('client_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
    const latestDoc = docs && docs.length > 0 ? docs[0] : null;

    // Calculate History Metrics
    const paidInvoices = invoices?.filter(i => i.status === 'Paga') || [];
    const totalPaid = paidInvoices.reduce((acc, curr) => acc + curr.amount, 0);
    const onTimeCount = paidInvoices.filter(i => i.payment_date && new Date(i.payment_date) <= new Date(i.due_date)).length;
    const isNewCustomer = paidInvoices.length === 0;
    const highestPayment = paidInvoices.length > 0 ? Math.max(...paidInvoices.map(i => i.amount)) : 0;

    let suggestedLimit = 0;
    let suggestedScore = 0;
    let analysisReason = '';
    let documentAnalysis = 'Nenhum documento encontrado.';

    if (!genAI) {
        // Fallback logic without AI
        suggestedLimit = (profile.credit_limit || 200) * 1.1;
        suggestedScore = Math.min(1000, (profile.credit_score || 500) + 50);
        analysisReason = 'Aumento automático baseado apenas no histórico (IA indisponível).';
    } else {
        // Prepare prompt for Gemini
        let prompt = `
            Atue como um analista de crédito sênior para a loja "Relp Cell".
            
            DADOS DO CLIENTE:
            - Salário Declarado: R$ ${profile.salary || 0}
            - Limite Atual: R$ ${profile.credit_limit}
            - Score Atual: ${profile.credit_score}
            
            HISTÓRICO FINANCEIRO NA LOJA (CRUCIAL):
            - Cliente Novo? ${isNewCustomer ? 'SIM (Sem faturas pagas)' : 'NÃO (Já possui histórico)'}
            - Total Já Pago em Compras: R$ ${totalPaid.toFixed(2)}
            - Quantidade de Faturas Pagas em Dia: ${onTimeCount}
            - Maior Fatura Paga: R$ ${highestPayment.toFixed(2)}
        `;

        let parts: any[] = [];

        // Check document using Gemini Vision if available
        if (latestDoc && latestDoc.file_url) {
            // Check if it's an image base64
            const match = latestDoc.file_url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
            if (match) {
                const mimeType = match[1];
                const base64Data = match[2];

                // Lista de formatos suportados pelo Gemini Vision (Evita erro de AVIF)
                const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

                if (supportedMimeTypes.includes(mimeType)) {
                    parts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    });
                    prompt += `
                    
                    TAREFA DE VISÃO COMPUTACIONAL:
                    Analise a imagem anexada. 
                    1. Verifique se é um documento financeiro válido (Holerite, Extrato Bancário, Decore).
                    2. Se for inválido (foto de pessoa, animal, paisagem, ou documento ilegível), considere "document_valid": false.
                    3. Se for válido, extraia a renda líquida aproximada.
                    `;
                } else {
                    documentAnalysis = `Formato de arquivo (${mimeType}) não suportado para leitura visual pela IA. Análise baseada apenas em dados.`;
                    prompt += `\nOBS: Um documento foi anexado, mas o formato (${mimeType}) não é compatível com a visão computacional atual. Ignore a análise visual do comprovante e baseie-se nos dados declarados e histórico.`;
                }
            } else {
                documentAnalysis = "Formato de documento não suportado para análise visual automática (provavelmente PDF ou link).";
                prompt += `\nOBS: Documento em formato não suportado (PDF ou Link). Baseie-se nos dados declarados.`;
            }
        } else {
            prompt += `\nNenhum documento de comprovação de renda foi anexado recentemente.`;
        }

        prompt += `
            
            REGRAS DE DECISÃO ESTRITAS (SIGA RIGOROSAMENTE):

            CENÁRIO 1: CLIENTE NOVO (Sem histórico de pagamentos pagos na Relp Cell)
            - Se NÃO tiver comprovante de renda válido (ou nenhum documento): 
              -> O limite DEVE ser travado em R$ 100,00 (Risco Alto).
              -> Motivo: "Limite inicial padrão para novos clientes sem histórico comprovado. Realize sua primeira compra para desbloquear aumentos."
            - Se TIVER comprovante válido (Holerite/Extrato): 
              -> Sugira 25% da renda comprovada.

            CENÁRIO 2: CLIENTE RECORRENTE (Já pagou faturas anteriormente)
            - O Comprovante de Renda é OPCIONAL. O histórico de bom pagador tem peso maior.
            - Se o cliente paga em dia e tem bom histórico:
              -> Sugira AUMENTO de limite (confiança adquirida).
              -> Base de cálculo: 150% da maior fatura já paga ou 40% da renda estimada.
              -> Motivo: "Aumento aprovado devido ao excelente histórico de pagamentos na Relp Cell."
            - Se tiver atrasos recentes: Mantenha o limite atual ou sugira redução.

            RETORNO JSON OBRIGATÓRIO:
            {
                "credit_score": (inteiro 0-1000),
                "credit_limit": (valor numérico, float),
                "reason": "Texto curto e direto para o cliente ler na notificação.",
                "document_valid": boolean (true/false),
                "document_analysis": "Breve descrição técnica para o admin"
            }
        `;

        parts.push({ text: prompt });

        // Use gemini-2.5-flash for multimodal capabilities
        const response = await generateContentWithRetry(genAI, { 
            model: 'gemini-2.5-flash', 
            contents: { parts }, 
            config: { responseMimeType: 'application/json' } 
        });
        
        const analysis = JSON.parse(response.text || '{}');
        suggestedLimit = analysis.credit_limit || profile.credit_limit;
        suggestedScore = analysis.credit_score || profile.credit_score;
        analysisReason = analysis.reason || "Análise concluída.";
        documentAnalysis = analysis.document_analysis || documentAnalysis;
        
        // Safety Check (Backup Logic if AI hallucinates)
        if (isNewCustomer && (analysis.document_valid === false || !latestDoc)) {
             // Force low limit for new customers without valid docs
             if (suggestedLimit > 150) {
                 suggestedLimit = 100;
                 analysisReason = "Limite inicial de R$ 100,00 aprovado. Realize compras e pague em dia para liberar aumentos automáticos.";
             }
        }
    }

    return {
        credit_limit: suggestedLimit,
        credit_score: suggestedScore,
        reason: analysisReason,
        document_analysis: documentAnalysis,
        profile
    };
}

async function updateProfileCredit(supabase: SupabaseClient, userId: string, limit: number, score: number, status: string, reason: string) {
    const { data: profile } = await supabase.from('profiles').select('credit_score, credit_limit').eq('id', userId).single();
    
    const { error: updateError } = await supabase.from('profiles')
        .update({ 
            credit_score: score, 
            credit_limit: limit, 
            credit_status: status 
        })
        .eq('id', userId);

    if (updateError) throw updateError;
    
    if (profile && (profile.credit_limit !== limit || profile.credit_score !== score)) {
        await supabase.from('score_history').insert({
            user_id: userId,
            change: score - (profile.credit_score || 0),
            new_score: score,
            reason: reason || 'Atualização de crédito'
        });
    }
}

async function handleLimitRequestActions(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const genAI = getGeminiClient();

    try {
        const { requestId, action, manualLimit, manualScore, responseReason } = req.body; 

        if (!requestId || !action) return res.status(400).json({ error: "ID da solicitação e ação obrigatórios." });

        const { data: request, error: reqError } = await supabase.from('limit_requests').select('*').eq('id', requestId).single();
        if (reqError || !request) return res.status(404).json({ error: "Solicitação não encontrada." });

        let newLimit = request.current_limit;
        let statusMsg = '';
        let reasonToSave = responseReason || '';

        if (action === 'reject') {
            await supabase.from('limit_requests').update({ 
                status: 'rejected',
                admin_response_reason: reasonToSave,
                updated_at: new Date().toISOString()
            }).eq('id', requestId);
            
            await supabase.from('notifications').insert({
                user_id: request.user_id,
                title: 'Solicitação de Limite',
                message: 'Sua solicitação foi analisada. Toque para ver o resultado.',
                type: 'info'
            });
            return res.status(200).json({ message: "Solicitação rejeitada." });
        }

        if (action === 'calculate_auto') {
             const analysis = await runCreditAnalysis(supabase, genAI, request.user_id, true);
             return res.status(200).json({ 
                 suggestedLimit: analysis.credit_limit, 
                 suggestedScore: analysis.credit_score,
                 reason: analysis.reason,
                 documentAnalysis: analysis.document_analysis
             });
        }

        if (action === 'approve_manual') {
            if (manualLimit === undefined) return res.status(400).json({ error: "Valor manual obrigatório." });
            newLimit = manualLimit;
            const newScore = manualScore || 600;
            
            await updateProfileCredit(supabase, request.user_id, newLimit, newScore, 'Ativo', `Aprovado: ${reasonToSave}`);
            statusMsg = 'Aprovado manualmente.';
        } 
        
        // Atualiza a solicitação com o status e o motivo FINAL
        await supabase.from('limit_requests').update({ 
            status: 'approved',
            admin_response_reason: reasonToSave, // Salva o motivo no histórico
            updated_at: new Date().toISOString()
        }).eq('id', requestId);

        // Envia notificação para o cliente
        await supabase.from('notifications').insert({
            user_id: request.user_id,
            title: 'Limite Aprovado! 🎉',
            message: `Sua solicitação foi aprovada! Seu novo limite é R$ ${newLimit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.`,
            type: 'success',
            read: false
        });

        return res.status(200).json({ message: statusMsg, newLimit });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// --- Updated Handle for Get Limit Requests ---
async function handleGetLimitRequests(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        // Usa select 'profiles(*)' para evitar erros caso colunas específicas (ex: salary) não existam no schema
        const { data, error } = await supabase
            .from('limit_requests')
            .select('*, profiles(*)') 
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        res.status(200).json(data);
    } catch (e: any) {
        console.error("Error fetching limit requests:", e);
        res.status(500).json({ error: e.message });
    }
}

// --- Updated Handle for Database Setup (Fixing Permissions) ---
async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    // O Script SQL abaixo é idempotente (IF NOT EXISTS) e corrige as permissões
    const FULL_SETUP_SQL = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions"; 
    
    -- Tabela de Perfis
    CREATE TABLE IF NOT EXISTS "public"."profiles" ( "id" "uuid" NOT NULL, "email" "text", "first_name" "text", "last_name" "text", "identification_number" "text", "phone" "text", "credit_score" integer DEFAULT 0, "credit_limit" numeric(10, 2) DEFAULT 0, "credit_status" "text" DEFAULT 'Em Análise', "last_limit_request_date" timestamp with time zone, "avatar_url" "text", "zip_code" "text", "street_name" "text", "street_number" "text", "neighborhood" "text", "city" "text", "federal_unit" "text", "preferred_due_day" integer DEFAULT 10, "internal_notes" "text", "salary" numeric(10, 2) DEFAULT 0, "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"), CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE, CONSTRAINT "profiles_email_key" UNIQUE ("email") ); 
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "internal_notes" "text"; 
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "salary" numeric(10, 2) DEFAULT 0; 
    
    -- Tabela de Documentos
    CREATE TABLE IF NOT EXISTS "public"."client_documents" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "title" "text", "document_type" "text", "file_url" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id"), CONSTRAINT "client_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); 
    ALTER TABLE "public"."client_documents" ENABLE ROW LEVEL SECURITY; 
    DROP POLICY IF EXISTS "Users view own documents" ON "public"."client_documents";
    CREATE POLICY "Users view own documents" ON "public"."client_documents" FOR SELECT USING (auth.uid() = user_id); 
    
    -- Tabela de Solicitações de Limite
    CREATE TABLE IF NOT EXISTS "public"."limit_requests" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "requested_amount" numeric(10, 2), "current_limit" numeric(10, 2), "justification" "text", "status" "text" DEFAULT 'pending', "admin_response_reason" "text", "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "limit_requests_pkey" PRIMARY KEY ("id"), CONSTRAINT "limit_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); 
    ALTER TABLE "public"."limit_requests" ADD COLUMN IF NOT EXISTS "admin_response_reason" "text"; 
    ALTER TABLE "public"."limit_requests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();
    ALTER TABLE "public"."limit_requests" ENABLE ROW LEVEL SECURITY; 
    
    -- Policies para Limit Requests
    DROP POLICY IF EXISTS "Users view own limit requests" ON "public"."limit_requests";
    DROP POLICY IF EXISTS "Users create own limit requests" ON "public"."limit_requests";
    CREATE POLICY "Users view own limit requests" ON "public"."limit_requests" FOR SELECT USING (auth.uid() = user_id); 
    CREATE POLICY "Users create own limit requests" ON "public"."limit_requests" FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Tabela de Contratos (Essencial para Assinatura)
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

    -- Policies CRÍTICAS para Contratos (Permitir Assinatura)
    DROP POLICY IF EXISTS "Users view own contracts" ON "public"."contracts";
    DROP POLICY IF EXISTS "Users update own contracts" ON "public"."contracts";
    
    CREATE POLICY "Users view own contracts" ON "public"."contracts" FOR SELECT USING (auth.uid() = user_id);
    -- Esta policy é o que conserta o erro de assinatura não salvar
    CREATE POLICY "Users update own contracts" ON "public"."contracts" FOR UPDATE USING (auth.uid() = user_id);
    `;
    
    const { error } = await supabase.rpc('execute_admin_sql', { sql_query: FULL_SETUP_SQL });
    if (error) {
        console.error("Database setup failed:", error);
        return res.status(500).json({ error: error.message });
    }
    
    await logAction(supabase, 'DATABASE_SETUP', 'SUCCESS', 'Database configured with new features and permissions.'); 
    res.status(200).json({ message: "Banco de dados atualizado com sucesso! Permissões corrigidas." }); 
}

// ... (Other handlers and default export maintained)
async function handleManageInvoice(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { const { invoiceId, invoiceIds, action } = req.body; if ((!invoiceId && !invoiceIds) || !action) return res.status(400).json({ error: "ID(s) da fatura e ação são obrigatórios." }); const ids = invoiceIds || [invoiceId]; if (action === 'pay') { await supabase.from('invoices').update({ status: 'Paga', payment_date: new Date().toISOString() }).in('id', ids); await logAction(supabase, 'MANUAL_PAYMENT', 'SUCCESS', `${ids.length} fatura(s) marcada(s) como paga(s) manualmente.`); if(ids.length > 0) { const { data: inv } = await supabase.from('invoices').select('user_id').eq('id', ids[0]).single(); if(inv) { const genAI = getGeminiClient(); const analysis = await runCreditAnalysis(supabase, genAI, inv.user_id, false); await updateProfileCredit(supabase, inv.user_id, analysis.credit_limit, analysis.credit_score, analysis.profile.credit_status === 'Bloqueado' ? 'Bloqueado' : 'Ativo', analysis.reason); } } } else if (action === 'cancel') { await supabase.from('invoices').update({ status: 'Cancelado', notes: 'Cancelado manualmente pelo admin.' }).in('id', ids); await logAction(supabase, 'MANUAL_CANCEL', 'SUCCESS', `${ids.length} fatura(s) cancelada(s) manualmente.`); } else if (action === 'delete') { await supabase.from('invoices').delete().in('id', ids); await logAction(supabase, 'MANUAL_DELETE', 'SUCCESS', `${ids.length} fatura(s) excluída(s) permanentemente.`); } else { return res.status(400).json({ error: "Ação inválida." }); } return res.status(200).json({ message: "Ação realizada com sucesso." }); } catch (e: any) { return res.status(500).json({ error: e.message }); } }
async function handleUpdateLimit(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { const { userId, creditLimit, creditScore } = req.body; if (!userId) return res.status(400).json({ error: "User ID obrigatório." }); const updates: any = {}; if (creditLimit !== undefined) updates.credit_limit = creditLimit; if (creditScore !== undefined) updates.credit_score = creditScore; const { error } = await supabase.from('profiles').update(updates).eq('id', userId); if (error) throw error; await supabase.from('score_history').insert({ user_id: userId, change: 0, new_score: creditScore || 0, reason: 'Ajuste manual pelo administrador' }); await logAction(supabase, 'MANUAL_LIMIT_UPDATE', 'SUCCESS', `Limite/Score atualizado manualmente para user ${userId}.`); return res.status(200).json({ message: "Perfil atualizado com sucesso." }); } catch (e: any) { return res.status(500).json({ error: e.message }); } }
async function handleRiskDetails(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const genAI = getGeminiClient(); if (!genAI) return res.status(500).json({ error: "IA não configurada." }); try { const { userId } = req.body; const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single(); const { data: invoices } = await supabase.from('invoices').select('*').eq('user_id', userId); const { data: history } = await supabase.from('score_history').select('*').eq('user_id', userId).limit(10); const prompt = `Analise detalhadamente o risco deste cliente para um sistema de crediário de loja de celulares. Perfil: ${JSON.stringify(profile)} Faturas: ${JSON.stringify(invoices)} Histórico Score: ${JSON.stringify(history)} Retorne um relatório em formato JSON com: { "riskLevel": "Baixo" | "Médio" | "Alto", "reason": "Resumo curto do motivo principal", "detailedAnalysis": "Explicação detalhada de 3-4 linhas sobre o comportamento de pagamento e capacidade financeira.", "recommendation": "Sugestão para o lojista (ex: Aumentar limite, Bloquear compras, Pedir fiador).", "positivePoints": ["ponto 1", "ponto 2"], "negativePoints": ["ponto 1", "ponto 2"] }`; const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } }); res.status(200).json(JSON.parse(response.text || '{}')); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleClientDocuments(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if (req.method === 'GET') { const { userId } = req.query; const { data: contracts } = await supabase.from('contracts').select('*').eq('user_id', userId); const { data: uploads } = await supabase.from('client_documents').select('*').eq('user_id', userId); res.status(200).json({ contracts: contracts || [], uploads: uploads || [] }); } else if (req.method === 'POST') { const { userId, title, type, fileBase64 } = req.body; const { data, error } = await supabase.from('client_documents').insert({ user_id: userId, title, document_type: type, file_url: fileBase64 }).select(); if (error) throw error; res.status(201).json(data[0]); } } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleManageInternalNotes(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { const { userId, notes } = req.body; const { error } = await supabase.from('profiles').update({ internal_notes: notes }).eq('id', userId); if (error) throw error; res.status(200).json({ message: "Notas atualizadas." }); } catch (e: any) { res.status(500).json({ error: e.message }); } }

// --- Helper para gerar contrato robusto ---
function generateRobustContractText(profile: any, productName: string, totalAmount: number, installments: number, downPayment: number, installmentValue: number, dueDay: number) {
    const today = new Date();
    const companyName = "RELP CELL ELETRÔNICOS LTDA";
    const companyCNPJ = "43.735.304/0001-00";
    const companyAddress = "Avenida Principal, 123, Centro, Macapá - AP";

    let installmentList = "";
    let currentMonth = today.getMonth() + 1;
    let currentYear = today.getFullYear();

    for (let i = 1; i <= installments; i++) {
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        const maxDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        const day = Math.min(dueDay, maxDay);
        const dueDate = new Date(currentYear, currentMonth, day);
        installmentList += `${i}ª Parcela: R$ ${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} - Vencimento: ${dueDate.toLocaleDateString('pt-BR')}\n`;
        currentMonth++;
    }

    return `
CONTRATO DE CONFISSÃO DE DÍVIDA E COMPRA E VENDA COM RESERVA DE DOMÍNIO

Pelo presente instrumento particular, de um lado a empresa:
CREDOR: ${companyName}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${companyCNPJ}, com sede em ${companyAddress}.

E de outro lado o(a) cliente:
DEVEDOR(A): ${profile.first_name} ${profile.last_name}, inscrito(a) no CPF sob o nº ${profile.identification_number || 'N/A'}, residente e domiciliado(a) no endereço cadastrado neste aplicativo.

As partes acima qualificadas têm, entre si, justo e contratado o seguinte:

CLÁUSULA PRIMEIRA - DO OBJETO
1.1. O presente contrato tem por objeto a compra e venda do produto/serviço: "${productName}", adquirido pelo DEVEDOR junto ao CREDOR.

CLÁUSULA SEGUNDA - DO PREÇO E FORMA DE PAGAMENTO
2.1. O preço total ajustado para a aquisição do produto é de R$ ${totalAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.
2.2. O pagamento será realizado da seguinte forma:
   a) Entrada de R$ ${downPayment.toLocaleString('pt-BR', {minimumFractionDigits: 2})}, paga no ato.
   b) O saldo restante será pago em ${installments} parcelas mensais e sucessivas de R$ ${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.

CLÁUSULA TERCEIRA - DO VENCIMENTO E DAS PARCELAS
3.1. As parcelas terão os seguintes vencimentos e valores:
${installmentList}

CLÁUSULA QUARTA - DA MORA E INADIMPLEMENTO
4.1. O não pagamento de qualquer parcela na data de seu vencimento sujeitará o DEVEDOR ao pagamento de multa de 2% (dois por cento) sobre o valor do débito e juros moratórios de 1% (um por cento) ao mês, conforme artigo 52, § 1º do Código de Defesa do Consumidor.
4.2. O atraso superior a 30 (trinta) dias poderá ensejar a inclusão do nome do DEVEDOR nos órgãos de proteção ao crédito (SPC/SERASA), bem como o protesto do título e a cobrança judicial da dívida.

CLÁUSULA QUINTA - DA ANTECIPAÇÃO DE PAGAMENTO
5.1. É assegurado ao DEVEDOR o direito à liquidação antecipada do débito, total ou parcialmente, mediante redução proporcional dos juros e demais acréscimos, na forma do artigo 52, § 2º do Código de Defesa do Consumidor.

CLÁUSULA SEXTA - DA RESERVA DE DOMÍNIO
6.1. Em virtude da venda ser a prazo, o CREDOR reserva para si o domínio do bem alienado até a liquidação total da dívida, transferindo-se ao DEVEDOR apenas a posse direta, nos termos dos artigos 521 e seguintes do Código Civil Brasileiro.

CLÁUSULA SÉTIMA - DAS DISPOSIÇÕES GERAIS
7.1. O DEVEDOR declara ter conferido o produto no ato da entrega, recebendo-o em perfeitas condições de uso.
7.2. A assinatura digital aposta neste instrumento, realizada mediante senha pessoal e intransferível no aplicativo do CREDOR, é válida e eficaz para todos os fins legais, conforme Medida Provisória nº 2.200-2/2001.

CLÁUSULA OITAVA - DO FORO
8.1. As partes elegem o foro da Comarca de Macapá/AP para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

Macapá, ${today.toLocaleDateString('pt-BR')} às ${today.toLocaleTimeString('pt-BR')}.
    `.trim();
}

async function handleCreateSale(req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient(); 
    try { 
        const { userId, totalAmount, installments, productName, signature, saleType, paymentMethod, downPayment, tradeInValue, sellerName, dueDay } = req.body; 
        
        if (!userId || !totalAmount || !installments || !productName) { return res.status(400).json({ error: 'Missing required sale data.' }); } 
        
        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (profileError || !profile) throw new Error("Cliente não encontrado.");

        const installmentAmount = Math.round((totalAmount / installments) * 100) / 100; 
        const newInvoices = []; 
        const today = new Date(); 
        const purchaseTimestamp = new Date().toISOString(); 
        
        // --- CORREÇÃO DE LÓGICA DE STATUS ---
        const isSigned = !!signature;
        const initialStatus = saleType === 'crediario' && !isSigned ? 'Aguardando Assinatura' : 'Em aberto'; 
        const contractStatus = saleType === 'crediario' ? (isSigned ? 'Assinado' : 'pending_signature') : 'Ativo'; // Venda direta não gera pendência
        
        const selectedDay = dueDay || 10; 
        let currentMonth = today.getMonth() + 1; 
        let currentYear = today.getFullYear(); 
        
        // --- GERAÇÃO DA FATURA DE ENTRADA ---
        // Se houver entrada, cria uma fatura separada com vencimento IMEDIATO (hoje)
        const entryValue = Number(downPayment);
        if (saleType === 'crediario' && entryValue > 0) {
            newInvoices.push({
                user_id: userId,
                month: `Entrada - ${productName}`,
                due_date: today.toISOString().split('T')[0], // Vence HOJE
                amount: entryValue,
                status: 'Em aberto', // Fatura gerada para pagamento imediato
                notes: `ENTRADA: ${productName}. Pagamento obrigatório em 12h. Cancelamento automático caso não pago.`,
                created_at: purchaseTimestamp,
                payment_method: paymentMethod || null
            });
        }

        for (let i = 1; i <= installments; i++) { 
            if (currentMonth > 11) { currentMonth = 0; currentYear++; } 
            const maxDay = new Date(currentYear, currentMonth + 1, 0).getDate(); 
            const day = Math.min(selectedDay, maxDay); 
            const dueDate = new Date(currentYear, currentMonth, day); 
            const monthLabel = installments === 1 ? productName : `${productName} (${i}/${installments})`; 
            
            let notes = saleType === 'direct' ? `Compra direta via ${paymentMethod}.` : `Referente a compra de ${productName} parcelada em ${installments}x.`; 
            if (entryValue > 0) { 
                notes += ` (Entrada de R$ ${entryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} processada separadamente)`;
            } 
            if (tradeInValue && Number(tradeInValue) > 0) { notes += ` (Trade-In: R$ ${Number(tradeInValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`; } 
            if (sellerName) { notes += ` [Vendedor: ${sellerName}]`; } 
            
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
            currentMonth++; 
        } 
        
        const { error } = await supabase.from('invoices').insert(newInvoices); 
        if (error) throw error; 
        
        if (saleType === 'crediario') { 
            await supabase.from('profiles').update({ preferred_due_day: selectedDay }).eq('id', userId); 
            
            // Gera o texto robusto do contrato
            const contractItems = generateRobustContractText(profile, productName, totalAmount, installments, Number(downPayment||0) + Number(tradeInValue||0), installmentAmount, selectedDay);

            const { error: contractError } = await supabase.from('contracts').insert({ 
                user_id: userId, 
                title: `Contrato de Compra - ${productName}`, 
                items: contractItems, 
                total_value: totalAmount, 
                installments: installments, 
                status: contractStatus, 
                signature_data: signature || null, 
                terms_accepted: isSigned, // Se assinou, aceitou
                created_at: purchaseTimestamp 
            }); 
            
            if (contractError) console.error("Erro ao salvar contrato:", contractError); 
            
            if (!isSigned) {
                await supabase.from('notifications').insert({ user_id: userId, title: 'Aprovação Necessária', message: `Sua compra de ${productName} está aguardando sua assinatura digital no app.`, type: 'alert', read: false }); 
            }
        } 
        
        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada para o usuário ${userId}. Tipo: ${saleType || 'Crediário'}. Total: ${totalAmount}. Status: ${initialStatus}`); 
        res.status(201).json({ message: 'Venda registrada com sucesso.', status: initialStatus }); 
    } catch (error: any) { 
        await logAction(supabase, 'SALE_CREATED', 'FAILURE', 'Falha ao criar venda.', { error: error.message, body: req.body }); 
        res.status(500).json({ error: error.message }); 
    } 
}

async function handleNegotiateDebt(req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient(); 
    try { 
        const { userId, invoiceIds, totalAmount, installments, firstDueDate, notes } = req.body; 
        if (!userId || !invoiceIds || invoiceIds.length === 0 || !totalAmount || !installments) { return res.status(400).json({ error: "Dados incompletos para negociação." }); } 
        
        const { error: cancelError } = await supabase.from('invoices').update({ status: 'Cancelado', notes: 'Renegociado em ' + new Date().toLocaleDateString('pt-BR') }).in('id', invoiceIds).eq('user_id', userId); 
        if (cancelError) throw cancelError; 
        
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single(); 
        
        const dueDay = new Date(firstDueDate).getDate();
        const installmentVal = totalAmount / installments;
        const creationTime = new Date().toISOString(); 
        
        // Gera contrato robusto de confissão de dívida
        const contractItems = generateRobustContractText(profile, "RENEGOCIAÇÃO DE DÍVIDA", totalAmount, installments, 0, installmentVal, dueDay);
        
        const { error: contractError } = await supabase.from('contracts').insert({ 
            user_id: userId, 
            title: 'Termo de Confissão e Renegociação de Dívida', 
            items: contractItems, 
            total_value: totalAmount, 
            installments: installments, 
            status: 'pending_signature', 
            created_at: creationTime 
        }); 
        
        if (contractError) throw contractError; 
        
        const newInvoices = []; 
        let currentMonth = new Date(firstDueDate).getMonth(); 
        let currentYear = new Date(firstDueDate).getFullYear(); 
        
        for (let i = 1; i <= installments; i++) { 
            const dueDate = new Date(currentYear, currentMonth, dueDay); 
            newInvoices.push({ 
                user_id: userId, 
                month: `Acordo de Renegociação (${i}/${installments})`, 
                due_date: dueDate.toISOString().split('T')[0], 
                amount: installmentVal, 
                status: 'Aguardando Assinatura', 
                notes: `Refinanciamento de débitos anteriores. ${notes || ''}`, 
                created_at: creationTime 
            }); 
            currentMonth++; 
            if (currentMonth > 11) { currentMonth = 0; currentYear++; } 
        } 
        
        const { error: insertError } = await supabase.from('invoices').insert(newInvoices); 
        if (insertError) throw insertError; 
        
        await supabase.from('notifications').insert({ user_id: userId, title: 'Proposta de Acordo', message: 'Sua renegociação foi gerada. Acesse o app para assinar o termo e regularizar sua situação.', type: 'alert' }); 
        await logAction(supabase, 'DEBT_NEGOTIATION', 'SUCCESS', `Negociação criada para user ${userId}. Contrato pendente gerado.`); 
        return res.status(200).json({ message: "Proposta de negociação enviada para o cliente." }); 
    } catch (error: any) { 
        await logAction(supabase, 'DEBT_NEGOTIATION', 'FAILURE', 'Erro na negociação.', { error: error.message }); 
        return res.status(500).json({ error: error.message }); 
    } 
}

async function handleDueDateRequests(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); if (req.method === 'GET') { try { const { data, error } = await supabase.from('due_date_requests').select('*, profiles(first_name, last_name, email)').eq('status', 'pending').order('created_at', { ascending: false }); if (error) throw error; return res.status(200).json(data); } catch (e: any) { return res.status(500).json({ error: e.message }); } } if (req.method === 'PUT') { try { const { id, status, adminNotes } = req.body; if (!id || !status) return res.status(400).json({ error: "ID e Status são obrigatórios." }); const { data: request, error: reqError } = await supabase.from('due_date_requests').update({ status, admin_notes: adminNotes, updated_at: new Date().toISOString() }).eq('id', id).select().single(); if (reqError) throw reqError; if (status === 'approved' && request) { const newDay = request.requested_day; const userId = request.user_id; await supabase.from('profiles').update({ preferred_due_day: newDay }).eq('id', userId); const { data: invoices } = await supabase.from('invoices').select('*').eq('user_id', userId).or('status.eq.Em aberto,status.eq.Boleto Gerado'); if (invoices) { for (const inv of invoices) { const oldDate = new Date(inv.due_date); const year = oldDate.getFullYear(); const month = oldDate.getMonth(); const maxDay = new Date(year, month + 1, 0).getDate(); const safeDay = Math.min(newDay, maxDay); const newDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(safeDay).padStart(2,'0')}`; await supabase.from('invoices').update({ due_date: newDateStr, notes: (inv.notes || '') + ` [Vencimento alterado de dia ${oldDate.getDate()} para ${safeDay}]` }).eq('id', inv.id); } } await supabase.from('notifications').insert({ user_id: userId, title: 'Data de Vencimento Alterada', message: `Sua solicitação foi aprovada. Suas faturas agora vencem no dia ${newDay}.`, type: 'success' }); } else if (status === 'rejected' && request) { await supabase.from('notifications').insert({ user_id: request.user_id, title: 'Solicitação Recusada', message: `Sua solicitação de mudança de data foi recusada. Motivo: ${adminNotes || 'Política interna'}.`, type: 'warning' }); } return res.status(200).json({ message: "Solicitação processada com sucesso." }); } catch (e: any) { return res.status(500).json({ error: e.message }); } } }
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
async function handleAnalyzeCredit(req: VercelRequest, res: VercelResponse) { const supabase=getSupabaseAdminClient(); const genAI=getGeminiClient(); const {userId}=req.body; const result=await runCreditAnalysis(supabase,genAI,userId, false); await updateProfileCredit(supabase, userId, result.credit_limit, result.credit_score, result.profile.credit_status === 'Bloqueado' ? 'Bloqueado' : 'Ativo', result.reason); res.status(200).json({profile:result}); }
async function handleGetProfiles(_req: VercelRequest, res: VercelResponse) { const supabase=getSupabaseAdminClient(); const {data}=await supabase.from('profiles').select('*'); res.status(200).json(data); }
async function handleDiagnoseError(_req: VercelRequest, res: VercelResponse) { res.status(200).json({ diagnosis: "Simulated Diagnosis" }); }
async function handleGetMpAuthUrl(req: VercelRequest, res: VercelResponse) { const { code_challenge } = req.body; const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${process.env.ML_CLIENT_ID}&response_type=code&platform_id=mp&state=random_state&redirect_uri=${req.headers.origin}/admin&code_challenge=${code_challenge}&code_challenge_method=S256`; res.status(200).json({ authUrl }); }
async function handleSupportTickets(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if (req.method === 'POST') { const { userId, subject, message, category, priority } = req.body; const { data: ticket, error: ticketError } = await supabase.from('support_tickets').insert({ user_id: userId, subject: subject || 'Atendimento', category: category || 'Geral', priority: priority || 'normal', status: 'open' }).select().single(); if (ticketError) throw ticketError; if (message) { const { error: msgError } = await supabase.from('support_messages').insert({ ticket_id: ticket.id, sender_type: 'user', message }); if (msgError) throw msgError; } res.status(201).json(ticket); } else if (req.method === 'PUT') { const { id, status } = req.body; const { data, error } = await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select(); if (error) throw error; res.status(200).json(data[0]); } else if (req.method === 'GET') { const { userId } = req.query; let query = supabase.from('support_tickets').select('*, profiles(first_name, last_name, email, credit_score, credit_limit, credit_status)').order('updated_at', { ascending: false }); if (userId) { query = query.eq('user_id', userId); } const { data, error } = await query; if (error) throw error; res.status(200).json(data); } } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleSupportMessages(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if (req.method === 'POST') { const { ticketId, sender, message, isInternal } = req.body; const { data, error } = await supabase.from('support_messages').insert({ ticket_id: ticketId, sender_type: sender, message, is_internal: isInternal || false }).select().single(); if (error) throw error; await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId); res.status(201).json(data); } else if (req.method === 'GET') { const { ticketId } = req.query; const { data, error } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }); if (error) throw error; res.status(200).json(data); } } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleSupportChat(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(!genAI) return res.status(500).json({error:"AI unavailable"}); const {message, context} = req.body; const prompt = `${context} User Message: "${message}" You are a helpful support assistant for Relp Cell. Respond in Portuguese (Brazil). Be concise, polite, and professional.`; try { const response = await generateContentWithRetry(genAI, {model:'gemini-2.5-flash', contents: prompt}); res.status(200).json({reply: response.text}); } catch(e: any) { res.status(500).json({error: e.message}); } }
async function handleGetAllInvoices(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { const { data, error } = await supabase.from('invoices').select('*').order('due_date', { ascending: false }); if (error) throw error; res.status(200).json(data); } catch (e: any) { res.status(500).json({ error: e.message }); } }

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
                case '/api/admin/invoices': return await handleGetAllInvoices(req, res);
                case '/api/admin/due-date-requests': return await handleDueDateRequests(req, res);
                case '/api/admin/client-documents': return await handleClientDocuments(req, res);
                case '/api/admin/limit-requests': return await handleGetLimitRequests(req, res);
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
                case '/api/admin/negotiate-debt': return await handleNegotiateDebt(req, res); 
                case '/api/admin/manage-invoice': return await handleManageInvoice(req, res); 
                case '/api/admin/risk-details': return await handleRiskDetails(req, res); 
                case '/api/admin/manage-notes': return await handleManageInternalNotes(req, res); 
                case '/api/admin/upload-document': return await handleClientDocuments(req, res); 
                case '/api/admin/update-limit': return await handleUpdateLimit(req, res);
                case '/api/admin/manage-limit-request': return await handleLimitRequestActions(req, res); 
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
                case '/api/admin/due-date-requests': return await handleDueDateRequests(req, res);
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
