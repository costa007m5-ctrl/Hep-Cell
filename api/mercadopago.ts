
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { URL } from 'url';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
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
    try {
        const { error } = await supabase.from('action_logs').insert({ action_type, status, description, details });
        if (error) {
            console.error(`Failed to log action: ${action_type}`, error);
        }
    } catch (e) {
        console.error('Logging action failed before it could be sent to Supabase.', e);
    }
}

// Helper para traduzir erros de pagamento
function getPaymentErrorMessage(statusDetail: string): string {
    const messages: { [key: string]: string } = {
        'cc_rejected_bad_filled_card_number': 'Revise o número do cartão.',
        'cc_rejected_bad_filled_date': 'Revise a data de vencimento.',
        'cc_rejected_bad_filled_other': 'Revise os dados do pagamento.',
        'cc_rejected_bad_filled_security_code': 'Revise o código de segurança do cartão.',
        'cc_rejected_blacklist': 'Não pudemos processar seu pagamento.',
        'cc_rejected_call_for_authorize': 'Você deve autorizar o pagamento com o banco emissor do cartão.',
        'cc_rejected_card_disabled': 'Ligue para o banco para ativar seu cartão.',
        'cc_rejected_card_error': 'Não conseguimos processar seu pagamento.',
        'cc_rejected_duplicated_payment': 'Você já fez um pagamento com esse valor. Caso precise pagar de novo, utilize outro cartão ou outra forma de pagamento.',
        'cc_rejected_high_risk': 'Seu pagamento foi recusado por segurança. Escolha outra forma de pagamento.',
        'cc_rejected_insufficient_amount': 'Seu cartão possui saldo insuficiente.',
        'cc_rejected_invalid_installments': 'O cartão não processa pagamentos em parcelas.',
        'cc_rejected_max_attempts': 'Você atingiu o limite de tentativas permitidas. Escolha outro cartão ou outra forma de pagamento.',
        'cc_rejected_other_reason': 'O banco emissor não processou o pagamento.',
        'cc_rejected_card_type_not_allowed': 'O pagamento foi rejeitado porque o tipo de cartão não é aceito.'
    };

    return messages[statusDetail] || `O pagamento foi recusado pelo banco. Motivo: ${statusDetail}`;
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
            external_reference: id,
             // Configurações para melhorar a experiência
            statement_descriptor: "RELP CELL",
            binary_mode: true, // Recusa pagamentos pendentes que requerem aprovação manual complexa
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

// --- Handler para /api/mercadopago/process-payment (Card Form) ---
async function handleProcessPayment(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();
        const paymentData = req.body;

        // Suporte robusto para camelCase (SDK JS v2) e snake_case
        const token = paymentData.token;
        const issuerId = paymentData.issuer_id || paymentData.issuerId;
        const paymentMethodId = paymentData.payment_method_id || paymentData.paymentMethodId;
        const transactionAmount = Number(paymentData.transaction_amount || paymentData.transactionAmount);
        const installments = Number(paymentData.installments);
        const payerEmail = paymentData.payer?.email;
        const externalReference = String(paymentData.external_reference || paymentData.externalReference || '');

        // Validação Básica
        if (!token || !transactionAmount || !payerEmail || !paymentMethodId) {
            console.error("Dados incompletos recebidos do frontend:", paymentData);
            return res.status(400).json({ message: 'Dados de pagamento incompletos. Verifique o cartão e tente novamente.' });
        }
        
        const payment = new Payment(client);
        
        // Construção Segura do Payload (Sanitização)
        const payload = {
            token,
            issuer_id: issuerId,
            payment_method_id: paymentMethodId,
            transaction_amount: transactionAmount,
            installments: installments,
            description: paymentData.description || 'Pagamento Relp Cell',
            payer: {
                email: payerEmail,
                identification: paymentData.payer.identification ? {
                    type: paymentData.payer.identification.type,
                    number: paymentData.payer.identification.number
                } : undefined
            },
            external_reference: externalReference
        };

        console.log("Processando pagamento Card:", JSON.stringify({ ...payload, token: '***' }));

        const result = await payment.create({ body: payload });
        const invoiceId = result.external_reference;

        if (result.status === 'approved') {
            if (invoiceId) {
                await supabase.from('invoices').update({ status: 'Paga', payment_id: String(result.id), payment_date: new Date().toISOString() }).eq('id', invoiceId);
            }
            await logAction(supabase, 'PAYMENT_PROCESSED', 'SUCCESS', `Pagamento Cartão ${result.id} APROVADO.`);
            return res.status(200).json({ status: result.status, id: result.id, message: 'Pagamento aprovado.' });
        } else if (result.status === 'in_process' || result.status === 'pending') {
            await logAction(supabase, 'PAYMENT_PROCESSED', 'SUCCESS', `Pagamento Cartão ${result.id} EM ANÁLISE.`);
            return res.status(200).json({ status: result.status, id: result.id, message: 'Pagamento em análise.' });
        } else {
             const failMessage = getPaymentErrorMessage(result.status_detail || 'unknown');
             await logAction(supabase, 'PAYMENT_PROCESSED', 'FAILURE', `Pagamento Cartão ${result.id} RECUSADO: ${result.status_detail}`);
            return res.status(200).json({ 
                status: result.status, 
                message: failMessage,
                detail: result.status_detail 
            });
        }
    } catch (error: any) {
        console.error('Erro CRÍTICO ao processar cartão:', error);
        await logAction(supabase, 'PAYMENT_PROCESSED', 'FAILURE', `Erro técnico processamento cartão.`, { error: error.message });
        return res.status(500).json({ error: 'Erro no servidor de pagamento.', message: error.message || 'Falha na comunicação com a operadora.' });
    }
}

