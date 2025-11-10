import { MercadoPagoConfig, Preference } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';


// Esta função é executada como uma Vercel Serverless Function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Extrai os dados da fatura do corpo da requisição
  const { amount, description, id } = req.body;

  if (!amount || !description || !id) {
    return res.status(400).json({ error: 'Faltam dados obrigatórios da fatura.' });
  }

  // O Access Token é lido de forma segura das variáveis de ambiente no servidor.
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('Mercado Pago Access Token não configurado.');
    return res.status(500).json({ error: 'O provedor de pagamento não está configurado.' });
  }

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const preferenceData = {
      body: {
        items: [
          {
            id: id,
            title: description,
            quantity: 1,
            unit_price: Number(amount),
            currency_id: 'BRL',
          },
        ],
        // O `payment brick` lida com o fluxo de pagamento no frontend,
        // então `back_urls` e `auto_return` não são mais necessários para este fluxo.
        // back_urls: {
        //     success: `${req.headers.origin}/`,
        //     failure: `${req.headers.origin}/`,
        //     pending: `${req.headers.origin}/`,
        // },
        // auto_return: 'approved',
      },
    };

    const result = await preference.create(preferenceData);

    // Retorna o ID da preferência para o frontend inicializar o Brick
    res.status(200).json({ id: result.id });
  } catch (error) {
    console.error('Erro ao criar preferência do Mercado Pago:', error);
    res.status(500).json({ error: 'Falha ao criar a preferência de pagamento.' });
  }
}
