import type { VercelRequest, VercelResponse } from '@vercel/node';
import { URL } from 'url';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

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


// --- Handler para /api/mercadopago/create-boleto-payment ---
async function handleCreateBoletoPayment(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const { invoiceId } = req.body;
    
    try {
        const client = getMercadoPagoClient();
        
        const { amount, description, payer } = req.body;
        
        // Validação detalhada
        const missingFields = [];
        if (!amount) missingFields.push('amount');
        if (!description) missingFields.push('description');
        if (!invoiceId) missingFields.push('invoiceId');
        if (!payer) missingFields.push('payer');
        if (payer) {
            if (!payer.email) missingFields.push('payer.email');
            if (!payer.firstName) missingFields.push('payer.firstName');
            if (!payer.lastName) missingFields.push('payer.lastName');
            if (!payer.identificationType) missingFields.push('payer.identificationType');
            if (!payer.identificationNumber) missingFields.push('payer.identificationNumber');
            if (!payer.zipCode) missingFields.push('payer.zipCode');
            if (!payer.streetName) missingFields.push('payer.streetName');
            if (!payer.streetNumber) missingFields.push('payer.streetNumber');
            if (!payer.neighborhood) missingFields.push('payer.neighborhood');
            if (!payer.city) missingFields.push('payer.city');
            if (!payer.federalUnit) missingFields.push('payer.federalUnit');
        }
        
        if (missingFields.length > 0) {
            console.error('Campos faltando:', missingFields);
            return res.status(400).json({ 
                error: 'Dados incompletos', 
                message: `Campos obrigatórios faltando: ${missingFields.join(', ')}`,
                missingFields 
            });
        }

        console.log('Criando boleto com dados:', {
            amount,
            description,
            payer: {
                email: payer.email,
                firstName: payer.firstName,
                lastName: payer.lastName,
            }
        });

        const payment = new Payment(client);
        const paymentData = {
            transaction_amount: Number(amount),
            description: description,
            payment_method_id: 'boleto',
            payer: {
                email: payer.email, 
                first_name: payer.firstName, 
                last_name: payer.lastName,
                identification: { 
                    type: payer.identificationType, 
                    number: payer.identificationNumber.replace(/\D/g, '') 
                },
                address: { 
                    zip_code: payer.zipCode.replace(/\D/g, ''), 
                    street_name: payer.streetName, 
                    street_number: payer.streetNumber, 
                    neighborhood: payer.neighborhood, 
                    city: payer.city, 
                    federal_unit: payer.federalUnit 
                }
            },
            external_reference: invoiceId,
        };
        
        console.log('Enviando para Mercado Pago:', JSON.stringify(paymentData, null, 2));
        
        const result = await payment.create({ body: paymentData });
        
        console.log('Resposta do Mercado Pago:', JSON.stringify(result, null, 2));
        
        const transactionData = result.point_of_interaction?.transaction_data as any;

        if (transactionData && transactionData.ticket_url && transactionData.bar_code?.content) {
            const { error: updateError } = await supabase.from('invoices').update({ 
                status: 'Boleto Gerado', 
                payment_id: String(result.id), 
                boleto_url: transactionData.ticket_url, 
                boleto_barcode: transactionData.bar_code.content, 
                payment_method: 'Boleto' 
            }).eq('id', invoiceId);
            
            if (updateError) {
                console.error('Falha ao salvar dados do boleto no Supabase:', updateError);
                await payment.cancel({ id: result.id! });
                throw new Error('Falha ao salvar os detalhes do boleto no banco de dados.');
            }
            
            await logAction(supabase, 'BOLETO_GENERATED', 'SUCCESS', `Boleto para fatura ${invoiceId} gerado com sucesso.`);
            
            res.status(200).json({ 
                message: "Boleto gerado e salvo com sucesso!", 
                paymentId: result.id, 
                boletoUrl: transactionData.ticket_url, 
                boletoBarcode: transactionData.bar_code.content 
            });
        } else {
            console.error("Resposta inesperada do Mercado Pago:", JSON.stringify(result, null, 2));
            throw new Error('A resposta da API do Mercado Pago não incluiu os dados do boleto.');
        }
    } catch (error: any) {
        console.error('Erro ao criar boleto com Mercado Pago:', error);
        console.error('Stack trace:', error.stack);
        
        await logAction(supabase, 'BOLETO_GENERATED', 'FAILURE', `Falha ao gerar boleto para fatura ${invoiceId}.`, { 
            error: error.message,
            stack: error.stack,
            cause: error.cause 
        });
        
        res.status(500).json({ 
            error: 'Falha ao gerar o boleto.', 
            message: error?.cause?.message || error.message || 'Ocorreu um erro interno.',
            details: error.cause || error
        });
    }
}

