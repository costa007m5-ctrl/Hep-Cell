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
    // ... (estados existentes permanecem os mesmos) ...
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

    // ... (handlers existentes permanecem os mesmos) ...
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


    const fullSetupSQL = `... (SQL existente) ...`;
    const adminPolicySQL = `... (SQL existente) ...`;
    
    // URL do Webhook baseada na URL atual da janela
    const webhookUrl = `${window.location.origin}/api/mercadopago/webhook`;

    return (
        <div className="p-4 space-y-8">
            {/* Seção 1: Variáveis de Ambiente (existente) */}
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
                {/* ... (formulários de teste existentes) ... */}
            </section>
            
            {/* NOVA Seção: Webhooks */}
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

            {/* Seções de Teste (existentes) */}
            <section>
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Ferramentas de Teste da API</h2>
                {/* ... (testes existentes) ... */}
            </section>

            {/* Seção de Setup do Banco (existente) */}
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Setup do Banco de Dados</h2>
                {/* ... (CodeBlocks existentes) ... */}
            </section>
        </div>
    );
};

export default DeveloperTab;