// --- Handler para PIX ---
async function handleCreatePixPayment(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const client = getMercadoPagoClient();
        const { invoiceId, amount, description, payerEmail, userId, firstName, lastName, identificationNumber } = req.body;

        if (!invoiceId || !amount || !description || !payerEmail || !userId) {
            return res.status(400).json({ message: 'Dados da fatura e do usuário são obrigatórios.' });
        }

        let profile = { first_name: firstName, last_name: lastName, identification_number: identificationNumber };

        if (!firstName || !lastName || !identificationNumber) {
            const { data, error } = await supabase.from('profiles').select('first_name, last_name, identification_number').eq('id', userId).single();
            if (error || !data || !data.first_name || !data.last_name || !data.identification_number) {
                 return res.status(400).json({ code: 'INCOMPLETE_PROFILE', message: 'Seu perfil está incompleto. Por favor, preencha seu nome completo e CPF para continuar.' });
            }
            profile = data;
        }

        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: amount,
                description: description,
                payment_method_id: 'pix',
                external_reference: invoiceId,
                payer: {
                    email: payerEmail,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    identification: { type: 'CPF', number: profile.identification_number!.replace(/\D/g, '') }
                }
            }
        });

        if (!result.id || !result.point_of_interaction?.transaction_data) {
            throw new Error('Resposta inválida da API do Mercado Pago ao criar PIX.');
        }

        const qrCode = result.point_of_interaction.transaction_data.qr_code;
        const expirationDate = result.date_of_expiration;

        // Salva o código PIX no banco para persistência
        await supabase.from('invoices').update({ 
            payment_id: String(result.id), 
            status: 'Em aberto',
            payment_method: 'pix',
            payment_code: qrCode, // Novo campo
            payment_expiration: expirationDate // Novo campo
        }).eq('id', invoiceId);

        await logAction(supabase, 'PIX_CREATED', 'SUCCESS', `PIX gerado para fatura ${invoiceId}.`);

        res.status(200).json({
            paymentId: result.id,
            qrCode: qrCode,
            qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64,
            expires: expirationDate,
        });

    } catch (error: any) {
         await logAction(supabase, 'PIX_CREATED', 'FAILURE', `Falha ao gerar PIX.`, { error: error.message, body: req.body });
        res.status(500).json({ message: error.message });
    }
}

