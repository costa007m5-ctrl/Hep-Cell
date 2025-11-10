import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ success: false, message: 'Access Token não fornecido.' });
  }

  // Adiciona um AbortController para implementar um timeout na requisição
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout de 10 segundos

  try {
    // A forma mais confiável de validar um token é tentar usá-lo em uma operação de leitura.
    // Faremos uma chamada direta à API para buscar os métodos de pagamento.
    const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      signal: controller.signal // Passa o sinal do AbortController para o fetch
    });

    // Limpa o timeout se a requisição for concluída
    clearTimeout(timeoutId);

    if (response.ok) {
        // A chave é válida se a resposta for bem-sucedida (status 2xx)
        res.status(200).json({ success: true, message: 'Chave do Mercado Pago válida e conectada com sucesso!' });
    } else {
        // Se o status não for 'ok', a chave é provavelmente inválida ou sem permissões.
        const errorData = await response.json().catch(() => ({})); // Evita erro se o corpo não for JSON
        const errorMessage = errorData.message || 'Chave inválida ou erro de permissão.';
        res.status(response.status).json({ success: false, message: `Falha na validação: ${errorMessage}` });
    }

  } catch (error: any) {
    // Limpa o timeout também em caso de erro
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      console.error('Request to Mercado Pago timed out.');
      return res.status(504).json({ // 504 Gateway Timeout
        success: false,
        message: 'A verificação da chave expirou. O servidor do Mercado Pago não respondeu a tempo.'
      });
    }
    
    console.error('Erro ao testar a chave do Mercado Pago:', error);
    res.status(500).json({
      success: false,
      message: 'Ocorreu um erro interno ao tentar validar a chave.'
    });
  }
}
