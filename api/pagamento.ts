import type { VercelRequest, VercelResponse } from "@vercel/node";
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Rota de API para criar uma preferência de pagamento genérica.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { title, price, quantity } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: 'Dados inválidos. Envie pelo menos title e price.' });
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('Mercado Pago Access Token não configurado.');
      return res.status(500).json({ error: 'O provedor de pagamento não está configurado.' });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const preferenceData = {
      items: [
        {
          id: `item-${Date.now()}`,
          title,
          quantity: Number(quantity) || 1,
          currency_id: 'BRL',
          unit_price: Number(price),
        },
      ],
      back_urls: {
        success: `${req.headers.origin}/sucesso`,
        failure: `${req.headers.origin}/erro`,
        pending: `${req.headers.origin}/pendente`,
      },
      auto_return: 'approved',
    };

    const result = await preference.create({ body: preferenceData });

    return res.status(200).json({
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    });

  } catch (error: any) {
    console.error('Erro ao criar preferência do Mercado Pago:', error);
    return res.status(500).json({
      error: 'Falha ao criar a preferência de pagamento',
      details: error.message,
    });
  }
}
