import { createClient, SupabaseClient } from '@supabase/supabase-js';

// As chaves públicas do Supabase podem ser expostas com segurança no frontend.
const supabaseUrl = "https://srsrzdqerymbdevvjwrr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyc3J6ZHFlcnltYmRldnZqd3JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MjU4NTgsImV4cCI6MjA3ODMwMTg1OH0.GwqWFatBGIGStB7muLWOxL_KCgakC0jctLtVyrzOwFY";

// A instância do cliente Supabase é inicializada diretamente e exportada.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// A inicialização do cliente Gemini foi movida para uma função de backend segura.
// A função initializeClients foi removida pois não é mais necessária.