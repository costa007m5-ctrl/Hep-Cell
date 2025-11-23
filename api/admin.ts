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

async function logAction(supabase: SupabaseClient, action_type: string, status: 'SUCCESS' | 'FAILURE', description: string, details?: object) {
    try {
        const { error } = await supabase.from('action_logs').insert({ action_type, status, description, details });
        if (error) console.error(`Failed to log action: ${action_type}`, error);
    } catch (e) { console.error("Log error", e); }
}

// --- Handlers ---

async function handleManageInvoices(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        if (req.method === 'PUT') {
            const { id, action } = req.body;
            if (!id || !action) return res.status(400).json({ error: 'ID e Ação são obrigatórios.' });

            let updateData: any = {};
            let logDesc = '';

            if (action === 'pay') {
                updateData = { 
                    status: 'Paga', 
                    payment_date: new Date().toISOString(),
                    payment_method: 'manual_admin'
                };
                logDesc = `Fatura ${id} marcada como paga manualmente pelo admin.`;
            } else if (action === 'cancel') {
                updateData = { status: 'Cancelado' };
                logDesc = `Fatura ${id} cancelada pelo admin.`;
            } else {
                return res.status(400).json({ error: 'Ação inválida.' });
            }

            const { data, error } = await supabase.from('invoices').update(updateData).eq('id', id).select().single();
            if (error) throw error;

            await logAction(supabase, 'INVOICE_UPDATE', 'SUCCESS', logDesc, { invoice_id: id });
            return res.status(200).json(data);
        }

        if (req.method === 'DELETE') {
            const { id, ids } = req.body;
            if (ids && Array.isArray(ids)) {
                const { error } = await supabase.from('invoices').delete().in('id', ids);
                if (error) throw error;
                await logAction(supabase, 'INVOICE_BULK_DELETE', 'SUCCESS', `${ids.length} faturas excluídas pelo admin.`);
                return res.status(200).json({ message: `${ids.length} faturas excluídas.` });
            }
            if (id) {
                const { error } = await supabase.from('invoices').delete().eq('id', id);
                if (error) throw error;
                await logAction(supabase, 'INVOICE_DELETE', 'SUCCESS', `Fatura ${id} excluída pelo admin.`);
                return res.status(200).json({ message: 'Fatura excluída.' });
            }
            return res.status(400).json({ error: 'ID ou lista de IDs obrigatória.' });
        }
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleManageProfile(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        if (req.method === 'PUT') {
            const { id, credit_status, internal_notes, tags, resetPassword } = req.body;
            const updateData: any = {};
            if (credit_status !== undefined) updateData.credit_status = credit_status;
            if (internal_notes !== undefined) updateData.internal_notes = internal_notes;
            if (tags !== undefined) updateData.tags = tags;
            
            if (Object.keys(updateData).length > 0) {
                const { error } = await supabase.from('profiles').update(updateData).eq('id', id);
                if (error) throw error;
            }
            
            if (resetPassword) {
                const { data: user } = await supabase.from('profiles').select('email').eq('id', id).single();
                if (user?.email) {
                    await supabase.auth.admin.resetPasswordForEmail(user.email);
                    await logAction(supabase, 'PASSWORD_RESET', 'SUCCESS', `Reset de senha enviado para ${user.email}`);
                }
            }
            return res.status(200).json({ message: 'Perfil atualizado.' });
        }
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleUploadDocument(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, title, base64 } = req.body;
        if (!userId || !title || !base64) return res.status(400).json({ error: 'Dados incompletos' });

        const { data, error } = await supabase.from('contracts').insert({
            user_id: userId,
            title: title,
            items: 'Documento Manual', 
            status: 'Assinado', 
            signature_data: base64, 
            terms_accepted: true
        }).select().single();

        if (error) throw error;
        await logAction(supabase, 'DOCUMENT_UPLOAD', 'SUCCESS', `Documento ${title} enviado para user ${userId}`);
        return res.status(201).json(data);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, totalAmount, installments, productName, saleType, paymentMethod, downPayment, signature, dueDay, sellerName, tradeInValue } = req.body;

        // Validações
        if (!userId || !totalAmount || !productName) {
            return res.status(400).json({ error: "Dados incompletos para venda." });
        }

        // 1. Criar Faturas (se for crediário ou cartão parcelado no sistema)
        let status = 'Em aberto';
        if (saleType === 'direct' && paymentMethod !== 'credit_card') {
             if (paymentMethod === 'cash') status = 'Paga';
        }

        const newInvoices = [];
        const amountPerInstallment = totalAmount / installments;
        const today = new Date();
        let currentMonth = today.getMonth(); // 0-11
        let currentYear = today.getFullYear();

        // Se tiver entrada, cria fatura de entrada
        if (downPayment > 0) {
             newInvoices.push({
                user_id: userId,
                month: `Entrada - ${productName}`,
                due_date: today.toISOString().split('T')[0],
                amount: downPayment,
                status: 'Paga', // Assumimos paga no ato
                payment_method: paymentMethod,
                payment_date: new Date().toISOString(),
                created_at: new Date().toISOString()
             });
        }

        const financedAmount = totalAmount - (downPayment || 0);
        const financeInstallmentValue = financedAmount / installments;

        // Começa a cobrar no próximo mês
        currentMonth++; 

        for (let i = 1; i <= installments; i++) {
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            
            const day = dueDay || 10;
            const maxDay = new Date(currentYear, currentMonth + 1, 0).getDate();
            const finalDay = Math.min(day, maxDay);
            const dueDate = new Date(currentYear, currentMonth, finalDay);

            let invStatus = status;
            if (saleType === 'crediario') {
                invStatus = signature ? 'Em aberto' : 'Aguardando Assinatura';
            } else if (paymentMethod === 'credit_card') {
                invStatus = 'Paga'; // Assumindo que passou na maquininha ou gateway
            }

            newInvoices.push({
                user_id: userId,
                month: `${productName} (${i}/${installments})`,
                due_date: dueDate.toISOString().split('T')[0],
                amount: financeInstallmentValue,
                status: invStatus,
                notes: `Venda ${saleType}. Vendedor: ${sellerName || 'Sistema'}`,
                created_at: new Date().toISOString()
            });
            
            currentMonth++;
        }

        const { error: invoiceError } = await supabase.from('invoices').insert(newInvoices);
        if (invoiceError) throw invoiceError;

        // 2. Criar Contrato se for Crediário
        if (saleType === 'crediario') {
            const { error: contractError } = await supabase.from('contracts').insert({
                user_id: userId,
                title: `Contrato de Compra - ${productName}`,
                items: productName,
                total_value: totalAmount,
                installments: installments,
                status: signature ? 'Ativo' : 'pending_signature',
                signature_data: signature,
                terms_accepted: true
            });
            if (contractError) console.error("Erro ao criar contrato", contractError);
        }

        return res.status(200).json({ success: true, status: signature ? 'Ativo' : 'Aguardando Assinatura' });

    } catch (e: any) {
        console.error("Create Sale Error:", e);
        return res.status(500).json({ error: e.message });
    }
}

