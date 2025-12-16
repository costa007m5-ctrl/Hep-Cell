
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Modal from './Modal';

interface ClientsTabProps {
    isLoading?: boolean;
    errorInfo?: { message: string } | null;
    allInvoices: Invoice[];
}

interface EnhancedProfile extends Profile {
    ltv: number;
    totalDebt: number;
    lastPurchaseDate: string | null;
    invoiceCount: number;
    averageTicket: number; 
    riskLevel: 'Baixo' | 'Médio' | 'Alto';
    utilizationRate: number;
    isBlocked?: boolean; 
    internal_notes?: string;
    salary?: number;
}

const RiskBadge: React.FC<{ level: 'Baixo' | 'Médio' | 'Alto' }> = ({ level }) => {
    const colors = {
        'Baixo': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Médio': 'bg-amber-100 text-amber-700 border-amber-200',
        'Alto': 'bg-red-100 text-red-700 border-red-200'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${colors[level]}`}>
            Risco {level}
        </span>
    );
};

const ClientsTab: React.FC<ClientsTabProps> = () => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]); 
    const [limitRequests, setLimitRequests] = useState<any[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'inadimplentes' | 'vip' | 'solicitacoes'>('todos');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null); 
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeDrawerTab, setActiveDrawerTab] = useState<'geral' | 'faturas'>('geral');
    
    // Super Manager States
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [showNegotiationModal, setShowNegotiationModal] = useState(false);
    
    // Negotiation
    const [negotiationData, setNegotiationData] = useState({
        installments: 1,
        firstDueDate: new Date().toISOString().split('T')[0],
        notes: ''
    });
    const [negotiationInterest, setNegotiationInterest] = useState(0);
    const [isNegotiating, setIsNegotiating] = useState(false);

    // Internal Notes
    const [internalNotes, setInternalNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    // Fetch Data
    const fetchData = useCallback(async () => {
        setIsDataLoading(true);
        setErrorMsg(null);
        try {
            const [profilesRes, invoicesRes, requestsRes, settingsRes] = await Promise.all([
                fetch('/api/admin/profiles'),
                fetch('/api/admin/invoices'),
                fetch('/api/admin/limit-requests'),
                fetch('/api/admin/settings')
            ]);

            if (settingsRes.ok) {
                const settings = await settingsRes.json();
                setNegotiationInterest(parseFloat(String(settings.negotiation_interest)) || 0);
            }

            setProfiles(await profilesRes.json());
            setInvoices(await invoicesRes.json());
            if(requestsRes.ok) setLimitRequests(await requestsRes.json());

        } catch (e: unknown) {
            console.error("Failed to load CRM data", e);
            const message = e instanceof Error ? e.message : String(e);
            setErrorMsg(message);
        } finally {
            setIsDataLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

     const enhancedProfiles: EnhancedProfile[] = useMemo(() => {
        return profiles.map(profile => {
            const userInvoices = invoices.filter(inv => inv.user_id === profile.id);
            const totalPaid = userInvoices.filter(inv => inv.status === 'Paga').reduce((sum, inv) => sum + inv.amount, 0);
            const paidCount = userInvoices.filter(inv => inv.status === 'Paga').length;
            const averageTicket = paidCount > 0 ? totalPaid / paidCount : 0;
            const totalDebt = userInvoices.filter(inv => inv.status === 'Em aberto' || inv.status === 'Boleto Gerado').reduce((sum, inv) => sum + inv.amount, 0);
            const lastPurchase = userInvoices.length > 0 ? userInvoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at : null;
            const limit = profile.credit_limit || 1; 
            const utilizationRate = Math.min(100, (totalDebt / limit) * 100);
            let riskLevel: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
            const hasLateInvoices = userInvoices.some(inv => (inv.status === 'Em aberto' || inv.status === 'Boleto Gerado') && new Date(inv.due_date) < new Date());

            if (hasLateInvoices || utilizationRate > 90 || profile.credit_status === 'Bloqueado') riskLevel = 'Alto';
            else if (utilizationRate > 70 || (profile.credit_score || 0) < 500) riskLevel = 'Médio';

            return {
                ...profile, ltv: totalPaid, totalDebt, lastPurchaseDate: lastPurchase, invoiceCount: userInvoices.length, averageTicket, riskLevel, utilizationRate, isBlocked: profile.credit_status === 'Bloqueado'
            };
        });
    }, [profiles, invoices]);

    const filteredProfiles = useMemo(() => {
        return enhancedProfiles.filter(p => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = p.first_name?.toLowerCase().includes(searchLower) || p.last_name?.toLowerCase().includes(searchLower) || p.email?.toLowerCase().includes(searchLower) || p.identification_number?.includes(searchLower);
            if (!matchesSearch) return false;
            if (filterStatus === 'inadimplentes') return p.riskLevel === 'Alto';
            if (filterStatus === 'vip') return (p.credit_score || 0) > 800;
            if (filterStatus === 'solicitacoes') return limitRequests.some(r => r.user_id === p.id && r.status === 'pending');
            return true;
        });
    }, [enhancedProfiles, searchTerm, filterStatus, limitRequests]);

    const handleOpenDrawer = (client: EnhancedProfile) => {
        setSelectedClientId(client.id);
        setInternalNotes(client.internal_notes || '');
        setIsDrawerOpen(true);
        setSelectedInvoiceIds(new Set());
        setActiveDrawerTab('geral');
    };

    const handleManageInvoice = async (invoiceId: string, action: 'pay' | 'cancel' | 'delete') => {
        try {
             const res = await fetch('/api/admin/manage-invoice', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ invoiceId, action })
            });
             
             const data = await res.json();

             if (res.ok) {
                setSuccessMessage('Operação realizada com sucesso!');
                setTimeout(() => setSuccessMessage(null), 3000);
                fetchData(); 
            } else {
                 const error = data && typeof data === 'object' && 'error' in data ? String((data as any).error) : 'Falha na operação.';
                 alert(`Erro: ${error}`);
            }
        } catch (e: any) { 
            console.error(e); 
            const errorMsg = e.message || 'Erro de conexão.';
            alert(errorMsg); 
        }
    };

    const handleBulkAction = async (action: 'pay' | 'cancel' | 'delete') => {
        if (selectedInvoiceIds.size === 0) return;
        if (!confirm(`Tem certeza que deseja aplicar '${action}' em ${selectedInvoiceIds.size} faturas?`)) return;

        const ids = Array.from(selectedInvoiceIds);
        // Processa um por um para simplificar (idealmente seria batch no backend)
        for (const id of ids) {
            await handleManageInvoice(id, action);
        }
        setSelectedInvoiceIds(new Set());
    };

    const handleNegotiateSubmit = async () => {
        if (!selectedClientId || selectedInvoiceIds.size === 0) return;
        setIsNegotiating(true);
        try {
            const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.has(inv.id));
            const totalAmount = selectedInvoices.reduce((acc, inv) => acc + inv.amount, 0);

            const res = await fetch('/api/admin/negotiate-debt', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    userId: selectedClientId,
                    invoiceIds: Array.from(selectedInvoiceIds),
                    totalAmount,
                    installments: negotiationData.installments,
                    firstDueDate: negotiationData.firstDueDate,
                    notes: negotiationData.notes
                })
            });

            if (res.ok) {
                setSuccessMessage('Negociação criada! Contrato disponível no app do cliente.');
                setTimeout(() => setSuccessMessage(null), 3000);
                setShowNegotiationModal(false);
                setSelectedInvoiceIds(new Set());
                fetchData();
            } else {
                throw new Error('Erro ao negociar');
            }
        } catch (e: unknown) {
            alert('Falha ao criar negociação.');
        } finally {
            setIsNegotiating(false);
        }
    };

    const handleSaveNotes = async () => {
        if(!selectedClientId) return;
        setIsSavingNotes(true);
        try {
             // Simulação de salvamento (falta rota de update profile admin completa)
             alert("Nota salva localmente.");
        } finally {
            setIsSavingNotes(false);
        }
    };

    const toggleInvoiceSelection = (id: string) => {
        const newSet = new Set(selectedInvoiceIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedInvoiceIds(newSet);
    };

    const selectedClient = enhancedProfiles.find(p => p.id === selectedClientId);
    const selectedClientInvoices = invoices.filter(inv => inv.user_id === selectedClientId);

    // Negotiation Calculations
    const selectedTotal = invoices.filter(i => selectedInvoiceIds.has(i.id)).reduce((a,b)=>a+b.amount,0);
    const totalWithInterest = selectedTotal * (1 + (negotiationInterest / 100));
    const negotiationInstallmentValue = totalWithInterest / (negotiationData.installments || 1);

    if (isDataLoading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;
    if (errorMsg) return <div className="p-8"><Alert message={errorMsg} type="error" /></div>;

    return (
        <div className="p-4 space-y-6 bg-slate-50 dark:bg-slate-900/50 min-h-screen">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Risco</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Médio</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredProfiles.map((client) => {
                                const hasRequest = limitRequests.some(r => r.user_id === client.id && r.status === 'pending');
                                return (
                                    <tr key={client.id} onClick={() => handleOpenDrawer(client)} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer ${hasRequest ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{client.first_name} {client.last_name}</div>
                                            <div className="text-xs text-slate-500">{client.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1">
                                                {hasRequest && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold animate-pulse">PEDIDO</span>}
                                                {client.riskLevel === 'Alto' && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">RISCO</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap"><RiskBadge level={client.riskLevel} /></td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">R$ {client.averageTicket.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-indigo-600 font-bold">Gerenciar</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drawer Detalhes */}
            {isDrawerOpen && selectedClient && (
                <div className="fixed inset-0 z-50 flex justify-end">
                     <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsDrawerOpen(false)}></div>
                     <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right overflow-hidden">
                        {/* Header Drawer */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedClient.first_name} {selectedClient.last_name}</h2>
                                <p className="text-sm text-slate-500">{selectedClient.email} • CPF: {selectedClient.identification_number}</p>
                            </div>
                            <button onClick={() => setIsDrawerOpen(false)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full">✕</button>
                        </div>
                        
                        <div className="px-6 pt-4 border-b border-slate-100 dark:border-slate-700 flex gap-4">
                            <button onClick={() => setActiveDrawerTab('geral')} className={`pb-2 text-sm font-bold border-b-2 ${activeDrawerTab==='geral' ? 'border-indigo-600 text-indigo-600':'border-transparent text-slate-500'}`}>Geral</button>
                            <button onClick={() => setActiveDrawerTab('faturas')} className={`pb-2 text-sm font-bold border-b-2 ${activeDrawerTab==='faturas' ? 'border-indigo-600 text-indigo-600':'border-transparent text-slate-500'}`}>Faturas</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900/30">
                             {/* Conteúdo Geral */}
                             {activeDrawerTab === 'geral' && (
                                 <div className="space-y-6">
                                     <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-400 uppercase font-bold">Limite Atual</p>
                                            <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {selectedClient.credit_limit?.toFixed(2)}</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-400 uppercase font-bold">Dívida Total</p>
                                            <p className="text-xl font-bold text-red-600">R$ {selectedClient.totalDebt.toFixed(2)}</p>
                                        </div>
                                     </div>

                                     <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-200 dark:border-yellow-700">
                                        <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-200 mb-2">Notas Internas (Privado)</h4>
                                        <textarea 
                                            value={internalNotes} 
                                            onChange={e => setInternalNotes(e.target.value)} 
                                            className="w-full p-3 text-sm rounded-lg border border-yellow-300 dark:border-yellow-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                                            rows={3}
                                            placeholder="Escreva observações sobre o cliente..."
                                        ></textarea>
                                        <button onClick={handleSaveNotes} disabled={isSavingNotes} className="mt-2 text-xs font-bold text-white bg-yellow-600 px-3 py-1.5 rounded hover:bg-yellow-700">Salvar Nota</button>
                                    </div>
                                 </div>
                             )}

                             {/* TAB FATURAS */}
                             {activeDrawerTab === 'faturas' && (
                                <div className="space-y-4">
                                    {selectedInvoiceIds.size > 0 && (
                                        <div className="sticky top-0 z-10 bg-slate-800 text-white p-3 rounded-lg shadow-lg flex flex-col sm:flex-row justify-between items-center animate-fade-in-up gap-2">
                                            <span className="text-xs font-bold">{selectedInvoiceIds.size} Selecionadas</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleBulkAction('pay')} className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded font-bold transition-colors">Baixar</button>
                                                <button onClick={() => handleBulkAction('cancel')} className="text-xs bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded font-bold transition-colors">Cancelar</button>
                                                <button onClick={() => handleBulkAction('delete')} className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded font-bold transition-colors">Excluir</button>
                                                <button onClick={() => setShowNegotiationModal(true)} className="text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded font-bold transition-colors">Negociar</button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {selectedClientInvoices.length === 0 ? (
                                        <p className="text-center text-slate-400 py-10">Nenhuma fatura encontrada.</p>
                                    ) : (
                                        selectedClientInvoices.map(inv => (
                                            <div key={inv.id} className={`p-4 border rounded-xl flex items-center justify-between transition-all ${selectedInvoiceIds.has(inv.id) ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md'}`}>
                                                <div className="flex items-center gap-4">
                                                    {inv.status !== 'Paga' && inv.status !== 'Cancelado' && (
                                                        <input type="checkbox" checked={selectedInvoiceIds.has(inv.id)} onChange={() => toggleInvoiceSelection(inv.id)} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-900 dark:text-white">{inv.month}</p>
                                                        <p className="text-xs text-slate-500">Vence: {new Date(inv.due_date).toLocaleDateString()}</p>
                                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mt-1 inline-block ${
                                                            inv.status === 'Paga' ? 'bg-green-100 text-green-700' : 
                                                            inv.status === 'Cancelado' ? 'bg-slate-100 text-slate-500' : 
                                                            'bg-red-100 text-red-700'
                                                        }`}>{inv.status}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="text-right flex flex-col items-end gap-2">
                                                    <p className="font-black text-slate-900 dark:text-white">R$ {inv.amount.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                             )}
                        </div>
                     </div>
                </div>
            )}

            {/* Modal de Negociação */}
            <Modal isOpen={showNegotiationModal} onClose={() => setShowNegotiationModal(false)}>
                <div className="space-y-4 text-slate-900 dark:text-white">
                    <h3 className="text-xl font-bold">Renegociar Dívida</h3>
                    
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600 dark:text-slate-300">Dívida Original:</span>
                            <strong>R$ {selectedTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                        </div>
                        <div className="flex justify-between text-sm mb-1 text-red-600">
                            <span>Juros de Negociação ({negotiationInterest}%):</span>
                            <strong>+ R$ {(selectedTotal * (negotiationInterest / 100)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                        </div>
                        <div className="flex justify-between text-lg font-black border-t border-slate-300 dark:border-slate-600 pt-2 mt-2">
                            <span>Novo Total:</span>
                            <span className="text-indigo-600 dark:text-indigo-400">R$ {totalWithInterest.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Número de Parcelas</label>
                        <input 
                            type="number" 
                            value={negotiationData.installments} 
                            onChange={e => setNegotiationData({...negotiationData, installments: Math.max(1, parseInt(e.target.value))})} 
                            className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                            min="1" 
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Valor da Nova Parcela</label>
                        <div className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white">
                            R$ {negotiationInstallmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Vencimento da 1ª Parcela</label>
                        <input 
                            type="date" 
                            value={negotiationData.firstDueDate} 
                            onChange={e => setNegotiationData({...negotiationData, firstDueDate: e.target.value})} 
                            className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Observações do Acordo</label>
                        <textarea 
                            value={negotiationData.notes} 
                            onChange={e => setNegotiationData({...negotiationData, notes: e.target.value})} 
                            className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                            rows={3}
                        ></textarea>
                    </div>

                    <button onClick={handleNegotiateSubmit} disabled={isNegotiating} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex justify-center shadow-lg">
                        {isNegotiating ? <LoadingSpinner /> : 'Enviar Proposta e Gerar Contrato'}
                    </button>
                </div>
            </Modal>
            
            {successMessage && (
                <div className="fixed bottom-4 right-4 z-[100]">
                    <Alert message={successMessage} type="success" />
                </div>
            )}
        </div>
    );
};

export default ClientsTab;
