import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';

const WebhookManagerTab: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        fetchLogs();
        const sub = supabase.channel('webhook_logs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_logs' }, () => fetchLogs()).subscribe();
        return () => { supabase.removeChannel(sub); };
    }, []);

    const fetchLogs = async () => {
        const { data } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(20);
        setLogs(data || []);
        setIsLoading(false);
    };

    const handleTestWebhook = async (provider: string) => {
        setIsTesting(true);
        try {
            await fetch(`/api/webhooks/${provider}/test`, { method: 'POST' });
            // O log aparecerá via realtime
        } catch (e) {
            console.error(e);
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl">
                <h2 className="text-2xl font-black mb-2">Integrações & Webhooks</h2>
                <p className="text-slate-400 text-sm">Monitore em tempo real as comunicações entre a Relp Cell e serviços externos.</p>
                
                <div className="flex gap-3 mt-6">
                    <button 
                        onClick={() => handleTestWebhook('mercadopago')}
                        disabled={isTesting}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                    >
                        {isTesting ? <LoadingSpinner /> : 'Testar Mercado Pago'}
                    </button>
                    <button 
                        onClick={() => handleTestWebhook('scraper')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold transition-colors"
                    >
                        Testar Scraper
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white">Logs de Atividade Recente</h3>
                    <span className="flex items-center gap-2 text-[10px] font-bold text-green-500 animate-pulse">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span> LIVE
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[10px] uppercase font-black text-slate-400 bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="px-6 py-3">Data/Hora</th>
                                <th className="px-6 py-3">Provedor</th>
                                <th className="px-6 py-3">Evento</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Payload</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                            {isLoading ? (
                                <tr><td colSpan={5} className="p-10 text-center"><LoadingSpinner /></td></tr>
                            ) : logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-4 text-slate-500 font-mono">
                                        {new Date(log.created_at).toLocaleTimeString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">{log.provider}</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                        {log.event_type}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded font-bold ${log.status >= 400 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => alert(JSON.stringify(log.payload, null, 2))}
                                            className="text-indigo-600 hover:underline font-bold"
                                        >
                                            Ver JSON
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WebhookManagerTab;