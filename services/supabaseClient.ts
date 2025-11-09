import { createClient } from '@supabase/supabase-js';

// As variáveis de ambiente serão configuradas no painel da Vercel
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('As variáveis de ambiente do Supabase (URL e Anon Key) devem ser definidas.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
