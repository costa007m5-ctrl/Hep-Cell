import { createClient, SupabaseClient } from '@supabase/supabase-js';

export let supabase: SupabaseClient;

let isInitialized = false;

interface AppConfig {
    supabaseUrl: string;
    supabaseAnonKey: string;
    mercadoPagoPublicKey: string;
}

export const initializeClients = async (): Promise<{ mercadoPagoPublicKey: string }> => {
    if (isInitialized) {
        console.warn("Os clientes já foram inicializados.");
        return { mercadoPagoPublicKey: '' };
    }

    const response = await fetch('/api/config');
    if (!response.ok) {
        throw new Error('Falha ao buscar a configuração do servidor.');
    }
    const config: AppConfig = await response.json();

    if (!config.supabaseUrl || !config.supabaseAnonKey || !config.mercadoPagoPublicKey) {
        throw new Error('Configuração recebida do servidor está incompleta.');
    }

    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    
    isInitialized = true;

    return {
        mercadoPagoPublicKey: config.mercadoPagoPublicKey,
    };
};
