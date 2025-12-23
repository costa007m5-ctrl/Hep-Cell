
import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [sqlQuery, setSqlQuery] = useState('');
    const { addToast } = useToast();
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const REPAIR_SQL = `-- ESTRUTURA DO BANCO DE DADOS RELP CELL
-- Tabela de Pedidos
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

-- Tabela de Configurações do Sistema (Juros, Cashback, Banners)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Banners
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    prompt TEXT,
    link TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Logs
CREATE TABLE IF NOT EXISTS public.action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT,
    status TEXT,
    description TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Permissões
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Políticas Permissivas (Admin/Dev)
CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update orders" ON public.orders FOR UPDATE USING (true);

CREATE POLICY "Public read settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Public update settings" ON public.system_settings FOR UPDATE USING (true);
CREATE POLICY "Public insert settings" ON public.system_settings FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read banners" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Public all banners" ON public.banners FOR ALL USING (true);
`;

    const handleAutoRepair = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/execute-sql', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: REPAIR_SQL })
            });
            
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: 'Banco de dados atualizado! Tabelas de Configuração e Financeiro criadas.', type: 'success' });
            } else {
                throw new Error("Erro ao rodar script automático. Tente copiar e rodar manualmente no Supabase.");
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
                setMessage({ text: `Sucesso! ${data.recovered} pedidos recuperados.`, type: 'success' });
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
                {/* REPARO AUTOMÁTICO */}
                <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900 shadow-xl flex flex-col">
                    <div className="mb-6">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">Atualizar Estrutura</h3>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            Cria as tabelas necessárias para o Financeiro (taxas, cashback) e Banners da loja. Execute isso se o painel financeiro não salvar.
                        </p>
                    </div>
                    <button 
                        onClick={handleAutoRepair} disabled={isLoading}
                        className="mt-auto w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <LoadingSpinner /> : 'EXECUTAR REPARO AGORA'}
                    </button>
                </section>

                {/* RECUPERAR PEDIDOS */}
                <section className="bg-indigo-50 dark:bg-indigo-900/20 p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900 shadow-xl flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-xl font-black text-indigo-900 dark:text-white uppercase">Recuperar Pedidos</h3>
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2 leading-relaxed">
                            Seus pedidos sumiram mas as faturas estão lá? Clique aqui para recriar os pedidos com base no histórico.
                        </p>
                    </div>
                    <button 
                        onClick={handleSyncOrders} disabled={isLoading}
                        className="mt-auto w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <LoadingSpinner /> : 'SINCRONIZAR PEDIDOS ANTIGOS'}
                    </button>
                </section>
            </div>

            {/* SQL MANUAL */}
            <section className="bg-slate-900 p-8 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                     <span className="text-[10px] font-mono text-emerald-500/50 uppercase ml-2">Terminal SQL</span>
                </div>
                <textarea 
                    value={sqlQuery} onChange={e => setSqlQuery(e.target.value)}
                    placeholder="Digite o comando SQL..."
                    className="flex-1 w-full min-h-[120px] bg-black/50 border border-white/5 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 focus:ring-1 focus:ring-emerald-500 outline-none mb-4"
                />
                <button 
                    onClick={handleRunManualSql} disabled={isLoading || !sqlQuery.trim()}
                    className="w-full py-3 bg-emerald-500 text-black rounded-xl font-black text-[10px] uppercase active:scale-95 disabled:opacity-30"
                >
                    EXECUTAR SQL MANUAL
                </button>
            </section>
        </div>
    );
};

export default DeveloperTab;
