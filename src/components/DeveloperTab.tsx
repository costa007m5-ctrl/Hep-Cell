
import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [sqlQuery, setSqlQuery] = useState('');
    const { addToast } = useToast();
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const REPAIR_SQL = `-- RODAR ESTE SQL PARA CORRIGIR TABELA ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    status TEXT DEFAULT 'processing',
    total NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items_snapshot JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address_snapshot JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT,
    status TEXT,
    description TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read orders" ON public.orders;
CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
CREATE POLICY "Public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update orders" ON public.orders;
CREATE POLICY "Public update orders" ON public.orders FOR UPDATE USING (true);
`;

    const handleAutoRepair = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            // Tenta criar via endpoint se RPC estiver ativo
            const res = await fetch('/api/admin/execute-sql', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: REPAIR_SQL })
            });
            
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: 'Tabelas corrigidas via comando remoto!', type: 'success' });
            } else {
                // Se falhar (sem RPC), instrui manual
                throw new Error("Não foi possível rodar automático. Copie o SQL abaixo e rode no Supabase.");
            }
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally { setIsLoading(false); }
    };

    const handleSyncOrders = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/sync-orders', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: `Sucesso! ${data.recovered} pedidos recuperados do histórico de faturas.`, type: 'success' });
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
            } else throw new Error(data.error);
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally { setIsLoading(false); }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <header>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic">Engenharia Relp Cell</h2>
                <p className="text-slate-500 text-sm">Reparo de banco de dados e sincronização de pedidos.</p>
            </header>

            {message && <div className="animate-pop-in"><Alert message={message.text} type={message.type} /></div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* SINCRONIZAÇÃO */}
                <section className="bg-indigo-50 dark:bg-indigo-900/20 p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900 shadow-xl flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-xl font-black text-indigo-900 dark:text-white uppercase">Recuperar Pedidos</h3>
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2 leading-relaxed">
                            Seus pedidos sumiram mas as faturas estão lá? Clique aqui para recriar os pedidos com base no histórico de faturas.
                        </p>
                    </div>
                    <button 
                        onClick={handleSyncOrders} disabled={isLoading}
                        className="mt-auto w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <LoadingSpinner /> : 'SINCRONIZAR PEDIDOS ANTIGOS'}
                    </button>
                </section>

                {/* SQL REPAIR */}
                <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-4">Reparo SQL</h3>
                    <p className="text-xs text-slate-500 mb-4">Copie e rode no SQL Editor do Supabase se o automático falhar.</p>
                    <div className="relative group flex-1">
                        <pre className="h-full p-4 bg-slate-900 text-emerald-400 rounded-xl text-[10px] font-mono overflow-auto whitespace-pre-wrap border border-slate-700">
                            {REPAIR_SQL}
                        </pre>
                        <button 
                            onClick={() => { navigator.clipboard.writeText(REPAIR_SQL); addToast("SQL Copiado!", "success"); }}
                            className="absolute top-2 right-2 px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-[9px] font-black rounded uppercase transition-colors"
                        >
                            Copiar
                        </button>
                    </div>
                    <button 
                        onClick={handleAutoRepair} disabled={isLoading}
                        className="mt-4 w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        TENTAR REPARO AUTOMÁTICO
                    </button>
                </section>
            </div>

            {/* TERMINAL MANUAL */}
            <section className="bg-slate-900 p-8 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-[10px] font-mono text-emerald-500/50 uppercase ml-2">Terminal SQL</span>
                </div>
                <textarea 
                    value={sqlQuery} onChange={e => setSqlQuery(e.target.value)}
                    placeholder="Digite comando SQL manual..."
                    className="flex-1 w-full min-h-[120px] bg-black/50 border border-white/5 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 focus:ring-1 focus:ring-emerald-500 outline-none mb-4"
                />
                <button 
                    onClick={handleRunManualSql} disabled={isLoading || !sqlQuery.trim()}
                    className="w-full py-3 bg-emerald-500 text-black rounded-xl font-black text-[10px] uppercase active:scale-95 disabled:opacity-30"
                >
                    EXECUTAR
                </button>
            </section>
        </div>
    );
};

export default DeveloperTab;