// --- Handler para /api/mercadopago/create-pix-payment ---
function formatDateForMP(date: Date): string {
    const offset = -date.getTimezoneOffset();
    const offsetSign = offset >= 0 ? '+' : '-';
    const offsetHours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
    const offsetMinutes = (Math.abs(offset) % 60).toString().padStart(2, '0');
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}T${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}${offsetSign}${offsetHours}:${offsetMinutes}`;
}

async function handleCreatePixPayment(req: VercelRequest, res: VercelResponse) {
    const client = getMercadoPagoClient();
    const payment = new Payment(client);
    const supabase = getSupabaseAdminClient();
    const { invoiceId } = req.body;
    let paymentIdToCancel: number | undefined;

    try {
        const { amount, description, payerEmail, userId, firstName, lastName, identificationNumber } = req.body;
        if (!amount || !description || !payerEmail || !invoiceId || !userId) {
            return res.status(400).json({ error: 'Faltam dados obrigatórios para gerar o PIX.' });
        }
        
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name, identification_number')
            .eq('id', userId)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Erro ao buscar perfil para PIX:', profileError);
            return res.status(500).json({ message: 'Erro ao consultar dados do usuário.' });
        }

        const finalPayerInfo = {
            firstName: profile?.first_name || firstName,
            lastName: profile?.last_name || lastName,
            identificationNumber: profile?.identification_number || identificationNumber
        };

        if (!finalPayerInfo.firstName || !finalPayerInfo.lastName || !finalPayerInfo.identificationNumber) {
            return res.status(400).json({ 
                code: 'INCOMPLETE_PROFILE',
                message: 'Para gerar um PIX, por favor, preencha seu nome completo e CPF.' 
            });
        }
        
        if ((firstName || lastName || identificationNumber) && userId) {
            supabase.from('profiles').update({
                first_name: finalPayerInfo.firstName,
                last_name: finalPayerInfo.lastName,
                identification_number: finalPayerInfo.identificationNumber,
                updated_at: new Date().toISOString()
            }).eq('id', userId).then(({ error: updateError }) => {
                if (updateError) console.error("Falha ao atualizar o perfil em segundo plano:", updateError);
                else console.log(`Perfil do usuário ${userId} atualizado em segundo plano.`);
            });
        }
        
        const expirationDate = new Date();
        expirationDate.setMinutes(expirationDate.getMinutes() + 30);
        const paymentData = {
            transaction_amount: Number(amount),
            description: description,
            payment_method_id: 'pix',
            payer: {
                email: payerEmail,
                first_name: finalPayerInfo.firstName,
                last_name: finalPayerInfo.lastName,
                identification: { type: "CPF", number: finalPayerInfo.identificationNumber.replace(/\D/g, '') }
            },
            date_of_expiration: formatDateForMP(expirationDate),
            external_reference: invoiceId,
        };
        const result = await payment.create({ body: paymentData });
        paymentIdToCancel = result.id;

        const transactionData = result.point_of_interaction?.transaction_data as any;

        if (result.id && transactionData?.qr_code && transactionData?.qr_code_base64) {
            const { error: updateError } = await supabase.from('invoices').update({ payment_id: String(result.id), payment_method: 'PIX' }).eq('id', invoiceId);
            if (updateError) {
                console.error('Falha ao salvar o ID do pagamento PIX no Supabase:', updateError);
                // Adiciona a mensagem de erro original do Supabase para melhor depuração.
                throw new Error(`Falha ao vincular o pagamento PIX à fatura no banco de dados. Detalhes: ${updateError.message}`);
            }
            
            await logAction(supabase, 'PIX_GENERATED', 'SUCCESS', `PIX para fatura ${invoiceId} gerado com sucesso.`);
            res.status(200).json({ paymentId: result.id, qrCode: transactionData.qr_code, qrCodeBase64: transactionData.qr_code_base64, expires: result.date_of_expiration });
        } else {
            console.error("Resposta inesperada do Mercado Pago ao criar PIX (sem dados de QR):", result);
            throw new Error('A resposta da API do Mercado Pago não incluiu os dados do QR Code.');
        }
    } catch (error: any) {
        console.error('Erro ao criar pagamento PIX com Mercado Pago:', error);
        await logAction(supabase, 'PIX_GENERATED', 'FAILURE', `Falha ao gerar PIX para fatura ${invoiceId}.`, { error: error.message });
        if (paymentIdToCancel) {
            console.log(`Tentando cancelar o pagamento ${paymentIdToCancel} devido a um erro...`);
            await payment.cancel({ id: paymentIdToCancel }).catch(cancelError => 
                console.error(`Falha ao tentar cancelar o pagamento ${paymentIdToCancel}:`, cancelError)
            );
        }
        res.status(500).json({ error: 'Falha ao gerar o código PIX.', message: error?.cause?.message || error.message || 'Ocorreu um erro interno.' });
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
            payer: { email: payerEmail, first_name: "Test", last_name: "User", identification: { type: "CPF", number: "19119119100" } }
        };
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
    try {
        const client = getMercadoPagoClient();

        const paymentData = req.body;
        if (!paymentData.token || !paymentData.payer?.email || !paymentData.transaction_amount) {
            return res.status(400).json({ message: 'Dados de pagamento incompletos.' });
        }
        
        const payment = new Payment(client);
        const result = await payment.create({ body: paymentData });
        if (result.status === 'approved' || result.status === 'in_process') {
            res.status(200).json({ status: result.status, id: result.id, message: 'Pagamento processado com sucesso.' });
        } else {
            res.status(400).json({ status: result.status, message: result.status_detail || 'Pagamento recusado.' });
        }
    } catch (error: any) {
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
    case '/api/mercadopago/create-boleto-payment':
      return await handleCreateBoletoPayment(req, res);
    case '/api/mercadopago/create-pix-payment':
      return await handleCreatePixPayment(req, res);
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