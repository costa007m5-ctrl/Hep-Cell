import React, { useState, useEffect } from 'react';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';

interface Transaction {
    id: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    created_at: string;
}

const WalletView: React.FC<{ userId: string; balance: number }> = ({ userId, balance }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            setLoading(true);
            try {
                const { data } = await supabase
                    .from('coin_transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                setTransactions(data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, [userId]);

    const brlValue = balance / 100;

    return (
        <div className="space-y-6 animate-fade-in p-1">
            {/* Card de Saldo */}
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-[2rem] p-8 text-slate-900 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-yellow-400 flex items-center justify-center text-[10px] font-black">RC</span>
                        <p className="text-xs font-black uppercase tracking-widest opacity-80">Saldo Disponível</p>
                    </div>
                    <h2 className="text-5xl font-black tracking-tighter mb-2">{balance} <span className="text-xl">Coins</span></h2>
                    <div className="inline-block px-3 py-1 bg-slate-900/10 rounded-full border border-slate-900/10">
                        <p className="text-sm font-bold">≈ R$ {brlValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    <span className="font-bold">Como funciona?</span> Cada 100 Relp Coins valem R$ 1,00 de desconto em qualquer compra na loja ou pagamento de fatura.
                </p>
            </div>

            {/* Histórico */}
            <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Extrato de Moedas</h3>
                {loading ? (
                    <div className="py-10 flex justify-center"><LoadingSpinner /></div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-slate-400 text-sm">Nenhuma movimentação ainda.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {transactions.map(t => (
                            <div key={t.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${t.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {t.type === 'credit' ? '↓' : '↑'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white">{t.description}</p>
                                        <p className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                                <span className={`font-black ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                    {t.type === 'credit' ? '+' : '-'}{t.amount}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WalletView;