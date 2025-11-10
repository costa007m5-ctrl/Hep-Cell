import { MercadoPagoConfig, Preference } from 'mercadopago';

// Esta função é executada como uma Vercel Serverless Function
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Extrai os dados da fatura do corpo da requisição
  const { amount, description, id } = req.body;

  if (!amount || !description || !id) {
    return res.status(400).json({ error: 'Faltam dados obrigatórios da fatura.' });
  }

  // O Access Token é lido de forma segura das variáveis de ambiente do servidor (Vercel).
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('Mercado Pago Access Token (MERCADO_PAGO_ACCESS_TOKEN) não está configurado nas variáveis de ambiente.');
    return res.status(500).json({ error: 'O provedor de pagamento não está configurado corretamente.' });
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
        // Para uma aplicação real, você coletaria informações do pagador.
        // Por enquanto, usamos um placeholder.
        payer: {
            email: `customer-${Date.now()}@relpcell.com`
        },
        // URLs de retorno após o pagamento
        back_urls: {
            success: `${req.headers.origin}/?payment_status=success&invoice_id=${id}`,
            failure: `${req.headers.origin}/?payment_status=failure&invoice_id=${id}`,
            pending: `${req.headers.origin}/?payment_status=pending&invoice_id=${id}`,
        },
        auto_return: 'approved',
      },
    };

    const result = await preference.create(preferenceData);

    // Retorna o ID da preferência para o frontend
    res.status(200).json({ id: result.id });
  } catch (error) {
    console.error('Erro ao criar preferência do Mercado Pago:', error);
    res.status(500).json({ error: 'Falha ao criar a preferência de pagamento.' });
  }
}