async function handleNegotiateDebt(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, invoiceIds, totalAmount, installments, firstDueDate, interestRate } = req.body;
        if (!userId || !invoiceIds || invoiceIds.length === 0) return res.status(400).json({ error: "Selecione faturas." });

        const contractText = `TERMO DE CONFISSÃO DE DÍVIDA E RENEGOCIAÇÃO...`;
        const { data: contract, error: contractError } = await supabase.from('contracts').insert({
            user_id: userId,
            title: `Acordo de Renegociação (${new Date().toLocaleDateString()})`,
            items: `Renegociação de ${invoiceIds.length} faturas.`,
            total_value: totalAmount,
            installments: installments,
            status: 'pending_signature',
            terms_accepted: false
        }).select().single();

        if (contractError) throw contractError;

        // Cancela faturas antigas
        await supabase.from('invoices')
            .update({ status: 'Cancelado', notes: `Renegociado - Contrato #${contract.id.slice(0,8)}` })
            .in('id', invoiceIds);

        // Cria novas faturas
        const newInvoices = [];
        const installmentValue = totalAmount / installments;
        const startDueDate = new Date(firstDueDate || new Date());

        for (let i = 0; i < installments; i++) {
            const dueDate = new Date(startDueDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            
            newInvoices.push({
                user_id: userId,
                month: `Acordo ${i + 1}/${installments} (Aguardando Assinatura)`,
                due_date: dueDate.toISOString().split('T')[0],
                amount: installmentValue,
                status: 'Aguardando Assinatura',
                notes: `Vinculado ao contrato ${contract.id}. Liberação automática após assinatura.`
            });
        }

        await supabase.from('invoices').insert(newInvoices);
        
        // Envia notificação
        await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Proposta de Renegociação',
            message: 'Uma nova proposta de acordo está disponível. Assine para regularizar seu débito.',
            type: 'info'
        });

        return res.status(200).json({ success: true, contractId: contract.id });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleGenerateBanner(req: VercelRequest, res: VercelResponse) {
    const ai = getGeminiClient();
    if (!ai) return res.status(500).json({ error: 'API Key não configurada' });

    try {
        const { prompt, imageBase64, type } = req.body;
        
        // Modo Texto (Copywriting)
        if (type === 'text') {
             const textResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Create marketing copy for a banner based on this theme: "${prompt}". 
                Return a JSON object with keys: "title" (max 25 chars), "subtitle" (max 15 chars), "cta_text" (max 12 chars), "suggested_segment" (options: all, vip, new). 
                Make it catchy for a brazilian electronics store. Do not include markdown formatting.`
             });
             
             let text = textResponse.text || '';
             text = text.replace(/```json/g, '').replace(/```/g, '').trim(); // Clean markdown
             
             try {
                 const data = JSON.parse(text);
                 return res.status(200).json(data);
             } catch (e) {
                 console.error("JSON Parse error", e, text);
                 return res.status(200).json({ title: "Oferta Especial", subtitle: "Confira Agora", cta_text: "Ver Oferta" });
             }
        }

        // Modo Imagem
        let generatedImageBase64 = '';
        let suggestedLink = '';

        if (imageBase64) {
             const visionResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] || imageBase64 } },
                    { text: "Descreva esta imagem em detalhes para criar um prompt de marketing." }
                ]
             });
             
             const description = visionResponse.text;
             const imageResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: `Create a high quality advertising banner based on: ${description}. Additional request: ${prompt}. Professional lighting, 4k.` }] }
             });
             
             for (const part of imageResponse.candidates[0].content.parts) {
                if (part.inlineData) generatedImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
             }
        } else {
            const imageResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: `Create a professional advertising banner for a tech store. Theme: ${prompt}. High quality, photorealistic, minimalist background.` }] }
            });
             for (const part of imageResponse.candidates[0].content.parts) {
                if (part.inlineData) generatedImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
             }
        }

        const linkResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Based on this marketing theme: "${prompt}", suggest a internal app link category. Options: category:Celulares, category:Acessórios, category:Fones, category:Ofertas. Return ONLY the link string.`
        });
        suggestedLink = linkResponse.text?.trim() || '';

        if (!generatedImageBase64) throw new Error("Falha ao gerar imagem.");

        return res.status(200).json({ image: generatedImageBase64, suggestedLink });

    } catch (e: any) {
        console.error("Generate Banner Error:", e);
        return res.status(500).json({ error: e.message });
    }
}

