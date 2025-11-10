// /api/config.ts
// Este endpoint fornece as chaves públicas necessárias para o frontend.
export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  // As chaves públicas são lidas das variáveis de ambiente no servidor.
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const mercadoPagoPublicKey = process.env.VITE_MERCADO_PAGO_PUBLIC_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !mercadoPagoPublicKey) {
    console.error('Uma ou mais variáveis de ambiente públicas não estão configuradas: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MERCADO_PAGO_PUBLIC_KEY');
    return res.status(500).json({ error: 'A configuração do servidor está incompleta.' });
  }

  res.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    mercadoPagoPublicKey,
  });
}