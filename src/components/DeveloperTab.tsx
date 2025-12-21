
import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [sqlQuery, setSqlQuery] = useState('');
    const { addToast } = useToast();
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const CORRECTION_SQL = `ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;`;

    const handleAutoRepair = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/setup-database', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: 'Banco reparado automaticamente!', type: 'success' });
                addToast("Reparo concluído!", "success");
            } else throw new Error(data.error);
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally { setIsLoading(false); }
    };

    const handleRunManualSql = async () => {
        if (!sqlQuery.trim()) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/execute-sql', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: sqlQuery })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: 'Comando executado!', type: 'success' });
                setSqlQuery('');
            } else throw new Error(data.error);
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally { setIsLoading(false); }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <section>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Engenharia de Dados</h2>
                <p className="text-sm text-slate-500 mb-6">Três formas de corrigir o erro de colunas faltantes.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Opção 1: Automática */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">🚀</div>
                            <h3 className="font-bold">1. Reparo Automático</h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">O sistema detecta e cria as colunas allow_reviews, cost_price e estoque mínimo sozinho.</p>
                        <button 
                            onClick={handleAutoRepair} disabled={isLoading}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg active:scale-95 transition-all"
                        >
                            {isLoading ? <LoadingSpinner /> : 'Executar Reparo Agora'}
                        </button>
                    </div>

                    {/* Opção 2: Terminal Manual */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-slate-900 text-emerald-400 rounded-lg">💻</div>
                            <h3 className="font-bold">2. Terminal SQL</h3>
                        </div>
                        <textarea 
                            value={sqlQuery} onChange={e => setSqlQuery(e.target.value)}
                            placeholder="Cole seu código SQL aqui..."
                            className="w-full h-24 p-3 font-mono text-[10px] bg-slate-900 text-emerald-400 rounded-xl border-none mb-3"
                        />
                        <button 
                            onClick={handleRunManualSql} disabled={isLoading || !sqlQuery}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase active:scale-95 transition-all"
                        >
                            Executar Comando
                        </button>
                    </div>
                </div>

                {/* Opção 3: Cópia e Cola (Painel Supabase) */}
                <div className="mt-8 bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">📋</div>
                        <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm">3. Opção Cópia e Cola (Para o Painel do Supabase)</h3>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">Se preferir fazer manualmente no painel do Supabase, copie o código abaixo e cole no SQL Editor deles:</p>
                    <div className="relative group">
                        <pre className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800 text-[10px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                            {CORRECTION_SQL}
                        </pre>
                        <button 
                            onClick={() => { navigator.clipboard.writeText(CORRECTION_SQL); addToast("Copiado!", "success"); }}
                            className="absolute top-2 right-2 p-2 bg-amber-100 hover:bg-amber-200 rounded-lg text-[10px] font-bold uppercase text-amber-700"
                        >
                            Copiar Código
                        </button>
                    </div>
                </div>

                {message && <div className="mt-6"><Alert message={message.text} type={message.type} /></div>}
            </section>
        </div>
    );
};

export default DeveloperTab;
