// /api/config.ts
// Este endpoint fornece as chaves públicas necessárias para o frontend.
export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  // A chave pública é lida de forma segura das variáveis de ambiente no servidor.
  // No Vercel, esta variável deve ser configurada como MERCADO_PAGO_PUBLIC_KEY.
  const mercadoPagoPublicKey = process.env.MERCADO_PAGO_PUBLIC_KEY;

  if (!mercadoPagoPublicKey) {
    console.error('A chave pública do Mercado Pago (MERCADO_PAGO_PUBLIC_KEY) não está configurada nas variáveis de ambiente.');
    return res.status(500).json({ error: 'A configuração do gateway de pagamento está ausente.' });
  }

  res.status(200).json({
    mercadoPagoPublicKey,
  });
}
