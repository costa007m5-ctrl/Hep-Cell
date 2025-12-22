
import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const handleAutoRepair = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/setup-database', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: 'Tabelas e colunas sincronizadas!', type: 'success' });
                addToast("Reparo Concluído!", "success");
            } else throw new Error(data.error);
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally { setIsLoading(false); }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <header>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Engenharia de Dados</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Reparos Críticos do Sistema</p>
            </header>

            {message && <Alert message={message.text} type={message.type} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-indigo-100 dark:border-slate-700 shadow-xl flex flex-col">
                    <div className="mb-6">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg mb-4 text-xl">⚡</div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">Sincronizar Banco</h3>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            Use este botão se as abas de <b>Clientes</b> ou <b>Vendas</b> estiverem vazias ou dando erro. Ele forçará a criação de todas as colunas necessárias para o CRM e o Financeiro.
                        </p>
                    </div>
                    <button 
                        onClick={handleAutoRepair} disabled={isLoading}
                        className="mt-auto w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/30 active:scale-95 transition-all"
                    >
                        {isLoading ? <LoadingSpinner /> : 'EXECUTAR REPARO AGORA'}
                    </button>
                </section>

                <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                         <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                         <span className="text-[10px] font-mono text-emerald-500/50 uppercase ml-1">Terminal de Log v5.0</span>
                    </div>
                    <div className="flex-1 min-h-[100px] bg-black/40 rounded-2xl p-4 font-mono text-[10px] text-emerald-400 overflow-y-auto mb-4 border border-white/5">
                        {'> System initialized...\n> Ready for manual repair operations...\n> All APIs checked...\n> Waiting for user action...'}
                    </div>
                    <p className="text-[9px] text-slate-500 uppercase font-bold text-center">Somente para uso de engenharia Relp Cell</p>
                </section>
            </div>
        </div>
    );
};

export default DeveloperTab;
