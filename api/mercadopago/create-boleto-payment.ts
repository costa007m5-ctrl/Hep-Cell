import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente Supabase fora do handler para reutilização
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { amount, description, payer, invoiceId } = req.body;

    if (
        !amount || !description || !payer || !payer.email ||
        !payer.firstName || !payer.lastName || !payer.identificationType ||
        !payer.identificationNumber || !payer.zipCode || !payer.streetName ||
        !payer.streetNumber || !payer.neighborhood || !payer.city ||
        !payer.federalUnit || !invoiceId
    ) {
        return res.status(400).json({ error: 'Dados do pagador, da fatura ou do pagamento estão incompletos.' });
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        console.error('Mercado Pago Access Token não configurado.');
        return res.status(500).json({ error: 'O provedor de pagamento não está configurado.' });
    }

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);
        
        const paymentData = {
            transaction_amount: Number(amount),
            description: description,
            payment_method_id: 'bolbradesco',
            payer: {
                email: payer.email,
                first_name: payer.firstName,
                last_name: payer.lastName,
                identification: { type: payer.identificationType, number: payer.identificationNumber.replace(/\D/g, '') },
                address:  {
                    zip_code: payer.zipCode.replace(/\D/g, ''),
                    street_name: payer.streetName,
                    street_number: payer.streetNumber,
                    neighborhood: payer.neighborhood,
                    city: payer.city,
                    federal_unit: payer.federalUnit,
                }
            },
            external_reference: invoiceId, // Salva o ID da nossa fatura no MP
        };

        const result = await payment.create({ body: paymentData });
        
        const transactionData = result.point_of_interaction?.transaction_data as any;

        // A API do Mercado Pago retorna o código de barras dentro de um objeto { content: "..." }
        if (transactionData && transactionData.ticket_url && transactionData.bar_code?.content) {
            
            // --- INÍCIO DA LÓGICA DE ARMAZENAMENTO ---
            // Este é o bloco de código crucial que armazena os detalhes do boleto no seu banco de dados Supabase.
            // É daqui que o aplicativo lê as informações para mostrar ao cliente depois.
            const { error: updateError } = await supabase
                .from('invoices') // 1. Seleciona a tabela 'invoices'.
                .update({ // 2. Prepara uma operação para atualizar uma fatura existente.
                    status: 'Boleto Gerado',                           // -> Atualiza o status.
                    payment_id: String(result.id),                      // -> Armazena o ID do pagamento do Mercado Pago.
                    boleto_url: transactionData.ticket_url,             // -> Armazena o LINK para visualizar o PDF do boleto.
                    boleto_barcode: transactionData.bar_code.content,   // -> Armazena o CÓDIGO DE BARRAS do boleto.
                    payment_method: 'Boleto'                            // -> Define o método de pagamento.
                })
                .eq('id', invoiceId); // 3. Garante que estamos atualizando a fatura correta, usando o ID que veio do app.
            // --- FIM DA LÓGICA DE ARMAZENAMENTO ---
            
            if (updateError) {
                // Se falhar, tenta cancelar o pagamento no MP para evitar inconsistência
                console.error('Falha ao salvar dados do boleto no Supabase:', updateError);
                await payment.cancel({ id: result.id! });
                throw new Error('Falha ao salvar os detalhes do boleto no banco de dados.');
            }

            res.status(200).json({
                message: "Boleto gerado e salvo com sucesso!",
                paymentId: result.id,
                boletoUrl: transactionData.ticket_url,
                boletoBarcode: transactionData.bar_code.content,
            });
        } else {
            console.error("Resposta inesperada do Mercado Pago:", result);
            throw new Error('A resposta da API do Mercado Pago não incluiu os dados do boleto.');
        }

    } catch (error: any) {
        console.error('Erro ao criar boleto com Mercado Pago:', error);
        res.status(500).json({
            error: 'Falha ao gerar o boleto.',
            message: error?.cause?.message || error.message || 'Ocorreu um erro interno.'
        });
    }
}