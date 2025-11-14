import React, { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface ActionLog {
    id: string;
    created_at: string;
    action_type: string;
    status: 'SUCCESS' | 'FAILURE';
    description: string;
    details?: { error?: string };
}

const SuccessIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);

const FailureIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
);

const RepairIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M17.293 2.293a1 1 0 011.414 0l.001.001a1 1 0 010 1.414l-11 11a1 1 0 01-1.414-1.414l11-11z" />
        <path fillRule="evenodd" d="M12.293 7.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L13 9.414l-1.707 1.707a1 1 0 11-1.414-1.414L12.293 7.293z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M2 13a1 1 0 011-1h3.293L13 5.293l1.293 1.293L7.586 13H10a1 1 0 110 2H3a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);


const ActionLogTab: React.FC = () => {
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRepairing, setIsRepairing] = useState(false);
    const [repairMessage, setRepairMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/get-logs');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao buscar os logs do servidor.');
            }
            const data: ActionLog[] = await response.json();
            setLogs(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleRepairError = async () => {
        setIsRepairing(true);
        setRepairMessage(null);
        try {
            const response = await fetch('/api/admin/setup-database', {
                method: 'POST',
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || data.error || 'Ocorreu um erro desconhecido.');
            }
            setRepairMessage({ text: data.message, type: 'success' });
            // Refresh logs after repair
            fetchLogs();
        } catch (error: any) {
            setRepairMessage({ text: error.message, type: 'error' });
        } finally {
            setIsRepairing(false);
            setTimeout(() => setRepairMessage(null), 5000);
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center space-y-4 p-8">
                    <LoadingSpinner />
                    <p className="text-slate-500 dark:text-slate-400">Carregando histórico...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="p-4">
                    <Alert message={error} type="error" />
                </div>
            );
        }

        if (logs.length === 0) {
            return (
                <div className="text-center p-8">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-white">Nenhum registro de ação</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Quando ações forem executadas, elas aparecerão aqui.</p>
                </div>
            );
        }
        
        return (
             <ul role="list" className="divide-y divide-slate-200 dark:divide-slate-700">
                {logs.map((log) => (
                    <li key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 pt-1">
                                {log.status === 'SUCCESS' ? <SuccessIcon /> : <FailureIcon />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm">
                                    <p className="font-medium text-slate-900 dark:text-white">{log.description}</p>
                                </div>
                                 <div className="mt-1 flex items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                                    <p>
                                        <time dateTime={log.created_at}>
                                            {new Date(log.created_at).toLocaleDateString('pt-BR')} às {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                                        </time>
                                    </p>
                                    <span>&middot;</span>
                                    <p className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{log.action_type}</p>
                                </div>
                                {log.status === 'FAILURE' && (
                                     <div className="mt-2 flex items-center gap-4">
                                        {log.details?.error && (
                                            <div className="flex-1 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-md">
                                                <p className="text-xs text-red-800 dark:text-red-300 font-mono">{log.details.error}</p>
                                            </div>
                                        )}
                                        <button 
                                            onClick={handleRepairError}
                                            disabled={isRepairing}
                                            className="flex-shrink-0 flex items-center gap-2 py-1 px-3 text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-md shadow-sm disabled:opacity-50"
                                            title="Tenta corrigir o problema executando o setup do banco de dados novamente."
                                        >
                                            {isRepairing ? <LoadingSpinner/> : (
                                                <>
                                                    <RepairIcon />
                                                    Reparar Erro
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        );
    };

    return (
         <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Histórico de Ações do Sistema</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Visualize as atualizações e configurações automáticas realizadas.
                    </p>
                </div>
                <button onClick={fetchLogs} disabled={isLoading} className="flex-shrink-0 flex justify-center items-center gap-2 py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.944 12.944A8.994 8.994 0 0012 3C6.477 3 2 7.477 2 13s4.477 10 10 10a9.96 9.96 0 005.657-1.843" />
                    </svg>
                    Atualizar
                </button>
            </div>
            {repairMessage && <div className="my-4"><Alert message={repairMessage.text} type={repairMessage.type} /></div>}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                 {renderContent()}
            </div>
        </div>
    );
};

export default ActionLogTab;
