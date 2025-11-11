import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Profile, Product } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';

interface CreditAnalysisTabProps {
    allInvoices: Invoice[];
    isLoading: boolean;
    errorInfo: { message: string } | null;
    refreshInvoices: () => void;
}

// Card de métricas reutilizável
const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl shadow-md flex items-center space-x-4">
        <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
    </div>
);


const CreditAnalysisTab: React.FC<CreditAnalysisTabProps> = ({ allInvoices, isLoading, errorInfo, refreshInvoices }) => {
    const [view, setView] = useState<'list' | 'form'>('list');
    
    // Form states
    const [customerData, setCustomerData] = useState<Partial<Profile>>({ identification_type: 'CPF' });
    const [saleData, setSaleData] = useState({
        productId: '',
        product_name: '',
        sale_price: 0,
        down_payment: 0,
        installments_count: 1,
        installment_value: 0,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Data for forms
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(false);

    // State for accordion
    const [expandedClient, setExpandedClient] = useState<string | null>(null);

    const fetchFormData = useCallback(async () => {
        if (view !== 'form') return;
        setIsDataLoading(true);
        try {
            const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('id, email, first_name, last_name, identification_number');
            if (profilesError) throw profilesError;
            setProfiles(profilesData || []);

            const { data: productsData, error: productsError } = await supabase.from('products').select('*');
            if (productsError) throw productsError;
            setProducts(productsData || []);
        } catch (e: any) {
            console.error("Failed to load form data", e);
            setSubmitMessage({ text: `Erro ao carregar dados: ${e.message}`, type: 'error' });
        } finally {
            setIsDataLoading(false);
        }
    }, [view]);

    useEffect(() => {
        fetchFormData();
    }, [view, fetchFormData]);
    
    // Fetch profiles for the main list view
     useEffect(() => {
        const fetchProfilesForList = async () => {
             const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('id, email, first_name, last_name');
             if (profilesError) console.error("Failed to load profiles for list", profilesError);
             else setProfiles(profilesData || []);
        }
        fetchProfilesForList();
    }, [allInvoices]);


    const handleCustomerSelect = (userId: string) => {
        const selectedUser = profiles.find(u => u.id === userId);
        if (selectedUser) setCustomerData(selectedUser);
    };

    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomerData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleSaleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const numericValue = type === 'number' && value !== '' ? parseFloat(value) : value;
        
        let updatedSaleData = { ...saleData, [name]: numericValue };

        if (name === 'productId') {
            const product = products.find(p => p.id === value);
            if (product) {
                updatedSaleData = { ...updatedSaleData, sale_price: product.price, product_name: product.name };
            }
        }
        setSaleData(updatedSaleData);
    };
    
    const financing = useMemo(() => {
        const financedAmount = saleData.sale_price - saleData.down_payment;
        const totalInstallments = saleData.installment_value * saleData.installments_count;
        const totalInterest = totalInstallments - financedAmount;
        return { financedAmount: financedAmount > 0 ? financedAmount : 0, totalInstallments, totalInterest };
    }, [saleData]);

    const handleFormSubmit = async () => {
        setIsSubmitting(true);
        setSubmitMessage(null);
        try {
            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerData, saleData }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            setSubmitMessage({ text: result.message, type: 'success' });
            setTimeout(() => {
                setView('list');
                refreshInvoices();
                // Reset form states
                setCustomerData({ identification_type: 'CPF' });
                setSaleData({ productId: '', product_name: '', sale_price: 0, down_payment: 0, installments_count: 1, installment_value: 0 });
            }, 3000);
        } catch (err: any) {
             setSubmitMessage({ text: err.message, type: 'error' });
        } finally {
             setIsSubmitting(false);
        }
    };
    
    const groupedByClient = useMemo(() => {
        const groups: { [key: string]: { profile: Partial<Profile>; invoices: Invoice[] } } = {};
        
        allInvoices.forEach(invoice => {
            if (!groups[invoice.user_id]) {
                const profile = profiles.find(p => p.id === invoice.user_id);
                groups[invoice.user_id] = {
                    profile: {
                        id: invoice.user_id,
                        email: profile?.email || 'Email não encontrado',
                        first_name: profile?.first_name,
                        last_name: profile?.last_name,
                    },
                    invoices: []
                };
            }
            groups[invoice.user_id].invoices.push(invoice);
        });

        return Object.values(groups).sort((a, b) => (a.profile.first_name || a.profile.email!).localeCompare(b.profile.first_name || b.profile.email!));
    }, [allInvoices, profiles]);

    const metrics = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const salesToday = allInvoices
            .filter(inv => new Date(inv.created_at) >= startOfToday)
            .reduce((sum, inv) => sum + inv.amount, 0);

        const totalPaid = allInvoices
            .filter(inv => inv.status === 'Paga')
            .reduce((sum, inv) => sum + inv.amount, 0);
            
        return {
            totalClients: groupedByClient.length,
            salesToday,
            totalPaid
        };
    }, [allInvoices, groupedByClient]);

    const renderSaleForm = () => (
        <div className="p-1 sm:p-6 my-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg animate-fade-in space-y-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Nova Venda / Análise de Crédito</h2>
            
            {isDataLoading && <div className="flex justify-center"><LoadingSpinner/></div>}
            
            <section>
                <h3 className="text-xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">Passo 1: Cliente</h3>
                <div className="space-y-4 p-4 border-l-4 border-indigo-500 bg-white dark:bg-slate-800 rounded-r-lg">
                    <select onChange={(e) => handleCustomerSelect(e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700">
                        <option value="">-- Buscar cliente existente --</option>
                        {profiles.map(user => <option key={user.id} value={user.id}>{user.first_name} {user.last_name} ({user.email})</option>)}
                    </select>
                    <p className="text-center text-sm text-slate-500">ou preencha os dados para um novo cliente:</p>
                    <InputField label="Email" name="email" type="email" value={customerData.email || ''} onChange={handleCustomerChange} required />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField label="Nome" name="first_name" value={customerData.first_name || ''} onChange={handleCustomerChange} required />
                        <InputField label="Sobrenome" name="last_name" value={customerData.last_name || ''} onChange={handleCustomerChange} required />
                    </div>
                    <InputField label="CPF" name="identification_number" value={customerData.identification_number || ''} onChange={handleCustomerChange} required />
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">Passo 2: Venda e Financiamento</h3>
                <div className="space-y-4 p-4 border-l-4 border-indigo-500 bg-white dark:bg-slate-800 rounded-r-lg">
                     <select name="productId" value={saleData.productId} onChange={handleSaleChange} required className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700">
                        <option value="" disabled>Selecione um produto</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} - {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>)}
                    </select>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Valor da Venda (R$)" name="sale_price" type="number" step="0.01" value={saleData.sale_price} onChange={handleSaleChange} required />
                        <InputField label="Valor da Entrada (R$)" name="down_payment" type="number" step="0.01" value={saleData.down_payment} onChange={handleSaleChange} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Nº de Parcelas" name="installments_count" type="number" min="1" value={saleData.installments_count} onChange={handleSaleChange} required />
                        <InputField label="Valor da Parcela (R$)" name="installment_value" type="number" step="0.01" value={saleData.installment_value} onChange={handleSaleChange} required />
                    </div>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">Passo 3: Orçamento</h3>
                 <div className="p-4 bg-white dark:bg-slate-800 rounded-lg space-y-2 text-sm border-l-4 border-indigo-500">
                    <div className="flex justify-between"><span className="text-slate-500">Valor Financiado:</span> <span className="font-bold">{financing.financedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Total em Parcelas:</span> <span className="font-bold">{financing.totalInstallments.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    <div className="flex justify-between text-red-600 dark:text-red-400"><span >Juros Totais:</span> <span className="font-bold">{financing.totalInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                </div>
            </section>
            
            {submitMessage && <Alert message={submitMessage.text} type={submitMessage.type} />}

            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setView('list'); setSubmitMessage(null); }} className="py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                <button type="button" onClick={handleFormSubmit} disabled={isSubmitting} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                    {isSubmitting ? <LoadingSpinner /> : 'Confirmar e Gerar Faturas'}
                </button>
            </div>
        </div>
    );
    
    const renderInvoicesList = () => {
        if (isLoading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;
        if (errorInfo) return <div className="p-4"><Alert message={errorInfo.message} type="error" /></div>;

        return (
            <div className="space-y-6">
                <header className="flex flex-col md:flex-row justify-between md:items-center gap-6 p-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow">
                        <MetricCard title="Clientes Totais" value={String(metrics.totalClients)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
                        <MetricCard title="Faturamento Hoje" value={metrics.salesToday.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 6v-1h4v1h-4zm-4 5v-1h4v1h-4z" /></svg>} />
                        <MetricCard title="Total Pago" value={metrics.totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                    </div>
                    <div className="flex-shrink-0 text-center">
                        <button onClick={() => setView('form')} className="w-full md:w-auto py-3 px-6 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm">
                            + Nova Venda / Análise
                        </button>
                    </div>
                </header>

                <div className="space-y-3">
                    {groupedByClient.map(clientGroup => {
                        const totalDue = clientGroup.invoices.filter(i => i.status === 'Em aberto').reduce((sum, i) => sum + i.amount, 0);
                        const isExpanded = expandedClient === clientGroup.profile.id;

                        return (
                            <div key={clientGroup.profile.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                                <button onClick={() => setExpandedClient(isExpanded ? null : clientGroup.profile.id!)} className="w-full flex items-center justify-between p-4 text-left">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-indigo-500 font-bold text-sm">
                                            {clientGroup.profile.first_name?.[0] || 'U'}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-100">{clientGroup.profile.first_name} {clientGroup.profile.last_name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{clientGroup.profile.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Pendente</p>
                                            <p className="font-semibold text-orange-600 dark:text-orange-400 text-right">{totalDue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                         <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </button>
                                {isExpanded && (
                                    <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                                        <table className="min-w-full">
                                             <thead className="sr-only">
                                                <tr><th>Mês/Parcela</th><th>Status</th><th>Valor</th><th>Vencimento</th></tr>
                                            </thead>
                                            <tbody>
                                                {clientGroup.invoices.map(invoice => (
                                                    <tr key={invoice.id}>
                                                        <td className="py-2 pr-4 text-sm font-medium text-slate-900 dark:text-white">{invoice.month}</td>
                                                        <td className="py-2 px-4 text-sm"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ invoice.status === 'Paga' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400' }`}>{invoice.status}</span></td>
                                                        <td className="py-2 px-4 text-sm text-slate-500 dark:text-slate-300 text-right">{invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                        <td className="py-2 pl-4 text-sm text-slate-500 dark:text-slate-400 text-right">Vence: {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    };

    return view === 'form' ? renderSaleForm() : renderInvoicesList();
};

export default CreditAnalysisTab;
