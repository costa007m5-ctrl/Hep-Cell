import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

// --- Funções de Criptografia para PKCE (Proof Key for Code Exchange) ---

// Converte um buffer de dados para uma string no formato Base64URL
function base64URLEncode(str: ArrayBuffer): string {
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(str))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Gera o "desafio" a partir do "verificador", usando hash SHA-256
async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(digest);
}

// --- Componentes ---

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

const MercadoPagoIntegration: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [mpConnected, setMpConnected] = useState<boolean | null>(null); // null = verificando, true = conectado, false = desconectado

    // Verifica o status da conexão ao carregar a página
    useEffect(() => {
        fetch('/api/admin/test-mercadopago', { method: 'POST' })
            .then(res => setMpConnected(res.ok));
    }, []);

    // Processa o retorno do Mercado Pago após a autorização
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            const codeVerifier = sessionStorage.getItem('mp_code_verifier');
            if (!codeVerifier) {
                setError("Erro de segurança: o verificador de código não foi encontrado. Tente conectar novamente.");
                sessionStorage.removeItem('mp_code_verifier');
                return;
            }

            setIsLoading(true);
            const redirectUri = window.location.origin + window.location.pathname;
            
            fetch('/api/admin/generate-mercadopago-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, redirectUri, codeVerifier }),
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.message || data.error);
                setAccessToken(data.accessToken);
                setMpConnected(true); // Atualiza o status para conectado
            })
            .catch(err => setError(err.message))
            .finally(() => {
                setIsLoading(false);
                sessionStorage.removeItem('mp_code_verifier');
                window.history.replaceState(null, '', redirectUri);
            });
        }
    }, []);
    
    // Inicia o processo de conexão
    const handleConnect = async () => {
        setIsConnecting(true);
        setError(null);
        try {
            // Gera e armazena o verificador para o fluxo PKCE
            const verifier = base64URLEncode(window.crypto.getRandomValues(new Uint8Array(32)));
            const challenge = await generateCodeChallenge(verifier);
            sessionStorage.setItem('mp_code_verifier', verifier);

            const response = await fetch('/api/admin/get-mp-auth-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code_challenge: challenge })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Falha ao obter URL de autorização.');
            }
            window.location.href = data.authUrl;
        } catch (err: any) {
            setError(err.message);
            setIsConnecting(false);
        }
    };

    return (
        <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Integração com Mercado Livre / Mercado Pago</h2>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Siga os passos abaixo para conectar sua conta de forma segura e gerar o token de acesso para pagamentos e produtos.
                </p>
                <div>
                    <h3 className="font-bold">Passo 1: Configure as Variáveis de Ambiente</h3>
                    <p className="text-xs text-slate-500 mt-1 mb-2">Adicione as seguintes chaves no painel do seu projeto na Vercel:</p>
                     <ul className="list-disc list-inside text-sm font-mono space-y-1">
                        <li><code className="bg-slate-200 dark:bg-slate-700 p-1 rounded text-xs">ML_CLIENT_ID</code></li>
                        <li><code className="bg-slate-200 dark:bg-slate-700 p-1 rounded text-xs">ML_CLIENT_SECRET</code></li>
                    </ul>
                     <p className="text-xs text-slate-500 mt-2">Você pode encontrar essas chaves nas <strong>Credenciais</strong> da sua aplicação no <a href="https://www.mercadopago.com.br/developers" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">painel de desenvolvedor do Mercado Pago</a>.</p>
                </div>
                 <div>
                    <h3 className="font-bold">Passo 2: Gere seu Access Token</h3>
                    <p className="text-xs text-slate-500 mt-1 mb-2">Clique no botão abaixo para autorizar o aplicativo. Você será redirecionado e depois voltará para esta tela.</p>
                    
                    {mpConnected === null && (
                         <div className="flex items-center gap-2 text-sm text-slate-500">
                            <LoadingSpinner /> Verificando conexão...
                        </div>
                    )}
                    
                    {mpConnected === true && (
                        <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-medium">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Conexão Ativa! O Access Token está configurado no servidor.</span>
                        </div>
                    )}
                    
                    {mpConnected === false && (
                         <button onClick={handleConnect} disabled={isLoading || isConnecting} className="py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50">
                            {isLoading || isConnecting ? <LoadingSpinner /> : 'Conectar com Mercado Pago e Gerar Token'}
                        </button>
                    )}
                </div>
                 {error && <Alert message={error} type="error" />}
                 {accessToken && (
                    <div className="animate-fade-in">
                        <h3 className="font-bold">Passo 3: Salve seu Access Token</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-2">Token gerado com sucesso! Copie o valor abaixo e cole na variável de ambiente <code className="bg-slate-200 dark:bg-slate-700 p-1 rounded text-xs font-mono">MERCADO_PAGO_ACCESS_TOKEN</code> no seu painel da Vercel.</p>
                        <CodeBlock title="Seu Access Token de Produção" code={accessToken} />
                    </div>
                )}
            </div>
        </section>
    )
}


const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    
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
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">ML_CLIENT_ID</code> (ID da sua aplicação no Mercado Livre)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">ML_CLIENT_SECRET</code> (Chave secreta da sua aplicação)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">MERCADO_PAGO_ACCESS_TOKEN</code> (Será gerado abaixo)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> (URL do seu projeto Supabase)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (Chave anônima pública do Supabase)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> (Sua chave secreta 'service_role' do Supabase)</li>
                    </ul>
                     <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-4 font-semibold">
                        Após adicionar as chaves, vá para a aba "Status & Verificação" para testar as conexões.
                    </p>
                </div>
            </section>
            
            <MercadoPagoIntegration />

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
        </div>
    );
};

export default DeveloperTab;