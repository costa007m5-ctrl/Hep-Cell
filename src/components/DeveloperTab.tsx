import React, { useState } from 'react';
import Alert from './Alert';
import LoadingSpinner from './LoadingSpinner';

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
    const [keys, setKeys] = useState({
        mercadoPagoToken: '',
        geminiApiKey: '',
    });

    const [testing, setTesting] = useState({
        gemini: false,
        mercadoPago: false,
    });

    const [testResults, setTestResults] = useState<{
        gemini: { success: boolean; message: string } | null;
        mercadoPago: { success: boolean; message: string } | null;
    }>({
        gemini: null,
        mercadoPago: null,
    });

    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [statusResult, setStatusResult] = useState<{ success: boolean; message: string } | null>(null);

    const [testPreference, setTestPreference] = useState({ amount: '1.00', description: 'Fatura de Teste' });
    const [isTestingPreference, setIsTestingPreference] = useState(false);
    const [preferenceResult, setPreferenceResult] = useState<{ success: boolean; message: string } | null>(null);

    const [testBoleto, setTestBoleto] = useState({ amount: '5.00', description: 'Boleto de Teste' });
    const [isTestingBoleto, setIsTestingBoleto] = useState(false);
    const [boletoResult, setBoletoResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setKeys(prev => ({ ...prev, [name]: value }));
        if (name === 'geminiApiKey') {
            setTestResults(prev => ({ ...prev, gemini: null }));
        }
        if (name === 'mercadoPagoToken') {
            setTestResults(prev => ({ ...prev, mercadoPago: null }));
        }
    };

    const handleTestKey = async (keyType: 'gemini' | 'mercadoPago') => {
        setTesting(prev => ({ ...prev, [keyType]: true }));
        setTestResults(prev => ({ ...prev, [keyType]: null }));

        const endpoint = keyType === 'gemini' ? '/api/test-gemini' : '/api/mercadopago/test';
        const body = keyType === 'gemini'
            ? { apiKey: keys.geminiApiKey }
            : { accessToken: keys.mercadoPagoToken };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Falha na validação da API.');
            }
            
            setTestResults(prev => ({ ...prev, [keyType]: result }));

        } catch (err: any) {
            setTestResults(prev => ({
                ...prev,
                [keyType]: { success: false, message: err.message || 'Erro de comunicação com a API.' },
            }));
        } finally {
            setTesting(prev => ({ ...prev, [keyType]: false }));
        }
    };
    
    const handleCheckVercelStatus = async () => {
        setIsCheckingStatus(true);
        setStatusResult(null);
        try {
            const response = await fetch('/api/mercadopago/status');
            const result = await response.json();
            setStatusResult(result);
        } catch (err) {
            setStatusResult({ success: false, message: "Erro de comunicação. Não foi possível verificar o status." });
        } finally {
            setIsCheckingStatus(false);
        }
    };

    const handlePreferenceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setTestPreference(prev => ({ ...prev, [name]: value }));
        setPreferenceResult(null);
    };

    const handleTestPreferenceCreation = async () => {
        setIsTestingPreference(true);
        setPreferenceResult(null);
        try {
            if (!testPreference.amount || !testPreference.description || parseFloat(testPreference.amount) <= 0) {
                throw new Error("Por favor, insira um valor e descrição válidos.");
            }

            const response = await fetch('/api/mercadopago/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `test_${Date.now()}`,
                    amount: parseFloat(testPreference.amount),
                    description: testPreference.description,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Falha ao criar preferência. Verifique o console da Vercel para logs.');
            }

            setPreferenceResult({ success: true, message: `Preferência criada com sucesso! ID: ${result.id}` });

        } catch (err: any) {
            setPreferenceResult({ success: false, message: err.message });
        } finally {
            setIsTestingPreference(false);
        }
    };

    const handleBoletoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setTestBoleto(prev => ({ ...prev, [name]: value }));
        setBoletoResult(null);
    };

    const handleTestBoletoCreation = async () => {
        setIsTestingBoleto(true);
        setBoletoResult(null);
        try {
            if (!testBoleto.amount || !testBoleto.description || parseFloat(testBoleto.amount) <= 0) {
                throw new Error("Por favor, insira um valor e descrição válidos.");
            }

            const response = await fetch('/api/mercadopago/create-boleto-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId: `test_boleto_${Date.now()}`,
                    amount: parseFloat(testBoleto.amount),
                    description: testBoleto.description,
                    payer: {
                        email: 'test@example.com',
                        firstName: 'Test',
                        lastName: 'User',
                        identificationType: 'CPF',
                        identificationNumber: '19119119100',
                        zipCode: '01001000',
                        streetName: 'Praça da Sé',
                        streetNumber: '123',
                        neighborhood: 'Sé',
                        city: 'São Paulo',
                        federalUnit: 'SP'
                    }
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || result.message || 'Falha ao gerar boleto. Verifique o console da Vercel para logs.');
            }

            setBoletoResult({ success: true, message: 'Boleto gerado e salvo com sucesso!' });

        } catch (err: any) {
            setBoletoResult({ success: false, message: err.message });
        } finally {
            setIsTestingBoleto(false);
        }
    };

    const migrationScriptSQL = `
-- Script de Migração: Adicionar colunas ausentes à tabela 'profiles'
-- Este script adiciona colunas que podem estar faltando se a tabela foi criada com uma versão antiga.
-- É seguro executá-lo múltiplas vezes.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name text NULL,
ADD COLUMN IF NOT EXISTS last_name text NULL,
ADD COLUMN IF NOT EXISTS identification_type text NULL,
ADD COLUMN IF NOT EXISTS identification_number text NULL,
ADD COLUMN IF NOT EXISTS zip_code text NULL,
ADD COLUMN IF NOT EXISTS street_name text NULL,
ADD COLUMN IF NOT EXISTS street_number text NULL,
ADD COLUMN IF NOT EXISTS neighborhood text NULL,
ADD COLUMN IF NOT EXISTS city text NULL,
ADD COLUMN IF NOT EXISTS federal_unit text NULL,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL;
    `.trim();

    const createProfilesTableSQL = `
-- Tabela para armazenar dados de perfil dos usuários (cria somente se não existir)
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

-- Função para criar um perfil automaticamente quando um novo usuário se cadastra
-- CREATE OR REPLACE FUNCTION já é "rerunável", então não precisa de alterações.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing; -- Adicionado para evitar erro se o perfil já existir
  return new;
end;
$function$;

-- Trigger para executar a função acima
-- A criação de trigger pode falhar se já existir, mas o Supabase geralmente lida com isso.
-- Para ser 100% seguro, poderia ser DROP TRIGGER IF EXISTS ...; CREATE TRIGGER ...
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    `.trim();

    const profilesRlsSQL = `
-- 1. Habilitar RLS (Row Level Security) na tabela de perfis
-- Este comando não gera erro se o RLS já estiver habilitado.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Recriar políticas de segurança para garantir que estão atualizadas
-- Primeiro, removemos as políticas antigas se elas existirem.
DROP POLICY IF EXISTS "Enable read access for own user" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for own user" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for own user" ON public.profiles;

-- Depois, criamos as políticas com a definição correta.
-- Permite que usuários leiam seu próprio perfil.
CREATE POLICY "Enable read access for own user"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Permite que usuários atualizem seu próprio perfil.
CREATE POLICY "Enable update for own user"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- NOVO: Permite que usuários criem (insiram) seu próprio perfil.
-- Essencial para a função 'upsert' funcionar corretamente se o perfil ainda não existir.
CREATE POLICY "Enable insert for own user"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);
    `.trim();

    const fullSetupSQL = `
-- 1. Tabela para armazenar faturas
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Tabela para armazenar dados de perfil dos usuários
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

-- 3. Trigger para criar um perfil automaticamente quando um novo usuário se cadastra
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Habilitar RLS (Row Level Security) nas tabelas
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Segurança para 'invoices'
DROP POLICY IF EXISTS "Enable read access for own invoices" ON public.invoices;
CREATE POLICY "Enable read access for own invoices"
ON public.invoices
FOR SELECT
USING (auth.uid() = user_id);

-- 6. Políticas de Segurança para 'profiles'
DROP POLICY IF EXISTS "Enable read access for own user" ON public.profiles;
CREATE POLICY "Enable read access for own user"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Enable update for own user" ON public.profiles;
CREATE POLICY "Enable update for own user"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Enable insert for own user" ON public.profiles;
CREATE POLICY "Enable insert for own user"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);
    `.trim();
    
    const webhookUrl = `${window.location.origin}/api/mercadopago/webhook`;

    return (
        <div className="p-4 space-y-8">
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração das Variáveis de Ambiente</h2>
                <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 mb-6">
                    <h3 className="font-bold text-indigo-800 dark:text-indigo-200">Como funciona:</h3>
                     <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-2">
                        Adicione as seguintes chaves como <strong>Variáveis de Ambiente</strong> no painel do seu projeto na Vercel para garantir a segurança e o funcionamento da aplicação.
                    </p>
                    <ul className="list-disc list-inside text-sm text-indigo-700 dark:text-indigo-300 mt-2 space-y-1 font-mono">
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">API_KEY</code> (sua chave da API do Gemini)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">MERCADO_PAGO_ACCESS_TOKEN</code> (seu Access Token de produção do MP)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">SUPABASE_URL</code> (encontrado em Project Settings &gt; API no Supabase)</li>
                        <li><code className="bg-indigo-100 dark:bg-indigo-800/50 p-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> (encontrado em Project Settings &gt; API no Supabase)</li>
                    </ul>
                </div>
            </section>
            
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração do Webhook</h2>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 mb-6">
                    <h3 className="font-bold text-green-800 dark:text-green-200">O que é isso?</h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                        O Webhook é a ferramenta que permite ao Mercado Pago nos avisar **automaticamente** quando um cliente paga um boleto ou PIX. Sem isso, o status das faturas não será atualizado para "Paga" sozinho.
                    </p>
                </div>
                 <CodeBlock
                    title="URL do Webhook para Produção"
                    explanation="Copie esta URL e cole no seu painel do Mercado Pago. Siga os passos: Painel do Desenvolvedor > Suas Aplicações > (Selecione a aplicação) > Webhooks. Cole a URL no campo 'URL de produção' e marque o evento 'Pagamentos'."
                    code={webhookUrl}
                />
            </section>

            <section>
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Ferramentas de Teste da API</h2>
            </section>
            
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Correções e Migrações</h2>
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 mb-8">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Erro ao salvar perfil?</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Se você está vendo um erro como <code className="bg-yellow-100 dark:bg-yellow-800/50 p-1 rounded font-mono text-xs">Could not find the 'city' column</code>, significa que sua tabela <strong>profiles</strong> está desatualizada. Execute o script abaixo para adicionar as colunas que faltam sem perder nenhum dado.
                    </p>
                    <CodeBlock
                        title="Passo de Correção: Atualizar Tabela 'profiles'"
                        explanation="Execute este script no Editor SQL do Supabase para garantir que sua tabela 'profiles' tenha todas as colunas necessárias."
                        code={migrationScriptSQL}
                    />
                </div>
            </section>

            <section>
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Setup do Banco de Dados</h2>
                <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 mb-8">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Última Atualização: Perfis de Usuário</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Os scripts abaixo foram atualizados para serem seguros de executar novamente. Se um objeto (tabela, política, etc.) já existir, o comando será adaptado para evitar erros.
                    </p>
                    <CodeBlock
                        title="Passo 1: Criar Tabela 'profiles' e Trigger"
                        explanation="Este script agora usa 'CREATE TABLE IF NOT EXISTS' para evitar erros se a tabela já existir. O trigger também é recriado de forma segura."
                        code={createProfilesTableSQL}
                    />
                     <CodeBlock
                        title="Passo 2: Ativar Segurança (RLS) para Perfis"
                        explanation="Este script agora remove as políticas antigas (SELECT, UPDATE, INSERT) antes de criá-las, garantindo que a versão mais recente seja aplicada sem conflitos. A nova política de INSERT corrige o erro ao salvar dados."
                        code={profilesRlsSQL}
                    />
                </div>
                 <CodeBlock
                    title="Script Completo (Setup Inicial)"
                    explanation="Se você está configurando o projeto pela primeira vez, pode usar este script completo que inclui todas as tabelas e políticas de segurança necessárias ('invoices' e 'profiles'). Ele também foi atualizado para ser seguro de executar múltiplas vezes."
                    code={fullSetupSQL}
                />
            </section>
        </div>
    );
};

export default DeveloperTab;