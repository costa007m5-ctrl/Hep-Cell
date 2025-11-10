import React, { useState } from 'react';
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
  const [mercadoPagoToken, setMercadoPagoToken] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleTestKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    try {
        const response = await fetch('/api/test-mercadopago', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: mercadoPagoToken }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erro desconhecido ao testar a chave.');
        }

        setTestResult({ text: data.message, type: 'success' });

    } catch (err: any) {
        setTestResult({ text: err.message, type: 'error' });
    } finally {
        setIsTesting(false);
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
CREATE POLICY "Admins podem gerenciar todas as faturas." ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062'); -- SUBSTITUA O ID AQUI
  `;

  const updateSQL = `
-- ====================================================================
-- Script de Atualização para Aplicações Existentes
-- ATENÇÃO: Substitua 'SEU_ADMIN_USER_ID' pelo ID do seu usuário Admin.
-- ====================================================================

-- Parte 1: Adicionar Tabela de Perfis e Trigger
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver o próprio perfil." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins podem ver todos os perfis." ON public.profiles FOR SELECT USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062'); -- SUBSTITUA O ID AQUI

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

-- Opcional: Preenche a tabela 'profiles' com usuários já existentes
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- Parte 2: Adicionar Novos Campos e Políticas à Tabela 'invoices'
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes TEXT;

-- Garante que a RLS está ativa
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Clientes podem ver suas próprias faturas." ON public.invoices;
DROP POLICY IF EXISTS "Clientes podem atualizar o status de suas faturas." ON public.invoices;
DROP POLICY IF EXISTS "Admins podem gerenciar todas as faturas." ON public.invoices;

-- Cria as novas políticas
CREATE POLICY "Clientes podem gerenciar suas próprias faturas." ON public.invoices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins podem gerenciar todas as faturas." ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062'); -- SUBSTITUA O ID AQUI
  `;

  return (
    <div className="w-full max-w-3xl text-center p-4 sm:p-8 animate-fade-in-up">
        <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
            </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Área do Desenvolvedor
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
            Use esta área para testar configurações e obter scripts de inicialização.
        </p>

        <div className="text-left mb-8">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3 text-center">Teste de Chave de API</h3>
            <div className="bg-slate-100 dark:bg-slate-900/50 rounded-xl p-6 shadow-sm">
                <form onSubmit={handleTestKey} className="space-y-4">
                    <div>
                        <label htmlFor="mp-token" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Access Token do Mercado Pago
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                           Esta chave será usada apenas para o teste e não será salva. A chave de produção deve ser configurada nas variáveis de ambiente do Vercel.
                        </p>
                        <input
                            id="mp-token"
                            type="password"
                            value={mercadoPagoToken}
                            onChange={(e) => setMercadoPagoToken(e.target.value)}
                            placeholder="Cole seu Access Token (ex: APP_USR-...)"
                            className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                    </div>
                    <div className="flex justify-end">
                         <button
                            type="submit"
                            disabled={isTesting || !mercadoPagoToken}
                            className="flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-slate-800 transition-colors duration-200"
                        >
                            {isTesting ? <LoadingSpinner /> : 'Testar Chave'}
                        </button>
                    </div>
                </form>
                {testResult && (
                    <div className="mt-4 animate-fade-in">
                        <Alert message={testResult.text} type={testResult.type} />
                    </div>
                )}
            </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-700 my-10" />

        <div className="space-y-8 text-left">
            <div>
                 <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3 text-center">Configuração do Banco de Dados</h3>
                 <Alert 
                    type="error"
                    message="IMPORTANTE: Antes de executar os scripts, você precisa encontrar o ID do seu usuário administrador na seção 'Authentication > Users' do seu painel Supabase e substituir o valor '1da77e27-f1df-4e35-bcec-51dc2c5a9062' nos scripts abaixo."
                />
            </div>
            <div>
                <CodeBlock 
                    title="1. Script de Configuração Inicial" 
                    code={fullSetupSQL}
                    explanation="Para uma instalação nova. Copie este script inteiro, cole no Editor SQL do Supabase e clique em 'RUN'."
                />
            </div>
            
            <hr className="border-slate-200 dark:border-slate-700" />

            <div>
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 text-center">
                    Atualização para Instalações Existentes
                </h2>
                <CodeBlock 
                    title="2. Script de Atualização" 
                    code={updateSQL}
                    explanation="Se você já tinha o app configurado, execute este script para adicionar a tabela de perfis, os novos campos de fatura e as políticas de segurança corretas."
                />
            </div>
        </div>
    </div>
  );
};

export default DeveloperTab;