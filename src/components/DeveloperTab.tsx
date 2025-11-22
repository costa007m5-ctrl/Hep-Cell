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
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg overflow-x-auto text-left text-sm custom-scrollbar max-h-64">
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
    
    const authHookUrl = `${window.location.origin}/api/mercadopago/auth-hook`;
    const resetPasswordUrl = `${window.location.origin}/reset-password`;

    const rpcFunctionSQL = `
CREATE OR REPLACE FUNCTION execute_admin_sql(sql_query text)
RETURNS void AS $$
BEGIN
  EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `.trim();

    // SQL atualizado com Constraints e Função de Lookup para Login
    const SETUP_SQL = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
    CREATE TABLE IF NOT EXISTS "public"."system_settings" ( "key" "text" NOT NULL, "value" "text", "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key") );
    ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;
    
    CREATE TABLE IF NOT EXISTS "public"."profiles" ( "id" "uuid" NOT NULL, "email" "text", "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"), CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE, CONSTRAINT "profiles_email_key" UNIQUE ("email") );
    
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "first_name" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "last_name" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "credit_score" integer;
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "credit_limit" numeric(10, 2);
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "credit_status" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "last_limit_request_date" timestamp with time zone;
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "avatar_url" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "identification_type" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "identification_number" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "phone" "text"; 
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "zip_code" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "street_name" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "street_number" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "neighborhood" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "city" "text";
    ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "federal_unit" "text";
    
    ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

    -- Constraint para CPF Único (se tiver valor)
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_identification_number_key') THEN
        ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_identification_number_key" UNIQUE ("identification_number");
      END IF;
    END $$;

    -- Constraint para Telefone Único (se tiver valor)
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_phone_key') THEN
        ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_phone_key" UNIQUE ("phone");
      END IF;
    END $$;

    -- Função Segura para Buscar Email por Identificador (CPF ou Telefone)
    CREATE OR REPLACE FUNCTION get_email_by_identifier(identifier_input text)
    RETURNS text AS $$
    DECLARE
      found_email text;
    BEGIN
      -- Tenta encontrar pelo CPF (formato exato armazenado)
      SELECT email INTO found_email FROM profiles WHERE identification_number = identifier_input LIMIT 1;
      
      IF found_email IS NOT NULL THEN 
        RETURN found_email; 
      END IF;

      -- Tenta encontrar pelo Telefone (formato exato armazenado)
      SELECT email INTO found_email FROM profiles WHERE phone = identifier_input LIMIT 1;
      
      RETURN found_email;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Restante das tabelas
    CREATE TABLE IF NOT EXISTS "public"."addresses" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "street" "text" NOT NULL, "number" "text" NOT NULL, "neighborhood" "text" NOT NULL, "city" "text" NOT NULL, "state" "text" NOT NULL, "zip_code" "text" NOT NULL, "is_default" boolean DEFAULT false, "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "addresses_pkey" PRIMARY KEY ("id"), CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE );
    ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."products" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "name" "text" NOT NULL, "description" "text", "price" numeric(10, 2) NOT NULL, "stock" integer NOT NULL, "image_url" "text", "category" "text", "brand" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "products_pkey" PRIMARY KEY ("id") );
    ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."orders" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "status" "text" NOT NULL DEFAULT 'pending', "total" numeric(10, 2) NOT NULL, "tracking_code" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "orders_pkey" PRIMARY KEY ("id"), CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE );
    ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."order_items" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "order_id" "uuid" NOT NULL, "product_id" "uuid", "quantity" integer NOT NULL, "price" numeric(10, 2) NOT NULL, "product_name" "text", CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"), CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE );
    ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."invoices" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid", "month" "text" NOT NULL, "due_date" "date" NOT NULL, "amount" numeric(10, 2) NOT NULL, "status" "text" NOT NULL DEFAULT 'Em aberto', "payment_method" "text", "payment_date" timestamp with time zone, "payment_id" "text", "boleto_url" "text", "boleto_barcode" "text", "notes" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"), CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL );
    ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."notifications" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "title" "text" NOT NULL, "message" "text" NOT NULL, "type" "text" NOT NULL DEFAULT 'info', "read" boolean NOT NULL DEFAULT false, "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"), CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE );
    ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."score_history" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "change" integer NOT NULL, "new_score" integer NOT NULL, "reason" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "score_history_pkey" PRIMARY KEY ("id"), CONSTRAINT "score_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE );
    ALTER TABLE "public"."score_history" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."limit_requests" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "requested_amount" numeric(10, 2) NOT NULL, "current_limit" numeric(10, 2), "justification" "text", "status" "text" NOT NULL DEFAULT 'pending', "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "limit_requests_pkey" PRIMARY KEY ("id"), CONSTRAINT "limit_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE );
    ALTER TABLE "public"."limit_requests" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."store_banners" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "image_url" "text" NOT NULL, "prompt" "text", "link" "text", "active" boolean DEFAULT true, "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "store_banners_pkey" PRIMARY KEY ("id") );
    ALTER TABLE "public"."store_banners" ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS "public"."action_logs" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "created_at" timestamp with time zone DEFAULT "now"(), "action_type" "text" NOT NULL, "status" "text" NOT NULL, "description" "text", "details" "jsonb", CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id") );
    ALTER TABLE "public"."action_logs" ENABLE ROW LEVEL SECURITY;
    
    CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$ BEGIN RETURN auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062'; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    DROP POLICY IF EXISTS "Allow public read access to banners" ON "public"."store_banners";
    CREATE POLICY "Allow public read access to banners" ON "public"."store_banners" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Allow admin full access to banners" ON "public"."store_banners";
    CREATE POLICY "Allow admin full access to banners" ON "public"."store_banners" FOR ALL USING (is_admin());
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
            
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração de Recuperação de Senha</h2>
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 mb-6">
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                        Para que o "Esqueci a Senha" funcione corretamente com o template bonito, configure o Supabase assim:
                    </p>
                    <ol className="list-decimal list-inside text-sm text-purple-700 dark:text-purple-300 mt-2 space-y-1">
                        <li>Vá no painel do Supabase &gt; Authentication &gt; URL Configuration.</li>
                        <li>Adicione esta URL em <strong>Site URL</strong> ou <strong>Redirect URLs</strong>:</li>
                    </ol>
                    <div className="mt-2 mb-4 bg-white dark:bg-slate-800 p-2 rounded border border-purple-100 dark:border-purple-800 text-xs font-mono break-all">
                        {resetPasswordUrl}
                    </div>
                    
                    <p className="text-sm text-purple-800 dark:text-purple-200 mt-4">
                        Agora, vá em <strong>Authentication &gt; Email Templates &gt; Reset Password</strong> e cole o código abaixo:
                    </p>
                </div>

                <CodeBlock 
                    title="Template HTML para Email de Reset" 
                    explanation="Copie este código e cole no template 'Reset Password' do Supabase para ter um email profissional com as cores da Relp Cell."
                    code={emailTemplateHTML}
                />
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
                     <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Este passo criará as tabelas, aplicará regras de segurança para <strong>CPF e Telefone Únicos</strong> e ativará a função de login por CPF.
                     </p>
                     
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