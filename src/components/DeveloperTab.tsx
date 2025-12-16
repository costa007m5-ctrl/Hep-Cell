
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

// --- Funções de Criptografia para PKCE (Proof Key for Code Exchange) ---

function base64URLEncode(str: ArrayBuffer): string {
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(str))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

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

const IntegrationsManager: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [mpConnected, setMpConnected] = useState<boolean | null>(null);
    const [mlConnected, setMlConnected] = useState<boolean | null>(null);

    // Verifica o status das conexões
    useEffect(() => {
        // Verifica Mercado Pago (Pagamentos)
        fetch('/api/admin/test-mercadopago', { method: 'POST' })
            .then(res => setMpConnected(res.ok));
            
        // Verifica Mercado Livre (Produtos - Env Vars)
        fetch('/api/admin/test-mercadolivre', { method: 'POST' })
            .then(res => setMlConnected(res.ok));
    }, []);

    // Processa o retorno do Mercado Pago após a autorização
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            const codeVerifier = sessionStorage.getItem('mp_code_verifier');
            if (!codeVerifier) {
                setError("Erro de segurança: verifique se você iniciou a conexão por esta página.");
                sessionStorage.removeItem('mp_code_verifier');
                return;
            }

            setIsLoading(true);
            const redirectUri = window.location.origin + window.location.pathname;
            
            // Troca o código pelo token e SALVA NO BANCO automaticamente
            fetch('/api/admin/generate-mercadopago-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, redirectUri, codeVerifier }),
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.message || data.error);
                setSuccessMsg("Integração concluída! O sistema já está processando pagamentos.");
                setMpConnected(true);
            })
            .catch(err => setError(err.message))
            .finally(() => {
                setIsLoading(false);
                sessionStorage.removeItem('mp_code_verifier');
                window.history.replaceState(null, '', redirectUri);
            });
        }
    }, []);
    
    // Inicia o processo de conexão MP
    const handleConnectMP = async () => {
        setIsConnecting(true);
        setError(null);
        try {
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

    const handleDisconnectMP = async () => {
        if (!confirm("Tem certeza que deseja desconectar o Mercado Pago? As vendas automáticas pararão de funcionar.")) {
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/disconnect-mercadopago', {
                method: 'POST'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erro ao desconectar');
            
            setMpConnected(false);
            setSuccessMsg(data.message);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mercadopago/webhook` : '';

    return (
        <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Integrações de Venda</h2>
            
            {/* Seção Mercado Pago */}
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 space-y-6 shadow-sm mb-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Pagamentos (Mercado Pago)</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Conecte sua conta para receber pagamentos via Pix e Cartão automaticamente.
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Status da Conexão</h4>
                    
                    {mpConnected === null && (
                         <div className="flex items-center gap-2 text-sm text-slate-500">
                            <LoadingSpinner /> Verificando...
                        </div>
                    )}
                    
                    {mpConnected === true && (
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex-1 flex items-center gap-3 p-3 w-full bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-lg border border-green-100 dark:border-green-800/50">
                                <div className="bg-green-100 dark:bg-green-800 p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>
                                <div>
                                    <p className="font-bold text-sm">Conectado com Sucesso</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleDisconnectMP} 
                                disabled={isLoading} 
                                className="w-full sm:w-auto py-3 px-6 border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-bold text-xs transition-colors"
                            >
                                {isLoading ? <LoadingSpinner /> : 'Desconectar Conta'}
                            </button>
                        </div>
                    )}
                    
                    {mpConnected === false && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                <span>Pagamentos indisponíveis. Conecte uma conta.</span>
                            </div>
                            <button 
                                onClick={handleConnectMP} 
                                disabled={isLoading || isConnecting} 
                                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]"
                            >
                                {isLoading || isConnecting ? <LoadingSpinner /> : 'Conectar Mercado Pago'}
                            </button>
                        </div>
                    )}
                </div>

                 {error && <Alert message={error} type="error" />}
                 {successMsg && <Alert message={successMsg} type="success" />}

                {/* Webhook Info */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-2 text-sm">URL de Retorno (Webhook)</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        Para baixa automática, cadastre no Mercado Pago:
                    </p>
                    <CodeBlock 
                        title="" 
                        code={webhookUrl} 
                    />
                </div>
            </div>

            {/* Seção Mercado Livre (Produtos) */}
            <div className="p-6 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 space-y-4 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center text-yellow-700 dark:text-yellow-200 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Importação de Produtos (Mercado Livre)</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Permite importar dados de produtos usando o link. Configurada via variáveis de ambiente.
                        </p>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    {mlConnected === null ? <LoadingSpinner /> : mlConnected ? (
                        <>
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Configurado e Ativo</span>
                        </>
                    ) : (
                        <>
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Não configurado (Adicione ML_CLIENT_ID na Vercel)</span>
                        </>
                    )}
                </div>
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
                msg = `Sucesso! ${data.notifications_sent} notificações enviadas e limpeza realizada.`;
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

            <IntegrationsManager />
        </div>
    );
};

export default DeveloperTab;
