import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { amount, description, payerEmail } = req.body;

    if (!amount || !description || !payerEmail) {
        return res.status(400).json({ error: 'Faltam dados obrigatórios para gerar o PIX.' });
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        console.error('Mercado Pago Access Token não configurado.');
        return res.status(500).json({ error: 'O provedor de pagamento não está configurado.' });
    }

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);
        
        // Define a data de expiração para 30 minutos a partir de agora
        const expirationDate = new Date();
        expirationDate.setMinutes(expirationDate.getMinutes() + 30);

        const paymentData = {
            transaction_amount: Number(amount),
            description: description,
            payment_method_id: 'pix',
            payer: {
                email: payerEmail,
            },
            date_of_expiration: expirationDate.toISOString().replace(/\.\d{3}Z$/, 'Z') // Formato ISO 8601
        };

        const result = await payment.create({ body: paymentData });
        
        // Verifica se a resposta contém os dados necessários para o PIX
        if (result.point_of_interaction?.transaction_data) {
            res.status(200).json({
                paymentId: result.id,
                qrCode: result.point_of_interaction.transaction_data.qr_code,
                qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64,
                expires: result.date_of_expiration,
            });
        } else {
            throw new Error('A resposta da API do Mercado Pago não incluiu os dados do PIX.');
        }

    } catch (error: any) {
        console.error('Erro ao criar pagamento PIX com Mercado Pago:', error);
        res.status(500).json({
            error: 'Falha ao gerar o código PIX.',
            message: error?.cause?.message || 'Ocorreu um erro interno.'
        });
    }
}