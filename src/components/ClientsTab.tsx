
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Profile } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Modal from './Modal';
import InputField from './InputField';

interface ClientsTabProps {
    allInvoices?: Invoice[]; // Prop opcional
    isLoading?: boolean;
    errorInfo?: { message: string } | null;
}

// Tipos estendidos para o CRM
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

// --- Modais Internos ---

// Modal de Cadastro de Cliente (Novo)
const ClientRegisterModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        cpf: '',
        phone: '',
        limit: '500'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const payload = {
                email: form.email,
                password: 'Relp' + Math.random().toString(36).slice(-4), // Senha temporária
                first_name: form.firstName,
                last_name: form.lastName,
                identification_number: form.cpf,
                phone: form.phone,
                credit_limit: parseFloat(form.limit)
            };

            const response = await fetch('/api/admin/create-and-analyze-customer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.message || "Erro ao criar cliente");

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Novo Cliente</h3>
                <p className="text-sm text-slate-500">Cadastre um novo cliente no sistema.</p>
            </div>

            {error && <Alert message={error} type="error" />}

            <div className="grid grid-cols-2 gap-4">
                <InputField label="Nome" name="firstName" value={form.firstName} onChange={handleChange} required placeholder="Ex: João" />
                <InputField label="Sobrenome" name="lastName" value={form.lastName} onChange={handleChange} required placeholder="Ex: Silva" />
            </div>
            
            <InputField label="Email" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="cliente@email.com" />
            
            <div className="grid grid-cols-2 gap-4">
                <InputField label="CPF" name="cpf" value={form.cpf} onChange={handleChange} required placeholder="000.000.000-00" />
                <InputField label="Telefone" name="phone" value={form.phone} onChange={handleChange} required placeholder="(96) 99999-9999" />
            </div>

            <InputField label="Limite Inicial (R$)" name="limit" type="number" value={form.limit} onChange={handleChange} required />

            <div className="flex gap-3 pt-4">
                <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={isLoading} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center">
                    {isLoading ? <LoadingSpinner /> : 'Cadastrar'}
                </button>
            </div>
        </form>
    );
};

