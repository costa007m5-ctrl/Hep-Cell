
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Modal from './Modal';
import InputField from './InputField';

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
    riskLevel: 'Baixo' | 'Médio' | 'Alto';
    utilizationRate: number;
    isBlocked?: boolean; 
    internalNotes?: string; 
}

// --- Componentes Visuais ---

const StatCard: React.FC<{ title: string; value: string | number; icon: any; color: string; trend?: string }> = ({ title, value, icon, color, trend }) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-start justify-between transition-transform hover:scale-[1.02]">
        <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{value}</h3>
            {trend && <p className="text-[10px] text-slate-400 mt-1">{trend}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} text-white shadow-lg shadow-black/10`}>
            {icon}
        </div>
    </div>
);

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

// --- Modals ---

const InvoiceDetailModal: React.FC<{ invoice: Invoice; onClose: () => void }> = ({ invoice, onClose }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Detalhes da Fatura</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    invoice.status === 'Paga' ? 'bg-green-100 text-green-700' : 
                    invoice.status === 'Cancelado' ? 'bg-slate-100 text-slate-500' :
                    invoice.status === 'Aguardando Assinatura' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                }`}>
                    {invoice.status}
                </span>
            </div>

            {/* INFO PRINCIPAL: O QUE COMPROU */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <p className="text-xs text-indigo-500 dark:text-indigo-300 uppercase font-bold mb-1">Descrição / Produto</p>
                <p className="text-sm text-slate-800 dark:text-white font-medium leading-relaxed">
                    {invoice.notes || invoice.month}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border border-slate-100 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-bold">Valor</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                        {invoice.amount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                    </p>
                </div>
                <div className="p-3 border border-slate-100 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-bold">Vencimento</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                        {new Date(invoice.due_date).toLocaleDateString('pt-BR')}
                    </p>
                </div>
            </div>

            <div className="space-y-2 text-xs text-slate-500 pt-2">
                <p><strong>ID da Fatura:</strong> <span className="font-mono">{invoice.id}</span></p>
                <p><strong>Criada em:</strong> {new Date(invoice.created_at).toLocaleString('pt-BR')}</p>
                {invoice.payment_date && <p><strong>Pago em:</strong> {new Date(invoice.payment_date).toLocaleString('pt-BR')}</p>}
                {invoice.payment_method && <p><strong>Método:</strong> {invoice.payment_method}</p>}
            </div>

            <div className="flex justify-end pt-4">
                <button onClick={onClose} className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg text-sm font-bold hover:bg-slate-300 transition-colors">
                    Fechar
                </button>
            </div>
        </div>
    );
};

