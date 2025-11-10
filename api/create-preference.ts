import { MercadoPagoConfig, Preference } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

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
         // URL para onde o Mercado Pago enviará notificações de pagamento (Webhook)
        notification_url: 'https://seusite.com/api/webhook-mercadopago',
      },
    };

    const result = await preference.create(preferenceData);
    res.status(200).json({ id: result.id });

  } catch (error) {
    console.error('Erro ao criar preferência do Mercado Pago:', error);
    res.status(500).json({ error: 'Falha ao criar a preferência de pagamento.' });
  }
}
