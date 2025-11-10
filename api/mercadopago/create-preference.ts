import { MercadoPagoConfig, Preference } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';


// Esta função é executada como uma Vercel Serverless Function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Extrai os dados da fatura do corpo da requisição, incluindo o e-mail do pagador
  const { amount, description, id, redirect, payerEmail } = req.body;

  if (!amount || !description || !id) {
    return res.status(400).json({ error: 'Faltam dados obrigatórios da fatura.' });
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('Mercado Pago Access Token não configurado.');
    return res.status(500).json({ error: 'O provedor de pagamento não está configurado.' });
  }

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const preferenceBody: any = {
      items: [
        {
          id: id,
          title: description,
          quantity: 1,
          unit_price: Number(amount),
          currency_id: 'BRL',
        },
      ],
    };

    // Adiciona o e-mail do pagador ao corpo da preferência para melhorar a análise de risco
    if (payerEmail) {
        preferenceBody.payer = {
            email: payerEmail,
        };
    }

    // Se o frontend solicitou um redirecionamento, configuramos as URLs de retorno
    if (redirect) {
        const origin = req.headers.origin || 'https://relpcell.com'; // Use um fallback seguro
        preferenceBody.back_urls = {
            success: `${origin}`,
            failure: `${origin}`,
            pending: `${origin}`,
        };
        preferenceBody.auto_return = 'approved';
    }

    const result = await preference.create({ body: preferenceBody });

    // Retorna tanto o ID da preferência (para o Brick) quanto o init_point (para o redirecionamento)
    res.status(200).json({ id: result.id, init_point: result.init_point });
    
  } catch (error) {
    console.error('Erro ao criar preferência do Mercado Pago:', error);
    res.status(500).json({ error: 'Falha ao criar a preferência de pagamento.' });
  }
}