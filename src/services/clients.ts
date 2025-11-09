import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

// As instâncias do cliente são exportadas, mas inicializadas como nulas.
// Elas serão preenchidas pela função initializeClients.
export let supabase: SupabaseClient;
export let genAI: GoogleGenAI;

let isInitialized = false;

interface AppConfig {
    supabaseUrl: string;
    supabaseAnonKey: string;
    mercadoPagoPublicKey: string;
    geminiApiKey: string;
}

// A função de inicialização busca a configuração e cria as instâncias do cliente.
// Garante que a inicialização ocorra apenas uma vez.
export const initializeClients = async (): Promise<Omit<AppConfig, 'supabaseUrl' | 'supabaseAnonKey' | 'geminiApiKey'>> => {
    if (isInitialized) {
        // Se já foi inicializado, apenas retorna as chaves necessárias.
        // Isso pode ser aprimorado para retornar a configuração armazenada.
        console.warn("Os clientes já foram inicializados.");
        // A rigor, deveríamos ter a config salva para retornar aqui.
        // Mas o fluxo do App.tsx previne re-chamadas.
        return { mercadoPagoPublicKey: '' };
    }

    const response = await fetch('/api/config');
    if (!response.ok) {
        throw new Error('Falha ao buscar a configuração do servidor.');
    }
    const config: AppConfig = await response.json();

    if (!config.supabaseUrl || !config.supabaseAnonKey || !config.geminiApiKey || !config.mercadoPagoPublicKey) {
        throw new Error('Configuração recebida do servidor está incompleta.');
    }

    // Inicializa os clientes com as chaves recebidas
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });
    
    isInitialized = true;

    // Retorna as chaves que podem ser necessárias diretamente nos componentes
    return {
        mercadoPagoPublicKey: config.mercadoPagoPublicKey,
    };
};