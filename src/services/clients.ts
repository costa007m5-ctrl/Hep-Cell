import { createClient, SupabaseClient } from '@supabase/supabase-js';

// As chaves públicas do Supabase podem ser expostas com segurança no frontend.
const supabaseUrl = "https://srsrzdqerymbdevvjwrr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyc3J6ZHFlcnltYmRldnZqd3JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MjU4NTgsImV4cCI6MjA3ODMwMTg1OH0.GwqWFatBGIGStB7muLWOxL_KCgakC0jctLtVyrzOwFY";

// A instância do cliente Supabase é inicializada diretamente e exportada.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// A inicialização do cliente Gemini e Mercado Pago foi movida para funções de backend seguras.
// Este arquivo agora lida apenas com clientes seguros para o frontend.
