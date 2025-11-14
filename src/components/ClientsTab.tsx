import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Profile } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface ClientsTabProps {
    allInvoices: Invoice[];
    isLoading: boolean;
    errorInfo: { message: string } | null;
}

const ClientsTab: React.FC<ClientsTabProps> = ({ allInvoices, isLoading, errorInfo }) => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isProfilesLoading, setIsProfilesLoading] = useState(true);
    const [expandedClient, setExpandedClient] = useState<string | null>(null);
    const [analysisStatus, setAnalysisStatus] = useState<{ [key: string]: 'loading' | 'success' | 'error' }>({});
    const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

    const fetchProfiles = useCallback(async () => {
        setIsProfilesLoading(true);
        try {
            const { data, error } = await supabase.from('profiles').select('*');
            if (error) throw error;
            setProfiles(data || []);
        } catch (e: any) {
            console.error("Failed to load profiles", e);
        } finally {
            setIsProfilesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const handleAnalyzeCredit = async (userId: string) => {
        setAnalysisStatus(prev => ({ ...prev, [userId]: 'loading' }));
        setAnalysisMessage(null);
        try {
            const response = await fetch('/api/admin/analyze-credit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            setAnalysisStatus(prev => ({ ...prev, [userId]: 'success' }));
            setAnalysisMessage(result.message);
            // Atualiza o perfil na lista local
            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, ...result.profile } : p));
        } catch (err: any) {
            setAnalysisStatus(prev => ({ ...prev, [userId]: 'error' }));
            setAnalysisMessage(err.message);
        } finally {
            setTimeout(() => setAnalysisMessage(null), 4000);
        }
    };

    const groupedByClient = useMemo(() => {
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        const invoiceMap = new Map<string, Invoice[]>();

        allInvoices.forEach(invoice => {
            if (!invoiceMap.has(invoice.user_id)) {
                invoiceMap.set(invoice.user_id, []);
            }
            invoiceMap.get(invoice.user_id)!.push(invoice);
        });

        // Garante que todos os perfis apareçam, mesmo sem faturas
        profiles.forEach(profile => {
            if (!invoiceMap.has(profile.id)) {
                invoiceMap.set(profile.id, []);
            }
        });
        
        return Array.from(invoiceMap.entries()).map(([userId, invoices]) => ({
            profile: profileMap.get(userId)!,
            invoices: invoices,
        })).filter(item => item.profile); // Filtra caso algum perfil não seja encontrado

    }, [allInvoices, profiles]);

    const getStatusColor = (status: string | null | undefined) => {
        switch (status) {
            case 'Excelente': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
            case 'Bom': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
            case 'Regular': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400';
            case 'Negativado': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400';
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
        }
    };

    if (isLoading || isProfilesLoading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;
    if (errorInfo) return <div className="p-4"><Alert message={errorInfo.message} type="error" /></div>;

    return (
        <div className="p-4 space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gerenciamento de Clientes</h2>
            {analysisMessage && <Alert message={analysisMessage} type={analysisMessage.includes('sucesso') ? 'success' : 'error'} />}
            <div className="space-y-3">
                {groupedByClient.map(({ profile, invoices }) => {
                    const isExpanded = expandedClient === profile.id;
                    const isAnalyzing = analysisStatus[profile.id] === 'loading';
                    return (
                        <div key={profile.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <button onClick={() => setExpandedClient(isExpanded ? null : profile.id)} className="flex-grow flex items-center space-x-3 text-left">
                                     <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-indigo-500 font-bold text-sm">
                                        {profile.first_name?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800 dark:text-slate-100">{profile.first_name} {profile.last_name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{profile.email}</p>
                                    </div>
                                </button>
                                <div className="flex-shrink-0 grid grid-cols-2 md:flex md:items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(profile.credit_status)}`}>
                                            {profile.credit_status || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Limite</p>
                                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                                            {(profile.credit_limit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleAnalyzeCredit(profile.id)}
                                        disabled={isAnalyzing}
                                        className="col-span-2 md:col-auto py-2 px-3 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/50 rounded-md hover:bg-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isAnalyzing ? <LoadingSpinner /> : 'Analisar Crédito'}
                                    </button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                                    {invoices.length > 0 ? (
                                         <table className="min-w-full text-sm">
                                            <tbody>
                                                {invoices.map(invoice => (
                                                    <tr key={invoice.id}>
                                                        <td className="py-1 pr-4">{invoice.month}</td>
                                                        <td className="py-1 px-4"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ invoice.status === 'Paga' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800' }`}>{invoice.status}</span></td>
                                                        <td className="py-1 px-4 text-right">{invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                        <td className="py-1 pl-4 text-right text-slate-500">Vence: {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : <p className="text-center text-sm text-slate-500">Nenhuma fatura encontrada para este cliente.</p>}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default ClientsTab;
