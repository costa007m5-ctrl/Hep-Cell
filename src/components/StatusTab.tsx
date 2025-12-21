
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
            const isExternal = services[index].endpoint.startsWith('http');
            const res = await fetch(services[index].endpoint, { 
                method: isExternal ? 'GET' : 'POST' 
            });
            const data = await res.json();
            
            if (res.ok) {
                updated[index].status = 'success';
                updated[index].message = data.message || 'Ativo';
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
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Status do Ecossistema</h2>
                    <p className="text-sm text-slate-500">Monitoramento em tempo real das conexões externas.</p>
                </div>
                <button 
                    onClick={() => services.forEach((_, i) => checkService(i))} 
                    className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-xs hover:bg-indigo-600 hover:text-white transition-all"
                >
                    ATUALIZAR TUDO
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((s, i) => (
                    <div key={s.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${
                                    s.status === 'success' ? 'bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.6)]' : 
                                    s.status === 'error' ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]' : 
                                    'bg-amber-400 animate-bounce'
                                }`}></div>
                                <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tighter">{s.name}</h3>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                s.status === 'success' ? 'bg-green-100 text-green-700' : 
                                s.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
                            }`}>
                                {s.status === 'success' ? 'ONLINE' : s.status === 'error' ? 'OFFLINE' : 'CHECKING'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">{s.description}</p>
                        <div className="pt-4 border-t border-slate-50 dark:border-slate-700">
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400">LOG:</span>
                                <p className={`text-[10px] font-mono truncate ${s.status === 'error' ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                    {s.status === 'loading' ? 'Verificando latência...' : s.message || 'Sem dados'}
                                </p>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-2xl flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-xl">💡</div>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                    Se algum indicador estiver <span className="text-red-500 font-black">vermelho</span>, verifique suas Variáveis de Ambiente no Vercel (API_KEY, MERCADO_PAGO_ACCESS_TOKEN) e se o Supabase está com a RPC 'exec_sql' ativa.
                </p>
            </div>
        </div>
    );
};

export default StatusTab;
