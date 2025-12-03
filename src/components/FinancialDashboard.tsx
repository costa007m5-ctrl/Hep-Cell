
import React, { useMemo, useState, useEffect } from 'react';
import { Invoice } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface FinancialDashboardProps {
  invoices: Invoice[];
  isLoading: boolean;
}

const MetricCard: React.FC<{ title: string; value: string; description?: string }> = ({ title, value, description }) => (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl shadow-md">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        {description && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{description}</p>}
    </div>
);

const FinancialDashboard: React.FC<FinancialDashboardProps> = ({ invoices, isLoading }) => {
    const [interestRate, setInterestRate] = useState<string>('');
    const [negotiationInterest, setNegotiationInterest] = useState<string>('');
    const [minEntryPercentage, setMinEntryPercentage] = useState<string>('');
    const [cashbackPercent, setCashbackPercent] = useState<string>(''); // Novo estado Cashback
    const [isSavingInterest, setIsSavingInterest] = useState(false);
    const [interestMessage, setInterestMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings');
            if (res.ok) {
                const settings = await res.json();
                setInterestRate(settings.interest_rate || '0');
                setNegotiationInterest(settings.negotiation_interest || '15');
                setMinEntryPercentage(settings.min_entry_percentage || '15');
                setCashbackPercent(settings.cashback_percentage || '1.5'); // Default 1.5%
            }
        } catch (e) {
            console.error("Erro ao buscar configurações", e);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSaveSettings = async () => {
        setIsSavingInterest(true);
        setInterestMessage(null);
        try {
            await Promise.all([
                fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'interest_rate', value: interestRate }) }),
                fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'negotiation_interest', value: negotiationInterest }) }),
                fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'min_entry_percentage', value: minEntryPercentage }) }),
                fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'cashback_percentage', value: cashbackPercent }) }) // Salva Cashback
            ]);
            
            setInterestMessage({ text: 'Configurações atualizadas com sucesso!', type: 'success' });
            setTimeout(() => setInterestMessage(null), 3000);
        } catch (e) {
            setInterestMessage({ text: 'Erro ao salvar.', type: 'error' });
        } finally {
            setIsSavingInterest(false);
        }
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const paidInvoices = useMemo(() => invoices.filter(inv => inv.status === 'Paga' && inv.payment_date), [invoices]);
    const openInvoices = useMemo(() => invoices.filter(inv => inv.status === 'Em aberto' || inv.status === 'Boleto Gerado'), [invoices]);

    const financialMetrics = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - now.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const dailyIncome = paidInvoices
            .filter(inv => new Date(inv.payment_date!) >= startOfToday)
            .reduce((sum, inv) => sum + inv.amount, 0);

        const weeklyIncome = paidInvoices
            .filter(inv => new Date(inv.payment_date!) >= startOfWeek)
            .reduce((sum, inv) => sum + inv.amount, 0);

        const monthlyIncome = paidInvoices
            .filter(inv => new Date(inv.payment_date!) >= startOfMonth)
            .reduce((sum, inv) => sum + inv.amount, 0);

        const yearlyIncome = paidInvoices
            .filter(inv => new Date(inv.payment_date!) >= startOfYear)
            .reduce((sum, inv) => sum + inv.amount, 0);

        const projectedRemainingYearly = openInvoices
            .filter(inv => {
                const dueDate = new Date(inv.due_date + 'T00:00:00');
                return dueDate >= now && dueDate.getFullYear() === now.getFullYear();
            })
            .reduce((sum, inv) => sum + inv.amount, 0);
        
        const monthlyProjections = openInvoices.reduce((acc, inv) => {
            const dueDate = new Date(inv.due_date + 'T00:00:00');
            const monthYear = dueDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            acc[monthYear] = (acc[monthYear] || 0) + inv.amount;
            return acc;
        }, {} as Record<string, number>);

        const sortedProjections = Object.entries(monthlyProjections).sort(([keyA], [keyB]) => {
            const dateA = new Date(keyA.split('/').reverse().join('-'));
            const dateB = new Date(keyB.split('/').reverse().join('-'));
            return dateA.getTime() - dateB.getTime();
        });

        return { dailyIncome, weeklyIncome, monthlyIncome, yearlyIncome, projectedRemainingYearly, sortedProjections };
    }, [paidInvoices, openInvoices]);

    if (isLoading) {
        return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
    }

    return (
        <div className="p-4 space-y-8">
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configuração do Sistema</h2>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 max-w-4xl">
                     <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Taxas e Regras</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Juros Venda (% a.m.)</label>
                            <input type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} className="block w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Entrada Mínima (%)</label>
                            <input type="number" step="1" value={minEntryPercentage} onChange={(e) => setMinEntryPercentage(e.target.value)} className="block w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cashback (%)</label>
                            <input type="number" step="0.1" value={cashbackPercent} onChange={(e) => setCashbackPercent(e.target.value)} className="block w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white border-green-300 focus:border-green-500 ring-green-200" placeholder="1.5" />
                            <p className="text-xs text-green-600 mt-1">Devolvido em Coins ao cliente.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Juros Negociação</label>
                            <input type="number" step="0.01" value={negotiationInterest} onChange={(e) => setNegotiationInterest(e.target.value)} className="block w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                        </div>
                     </div>
                     <div className="flex justify-end">
                        <button onClick={handleSaveSettings} disabled={isSavingInterest} className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                            {isSavingInterest ? <LoadingSpinner /> : 'Salvar Configurações'}
                        </button>
                     </div>
                     {interestMessage && <div className="mt-3"><Alert message={interestMessage.text} type={interestMessage.type} /></div>}
                </div>
            </section>
            
            <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Resumo Financeiro</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard title="Faturamento Hoje" value={formatCurrency(financialMetrics.dailyIncome)} />
                    <MetricCard title="Faturamento na Semana" value={formatCurrency(financialMetrics.weeklyIncome)} />
                    <MetricCard title="Faturamento no Mês" value={formatCurrency(financialMetrics.monthlyIncome)} />
                    <MetricCard title="Faturamento Total do Ano" value={formatCurrency(financialMetrics.yearlyIncome)} />
                    <MetricCard title="A Receber no Ano" value={formatCurrency(financialMetrics.projectedRemainingYearly)} description="Valor de faturas em aberto no ano corrente" />
                    <MetricCard title="Faturas Pendentes" value={String(openInvoices.length)} description="Total de faturas em aberto ou com boleto gerado" />
                </div>
            </section>
        </div>
    );
};

export default FinancialDashboard;
