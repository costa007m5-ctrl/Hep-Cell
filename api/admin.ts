
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
            const { id } = req.body;
            if (!id) return res.status(400).json({ error: 'ID obrigatório.' });

            const { error } = await supabase.from('invoices').delete().eq('id', id);
            if (error) throw error;

            await logAction(supabase, 'INVOICE_DELETE', 'SUCCESS', `Fatura ${id} excluída pelo admin.`);
            return res.status(200).json({ message: 'Fatura excluída.' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleManageProfile(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    try {
        // Atualizar dados sensíveis do perfil (Bloqueio, Notas, Tags)
        if (req.method === 'PUT') {
            const { id, credit_status, internal_notes, tags, resetPassword } = req.body;
            
            const updateData: any = {};
            if (credit_status !== undefined) updateData.credit_status = credit_status;
            
            // Atualiza o perfil
            if (Object.keys(updateData).length > 0) {
                const { error } = await supabase.from('profiles').update(updateData).eq('id', id);
                if (error) throw error;
            }
            
            // Salva notas/tags (usando action_logs como armazenamento KV auxiliar se não houver tabela especifica)
            if (internal_notes || tags) {
                 // Idealmente teríamos uma tabela dedicada, mas para simplificar usaremos logs para rastreabilidade
                 // ou uma tabela de metadata se existisse. Aqui vamos apenas logar para não quebrar se a coluna não existir.
                 // Em uma implementação real, adicione colunas 'internal_notes' e 'tags' na tabela profiles.
                 await logAction(supabase, 'PROFILE_UPDATE', 'SUCCESS', `Atualização de perfil ${id}`, { internal_notes, tags });
            }

            // Reset de senha (Trigger de email)
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

        // Reutiliza a tabela contracts para documentos genéricos
        const { data, error } = await supabase.from('contracts').insert({
            user_id: userId,
            title: title,
            items: 'Documento Manual', // Flag para identificar
            status: 'Assinado', // Considera já válido pois foi upload manual
            signature_data: base64, // Armazena o arquivo aqui (em base64)
            terms_accepted: true
        }).select().single();

        if (error) throw error;
        
        await logAction(supabase, 'DOCUMENT_UPLOAD', 'SUCCESS', `Documento ${title} enviado para user ${userId}`);
        return res.status(201).json(data);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// ... existing handlers ...

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, totalAmount, installments, productName, saleType, paymentMethod, downPayment, signature, sellerName, tradeInValue, dueDay } = req.body;

        if (!userId || !totalAmount) {
            return res.status(400).json({ error: 'Dados incompletos da venda.' });
        }

        // 1. Criar Contrato (se crediário)
        let contractId = null;
        if (saleType === 'crediario') {
            const { data: contract, error: contractError } = await supabase.from('contracts').insert({
                user_id: userId,
                title: `Compra de ${productName}`,
                items: productName,
                total_value: totalAmount,
                installments: installments,
                status: 'Ativo', // Já vem assinado do modal
                signature_data: signature,
                terms_accepted: true
            }).select().single();

            if (contractError) throw contractError;
            contractId = contract.id;
        }

        // 2. Gerar Faturas
        const invoices = [];
        const amountPerInstallment = totalAmount / installments;
        const currentDate = new Date();
        
        // Ajuste para dia de vencimento escolhido
        const targetDay = dueDay || 10;

        for (let i = 1; i <= installments; i++) {
            // Calcular vencimento: próximo mês, dia escolhido
            let month = currentDate.getMonth() + i;
            let year = currentDate.getFullYear();
            
            if (month > 11) {
                month -= 12;
                year++;
            }
            
            // Ajuste para dias que não existem (ex: 30 de fev)
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            const day = Math.min(targetDay, lastDayOfMonth);
            
            const dueDate = new Date(year, month, day);

            invoices.push({
                user_id: userId,
                month: `${productName} (${i}/${installments})`,
                due_date: dueDate.toISOString().split('T')[0],
                amount: amountPerInstallment,
                status: 'Em aberto',
                notes: `Parcela ${i} de ${installments}. Vendedor: ${sellerName || 'Sistema'}.`
            });
        }

        if (invoices.length > 0) {
            const { error: invError } = await supabase.from('invoices').insert(invoices);
            if (invError) throw invError;
        }

        // 3. Logar Venda no Histórico de Ações
        await logAction(supabase, 'NEW_SALE', 'SUCCESS', `Venda ${saleType} realizada para ${userId}. Total: ${totalAmount}`, {
            productName, installments, paymentMethod, tradeInValue
        });

        return res.status(200).json({ success: true, message: 'Venda realizada com sucesso.' });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

// ... other existing handlers (negotiate, etc) ...
async function handleNegotiateDebt(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, invoiceIds, totalAmount, installments, firstDueDate, notes } = req.body;

        // 1. Cancelar faturas antigas
        await supabase.from('invoices')
            .update({ status: 'Cancelado', notes: `Renegociado em ${new Date().toLocaleDateString()}` })
            .in('id', invoiceIds);

        // 2. Criar novas faturas do acordo
        const newInvoices = [];
        const installmentValue = totalAmount / installments;
        const startDueDate = new Date(firstDueDate);

        for (let i = 0; i < installments; i++) {
            const dueDate = new Date(startDueDate);
            dueDate.setMonth(dueDate.getMonth() + i);

            newInvoices.push({
                user_id: userId,
                month: `Acordo Renegociação (${i + 1}/${installments})`,
                due_date: dueDate.toISOString().split('T')[0],
                amount: installmentValue,
                status: 'Em aberto',
                notes: notes || 'Refinanciamento de débitos anteriores.'
            });
        }

        await supabase.from('invoices').insert(newInvoices);
        
        await logAction(supabase, 'DEBT_NEGOTIATION', 'SUCCESS', `Renegociação realizada para user ${userId}. ${invoiceIds.length} faturas canceladas.`);

        return res.status(200).json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleAdminChat(req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        const { message, context } = req.body;
        
        // Recupera configuração do modelo do banco se existir
        const supabase = getSupabaseAdminClient();
        const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'chat_model').single();
        const modelName = settings?.value || 'gemini-2.5-flash'; // Fallback

        const prompt = `${context ? `CONTEXTO: ${context}\n\n` : ''}USUÁRIO: ${message}\n\nRESPOSTA:`;
        
        const response = await genAI.models.generateContent({
            model: modelName,
            contents: prompt
        });

        return res.status(200).json({ reply: response.text });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleGenerateBanner(req: VercelRequest, res: VercelResponse) {
    // Implementação básica de mock ou integração real se houver suporte a imagem
    // Retorna sucesso simulado
    return res.status(200).json({ 
        image: req.body.imageBase64, // Echo back for now as we don't have image gen logic fully setup in this snippet
        suggestedLink: 'category:Ofertas' 
    }); 
}

async function handleEditImage(req: VercelRequest, res: VercelResponse) {
    return res.status(200).json({ image: req.body.imageBase64 });
}

async function handleBanners(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'GET') {
        const { data } = await supabase.from('app_banners').select('*');
        return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
        const { image_base64, prompt, link } = req.body;
        // Salva na tabela app_banners (assumindo que existe ou criando)
        // Como não podemos rodar DDL, vamos supor que existe ou falhar graciosamente
        try {
            await supabase.from('app_banners').insert({ image_url: image_base64, prompt, link, active: true });
            return res.status(200).json({ success: true });
        } catch(e: any) { return res.status(500).json({error: e.message}); }
    }
    if (req.method === 'DELETE') {
        const { id } = req.body;
        await supabase.from('app_banners').delete().eq('id', id);
        return res.status(200).json({ success: true });
    }
}

async function handleProducts(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'GET') {
        const { data } = await supabase.from('products').select('*');
        return res.status(200).json(data);
    }
    if (req.method === 'POST' || req.method === 'PUT') {
        const product = req.body;
        if (product.image_base64) {
            product.image_url = product.image_base64; // Simplificação: salvando base64 direto na URL (não ideal p/ prod, mas funcional p/ demo)
            delete product.image_base64;
        }
        const { data, error } = await supabase.from('products').upsert(product).select();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }
}

async function handleProfiles(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from('profiles').select('*');
    return res.status(200).json(data);
}

async function handleInvoices(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from('invoices').select('*').order('due_date', { ascending: false });
    return res.status(200).json(data);
}

async function handleSettings(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'POST') {
        const { key, value } = req.body;
        await supabase.from('system_settings').upsert({ key, value });
        return res.status(200).json({ success: true });
    }
    const { data } = await supabase.from('system_settings').select('*');
    // Convert array to object
    const settings: any = {};
    data?.forEach((item: any) => settings[item.key] = item.value);
    return res.status(200).json(settings);
}

async function handleSupportTickets(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'GET') {
        const { userId } = req.query;
        let query = supabase.from('support_tickets').select('*, profiles(first_name, last_name, email, credit_score, credit_limit)');
        if (userId) query = query.eq('user_id', userId);
        const { data } = await query;
        return res.status(200).json(data);
    }
    if (req.method === 'POST') {
        const { userId, subject, message, category, priority } = req.body;
        const { data: ticket } = await supabase.from('support_tickets').insert({
            user_id: userId, subject, category, priority: priority || 'Normal', status: 'open'
        }).select().single();
        
        if (ticket) {
            await supabase.from('support_messages').insert({
                ticket_id: ticket.id, sender_type: 'user', message: message
            });
        }
        return res.status(200).json({ success: true });
    }
    if (req.method === 'PUT') {
        const { id, status } = req.body;
        await supabase.from('support_tickets').update({ status }).eq('id', id);
        return res.status(200).json({ success: true });
    }
}