const InvoiceDetailModal: React.FC<{ invoice: Invoice; onClose: () => void }> = ({ invoice, onClose }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Detalhes da Fatura</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    invoice.status === 'Paga' ? 'bg-green-100 text-green-700' : 
                    invoice.status === 'Cancelado' ? 'bg-slate-100 text-slate-500' :
                    'bg-red-100 text-red-700'
                }`}>
                    {invoice.status}
                </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Descrição / Produto</p>
                <p className="text-sm text-slate-800 dark:text-white font-medium leading-relaxed">
                    {invoice.notes || invoice.month}
                </p>
                {!invoice.notes && <p className="text-xs text-slate-400 italic mt-1">Nenhuma descrição detalhada disponível.</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
                    <p className="text-xs text-slate-500">Valor Original</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {invoice.amount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                    </p>
                </div>
                <div className="p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
                    <p className="text-xs text-slate-500">Vencimento</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {new Date(invoice.due_date).toLocaleDateString('pt-BR')}
                    </p>
                </div>
                <div className="p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
                    <p className="text-xs text-slate-500">Criado em</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {new Date(invoice.created_at).toLocaleDateString('pt-BR')}
                    </p>
                </div>
                {invoice.payment_date && (
                    <div className="p-3 border border-green-100 dark:border-green-900/30 bg-green-50 dark:bg-green-900/10 rounded-lg">
                        <p className="text-xs text-green-600">Pago em</p>
                        <p className="text-sm font-bold text-green-700">
                            {new Date(invoice.payment_date).toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-2">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg text-sm font-bold hover:bg-slate-300 transition-colors">
                    Fechar
                </button>
            </div>
        </div>
    );
};

const NegotiationModal: React.FC<{ 
    selectedInvoices: Invoice[]; 
    onClose: () => void; 
    onConfirm: (total: number, installments: number, notes: string) => void; 
    isProcessing: boolean;
}> = ({ selectedInvoices, onClose, onConfirm, isProcessing }) => {
    const totalOriginal = selectedInvoices.reduce((acc, i) => acc + i.amount, 0);
    const [newTotal, setNewTotal] = useState(totalOriginal);
    const [installments, setInstallments] = useState(1);
    const [notes, setNotes] = useState(`Acordo referente a ${selectedInvoices.length} faturas antigas.`);

    const discount = totalOriginal - newTotal;
    const discountPercent = totalOriginal > 0 ? ((discount / totalOriginal) * 100).toFixed(1) : '0';

    return (
        <div className="space-y-6">
            <div className="text-center border-b border-slate-100 dark:border-slate-700 pb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nova Negociação</h3>
                <p className="text-sm text-slate-500">Regularizando {selectedInvoices.length} pendências.</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Total Original</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 line-through decoration-red-500">
                        {totalOriginal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                    </span>
                </div>
                
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">Novo Valor (Acordo)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400">R$</span>
                            <input 
                                type="number" 
                                value={newTotal} 
                                onChange={e => setNewTotal(Number(e.target.value))}
                                className="w-full pl-8 pr-3 py-2 border-2 border-indigo-100 focus:border-indigo-500 rounded-lg font-bold text-lg outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>
                    </div>
                    <div className="mb-2">
                        {discount > 0 && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">-{discountPercent}% OFF</span>}
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Condições de Pagamento</label>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6].map(n => (
                        <button 
                            key={n} 
                            onClick={() => setInstallments(n)}
                            className={`flex-1 py-2 rounded-lg font-bold text-sm border ${installments === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'}`}
                        >
                            {n}x
                        </button>
                    ))}
                </div>
                <p className="text-center mt-2 text-sm font-bold text-slate-800 dark:text-white">
                    {installments}x de {(newTotal / Math.max(1, installments)).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações do Acordo</label>
                <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full p-3 border rounded-lg text-sm bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    rows={2}
                />
            </div>

            <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-3 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>
                <button 
                    onClick={() => onConfirm(newTotal, installments, notes)} 
                    disabled={isProcessing}
                    className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 flex justify-center items-center gap-2"
                >
                    {isProcessing ? <LoadingSpinner /> : 'Confirmar Acordo'}
                </button>
            </div>
        </div>
    );
};

