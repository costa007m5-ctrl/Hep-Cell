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
  const createTableSQL = `
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
  `;

  const enableRLS_SQL = `
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
  `;

  const clientSelectPolicySQL = `
CREATE POLICY "Clientes podem ver suas próprias faturas."
ON public.invoices
FOR SELECT
USING (auth.uid() = user_id);
  `;

  const clientUpdatePolicySQL = `
CREATE POLICY "Clientes podem atualizar o status de suas faturas."
ON public.invoices
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
  `;
  
  const adminSelectPolicySQL = `
-- SUBSTITUA 'SEU_ADMIN_USER_ID' PELO ID DO SEU USUÁRIO ADMIN
-- Você encontra o ID na seção Authentication -> Users do seu painel Supabase.
CREATE POLICY "Administrador pode ver todas as faturas."
ON public.invoices
FOR SELECT
USING (auth.uid() = 'SEU_ADMIN_USER_ID');
  `;

  const adminInsertPolicySQL = `
CREATE POLICY "Administrador pode criar novas faturas."
ON public.invoices
FOR INSERT
WITH CHECK (auth.uid() = 'SEU_ADMIN_USER_ID');
  `;

  const adminManagePolicySQL = `
CREATE POLICY "Administrador pode atualizar e deletar faturas."
ON public.invoices
FOR UPDATE, DELETE
USING (auth.uid() = 'SEU_ADMIN_USER_ID');
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
            Copie e execute estes scripts no seu Editor SQL do Supabase para configurar o app.
        </p>

        <div className="space-y-6 text-left">
            <CodeBlock 
                title="1. Criar Tabela de Faturas (invoices)" 
                code={createTableSQL}
                explanation="Este comando cria a tabela necessária para armazenar as faturas dos clientes."
            />

            <CodeBlock 
                title="2. Habilitar Row Level Security (RLS)" 
                code={enableRLS_SQL}
                explanation="É crucial habilitar o RLS para garantir que os dados dos clientes fiquem seguros e privados."
            />
            
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 pt-4 border-t border-slate-200 dark:border-slate-700">Políticas para Clientes</h3>

            <CodeBlock 
                title="3. Política para Clientes (Leitura)" 
                code={clientSelectPolicySQL}
                explanation="Esta política garante que cada cliente só possa visualizar as suas próprias faturas."
            />
            
            <CodeBlock 
                title="4. Política para Clientes (Atualização)" 
                code={clientUpdatePolicySQL}
                explanation="Permite que o aplicativo atualize o status de uma fatura para 'Paga' após um pagamento bem-sucedido."
            />
            
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 pt-4 border-t border-slate-200 dark:border-slate-700">Políticas para Administrador</h3>

             <CodeBlock 
                title="5. Política para Administrador (Leitura Total)" 
                code={adminSelectPolicySQL}
                explanation="Permite que o seu usuário de administrador acesse os dados de todas as faturas no painel."
            />

            <CodeBlock 
                title="6. Política para Administrador (Criação)" 
                code={adminInsertPolicySQL}
                explanation="ESSENCIAL: Esta política permite que o administrador crie (insira) novas faturas para os clientes. A falta dela impede a adição de novos dados."
            />
            
            <CodeBlock 
                title="7. Política para Administrador (Gerenciamento)" 
                code={adminManagePolicySQL}
                explanation="Concede ao administrador permissão para atualizar ou deletar faturas existentes."
            />


            <Alert 
                type="error"
                message="Importante: Para as políticas de administrador funcionarem, crie um usuário para ser o admin na seção 'Authentication' do Supabase e substitua 'SEU_ADMIN_USER_ID' pelo ID real desse usuário em TODOS os scripts de administrador."
            />

        </div>
    </div>
  );
};

export default DeveloperTab;