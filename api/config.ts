// /api/config.ts
// Esta função é executada como uma Vercel Serverless Function
export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  // Envia apenas as chaves públicas e seguras para o frontend
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    mercadoPagoPublicKey: process.env.MERCADO_PAGO_PUBLIC_KEY,
    geminiApiKey: process.env.API_KEY,
  });
}