const ClientsTab: React.FC<ClientsTabProps> = ({ isLoading: parentLoading }) => {
    // Data States
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]); 
    const [isDataLoading, setIsDataLoading] = useState(true);
    
    // UI States
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'inadimplentes' | 'vip'>('todos');
    const [msg, setMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
    
    // Drawer & Modal States
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null); 
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
    const [isEditingLimit, setIsEditingLimit] = useState(false);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false); // State para o modal de cadastro
    
    // Negotiation States
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [isNegotiationModalOpen, setIsNegotiationModalOpen] = useState(false);
    
    // Detail Modal State
    const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

    // Action States
    const [notifForm, setNotifForm] = useState({ title: '', message: '', type: 'info' });
    const [isSending, setIsSending] = useState(false);
    const [newLimit, setNewLimit] = useState('');
    const [internalNote, setInternalNote] = useState('');

    // --- Data Fetching ---
    const fetchData = useCallback(async () => {
        setIsDataLoading(true);
        try {
            // Busca Perfis e Faturas em paralelo para garantir consistência
            const [profilesRes, invoicesRes] = await Promise.all([
                supabase.from('profiles').select('*').order('created_at', {ascending: false}),
                supabase.from('invoices').select('*').order('due_date', { ascending: false })
            ]);

            if (profilesRes.error) throw profilesRes.error;
            if (invoicesRes.error) throw invoicesRes.error;

            setProfiles(profilesRes.data || []);
            setInvoices(invoicesRes.data || []);
        } catch (e) {
            console.error("Failed to load CRM data", e);
        } finally {
            setIsDataLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Lógica de CRM (Cálculo de Dados Ricos) ---
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

            const limit = profile.credit_limit || 1; // Evita divisão por zero
            const utilizationRate = Math.min(100, (totalDebt / limit) * 100);

            // Lógica de Risco Simplificada
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

    // Cliente Selecionado (Derivado do ID para ser reativo)
    const selectedClient = useMemo(() => {
        if (!selectedClientId) return null;
        return enhancedProfiles.find(p => p.id === selectedClientId) || null;
    }, [selectedClientId, enhancedProfiles]);

    // Faturas do Cliente Selecionado
    const selectedClientInvoices = useMemo(() => {
        if (!selectedClientId) return [];
        return invoices.filter(inv => inv.user_id === selectedClientId);
    }, [selectedClientId, invoices]);

    // --- Filtragem ---
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

    // --- Estatísticas do Dashboard ---
    const stats = useMemo(() => {
        const totalClients = enhancedProfiles.length;
        const totalLTV = enhancedProfiles.reduce((acc, p) => acc + p.ltv, 0);
        const activeDebt = enhancedProfiles.reduce((acc, p) => acc + p.totalDebt, 0);
        const highRiskCount = enhancedProfiles.filter(p => p.riskLevel === 'Alto').length;

        return { totalClients, totalLTV, activeDebt, highRiskCount };
    }, [enhancedProfiles]);

    // --- Handlers ---

    const handleOpenDrawer = (clientId: string) => {
        setSelectedClientId(clientId);
        setIsDrawerOpen(true);
        setIsSelectionMode(false);
        setSelectedInvoiceIds(new Set());
        
        const client = enhancedProfiles.find(p => p.id === clientId);
        if (client) {
            setNewLimit(String(client.credit_limit || 0));
            setInternalNote(localStorage.getItem(`note_${clientId}`) || '');
        }
    };

    const handleSaveInternalNote = () => {
        if (selectedClientId) {
            localStorage.setItem(`note_${selectedClientId}`, internalNote);
            setMsg({type: 'success', text: "Nota salva localmente."});
            setTimeout(() => setMsg(null), 3000);
        }
    };

    const handleUpdateLimit = async () => {
        if (!selectedClientId) return;
        setIsSending(true);
        try {
            const limitVal = parseFloat(newLimit);
            const { error } = await supabase.from('profiles').update({ credit_limit: limitVal }).eq('id', selectedClientId);
            
            if(error) throw error;

            // Atualiza lista local via fetch para garantir sync
            await fetchData();
            setIsEditingLimit(false);
            setMsg({type: 'success', text: "Limite atualizado com sucesso!"});
        } catch (e) {
            setMsg({type: 'error', text: "Erro ao atualizar limite."});
        } finally {
            setIsSending(false);
            setTimeout(() => setMsg(null), 3000);
        }
    };

    const handleDeleteInvoice = async (invoiceId: string) => {
        if (!confirm("Tem certeza que deseja cancelar e apagar esta fatura? Esta ação não pode ser desfeita.")) return;
        
        try {
            const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
            if (error) throw error;

            // Atualiza estado local removendo a fatura
            await fetchData();
            setMsg({type: 'success', text: "Fatura excluída com sucesso."});
        } catch (e) {
            console.error(e);
            setMsg({type: 'error', text: "Erro ao excluir fatura."});
        } finally {
            setTimeout(() => setMsg(null), 3000);
        }
    };

    const handleBlockClient = async () => {
        if(!selectedClientId || !selectedClient) return;
        const newStatus = selectedClient.isBlocked ? 'Ativo' : 'Bloqueado';
        
        if (!confirm(`Tem certeza que deseja ${newStatus === 'Bloqueado' ? 'bloquear' : 'desbloquear'} este cliente?`)) return;
        
        try {
            const { error } = await supabase.from('profiles').update({ credit_status: newStatus }).eq('id', selectedClientId);
            if (error) throw error;

            await fetchData();
            setMsg({type: 'success', text: `Cliente ${newStatus} com sucesso.`});
        } catch(e) {
            setMsg({type: 'error', text: "Erro ao alterar status do cliente."});
        } finally {
            setTimeout(() => setMsg(null), 3000);
        }
    };

    const handleWhatsApp = () => {
        if (selectedClient?.phone) {
            const num = selectedClient.phone.replace(/\D/g, '');
            window.open(`https://wa.me/55${num}`, '_blank');
        } else {
            alert("Telefone não cadastrado.");
        }
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientId) return;
        setIsSending(true);
        try {
            await fetch('/api/admin/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selectedClientId, ...notifForm })
            });
            setIsNotifModalOpen(false);
            setMsg({type: 'success', text: "Notificação enviada!"});
        } catch (e) {
            setMsg({type: 'error', text: "Erro ao enviar notificação."});
        } finally {
            setIsSending(false);
            setTimeout(() => setMsg(null), 3000);
        }
    };

    const handleRegisterSuccess = async () => {
        setIsRegisterModalOpen(false);
        setMsg({ type: 'success', text: 'Cliente cadastrado com sucesso!' });
        await fetchData(); // Recarrega a lista
        setTimeout(() => setMsg(null), 3000);
    };

    // --- Handlers de Negociação ---

    const toggleInvoiceSelection = (id: string) => {
        const newSet = new Set(selectedInvoiceIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedInvoiceIds(newSet);
    };

    const handleProcessNegotiation = async (total: number, installments: number, notes: string) => {
        if (!selectedClientId) return;
        setIsSending(true);
        try {
            // 1. Cancelar faturas antigas
            const idsToCancel = Array.from(selectedInvoiceIds);
            await supabase.from('invoices').update({ status: 'Cancelado', notes: `Renegociado em ${new Date().toLocaleDateString()}` }).in('id', idsToCancel);

            // 2. Criar novas faturas
            const installmentValue = total / installments;
            const newInvoices = [];
            const today = new Date();

            for (let i = 1; i <= installments; i++) {
                const dueDate = new Date(today);
                dueDate.setMonth(today.getMonth() + i);
                
                newInvoices.push({
                    user_id: selectedClientId,
                    month: `Acordo ${i}/${installments}`,
                    due_date: dueDate.toISOString().split('T')[0],
                    amount: installmentValue,
                    status: 'Em aberto',
                    notes: notes,
                    created_at: new Date().toISOString()
                });
            }

            const { error } = await supabase.from('invoices').insert(newInvoices);
            if(error) throw error;

            // Refresh Local
            await fetchData(); 
            
            setMsg({type: 'success', text: "Acordo realizado com sucesso!"});
            setIsNegotiationModalOpen(false);
            setIsSelectionMode(false);
            setSelectedInvoiceIds(new Set());

        } catch (e: any) {
            setMsg({type: 'error', text: "Erro ao processar acordo: " + e.message});
        } finally {
            setIsSending(false);
            setTimeout(() => setMsg(null), 3000);
        }
    };

    if (isDataLoading || parentLoading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;

    return (
        <div className="p-4 space-y-6 bg-slate-50 dark:bg-slate-900/50 min-h-screen">
            
            {/* 1. Top Stats Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Total Clientes" 
                    value={stats.totalClients} 
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                    color="bg-indigo-600"
                />
                <StatCard 
                    title="Receita Total (LTV)" 
                    value={stats.totalLTV.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})} 
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    color="bg-green-600"
                    trend="+12% este mês"
                />
                <StatCard 
                    title="Em Aberto (Cobrar)" 
                    value={stats.activeDebt.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})} 
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    color="bg-amber-500"
                />
                <StatCard 
                    title="Alto Risco" 
                    value={stats.highRiskCount} 
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                    color="bg-red-500"
                    trend="Atenção requerida"
                />
            </div>

            {/* 2. Toolbar & Filtros */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-1 gap-2">
                    <div className="relative flex-1 max-w-md">
                        <input 
                            type="text" 
                            placeholder="Buscar por nome, CPF, email..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <select 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="todos">Todos os Clientes</option>
                        <option value="inadimplentes">Inadimplentes / Risco</option>
                        <option value="vip">VIP (Score Alto)</option>
                    </select>
                </div>
                
                <div className="flex gap-2">
                    <button onClick={() => setIsRegisterModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Novo Cliente
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    </button>
                </div>
            </div>

            {/* 3. Lista de Clientes */}
            {viewMode === 'list' ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status & Risco</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Limite Usado</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">LTV</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredProfiles.map((client) => (
                                    <tr key={client.id} onClick={() => handleOpenDrawer(client.id)} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                                                    {client.first_name?.[0]}{client.last_name?.[0]}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white">{client.first_name} {client.last_name}</div>
                                                    <div className="text-xs text-slate-500">{client.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col items-start gap-1">
                                                <RiskBadge level={client.riskLevel} />
                                                {client.isBlocked && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded font-bold">BLOQUEADO</span>}
                                                <span className="text-xs text-slate-500">Score: {client.credit_score}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="w-32">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-slate-700 dark:text-slate-300">{client.utilizationRate.toFixed(0)}%</span>
                                                    <span className="text-slate-500">de R$ {client.credit_limit}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                                    <div className={`h-full rounded-full ${client.utilizationRate > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, client.utilizationRate)}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 dark:text-green-400">
                                            {client.ltv.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold">Gerenciar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProfiles.map((client) => (
                        <div key={client.id} onClick={() => handleOpenDrawer(client.id)} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300">
                                        {client.first_name?.[0]}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{client.first_name}</h4>
                                        <div className="flex gap-1">
                                            <RiskBadge level={client.riskLevel} />
                                            {client.isBlocked && <span className="text-[10px] bg-red-500 text-white px-1 rounded">BLOQ</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase">Dívida Ativa</p>
                                    <p className={`font-bold ${client.totalDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {client.totalDebt.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
                                <div className="flex justify-between">
                                    <span>Limite Disponível:</span>
                                    <span className="text-slate-800 dark:text-white font-bold">R$ {Math.max(0, (client.credit_limit || 0) - client.totalDebt).toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Última Compra:</span>
                                    <span>{client.lastPurchaseDate ? new Date(client.lastPurchaseDate).toLocaleDateString() : 'Nunca'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 4. Drawer de Detalhes do Cliente (O coração do CRM) */}
            {isDrawerOpen && selectedClient && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsDrawerOpen(false)}></div>
                    <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right overflow-hidden">
                        
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                    {selectedClient.first_name?.[0]}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedClient.first_name} {selectedClient.last_name}</h2>
                                    <div className="flex gap-2 mt-1">
                                        <RiskBadge level={selectedClient.riskLevel} />
                                        {selectedClient.isBlocked && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-bold">BLOQUEADO</span>}
                                        <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                            Score: {selectedClient.credit_score}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsDrawerOpen(false)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* FeedbackMsg */}
                        {msg && (
                            <div className={`px-6 pt-4 pb-0`}>
                                <Alert message={msg.text} type={msg.type} />
                            </div>
                        )}

                        {/* Drawer Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            
                            {/* Ações Rápidas */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <button onClick={handleWhatsApp} className="flex flex-col items-center justify-center p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl hover:bg-green-100 transition-colors gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    <span className="text-xs font-bold">WhatsApp</span>
                                </button>
                                <button onClick={() => { setIsNotifModalOpen(true); setNotifForm({ title: 'Aviso de Cobrança', message: `Olá ${selectedClient.first_name}, notamos um débito pendente.`, type: 'alert' }); }} className="flex flex-col items-center justify-center p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl hover:bg-amber-100 transition-colors gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                    <span className="text-xs font-bold">Cobrar</span>
                                </button>
                                <button onClick={() => setIsEditingLimit(!isEditingLimit)} className="flex flex-col items-center justify-center p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                    <span className="text-xs font-bold">Limite</span>
                                </button>
                                <button onClick={handleBlockClient} className="flex flex-col items-center justify-center p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-100 transition-colors gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                    <span className="text-xs font-bold">{selectedClient.isBlocked ? 'Desbloquear' : 'Bloquear'}</span>
                                </button>
                            </div>

                            {/* Edição de Limite Inline */}
                            {isEditingLimit && (
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-indigo-200 dark:border-indigo-800 animate-fade-in">
                                    <h4 className="text-sm font-bold mb-2 text-slate-800 dark:text-white">Ajuste Manual de Limite</h4>
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" 
                                            value={newLimit}
                                            onChange={(e) => setNewLimit(e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 outline-none"
                                        />
                                        <button onClick={handleUpdateLimit} disabled={isSending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm">
                                            {isSending ? <LoadingSpinner/> : 'Salvar'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Dados Financeiros */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    Raio-X Financeiro
                                </h3>
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                                        <span className="text-slate-500 text-sm">Limite Total</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-white">R$ {selectedClient.credit_limit?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                                        <span className="text-slate-500 text-sm">Dívida Aberta</span>
                                        <span className="font-mono font-bold text-red-500">R$ {selectedClient.totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2">
                                        <span className="text-slate-500 text-sm">Total Pago (LTV)</span>
                                        <span className="font-mono font-bold text-green-500">R$ {selectedClient.ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    
                                    <div className="pt-2">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-500">Uso do Limite</span>
                                            <span className="font-bold">{selectedClient.utilizationRate.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className={`h-full ${selectedClient.utilizationRate > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{width: `${Math.min(100, selectedClient.utilizationRate)}%`}}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Gestão de Faturas */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                        Histórico de Faturas
                                    </h3>
                                    <button 
                                        onClick={() => setIsSelectionMode(!isSelectionMode)}
                                        className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${isSelectionMode ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}
                                    >
                                        {isSelectionMode ? 'Cancelar Seleção' : 'Iniciar Negociação'}
                                    </button>
                                </div>

                                {/* Calculadora de Acordo (Flutuante) */}
                                {isSelectionMode && selectedInvoiceIds.size > 0 && (
                                    <div className="sticky top-0 z-10 mb-4 p-3 bg-indigo-600 text-white rounded-lg shadow-lg flex justify-between items-center animate-fade-in-up">
                                        <div>
                                            <p className="text-[10px] uppercase opacity-80">Total Selecionado</p>
                                            <p className="font-bold">
                                                {selectedClientInvoices
                                                    .filter(i => selectedInvoiceIds.has(i.id))
                                                    .reduce((acc, i) => acc + i.amount, 0)
                                                    .toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => setIsNegotiationModalOpen(true)}
                                            className="px-4 py-2 bg-white text-indigo-600 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-50"
                                        >
                                            Negociar
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2 max-h-80 overflow-y-auto custom-scrollbar">
                                    {selectedClientInvoices.length > 0 ? selectedClientInvoices.map(inv => (
                                        <div key={inv.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${selectedInvoiceIds.has(inv.id) ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                            
                                            {isSelectionMode && (
                                                <div className="mr-3">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedInvoiceIds.has(inv.id)}
                                                        onChange={() => toggleInvoiceSelection(inv.id)}
                                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
                                                    />
                                                </div>
                                            )}

                                            <div className="flex-1 cursor-pointer" onClick={() => !isSelectionMode && setViewingInvoice(inv)}>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate w-40" title={inv.month}>{inv.month}</p>
                                                <div className="flex gap-2">
                                                    <p className={`text-[10px] font-bold uppercase ${inv.status === 'Paga' ? 'text-green-600' : inv.status === 'Em aberto' ? 'text-yellow-600' : 'text-red-600'}`}>
                                                        {inv.status}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">{new Date(inv.due_date).toLocaleDateString('pt-BR')}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-mono text-slate-700 dark:text-slate-300">R$ {inv.amount.toLocaleString('pt-BR')}</span>
                                                {!isSelectionMode && (
                                                    <>
                                                        <button onClick={() => setViewingInvoice(inv)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors" title="Ver Detalhes">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteInvoice(inv.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                            title="Excluir Fatura (Lixeira)"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-center text-sm text-slate-400 py-4">Nenhuma fatura encontrada.</p>
                                    )}
                                </div>
                            </div>

                            {/* Notas Internas */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Notas Internas (Admin)
                                </h3>
                                <div className="relative">
                                    <textarea 
                                        className="w-full p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-yellow-400 outline-none resize-none"
                                        rows={4}
                                        placeholder="Escreva observações sobre este cliente..."
                                        value={internalNote}
                                        onChange={(e) => setInternalNote(e.target.value)}
                                    ></textarea>
                                    <button onClick={handleSaveInternalNote} className="absolute bottom-3 right-3 px-3 py-1 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs font-bold rounded hover:bg-yellow-300 transition-colors">
                                        Salvar Nota
                                    </button>
                                </div>
                            </div>

                            {/* Dados Pessoais (ReadOnly) */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Dados Cadastrais</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <p className="text-[10px] text-slate-400 uppercase">CPF</p>
                                        <p className="text-sm font-medium">{selectedClient.identification_number || 'N/A'}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <p className="text-[10px] text-slate-400 uppercase">Telefone</p>
                                        <p className="text-sm font-medium">{selectedClient.phone || 'N/A'}</p>
                                    </div>
                                    <div className="col-span-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <p className="text-[10px] text-slate-400 uppercase">Endereço</p>
                                        <p className="text-sm font-medium">
                                            {selectedClient.street_name ? `${selectedClient.street_name}, ${selectedClient.street_number} - ${selectedClient.neighborhood}` : 'Não cadastrado'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Detalhes da Fatura */}
            <Modal isOpen={!!viewingInvoice} onClose={() => setViewingInvoice(null)}>
                {viewingInvoice && <InvoiceDetailModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />}
            </Modal>

            {/* Modal de Negociação */}
            <Modal isOpen={isNegotiationModalOpen} onClose={() => setIsNegotiationModalOpen(false)}>
                <NegotiationModal 
                    selectedInvoices={selectedClientInvoices.filter(i => selectedInvoiceIds.has(i.id))} 
                    onClose={() => setIsNegotiationModalOpen(false)} 
                    onConfirm={handleProcessNegotiation}
                    isProcessing={isSending}
                />
            </Modal>

            {/* Modal de Notificação */}
            <Modal isOpen={isNotifModalOpen} onClose={() => setIsNotifModalOpen(false)}>
                <form onSubmit={handleSendNotification} className="space-y-4">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Nova Mensagem</h3>
                    <InputField label="Título" name="title" value={notifForm.title} onChange={e => setNotifForm({...notifForm, title: e.target.value})} required />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mensagem</label>
                        <textarea className="w-full px-3 py-2 border rounded-md bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" rows={4} value={notifForm.message} onChange={e => setNotifForm({...notifForm, message: e.target.value})} required></textarea>
                    </div>
                    <button type="submit" disabled={isSending} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50">
                        {isSending ? <LoadingSpinner /> : 'Enviar'}
                    </button>
                </form>
            </Modal>

            {/* Modal de Cadastro de Cliente */}
            <Modal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)}>
                <ClientRegisterModal onClose={() => setIsRegisterModalOpen(false)} onSuccess={handleRegisterSuccess} />
            </Modal>

        </div>
    );
};

export default ClientsTab;
