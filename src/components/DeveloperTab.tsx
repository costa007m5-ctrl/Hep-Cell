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

    const fullSetupSQL = `
-- ====================================================================
-- Script Completo de Configuração do Banco de Dados para Relp Cell
-- Execute este bloco inteiro de uma vez no Editor SQL do Supabase.
-- ATENÇÃO: Substitua 'SEU_ADMIN_USER_ID' pelo ID do seu usuário Admin.
-- Você pode encontrar o ID na seção Authentication -> Users do Supabase.
-- ====================================================================

-- Parte 1: Tabela de Perfis de Usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver o próprio perfil." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins podem ver todos os perfis." ON public.profiles FOR SELECT USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062'); -- SUBSTITUA O ID AQUI


-- Parte 2: Trigger para Sincronizar Novos Usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Parte 3: Tabela de Faturas
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  payment_method VARCHAR(50),
  payment_date TIMESTAMPTZ,
  transaction_id VARCHAR(255),
  notes TEXT
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clientes podem gerenciar suas próprias faturas." ON public.invoices FOR ALL USING (auth.uid() = user_id);
`;
    const adminPolicySQL = `
-- Política de Acesso para Admin na Tabela 'invoices'
-- Permite que o admin (com o ID de usuário especificado) realize todas as operações.
-- ATENÇÃO: Substitua 'SEU_ADMIN_USER_ID' pelo ID do seu usuário Admin.
CREATE POLICY "Admins podem gerenciar todas as faturas." ON public.invoices FOR ALL USING (auth.uid() = '1da77e27-f1df-4e35-bcec-51dc2c5a9062'); -- SUBSTITUA O ID AQUI
`;
    
    return (
        <div className="p-4 space-y-8">
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração das Variáveis de Ambiente</h2>
                <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 mb-6">
                    <h3 className="font-bold text-indigo-800 dark:text-indigo-200">Como funciona:</h3>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-2">
                        Para a segurança da sua aplicação, as chaves de API não são salvas aqui. Em vez disso, você deve adicioná-las como <strong>Variáveis de Ambiente</strong> no painel do seu projeto na Vercel.
                    </p>
                     <ol className="list-decimal list-inside text-sm text-indigo-700 dark:text-indigo-300 mt-2 space-y-1">
                        <li>Cole uma chave no campo correspondente abaixo.</li>
                        <li>Clique em <strong>Testar</strong> para validar se a chave está funcionando.</li>
                        <li>Após o sucesso, vá até <strong>Vercel &gt; Seu Projeto &gt; Settings &gt; Environment Variables</strong>.</li>
                        <li>Adicione as chaves com os nomes exatos: <code>API_KEY</code> para o Gemini e <code>MERCADO_PAGO_ACCESS_TOKEN</code> para o Mercado Pago.</li>
                        <li>Faça um novo deploy do seu projeto para que as alterações tenham efeito.</li>
                    </ol>
                </div>

                <div className="max-w-xl space-y-6">
                    <div>
                        <label htmlFor="geminiApiKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                           1. Chave da API do Gemini (API_KEY)
                        </label>
                        <div className="mt-1 flex items-stretch space-x-2">
                             <input
                                id="geminiApiKey"
                                name="geminiApiKey"
                                type="password"
                                value={keys.geminiApiKey}
                                onChange={handleInputChange}
                                className="flex-grow block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-50 dark:bg-slate-700"
                                placeholder="Cole sua chave aqui"
                            />
                            <button onClick={() => handleTestKey('gemini')} disabled={testing.gemini || !keys.geminiApiKey} className="flex-shrink-0 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                                {testing.gemini ? <LoadingSpinner /> : 'Testar'}
                            </button>
                        </div>
                         {testResults.gemini && (
                            <div className="mt-2 animate-fade-in">
                                <Alert message={testResults.gemini.message} type={testResults.gemini.success ? 'success' : 'error'} />
                            </div>
                        )}
                    </div>
                    
                    <div>
                        <label htmlFor="mercadoPagoToken" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                           2. Access Token do Mercado Pago (MERCADO_PAGO_ACCESS_TOKEN)
                        </label>
                        <div className="mt-1 flex items-stretch space-x-2">
                            <input
                                id="mercadoPagoToken"
                                name="mercadoPagoToken"
                                type="password"
                                value={keys.mercadoPagoToken}
                                onChange={handleInputChange}
                                className="flex-grow block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-50 dark:bg-slate-700"
                                placeholder="Cole seu token aqui"
                            />
                            <button onClick={() => handleTestKey('mercadoPago')} disabled={testing.mercadoPago || !keys.mercadoPagoToken} className="flex-shrink-0 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                                {testing.mercadoPago ? <LoadingSpinner /> : 'Testar'}
                            </button>
                        </div>
                        {testResults.mercadoPago && (
                            <div className="mt-2 animate-fade-in">
                                <Alert message={testResults.mercadoPago.message} type={testResults.mercadoPago.success ? 'success' : 'error'} />
                            </div>
                        )}
                    </div>
                </div>
            </section>

             <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Verificar Status da API no Vercel</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Após configurar as variáveis de ambiente e fazer o deploy, use este botão para confirmar se o servidor Vercel está se comunicando com sucesso com a API do Mercado Pago usando a chave que você salvou.
                </p>
                <div>
                    <button onClick={handleCheckVercelStatus} disabled={isCheckingStatus} className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                        {isCheckingStatus ? <LoadingSpinner /> : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Verificar Conexão do Mercado Pago
                            </>
                        )}
                    </button>
                </div>
                {statusResult && (
                    <div className="mt-4 animate-fade-in">
                        <Alert message={statusResult.message} type={statusResult.success ? 'success' : 'error'} />
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Teste da API de Criação de Pagamento</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Este teste simula a primeira etapa do fluxo de pagamento, onde o aplicativo solicita ao Mercado Pago para preparar uma transação. Isso valida se o seu <strong>Access Token</strong> (configurado na Vercel) está correto e tem as permissões necessárias para criar pagamentos.
                </p>
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 max-w-xl space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Descrição do Item
                            </label>
                            <input
                                id="description"
                                name="description"
                                type="text"
                                value={testPreference.description}
                                onChange={handlePreferenceInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700"
                            />
                        </div>
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Valor (R$)
                            </label>
                            <input
                                id="amount"
                                name="amount"
                                type="number"
                                step="0.01"
                                value={testPreference.amount}
                                onChange={handlePreferenceInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700"
                            />
                        </div>
                    </div>
                    <div>
                        <button onClick={handleTestPreferenceCreation} disabled={isTestingPreference} className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                            {isTestingPreference ? <LoadingSpinner /> : 'Testar Criação de Preferência'}
                        </button>
                    </div>
                    {preferenceResult && (
                        <div className="mt-2 animate-fade-in">
                            <Alert message={preferenceResult.message} type={preferenceResult.success ? 'success' : 'error'} />
                        </div>
                    )}
                </div>
            </section>
            
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Setup do Banco de Dados</h2>
                 <CodeBlock
                    title="Script de Setup Inicial (Tabelas, Trigger e Políticas)"
                    explanation="Execute este script completo no Editor SQL do Supabase para criar as tabelas 'profiles' e 'invoices', configurar o trigger de novos usuários e aplicar as políticas de segurança de nível de linha (RLS) iniciais. Lembre-se de substituir o ID do usuário admin."
                    code={fullSetupSQL}
                />
                 <CodeBlock
                    title="Política de Acesso do Administrador"
                    explanation="Após executar o script inicial, execute esta política para conceder ao seu usuário administrador acesso total à tabela 'invoices'. Isto é crucial para que o Painel do Admin funcione."
                    code={adminPolicySQL}
                />
            </section>
        </div>
    );
};

export default DeveloperTab;