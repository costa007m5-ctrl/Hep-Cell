
import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

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
        { id: 'sb', name: 'Supabase Database', endpoint: '/api/admin/test-supabase', description: 'Verifica conexão e acesso às tabelas.', status: 'idle', message: '' },
        { id: 'ai', name: 'Gemini AI', endpoint: '/api/admin/test-gemini', description: 'Verifica se a chave de IA está gerando conteúdo.', status: 'idle', message: '' },
        { id: 'vc', name: 'ViaCEP Logística', endpoint: 'https://viacep.com.br/ws/68900000/json/', description: 'Automação de endereços no Amapá.', status: 'idle', message: '' }
    ]);

    const checkService = async (index: number) => {
        const updated = [...services];
        updated[index].status = 'loading';
        setServices(updated);

        try {
            const res = await fetch(services[index].endpoint, { 
                method: services[index].endpoint.includes('viacep') ? 'GET' : 'POST' 
            });
            const data = await res.json();
            
            if (res.ok) {
                updated[index].status = 'success';
                updated[index].message = data.message || 'Operacional';
            } else {
                updated[index].status = 'error';
                updated[index].message = data.error || 'Erro na resposta';
            }
        } catch (e) {
            updated[index].status = 'error';
            updated[index].message = 'Servidor indisponível';
        }
        setServices([...updated]);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Diagnóstico de Sistema</h2>
                <button onClick={() => services.forEach((_, i) => checkService(i))} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg active:scale-95 transition-all">Testar Todas as APIs</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((s, i) => (
                    <div key={s.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-slate-800 dark:text-white">{s.name}</h3>
                            <div className={`w-3 h-3 rounded-full ${
                                s.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 
                                s.status === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                                s.status === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'
                            }`}></div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{s.description}</p>
                        
                        <div className="mt-auto flex justify-between items-center pt-4 border-t border-slate-50 dark:border-slate-700/50">
                            <span className={`text-[10px] font-black uppercase truncate max-w-[200px] ${s.status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                                {s.status === 'idle' ? 'Aguardando Teste' : s.message}
                            </span>
                            <button onClick={() => checkService(i)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${s.status === 'loading' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-800 flex gap-4">
                <span className="text-2xl">🚨</span>
                <div>
                    <p className="text-xs font-bold text-blue-800 dark:text-blue-200 uppercase">Atenção Administrador</p>
                    <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed mt-1">Se o Supabase der erro, você deve rodar o SQL manualmente no dashboard do Supabase para criar a função 'execute_admin_sql'. Sem ela, a auto-sincronização não funciona.</p>
                </div>
            </div>
        </div>
    );
};

export default StatusTab;
