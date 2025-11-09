import { createClient, SupabaseClient } from '@supabase/supabase-js';

// As variáveis de ambiente serão configuradas no painel da Vercel
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

let _supabase: SupabaseClient;

if (isSupabaseConfigured) {
  _supabase = createClient(supabaseUrl!, supabaseAnonKey!);
} else {
  // Se o Supabase não estiver configurado, um cliente dummy é criado
  // para evitar que o aplicativo quebre no início. A UI mostrará
  // uma mensagem de erro de configuração.
  console.warn('Variáveis de ambiente do Supabase (SUPABASE_URL, SUPABASE_ANON_KEY) não estão definidas. O aplicativo não conseguirá se conectar ao banco de dados.');
  _supabase = {} as SupabaseClient;
}

export const supabase = _supabase;
