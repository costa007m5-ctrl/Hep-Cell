
import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [sqlQuery, setSqlQuery] = useState('');
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const runManualSql = async () => {
        if (!sqlQuery.trim()) return;
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/execute-sql', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: sqlQuery })
            });
            const data = await res.json();
            
            if (res.ok) {
                setMessage({ text: 'Comando executado com sucesso no banco de dados!', type: 'success' });
                setSqlQuery('');
            } else {
                throw new Error(data.error || 'Erro ao executar SQL.');
            }
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <section>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Engenharia de Dados</h2>
                <p className="text-sm text-slate-500 mb-6">Controle total sobre a infraestrutura do banco de dados.</p>

                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Terminal SQL Manual</h3>
                            <p className="text-xs text-slate-500">Use para criar colunas faltantes (ex: allow_reviews) ou ajustar tabelas. <strong>Atenção:</strong> Comandos diretos podem ser irreversíveis.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <textarea 
                            value={sqlQuery}
                            onChange={e => setSqlQuery(e.target.value)}
                            placeholder="ALTER TABLE products ADD COLUMN allow_reviews BOOLEAN DEFAULT TRUE;"
                            className="w-full h-48 p-4 font-mono text-xs bg-slate-900 text-emerald-400 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                        ></textarea>

                        <button 
                            onClick={runManualSql} 
                            disabled={isLoading || !sqlQuery.trim()}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? <LoadingSpinner /> : 'EXECUTAR COMANDO SQL'}
                        </button>
                    </div>

                    {message && <Alert message={message.text} type={message.type} />}
                </div>
            </section>

            <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-800">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-200 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Comandos de Correção Comuns:
                </h4>
                <div className="space-y-3">
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center group">
                        <code className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 truncate pr-4">ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;</code>
                        <button onClick={() => setSqlQuery("ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;")} className="text-[10px] font-black text-indigo-500 uppercase hover:underline shrink-0">Usar</button>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center group">
                        <code className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 truncate pr-4">ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;</code>
                        <button onClick={() => setSqlQuery("ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;")} className="text-[10px] font-black text-indigo-500 uppercase hover:underline shrink-0">Usar</button>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center group">
                        <code className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 truncate pr-4">ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;</code>
                        <button onClick={() => setSqlQuery("ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;")} className="text-[10px] font-black text-indigo-500 uppercase hover:underline shrink-0">Usar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeveloperTab;
