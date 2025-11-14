import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const config = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      mercadoPagoPublicKey: process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY,
      geminiApiKey: process.env.API_KEY,
    };

    if (!config.supabaseUrl || !config.supabaseAnonKey || !config.mercadoPagoPublicKey || !config.geminiApiKey) {
      console.error('Missing environment variables:', {
        supabaseUrl: !!config.supabaseUrl,
        supabaseAnonKey: !!config.supabaseAnonKey,
        mercadoPagoPublicKey: !!config.mercadoPagoPublicKey,
        geminiApiKey: !!config.geminiApiKey,
      });
      return res.status(500).json({ error: 'Server configuration is incomplete.' });
    }

    res.status(200).json(config);
  } catch (error: any) {
    console.error('Error in config endpoint:', error);
    res.status(500).json({ error: 'Failed to load configuration.', message: error.message });
  }
}
