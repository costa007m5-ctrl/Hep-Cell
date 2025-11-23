
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
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
    const { error } = await supabase.from('action_logs').insert({ action_type, status, description, details });
    if (error) {
        console.error(`Failed to log action: ${action_type}`, error);
    }
}

// --- Handlers ---

async function handleManageInvoices(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    try {
        if (req.method === 'PUT') {
            const { id, action } = req.body; // action: 'pay', 'cancel'
            
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

            // Exclusão em Massa
            if (ids && Array.isArray(ids)) {
                const { error } = await supabase.from('invoices').delete().in('id', ids);
                if (error) throw error;
                await logAction(supabase, 'INVOICE_BULK_DELETE', 'SUCCESS', `${ids.length} faturas excluídas pelo admin.`);
                return res.status(200).json({ message: `${ids.length} faturas excluídas.` });
            }

            // Exclusão Individual
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
            
            if (Object.keys(updateData).length > 0) {
                const { error } = await supabase.from('profiles').update(updateData).eq('id', id);
                if (error) throw error;
            }
            
            if (internal_notes || tags) {
                 await logAction(supabase, 'PROFILE_UPDATE', 'SUCCESS', `Atualização de perfil ${id}`, { internal_notes, tags });
            }

            if (resetPassword) {
                const { data: user } = await supabase.from('profiles').select('email').eq('id', id).single();
                if (user?.email) {
                    // Fix: use auth.resetPasswordForEmail instead of admin.resetPasswordForEmail
                    await supabase.auth.resetPasswordForEmail(user.email);
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
        const { userId, totalAmount, installments, productName, saleType, paymentMethod, downPayment, signature, sellerName, tradeInValue, dueDay } = req.body;

        if (!userId || !totalAmount) {
            return res.status(400).json({ error: 'Dados incompletos da venda.' });
        }

        const now = new Date();
        const dueDate = new Date(now);
        // Set due date based on selected day or default 30 days
        if (dueDay) {
            dueDate.setDate(dueDay);
            if (dueDate < now) {
                dueDate.setMonth(dueDate.getMonth() + 1);
            }
        } else {
            dueDate.setDate(dueDate.getDate() + 30);
        }

        const status = saleType === 'crediario' ? 'Aguardando Assinatura' : 'Em aberto';
        const notes = `Venda ${saleType}. Vendedor: ${sellerName || 'Admin'}. TradeIn: ${tradeInValue || 0}. Entrada: ${downPayment || 0}`;

        // Create Invoice
        const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
            user_id: userId,
            amount: totalAmount,
            month: productName || 'Nova Venda',
            due_date: dueDate.toISOString().split('T')[0],
            status: status,
            payment_method: paymentMethod,
            notes: notes
        }).select().single();

        if (invoiceError) throw invoiceError;

        // If crediario, create contract
        if (saleType === 'crediario') {
            await supabase.from('contracts').insert({
                user_id: userId,
                title: `Contrato - ${productName}`,
                items: productName,
                total_value: totalAmount,
                installments: installments,
                status: signature ? 'Assinado' : 'Pendente',
                signature_data: signature,
                terms_accepted: !!signature
            });
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada para user ${userId}. Valor: ${totalAmount}`, { invoiceId: invoice.id });

        return res.status(200).json({ success: true, message: 'Venda realizada.', invoice });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleNegotiateDebt(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, invoiceIds, totalAmount, installments, firstDueDate, interestRate } = req.body;

        if (!userId || !invoiceIds || invoiceIds.length === 0) {
            return res.status(400).json({ error: "Selecione faturas para negociar." });
        }

        const contractText = `TERMO DE CONFISSÃO DE DÍVIDA E RENEGOCIAÇÃO\n\n` +
            `Pelo presente instrumento, o CLIENTE reconhece expressamente a dívida referente às faturas originais (IDs: ${invoiceIds.join(', ')}).\n\n` +
            `O valor total da dívida renegociada é de R$ ${Number(totalAmount).toFixed(2)}, acrescido de juros de negociação de ${interestRate}%.\n` +
            `O pagamento será realizado em ${installments} parcelas mensais.\n\n` +
            `CLÁUSULA DE INADIMPLÊNCIA: O não pagamento de qualquer parcela na data de vencimento implicará em multa de 2% e juros moratórios de 1% ao mês (art. 406 CC/2002).\n` +
            `A assinatura deste termo implica na novação da dívida anterior.`;

        const { data: contract, error: contractError } = await supabase.from('contracts').insert({
            user_id: userId,
            title: `Acordo de Renegociação (${new Date().toLocaleDateString()})`,
            items: contractText,
            total_value: totalAmount,
            installments: installments,
            status: 'pending_signature',
            terms_accepted: false
        }).select().single();

        if (contractError) throw contractError;

        await supabase.from('invoices')
            .update({ status: 'Cancelado', notes: `Renegociado - Contrato #${contract.id.slice(0,8)}` })
            .in('id', invoiceIds);

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
        
        await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Proposta de Acordo Disponível',
            message: 'Sua renegociação foi gerada. Acesse o app para assinar o contrato e regularizar sua situação.',
            type: 'alert'
        });

        await logAction(supabase, 'DEBT_NEGOTIATION', 'SUCCESS', `Renegociação criada para user ${userId}. ${invoiceIds.length} faturas canceladas. Aguardando assinatura.`);

        return res.status(200).json({ success: true, contractId: contract.id });
    } catch (e: any) {
        console.error("Erro na negociação:", e);
        return res.status(500).json({ error: e.message });
    }
}

