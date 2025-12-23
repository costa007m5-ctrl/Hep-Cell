
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
-- 1. Tabela de Pedidos
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

-- 2. Configurações do Sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Banners
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    prompt TEXT,
    link TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Atualizações da tabela de Banners (Colunas Novas)
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS position TEXT DEFAULT 'hero';
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS subtitle TEXT;

-- 4. Tabela de Logs
CREATE TABLE IF NOT EXISTS public.action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT,
    status TEXT,
    description TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Permissões (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Políticas Permissivas (Admin/Dev) - Ajuste conforme necessidade de produção
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Public read orders') THEN
        CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Public insert orders') THEN
        CREATE POLICY "Public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Public update orders') THEN
        CREATE POLICY "Public update orders" ON public.orders FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'banners' AND policyname = 'Public all banners') THEN
        CREATE POLICY "Public all banners" ON public.banners FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'Public all settings') THEN
        CREATE POLICY "Public all settings" ON public.system_settings FOR ALL USING (true);
    END IF;
END
$$;
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
                setMessage({ text: 'Banco de dados atualizado com sucesso!', type: 'success' });
            } else {
                throw new Error("A automação falhou. Copie o script abaixo e rode no Supabase.");
            }
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally { setIsLoading(false); }
    };

    const handleCopySql = () => {
        navigator.clipboard.writeText(REPAIR_SQL);
        addToast("SQL copiado! Cole no Editor SQL do Supabase.", "success");
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
                <p className="text-slate-500 text-sm">Ferramentas de manutenção e reparo do banco de dados.</p>
            </header>

            {message && <div className="animate-pop-in"><Alert message={message.text} type={message.type} /></div>}

            <div className="grid grid-cols-1 gap-8">
                {/* REPARO AUTOMÁTICO & MANUAL */}
                <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900 shadow-xl">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">Estrutura do Banco</h3>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Use o botão "Automático" primeiro. Se falhar, copie o código SQL abaixo e execute manualmente no painel do Supabase (SQL Editor).
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 mb-6">
                        <button 
                            onClick={handleAutoRepair} disabled={isLoading}
                            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                        >
                            {isLoading ? <LoadingSpinner /> : 'REPARO AUTOMÁTICO'}
                        </button>
                        <button 
                            onClick={handleCopySql}
                            className="px-6 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                            COPIAR SQL
                        </button>
                    </div>

                    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-700 relative group">
                        <textarea 
                            readOnly
                            value={REPAIR_SQL}
                            className="w-full h-48 bg-transparent text-emerald-400 font-mono text-[10px] outline-none resize-none custom-scrollbar"
                        />
                        <div className="absolute top-2 right-2 bg-slate-800 text-xs text-slate-400 px-2 py-1 rounded opacity-50">Read-only</div>
                    </div>
                </section>

                {/* RECUPERAR PEDIDOS */}
                <section className="bg-indigo-50 dark:bg-indigo-900/20 p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900 shadow-xl flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1">
                        <h3 className="text-xl font-black text-indigo-900 dark:text-white uppercase">Sincronizar Pedidos</h3>
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2 leading-relaxed">
                            Seus pedidos sumiram mas as faturas estão lá? Clique aqui para recriar os pedidos com base no histórico de faturas.
                        </p>
                    </div>
                    <button 
                        onClick={handleSyncOrders} disabled={isLoading}
                        className="w-full md:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                    >
                        {isLoading ? <LoadingSpinner /> : 'EXECUTAR SYNC'}
                    </button>
                </section>
            </div>

            {/* SQL MANUAL LIVRE */}
            <section className="bg-slate-900 p-8 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col mt-8">
                <div className="flex items-center gap-2 mb-4">
                     <span className="text-[10px] font-mono text-emerald-500/50 uppercase ml-2">Terminal SQL Livre (Avançado)</span>
                </div>
                <textarea 
                    value={sqlQuery} onChange={e => setSqlQuery(e.target.value)}
                    placeholder="Digite seu comando SQL personalizado aqui..."
                    className="flex-1 w-full min-h-[120px] bg-black/50 border border-white/5 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 focus:ring-1 focus:ring-emerald-500 outline-none mb-4"
                />
                <button 
                    onClick={handleRunManualSql} disabled={isLoading || !sqlQuery.trim()}
                    className="w-full py-3 bg-emerald-500 text-black rounded-xl font-black text-[10px] uppercase active:scale-95 disabled:opacity-30 hover:bg-emerald-400 transition-colors"
                >
                    EXECUTAR COMANDO
                </button>
            </section>
        </div>
    );
};

export default DeveloperTab;