const NegotiationModal: React.FC<{ 
    selectedInvoices: Invoice[]; 
    onClose: () => void; 
    onConfirm: (data: any) => Promise<void>;
}> = ({ selectedInvoices, onClose, onConfirm }) => {
    const totalOriginal = selectedInvoices.reduce((acc, i) => acc + i.amount, 0);
    
    const [installments, setInstallments] = useState(1);
    const [interestType, setInterestType] = useState<'none' | 'fixed' | 'percent'>('percent');
    const [interestValue, setInterestValue] = useState(0);
    const [newTotal, setNewTotal] = useState(totalOriginal);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [firstDueDate, setFirstDueDate] = useState(new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]); // Default 5 days from now

    useEffect(() => {
        let calculated = totalOriginal;
        if (interestType === 'percent') {
            calculated = totalOriginal * (1 + (interestValue / 100));
        } else if (interestType === 'fixed') {
            calculated = totalOriginal + interestValue;
        }
        // Se for desconto (valor negativo), pode reduzir. Mas garantimos min 0.
        setNewTotal(Math.max(0, calculated));
    }, [totalOriginal, interestType, interestValue]);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm({
                invoiceIds: selectedInvoices.map(i => i.id),
                totalAmount: newTotal,
                installments,
                firstDueDate,
                notes: `Renegociação de ${selectedInvoices.length} faturas (Original: R$ ${totalOriginal.toFixed(2)}).`
            });
            onClose();
        } catch (e) {
            console.error(e);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="text-center border-b border-slate-100 dark:border-slate-700 pb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Negociar Dívida</h3>
                <p className="text-sm text-slate-500">Você selecionou <strong>{selectedInvoices.length}</strong> faturas.</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Original</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">R$ {totalOriginal.toFixed(2)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Ajuste</label>
                        <select 
                            value={interestType} 
                            onChange={(e) => setInterestType(e.target.value as any)}
                            className="w-full text-sm p-2 rounded border dark:bg-slate-700 dark:border-slate-600"
                        >
                            <option value="none">Sem Ajuste</option>
                            <option value="percent">Juros/Desconto (%)</option>
                            <option value="fixed">Valor Fixo (R$)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Valor Ajuste</label>
                        <input 
                            type="number" 
                            value={interestValue} 
                            onChange={e => setInterestValue(parseFloat(e.target.value))}
                            disabled={interestType === 'none'}
                            className="w-full text-sm p-2 rounded border dark:bg-slate-700 dark:border-slate-600"
                            placeholder="0"
                        />
                    </div>
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-600">
                    <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">Novo Total</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">R$ {newTotal.toFixed(2)}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <InputField 
                    label="Parcelas" 
                    name="installments" 
                    type="number" 
                    value={installments} 
                    onChange={(e) => setInstallments(parseInt(e.target.value))} 
                    min={1} 
                    max={24}
                />
                <InputField 
                    label="1ª Vencimento" 
                    name="dueDate" 
                    type="date" 
                    value={firstDueDate} 
                    onChange={(e) => setFirstDueDate(e.target.value)} 
                />
            </div>

            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <span className="text-sm text-blue-800 dark:text-blue-200">Valor da Parcela:</span>
                <span className="text-lg font-bold text-blue-800 dark:text-blue-200">
                    {installments}x de R$ {(newTotal / installments).toFixed(2)}
                </span>
            </div>

            <button 
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg transition-all flex justify-center items-center gap-2"
            >
                {isSubmitting ? <LoadingSpinner /> : 'Confirmar Acordo'}
            </button>
        </div>
    );
};

