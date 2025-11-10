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

    // NOTA: Para aumentar a chance de aprovação de pagamentos com cartão,
    // é fundamental fornecer dados completos do pagador.
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
       payer: {
          email: payerEmail,
          // Em uma aplicação real, estes dados viriam do perfil do usuário no Supabase.
          first_name: "Test",
          last_name: "User",
          identification: {
            type: "CPF",
            number: "19119119100" // CPF de teste
          }
      },
    };

    // Se o frontend solicitou um redirecionamento, configuramos as URLs de retorno
    if (redirect) {
        const origin = req.headers.origin || 'https://relpcell.com'; // Use um fallback seguro
        preferenceBody.back_urls = {
            success: `${origin}?payment_status=success`,
            failure: `${origin}?payment_status=failure`,
            pending: `${origin}?payment_status=pending`,
        };
        preferenceBody.auto_return = 'approved';
    }

    const result = await preference.create({ body: preferenceBody });

    // Retorna tanto o ID da preferência (para o Brick) quanto o init_point (para o redirecionamento)
    res.status(200).json({ id: result.id, init_point: result.init_point });
    
  } catch (error: any) {
    console.error('Erro ao criar preferência do Mercado Pago:', error);
    // Tenta extrair uma mensagem mais detalhada do erro da API
    const errorMessage = error?.cause?.error?.message || error?.message || 'Falha ao criar a preferência de pagamento.';
    res.status(500).json({ error: errorMessage });
  }
}