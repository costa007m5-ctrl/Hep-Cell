
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
                                <p className="text-[10px] text-slate-500">Assinado em: {new Date(c.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded">Assinado</span>
                    </div>
                ))}
                {docs.uploads.map((u: any) => (
                    <div key={u.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <span className="text-blue-600">📁</span>
                            <div>
                                <p className="text-sm font-bold">{u.title}</p>
                                <p className="text-[10px] text-slate-500">{new Date(u.created_at).toLocaleDateString()}</p>
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

    return (
        <div className="space-y-4">
            {!analysis ? (
                <div className="text-center py-8">
                    <p className="text-sm text-slate-500 mb-4">Gere um relatório detalhado com Inteligência Artificial sobre o perfil deste cliente.</p>
                    <button onClick={generateReport} disabled={loading} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:scale-105 transition-transform">
                        {loading ? <LoadingSpinner /> : '✨ Gerar Relatório de Inteligência'}
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
                    <button onClick={generateReport} className="text-xs text-indigo-500 underline w-full text-center mt-2">Atualizar Análise</button>
                </div>
            )}
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
    const [activeDrawerTab, setActiveDrawerTab] = useState<'geral' | 'faturas' | 'docs' | 'risco'>('geral');
    
    // Negotiation States
    const [isNegotiationMode, setIsNegotiationMode] = useState(false);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [showNegotiationModal, setShowNegotiationModal] = useState(false);

    // Notes
    const [internalNotes, setInternalNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    // Fetch Data
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
            return true;
        });
    }, [enhancedProfiles, searchTerm, filterStatus]);

    const handleOpenDrawer = (client: EnhancedProfile) => {
        setSelectedClientId(client.id);
        setInternalNotes(client.internal_notes || ''); // Assumindo que essa prop venha do backend
        setIsDrawerOpen(true);
        setIsNegotiationMode(false);
        setSelectedInvoiceIds(new Set());
        setActiveDrawerTab('geral');
    };

    const handleManageInvoice = async (invoiceId: string, action: 'pay' | 'cancel' | 'delete') => {
        if (!confirm(`Tem certeza que deseja ${action === 'pay' ? 'marcar como paga' : action === 'cancel' ? 'cancelar' : 'excluir'} esta fatura?`)) return;
        try {
            const res = await fetch('/api/admin/manage-invoice', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ invoiceId, action })
            });
            if (res.ok) {
                setSuccessMessage('Fatura atualizada com sucesso!');
                setTimeout(() => setSuccessMessage(null), 3000);
                fetchData();
            } else {
                alert('Erro ao atualizar fatura.');
            }
        } catch (e) { console.error(e); }
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

    const selectedClient = enhancedProfiles.find(p => p.id === selectedClientId);
    const selectedClientInvoices = invoices.filter(inv => inv.user_id === selectedClientId);

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
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-1 gap-2">
                    <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none">
                        <option value="todos">Todos</option>
                        <option value="inadimplentes">Inadimplentes</option>
                        <option value="vip">VIP</option>
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
                            {filteredProfiles.map((client) => (
                                <tr key={client.id} onClick={() => handleOpenDrawer(client)} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{client.first_name} {client.last_name}</div>
                                        <div className="text-xs text-slate-500">{client.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-1">
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drawer Detalhes */}
            {isDrawerOpen && selectedClient && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsDrawerOpen(false)}></div>
                    <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right overflow-hidden">
                        
                        {/* Header Drawer */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedClient.first_name} {selectedClient.last_name}</h2>
                                <div className="flex gap-2 mt-1">
                                    <a href={`https://wa.me/55${selectedClient.phone?.replace(/\D/g,'')}?text=Olá ${selectedClient.first_name}, somos da Relp Cell.`} target="_blank" className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold hover:bg-green-200 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                                        WhatsApp
                                    </a>
                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-bold">{selectedClient.identification_number}</span>
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

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* --- TAB GERAL --- */}
                            {activeDrawerTab === 'geral' && (
                                <>
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

                                    <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-200 dark:border-yellow-700">
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

                            {/* --- TAB FATURAS (COM AÇÕES) --- */}
                            {activeDrawerTab === 'faturas' && (
                                <div className="space-y-3">
                                    {selectedClientInvoices.map(inv => (
                                        <div key={inv.id} className="p-3 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-sm">{inv.month}</p>
                                                    <p className="text-xs text-slate-500">Vence: {new Date(inv.due_date).toLocaleDateString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold">R$ {inv.amount}</p>
                                                    <p className={`text-[10px] uppercase font-bold ${inv.status === 'Paga' ? 'text-green-600' : 'text-red-600'}`}>{inv.status}</p>
                                                </div>
                                            </div>
                                            
                                            {inv.status !== 'Paga' && (
                                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                                    <button onClick={() => handleManageInvoice(inv.id, 'pay')} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 font-bold">Pagar</button>
                                                    <button onClick={() => handleManageInvoice(inv.id, 'cancel')} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">Cancelar</button>
                                                    <button onClick={() => handleManageInvoice(inv.id, 'delete')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Excluir</button>
                                                </div>
                                            )}
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
        </div>
    );
};

export default ClientsTab;
