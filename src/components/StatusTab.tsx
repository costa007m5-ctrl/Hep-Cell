
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
        { id: 'ai', name: 'Gemini 3.0 AI', endpoint: '/api/admin/test-gemini', description: 'Inteligência artificial para suporte.', status: 'idle', message: '' },
        { id: 'mp', name: 'Mercado Pago', endpoint: '/api/admin/test-mercadopago', description: 'Processamento de Pix e Cartão.', status: 'idle', message: '' },
        { id: 'vc', name: 'ViaCEP Logística', endpoint: 'https://viacep.com.br/ws/68900000/json/', description: 'Cálculo de frete Amapá.', status: 'idle', message: '' }
    ]);

    const checkService = async (index: number) => {
        const updated = [...services];
        updated[index].status = 'loading';
        setServices(updated);

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
            updated[index].message = 'Indisponível';
        }
        setServices([...updated]);
    };

    useEffect(() => {
        services.forEach((_, i) => checkService(i));
    }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Status das Integrações</h2>
                <button onClick={() => services.forEach((_, i) => checkService(i))} className="text-xs font-bold text-indigo-600 hover:underline">Revalidar Tudo</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((s, i) => (
                    <div key={s.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-slate-800 dark:text-white">{s.name}</h3>
                            <div className={`w-4 h-4 rounded-full border-2 border-white dark:border-slate-700 ${
                                s.status === 'success' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 
                                s.status === 'error' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                                s.status === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'
                            }`}></div>
                        </div>
                        <p className="text-xs text-slate-500 mb-6">{s.description}</p>
                        <div className="pt-4 border-t border-slate-50 dark:border-slate-700">
                             <p className={`text-[10px] font-black uppercase tracking-tighter truncate ${s.status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                                {s.status === 'loading' ? 'Verificando...' : s.message || 'Aguardando diagnóstico'}
                             </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StatusTab;
