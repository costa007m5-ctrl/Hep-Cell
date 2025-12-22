
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

type StatusState = 'idle' | 'loading' | 'success' | 'error';

interface ApiStatus {
    id: string;
    name: string;
    endpoint: string;
    description: string;
    status: StatusState;
    message: string;
    details?: any;
}

const StatusTab: React.FC = () => {
    const [services, setServices] = useState<ApiStatus[]>([
        { id: 'sb', name: 'Supabase Database', endpoint: '/api/admin/test-supabase', description: 'Banco de dados e autenticação.', status: 'idle', message: '' },
        { id: 'ai', name: 'Gemini AI Hub', endpoint: '/api/admin/test-gemini', description: 'Cérebro do RelpBot e Autopreenchimento.', status: 'idle', message: '' },
        { id: 'mp', name: 'Mercado Pago', endpoint: '/api/admin/test-mercadopago', description: 'Processamento de Pix e Cartão.', status: 'idle', message: '' },
        { id: 'vc', name: 'ViaCEP Logística', endpoint: 'https://viacep.com.br/ws/68900000/json/', description: 'Cálculo de frete Amapá.', status: 'idle', message: '' }
    ]);

    const checkService = async (index: number) => {
        const updated = [...services];
        updated[index].status = 'loading';
        setServices([...updated]);

        try {
            const isExternal = services[index].id === 'vc';
            const res = await fetch(services[index].endpoint, { 
                method: isExternal ? 'GET' : 'POST' 
            });
            const data = await res.json();
            
            if (res.ok) {
                updated[index].status = 'success';
                updated[index].message = data.message || 'Serviço Operacional';
                updated[index].details = data.details;
            } else {
                updated[index].status = 'error';
                updated[index].message = data.error || 'Falha na resposta';
            }
        } catch (e) {
            updated[index].status = 'error';
            updated[index].message = 'Serviço Indisponível';
        }
        setServices([...updated]);
    };

    useEffect(() => {
        services.forEach((_, i) => checkService(i));
    }, []);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center px-1">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Saúde do Sistema</h2>
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Monitoramento de conectividade</p>
                </div>
                <button 
                    onClick={() => services.forEach((_, i) => checkService(i))} 
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                    REVALIDAR TUDO
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {services.map((s, i) => (
                    <div key={s.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-indigo-500/10 hover:border-indigo-500/30">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-3.5 h-3.5 rounded-full ${
                                    s.status === 'success' ? 'bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 
                                    s.status === 'error' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 
                                    'bg-amber-400 animate-bounce'
                                }`}></div>
                                <h3 className="font-black text-slate-800 dark:text-white uppercase text-sm tracking-tight">{s.name}</h3>
                            </div>
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full ${
                                s.status === 'success' ? 'bg-green-100 text-green-700' : 
                                s.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
                            }`}>
                                {s.status === 'success' ? 'ONLINE' : s.status === 'error' ? 'ERRO' : 'TESTANDO'}
                            </span>
                        </div>
                        
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">{s.description}</p>
                        
                        {/* Monitoramento Gemini Detalhado */}
                        {s.id === 'ai' && s.status === 'success' && s.details && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 mb-4 animate-fade-in">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Cota de Tokens / Min</span>
                                    <span className="text-[10px] font-bold text-slate-400">{s.details.remainingEstimate} Livre</span>
                                </div>
                                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: '100%' }}></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase">Capacidade</p>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">1M TPM</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase">Latência</p>
                                        <p className="text-xs font-bold text-emerald-500">{s.details.latency}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-50 dark:border-slate-700/50">
                             <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase">Resposta:</span>
                                <p className={`text-[10px] font-mono truncate ${s.status === 'error' ? 'text-red-500 font-bold' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                    {s.status === 'loading' ? 'Pingando servidor...' : s.message || 'Aguardando...'}
                                </p>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-5 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-3xl flex items-center gap-4">
                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm text-xl">🚀</div>
                <div className="flex-1">
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold leading-relaxed">
                        A API Gemini está configurada no modelo <span className="underline">Flash 2.5</span>. Este modelo oferece a maior cota de tokens (1 milhão por minuto), garantindo que o <span className="font-black">Auto-Cadastro IA</span> nunca pare.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StatusTab;
