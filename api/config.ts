// /api/config.ts
// ARQUIVO DEPRECADO (NÃO UTILIZADO)
//
// Esta rota de API não é mais utilizada pelo aplicativo desde a refatoração de segurança.
// A configuração do Supabase agora é feita diretamente no frontend (src/services/clients.ts)
// com chaves públicas, e as chaves secretas (Gemini, Mercado Pago) são gerenciadas
// por rotas de API específicas e seguras.
//
// Este arquivo pode ser removido com segurança do projeto.

export default function handler(req: any, res: any) {
  res.status(404).json({ 
    code: 'endpoint_deprecated',
    message: 'This API endpoint is deprecated and no longer in use.' 
  });
}