// --- Handler para Boleto ---
async function handleCreateBoletoPayment(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const client = getMercadoPagoClient();
    try {
        const { invoiceId, amount, description, payer } = req.body;
        if (!invoiceId || !amount || !description || !payer) {
            return res.status(400).json({ error: 'Dados da fatura e do pagador são obrigatórios.' });
        }
        
        // Sanitização rigorosa para Boleto
        // CEP deve ser apenas números
        const zipCodeClean = payer.zipCode.replace(/\D/g, '');
        // Número da casa deve ser preenchido. Se vazio, coloca 'S/N'
        const streetNumberClean = payer.streetNumber || 'S/N';
        
        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: amount,
                description: description,
                payment_method_id: 'bolbradesco', // Usando Bradesco como padrão, geralmente o mais estável
                external_reference: invoiceId,
                payer: {
                    email: payer.email,
                    first_name: payer.firstName,
                    last_name: payer.lastName,
                    identification: { type: 'CPF', number: payer.identificationNumber.replace(/\D/g, '') },
                    address: {
                        zip_code: zipCodeClean,
                        street_name: payer.streetName,
                        street_number: streetNumberClean,
                        neighborhood: payer.neighborhood,
                        city: payer.city,
                        federal_unit: payer.federalUnit,
                    },
                },
            },
        });

        // Extração robusta dos dados do boleto
        const responseData = result as any;
        
        // Tenta encontrar a URL do boleto em diferentes locais da resposta
        const boletoUrl = 
            responseData.transaction_details?.external_resource_url || 
            responseData.point_of_interaction?.transaction_data?.ticket_url;

        // Tenta encontrar o código de barras em diferentes locais
        const boletoBarcode = 
            responseData.barcode?.content || 
            responseData.point_of_interaction?.transaction_data?.bar_code;
        
        if (!result.id || !boletoUrl) {
            console.error("Erro: Boleto não gerado. Resposta do MP:", JSON.stringify(result, null, 2));
            throw new Error('O Mercado Pago não retornou o link do boleto. Verifique se o endereço e CEP estão corretos.');
        }

        await supabase.from('invoices').update({
            payment_id: String(result.id),
            status: 'Boleto Gerado',
            boleto_url: boletoUrl,
            boleto_barcode: boletoBarcode || null,
            payment_method: 'boleto'
        }).eq('id', invoiceId);

        await logAction(supabase, 'BOLETO_CREATED', 'SUCCESS', `Boleto gerado para fatura ${invoiceId}.`);
        res.status(200).json({ paymentId: result.id, boletoUrl, boletoBarcode });

    } catch (error: any) {
        await logAction(supabase, 'BOLETO_CREATED', 'FAILURE', `Falha ao gerar boleto.`, { error: error.message, body: req.body });
        console.error("Erro no handler Boleto:", error);
        res.status(500).json({ error: 'Falha ao gerar boleto.', message: error.message || 'Erro de comunicação com o Mercado Pago.' });
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

            let newStatus: Invoice['status'] | null = null;
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

  if (path === '/api/mercadopago/webhook') {
    return await handleWebhook(req, res);
  }

  if (path === '/api/mercadopago/auth-hook') {
      if (req.method === 'POST') return await handleAuthHook(req, res);
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: `Method ${req.method} Not Allowed for Auth Hook` });
  }

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
    case '/api/mercadopago/create-pix-payment':
      return await handleCreatePixPayment(req, res);
    case '/api/mercadopago/create-boleto-payment':
      return await handleCreateBoletoPayment(req, res);
    default:
      return res.status(404).json({ error: 'Mercado Pago route not found' });
  }
}
