
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { supabase } from '../services/clients';
import { useToast } from './Toast';

interface EnhancedProfile extends Profile {
    totalDebt: number;
    riskLevel: 'Baixo' | 'Médio' | 'Alto';
}

const ClientsTab: React.FC = () => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]); 
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { addToast } = useToast();
    
    // Detalhes do Cliente Selecionado
    const [selectedClient, setSelectedClient] = useState<EnhancedProfile | null>(null);
    const [activeTab, setActiveTab] = useState<'dados' | 'financeiro' | 'negociacoes'>('dados');
    const [isSaving, setIsSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setIsDataLoading(true);
        try {
            const [pRes, iRes] = await Promise.all([
                fetch('/api/admin/profiles'),
                fetch('/api/admin/invoices')
            ]);
            const pData = await pRes.json();
            const iData = await iRes.json();
            setProfiles(Array.isArray(pData) ? pData : []);
            setInvoices(Array.isArray(iData) ? iData : []);
        } catch (e) {
            setErrorMsg("Erro ao carregar dados do CRM.");
        } finally {
            setIsDataLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const processedProfiles = useMemo(() => {
        return profiles.map(p => {
            const userInvoices = invoices.filter(inv => inv.user_id === p.id && inv.status !== 'Paga');
            const totalDebt = userInvoices.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
            return { ...p, totalDebt, riskLevel: totalDebt > 1000 ? 'Alto' : totalDebt > 0 ? 'Médio' : 'Baixo' } as EnhancedProfile;
        }).filter(p => 
            (p.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (p.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.identification_number || '').includes(searchTerm)
        );
    }, [profiles, invoices, searchTerm]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('profiles').upsert(selectedClient);
            if (error) throw error;
            addToast("Cadastro atualizado!", "success");
            fetchData();
        } catch (e) { addToast("Erro ao salvar.", "error"); }
        finally { setIsSaving(false); }
    };

    const handleInvoiceAction = async (invoiceId: string, action: 'pay' | 'delete') => {
        if (action === 'delete' && !confirm("Apagar fatura permanentemente?")) return;
        try {
            const endpoint = action === 'pay' ? '/api/admin/pay-invoice' : '/api/admin/delete-invoice';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId })
            });
            if (res.ok) {
                addToast(action === 'pay' ? "Fatura baixada!" : "Fatura removida!", "success");
                fetchData();
            }
        } catch (e) { addToast("Erro na operação.", "error"); }
    };

    if (isDataLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1">
                    <input 
                        type="text" placeholder="Buscar cliente por nome, email ou CPF..." 
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Dívida</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {processedProfiles.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer" onClick={() => setSelectedClient(p)}>
                                <td className="px-6 py-4">
                                    <p className="font-bold text-slate-900 dark:text-white">{p.first_name} {p.last_name}</p>
                                    <p className="text-xs text-slate-500">{p.email}</p>
                                </td>
                                <td className="px-6 py-4 font-bold text-red-600">R$ {p.totalDebt.toLocaleString('pt-BR')}</td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-indigo-600 font-bold text-xs uppercase">Gerenciar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* PAINEL LATERAL DE DETALHES (DRAWER) */}
            {selectedClient && (
                <div className="fixed inset-0 z-[2000] flex justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedClient(null)}></div>
                    <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white">{selectedClient.first_name} {selectedClient.last_name}</h2>
                                <p className="text-xs text-slate-500">ID: {selectedClient.id}</p>
                            </div>
                            <button onClick={() => setSelectedClient(null)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">✕</button>
                        </div>

                        <div className="flex bg-slate-50 dark:bg-slate-800 p-1">
                            {['dados', 'financeiro', 'negociacoes'].map((t: any) => (
                                <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 text-xs font-black uppercase transition-all ${activeTab === t ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {activeTab === 'dados' && (
                                <form onSubmit={handleUpdateProfile} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Limite (R$)</label><input type="number" value={selectedClient.credit_limit || 0} onChange={e => setSelectedClient({...selectedClient, credit_limit: Number(e.target.value)})} className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-800" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Score</label><input type="number" value={selectedClient.credit_score || 0} onChange={e => setSelectedClient({...selectedClient, credit_score: Number(e.target.value)})} className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-800" /></div>
                                    </div>
                                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">CPF</label><input type="text" value={selectedClient.identification_number || ''} onChange={e => setSelectedClient({...selectedClient, identification_number: e.target.value})} className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-800" /></div>
                                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Status de Crédito</label>
                                        <select value={selectedClient.credit_status || 'Ativo'} onChange={e => setSelectedClient({...selectedClient, credit_status: e.target.value})} className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-800">
                                            <option value="Ativo">Ativo</option>
                                            <option value="Bloqueado">Bloqueado</option>
                                            <option value="Suspenso">Suspenso</option>
                                        </select>
                                    </div>
                                    <button type="submit" disabled={isSaving} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">{isSaving ? 'Salvando...' : 'Atualizar Cadastro'}</button>
                                </form>
                            )}

                            {activeTab === 'financeiro' && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-500 uppercase text-xs">Faturas Em Aberto</h4>
                                    {invoices.filter(inv => inv.user_id === selectedClient.id && inv.status !== 'Paga').map(inv => (
                                        <div key={inv.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm">{inv.month}</p>
                                                <p className="text-[10px] text-slate-500">Venc: {new Date(inv.due_date).toLocaleDateString()}</p>
                                                <p className="text-sm font-black text-indigo-600">R$ {inv.amount.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleInvoiceAction(inv.id, 'pay')} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors" title="Marcar como Paga">✓</button>
                                                <button onClick={() => handleInvoiceAction(inv.id, 'delete')} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors" title="Apagar Conta">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'negociacoes' && (
                                <div className="space-y-4">
                                    <p className="text-slate-500 text-sm">Histórico de cobrança e acordos aparecerão aqui.</p>
                                    <textarea className="w-full p-4 rounded-xl border bg-slate-50 dark:bg-slate-800 text-sm" placeholder="Adicionar nota de cobrança ou negociação..." rows={4}></textarea>
                                    <button className="w-full py-2 bg-slate-800 text-white font-bold rounded-lg text-sm">Salvar Anotação</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsTab;