const ClientsTab: React.FC<ClientsTabProps> = () => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]); 
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'inadimplentes' | 'vip'>('todos');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null); 
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
    
    // Negotiation States
    const [isNegotiationMode, setIsNegotiationMode] = useState(false);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [showNegotiationModal, setShowNegotiationModal] = useState(false);

    // Fetch Data via Admin API to bypass RLS issues
    const fetchData = useCallback(async () => {
        setIsDataLoading(true);
        setErrorMsg(null);
        try {
            const [profilesRes, invoicesRes] = await Promise.all([
                fetch('/api/admin/profiles'),
                fetch('/api/admin/invoices')
            ]);

            if (!profilesRes.ok) throw new Error('Falha ao carregar perfis');
            if (!invoicesRes.ok) throw new Error('Falha ao carregar faturas');

            setProfiles(await profilesRes.json());
            setInvoices(await invoicesRes.json());
        } catch (e: any) {
            console.error("Failed to load CRM data", e);
            setErrorMsg(e.message);
        } finally {
            setIsDataLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Lógica de CRM
    const enhancedProfiles: EnhancedProfile[] = useMemo(() => {
        return profiles.map(profile => {
            const userInvoices = invoices.filter(inv => inv.user_id === profile.id);
            
            const totalPaid = userInvoices
                .filter(inv => inv.status === 'Paga')
                .reduce((sum, inv) => sum + inv.amount, 0);
            
            const totalDebt = userInvoices
                .filter(inv => inv.status === 'Em aberto' || inv.status === 'Boleto Gerado')
                .reduce((sum, inv) => sum + inv.amount, 0);

            const lastPurchase = userInvoices.length > 0 
                ? userInvoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at 
                : null;

            const limit = profile.credit_limit || 1; 
            const utilizationRate = Math.min(100, (totalDebt / limit) * 100);

            let riskLevel: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
            const hasLateInvoices = userInvoices.some(inv => 
                (inv.status === 'Em aberto' || inv.status === 'Boleto Gerado') && 
                new Date(inv.due_date) < new Date()
            );

            if (hasLateInvoices || utilizationRate > 90 || profile.credit_status === 'Bloqueado') riskLevel = 'Alto';
            else if (utilizationRate > 70 || (profile.credit_score || 0) < 500) riskLevel = 'Médio';

            return {
                ...profile,
                ltv: totalPaid,
                totalDebt,
                lastPurchaseDate: lastPurchase,
                invoiceCount: userInvoices.length,
                riskLevel,
                utilizationRate,
                isBlocked: profile.credit_status === 'Bloqueado'
            };
        });
    }, [profiles, invoices]);

    const filteredProfiles = useMemo(() => {
        return enhancedProfiles.filter(p => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                p.first_name?.toLowerCase().includes(searchLower) || 
                p.last_name?.toLowerCase().includes(searchLower) ||
                p.email?.toLowerCase().includes(searchLower) ||
                p.identification_number?.includes(searchLower);

            if (!matchesSearch) return false;
            if (filterStatus === 'inadimplentes') return p.riskLevel === 'Alto';
            if (filterStatus === 'vip') return (p.credit_score || 0) > 800;
            return true;
        });
    }, [enhancedProfiles, searchTerm, filterStatus]);

    const handleOpenDrawer = (clientId: string) => {
        setSelectedClientId(clientId);
        setIsDrawerOpen(true);
        // Resetar estados ao abrir novo cliente
        setIsNegotiationMode(false);
        setSelectedInvoiceIds(new Set());
    };

    const toggleInvoiceSelection = (id: string) => {
        const newSet = new Set(selectedInvoiceIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedInvoiceIds(newSet);
    };

    const handleNegotiationSubmit = async (data: any) => {
        try {
            const res = await fetch('/api/admin/negotiate-debt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedClientId,
                    ...data
                })
            });
            
            if (!res.ok) throw new Error('Erro ao processar negociação');
            
            setSuccessMessage('Acordo realizado com sucesso!');
            setTimeout(() => setSuccessMessage(null), 3000);
            
            setIsDrawerOpen(false);
            fetchData(); // Recarrega dados
        } catch (e: any) {
            setErrorMsg(e.message);
        }
    };

    if (isDataLoading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;
    if (errorMsg) return <div className="p-8"><Alert message={`Erro ao carregar dados: ${errorMsg}`} type="error" /></div>;

    const selectedClient = enhancedProfiles.find(p => p.id === selectedClientId);
    // Filtrar apenas faturas não pagas para negociação, ou todas para histórico
    const selectedClientInvoices = invoices.filter(inv => inv.user_id === selectedClientId);
    const negotiationInvoices = selectedClientInvoices.filter(inv => selectedInvoiceIds.has(inv.id));

    return (
        <div className="p-4 space-y-6 bg-slate-50 dark:bg-slate-900/50 min-h-screen">
            {/* Success Toast */}
            {successMessage && (
                <div className="fixed top-4 right-4 z-[100] animate-fade-in">
                    <Alert message={successMessage} type="success" />
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Clientes" value={enhancedProfiles.length} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} color="bg-indigo-600" />
                <StatCard title="Em Aberto" value={enhancedProfiles.reduce((acc, p) => acc + p.totalDebt, 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} color="bg-amber-500" />
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-1 gap-2">
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none" />
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none">
                        <option value="todos">Todos</option>
                        <option value="inadimplentes">Inadimplentes</option>
                    </select>
                </div>
            </div>

            {/* Lista */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Risco</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dívida</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredProfiles.map((client) => (
                                <tr key={client.id} onClick={() => handleOpenDrawer(client.id)} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{client.first_name} {client.last_name}</div>
                                        <div className="text-xs text-slate-500">{client.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap"><RiskBadge level={client.riskLevel} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700 dark:text-slate-300">R$ {client.totalDebt.toLocaleString('pt-BR')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 font-bold">Detalhes</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drawer Detalhes & Negociação */}
            {isDrawerOpen && selectedClient && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsDrawerOpen(false)}></div>
                    <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right overflow-hidden">
                        
                        {/* Header Drawer */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedClient.first_name} {selectedClient.last_name}</h2>
                                <p className="text-sm text-slate-500 flex gap-2 items-center">
                                    {selectedClient.identification_number}
                                    <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                                    Score: {selectedClient.credit_score}
                                </p>
                            </div>
                            <button onClick={() => setIsDrawerOpen(false)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Resumo Financeiro */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 uppercase font-bold">Limite Total</p>
                                    <p className="text-xl font-black text-slate-900 dark:text-white">R$ {selectedClient.credit_limit}</p>
                                </div>
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/30">
                                    <p className="text-xs text-red-600 uppercase font-bold">Dívida Ativa</p>
                                    <p className="text-xl font-black text-red-600 dark:text-red-400">R$ {selectedClient.totalDebt}</p>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Histórico de Faturas</h3>
                                {isNegotiationMode ? (
                                    <div className="flex gap-2">
                                        <span className="text-xs font-bold text-indigo-600 self-center mr-2">
                                            {selectedInvoiceIds.size} selecionadas
                                        </span>
                                        <button 
                                            onClick={() => { setIsNegotiationMode(false); setSelectedInvoiceIds(new Set()); }}
                                            className="px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            onClick={() => setShowNegotiationModal(true)}
                                            disabled={selectedInvoiceIds.size === 0}
                                            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg"
                                        >
                                            Negociar Seleção
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => setIsNegotiationMode(true)}
                                        className="px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity"
                                    >
                                        Iniciar Negociação
                                    </button>
                                )}
                            </div>

                            {/* Lista de Faturas com Checkbox para Negociação */}
                            <div className="space-y-2">
                                {selectedClientInvoices.length === 0 ? (
                                    <p className="text-center text-slate-400 py-4">Nenhuma fatura encontrada.</p>
                                ) : (
                                    selectedClientInvoices.map(inv => {
                                        const isSelectable = (inv.status === 'Em aberto' || inv.status === 'Boleto Gerado');
                                        const isSelected = selectedInvoiceIds.has(inv.id);
                                        const isLate = new Date(inv.due_date) < new Date();

                                        return (
                                            <div 
                                                key={inv.id} 
                                                onClick={() => isNegotiationMode && isSelectable ? toggleInvoiceSelection(inv.id) : null}
                                                className={`flex justify-between items-center p-3 border rounded-lg transition-all ${
                                                    isSelected 
                                                    ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 dark:bg-indigo-900/30' 
                                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                                                } ${isNegotiationMode && isSelectable ? 'cursor-pointer hover:shadow-md' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {isNegotiationMode && (
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white">{inv.month}</p>
                                                        <p className={`text-xs ${isLate ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                                                            {new Date(inv.due_date).toLocaleDateString()} 
                                                            {isLate && ' (Atrasada)'}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className="font-bold text-sm">R$ {inv.amount.toFixed(2)}</p>
                                                        <p className={`text-[10px] uppercase font-bold ${inv.status === 'Paga' ? 'text-green-600' : 'text-red-600'}`}>{inv.status}</p>
                                                    </div>
                                                    {/* Botão Ver Detalhes (Olho) */}
                                                    {!isNegotiationMode && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setViewingInvoice(inv); }}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                                            title="Ver Detalhes da Fatura"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Detalhes */}
            <Modal isOpen={!!viewingInvoice} onClose={() => setViewingInvoice(null)}>
                {viewingInvoice && <InvoiceDetailModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />}
            </Modal>

            {/* Modal de Negociação */}
            <Modal isOpen={showNegotiationModal} onClose={() => setShowNegotiationModal(false)}>
                <NegotiationModal 
                    selectedInvoices={negotiationInvoices} 
                    onClose={() => setShowNegotiationModal(false)} 
                    onConfirm={handleNegotiationSubmit}
                />
            </Modal>
        </div>
    );
};

export default ClientsTab;
