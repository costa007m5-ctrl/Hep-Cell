import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Espera-se que o corpo da requisição contenha os detalhes do pagamento e do pagador
    const { amount, description, payer } = req.body;

    // Validação robusta para todos os campos obrigatórios
    if (
        !amount || 
        !description || 
        !payer ||
        !payer.email ||
        !payer.firstName ||
        !payer.lastName ||
        !payer.identification ||
        !payer.identification.type ||
        !payer.identification.number ||
        !payer.address ||
        !payer.address.zipCode ||
        !payer.address.streetName ||
        !payer.address.streetNumber ||
        !payer.address.neighborhood ||
        !payer.address.city ||
        !payer.address.federalUnit
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
        
        // Constrói o corpo da requisição para a API do Mercado Pago
        const paymentData = {
            transaction_amount: Number(amount),
            description: description,
            payment_method_id: 'boleto',
            payer: {
                email: payer.email,
                first_name: payer.firstName,
                last_name: payer.lastName,
                identification: {
                    type: payer.identification.type,
                    number: payer.identification.number.replace(/\D/g, ''), // Remove caracteres não numéricos
                },
                address:  {
                    zip_code: payer.address.zipCode.replace(/\D/g, ''), // Remove caracteres não numéricos
                    street_name: payer.address.streetName,
                    street_number: payer.address.streetNumber,
                    neighborhood: payer.address.neighborhood,
                    city: payer.address.city,
                    federal_unit: payer.address.federalUnit,
                }
            },
        };

        const result = await payment.create({ body: paymentData });
        
        // Acessa os dados da transação de forma segura
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
