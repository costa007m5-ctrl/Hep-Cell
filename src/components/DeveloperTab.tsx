
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


const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [showSql, setShowSql] = useState(true); 
    
    const resetPasswordUrl = `${window.location.origin}/reset-password`;

    const rpcFunctionSQL = `
CREATE OR REPLACE FUNCTION execute_admin_sql(sql_query text)
RETURNS void AS $$
BEGIN
  EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `.trim();

    // SQL Completo com Políticas RLS, Trigger de Cadastro e Função de Busca Aprimorada
    // Agora inclui tabelas para contratos, notas fiscais e SUPORTE
    // E a nova tabela de MISSÕES com pontos ajustados
    const SETUP_SQL = `
-- 1. Habilitar Extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- 2. Tabelas Principais (Profiles)
CREATE TABLE IF NOT EXISTS "public"."profiles" ( 
    "id" "uuid" NOT NULL, 
    "email" "text", 
    "first_name" "text", 
    "last_name" "text",
    "identification_number" "text",
    "phone" "text",
    "credit_score" integer DEFAULT 0,
    "credit_limit" numeric(10, 2) DEFAULT 0,
    "credit_status" "text" DEFAULT 'Em Análise',
    "last_limit_request_date" timestamp with time zone,
    "avatar_url" "text",
    "zip_code" "text",
    "street_name" "text",
    "street_number" "text",
    "neighborhood" "text",
    "city" "text",
    "federal_unit" "text",
    "created_at" timestamp with time zone DEFAULT "now"(), 
    "updated_at" timestamp with time zone DEFAULT "now"(), 
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"), 
    CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE, 
    CONSTRAINT "profiles_email_key" UNIQUE ("email") 
);

-- 3. Tabela de Missões (Gamificação)
CREATE TABLE IF NOT EXISTS "public"."user_missions" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "user_id" "uuid" NOT NULL,
    "mission_id" "text" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "claimed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_missions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_missions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "user_missions_unique" UNIQUE ("user_id", "mission_id")
);
ALTER TABLE "public"."user_missions" ENABLE ROW LEVEL SECURITY;

-- 4. Tabelas de Suporte (Enterprise)
CREATE TABLE IF NOT EXISTS "public"."support_tickets" ( 
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), 
    "user_id" "uuid" NOT NULL, 
    "status" "text" DEFAULT 'open', 
    "subject" "text",
    "category" "text",
    "priority" "text" DEFAULT 'normal',
    "created_at" timestamp with time zone DEFAULT "now"(), 
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "ticket_id" "uuid" NOT NULL,
    "sender_type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "is_internal" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE
);

-- 5. Políticas de Segurança (RLS)
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles";
    CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (auth.uid() = id);
    
    DROP POLICY IF EXISTS "Users can update own profile" ON "public"."profiles";
    CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (auth.uid() = id);

    -- Missions
    DROP POLICY IF EXISTS "Users can view own missions" ON "public"."user_missions";
    CREATE POLICY "Users can view own missions" ON "public"."user_missions" FOR SELECT USING (auth.uid() = user_id);
    
    -- Support
    DROP POLICY IF EXISTS "Users view own tickets" ON "public"."support_tickets";
    CREATE POLICY "Users view own tickets" ON "public"."support_tickets" FOR SELECT USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users create own tickets" ON "public"."support_tickets";
    CREATE POLICY "Users create own tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users view messages" ON "public"."support_messages";
    CREATE POLICY "Users view messages" ON "public"."support_messages" FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid()) 
        AND is_internal = false
    );
    
    DROP POLICY IF EXISTS "Users insert messages" ON "public"."support_messages";
    CREATE POLICY "Users insert messages" ON "public"."support_messages" FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Função Segura para Resgate de Missão (RPC) - GARANTE 1X POR MISSÃO
CREATE OR REPLACE FUNCTION claim_mission_reward(mission_id_input text, xp_reward int, reason_input text)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Verifica se já foi resgatada
  IF EXISTS (SELECT 1 FROM public.user_missions WHERE user_id = v_user_id AND mission_id = mission_id_input) THEN
    RAISE EXCEPTION 'Missão já resgatada.';
  END IF;

  -- Registra a missão
  INSERT INTO public.user_missions (user_id, mission_id, claimed_at, completed_at)
  VALUES (v_user_id, mission_id_input, now(), now());

  -- Atualiza o score (máximo 1000)
  UPDATE public.profiles
  SET credit_score = LEAST(1000, credit_score + xp_reward)
  WHERE id = v_user_id;

  -- Registra histórico
  INSERT INTO public.score_history (user_id, change, new_score, reason)
  SELECT v_user_id, xp_reward, credit_score, reason_input
  FROM public.profiles WHERE id = v_user_id;
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
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração do Banco de Dados (Supabase)</h2>
                 <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 mb-6">
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200">Atualização de Segurança e Gamificação</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                        Para ativar o sistema de missões com validação profissional (evitar fraude de pontos), copie o código SQL abaixo e execute no Supabase. Isso cria a tabela `user_missions` e a função `claim_mission_reward`.
                    </p>
                </div>

                <div className="mb-8">
                    <button 
                        onClick={handleSetupDatabase}
                        disabled={isLoading}
                        className="hidden w-full sm:w-auto flex justify-center items-center py-3 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isLoading ? <LoadingSpinner /> : 'Tentar Setup Automático'}
                    </button>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Código SQL de Setup</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Este script configura o sistema de missões, suporte e garante a segurança dos dados.
                    </p>
                    
                    <CodeBlock
                        title="SQL Completo de Setup"
                        explanation="Copie e cole no SQL Editor do Supabase."
                        code={SETUP_SQL}
                    />
                </div>
            </section>

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
