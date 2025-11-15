import type { VercelRequest, VercelResponse } from '@vercel/node';
import { URL } from 'url';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
// FIX: Import the 'Invoice' type to resolve the 'Cannot find name 'Invoice'' error.
import type { Invoice } from '../src/types';

// --- Funções Auxiliares de Validação ---
function getSupabaseAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('As variáveis de ambiente do Supabase não estão configuradas no servidor.');
    }
    return createClient(supabaseUrl, supabaseServiceKey);
}

function getMercadoPagoClient() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('O Access Token do Mercado Pago não está configurado no servidor.');
    }
    return new MercadoPagoConfig({ accessToken });
}

function getGeminiClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error('A chave da API do Gemini (API_KEY) não está configurada no servidor.');
    }
    return new GoogleGenAI({ apiKey });
}

async function logAction(supabase: SupabaseClient, action_type: string, status: 'SUCCESS' | 'FAILURE', description: string, details?: object) {
    const { error } = await supabase.from('action_logs').insert({ action_type, status, description, details });
    if (error) {
        console.error(`Failed to log action: ${action_type}`, error);
    }
}

// --- Handler para o Webhook de Autenticação do Supabase ---
async function handleAuthHook(req: VercelRequest, res: VercelResponse) {
    try {
        const supabase = getSupabaseAdminClient();
        const { type, record } = req.body;

        if (type === 'user.created' && record?.id && record?.email) {
            console.log(`Auth Hook: Novo usuário recebido - ID: ${record.id}, Email: ${record.email}`);
            const { error: rpcError } = await supabase.rpc('handle_new_user_creation', {
                user_id: record.id,
                user_email: record.email,
            });

            if (rpcError) {
                console.error('Erro ao chamar RPC handle_new_user_creation:', rpcError);
                throw new Error(`Falha ao criar perfil para o usuário ${record.id}`);
            }

            console.log(`Auth Hook: Perfil criado com sucesso para o usuário ${record.id}`);
            return res.status(200).json({ message: 'Perfil do usuário criado com sucesso.' });
        } else {
            console.log('Auth Hook: Evento recebido não é de criação de usuário ou está malformado.', req.body);
            return res.status(200).json({ message: 'Evento ignorado.' });
        }
    } catch (error: any) {
        console.error('Erro no processamento do Auth Hook:', error);
        return res.status(500).json({ error: 'Erro interno no webhook de autenticação.', message: error.message });
    }
}


// --- Handler para /api/mercadopago/create-preference ---
async function handleCreatePreference(req: VercelRequest, res: VercelResponse) {
    try {
        const client = getMercadoPagoClient();

        const { amount, description, id, redirect, payerEmail } = req.body;
        if (!amount || !description || !id) {
            return res.status(400).json({ error: 'Faltam dados obrigatórios da fatura.' });
        }
        
        const preference = new Preference(client);
        const preferenceBody: any = {
            items: [{ id: id, title: description, quantity: 1, unit_price: Number(amount), currency_id: 'BRL' }],
        };

        if (payerEmail) {
            preferenceBody.payer = { email: payerEmail };
        }

        if (redirect) {
            const origin = req.headers.origin || 'https://relpcell.com';
            preferenceBody.back_urls = { success: `${origin}?payment_status=success`, failure: `${origin}?payment_status=failure`, pending: `${origin}?payment_status=pending` };
            preferenceBody.auto_return = 'approved';
        }
        const result = await preference.create({ body: preferenceBody });
        res.status(200).json({ id: result.id, init_point: result.init_point });
    } catch (error: any) {
        console.error('Erro ao criar preferência do Mercado Pago:', error);
        res.status(500).json({ error: error?.cause?.error?.message || error?.message || 'Falha ao criar a preferência de pagamento.' });
    }
}

// --- Handler para /api/mercadopago/generate-message ---
async function handleGenerateMessage(req: VercelRequest, res: VercelResponse) {
    try {
        const genAI = getGeminiClient();
        
        const { customerName, amount } = req.body;
        if (!customerName || !amount) {
            return res.status(400).json({ error: 'Faltam os parâmetros customerName e amount.' });
        }

        const prompt = `Gere uma mensagem curta, amigável e profissional de confirmação de pagamento para um cliente chamado "${customerName}". O valor pago foi de R$ ${amount}. Agradeça ao cliente por sua pontualidade e por escolher a "Relp Cell". A mensagem deve ser em português do Brasil.`;
        const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        res.status(200).json({ message: response.text });
    } catch (error: any) {
        console.error("Error generating message with Gemini:", error);
        res.status(500).json({ error: 'Falha ao gerar a mensagem de confirmação.', message: error.message });
    }
}

