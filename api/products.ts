import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// As chaves públicas do Supabase podem ser expostas com segurança.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('As variáveis de ambiente do Supabase (URL e Anon Key) não estão configuradas no servidor.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar produtos:', error);
            // Verifica se o erro é de RLS para dar uma mensagem mais clara
            if (error.message.includes('permission denied')) {
                 return res.status(500).json({ error: 'Acesso negado. Verifique as políticas de segurança (RLS) da tabela de produtos.' });
            }
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json(data);
    } catch (error: any) {
        console.error('Erro inesperado no endpoint de produtos:', error);
        return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
}
