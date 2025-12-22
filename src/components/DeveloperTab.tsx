
import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [sqlQuery, setSqlQuery] = useState('');
    const { addToast } = useToast();
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const SETUP_FUNCTION_SQL = `-- PASSO 1: COLE ISSO NO SQL EDITOR DO SUPABASE
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;`;

    // SQL ATUALIZADO COM A TABELA ORDERS COMPLETA
    const REPAIR_SQL = `-- PASSO 2: ATUALIZAÇÃO DA ESTRUTURA
-- Tabela de Produtos
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

-- Tabela de Pedidos (Orders) - CORREÇÃO DE RASTREIO
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'processing',
  total NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_snapshot JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_snapshot JSONB DEFAULT '{}'::jsonb;

-- Garante permissões (Policies simples para teste)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update orders" ON orders FOR UPDATE USING (true);
`;

    const handleAutoRepair = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/setup-database', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: 'Banco de dados sincronizado e tabela de Pedidos corrigida!', type: 'success' });
                addToast("Sucesso! Tabela Orders atualizada.", "success");
            } else {
                if (data.error?.includes('exec_sql')) {
                    throw new Error("Motor SQL não encontrado. Siga as instruções do 'Passo 1' abaixo.");
                }
                throw new Error(data.error || "Erro desconhecido.");
            }
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
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">Sincronizar Pedidos</h3>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            Clique aqui se estiver vendo erro ao salvar status ou se os pedidos sumiram. Isso cria as colunas faltantes.
                        </p>
                    </div>
                    <button 
                        onClick={handleAutoRepair} disabled={isLoading}
                        className="mt-auto w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <LoadingSpinner /> : 'EXECUTAR REPARO AGORA'}
                    </button>
                </section>

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

            {/* GUIA DE CONFIGURAÇÃO SUPABASE */}
            <section className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-[2.5rem] border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-amber-900 dark:text-amber-200 uppercase tracking-tighter">Instalação Inicial</h3>
                        <p className="text-xs text-amber-700 dark:text-amber-400">Necessário apenas na primeira vez.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200">
                        <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Passo 1: Habilitar Motor SQL</p>
                        <p className="text-xs text-slate-500 mb-4">Cole no SQL Editor do Supabase:</p>
                        <div className="relative group">
                            <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed border border-white/5">
                                {SETUP_FUNCTION_SQL}
                            </pre>
                            <button 
                                onClick={() => { navigator.clipboard.writeText(SETUP_FUNCTION_SQL); addToast("Copiado!", "success"); }}
                                className="absolute top-2 right-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[9px] font-black rounded uppercase transition-colors"
                            >
                                Copiar
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default DeveloperTab;