async function handleBanners(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    if (req.method === 'GET') {
        const { data, error } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
        if (error) {
            if (error.code === '42P01') return res.status(200).json([]); // Table doesn't exist yet
            return res.status(500).json({ error: error.message });
        }
        return res.status(200).json(data);
    }

    if (req.method === 'POST') {
        const { image_base64, title, subtitle, cta_text, link, segment, start_date, end_date, prompt, sendNotification, location } = req.body;
        
        const { data: banner, error: insertError } = await supabase.from('banners').insert({
            image_url: image_base64,
            title: title || 'Oferta Especial',
            subtitle: subtitle || '',
            cta_text: cta_text || 'Ver Mais',
            link,
            segment: segment || 'all',
            location: location || 'store', // Padrão para Loja se não especificado
            start_date: start_date || new Date().toISOString(),
            end_date: end_date,
            active: true,
            clicks: 0,
            views: 0,
            prompt: prompt || 'Auto generated'
        }).select().single();

        if (insertError) {
             return res.status(500).json({ error: insertError.message });
        }

        if (sendNotification && banner) {
            const { data: users } = await supabase.from('profiles').select('id').limit(50);
            if (users) {
                const notifications = users.map(u => ({
                    user_id: u.id,
                    title: title || 'Novidade na Relp Cell!',
                    message: subtitle || 'Confira nossas novas ofertas exclusivas no app.',
                    type: 'info',
                    read: false
                }));
                await supabase.from('notifications').insert(notifications);
            }
        }

        return res.status(201).json({ success: true });
    }

    if (req.method === 'DELETE') {
        const { id } = req.body;
        const { error } = await supabase.from('banners').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
    }
    
    if (req.method === 'PUT') {
         const { id, active } = req.body;
         const { error } = await supabase.from('banners').update({ active }).eq('id', id);
         if (error) return res.status(500).json({ error: error.message });
         return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    // SQL Completo para garantir todas as tabelas necessárias
    const SQL = `
    -- Tabela de Banners (Com coluna location adicionada)
    CREATE TABLE IF NOT EXISTS "public"."banners" (
        "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
        "image_url" "text" NOT NULL,
        "title" "text",
        "subtitle" "text",
        "cta_text" "text",
        "link" "text",
        "prompt" "text",
        "segment" "text" DEFAULT 'all',
        "location" "text" DEFAULT 'store', -- 'store' or 'home'
        "active" boolean DEFAULT true,
        "start_date" timestamp with time zone DEFAULT "now"(),
        "end_date" timestamp with time zone,
        "clicks" integer DEFAULT 0,
        "views" integer DEFAULT 0,
        "created_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
    );
    
    -- Add column if not exists (Migration)
    DO $$ 
    BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banners' AND column_name='location') THEN 
            ALTER TABLE "public"."banners" ADD COLUMN "location" "text" DEFAULT 'store'; 
        END IF; 
    END $$;

    ALTER TABLE "public"."banners" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public Read Banners" ON "public"."banners";
    CREATE POLICY "Public Read Banners" ON "public"."banners" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Admin Full Access Banners" ON "public"."banners";
    CREATE POLICY "Admin Full Access Banners" ON "public"."banners" FOR ALL USING (true) WITH CHECK (true);

    -- Tabela de Notificações (Garantia)
    CREATE TABLE IF NOT EXISTS "public"."notifications" (
        "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
        "user_id" "uuid" NOT NULL,
        "title" "text" NOT NULL,
        "message" "text" NOT NULL,
        "type" "text" DEFAULT 'info',
        "read" boolean DEFAULT false,
        "created_at" timestamp with time zone DEFAULT "now"(),
        CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
    );
    `;
    
    return res.status(200).json({ 
        message: 'Copie o SQL abaixo e execute no Editor SQL do Supabase para habilitar todos os recursos.',
        sql: SQL
    });
}

// Main Router
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        if (path === '/api/admin/manage-invoices') return await handleManageInvoices(req, res);
        if (path === '/api/admin/manage-profile') return await handleManageProfile(req, res);
        if (path === '/api/admin/upload-document') return await handleUploadDocument(req, res);
        if (path === '/api/admin/create-sale') return await handleCreateSale(req, res);
        if (path === '/api/admin/negotiate-debt') return await handleNegotiateDebt(req, res);
        if (path === '/api/admin/generate-banner') return await handleGenerateBanner(req, res);
        if (path === '/api/admin/banners') return await handleBanners(req, res);
        if (path === '/api/admin/setup-database') return await handleSetupDatabase(req, res);
        
        // Mocks
        if (path.includes('/products')) return res.status(200).json([]);
        if (path.includes('/profiles')) return res.status(200).json([]);
        if (path.includes('/invoices')) return res.status(200).json([]);
        if (path.includes('/settings')) return res.status(200).json({});
        if (path.includes('/get-logs')) return res.status(200).json([]);

        return res.status(404).json({ error: 'Admin route not found' });

    } catch (e: any) {
        console.error(`Error in admin API handler for path ${path}:`, e);
        return res.status(500).json({ error: 'Internal Server Error', message: e.message });
    }
}