
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { supabase } from '../services/clients';
import { useToast } from './Toast';

const ClientsTab: React.FC = () => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToast();
    
    const [selectedClient, setSelectedClient] = useState<Profile | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'dados' | 'financeiro' | 'negociacao'>('dados');
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [pRes, iRes] = await Promise.all([
                fetch('/api/admin/profiles'),
                fetch('/api/admin/invoices')
            ]);
            
            const pData = await pRes.json();
            const iData = await iRes.json();

            setProfiles(Array.isArray(pData) ? pData : []);
            setInvoices(Array.isArray(iData) ? iData : []);
        } catch (e: any) {
            setError("Falha ao carregar dados dos clientes.");
            addToast("Erro ao conectar com o servidor.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered = useMemo(() => {
        if (!Array.isArray(profiles)) return [];
        return profiles.filter(p => {
            const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
            const email = (p.email || '').toLowerCase();
            const cpf = (p.identification_number || '');
            const search = searchTerm.toLowerCase();
            return name.includes(search) || email.includes(search) || cpf.includes(search);
        });
    }, [profiles, searchTerm]);

    const handleUpdate = async () => {
        if (!selectedClient) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('profiles').update({
                first_name: selectedClient.first_name,
                last_name: selectedClient.last_name,
                credit_limit: selectedClient.credit_limit,
                credit_score: selectedClient.credit_score,
                credit_status: selectedClient.credit_status,
                identification_number: selectedClient.identification_number
            }).eq('id', selectedClient.id);

            if (error) throw error;
            addToast("Dados salvos com sucesso!", "success");
            loadData();
        } catch (e: any) {
            addToast("Falha ao salvar: " + e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;
    if (error) return <div className="p-10"><Alert message={error} type="error" /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Clientes CRM</h2>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                    {profiles.length} Cadastrados
                </div>
            </div>

            <div className="relative">
                <input 
                    type="text" placeholder="Pesquisar por nome, CPF ou email..." 
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3.5 top-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Dívida Ativa</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-10 text-center text-slate-400 text-sm italic">Nenhum cliente encontrado.</td>
                            </tr>
                        ) : filtered.map(p => {
                            const debt = Array.isArray(invoices) ? invoices.filter(i => i.user_id === p.id && i.status !== 'Paga').reduce((a, b) => a + b.amount, 0) : 0;
                            return (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition-colors" onClick={() => { setSelectedClient(p); setActiveSubTab('dados'); }}>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-900 dark:text-white">{p.first_name} {p.last_name}</p>
                                        <p className="text-[10px] text-slate-500 font-mono">{p.identification_number || 'Sem CPF'}</p>
                                    </td>
                                    <td className={`px-6 py-4 font-black ${debt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {debt > 0 ? `R$ ${debt.toLocaleString('pt-BR')}` : 'R$ 0,00'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-black text-[10px] uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all">Perfil</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {selectedClient && (
                <div className="fixed inset-0 z-[2000] flex justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedClient(null)}></div>
                    <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white">{selectedClient.first_name} {selectedClient.last_name}</h2>
                                <p className="text-xs text-slate-500">{selectedClient.email}</p>
                            </div>
                            <button onClick={() => setSelectedClient(null)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-red-500 transition-colors">✕</button>
                        </div>

                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1">
                            {['dados', 'financeiro', 'negociacao'].map((t) => (
                                <button key={t} onClick={() => setActiveSubTab(t as any)} className={`flex-1 py-3 text-[10px] font-black uppercase transition-all rounded-lg ${activeSubTab === t ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t === 'dados' ? 'Cadastro' : t === 'financeiro' ? 'Extrato' : 'Notas'}</button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {activeSubTab === 'dados' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Limite Atual (R$)</label>
                                            <input type="number" value={selectedClient.credit_limit || 0} onChange={e => setSelectedClient({...selectedClient, credit_limit: Number(e.target.value)})} className="w-full bg-transparent text-xl font-black text-indigo-600 outline-none" />
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Score Interno</label>
                                            <input type="number" value={selectedClient.credit_score || 0} onChange={e => setSelectedClient({...selectedClient, credit_score: Number(e.target.value)})} className="w-full bg-transparent text-xl font-black text-slate-800 dark:text-white outline-none" />
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Status da Conta</label>
                                        <select value={selectedClient.credit_status || 'Ativo'} onChange={e => setSelectedClient({...selectedClient, credit_status: e.target.value})} className="w-full bg-transparent font-bold text-slate-800 dark:text-white outline-none">
                                            <option value="Ativo">Ativo / Liberado</option>
                                            <option value="Bloqueado">Bloqueado p/ Vendas</option>
                                            <option value="Suspenso">Suspenso (Inadimplente)</option>
                                        </select>
                                    </div>

                                    <button onClick={handleUpdate} disabled={isSaving} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/30 active:scale-95 transition-all disabled:opacity-50">
                                        {isSaving ? 'SALVANDO...' : 'ATUALIZAR CADASTRO'}
                                    </button>
                                </div>
                            )}

                            {activeSubTab === 'financeiro' && (
                                <div className="space-y-4 animate-fade-in">
                                    {invoices.filter(i => i.user_id === selectedClient.id).length === 0 ? (
                                        <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                                            <p className="text-slate-400 text-sm">Nenhuma fatura encontrada.</p>
                                        </div>
                                    ) : (
                                        invoices.filter(i => i.user_id === selectedClient.id).map(inv => (
                                            <div key={inv.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{inv.month}</p>
                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${inv.status === 'Paga' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inv.status}</span>
                                                    <p className="text-base font-black text-indigo-600 mt-1">R$ {inv.amount.toLocaleString('pt-BR')}</p>
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
        </div>
    );
};

export default ClientsTab;