async function handleSupportMessages(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    if (req.method === 'GET') {
        const { ticketId } = req.query;
        const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
        return res.status(200).json(data);
    }
    if (req.method === 'POST') {
        const { ticketId, sender, message, isInternal } = req.body;
        await supabase.from('support_messages').insert({
            ticket_id: ticketId,
            sender_type: sender,
            message: message,
            is_internal: isInternal || false
        });
        return res.status(200).json({ success: true });
    }
}

async function handleLogs(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from('action_logs').select('*').order('created_at', { ascending: false }).limit(50);
    return res.status(200).json(data);
}

async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    // This endpoint is critical for creating tables if they don't exist.
    // Since we can't execute SQL directly via client in this environment without a custom extension or RPC,
    // we will rely on the user running the SQL provided in DeveloperTab manually in Supabase dashboard.
    // However, we can try to create a table via RPC if a function exists, or just return success.
    return res.status(200).json({ message: 'Por favor, execute o script SQL fornecido na aba Developer no painel do Supabase.' });
}

// Main Router
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        // Admin Routes
        if (path === '/api/admin/manage-invoices') return await handleManageInvoices(req, res);
        if (path === '/api/admin/manage-profile') return await handleManageProfile(req, res);
        if (path === '/api/admin/upload-document') return await handleUploadDocument(req, res);
        
        if (path === '/api/admin/create-sale') return await handleCreateSale(req, res);
        if (path === '/api/admin/negotiate-debt') return await handleNegotiateDebt(req, res);
        if (path === '/api/admin/chat') return await handleAdminChat(req, res);
        
        if (path === '/api/admin/generate-banner') return await handleGenerateBanner(req, res);
        if (path === '/api/admin/edit-image') return await handleEditImage(req, res);
        if (path === '/api/admin/banners') return await handleBanners(req, res);
        
        if (path === '/api/admin/products') return await handleProducts(req, res);
        if (path === '/api/admin/profiles') return await handleProfiles(req, res);
        if (path === '/api/admin/invoices') return await handleInvoices(req, res);
        
        if (path === '/api/admin/settings') return await handleSettings(req, res);
        
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
