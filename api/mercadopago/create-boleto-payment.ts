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
        
        // NOTA: Em uma aplicação real, os dados completos do pagador (nome, sobrenome, CPF, endereço)
        // deveriam ser coletados do perfil do usuário ou em um formulário.
        // Aqui, usamos dados de teste para fins de demonstração.
        const paymentData = {
            transaction_amount: Number(amount),
            description: description,
            payment_method_id: 'boleto', // ID genérico para boleto
            payer: {
                email: payerEmail,
                first_name: "Cliente",
                last_name: "Relp Cell",
                identification: {
                    type: "CPF",
                    number: "19119119100" // CPF de teste
                },
                address: {
                    zip_code: "06233-200",
                    street_name: "Av. das Nações Unidas",
                    street_number: "3003",
                    neighborhood: "Bonfim",
                    city: "Osasco",
                    federal_unit: "SP"
                }
            },
        };

        const result = await payment.create({ body: paymentData });
        
        if (result.point_of_interaction?.transaction_data) {
            res.status(200).json({
                paymentId: result.id,
                boletoUrl: result.point_of_interaction.transaction_data.ticket_url,
                barCode: result.point_of_interaction.transaction_data.bar_code?.content, // Acessar com ?. por segurança
            });
        } else {
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