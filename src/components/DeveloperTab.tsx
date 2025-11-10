import React, { useState } from 'react';
import Alert from './Alert';

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
  const fullSetupSQL = `
-- ====================================================================
-- Script Completo de Configuração do Banco de Dados para Relp Cell
-- Execute este bloco inteiro de uma vez no Editor SQL do Supabase.
-- ====================================================================

-- Parte 1: Tabela de Perfis de Usuários
-- Cria uma tabela pública 'profiles' para armazenar dados seguros dos usuários.
-- Esta tabela espelha os usuários da autenticação e é essencial para
-- que administradores possam listar clientes sem expor dados sensíveis.
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255)
);
-- Habilita RLS na tabela de perfis
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Políticas para perfis: Usuários podem ver o próprio perfil.
CREATE POLICY "Usuários podem ver o próprio perfil." ON public.profiles FOR SELECT USING (auth.uid() = id);
-- Políticas para perfis: Administradores podem ver todos os perfis.
CREATE POLICY "Admins podem ver todos os perfis." ON public.profiles FOR SELECT USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');


-- Parte 2: Trigger para Sincronizar Novos Usuários
-- Cria uma função que será executada automaticamente sempre que um novo usuário
-- se cadastrar no sistema (auth.users).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Aciona a função 'handle_new_user' após cada novo registro em auth.users.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Parte 3: Tabela de Faturas
-- Esta tabela armazena os detalhes das faturas dos clientes.
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Campos adicionais para detalhes do pagamento
  payment_method VARCHAR(50),
  payment_date TIMESTAMPTZ,
  transaction_id VARCHAR(255),
  notes TEXT
);
-- Habilita RLS na tabela de faturas
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
-- Políticas para faturas: Clientes podem ver e atualizar suas próprias faturas.
CREATE POLICY "Clientes podem ver suas próprias faturas." ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Clientes podem atualizar o status de suas faturas." ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
-- Políticas para faturas: Administradores têm controle total.
CREATE POLICY "Admins podem gerenciar todas as faturas." ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
  `;

  const updateSQL = `
-- ====================================================================
-- Script de Atualização para Aplicações Existentes
-- Execute este script se você já configurou a tabela inicial 'invoices'
-- e precisa adicionar as novas funcionalidades (tabela de perfis e campos extras).
-- ====================================================================

-- Parte 1: Adicionar Tabela de Perfis e Trigger
-- Cria a tabela 'profiles' para listagem segura de usuários.
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver o próprio perfil." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins podem ver todos os perfis." ON public.profiles FOR SELECT USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');

-- Cria a função de trigger para sincronizar novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Cria o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Opcional: Preenche a tabela 'profiles' com usuários já existentes
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- Parte 2: Adicionar Novos Campos à Tabela 'invoices'
-- Adiciona colunas para detalhes de pagamento, se ainda não existirem.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes TEXT;
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
            Configuração do Banco de Dados
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
            Copie e execute os scripts no seu Editor SQL do Supabase para configurar e atualizar o app.
        </p>

        <div className="space-y-8 text-left">
            <div>
                <CodeBlock 
                    title="1. Script de Configuração Inicial" 
                    code={fullSetupSQL}
                    explanation="Para uma instalação nova. Copie este script inteiro, cole no Editor SQL do Supabase e clique em 'RUN'."
                />

                <Alert 
                    type="error"
                    message="Aviso: As Políticas de Segurança (RLS) foram configuradas com um ID de administrador específico. Se o administrador do sistema for alterado, estas políticas precisarão ser atualizadas manualmente no Supabase com o novo ID."
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
                    explanation="Se você já tinha o app configurado, execute este script para adicionar a tabela de perfis e os novos campos de fatura, permitindo a criação de faturas pelo admin."
                />
            </div>
        </div>
    </div>
  );
};

export default DeveloperTab;