import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(400).json({ success: false, message: 'A variável de ambiente MERCADO_PAGO_ACCESS_TOKEN não foi encontrada no servidor Vercel.' });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout de 10 segundos

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
        res.status(200).json({ success: true, message: 'Sucesso! A conexão com a API do Mercado Pago a partir do servidor Vercel está funcionando corretamente.' });
    } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Chave inválida ou erro de permissão.';
        res.status(response.status).json({ success: false, message: `Falha na conexão: ${errorMessage}` });
    }

  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        message: 'A verificação expirou. O servidor do Mercado Pago não respondeu a tempo.'
      });
    }
    
    console.error('Erro ao verificar status do Mercado Pago no Vercel:', error);
    res.status(500).json({
      success: false,
      message: 'Ocorreu um erro interno no servidor ao tentar se comunicar com o Mercado Pago.'
    });
  }
}
