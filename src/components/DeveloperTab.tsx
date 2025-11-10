import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/clients';
import Alert from './Alert';
import LoadingSpinner from './LoadingSpinner';

const CodeBlock: React.FC<{ title: string; code: string; explanation?: string }> = ({ title, code, explanation }) => {
    const [copyText, setCopyText] = useState('Copiar');
    const handleCopy = () => {
        navigator.clipboard.writeText(code.trim());
        setCopyText('Copiado!');
        setTimeout(() => setCopyText('Copiar'), 2000);
    };
    return (
        <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">{title}</h3>
            {explanation && <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{explanation}</p>}
            <div className="relative">
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg overflow-x-auto text-left text-sm font-mono">
                    <code>{code.trim()}</code>
                </pre>
                <button onClick={handleCopy} className="absolute top-2 right-2 bg-slate-700 text-slate-200 text-xs font-semibold py-1 px-2 rounded-md hover:bg-slate-600 transition-colors">
                    {copyText}
                </button>
            </div>
        </div>
    );
};

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState<'gemini' | 'mp' | null>(null);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const fullSetupSQL = `
-- ====================================================================
-- Script Completo de Configuração do Banco de Dados para Relp Cell
-- Execute este bloco inteiro de uma vez no Editor SQL do Supabase.
-- ATENÇÃO: Substitua '1da77e27-f1df-4e35-bcec-51dc2c5a9062' pelo ID do seu usuário Admin.
-- Você pode encontrar o ID na seção Authentication -> Users do Supabase.
-- ====================================================================

-- Parte 1: Tabela de Perfis de Usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver o próprio perfil." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins podem ver todos os perfis." ON public.profiles FOR SELECT USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');


-- Parte 2: Trigger para Sincronizar Novos Usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Parte 3: Tabela de Faturas
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  payment_date TIMESTAMPTZ,
  notes TEXT
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clientes podem ver suas próprias faturas." ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Clientes podem atualizar o status das suas faturas." ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins podem gerenciar todas as faturas." ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');


-- Parte 4: Tabela de Configurações para chaves de API (opcional, se não usar env vars)
-- Esta tabela permite que você salve as chaves de API diretamente pelo painel.
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem gerenciar configurações." ON public.settings FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
`;
    
    return (
        <div className="p-4 space-y-8">
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração das Variáveis de Ambiente</h2>
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-6 space-y-3">
                    <p>
                        Para que o sistema de pagamentos e a inteligência artificial funcionem, você precisa configurar "Variáveis de Ambiente" no seu provedor de hospedagem (Ex: Vercel, Netlify).
                        Elas guardam suas chaves secretas de forma segura.
                    </p>
                    <p>
                        Acesse as configurações do seu projeto na Vercel, vá para a seção "Environment Variables" e adicione as duas variáveis abaixo.
                        <strong className="text-slate-800 dark:text-slate-200"> Certifique-se de que elas estão disponíveis para produção.</strong>
                    </p>
                </div>

                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                           MERCADO_PAGO_ACCESS_TOKEN
                        </label>
                        <input
                            type="text"
                            readOnly
                            value="APP_USR-2426678970699511-091408-d34b7da2823c6f325663a6f81e57c5fb-2619214643"
                            className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-100 dark:bg-slate-700 font-mono text-sm"
                        />
                         <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Seu Access Token de produção do Mercado Pago. Usado para processar pagamentos.</p>
                    </div>
                     <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                           API_KEY
                        </label>
                        <input
                            type="password"
                            readOnly
                            value="AIzaSyXXXXXXXXXXXXXXXXXXX"
                            className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-100 dark:bg-slate-700"
                             placeholder="Cole seu token aqui"
                        />
                         <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sua chave de API do Google AI Studio (Gemini). Usada para gerar mensagens personalizadas.</p>
                    </div>
                </div>
            </section>
            
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Setup do Banco de Dados Supabase</h2>
                 <CodeBlock
                    title="Script de Setup Inicial Completo"
                    explanation="Execute este script completo no Editor SQL do seu projeto no Supabase para criar todas as tabelas, o trigger de novos usuários e aplicar as políticas de segurança (RLS). Lembre-se de substituir o ID do usuário admin se for diferente."
                    code={fullSetupSQL}
                />
            </section>
        </div>
    );
};

export default DeveloperTab;
