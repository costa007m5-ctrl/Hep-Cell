
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
    const { addToast } = useToast();
    
    // States do Gerenciamento
    const [selectedClient, setSelectedClient] = useState<Profile | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'dados' | 'financeiro' | 'negociacao'>('dados');
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [pRes, iRes] = await Promise.all([
                fetch('/api/admin/profiles'),
                fetch('/api/admin/invoices')
            ]);
            if (!pRes.ok || !iRes.ok) throw new Error();
            setProfiles(await pRes.json());
            setInvoices(await iRes.json());
        } catch (e) {
            addToast("Erro ao carregar banco de dados.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered = useMemo(() => {
        return profiles.filter(p => 
            (p.first_name + ' ' + p.last_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.identification_number?.includes(searchTerm)
        );
    }, [profiles, searchTerm]);

    const handleUpdate = async () => {
        if (!selectedClient) return;
        setIsSaving(true);
        const { error } = await supabase.from('profiles').update({
            first_name: selectedClient.first_name,
            last_name: selectedClient.last_name,
            credit_limit: selectedClient.credit_limit,
            credit_score: selectedClient.credit_score,
            credit_status: selectedClient.credit_status,
            identification_number: selectedClient.identification_number
        }).eq('id', selectedClient.id);

        if (!error) {
            addToast("Dados salvos com sucesso!", "success");
            loadData();
        } else {
            addToast("Falha ao salvar.", "error");
        }
        setIsSaving(false);
    };

    const handleInvoiceAction = async (id: string, action: 'pay' | 'delete') => {
        if (action === 'delete' && !confirm("Apagar fatura permanentemente?")) return;
        try {
            const endpoint = action === 'pay' ? '/api/admin/pay-invoice' : '/api/admin/delete-invoice';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId: id })
            });
            if (res.ok) {
                addToast(action === 'pay' ? "Pagamento baixado!" : "Fatura removida!", "success");
                loadData();
            }
        } catch (e) { addToast("Erro na operação.", "error"); }
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="relative">
                <input 
                    type="text" placeholder="Pesquisar por nome, CPF ou email..." 
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Dívida</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {filtered.map(p => {
                            const debt = invoices.filter(i => i.user_id === p.id && i.status !== 'Paga').reduce((a, b) => a + b.amount, 0);
                            return (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer" onClick={() => { setSelectedClient(p); setActiveSubTab('dados'); }}>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-900 dark:text-white">{p.first_name} {p.last_name}</p>
                                        <p className="text-[10px] text-slate-500">{p.email}</p>
                                    </td>
                                    <td className={`px-6 py-4 font-black ${debt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                        R$ {debt.toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-indigo-600 font-bold text-[10px] uppercase">Gerenciar</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Painel de Detalhes (Drawer) */}
            {selectedClient && (
                <div className="fixed inset-0 z-[2000] flex justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedClient(null)}></div>
                    <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h2 className="text-xl font-black">{selectedClient.first_name} {selectedClient.last_name}</h2>
                            <button onClick={() => setSelectedClient(null)} className="p-2 text-slate-400 hover:text-red-500">✕</button>
                        </div>

                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1">
                            {['dados', 'financeiro', 'negociacao'].map((t: any) => (
                                <button key={t} onClick={() => setActiveSubTab(t)} className={`flex-1 py-3 text-[10px] font-black uppercase transition-all ${activeSubTab === t ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {activeSubTab === 'dados' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Limite (R$)</label><input type="number" value={selectedClient.credit_limit || 0} onChange={e => setSelectedClient({...selectedClient, credit_limit: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Score</label><input type="number" value={selectedClient.credit_score || 0} onChange={e => setSelectedClient({...selectedClient, credit_score: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl" /></div>
                                    </div>
                                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                                        <select value={selectedClient.credit_status || 'Ativo'} onChange={e => setSelectedClient({...selectedClient, credit_status: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold">
                                            <option value="Ativo">Ativo</option>
                                            <option value="Bloqueado">Bloqueado</option>
                                            <option value="Suspenso">Suspenso</option>
                                        </select>
                                    </div>
                                    <button onClick={handleUpdate} disabled={isSaving} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">
                                        {isSaving ? 'SALVANDO...' : 'ATUALIZAR CADASTRO'}
                                    </button>
                                </div>
                            )}

                            {activeSubTab === 'financeiro' && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Faturas do Cliente</h4>
                                    {invoices.filter(i => i.user_id === selectedClient.id).map(inv => (
                                        <div key={inv.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm">{inv.month}</p>
                                                <p className={`text-[10px] font-bold ${inv.status === 'Paga' ? 'text-green-500' : 'text-red-500'}`}>{inv.status}</p>
                                                <p className="text-sm font-black text-slate-900 dark:text-white">R$ {inv.amount.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {inv.status !== 'Paga' && <button onClick={() => handleInvoiceAction(inv.id, 'pay')} className="p-2 bg-green-100 text-green-700 rounded-lg" title="Pagar">✓</button>}
                                                <button onClick={() => handleInvoiceAction(inv.id, 'delete')} className="p-2 bg-red-100 text-red-700 rounded-lg" title="Apagar">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeSubTab === 'negociacao' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-500">Adicione anotações de cobrança ou detalhes de acordos feitos por telefone/presencial.</p>
                                    <textarea className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-sm h-32" placeholder="Ex: Cliente prometeu pagar dia 10..."></textarea>
                                    <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold">SALVAR NOTA</button>
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
