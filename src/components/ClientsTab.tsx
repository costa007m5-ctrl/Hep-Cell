
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    averageTicket: number; // Ticket Médio
    riskLevel: 'Baixo' | 'Médio' | 'Alto';
    utilizationRate: number;
    isBlocked?: boolean; 
    internal_notes?: string;
    salary?: number;
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

// --- Documentos ---
const DocumentsList: React.FC<{ userId: string }> = ({ userId }) => {
    const [docs, setDocs] = useState<{contracts: any[], uploads: any[]}>({contracts:[], uploads:[]});
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchDocs = async () => {
        try {
            const res = await fetch(`/api/admin/client-documents?userId=${userId}`);
            if(res.ok) setDocs(await res.json());
        } catch(e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchDocs(); }, [userId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;
        setUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                await fetch('/api/admin/upload-document', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        userId,
                        title: file.name,
                        type: 'Manual',
                        fileBase64: reader.result
                    })
                });
                fetchDocs();
            } catch(e) { alert('Erro upload'); }
            finally { setUploading(false); }
        };
        reader.readAsDataURL(file);
    };

    if(isLoading) return <LoadingSpinner />;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-800 dark:text-white">Documentos do Cliente</h4>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700">
                    {uploading ? 'Enviando...' : 'Enviar Documento'}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} accept="image/*,application/pdf" />
            </div>
            
            <div className="space-y-2">
                {docs.contracts.map((c: any) => (
                    <div key={c.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <span className="text-green-600">📜</span>
                            <div>
                                <p className="text-sm font-bold">{c.title}</p>
                                <p className="text-[10px] text-slate-500">
                                    {c.status === 'pending_signature' ? 'Aguardando Assinatura' : `Assinado em: ${new Date(c.created_at).toLocaleDateString()}`}
                                </p>
                            </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${c.status === 'pending_signature' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                            {c.status === 'pending_signature' ? 'Pendente' : 'Assinado'}
                        </span>
                    </div>
                ))}
                {docs.uploads.map((u: any) => (
                    <div key={u.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <span className="text-blue-600">📁</span>
                            <div>
                                <p className="text-sm font-bold">{u.title}</p>
                                <p className="text-[10px] text-slate-500">{u.document_type} - {new Date(u.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <a href={u.file_url} download className="text-[10px] text-indigo-600 hover:underline">Baixar</a>
                    </div>
                ))}
                {docs.contracts.length === 0 && docs.uploads.length === 0 && <p className="text-center text-slate-400 text-sm">Nenhum documento encontrado.</p>}
            </div>
        </div>
    );
};

const RiskAnalysis: React.FC<{ userId: string }> = ({ userId }) => {
    const [analysis, setAnalysis] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const generateReport = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/risk-details', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId })
            });
            if(res.ok) setAnalysis(await res.json());
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };

    // Carrega automaticamente se não tiver análise
    useEffect(() => {
        if(!analysis) generateReport();
    }, []);

    return (
        <div className="space-y-4">
            {loading ? (
                <div className="flex justify-center p-8"><LoadingSpinner /></div>
            ) : !analysis ? (
                <div className="text-center py-8">
                    <button onClick={generateReport} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">
                        Gerar Relatório
                    </button>
                </div>
            ) : (
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-lg">Análise de Risco</h4>
                        <RiskBadge level={analysis.riskLevel || 'Médio'} />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{analysis.reason}"</p>
                    
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg text-sm leading-relaxed text-justify">
                        {analysis.detailedAnalysis}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-green-50 text-green-800 rounded border border-green-100">
                            <strong>Pontos Positivos:</strong>
                            <ul className="list-disc list-inside mt-1">{analysis.positivePoints?.map((p:any, i:number) => <li key={i}>{p}</li>)}</ul>
                        </div>
                        <div className="p-2 bg-red-50 text-red-800 rounded border border-red-100">
                            <strong>Pontos Negativos:</strong>
                            <ul className="list-disc list-inside mt-1">{analysis.negativePoints?.map((p:any, i:number) => <li key={i}>{p}</li>)}</ul>
                        </div>
                    </div>

                    <div className="p-2 bg-indigo-100 text-indigo-800 rounded text-center text-sm font-bold">
                        Recomendação: {analysis.recommendation}
                    </div>
                    <button onClick={generateReport} className="text-xs text-indigo-500 underline w-full text-center mt-2 hover:text-indigo-700">
                        Atualizar Dados e Reanalisar
                    </button>
                </div>
            )}
        </div>
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
    const [activeDrawerTab, setActiveDrawerTab] = useState<'geral' | 'faturas' | 'docs' | 'risco'>('geral');
    
    // Super Manager States
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [showNegotiationModal, setShowNegotiationModal] = useState(false);
    
    // Limit Request & Management State
    const [tempLimit, setTempLimit] = useState<string>('');
    const [tempScore, setTempScore] = useState<string>('');
    const [responseReason, setResponseReason] = useState('');
    const [processingRequest, setProcessingRequest] = useState(false);
    
    // State para documentos específicos da solicitação
    const [clientDocs, setClientDocs] = useState<any[]>([]);

    // Negotiation Form
    const [negotiationData, setNegotiationData] = useState({
        installments: 1,
        firstDueDate: new Date().toISOString().split('T')[0],
        notes: ''
    });
    const [isNegotiating, setIsNegotiating] = useState(false);

    // Notes
    const [internalNotes, setInternalNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    // Fetch Data
    const fetchData = useCallback(async () => {
        setIsDataLoading(true);
        setErrorMsg(null);
        try {
            const [profilesRes, invoicesRes, requestsRes] = await Promise.all([
                fetch('/api/admin/profiles'),
                fetch('/api/admin/invoices'),
                fetch('/api/admin/limit-requests')
            ]);

            if (!profilesRes.ok) throw new Error('Falha ao carregar perfis');
            if (!invoicesRes.ok) throw new Error('Falha ao carregar faturas');

            setProfiles(await profilesRes.json());
            setInvoices(await invoicesRes.json());
            if(requestsRes.ok) setLimitRequests(await requestsRes.json());

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

    // CRM Logic
    const enhancedProfiles: EnhancedProfile[] = useMemo(() => {
        return profiles.map(profile => {
            const userInvoices = invoices.filter(inv => inv.user_id === profile.id);
            
            const totalPaid = userInvoices
                .filter(inv => inv.status === 'Paga')
                .reduce((sum, inv) => sum + inv.amount, 0);
            
            const paidCount = userInvoices.filter(inv => inv.status === 'Paga').length;
            const averageTicket = paidCount > 0 ? totalPaid / paidCount : 0;

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
                averageTicket,
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
            if (filterStatus === 'solicitacoes') {
                return limitRequests.some(r => r.user_id === p.id && r.status === 'pending');
            }
            return true;
        });
    }, [enhancedProfiles, searchTerm, filterStatus, limitRequests]);

    // Função para buscar documentos ao abrir o drawer
    const fetchClientDocsForDrawer = async (userId: string) => {
        try {
            const res = await fetch(`/api/admin/client-documents?userId=${userId}`);
            if(res.ok) {
                const data = await res.json();
                setClientDocs(data.uploads || []);
            }
        } catch(e) { console.error("Erro ao buscar docs", e); }
    };

    const handleOpenDrawer = (client: EnhancedProfile) => {
        setSelectedClientId(client.id);
        setInternalNotes(client.internal_notes || '');
        setIsDrawerOpen(true);
        setSelectedInvoiceIds(new Set());
        setActiveDrawerTab('geral');
        setResponseReason('');
        
        // Busca documentos imediatamente para usar na aba Geral
        fetchClientDocsForDrawer(client.id);
        
        // Reseta campos de gestão de limite
        const req = limitRequests.find(r => r.user_id === client.id && r.status === 'pending');
        if(req) {
            setTempLimit(String(req.requested_amount));
            setTempScore('600'); // Sugestão padrão
        } else {
            setTempLimit(String(client.credit_limit || 0));
            setTempScore(String(client.credit_score || 0));
        }
    };

    const handleManageInvoice = async (invoiceId: string | string[], action: 'pay' | 'cancel' | 'delete') => {
        if (!confirm(`Confirmação: Deseja ${action === 'pay' ? 'pagar' : action === 'cancel' ? 'cancelar' : 'excluir'} as faturas selecionadas?`)) return;
        
        const payload = Array.isArray(invoiceId) ? { invoiceIds: invoiceId, action } : { invoiceId, action };

        try {
            const res = await fetch('/api/admin/manage-invoice', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setSuccessMessage('Operação realizada com sucesso!');
                setTimeout(() => setSuccessMessage(null), 3000);
                setSelectedInvoiceIds(new Set()); 
                fetchData();
            } else {
                alert('Erro ao atualizar faturas.');
            }
        } catch (e) { console.error(e); }
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
        } catch (e) {
            alert('Falha ao criar negociação.');
        } finally {
            setIsNegotiating(false);
        }
    };

    // Unified Limit Action Handler (For Request or Manual Update)
    const handleLimitAction = async (action: 'approve_manual' | 'reject' | 'calculate_auto' | 'update', reqId?: string) => {
        if (!selectedClientId) return;
        setProcessingRequest(true);
        
        const endpoint = reqId ? '/api/admin/manage-limit-request' : '/api/admin/update-limit';
        const payload: any = {
            userId: selectedClientId,
            action,
            manualLimit: parseFloat(tempLimit),
            manualScore: parseInt(tempScore),
            responseReason: responseReason,
            requestId: reqId
        };

        // Se for apenas update, o payload muda
        if (action === 'update') {
            payload.creditLimit = parseFloat(tempLimit);
            payload.creditScore = parseInt(tempScore);
        }

        // Se for calculo automatico, usamos o endpoint de request mas com user ID
        if (action === 'calculate_auto') {
             if (!reqId) {
                 try {
                     const res = await fetch('/api/admin/analyze-credit', {
                         method: 'POST',
                         headers: {'Content-Type': 'application/json'},
                         body: JSON.stringify({ userId: selectedClientId })
                     });
                     const data = await res.json();
                     if (res.ok) {
                         setTempLimit(String(data.profile.credit_limit));
                         setTempScore(String(data.profile.credit_score));
                         setResponseReason(data.profile.reason || '');
                         setSuccessMessage("Sugestão calculada!");
                     }
                 } catch (e) { alert("Erro ao calcular"); }
                 setProcessingRequest(false);
                 return;
             }
        }

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            
            if(res.ok) {
                if (action === 'calculate_auto' && data.suggestedLimit) {
                    setTempLimit(String(data.suggestedLimit));
                    setTempScore(String(data.suggestedScore || 600));
                    setResponseReason(data.reason || '');
                    setSuccessMessage("Sugestão calculada pela IA!");
                } else {
                    setSuccessMessage(data.message || 'Atualizado com sucesso!');
                    fetchData();
                }
                setTimeout(() => setSuccessMessage(null), 3000);
            } else {
                alert(data.error);
            }
        } catch(e) {
            alert("Erro na operação");
        } finally {
            setProcessingRequest(false);
        }
    };

    const handleSaveNotes = async () => {
        if(!selectedClientId) return;
        setIsSavingNotes(true);
        try {
            await fetch('/api/admin/manage-notes', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: selectedClientId, notes: internalNotes })
            });
            setSuccessMessage('Notas salvas.');
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch(e) { alert('Erro ao salvar nota'); }
        finally { setIsSavingNotes(false); }
    };

    const toggleInvoiceSelection = (id: string) => {
        const newSet = new Set(selectedInvoiceIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedInvoiceIds(newSet);
    };

    const selectedClient = enhancedProfiles.find(p => p.id === selectedClientId);
    const selectedClientInvoices = invoices.filter(inv => inv.user_id === selectedClientId);
    const clientPendingRequest = limitRequests.find(r => r.user_id === selectedClientId && r.status === 'pending');
    
    // Encontra o comprovante mais recente
    const incomeProof = useMemo(() => {
        return clientDocs
            .filter(d => d.document_type === 'Comprovante de Renda')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    }, [clientDocs]);

    if (isDataLoading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;
    if (errorMsg) return <div className="p-8"><Alert message={`Erro ao carregar dados: ${errorMsg}`} type="error" /></div>;

    return (
        <div className="p-4 space-y-6 bg-slate-50 dark:bg-slate-900/50 min-h-screen">
            {successMessage && (
                <div className="fixed top-4 right-4 z-[100] animate-fade-in">
                    <Alert message={successMessage} type="success" />
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Clientes" value={enhancedProfiles.length} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} color="bg-indigo-600" />
                <StatCard title="Em Aberto" value={enhancedProfiles.reduce((acc, p) => acc + p.totalDebt, 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} color="bg-amber-500" />
                <StatCard title="Novas Solicitações" value={limitRequests.length} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} color="bg-purple-500" />
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-1 gap-2">
                    <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none">
                        <option value="todos">Todos</option>
                        <option value="inadimplentes">Inadimplentes</option>
                        <option value="vip">VIP</option>
                        <option value="solicitacoes">Solicitações</option>
                    </select>
                </div>
            </div>

            {/* Lista */}
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
                                                {client.credit_score > 800 && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">VIP</span>}
                                                {client.riskLevel === 'Alto' && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">RISCO</span>}
                                                {!client.invoiceCount && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">NOVO</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap"><RiskBadge level={client.riskLevel} /></td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">R$ {client.averageTicket.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 font-bold">Gerenciar</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drawer Detalhes (Super Gerenciador) */}
            {isDrawerOpen && selectedClient && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsDrawerOpen(false)}></div>
                    <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right overflow-hidden">
                        
                        {/* Header Drawer */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedClient.first_name} {selectedClient.last_name}</h2>
                                <div className="flex gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-bold">{selectedClient.identification_number}</span>
                                    {selectedClient.salary && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">Renda: R$ {selectedClient.salary.toLocaleString()}</span>}
                                </div>
                            </div>
                            <button onClick={() => setIsDrawerOpen(false)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </div>

                        {/* Tabs Drawer */}
                        <div className="px-6 pt-4 border-b border-slate-100 dark:border-slate-700 flex gap-4">
                            {['geral', 'faturas', 'docs', 'risco'].map(tab => (
                                <button 
                                    key={tab} 
                                    onClick={() => setActiveDrawerTab(tab as any)}
                                    className={`pb-2 text-sm font-bold capitalize border-b-2 transition-colors ${activeDrawerTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}
                                >
                                    {tab === 'docs' ? 'Documentos' : tab === 'risco' ? 'Análise Risco' : tab}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900/30">
                            
                            {/* --- TAB GERAL (GESTÃO DE CRÉDITO) --- */}
                            {activeDrawerTab === 'geral' && (
                                <>
                                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-lg">
                                                Gestão de Crédito
                                                {clientPendingRequest && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full animate-pulse font-bold">Solicitação Pendente</span>}
                                            </h3>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 uppercase">Limite Atual</p>
                                                <p className="font-black text-lg text-indigo-600 dark:text-indigo-400">R$ {selectedClient.credit_limit?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                            </div>
                                        </div>

                                        {clientPendingRequest && (
                                            <div className="mb-5 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl relative">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="text-[10px] text-purple-500 uppercase font-bold">Valor Solicitado</p>
                                                        <p className="text-2xl font-black text-purple-700 dark:text-purple-300">R$ {clientPendingRequest.requested_amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-purple-500 uppercase font-bold">Data Solicitação</p>
                                                        <p className="text-sm font-bold text-purple-800 dark:text-purple-200">{new Date(clientPendingRequest.created_at).toLocaleDateString()} às {new Date(clientPendingRequest.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-purple-200 dark:border-purple-900/50 mb-3">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Motivo do Cliente</p>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{clientPendingRequest.justification}"</p>
                                                </div>

                                                {incomeProof && (
                                                    <a 
                                                        href={incomeProof.file_url} 
                                                        download={`Comprovante_Renda_${selectedClient.first_name}.png`}
                                                        className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors mb-1"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                        📄 Ver Comprovante Anexado
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">Novo Limite</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                                                    <input 
                                                        type="number" 
                                                        value={tempLimit} 
                                                        onChange={e => setTempLimit(e.target.value)} 
                                                        className="w-full pl-8 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">Novo Score</label>
                                                <input 
                                                    type="number" 
                                                    value={tempScore} 
                                                    onChange={e => setTempScore(e.target.value)} 
                                                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <label className="text-xs font-bold text-slate-500 mb-1 block">Motivo / Explicação (Visível ao Cliente)</label>
                                            <textarea 
                                                value={responseReason} 
                                                onChange={e => setResponseReason(e.target.value)} 
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="Ex: Aprovado mediante análise de renda e bom histórico..."
                                            ></textarea>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <button 
                                                onClick={() => handleLimitAction('calculate_auto', clientPendingRequest?.id)}
                                                disabled={processingRequest}
                                                className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                            >
                                                {processingRequest ? <LoadingSpinner /> : '✨ Calcular Sugestão Automática (IA)'}
                                            </button>

                                            <div className="flex gap-3 mt-1">
                                                {clientPendingRequest ? (
                                                    <>
                                                        <button onClick={() => handleLimitAction('approve_manual', clientPendingRequest.id)} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 shadow-lg shadow-green-500/20 transition-transform active:scale-95">
                                                            Aprovar Solicitação
                                                        </button>
                                                        <button onClick={() => handleLimitAction('reject', clientPendingRequest.id)} className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm border border-red-100 hover:bg-red-100 transition-colors">
                                                            Rejeitar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => handleLimitAction('update')} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-transform active:scale-95">
                                                        Atualizar Limite
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-200 dark:border-yellow-700 mt-6">
                                        <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-200 mb-2">Notas Internas (Privado)</h4>
                                        <textarea 
                                            value={internalNotes} 
                                            onChange={e => setInternalNotes(e.target.value)} 
                                            className="w-full p-2 text-sm bg-white dark:bg-slate-900 border border-yellow-300 dark:border-yellow-800 rounded-lg resize-none focus:ring-2 focus:ring-yellow-500 outline-none"
                                            rows={3}
                                            placeholder="Ex: Cliente prefere contato a tarde..."
                                        ></textarea>
                                        <button onClick={handleSaveNotes} disabled={isSavingNotes} className="mt-2 text-xs font-bold text-yellow-700 hover:underline">{isSavingNotes ? 'Salvando...' : 'Salvar Nota'}</button>
                                    </div>
                                </>
                            )}

                            {/* --- TAB FATURAS (SUPER GERENCIADOR) --- */}
                            {activeDrawerTab === 'faturas' && (
                                <div className="space-y-3">
                                    {selectedInvoiceIds.size > 0 && (
                                        <div className="sticky top-0 z-10 bg-slate-800 text-white p-3 rounded-lg shadow-lg flex justify-between items-center animate-fade-in-up">
                                            <span className="text-xs font-bold">{selectedInvoiceIds.size} Selecionadas</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleManageInvoice(Array.from(selectedInvoiceIds), 'delete')} className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded font-bold">Excluir</button>
                                                <button onClick={() => setShowNegotiationModal(true)} className="text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded font-bold">Renegociar</button>
                                            </div>
                                        </div>
                                    )}

                                    {selectedClientInvoices.map(inv => (
                                        <div key={inv.id} className={`p-3 border rounded-lg flex items-center gap-3 transition-colors ${selectedInvoiceIds.has(inv.id) ? 'bg-indigo-50 border-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                            {inv.status !== 'Paga' && (
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedInvoiceIds.has(inv.id)} 
                                                    onChange={() => toggleInvoiceSelection(inv.id)}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                            )}
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-bold text-sm">{inv.month}</p>
                                                        <p className="text-xs text-slate-500">Vence: {new Date(inv.due_date).toLocaleDateString()}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold">R$ {inv.amount}</p>
                                                        <p className={`text-[10px] uppercase font-bold ${inv.status === 'Paga' ? 'text-green-600' : inv.status === 'Aguardando Assinatura' ? 'text-yellow-600' : 'text-red-600'}`}>{inv.status}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Single Actions Menu */}
                                            <div className="relative group">
                                                <button className="p-1 hover:bg-slate-100 rounded">⋮</button>
                                                <div className="absolute right-0 top-6 w-32 bg-white dark:bg-slate-800 shadow-lg rounded-lg border border-slate-200 dark:border-slate-700 hidden group-hover:block z-20">
                                                    <button onClick={() => handleManageInvoice(inv.id, 'pay')} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-green-600">Pagar</button>
                                                    <button onClick={() => handleManageInvoice(inv.id, 'cancel')} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-yellow-600">Cancelar</button>
                                                    <button onClick={() => handleManageInvoice(inv.id, 'delete')} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-red-600">Excluir</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* --- TAB DOCUMENTOS --- */}
                            {activeDrawerTab === 'docs' && <DocumentsList userId={selectedClient.id} />}

                            {/* --- TAB RISCO --- */}
                            {activeDrawerTab === 'risco' && <RiskAnalysis userId={selectedClient.id} />}

                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Negociação */}
            <Modal isOpen={showNegotiationModal} onClose={() => setShowNegotiationModal(false)}>
                <div className="space-y-4">
                    <h3 className="text-xl font-bold">Renegociar Dívida</h3>
                    <p className="text-sm text-slate-500">Total Selecionado: <strong>R$ {invoices.filter(i => selectedInvoiceIds.has(i.id)).reduce((a,b)=>a+b.amount,0).toLocaleString()}</strong></p>
                    
                    <div>
                        <label className="text-xs font-bold">Parcelas</label>
                        <input type="number" value={negotiationData.installments} onChange={e => setNegotiationData({...negotiationData, installments: parseInt(e.target.value)})} className="w-full p-2 border rounded" min="1" />
                    </div>
                    <div>
                        <label className="text-xs font-bold">Data 1ª Parcela</label>
                        <input type="date" value={negotiationData.firstDueDate} onChange={e => setNegotiationData({...negotiationData, firstDueDate: e.target.value})} className="w-full p-2 border rounded" />
                    </div>
                    <div>
                        <label className="text-xs font-bold">Observações</label>
                        <textarea value={negotiationData.notes} onChange={e => setNegotiationData({...negotiationData, notes: e.target.value})} className="w-full p-2 border rounded" rows={3}></textarea>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800">
                        ⚠️ Ao confirmar, um contrato jurídico será gerado e o cliente deverá assinar digitalmente no aplicativo para validar o acordo.
                    </div>

                    <button onClick={handleNegotiateSubmit} disabled={isNegotiating} className="w-full py-3 bg-indigo-600 text-white rounded font-bold">
                        {isNegotiating ? <LoadingSpinner /> : 'Enviar Proposta e Gerar Contrato'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default ClientsTab;