// --- Handler para /api/mercadopago/process-payment ---
async function handleProcessPayment(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();

        const paymentData = req.body;
        if (!paymentData.token || !paymentData.payer?.email || !paymentData.transaction_amount) {
            return res.status(400).json({ message: 'Dados de pagamento incompletos.' });
        }
        
        const payment = new Payment(client);
        const result = await payment.create({ body: paymentData });

        if (result.id && result.external_reference) {
            const invoiceId = result.external_reference;
            const updateData: Partial<Invoice> = {
                payment_id: String(result.id),
                payment_method: result.payment_method?.id,
            };

            switch (result.status) {
                case 'approved':
                    updateData.status = 'Paga';
                    updateData.payment_date = new Date().toISOString();
                    break;
                case 'in_process':
                case 'pending':
                    updateData.status = result.payment_method?.id === 'boleto' ? 'Boleto Gerado' : 'Em aberto';
                     if (result.payment_method?.id === 'boleto') {
                        const transactionData = result.point_of_interaction?.transaction_data as any;
                        updateData.boleto_url = transactionData?.ticket_url;
                        updateData.boleto_barcode = transactionData?.bar_code?.content;
                    }
                    break;
                case 'rejected':
                case 'cancelled':
                     updateData.status = 'Cancelado';
                    break;
            }

            const { error: updateError } = await supabase.from('invoices')
                .update(updateData)
                .eq('id', invoiceId);
            
            if (updateError) {
                console.error(`Falha ao atualizar fatura ${invoiceId} após pagamento`, updateError);
                // Não falha a requisição, mas loga o erro
            }
        }
        
        if (result.status === 'approved' || result.status === 'in_process') {
            await logAction(supabase, 'PAYMENT_PROCESSED', 'SUCCESS', `Pagamento ${result.id} processado para fatura ${result.external_reference}. Status: ${result.status}`);
            res.status(200).json({ status: result.status, id: result.id, message: 'Pagamento processado com sucesso.' });
        } else {
            await logAction(supabase, 'PAYMENT_PROCESSED', 'FAILURE', `Pagamento para fatura ${result.external_reference} falhou. Status: ${result.status_detail}`, { result });
            res.status(400).json({ status: result.status, message: result.status_detail || 'Pagamento recusado.' });
        }
    } catch (error: any) {
        await logAction(supabase, 'PAYMENT_PROCESSED', 'FAILURE', `Erro no endpoint process-payment.`, { error: error.message });
        console.error('Erro ao processar pagamento com Mercado Pago:', error);
        res.status(500).json({ error: 'Falha ao processar o pagamento.', message: error?.cause?.message || error.message || 'Ocorreu um erro interno.' });
    }
}

// --- Handler para /api/mercadopago/webhook ---
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();

        const { body } = req;
        console.log('Webhook de pagamento recebido:', JSON.stringify(body, null, 2));
        if (body.type === 'payment' && body.data?.id) {
            const paymentId = body.data.id;
            
            const payment = new Payment(client);
            const paymentDetails = await payment.get({ id: paymentId });
            console.log('Detalhes do pagamento obtidos do MP:', JSON.stringify(paymentDetails, null, 2));
            
            if (!paymentDetails || !paymentDetails.id) {
                console.warn(`Payment ID ${paymentId} não encontrado no Mercado Pago.`);
                return res.status(200).send('OK. Pagamento não encontrado no MP.');
            }

            let newStatus: 'Paga' | 'Expirado' | 'Cancelado' | null = null;
            switch(paymentDetails.status) {
                case 'approved': newStatus = 'Paga'; break;
                case 'cancelled': newStatus = paymentDetails.status_detail === 'expired' ? 'Expirado' : 'Cancelado'; break;
            }

            if (newStatus) {
                const { data, error } = await supabase.from('invoices').update({ status: newStatus, payment_date: newStatus === 'Paga' ? new Date().toISOString() : null }).eq('payment_id', String(paymentId)).select();
                if (error) {
                    await logAction(supabase, 'INVOICE_STATUS_UPDATE', 'FAILURE', `Falha ao atualizar fatura para payment_id ${paymentId}.`, { error: error.message });
                    console.error(`Erro ao atualizar fatura para payment_id ${paymentId}:`, error);
                    return res.status(500).json({ error: 'Falha ao atualizar o banco de dados.' });
                }
                await logAction(supabase, 'INVOICE_STATUS_UPDATE', 'SUCCESS', `Fatura com payment_id ${paymentId} atualizada para ${newStatus}.`);
                console.log(`Fatura com payment_id ${paymentId} atualizada para ${newStatus}. Rows afetadas:`, data?.length);
            }
        }
        res.status(200).send('OK');
    } catch (error: any) {
        await logAction(supabase, 'WEBHOOK_PROCESSING', 'FAILURE', `Erro no processamento do webhook de pagamento.`, { error: error.message, body: req.body });
        console.error('Erro no processamento do webhook de pagamento:', error);
        res.status(500).json({ error: 'Erro interno no webhook.', message: error.message });
    }
}

// --- Roteador Principal ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname;

  // Rota de webhook aceita GET para verificação de URL pelo MP
  if (path === '/api/mercadopago/webhook') {
    return await handleWebhook(req, res);
  }

  // A rota do Auth Hook do Supabase deve ser POST
  if (path === '/api/mercadopago/auth-hook') {
      if (req.method === 'POST') {
          return await handleAuthHook(req, res);
      } else {
          res.setHeader('Allow', 'POST');
          return res.status(405).json({ error: `Method ${req.method} Not Allowed for Auth Hook` });
      }
  }

  // Demais rotas devem ser POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  switch (path) {
    case '/api/mercadopago/create-preference':
      return await handleCreatePreference(req, res);
    case '/api/mercadopago/generate-message':
      return await handleGenerateMessage(req, res);
    case '/api/mercadopago/process-payment':
      return await handleProcessPayment(req, res);
    default:
      return res.status(404).json({ error: 'Mercado Pago route not found' });
  }
}