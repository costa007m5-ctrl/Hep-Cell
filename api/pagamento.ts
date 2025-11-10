// ARQUIVO DESCONTINUADO (DEPRECATED)
//
// Esta rota de API foi substituída para melhorar a organização e segurança
// do fluxo de pagamento no Vercel. A funcionalidade agora é tratada por:
// 1. `/api/create-preference`: Para criar a preferência de pagamento.
// 2. `/api/process-payment`: Para processar o pagamento de forma segura no backend.
//
// Este arquivo pode ser removido com segurança do projeto.

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  // Retorna o status 410 Gone para indicar que o recurso foi permanentemente removido.
  res.status(410).json({ 
    code: 'endpoint_deprecated',
    message: 'Este endpoint foi descontinuado e não está mais em uso. Utilize /api/create-preference e /api/process-payment.' 
  });
}
