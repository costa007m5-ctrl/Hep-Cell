import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/clients';
import Alert from './Alert';
import LoadingSpinner from './LoadingSpinner';

interface CodeBlockProps {
    title: string;
    code: string;
    explanation?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ title, code, explanation }) => {
    const [copyText, setCopyText] = useState('Copiar');

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopyText('Copiado!');
        setTimeout(() => setCopyText('Copiar'), 2000);
    };

    return (
        <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">{title}</h3>
            {explanation && <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{explanation}</p>}
            <div className="relative">
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg overflow-x-auto text-left text-sm">
                    <code>{code.trim()}</code>
                </pre>
                <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 bg-slate-700 text-slate-200 text-xs font-semibold py-1 px-2 rounded-md hover:bg-slate-600 transition-colors"
                >
                    {copyText}
                </button>
            </div>
        </div>
    );
};

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [settings, setSettings] = useState({
        mercadoPagoToken: '',
        geminiApiKey: '',
    });
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error || !data.session) throw new Error('Autenticação necessária.');

            const response = await fetch('/api/get-settings', {
                headers: {
                    'Authorization': `Bearer ${data.session.access_token}`
                }
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'Falha ao buscar configurações.');
            }
            const currentSettings = await response.json();
            setSettings({
                mercadoPagoToken: currentSettings.MERCADO_PAGO_ACCESS_TOKEN || '',
                geminiApiKey: currentSettings.API_KEY || ''
            });
        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({...prev, [name]: value }));
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage(null);
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error || !data.session) throw new Error('Autenticação necessária.');

            const response = await fetch('/api/save-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.session.access_token}`
                },
                body: JSON.stringify({
                    MERCADO_PAGO_ACCESS_TOKEN: settings.mercadoPagoToken,
                    API_KEY: settings.geminiApiKey
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao salvar configurações.');
            }

            setMessage({ text: 'Configurações salvas com sucesso!', type: 'success' });

        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const fullSetupSQL = `
-- ====================================================================
-- Script Completo de Configuração do Banco de Dados para Relp Cell
-- Execute este bloco inteiro de uma vez no Editor SQL do Supabase.
-- ATENÇÃO: Substitua 'SEU_ADMIN_USER_ID' pelo ID do seu usuário Admin.
-- Você pode encontrar o ID na seção Authentication -> Users do Supabase.
-- ====================================================================

-- Parte 1: Tabela de Perfis de Usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver o próprio perfil." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins podem ver todos os perfis." ON public.profiles FOR SELECT USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062'); -- SUBSTITUA O ID AQUI


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
  payment_method VARCHAR(50),
  payment_date TIMESTAMPTZ,
  transaction_id VARCHAR(255),
  notes TEXT
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clientes podem gerenciar suas próprias faturas." ON public.invoices FOR ALL USING (auth.uid() = user_id);
`;
// Fix: Complete the component by adding the missing JSX and export.
    const adminPolicySQL = `
-- Política de Acesso para Admin na Tabela 'invoices'
-- Permite que o admin (com o ID de usuário especificado) realize todas as operações.
-- ATENÇÃO: Substitua 'SEU_ADMIN_USER_ID' pelo ID do seu usuário Admin.
CREATE POLICY "Admins podem gerenciar todas as faturas." ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062'); -- SUBSTITUA O ID AQUI
`;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <LoadingSpinner />
            </div>
        );
    }
    
    return (
        <div className="p-4 space-y-8">
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configurações de API</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                    Estas chaves são armazenadas de forma segura no seu ambiente Vercel e nunca são expostas ao cliente.
                    O painel de admin se comunica com endpoints de API seguros para utilizá-las.
                </p>
                <form onSubmit={handleSaveSettings} className="max-w-xl space-y-4">
                    {message && <Alert message={message.text} type={message.type} />}
                    <div>
                        <label htmlFor="geminiApiKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Chave da API do Gemini (API_KEY)
                        </label>
                        <input
                            id="geminiApiKey"
                            name="geminiApiKey"
                            type="password"
                            value={settings.geminiApiKey}
                            onChange={handleInputChange}
                            className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-50 dark:bg-slate-700"
                            placeholder="Cole sua chave aqui"
                        />
                         <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Usada para gerar mensagens de confirmação de pagamento personalizadas.</p>
                    </div>
                     <div>
                        <label htmlFor="mercadoPagoToken" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                           Access Token do Mercado Pago (MERCADO_PAGO_ACCESS_TOKEN)
                        </label>
                        <input
                            id="mercadoPagoToken"
                            name="mercadoPagoToken"
                            type="password"
                            value={settings.mercadoPagoToken}
                            onChange={handleInputChange}
                            className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-50 dark:bg-slate-700"
                             placeholder="Cole seu token aqui"
                        />
                         <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Usado para processar pagamentos de forma segura no backend.</p>
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                            {isSaving ? <LoadingSpinner /> : 'Salvar Configurações'}
                        </button>
                    </div>
                </form>
            </section>
            
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Setup do Banco de Dados</h2>
                 <CodeBlock
                    title="Script de Setup Inicial (Tabelas, Trigger e Políticas)"
                    explanation="Execute este script completo no Editor SQL do Supabase para criar as tabelas 'profiles' e 'invoices', configurar o trigger de novos usuários e aplicar as políticas de segurança de nível de linha (RLS) iniciais. Lembre-se de substituir o ID do usuário admin."
                    code={fullSetupSQL}
                />
                 <CodeBlock
                    title="Política de Acesso do Administrador"
                    explanation="Após executar o script inicial, execute esta política para conceder ao seu usuário administrador acesso total à tabela 'invoices'. Isto é crucial para que o Painel do Admin funcione."
                    code={adminPolicySQL}
                />
            </section>
        </div>
    );
};

export default DeveloperTab;
