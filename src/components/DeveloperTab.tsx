
import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [sqlQuery, setSqlQuery] = useState('');
    const { addToast } = useToast();
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const SETUP_FUNCTION_SQL = `-- PASSO 1: COLE ISSO NO SQL EDITOR DO SUPABASE PARA ATIVAR O REPARO
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;`;

    const REPAIR_SQL = `-- PASSO 2: CÓDIGO COMPLETO PARA CRIAR AS COLUNAS
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_short TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS highlights TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS secondary_images TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS processor TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ram TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS storage TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS display TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS camera TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS battery TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS connectivity TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ports TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS voltage TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promotional_price NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_installments INTEGER DEFAULT 12;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pix_discount_percent NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;
ALTER TABLE products ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'pronta_entrega';
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_class TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_lead_time INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_manufacturer INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_store INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS package_content TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS legal_info TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS exchange_policy TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_highlight BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;`;

    const handleAutoRepair = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/setup-database', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: 'Banco sincronizado e colunas criadas!', type: 'success' });
                addToast("Sucesso no reparo!", "success");
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
                <p className="text-slate-500 text-sm">Configuração de infraestrutura e reparo de banco de dados.</p>
            </header>

            {message && <div className="animate-pop-in"><Alert message={message.text} type={message.type} /></div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* REPARO AUTOMÁTICO */}
                <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900 shadow-xl flex flex-col">
                    <div className="mb-6">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">Reparo Automático</h3>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            Cria as colunas <b>model, brand, processor</b> e todas as outras necessárias para o novo formulário.
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
                         <span className="text-[10px] font-mono text-emerald-500/50 uppercase ml-2">Terminal v2.0</span>
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
                        <h3 className="text-xl font-black text-amber-900 dark:text-amber-200 uppercase tracking-tighter">Ativação do Motor SQL</h3>
                        <p className="text-xs text-amber-700 dark:text-amber-400">Obrigatório para o Reparo Automático funcionar.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200">
                        <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Passo 1: Instalar Motor (Dashboard Supabase)</p>
                        <p className="text-xs text-slate-500 mb-4">Copie o código abaixo e cole no <b>SQL Editor</b> do seu Supabase para autorizar o app.</p>
                        <div className="relative group">
                            <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed border border-white/5">
                                {SETUP_FUNCTION_SQL}
                            </pre>
                            <button 
                                onClick={() => { navigator.clipboard.writeText(SETUP_FUNCTION_SQL); addToast("Passo 1 copiado!", "success"); }}
                                className="absolute top-2 right-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[9px] font-black rounded uppercase transition-colors"
                            >
                                Copiar
                            </button>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200">
                        <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Passo 2: Criar Colunas (Cópia e Cola)</p>
                        <p className="text-xs text-slate-500 mb-4">Caso prefira fazer tudo manual, use este código abaixo:</p>
                        <div className="relative group">
                            <pre className="p-4 bg-slate-900 text-slate-300 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed border border-white/5">
                                {REPAIR_SQL}
                            </pre>
                            <button 
                                onClick={() => { navigator.clipboard.writeText(REPAIR_SQL); addToast("Passo 2 copiado!", "success"); }}
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
