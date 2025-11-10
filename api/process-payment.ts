// /api/process-payment.ts
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Esta função é executada como uma Vercel Serverless Function
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const paymentData = req.body;

  // O Access Token é lido de forma segura das variáveis de ambiente no servidor.
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('O Access Token do Mercado Pago não está configurado.');
    return res.status(500).json({ error: 'O provedor de pagamento não está configurado.' });
  }

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    // Cria o pagamento com os dados recebidos do frontend
    const paymentResult = await payment.create({ body: paymentData });

    // Retorna o status final da transação para o cliente
    res.status(201).json({
      status: paymentResult.status,
      id: paymentResult.id,
      status_detail: paymentResult.status_detail,
    });
  } catch (error: any) {
    console.error('Erro ao processar o pagamento com Mercado Pago:', error);
    
    // Tenta retornar um erro mais amigável da resposta do Mercado Pago
    const errorMessage = error.cause?.[0]?.description || 'Falha ao processar o pagamento.';
    res.status(500).json({ error: errorMessage });
  }
}
