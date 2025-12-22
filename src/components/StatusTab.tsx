
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
        { id: 'sb', name: 'Supabase Database', endpoint: '/api/admin/test-supabase', description: 'Banco de dados central.', status: 'idle', message: '' },
        { id: 'ai', name: 'Gemini AI Hub', endpoint: '/api/admin/test-gemini', description: 'Cérebro do RelpBot.', status: 'idle', message: '' },
        { id: 'mp', name: 'Mercado Pago', endpoint: '/api/admin/test-mercadopago', description: 'Processamento de pagamentos.', status: 'idle', message: '' }
    ]);

    const checkService = async (index: number) => {
        const updated = [...services];
        updated[index].status = 'loading';
        setServices([...updated]);

        try {
            const res = await fetch(services[index].endpoint, { method: 'POST' });
            const data = await res.json();
            
            if (res.ok) {
                updated[index].status = 'success';
                updated[index].message = data.message || 'OK';
                updated[index].details = data.details;
            } else {
                updated[index].status = 'error';
                updated[index].message = data.error || 'Falha na resposta';
            }
        } catch (e) {
            updated[index].status = 'error';
            updated[index].message = 'Indisponível';
        }
        setServices([...updated]);
    };

    useEffect(() => {
        services.forEach((_, i) => checkService(i));
    }, []);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black uppercase italic text-slate-900 dark:text-white">Saúde do Sistema</h2>
                <button onClick={() => services.forEach((_, i) => checkService(i))} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-all">Revalidar APIs</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((s, i) => (
                    <div key={s.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${s.status === 'success' ? 'bg-emerald-500 animate-pulse' : s.status === 'error' ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-amber-400 animate-bounce'}`}></div>
                                <h3 className="font-bold text-slate-800 dark:text-white uppercase text-sm">{s.name}</h3>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">{s.description}</p>
                        <div className={`p-3 rounded-xl text-xs font-mono break-all ${s.status === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-indigo-600 border border-slate-100 dark:bg-slate-900 dark:text-indigo-400 dark:border-slate-700'}`}>
                            {s.status === 'loading' ? 'Iniciando teste...' : s.message}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3">
                <span className="text-xl">💡</span>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-tight uppercase">
                    Se uma API estiver <span className="text-red-600">VERMELHA</span>, verifique as chaves configuradas no ambiente Vercel (API_KEY e MERCADO_PAGO_ACCESS_TOKEN).
                </p>
            </div>
        </div>
    );
};

export default StatusTab;
