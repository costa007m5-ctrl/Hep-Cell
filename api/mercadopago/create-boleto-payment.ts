import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { amount, description, payer } = req.body;

    // Validação agora checa a estrutura plana recebida do frontend
    if (
        !amount || 
        !description || 
        !payer ||
        !payer.email ||
        !payer.fullName ||
        !payer.identificationType ||
        !payer.identificationNumber ||
        !payer.zipCode ||
        !payer.streetName ||
        !payer.streetNumber ||
        !payer.neighborhood ||
        !payer.city ||
        !payer.federalUnit
    ) {
        return res.status(400).json({ error: 'Dados do pagador ou do pagamento estão incompletos.' });
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        console.error('Mercado Pago Access Token não configurado.');
        return res.status(500).json({ error: 'O provedor de pagamento não está configurado.' });
    }

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);
        
        const nameParts = payer.fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '.';

        // CORREÇÃO: Mapeia a estrutura plana do 'payer' (frontend) para a estrutura aninhada (API MP)
        const paymentData = {
            transaction_amount: Number(amount),
            description: description,
            payment_method_id: 'boleto',
            payer: {
                email: payer.email,
                first_name: firstName,
                last_name: lastName,
                identification: {
                    type: payer.identificationType, // De payer.identificationType
                    number: payer.identificationNumber.replace(/\D/g, ''), // De payer.identificationNumber
                },
                address:  {
                    zip_code: payer.zipCode.replace(/\D/g, ''), // De payer.zipCode
                    street_name: payer.streetName,
                    street_number: payer.streetNumber,
                    neighborhood: payer.neighborhood,
                    city: payer.city,
                    federal_unit: payer.federalUnit,
                }
            },
        };

        const result = await payment.create({ body: paymentData });
        
        const transactionData = result.point_of_interaction?.transaction_data as any;

        if (transactionData && transactionData.ticket_url && transactionData.bar_code) {
            res.status(200).json({
                paymentId: result.id,
                boletoUrl: transactionData.ticket_url,
                barCode: transactionData.bar_code.content,
            });
        } else {
            console.error("Resposta inesperada do Mercado Pago:", result);
            throw new Error('A resposta da API do Mercado Pago não incluiu os dados do boleto.');
        }

    } catch (error: any) {
        console.error('Erro ao criar boleto com Mercado Pago:', error);
        res.status(500).json({
            error: 'Falha ao gerar o boleto.',
            message: error?.cause?.message || 'Ocorreu um erro interno.'
        });
    }
}