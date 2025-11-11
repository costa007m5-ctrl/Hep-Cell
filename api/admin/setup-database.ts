import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// O script SQL completo que será executado.
// É o mesmo script que antes estava visível no painel do desenvolvedor.
const fullSetupSQL = `
-- Habilita a extensão pgcrypto se ainda não estiver habilitada (necessária para gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABELA DE FATURAS (INVOICES)
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month text NOT NULL,
  due_date date NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'Em aberto'::text,
  payment_method text NULL,
  payment_date timestamptz NULL,
  payment_id text NULL,
  boleto_url text NULL,
  boleto_barcode text NULL,
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
`;


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase environment variables are not set.');
    return res.status(500).json({ error: 'Configuração do servidor Supabase incompleta.' });
  }

  try {
    // Cria um cliente Supabase com permissões de administrador (service_role)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // A função RPC 'execute_admin_sql' deve ser criada no Supabase primeiro.
    // Ela permite a execução segura de scripts SQL a partir da API.
    const { error } = await supabaseAdmin.rpc('execute_admin_sql', {
      sql_query: fullSetupSQL
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      // Fornece uma mensagem de erro mais útil se a função não existir
      if (error.message.includes('function execute_admin_sql() does not exist')) {
        return res.status(500).json({ 
          error: "A função de setup 'execute_admin_sql' não foi encontrada.",
          message: "Por favor, execute o 'Passo 1' na aba Desenvolvedor do painel de admin para criar a função necessária e tente novamente."
        });
      }
      throw error;
    }

    res.status(200).json({ success: true, message: 'Banco de dados configurado com sucesso!' });
  } catch (error: any) {
    console.error('Error setting up database:', error);
    res.status(500).json({
      error: 'Falha ao executar o setup do banco de dados.',
      message: error.message
    });
  }
}
