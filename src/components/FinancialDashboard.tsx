
import React, { useMemo, useState, useEffect } from 'react';
import { Invoice } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface FinancialDashboardProps {
  invoices: Invoice[];
  isLoading: boolean;
}

const MetricCard: React.FC<{ title: string; value: string; description?: string; color?: string }> = ({ title, value, description, color = "bg-white dark:bg-slate-800" }) => (
    <div className={`${color} p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-transform hover:scale-[1.02]`}>
        <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{title}</p>
        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
        {description && <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">{description}</p>}
    </div>
);

const FinancialDashboard: React.FC<FinancialDashboardProps> = ({ invoices: propInvoices, isLoading: propLoading }) => {
    // Config States
    const [settings, setSettings] = useState({
        interest_rate: '0',
        negotiation_interest: '15',
        min_entry_percentage: '15',
        cashback_percentage: '1.5'
    });
    
    // Data States
    const [invoices, setInvoices] = useState<Invoice[]>(propInvoices);
    const [loadingData, setLoadingData] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Carrega configurações e dados atualizados
    useEffect(() => {
        const fetchData = async () => {
            setLoadingData(true);
            try {
                const [settingsRes, invRes] = await Promise.all([
                    fetch('/api/admin?action=settings'),
                    fetch('/api/admin/invoices') // Garante que pega faturas atualizadas
                ]);
                
                const settingsData = await settingsRes.json();
                const invData = await invRes.json();

                if (settingsRes.ok) setSettings(prev => ({ ...prev, ...settingsData }));
                if (invRes.ok && Array.isArray(invData)) setInvoices(invData);

            } catch (e) {
                console.error("Erro dashboard", e);
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, []);

    const handleSaveSetting = async (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value })); // Otimistic update
        setIsSaving(true);
        setSaveMessage(null);
        try {
            await fetch('/api/admin?action=settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            setSaveMessage({ text: 'Salvo!', type: 'success' });
            setTimeout(() => setSaveMessage(null), 2000);
        } catch (e) {
            setSaveMessage({ text: 'Erro ao salvar.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const metrics = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const paid = invoices.filter(i => i.status === 'Paga');
        const open = invoices.filter(i => i.status === 'Em aberto' || i.status === 'Boleto Gerado');

        const totalRevenue = paid.reduce((acc, curr) => acc + curr.amount, 0);
        const monthlyRevenue = paid.filter(i => {
            const d = new Date(i.payment_date || i.created_at);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).reduce((acc, curr) => acc + curr.amount, 0);

        const pendingRevenue = open.reduce((acc, curr) => acc + curr.amount, 0);
        const overdueRevenue = open.filter(i => new Date(i.due_date) < now).reduce((acc, curr) => acc + curr.amount, 0);

        return { totalRevenue, monthlyRevenue, pendingRevenue, overdueRevenue };
    }, [invoices]);

    const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (loadingData && propLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <header className="flex justify-between items-end px-2">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Financeiro</h2>
                    <p className="text-slate-500 font-medium text-sm">Visão geral de caixa e configurações</p>
                </div>
                {saveMessage && <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full animate-fade-in">{saveMessage.text}</span>}
            </header>

            {/* DASHBOARD GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                    title="Faturamento Total" 
                    value={formatBRL(metrics.totalRevenue)} 
                    description="Desde o início"
                    color="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900"
                />
                <MetricCard 
                    title="Receita Mês Atual" 
                    value={formatBRL(metrics.monthlyRevenue)} 
                    description="Entradas confirmadas este mês"
                />
                <MetricCard 
                    title="A Receber (Aberto)" 
                    value={formatBRL(metrics.pendingRevenue)} 
                    description="Faturas geradas pendentes"
                />
                <MetricCard 
                    title="Inadimplência" 
                    value={formatBRL(metrics.overdueRevenue)} 
                    description="Faturas vencidas"
                    color="bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900"
                />
            </div>

            {/* CONFIGURAÇÕES DO SISTEMA */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Parâmetros do Sistema</h3>
                        <p className="text-xs text-slate-500 font-medium">As alterações afetam novas vendas imediatamente.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Juros Mensal (%)</label>
                        <div className="relative group">
                            <input 
                                type="number" 
                                value={settings.interest_rate} 
                                onChange={(e) => setSettings({...settings, interest_rate: e.target.value})}
                                onBlur={(e) => handleSaveSetting('interest_rate', e.target.value)}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black text-xl text-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none transition-all"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Entrada Mínima (%)</label>
                        <div className="relative group">
                            <input 
                                type="number" 
                                value={settings.min_entry_percentage} 
                                onChange={(e) => setSettings({...settings, min_entry_percentage: e.target.value})}
                                onBlur={(e) => handleSaveSetting('min_entry_percentage', e.target.value)}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black text-xl text-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none transition-all"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cashback Padrão (%)</label>
                        <div className="relative group">
                            <input 
                                type="number" 
                                value={settings.cashback_percentage} 
                                onChange={(e) => setSettings({...settings, cashback_percentage: e.target.value})}
                                onBlur={(e) => handleSaveSetting('cashback_percentage', e.target.value)}
                                className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl font-black text-xl text-emerald-700 dark:text-emerald-400 border-2 border-transparent focus:border-emerald-500 outline-none transition-all"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">%</span>
                        </div>
                        <p className="text-[10px] text-slate-400 pl-1">Devolvido em Coins ao cliente.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Max Juros Negociação (%)</label>
                        <div className="relative group">
                            <input 
                                type="number" 
                                value={settings.negotiation_interest} 
                                onChange={(e) => setSettings({...settings, negotiation_interest: e.target.value})}
                                onBlur={(e) => handleSaveSetting('negotiation_interest', e.target.value)}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black text-xl text-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none transition-all"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialDashboard;
