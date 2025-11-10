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
-- Script Completo de Configuração do Banco de Dados para Relp Cell

-- Passo 1: Criar a tabela 'invoices'
-- Esta tabela armazena os detalhes das faturas dos clientes.
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Passo 2: Habilitar a Segurança a Nível de Linha (RLS)
-- É crucial para garantir que os clientes só possam acessar seus próprios dados.
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Passo 3: Políticas de Acesso para Clientes
-- Garante que os clientes só possam ver e atualizar suas próprias faturas.
CREATE POLICY "Clientes podem ver suas próprias faturas."
ON public.invoices
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Clientes podem atualizar o status de suas faturas."
ON public.invoices
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Passo 4: Políticas de Acesso para Administrador
-- Concede ao administrador controle total sobre a tabela de faturas.
-- IMPORTANTE: Substitua 'SEU_ADMIN_USER_ID' pelo ID do seu usuário admin no Supabase.
CREATE POLICY "Administrador pode ver todas as faturas."
ON public.invoices
FOR SELECT
USING (auth.uid() = 'SEU_ADMIN_USER_ID');

CREATE POLICY "Administrador pode criar novas faturas."
ON public.invoices
FOR INSERT
WITH CHECK (auth.uid() = 'SEU_ADMIN_USER_ID');

CREATE POLICY "Administrador pode gerenciar todas as faturas (atualizar/deletar)."
ON public.invoices
FOR UPDATE, DELETE
USING (auth.uid() = 'SEU_ADMIN_USER_ID');
  `;

  const updateSQL = `
-- Script de Atualização da Tabela 'invoices'
-- Execute este script se você já configurou a tabela inicial e precisa adicionar novos campos.

-- Adiciona a coluna para o método de pagamento (ex: 'Cartão de Crédito', 'Pix')
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Adiciona a coluna para a data exata do pagamento
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;

-- Adiciona a coluna para o ID da transação do gateway de pagamento
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);

-- Adiciona um campo de anotações para uso administrativo
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS notes TEXT;
  `;

  return (
    <div className="w-full max-w-2xl text-center p-4 sm:p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg animate-fade-in-up">
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
                    explanation="Se esta é a primeira vez configurando o app, copie e cole este script inteiro no Editor SQL do seu projeto Supabase e clique em 'RUN' para configurar a tabela e as políticas de segurança."
                />

                <Alert 
                    type="error"
                    message="Importante: No script acima, substitua 'SEU_ADMIN_USER_ID' pelo ID real do seu usuário administrador antes de executá-lo. Você pode encontrar o ID na seção 'Authentication > Users' do seu painel Supabase."
                />
            </div>
            
            <hr className="border-slate-200 dark:border-slate-700" />

            <div>
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 text-center">
                    Atualização
                </h2>
                <CodeBlock 
                    title="2. Script de Atualização da Tabela" 
                    code={updateSQL}
                    explanation="Se você já executou o script de configuração inicial, use este comando para adicionar novos campos à tabela de faturas sem perder dados existentes. Estes campos permitem armazenar mais detalhes sobre cada pagamento."
                />
                 <Alert 
                    type="success"
                    message="As políticas de segurança (RLS) existentes já permitem que administradores e clientes acessem estes novos campos. Nenhuma atualização nas políticas é necessária."
                />
            </div>
        </div>
    </div>
  );
};

export default DeveloperTab;