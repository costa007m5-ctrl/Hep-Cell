import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(400).json({ 
      success: false, 
      message: "As variáveis de ambiente do Supabase (URL e Service Role Key) não foram encontradas. Verifique sua configuração na Vercel." 
    });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Testa a conexão e a existência da função RPC executando uma consulta inofensiva.
    // Isso valida tanto a chave quanto o setup inicial do banco de dados.
    const { error } = await supabaseAdmin.rpc('execute_admin_sql', {
      sql_query: 'SELECT 1;'
    });

    if (error) {
       // Fornece uma mensagem de erro mais útil se a função não existir
      if (error.message.includes('function execute_admin_sql() does not exist')) {
        return res.status(400).json({ 
          success: false,
          message: "Falha na validação: A função de setup 'execute_admin_sql' não foi encontrada no banco. Execute o 'Passo 1' na aba Desenvolvedor e tente novamente."
        });
      }
      throw error;
    }

    res.status(200).json({ success: true, message: 'Sucesso! A conexão com o Supabase está funcionando corretamente.' });

  } catch (error: any) {
    console.error('Erro ao testar a conexão com o Supabase:', error);
    res.status(500).json({
      success: false,
      message: `Falha na conexão: ${error.message}`
    });
  }
}