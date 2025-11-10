import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { amount, description, payerEmail } = req.body;

    if (!amount || !description || !payerEmail) {
        return res.status(400).json({ error: 'Faltam dados obrigatórios para gerar o boleto.' });
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        console.error('Mercado Pago Access Token não configurado.');
        return res.status(500).json({ error: 'O provedor de pagamento não está configurado.' });
    }

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);
        
        // NOTA IMPORTANTE: Para a geração de boletos, a API do Mercado Pago exige
        // dados completos do pagador. Em uma aplicação real, estes dados deveriam ser
        // buscados do perfil do usuário logado no seu banco de dados (Supabase).
        // Para este exemplo, usamos dados de teste válidos.
        const paymentData = {
            transaction_amount: Number(amount),
            description: description,
            payment_method_id: 'bolbradesco', // Usando um ID específico de boleto
            payer: {
                email: payerEmail,
                first_name: "Test", // DADO DE TESTE
                last_name: "User", // DADO DE TESTE
                identification: {
                    type: "CPF",
                    number: "19119119100" // CPF de teste válido
                },
                address:  {
                    zip_code: "06233200",
                    street_name: "Av. das Nações Unidas",
                    street_number: "3003",
                    neighborhood: "Bonfim",
                    city: "Osasco",
                    federal_unit: "SP"
                }
            },
        };

        const result = await payment.create({ body: paymentData });
        
        // Acessa os dados da transação de forma segura para evitar erros de tipo
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