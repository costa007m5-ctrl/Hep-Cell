import { createClient, SupabaseClient } from '@supabase/supabase-js';

// O cliente Supabase é exportado, mas inicializado de forma assíncrona.
// O componente App DEVE garantir que initializeClients() seja concluído antes de renderizar
// qualquer componente que importe e use esta instância `supabase`.
export let supabase: SupabaseClient;

let initializationPromise: Promise<{ mercadoPagoPublicKey: string; }> | null = null;

interface AppConfig {
    supabaseUrl: string;
    supabaseAnonKey: string;
    mercadoPagoPublicKey: string;
}

// Esta função busca a configuração, cria o cliente Supabase,
// e retorna chaves públicas necessárias para o app. Ela garante que a inicialização
// ocorra apenas uma vez, usando uma promise.
export const initializeClients = (): Promise<{ mercadoPagoPublicKey: string; }> => {
    if (!initializationPromise) {
        initializationPromise = (async () => {
            try {
                const response = await fetch('/api/config');
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Erro ao buscar config:", response.status, errorText);
                    throw new Error('Falha ao buscar a configuração do servidor.');
                }
                
                const config: AppConfig = await response.json();

                if (!config.supabaseUrl || !config.supabaseAnonKey || !config.mercadoPagoPublicKey) {
                    console.error("Configuração incompleta recebida do servidor:", config);
                    throw new Error('A configuração recebida do servidor está incompleta.');
                }

                // Inicializa o cliente Supabase e o atribui à variável exportada.
                supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
                
                // Retorna chaves públicas necessárias para o componente App.
                return {
                    mercadoPagoPublicKey: config.mercadoPagoPublicKey,
                };
            } catch (error) {
                // Reseta a promise em caso de falha para permitir nova tentativa.
                initializationPromise = null;
                throw error;
            }
        })();
    }

    return initializationPromise;
};