import { MercadoPagoConfig, Preference } from 'mercadopago';

// Esta função é executada como uma Vercel Serverless Function
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Extrai os dados do corpo da requisição
  const { title, quantity, price } = req.body;

  if (!title || !quantity || !price) {
    return res.status(400).json({ error: 'Faltam dados obrigatórios: title, quantity, price.' });
  }

  // O Access Token NUNCA deve ser exposto no código-fonte em um ambiente de produção.
  // Ele deve ser carregado de forma segura a partir de Variáveis de Ambiente.
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
            id: `relp-cell-item-${Date.now()}`, // Adiciona um ID único, que é obrigatório
            title: title,
            quantity: Number(quantity),
            unit_price: Number(price),
            currency_id: 'BRL',
          },
        ],
        // URLs de retorno após o pagamento
        back_urls: {
            success: `${req.headers.origin}/sucesso`,
            failure: `${req.headers.origin}/erro`,
            pending: `${req.headers.origin}/pendente`,
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