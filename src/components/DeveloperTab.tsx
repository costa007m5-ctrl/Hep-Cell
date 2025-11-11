import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

// Componente auxiliar para blocos de código
interface CodeBlockProps {
    title: string;
    code: string;
    explanation?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ title, code, explanation }) => {
    const [copyText, setCopyText] = React.useState('Copiar');

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
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    
    const webhookUrl = `${window.location.origin}/api/mercadopago/webhook`;
    const authHookUrl = `${window.location.origin}/api/mercadopago/auth-hook`;

    const rpcFunctionSQL = `
CREATE OR REPLACE FUNCTION execute_admin_sql(sql_query text)
RETURNS void AS $$
BEGIN
  EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `.trim();

    const handleSetupDatabase = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const response = await fetch('/api/admin/setup-database', {
                method: 'POST',
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || data.error || 'Ocorreu um erro desconhecido.');
            }
            setMessage({ text: data.message, type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-8">
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração das Variáveis de Ambiente</h2>
                <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700">
                     <p className="text-sm text-indigo-700 dark:text-indigo-300">
                        Adicione estas chaves como <strong>Variáveis de Ambiente</strong> no painel do seu projeto na Vercel para garantir a segurança e o funcionamento.
                    </p>
                    <ul className="list-disc list-inside text-sm text-indigo-700 dark:text-indigo-300 mt-2 space-y-2 font-mono">
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">API_KEY</code> (sua chave da API do Gemini)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">MERCADO_PAGO_ACCESS_TOKEN</code> (seu Access Token de produção)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> (URL do seu projeto Supabase)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (Chave anônima pública do Supabase)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> (Sua chave secreta 'service_role' do Supabase)</li>
                    </ul>
                     <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-4 font-semibold">
                        Após adicionar as chaves, vá para a aba "Status & Verificação" para testar as conexões.
                    </p>
                </div>
            </section>

             <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Setup do Banco de Dados e Automações</h2>
                 <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 mb-6">
                    <h3 className="font-bold text-green-800 dark:text-green-200">Como funciona?</h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                        Para automatizar a criação das tabelas e a sincronização de perfis de usuário, o processo é dividido em 3 passos simples.
                    </p>
                </div>

                <CodeBlock
                    title="Passo 1 (Uma única vez): Criar a Função Segura"
                    explanation="Copie o código abaixo e execute-o UMA VEZ no seu Editor SQL do Supabase. Isso permitirá que o botão do Passo 2 funcione."
                    code={rpcFunctionSQL}
                />
                
                <div className="mt-6">
                     <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Passo 2 (Automático): Preparar o Banco</h3>
                     <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Após executar o Passo 1, clique aqui para criar todas as tabelas e políticas de segurança. Isso prepara o banco para o passo final.</p>
                     
                     {message && <div className="mb-4"><Alert message={message.text} type={message.type} /></div>}

                     <button 
                        onClick={handleSetupDatabase}
                        disabled={isLoading}
                        className="w-full sm:w-auto flex justify-center items-center py-3 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isLoading ? (
                            <>
                                <LoadingSpinner />
                                <span className="ml-2">Configurando...</span>
                            </>
                        ) : 'Executar Setup do Banco'}
                     </button>
                </div>

                <div className="mt-6">
                    <CodeBlock
                        title="Passo 3 (Manual): Sincronizar Novos Usuários"
                        explanation="Para que um perfil seja criado automaticamente para cada novo usuário, configure um Webhook de Autenticação no Supabase: Vá para Authentication > Webhooks, clique em 'Add new webhook', dê um nome (ex: 'Criar Perfil'), selecione o evento 'User Signed Up' e cole a URL abaixo."
                        code={authHookUrl}
                    />
                </div>
            </section>
            
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração do Webhook de Pagamentos</h2>
                 <CodeBlock
                    title="URL do Webhook para Produção (Mercado Pago)"
                    explanation="Copie esta URL e cole no painel do Mercado Pago (Desenvolvedor > Suas Aplicações > Webhooks). Marque o evento 'Pagamentos' para receber notificações de PIX e boletos pagos."
                    code={webhookUrl}
                />
            </section>
        </div>
    );
};

export default DeveloperTab;