async function handleGenerateBanner(req: VercelRequest, res: VercelResponse) {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

        const ai = getGeminiClient();
        if (!ai) return res.status(500).json({ error: 'API Key do Gemini não configurada.' });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] }
        });

        let imageBase64 = null;
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    imageBase64 = part.inlineData.data;
                    break;
                }
            }
        }

        if (imageBase64) {
            return res.status(200).json({ image: `data:image/png;base64,${imageBase64}` });
        } else {
            // Fallback se o modelo não retornar imagem diretamente (alguns modelos retornam texto explicando que não podem gerar)
            return res.status(500).json({ error: 'O modelo não gerou uma imagem. Tente detalhar mais o prompt.' });
        }
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleEditImage(req: VercelRequest, res: VercelResponse) {
    try {
        const { prompt, imageBase64 } = req.body;
        if (!prompt || !imageBase64) return res.status(400).json({ error: 'Dados insuficientes.' });

        const ai = getGeminiClient();
        if (!ai) return res.status(500).json({ error: 'API Key do Gemini não configurada.' });

        // Remove header data:image/... se existir
        const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                    { text: prompt }
                ]
            }
        });

        let outputImage = null;
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    outputImage = part.inlineData.data;
                    break;
                }
            }
        }

        if (outputImage) {
            return res.status(200).json({ image: `data:image/png;base64,${outputImage}` });
        }
        return res.status(500).json({ error: 'Não foi possível editar a imagem.' });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleBanners(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    if (req.method === 'GET') {
        const { data, error } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    if (req.method === 'POST') {
        const { image_base64, prompt, link } = req.body;
        const { data, error } = await supabase.from('banners').insert({
            image_url: image_base64, // Em produção, idealmente upload para Storage e salvar URL
            prompt,
            link,
            active: true
        }).select();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
        const { id } = req.body;
        const { error } = await supabase.from('banners').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleAdminChat(req: VercelRequest, res: VercelResponse) {
    const ai = getGeminiClient();
    if (!ai) return res.status(500).json({ error: 'AI Config Missing' });
    
    try {
        const { message, context } = req.body;
        // Recuperar modelo salvo nas configs ou usar default
        const supabase = getSupabaseAdminClient();
        const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'chat_model').single();
        const modelName = settings?.value || 'gemini-2.5-flash';

        const response = await ai.models.generateContent({
            model: modelName,
            contents: { 
                role: 'user',
                parts: [{ text: `Contexto: ${context}\n\nUsuário: ${message}` }] 
            }
        });
        return res.status(200).json({ reply: response.text });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleProducts(req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    if(req.method === 'GET') {
        const {data} = await supabase.from('products').select('*');
        return res.status(200).json(data);
    }
    if(req.method === 'POST' || req.method === 'PUT') {
        const {data} = await supabase.from('products').upsert(req.body).select();
        return res.status(200).json(data);
    }
}

async function handleProfiles(req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    const {data} = await supabase.from('profiles').select('*');
    return res.status(200).json(data);
}

async function handleInvoices(req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    const {data} = await supabase.from('invoices').select('*').order('created_at');
    return res.status(200).json(data);
}

async function handleSettings(req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    if(req.method === 'POST') {
        await supabase.from('system_settings').upsert(req.body);
        return res.status(200).json({});
    }
    const {data} = await supabase.from('system_settings').select('*');
    const settings: any = {};
    data?.forEach((d: any) => settings[d.key] = d.value);
    return res.status(200).json(settings);
}

async function handleSupportTickets(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'GET') {
        const { data } = await supabase.from('support_tickets').select('*, profiles(first_name, last_name, email, credit_score, credit_limit, credit_status)').order('updated_at', { ascending: false });
        return res.status(200).json(data);
    }
    if (req.method === 'POST') {
        const { userId, subject, category, priority, message } = req.body;
        // Create ticket
        const { data: ticket, error } = await supabase.from('support_tickets').insert({
            user_id: userId,
            subject,
            category,
            priority,
            status: 'open'
        }).select().single();
        
        if (error) return res.status(500).json({ error: error.message });

        // Create initial message
        await supabase.from('support_messages').insert({
            ticket_id: ticket.id,
            sender_type: 'user',
            message
        });
        return res.status(200).json(ticket);
    }
    if (req.method === 'PUT') {
        const { id, status } = req.body;
        await supabase.from('support_tickets').update({ status }).eq('id', id);
        return res.status(200).json({ success: true });
    }
    return res.status(405).end();
}

async function handleSupportMessages(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'GET') {
        const { ticketId } = req.query;
        const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at');
        return res.status(200).json(data);
    }
    if (req.method === 'POST') {
        const { ticketId, sender, message, isInternal } = req.body;
        const { data } = await supabase.from('support_messages').insert({
            ticket_id: ticketId,
            sender_type: sender,
            message,
            is_internal: isInternal
        }).select();
        
        // Update ticket updated_at
        await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
        
        return res.status(200).json(data);
    }
    return res.status(405).end();
}

async function handleLogs(req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    const {data} = await supabase.from('action_logs').select('*').order('created_at', {ascending:false}).limit(50);
    return res.status(200).json(data);
}

async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    // This route is used to create tables if they don't exist via SQL Editor in dashboard
    // But we can use it to verify connection
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from('profiles').select('count').limit(1);
    if (error) return res.status(500).json({ message: 'Database connection failed', error });
    return res.status(200).json({ message: 'Database connection OK. Tables should be created via SQL Editor.' });
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
        
        // AI & Banners
        if (path === '/api/admin/generate-banner') return await handleGenerateBanner(req, res);
        if (path === '/api/admin/edit-image') return await handleEditImage(req, res);
        if (path === '/api/admin/banners') return await handleBanners(req, res);
        if (path === '/api/admin/chat') return await handleAdminChat(req, res);

        // Resources
        if (path === '/api/admin/products') return await handleProducts(req, res);
        if (path === '/api/admin/profiles') return await handleProfiles(req, res);
        if (path === '/api/admin/invoices') return await handleInvoices(req, res);
        if (path === '/api/admin/settings') return await handleSettings(req, res);
        if (path === '/api/admin/get-logs') return await handleLogs(req, res);
        
        // Support
        if (path === '/api/admin/support-tickets') return await handleSupportTickets(req, res);
        if (path === '/api/admin/support-messages') return await handleSupportMessages(req, res);
        
        // System
        if (path === '/api/admin/setup-database') return await handleSetupDatabase(req, res);

        return res.status(404).json({ error: 'Admin route not found' });

    } catch (e: any) {
        console.error(`Error in admin API handler for path ${path}:`, e);
        return res.status(500).json({ error: 'Internal Server Error', message: e.message });
    }
}
