import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { supabase } from '../services/clients';

interface ClientCoin {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    coins_balance: number;
}

const CoinsManagerTab: React.FC = () => {
    const [clients, setClients] = useState<ClientCoin[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<ClientCoin | null>(null);
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase.from('profiles').select('id, first_name, last_name, email, coins_balance');
            if (data) setClients(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchClients(); }, []);

    const filteredClients = clients.filter(c => 
        (c.first_name + ' ' + c.last_name).toLowerCase().includes(search.toLowerCase()) || 
        c.email.toLowerCase().includes(search.toLowerCase())
    );

    const handleUpdateCoins = async (action: 'add' | 'remove' | 'set') => {
        if (!selectedClient || !amount) return;
        setIsProcessing(true);
        setMessage(null);

        try {
            const res = await fetch('/api/admin?action=manage-coins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selectedClient.id, amount: parseInt(amount), action, reason })
            });
            const data = await res.json();
            
            if (res.ok) {
                setMessage({ text: 'Saldo atualizado com sucesso!', type: 'success' });
                // Update local state
                setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, coins_balance: data.newBalance } : c));
                setSelectedClient(prev => prev ? { ...prev, coins_balance: data.newBalance } : null);
                setAmount('');
                setReason('');
            } else {
                throw new Error(data.error);
            }
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Gestão de Relp Coins</h2>
            
            <div className="flex gap-4">
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col h-[500px]">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                        <input 
                            type="text" 
                            placeholder="Buscar cliente..." 
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {isLoading ? <LoadingSpinner /> : filteredClients.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => { setSelectedClient(c); setMessage(null); }}
                                className={`w-full text-left p-3 rounded-xl transition-all ${selectedClient?.id === c.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-sm truncate">{c.first_name} {c.last_name}</span>
                                    <span className={`text-xs font-black px-2 py-0.5 rounded ${selectedClient?.id === c.id ? 'bg-white/20' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {c.coins_balance} RC
                                    </span>
                                </div>
                                <span className={`text-xs block truncate ${selectedClient?.id === c.id ? 'text-indigo-200' : 'text-slate-400'}`}>{c.email}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 flex flex-col justify-center">
                    {selectedClient ? (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center text-yellow-900 font-black text-2xl mx-auto mb-4 border-4 border-yellow-200 shadow-lg">
                                    {selectedClient.coins_balance}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedClient.first_name} {selectedClient.last_name}</h3>
                                <p className="text-sm text-slate-500">Saldo Atual</p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase">Quantidade</label>
                                <input 
                                    type="number" 
                                    value={amount} onChange={e => setAmount(e.target.value)}
                                    className="w-full p-4 text-center text-2xl font-black bg-slate-50 dark:bg-slate-900 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="0"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <button onClick={() => handleUpdateCoins('add')} disabled={isProcessing} className="py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl active:scale-95 transition-all">Adicionar</button>
                                <button onClick={() => handleUpdateCoins('remove')} disabled={isProcessing} className="py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl active:scale-95 transition-all">Remover</button>
                                <button onClick={() => handleUpdateCoins('set')} disabled={isProcessing} className="py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all">Definir</button>
                            </div>

                            {message && <Alert message={message.text} type={message.type} />}
                        </div>
                    ) : (
                        <div className="text-center text-slate-400">
                            <p>Selecione um cliente para gerenciar o saldo.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoinsManagerTab;