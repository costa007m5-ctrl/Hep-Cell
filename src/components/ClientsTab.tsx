
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Modal from './Modal';

interface ClientsTabProps {
    isLoading?: boolean;
    errorInfo?: { message: string } | null;
    allInvoices?: Invoice[];
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
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'inadimplentes' | 'vip' | 'solicitacoes'>('todos');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null); 
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeDrawerTab, setActiveDrawerTab] = useState<'geral' | 'faturas'>('geral');

    const fetchData = useCallback(async () => {
        setIsDataLoading(true);
        setErrorMsg(null);
        try {
            const [profilesRes, invoicesRes, requestsRes] = await Promise.all([
                fetch('/api/admin/profiles'),
                fetch('/api/admin/invoices'),
                fetch('/api/admin/limit-requests')
            ]);

            const pData = await profilesRes.json();
            const iData = await invoicesRes.json();
            const rData = requestsRes.ok ? await requestsRes.json() : [];

            setProfiles(Array.isArray(pData) ? pData : []);
            setInvoices(Array.isArray(iData) ? iData : []);
            setLimitRequests(Array.isArray(rData) ? rData : []);

        } catch (e: any) {
            console.error("CRM Load Error:", e);
            setErrorMsg("Falha ao conectar com o banco de dados. Tente sincronizar nas Ferramentas Dev.");
        } finally {
            setIsDataLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const enhancedProfiles: EnhancedProfile[] = useMemo(() => {
        if (!Array.isArray(profiles)) return [];
        return profiles.map(profile => {
            const userInvoices = Array.isArray(invoices) ? invoices.filter(inv => inv.user_id === profile.id) : [];
            const totalPaid = userInvoices.filter(inv => inv.status === 'Paga').reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
            const paidCount = userInvoices.filter(inv => inv.status === 'Paga').length;
            const averageTicket = paidCount > 0 ? totalPaid / paidCount : 0;
            const totalDebt = userInvoices.filter(inv => inv.status === 'Em aberto' || inv.status === 'Boleto Gerado').reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
            const limit = profile.credit_limit || 1; 
            const utilizationRate = Math.min(100, (totalDebt / limit) * 100);
            
            let riskLevel: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
            const hasLateInvoices = userInvoices.some(inv => (inv.status === 'Em aberto' || inv.status === 'Boleto Gerado') && new Date(inv.due_date) < new Date());

            if (hasLateInvoices || utilizationRate > 90 || profile.credit_status === 'Bloqueado') riskLevel = 'Alto';
            else if (utilizationRate > 70 || (profile.credit_score || 0) < 500) riskLevel = 'Médio';

            return {
                ...profile, 
                ltv: totalPaid, 
                totalDebt, 
                lastPurchaseDate: null, 
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
            const matchesSearch = (p.first_name || '').toLowerCase().includes(searchLower) || (p.last_name || '').toLowerCase().includes(searchLower) || (p.email || '').toLowerCase().includes(searchLower);
            if (!matchesSearch) return false;
            if (filterStatus === 'inadimplentes') return p.riskLevel === 'Alto';
            if (filterStatus === 'vip') return (p.credit_score || 0) > 800;
            if (filterStatus === 'solicitacoes') return limitRequests.some(r => r.user_id === p.id && r.status === 'pending');
            return true;
        });
    }, [enhancedProfiles, searchTerm, filterStatus, limitRequests]);

    if (isDataLoading) return <div className="flex flex-col items-center justify-center p-20 gap-4"><LoadingSpinner /><p className="text-sm text-slate-500 animate-pulse">Carregando carteira de clientes...</p></div>;
    if (errorMsg) return <div className="p-8"><Alert message={errorMsg} type="error" /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="relative flex-1">
                    <input 
                        type="text" placeholder="Buscar por nome, email ou CPF..." 
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {(['todos', 'inadimplentes', 'solicitacoes'] as const).map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 text-xs font-bold rounded-lg capitalize transition-all ${filterStatus === s ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{s}</button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status/Risco</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Dívida Ativa</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredProfiles.length === 0 ? (
                            <tr><td colSpan={4} className="p-10 text-center text-slate-400">Nenhum cliente encontrado.</td></tr>
                        ) : filteredProfiles.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-slate-900 dark:text-white">{p.first_name} {p.last_name}</p>
                                    <p className="text-xs text-slate-500">{p.email}</p>
                                </td>
                                <td className="px-6 py-4"><RiskBadge level={p.riskLevel} /></td>
                                <td className="px-6 py-4 font-bold text-red-600">R$ {p.totalDebt.toLocaleString('pt-BR')}</td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => { setSelectedClientId(p.id); setIsDrawerOpen(true); }} className="text-indigo-600 font-bold text-xs hover:underline">Ver Detalhes</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Drawer Simples */}
            {isDrawerOpen && selectedClientId && (
                <div className="fixed inset-0 z-[2000] flex justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl p-8 animate-fade-in-right overflow-y-auto">
                        <button onClick={() => setIsDrawerOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900">✕</button>
                        <h2 className="text-2xl font-black mb-6">Ficha do Cliente</h2>
                        {/* Conteúdo do detalhe do cliente aqui */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200">
                             <p className="text-xs text-slate-400 font-bold uppercase">ID do Usuário</p>
                             <p className="text-sm font-mono">{selectedClientId}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsTab;
