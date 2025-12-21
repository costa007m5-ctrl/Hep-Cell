
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

type StatusState = 'idle' | 'loading' | 'success' | 'error';

interface ApiStatus {
    name: string;
    endpoint: string;
    description: string;
    status: StatusState;
    message: string;
}

const StatusTab: React.FC = () => {
    const [services, setServices] = useState<ApiStatus[]>([
        { name: 'Supabase Database', endpoint: '/api/admin/test-supabase', description: 'Conexão com banco de dados e políticas RLS.', status: 'idle', message: '' },
        { name: 'Gemini AI', endpoint: '/api/admin/test-gemini', description: 'Geração de mensagens e diagnósticos de erros.', status: 'idle', message: '' },
        { name: 'Mercado Pago', endpoint: '/api/admin/test-mercadopago', description: 'Processamento de Pix, Boletos e Cartão.', status: 'idle', message: '' },
        { name: 'ViaCEP Logística', endpoint: 'https://viacep.com.br/ws/68900000/json/', description: 'Automação de endereços para o Amapá.', status: 'idle', message: '' }
    ]);

    const checkService = async (index: number) => {
        const updated = [...services];
        updated[index].status = 'loading';
        setServices(updated);

        try {
            const res = await fetch(services[index].endpoint, { method: services[index].endpoint.includes('viacep') ? 'GET' : 'POST' });
            const data = await res.json();
            
            updated[index].status = res.ok ? 'success' : 'error';
            updated[index].message = res.ok ? 'Serviço Operacional' : (data.error || 'Erro na resposta');
        } catch (e) {
            updated[index].status = 'error';
            updated[index].message = 'Sem resposta do servidor';
        }
        setServices([...updated]);
    };

    const checkAll = () => {
        services.forEach((_, i) => checkService(i));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Status das Integrações</h2>
                <button onClick={checkAll} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg">Testar Tudo</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((s, i) => (
                    <div key={s.name} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-800 dark:text-white">{s.name}</h3>
                                <div className={`w-3 h-3 rounded-full ${
                                    s.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 
                                    s.status === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                                    s.status === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'
                                }`}></div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{s.description}</p>
                        </div>
                        
                        <div className="flex justify-between items-center mt-auto">
                            <span className={`text-[10px] font-black uppercase ${s.status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                                {s.status === 'idle' ? 'Aguardando' : s.message}
                            </span>
                            <button onClick={() => checkService(i)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${s.status === 'loading' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800 flex gap-4">
                <span className="text-2xl">💡</span>
                <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-200">Dica Pro</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">Se o Supabase falhar, certifique-se de que a tabela `system_settings` existe. Se o Gemini falhar, verifique a `API_KEY` na Vercel.</p>
                </div>
            </div>
        </div>
    );
};

export default StatusTab;
