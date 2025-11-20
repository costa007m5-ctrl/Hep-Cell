import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Profile } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Modal from './Modal';
import InputField from './InputField';

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

    // Notification Modal State
    const [notifModalOpen, setNotifModalOpen] = useState(false);
    const [selectedProfileForNotif, setSelectedProfileForNotif] = useState<Profile | null>(null);
    const [notifForm, setNotifForm] = useState({ title: '', message: '', type: 'info' });
    const [isSendingNotif, setIsSendingNotif] = useState(false);

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
    
    const handleOpenNotifModal = (profile: Profile) => {
        setSelectedProfileForNotif(profile);
        setNotifForm({ title: '', message: '', type: 'info' });
        setNotifModalOpen(true);
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProfileForNotif) return;
        setIsSendingNotif(true);

        try {
            const response = await fetch('/api/admin/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedProfileForNotif.id,
                    ...notifForm
                })
            });
            
            if (!response.ok) throw new Error('Falha ao enviar notificação');
            
            setNotifModalOpen(false);
            setAnalysisMessage(`Notificação enviada para ${selectedProfileForNotif.first_name}!`);
        } catch (err: any) {
            console.error(err);
            alert('Erro ao enviar notificação.');
        } finally {
            setIsSendingNotif(false);
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
            {analysisMessage && <Alert message={analysisMessage} type={analysisMessage.includes('sucesso') || analysisMessage.includes('Notificação') ? 'success' : 'error'} />}
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
                                <div className="flex-shrink-0 grid grid-cols-2 md:flex md:items-center gap-2">
                                    <div className="text-center md:mr-4">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(profile.credit_status)}`}>
                                            {profile.credit_status || 'N/A'}
                                        </span>
                                    </div>
                                    
                                    <button
                                        onClick={() => handleOpenNotifModal(profile)}
                                        className="py-2 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 flex items-center justify-center gap-1"
                                        title="Enviar Notificação"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                        Avisar
                                    </button>

                                    <button
                                        onClick={() => handleAnalyzeCredit(profile.id)}
                                        disabled={isAnalyzing}
                                        className="py-2 px-3 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/50 rounded-md hover:bg-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
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

            <Modal isOpen={notifModalOpen} onClose={() => setNotifModalOpen(false)}>
                <form onSubmit={handleSendNotification} className="space-y-4">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Enviar Notificação para {selectedProfileForNotif?.first_name}</h3>
                    <InputField 
                        label="Título" 
                        name="title" 
                        value={notifForm.title} 
                        onChange={e => setNotifForm({...notifForm, title: e.target.value})}
                        placeholder="Ex: Aviso de Vencimento"
                        required
                    />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mensagem</label>
                        <textarea 
                            className="w-full px-3 py-2 border rounded-md bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            rows={4}
                            value={notifForm.message}
                            onChange={e => setNotifForm({...notifForm, message: e.target.value})}
                            placeholder="Digite a mensagem aqui..."
                            required
                        ></textarea>
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                         <select 
                            value={notifForm.type} 
                            onChange={e => setNotifForm({...notifForm, type: e.target.value})}
                            className="w-full px-3 py-2 border rounded-md bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 dark:text-white outline-none"
                         >
                             <option value="info">Informação</option>
                             <option value="warning">Aviso</option>
                             <option value="success">Sucesso</option>
                             <option value="alert">Alerta Urgente</option>
                         </select>
                    </div>
                    <button 
                        type="submit" 
                        disabled={isSendingNotif}
                        className="w-full py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isSendingNotif ? <LoadingSpinner /> : 'Enviar Notificação'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default ClientsTab;