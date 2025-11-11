import React from 'react';

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
    
    const webhookUrl = `${window.location.origin}/api/mercadopago/webhook`;

    const fullSetupSQL = `
-- =================================================================
--      SCRIPT DE SETUP COMPLETO - RELP CELL PAGAMENTOS
-- =================================================================
-- Este script configura todas as tabelas, funções e políticas
-- de segurança necessárias para a aplicação funcionar.
-- É seguro executá-lo múltiplas vezes.

-- 1. TABELA DE FATURAS (INVOICES)
-- Esta tabela armazena todas as faturas e também os detalhes de pagamento,
-- incluindo as informações do boleto.
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month text NOT NULL,
  due_date date NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'Em aberto'::text, -- >> COLUNA DE STATUS (muda para 'Boleto Gerado')
  payment_method text NULL,
  payment_date timestamptz NULL,
  payment_id text NULL, -- >> COLUNA PARA O ID DA TRANSAÇÃO NO MERCADO PAGO
  boleto_url text NULL, -- >> COLUNA PARA ARMAZENAR O LINK DO BOLETO PDF
  boleto_barcode text NULL, -- >> COLUNA PARA ARMAZENAR O CÓDIGO DE BARRAS
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NULL,
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. TABELA DE PERFIS (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NULL,
  first_name text NULL,
  last_name text NULL,
  identification_type text NULL,
  identification_number text NULL,
  zip_code text NULL,
  street_name text NULL,
  street_number text NULL,
  neighborhood text NULL,
  city text NULL,
  federal_unit text NULL,
  updated_at timestamptz NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 3. FUNÇÃO PARA CRIAR PERFIL DE NOVO USUÁRIO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- TRIGGER para executar a função acima
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. FUNÇÃO PARA ATUALIZAR O CAMPO 'updated_at' AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.moddatetime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- TRIGGER para 'invoices'
DROP TRIGGER IF EXISTS handle_updated_at ON public.invoices;
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE PROCEDURE public.moddatetime();

-- TRIGGER para 'profiles'
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.moddatetime();


-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. POLÍTICAS DE SEGURANÇA PARA USUÁRIOS NORMAIS

-- Tabela 'invoices':
DROP POLICY IF EXISTS "Enable read access for own invoices" ON public.invoices;
CREATE POLICY "Enable read access for own invoices"
ON public.invoices FOR SELECT USING (auth.uid() = user_id);

-- Tabela 'profiles':
DROP POLICY IF EXISTS "Enable read access for own user" ON public.profiles;
CREATE POLICY "Enable read access for own user"
ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Enable update for own user" ON public.profiles;
CREATE POLICY "Enable update for own user"
ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Enable insert for own user" ON public.profiles;
CREATE POLICY "Enable insert for own user"
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 7. POLÍTICAS DE SEGURANÇA PARA O ADMINISTRADOR
-- !!! IMPORTANTE !!!
-- Substitua '1da77e27-f1df-4e35-bcec-51dc2c5a9062' pelo ID do seu usuário Admin.
-- Você pode encontrá-lo em 'Authentication' > 'Users' no painel do Supabase.

-- Acesso total a 'invoices':
DROP POLICY IF EXISTS "Enable full access for admin" ON public.invoices;
CREATE POLICY "Enable full access for admin"
ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062')
WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');

-- Acesso total a 'profiles':
DROP POLICY IF EXISTS "Enable full access for admin" ON public.profiles;
CREATE POLICY "Enable full access for admin"
ON public.profiles FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062')
WITH CHECK (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062');
    `.trim();

    return (
        <div className="p-4 space-y-8">
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração das Variáveis de Ambiente</h2>
                <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700">
                     <p className="text-sm text-indigo-700 dark:text-indigo-300">
                        Adicione estas chaves como <strong>Variáveis de Ambiente</strong> no painel do seu projeto na Vercel para garantir a segurança e o funcionamento.
                    </p>
                    <ul className="list-disc list-inside text-sm text-indigo-700 dark:text-indigo-300 mt-2 space-y-1 font-mono">
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">API_KEY</code> (sua chave da API do Gemini)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">MERCADO_PAGO_ACCESS_TOKEN</code> (seu Access Token de produção)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">SUPABASE_URL</code></li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code></li>
                    </ul>
                </div>
            </section>
            
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração do Webhook</h2>
                 <CodeBlock
                    title="URL do Webhook para Produção"
                    explanation="Copie esta URL e cole no painel do Mercado Pago (Desenvolvedor > Suas Aplicações > Webhooks). Marque o evento 'Pagamentos' para receber notificações de PIX e boletos pagos."
                    code={webhookUrl}
                />
            </section>

            <section>
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Setup Completo e Correções</h2>
                 <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 mb-6">
                    <h3 className="font-bold text-green-800 dark:text-green-200">Passo Único e Obrigatório</h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                        Para que o aplicativo funcione, o banco de dados precisa ser preparado. O script abaixo cria todas as tabelas e regras de segurança necessárias. Execute-o uma vez no seu Editor SQL do Supabase.
                    </p>
                </div>
                 <CodeBlock
                    title="Script Completo (Setup Inicial)"
                    explanation="Este script configura tudo! Lembre-se de alterar o ID do usuário administrador dentro do script antes de executá-lo."
                    code={fullSetupSQL}
                />
            </section>
        </div>
    );
};

export default DeveloperTab;