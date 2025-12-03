
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
    const [copyText, setCopyText] = React.useState('Copiar Código');

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopyText('Copiado!');
        setTimeout(() => setCopyText('Copiar Código'), 2000);
    };

    return (
        <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">{title}</h3>
            {explanation && <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{explanation}</p>}
            <div className="relative">
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg overflow-x-auto text-left text-xs font-mono custom-scrollbar max-h-96 whitespace-pre-wrap">
                    <code>{code.trim()}</code>
                </pre>
                <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold py-1.5 px-3 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    {copyText}
                </button>
            </div>
        </div>
    );
};

const emailTemplateHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; }
    .container { max-width: 500px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 30px; text-align: center; color: #374151; }
    .content p { margin-bottom: 20px; line-height: 1.6; font-size: 16px; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 10px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3); transition: background-color 0.3s; }
    .btn:hover { background-color: #4338ca; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
    .small { font-size: 12px; color: #6b7280; margin-top: 20px; }
  </style>
</head>
<body>
  <div className="container">
    <div className="header">
      <h1>Relp Cell</h1>
    </div>
    <div className="content">
      <h2>Esqueceu sua senha?</h2>
      <p>Não se preocupe, acontece com todo mundo. Clique no botão abaixo para criar uma nova senha segura.</p>
      <a href="{{ .ConfirmationURL }}" class="btn">Redefinir Minha Senha</a>
      <p class="small">Se você não solicitou esta alteração, pode ignorar este email com segurança.</p>
    </div>
    <div className="footer">
      <p>&copy; Relp Cell - Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>
`;

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

const InvoiceCheckTester: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{message: string} | null>(null);

    const handleCheck = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/cron', { method: 'POST' });
            const data = await res.json();
            
            let msg = "";
            if (data.success) {
                msg = `Sucesso! ${data.notifications} notificações enviadas e ${data.emails} emails simulados.`;
            } else {
                msg = data.message || data.error || "Erro desconhecido";
            }
            setResult({ message: msg });
        } catch (e: any) {
            setResult({ message: "Erro de conexão: " + e.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Automação de Cobrança</h2>
            <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Verificador de Vencimentos (Cron Job)</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Esta rotina roda automaticamente todos os dias às 09:00 para enviar avisos de faturas que vencem hoje ou em 3 dias.
                        </p>
                    </div>
                </div>
                
                <div className="pt-2">
                    <button 
                        onClick={handleCheck} 
                        disabled={loading}
                        className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <LoadingSpinner /> : 'Executar Verificação Agora'}
                    </button>
                </div>

                {result && (
                    <div className="mt-2 p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 animate-fade-in">
                        <p className="text-sm font-mono">{result.message}</p>
                    </div>
                )}
            </div>
        </section>
    );
};


const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    
    // SQL Completo com Policies e Tabela de Indicação - ATUALIZADO
    const SETUP_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions"; 

-- Tabela de Enquetes (Polls)
CREATE TABLE IF NOT EXISTS "public"."polls" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "question" "text" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."polls" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view polls" ON "public"."polls";
CREATE POLICY "Public view polls" ON "public"."polls" FOR SELECT USING (true); -- Público vê

-- Tabela de Opções de Enquete
CREATE TABLE IF NOT EXISTS "public"."poll_options" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "poll_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "votes" integer DEFAULT 0,
    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE
);
ALTER TABLE "public"."poll_options" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view poll options" ON "public"."poll_options";
CREATE POLICY "Public view poll options" ON "public"."poll_options" FOR SELECT USING (true);

-- Tabela de Votos (Para evitar voto duplo)
CREATE TABLE IF NOT EXISTS "public"."poll_votes" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "poll_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
);
ALTER TABLE "public"."poll_votes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users vote once" ON "public"."poll_votes";
CREATE POLICY "Users vote once" ON "public"."poll_votes" FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own votes" ON "public"."poll_votes";
CREATE POLICY "Users view own votes" ON "public"."poll_votes" FOR SELECT USING (auth.uid() = user_id);

-- Tabela Changelog (Implementações Reais)
CREATE TABLE IF NOT EXISTS "public"."app_changelog" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "version" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "date" timestamp with time zone DEFAULT "now"(),
    "type" "text", -- 'feature', 'fix', 'improvement'
    CONSTRAINT "app_changelog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."app_changelog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read changelog" ON "public"."app_changelog";
CREATE POLICY "Public read changelog" ON "public"."app_changelog" FOR SELECT USING (true);

-- Tabela de Perfis
CREATE TABLE IF NOT EXISTS "public"."profiles" ( "id" "uuid" NOT NULL, "email" "text", "first_name" "text", "last_name" "text", "identification_number" "text", "phone" "text", "credit_score" integer DEFAULT 0, "credit_limit" numeric(10, 2) DEFAULT 0, "credit_status" "text" DEFAULT 'Em Análise', "last_limit_request_date" timestamp with time zone, "avatar_url" "text", "zip_code" "text", "street_name" "text", "street_number" "text", "neighborhood" "text", "city" "text", "federal_unit" "text", "preferred_due_day" integer DEFAULT 10, "internal_notes" "text", "salary" numeric(10, 2) DEFAULT 0, "referral_code" "text", "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"), CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE, CONSTRAINT "profiles_email_key" UNIQUE ("email"), CONSTRAINT "profiles_referral_code_key" UNIQUE ("referral_code") ); 
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "internal_notes" "text"; 
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "salary" numeric(10, 2) DEFAULT 0; 
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "referral_code" "text";

-- Tabela de Indicações (Referrals)
CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "referrer_id" "uuid" NOT NULL,
    "referee_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'registered',
    "reward_amount" numeric(10, 2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "referrals_referrer_fkey" FOREIGN KEY ("referrer_id") REFERENCES "public"."profiles"("id"),
    CONSTRAINT "referrals_referee_fkey" FOREIGN KEY ("referee_id") REFERENCES "public"."profiles"("id")
);
ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own referrals" ON "public"."referrals";
CREATE POLICY "Users view own referrals" ON "public"."referrals" FOR SELECT USING (auth.uid() = referrer_id); 

-- Tabela de Documentos
CREATE TABLE IF NOT EXISTS "public"."client_documents" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "title" "text", "document_type" "text", "file_url" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id"), CONSTRAINT "client_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); 
ALTER TABLE "public"."client_documents" ENABLE ROW LEVEL SECURITY; 
DROP POLICY IF EXISTS "Users view own documents" ON "public"."client_documents";
CREATE POLICY "Users view own documents" ON "public"."client_documents" FOR SELECT USING (auth.uid() = user_id); 

-- Tabela de Solicitações de Limite
CREATE TABLE IF NOT EXISTS "public"."limit_requests" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "requested_amount" numeric(10, 2), "current_limit" numeric(10, 2), "justification" "text", "status" "text" DEFAULT 'pending', "admin_response_reason" "text", "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "limit_requests_pkey" PRIMARY KEY ("id"), CONSTRAINT "limit_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); 
ALTER TABLE "public"."limit_requests" ADD COLUMN IF NOT EXISTS "admin_response_reason" "text"; 
ALTER TABLE "public"."limit_requests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."limit_requests" ENABLE ROW LEVEL SECURITY; 

DROP POLICY IF EXISTS "Users view own limit requests" ON "public"."limit_requests";
DROP POLICY IF EXISTS "Users create own limit requests" ON "public"."limit_requests";
CREATE POLICY "Users view own limit requests" ON "public"."limit_requests" FOR SELECT USING (auth.uid() = user_id); 
CREATE POLICY "Users create own limit requests" ON "public"."limit_requests" FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tabela de Contratos
CREATE TABLE IF NOT EXISTS "public"."contracts" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "items" "text",
    "total_value" numeric(10, 2),
    "installments" integer,
    "status" "text" DEFAULT 'pending_signature',
    "signature_data" "text",
    "terms_accepted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);
ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own contracts" ON "public"."contracts";
DROP POLICY IF EXISTS "Users update own contracts" ON "public"."contracts";

CREATE POLICY "Users view own contracts" ON "public"."contracts" FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own contracts" ON "public"."contracts" FOR UPDATE USING (auth.uid() = user_id);
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
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração do Banco de Dados (Supabase)</h2>
                 <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 mb-6">
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200">Atualização do Sistema</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                        Clique no botão abaixo para criar as novas tabelas de <strong>Enquetes (Polls)</strong> e <strong>Histórico de Versões (Changelog)</strong> no banco de dados. Isso habilitará as novas funcionalidades na aba Novidades.
                    </p>
                </div>

                <div className="mb-8">
                    <button 
                        onClick={handleSetupDatabase}
                        disabled={isLoading}
                        className="w-full sm:w-auto flex justify-center items-center py-3 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isLoading ? <LoadingSpinner /> : 'Atualizar / Reparar Banco de Dados'}
                    </button>
                    {message && <div className="mt-4"><Alert message={message.text} type={message.type} /></div>}
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Código SQL de Referência</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Este script mostra exatamente o que será criado no seu banco de dados.
                    </p>
                    
                    <CodeBlock
                        title="Estrutura das Tabelas"
                        explanation="Inclui tabelas de Enquetes, Changelog, Contratos, etc."
                        code={SETUP_SQL}
                    />
                </div>
            </section>

            <InvoiceCheckTester />

            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração de Recuperação de Senha</h2>
                <CodeBlock 
                    title="Template HTML para Email de Reset" 
                    explanation="Copie este código e cole no template 'Reset Password' do Supabase."
                    code={emailTemplateHTML}
                />
            </section>

            <MercadoPagoIntegration />
        </div>
    );
};

export default DeveloperTab;
