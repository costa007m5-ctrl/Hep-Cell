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

  // NOTA DE DESENVOLVIMENTO:
  // O Access Token NUNCA deve ser exposto no código-fonte em um ambiente de produção.
  // Ele deve ser carregado de forma segura a partir de Variáveis de Ambiente.
  // Este valor de teste é fornecido abaixo para permitir que o aplicativo funcione para demonstração.
  // Para produção, configure a variável MERCADO_PAGO_ACCESS_TOKEN no seu provedor de hospedagem (ex: Vercel).
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "TEST-649033862371721-061014-9b58e3f3595f553345495e267b140614-1851084223";

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