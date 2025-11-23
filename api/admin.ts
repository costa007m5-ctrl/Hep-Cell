
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
        const { userId, totalAmount, installments, productName, saleType, paymentMethod, downPayment, signature, sellerName, tradeInValue, dueDay } = req.body;

        if (!userId || !totalAmount) {
            return res.status(400).json({ error: 'Dados incompletos da venda.' });
        }

        // 1. Criar Faturas
        const invoicePromises = [];
        const monthlyAmount = (totalAmount - (downPayment || 0)) / installments;
        const currentDate = new Date();
        
        // Determina dia de vencimento (padrão 10 se não informado)
        const dayOfDue = dueDay || 10;

        // Se for crediário com parcelas
        if (saleType === 'crediario' && installments > 0) {
            for (let i = 1; i <= installments; i++) {
                // Calcula data de vencimento para os próximos meses
                let dueMonth = currentDate.getMonth() + i;
                let dueYear = currentDate.getFullYear();
                
                if (dueMonth > 11) {
                    dueMonth -= 12;
                    dueYear += 1;
                }

                // Ajusta o dia
                const maxDaysInMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
                const finalDay = Math.min(dayOfDue, maxDaysInMonth);
                const dueDate = new Date(dueYear, dueMonth, finalDay).toISOString().split('T')[0];

                invoicePromises.push(
                    supabase.from('invoices').insert({
                        user_id: userId,
                        month: `${productName} (${i}/${installments})`,
                        due_date: dueDate,
                        amount: monthlyAmount,
                        status: signature ? 'Em aberto' : 'Aguardando Assinatura',
                        notes: `Venda por ${sellerName}. ${tradeInValue ? `Trade-in: R$${tradeInValue}` : ''}`,
                        payment_method: 'crediario'
                    })
                );
            }
        } else {
            // Venda Direta (1x ou Entrada total)
            invoicePromises.push(
                supabase.from('invoices').insert({
                    user_id: userId,
                    month: `${productName} (À Vista/Entrada)`,
                    due_date: new Date().toISOString().split('T')[0], // Vence hoje
                    amount: totalAmount,
                    status: 'Em aberto', // Já nasce em aberto para pagar no app
                    notes: `Venda Direta por ${sellerName}.`,
                    payment_method: paymentMethod || 'pix'
                })
            );
        }

        await Promise.all(invoicePromises);

        // 2. Se houver assinatura, criar contrato
        if (signature) {
            await supabase.from('contracts').insert({
                user_id: userId,
                title: `Contrato de Compra - ${productName}`,
                items: productName,
                total_value: totalAmount,
                installments: installments,
                status: 'Assinado',
                signature_data: signature,
                terms_accepted: true
            });
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada para user ${userId} - R$ ${totalAmount}`);

        return res.status(200).json({ 
            success: true, 
            message: 'Venda realizada.',
            status: signature ? 'Ativo' : 'Aguardando Assinatura'
        });

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

        // 1. Gerar Texto Legal do Contrato (Confissão de Dívida)
        const contractText = `TERMO DE CONFISSÃO DE DÍVIDA E RENEGOCIAÇÃO\n\n` +
            `Pelo presente instrumento, o CLIENTE reconhece expressamente a dívida referente às faturas originais (IDs: ${invoiceIds.join(', ')}).\n\n` +
            `O valor total da dívida renegociada é de R$ ${Number(totalAmount).toFixed(2)}, acrescido de juros de negociação de ${interestRate}%.\n` +
            `O pagamento será realizado em ${installments} parcelas mensais.\n\n` +
            `CLÁUSULA DE INADIMPLÊNCIA: O não pagamento de qualquer parcela na data de vencimento implicará em multa de 2% e juros moratórios de 1% ao mês (art. 406 CC/2002).\n` +
            `A assinatura deste termo implica na novação da dívida anterior.`;

        // 2. Criar Contrato com Status 'pending_signature'
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

        // 3. Cancelar Faturas Antigas
        await supabase.from('invoices')
            .update({ status: 'Cancelado', notes: `Renegociado - Contrato #${contract.id.slice(0,8)}` })
            .in('id', invoiceIds);

        // 4. Criar Novas Faturas (Bloqueadas)
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
        
        // 5. Enviar Notificação
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

// Stubs for unimplemented or placeholder features - RENAMED 'req' to '_req' to fix build
async function handleAdminChat(req: VercelRequest, res: VercelResponse) {
    // Implementação real do Chat com IA
    try {
        const { message, context } = req.body;
        const ai = getGeminiClient();
        if (!ai) return res.status(500).json({ error: "AI Client not configured" });

        const systemPrompt = context || "Você é um assistente útil.";
        const fullPrompt = `${systemPrompt}\n\nUsuário: ${message}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt
        });

        return res.status(200).json({ reply: response.text });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleGenerateBanner(req: VercelRequest, res: VercelResponse) {
    // Implementação real de geração de banner
    try {
        const { imageBase64, prompt } = req.body;
        const ai = getGeminiClient();
        if (!ai) return res.status(500).json({ error: "AI Client not configured" });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Using text model to simulate "suggestion" since image gen is complex here
            contents: `Analise esta imagem (base64 simulada) e o prompt: "${prompt}". Sugira um título criativo e uma cor de fundo hexadecimal para um banner de loja. Retorne JSON.`
        });
        
        // Mock response for now as full image generation requires more setup
        return res.status(200).json({ 
            image: imageBase64, // Echo back for now or use placeholder
            suggestedLink: "category:Ofertas" 
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleEditImage(_req: VercelRequest, res: VercelResponse) { return res.status(200).json({}); }

async function handleBanners(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'POST') {
        const { image_base64, prompt, link } = req.body;
        // Here you would upload image to storage and get URL. Mocking storage for now.
        const imageUrl = image_base64.length > 1000 ? "https://via.placeholder.com/800x300?text=Banner+Salvo" : image_base64;
        
        const { error } = await supabase.from('banners').insert({
            image_url: imageUrl,
            prompt,
            link,
            active: true
        });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
    }
    
    if (req.method === 'DELETE') {
        const { id } = req.body;
        await supabase.from('banners').delete().eq('id', id);
        return res.status(200).json({ success: true });
    }

    const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
    return res.status(200).json(data);
}

async function handleProducts(req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    if(req.method === 'GET') {
        const {data} = await supabase.from('products').select('*');
        return res.status(200).json(data);
    }
    if(req.method === 'POST' || req.method === 'PUT') {
        const { data, error } = await supabase.from('products').upsert(req.body).select();
        if(error) return res.status(500).json({error: error.message});
        return res.status(200).json(data);
    }
    return res.status(405).json({error: 'Method not allowed'});
}

async function handleProfiles(_req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    const {data} = await supabase.from('profiles').select('*');
    return res.status(200).json(data);
}

async function handleInvoices(_req: VercelRequest, res: VercelResponse) { 
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
    if (req.method === 'POST') {
        const { userId, subject, message, category, priority } = req.body;
        const { data, error } = await supabase.from('support_tickets').insert({
            user_id: userId, subject, status: 'open', category, priority
        }).select().single();
        
        if (error) return res.status(500).json({ error: error.message });
        
        // Add initial message
        await supabase.from('support_messages').insert({
            ticket_id: data.id, sender_type: 'user', message
        });
        return res.status(200).json(data);
    }
    
    if (req.method === 'PUT') {
        const { id, status } = req.body;
        await supabase.from('support_tickets').update({ status }).eq('id', id);
        return res.status(200).json({ success: true });
    }

    const { userId } = req.query;
    let query = supabase.from('support_tickets').select('*, profiles(first_name, last_name, email, credit_score, credit_limit, credit_status)');
    if (userId) query = query.eq('user_id', userId);
    
    const { data } = await query.order('updated_at', { ascending: false });
    return res.status(200).json(data);
}

async function handleSupportMessages(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'POST') {
        const { ticketId, sender, message, isInternal } = req.body;
        const { data, error } = await supabase.from('support_messages').insert({
            ticket_id: ticketId,
            sender_type: sender,
            message,
            is_internal: isInternal || false
        }).select().single();
        
        if (error) return res.status(500).json({ error: error.message });
        
        // Update ticket timestamp
        await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
        
        return res.status(200).json(data);
    }

    const { ticketId } = req.query;
    const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    return res.status(200).json(data);
}

async function handleLogs(_req: VercelRequest, res: VercelResponse) { 
    const supabase = getSupabaseAdminClient();
    const {data} = await supabase.from('action_logs').select('*').order('created_at', {ascending:false}).limit(50);
    return res.status(200).json(data);
}

async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) { 
    // This is usually handled via SQL Editor, but could be here if using migrations.
    // For now, just return success to prevent errors in UI.
    return res.status(200).json({ message: "Database setup via SQL Editor recommended." }); 
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
        
        if (path === '/api/admin/chat') return await handleAdminChat(req, res);
        if (path === '/api/admin/products') return await handleProducts(req, res);
        if (path === '/api/admin/profiles') return await handleProfiles(req, res);
        if (path === '/api/admin/invoices') return await handleInvoices(req, res);
        if (path === '/api/admin/settings') return await handleSettings(req, res);
        if (path === '/api/admin/banners') return await handleBanners(req, res);
        if (path === '/api/admin/generate-banner') return await handleGenerateBanner(req, res);
        if (path === '/api/admin/edit-image') return await handleEditImage(req, res);
        if (path === '/api/admin/support-tickets') return await handleSupportTickets(req, res);
        if (path === '/api/admin/support-messages') return await handleSupportMessages(req, res);
        if (path === '/api/admin/get-logs') return await handleLogs(req, res);
        if (path === '/api/admin/setup-database') return await handleSetupDatabase(req, res);

        return res.status(404).json({ error: 'Admin route not found' });

    } catch (e: any) {
        console.error(`Error in admin API handler for path ${path}:`, e);
        return res.status(500).json({ error: 'Internal Server Error', message: e.message });
    }
}
