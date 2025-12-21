
import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [sqlQuery, setSqlQuery] = useState('');
    const { addToast } = useToast();
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const REPAIR_SQL = `-- REPARO DE COLUNAS FALTANTES
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;`;

    const handleAutoRepair = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/setup-database', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: 'Banco reparado e APIs ativadas!', type: 'success' });
                addToast("Reparo automático concluído!", "success");
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
                setMessage({ text: 'Comando executado com sucesso!', type: 'success' });
                setSqlQuery('');
                addToast("SQL Manual executado.", "success");
            } else throw new Error(data.error);
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally { setIsLoading(false); }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <header>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Engenharia de Dados</h2>
                <p className="text-slate-500 text-sm">Resolução de problemas de infraestrutura e banco de dados.</p>
            </header>

            {message && <Alert message={message.text} type={message.type} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. OPÇÃO AUTOMÁTICA */}
                <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900 shadow-xl shadow-indigo-500/5 flex flex-col">
                    <div className="mb-6">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic">1. Reparo Automático</h3>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            O sistema tentará detectar colunas faltantes e criar as tabelas necessárias sozinho. <strong>Recomendado para corrigir as APIs vermelhas.</strong>
                        </p>
                    </div>
                    <div className="mt-auto">
                        <button 
                            onClick={handleAutoRepair} disabled={isLoading}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/30 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isLoading ? <LoadingSpinner /> : 'EXECUTAR REPARO COMPLETO'}
                        </button>
                    </div>
                </section>

                {/* 2. OPÇÃO VIA CÓDIGO (TERMINAL) */}
                <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full bg-red-500"></div>
                             <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                             <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-500/50 uppercase">Relp Terminal v1.0</span>
                    </div>
                    <h3 className="text-lg font-black text-white uppercase italic mb-4">2. Terminal SQL Manual</h3>
                    <textarea 
                        value={sqlQuery} onChange={e => setSqlQuery(e.target.value)}
                        placeholder="Digite o comando SQL aqui..."
                        className="flex-1 w-full min-h-[120px] bg-black/50 border border-white/5 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 placeholder-emerald-900 focus:ring-1 focus:ring-emerald-500 outline-none mb-4 custom-scrollbar"
                    />
                    <button 
                        onClick={handleRunManualSql} disabled={isLoading || !sqlQuery.trim()}
                        className="w-full py-3 bg-emerald-500 text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-30"
                    >
                        {isLoading ? <LoadingSpinner /> : 'EXECUTAR SQL'}
                    </button>
                </section>
            </div>

            {/* 3. OPÇÃO CÓPIA E COLA (SUPABASE DASHBOARD) */}
            <section className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-[2.5rem] border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 002 2v8a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-amber-900 dark:text-amber-200 uppercase italic">3. Opção Cópia e Cola</h3>
                        <p className="text-sm text-amber-700 dark:text-amber-400">Se as opções acima falharem, use o editor oficial do Supabase.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 p-4 rounded-xl leading-relaxed">
                        Acesse seu <strong>Supabase Dashboard</strong>, vá em <strong>SQL Editor</strong>, cole o código abaixo e clique em <strong>Run</strong>. Isso corrigirá o erro da coluna <code>allow_reviews</code>.
                    </p>
                    
                    <div className="relative group">
                        <pre className="p-6 bg-slate-900 text-slate-300 rounded-2xl border border-amber-500/20 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                            {REPAIR_SQL}
                        </pre>
                        <button 
                            onClick={() => { navigator.clipboard.writeText(REPAIR_SQL); addToast("Código copiado!", "success"); }}
                            className="absolute top-4 right-4 px-4 py-2 bg-amber-500 text-black rounded-lg font-black text-[10px] uppercase shadow-lg hover:bg-amber-400 active:scale-95 transition-all"
                        >
                            COPIAR CÓDIGO
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default DeveloperTab;
