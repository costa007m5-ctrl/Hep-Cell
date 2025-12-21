
import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const runSetup = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/setup-database', { method: 'POST' });
            const data = await res.json();
            
            if (res.ok) {
                setMessage({ text: 'Sincronização concluída! Colunas de endereço e tabelas de notificações atualizadas.', type: 'success' });
            } else {
                throw new Error(data.error || 'Erro ao sincronizar banco.');
            }
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <section>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Engenharia de Dados</h2>
                <p className="text-sm text-slate-500 mb-6">Ferramentas críticas para manutenção da estrutura do banco de dados Relp.</p>

                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Auto-Sincronização Supabase</h3>
                            <p className="text-xs text-slate-500">Este comando irá detectar colunas faltantes (CEP, Endereço, Complemento) e criar as políticas de segurança necessárias automaticamente.</p>
                        </div>
                    </div>

                    <button 
                        onClick={runSetup} 
                        disabled={isLoading}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? <LoadingSpinner /> : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                SINCRONIZAR BANCO AGORA
                            </>
                        )}
                    </button>

                    {message && <Alert message={message.text} type={message.type} />}
                </div>
            </section>

            <section className="bg-slate-900 text-white p-6 rounded-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
                <h4 className="text-xs font-black uppercase text-slate-500 mb-3 tracking-widest">Logs de Sincronização</h4>
                <div className="font-mono text-[10px] text-emerald-400 space-y-1">
                    <p>[SYSTEM] Verificando conexão Supabase...</p>
                    <p>[SYSTEM] Rota /api/admin/setup-database ativa.</p>
                    <p>[SYSTEM] Aguardando comando do administrador.</p>
                </div>
            </section>
        </div>
    );
};

export default DeveloperTab;
