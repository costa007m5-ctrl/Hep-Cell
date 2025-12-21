
import React, { useState, useEffect, useMemo } from 'react';
import { Invoice, Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { supabase } from '../services/clients';
import { useToast } from './Toast';

interface Negotiation {
    id: string;
    message: string;
    created_at: string;
}

const ClientsTab: React.FC = () => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { addToast } = useToast();
    
    // UI States
    const [selectedClient, setSelectedClient] = useState<Profile | null>(null);
    const [clientInvoices, setClientInvoices] = useState<Invoice[]>([]);
    const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
    const [activeView, setActiveView] = useState<'dados' | 'financeiro' | 'negociacao'>('dados');
    const [newNote, setNewNote] = useState('');

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [pRes, iRes] = await Promise.all([
                fetch('/api/admin/profiles'),
                fetch('/api/admin/invoices')
            ]);
            setProfiles(await pRes.json());
            setInvoices(await iRes.json());
        } catch (e) {
            addToast("Erro ao carregar CRM", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const filteredProfiles = useMemo(() => {
        return profiles.filter(p => 
            (p.first_name + ' ' + p.last_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.identification_number?.includes(searchTerm)
        );
    }, [profiles, searchTerm]);

    const handleOpenDetails = async (client: Profile) => {
        setSelectedClient(client);
        setActiveView('dados');
        setClientInvoices(invoices.filter(inv => inv.user_id === client.id));
        
        const negRes = await fetch(`/api/admin/negotiations?userId=${client.id}`);
        if (negRes.ok) setNegotiations(await negRes.json());
    };

    const handleUpdateClient = async () => {
        if (!selectedClient) return;
        const { error } = await supabase.from('profiles').update({
            first_name: selectedClient.first_name,
            last_name: selectedClient.last_name,
            credit_limit: selectedClient.credit_limit,
            credit_score: selectedClient.credit_score,
            credit_status: selectedClient.credit_status
        }).eq('id', selectedClient.id);

        if (!error) {
            addToast("Cliente atualizado!", "success");
            loadData();
        }
    };

    const handleAction = async (type: 'pay' | 'delete', id: string) => {
        if (type === 'delete' && !confirm("Apagar conta permanentemente?")) return;
        const endpoint = type === 'pay' ? '/api/admin/pay-invoice' : '/api/admin/delete-invoice';
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: id })
        });
        if (res.ok) {
            addToast(type === 'pay' ? "Baixa realizada!" : "Fatura removida!", "success");
            loadData();
            setClientInvoices(prev => prev.filter(i => i.id !== id || (type === 'pay' && i.id === id))); // Atualiza UI local
        }
    };

    const handleAddNegotiation = async () => {
        if (!newNote.trim() || !selectedClient) return;
        const res = await fetch('/api/admin/add-negotiation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: selectedClient.id, message: newNote })
        });
        if (res.ok) {
            setNegotiations([{ id: Date.now().toString(), message: newNote, created_at: new Date().toISOString() }, ...negotiations]);
            setNewNote('');
            addToast("Nota adicionada", "success");
        }
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="relative flex-1 max-w-md">
                    <input 
                        type="text" placeholder="Nome, CPF ou Email..." 
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredProfiles.length} Clientes</div>
            </div>

            <div className="grid gap-4">
                {filteredProfiles.map(p => {
                    const debt = invoices.filter(i => i.user_id === p.id && i.status !== 'Paga').reduce((acc, curr) => acc + curr.amount, 0);
                    return (
                        <div key={p.id} onClick={() => handleOpenDetails(p)} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md cursor-pointer transition-all flex justify-between items-center group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-black text-xl">{p.first_name?.[0]}</div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{p.first_name} {p.last_name}</h3>
                                    <p className="text-xs text-slate-500">{p.email} • {p.identification_number}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Dívida Ativa</p>
                                <p className={`text-lg font-black ${debt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>R$ {debt.toLocaleString('pt-BR')}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal de Detalhes Estilo Drawer */}
            {selectedClient && (
                <div className="fixed inset-0 z-[2000] flex justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedClient(null)}></div>
                    <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-black">{selectedClient.first_name} {selectedClient.last_name}</h2>
                            <button onClick={() => setSelectedClient(null)} className="p-2 text-slate-400">✕</button>
                        </div>

                        <div className="flex bg-slate-50 dark:bg-slate-800 p-1">
                            {['dados', 'financeiro', 'negociacao'].map((v: any) => (
                                <button key={v} onClick={() => setActiveView(v)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${activeView === v ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{v}</button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {activeView === 'dados' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Limite Parcela</label><input type="number" value={selectedClient.credit_limit || 0} onChange={e => setSelectedClient({...selectedClient, credit_limit: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Score Relp</label><input type="number" value={selectedClient.credit_score || 0} onChange={e => setSelectedClient({...selectedClient, credit_score: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                    </div>
                                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Status de Crédito</label>
                                        <select value={selectedClient.credit_status || 'Ativo'} onChange={e => setSelectedClient({...selectedClient, credit_status: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold">
                                            <option value="Ativo">Ativo</option>
                                            <option value="Bloqueado">Bloqueado</option>
                                            <option value="Suspenso">Suspenso</option>
                                        </select>
                                    </div>
                                    <button onClick={handleUpdateClient} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Salvar Alterações</button>
                                </div>
                            )}

                            {activeView === 'financeiro' && (
                                <div className="space-y-4">
                                    {clientInvoices.length === 0 ? <p className="text-center text-slate-400 py-10">Sem faturas registradas.</p> : clientInvoices.map(inv => (
                                        <div key={inv.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm">{inv.month}</p>
                                                <p className="text-[10px] text-slate-500">Venc: {new Date(inv.due_date).toLocaleDateString()}</p>
                                                <p className={`text-xs font-bold ${inv.status === 'Paga' ? 'text-green-500' : 'text-red-500'}`}>{inv.status}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {inv.status !== 'Paga' && <button onClick={() => handleAction('pay', inv.id)} className="p-2 bg-green-100 text-green-700 rounded-lg" title="Baixa Manual">✓</button>}
                                                <button onClick={() => handleAction('delete', inv.id)} className="p-2 bg-red-100 text-red-700 rounded-lg" title="Apagar Conta">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeView === 'negociacao' && (
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Nova anotação ou acordo..." className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" />
                                        <button onClick={handleAddNegotiation} className="px-4 bg-indigo-600 text-white rounded-xl font-bold">Add</button>
                                    </div>
                                    <div className="space-y-3">
                                        {negotiations.map(n => (
                                            <div key={n.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                <p className="text-sm text-slate-800 dark:text-slate-200">{n.message}</p>
                                                <p className="text-[10px] text-slate-400 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
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
