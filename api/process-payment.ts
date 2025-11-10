import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        console.error('Mercado Pago Access Token não configurado.');
        return res.status(500).json({ error: 'O provedor de pagamento não está configurado.' });
    }

    try {
        const paymentData = req.body;

        if (!paymentData.token || !paymentData.payer?.email || !paymentData.transaction_amount) {
            return res.status(400).json({ message: 'Dados de pagamento incompletos.' });
        }
        
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        const result = await payment.create({
            body: {
                transaction_amount: paymentData.transaction_amount,
                token: paymentData.token,
                description: paymentData.description,
                installments: paymentData.installments,
                payment_method_id: paymentData.payment_method_id,
                payer: {
                    email: paymentData.payer.email,
                    first_name: paymentData.payer.firstName,
                    last_name: paymentData.payer.lastName,
                    identification: {
                        type: paymentData.payer.identification.type,
                        number: paymentData.payer.identification.number,
                    },
                },
            },
        });

        if (result.status === 'approved' || result.status === 'in_process') {
            res.status(200).json({ status: result.status, id: result.id, message: 'Pagamento processado com sucesso.' });
        } else {
            res.status(400).json({ status: result.status, message: result.status_detail || 'Pagamento recusado.' });
        }

    } catch (error: any) {
        console.error('Erro ao processar pagamento com Mercado Pago:', error);
        res.status(500).json({
            error: 'Falha ao processar o pagamento.',
            message: error?.cause?.message || 'Ocorreu um erro interno.'
        });
    }
}
