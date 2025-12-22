
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface WebhookLog {
    id: string;
    created_at: string;
    action_type: string;
    status: 'SUCCESS' | 'FAILURE' | 'INFO';
    description: string;
    details: any;
}

const WebhookManagerTab: React.FC = () => {
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [debugId, setDebugId] = useState('');
    const [isDebugging, setIsDebugging] = useState(false);
    const [debugResult, setDebugResult] = useState<any>(null);
    const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin?action=webhook-logs');
            const data = await res.json();
            if (res.ok) {
                setLogs(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 10000); // Auto-refresh a cada 10s
        return () => clearInterval(interval);
    }, []);

    const handleDebug = async () => {
        if (!debugId) return;
        setIsDebugging(true);
        setDebugResult(null);
        try {
            const res = await fetch('/api/admin?action=debug-mp-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: debugId })
            });
            const data = await res.json();
            setDebugResult(data);
            fetchLogs(); // Atualiza logs
        } catch (e: any) {
            setDebugResult({ error: e.message });
        } finally {
            setIsDebugging(false);
        }
    };

    const webhookUrl = `${window.location.protocol}//${window.location.host}/api/mercadopago/webhook`;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Monitor de Webhooks</h2>
                    <p className="text-sm text-slate-500">Verifique a comunicação entre Mercado Pago e seu servidor.</p>
                </div>
                <button onClick={fetchLogs} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors">
                    Atualizar Lista
                </button>
            </div>

            {/* URL CONFIG */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex-1">
                    <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase mb-1">URL de Notificação (Configure no Mercado Pago)</p>
                    <code className="text-xs md:text-sm font-mono bg-white dark:bg-slate-900 px-3 py-1.5 rounded border border-indigo-200 dark:border-indigo-700 block break-all">
                        {webhookUrl}
                    </code>
                </div>
                <button 
                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow hover:bg-indigo-700 transition-colors shrink-0"
                >
                    Copiar URL
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LISTA DE LOGS */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col h-[500px]">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Últimos Eventos Recebidos</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                        {isLoading ? <div className="p-10 flex justify-center"><LoadingSpinner /></div> : (
                            logs.length === 0 ? <p className="p-10 text-center text-slate-400 text-sm">Nenhum webhook recebido recentemente.</p> : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-900/30 text-[10px] uppercase text-slate-500 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2">Data/Hora</th>
                                            <th className="px-4 py-2">Tipo</th>
                                            <th className="px-4 py-2">Status</th>
                                            <th className="px-4 py-2 text-right">Detalhes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer" onClick={() => setSelectedLog(log)}>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                                    {log.action_type.replace('WEBHOOK_', '')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        log.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 
                                                        log.status === 'FAILURE' ? 'bg-red-100 text-red-700' : 
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-indigo-500">
                                                    Ver JSON
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        )}
                    </div>
                </div>

                {/* DEBUGGER & DETAILS */}
                <div className="flex flex-col gap-6">
                    {/* DEBUG TOOL */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Forçar Atualização
                        </h3>
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase text-slate-400">ID do Pagamento (Mercado Pago)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={debugId} 
                                    onChange={e => setDebugId(e.target.value)} 
                                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Ex: 1234567890"
                                />
                                <button 
                                    onClick={handleDebug} 
                                    disabled={!debugId || isDebugging}
                                    className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                                >
                                    {isDebugging ? <LoadingSpinner /> : 'Buscar'}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight">
                                Use isto se o webhook falhou. O sistema irá consultar o status no Mercado Pago e atualizar a fatura se estiver aprovado.
                            </p>
                        </div>
                        {debugResult && (
                            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-mono break-all max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700">
                                <pre>{JSON.stringify(debugResult, null, 2)}</pre>
                            </div>
                        )}
                    </div>

                    {/* LOG DETAILS */}
                    <div className="flex-1 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3">Detalhes do Evento</h3>
                        {selectedLog ? (
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <p className="text-xs font-bold text-slate-500 mb-1">Descrição</p>
                                <p className="text-sm mb-4 text-slate-800 dark:text-slate-200">{selectedLog.description}</p>
                                <p className="text-xs font-bold text-slate-500 mb-1">Payload JSON</p>
                                <pre className="bg-slate-900 text-green-400 p-3 rounded-lg text-[10px] font-mono overflow-x-auto">
                                    {JSON.stringify(selectedLog.details, null, 2)}
                                </pre>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic">
                                Selecione um log na lista para ver os detalhes.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WebhookManagerTab;
