import { createClient, SupabaseClient } from '@supabase/supabase-js';

// As chaves públicas do Supabase podem ser expostas com segurança no frontend.
const supabaseUrl = "https://xmwibxipxjnxvsxtmbvo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtd2lieGlweGpueHZzeHRtYnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyODc4NTYsImV4cCI6MjA3NTg2Mzg1Nn0.zYgVMjwFvvrg588F4JbPMp07xWrtvQ3TL973HhbtU5Y";

// A instância do cliente Supabase é inicializada diretamente e exportada.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// A inicialização do cliente Gemini foi movida para uma função de backend segura.
// A função initializeClients foi removida pois não é mais necessária.