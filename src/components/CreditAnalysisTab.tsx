import React, { useState, useEffect, useMemo } from 'react';
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

const CreditAnalysisTab: React.FC<CreditAnalysisTabProps> = ({ allInvoices, isLoading, errorInfo, refreshInvoices }) => {
    const [view, setView] = useState<'list' | 'form'>('list');
    const [step, setStep] = useState(1);

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
    const [users, setUsers] = useState<Profile[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(false);

    // Fetch users and products when form is opened
    useEffect(() => {
        if (view === 'form') {
            const fetchFormData = async () => {
                setIsDataLoading(true);
                try {
                    const [usersRes, productsRes] = await Promise.all([
                        fetch('/api/admin/profiles').then(res => res.json()), // Assumes a new simple endpoint
                        fetch('/api/admin/products').then(res => res.json())
                    ]);
                    setUsers(usersRes.data || []);
                    setProducts(productsRes);
                } catch (e) {
                    console.error("Failed to load form data", e);
                } finally {
                    setIsDataLoading(false);
                }
            };
            // Mocking the profiles endpoint for now
            supabase.from('profiles').select('id, email, first_name, last_name, identification_number').then(({ data }) => setUsers(data || []));
            supabase.from('products').select('*').then(({data}) => { setProducts(data || []); setIsDataLoading(false); });
        }
    }, [view]);

    const handleCustomerSelect = (userId: string) => {
        const selectedUser = users.find(u => u.id === userId);
        if (selectedUser) setCustomerData(selectedUser);
    };

    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomerData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleSaleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const numericValue = type === 'number' ? parseFloat(value) : value;
        setSaleData(prev => ({...prev, [name]: numericValue }));

        if (name === 'productId') {
            const product = products.find(p => p.id === value);
            if (product) {
                setSaleData(prev => ({ ...prev, sale_price: product.price, product_name: product.name }));
            }
        }
    };
    
    const financing = useMemo(() => {
        const financedAmount = saleData.sale_price - saleData.down_payment;
        const totalInstallments = saleData.installment_value * saleData.installments_count;
        const totalInterest = totalInstallments - financedAmount;
        return { financedAmount, totalInstallments, totalInterest };
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
                setStep(1);
            }, 3000);
        } catch (err: any) {
             setSubmitMessage({ text: err.message, type: 'error' });
        } finally {
             setIsSubmitting(false);
        }
    };

    const renderSaleForm = () => (
        <div className="p-6 my-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg animate-fade-in space-y-8">
            {isDataLoading && <div className="flex justify-center"><LoadingSpinner/></div>}
            
            {/* STEP 1: CUSTOMER */}
            <section>
                <h3 className="text-xl font-bold mb-4">Passo 1: Identificação do Cliente</h3>
                <div className="space-y-4">
                    <select onChange={(e) => handleCustomerSelect(e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700">
                        <option value="">-- Buscar cliente existente --</option>
                        {users.map(user => <option key={user.id} value={user.id}>{user.email}</option>)}
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

            {/* STEP 2: SALE & FINANCING */}
            <section>
                <h3 className="text-xl font-bold mb-4">Passo 2: Detalhes da Venda e Financiamento</h3>
                <div className="space-y-4">
                     <select name="productId" value={saleData.productId} onChange={handleSaleChange} required className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700">
                        <option value="" disabled>Selecione um produto</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} - {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>)}
                    </select>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Valor da Venda (R$)" name="sale_price" type="number" value={saleData.sale_price} onChange={handleSaleChange} required />
                        <InputField label="Valor da Entrada (R$)" name="down_payment" type="number" value={saleData.down_payment} onChange={handleSaleChange} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Nº de Parcelas" name="installments_count" type="number" min="1" value={saleData.installments_count} onChange={handleSaleChange} required />
                        <InputField label="Valor da Parcela (R$)" name="installment_value" type="number" value={saleData.installment_value} onChange={handleSaleChange} required />
                    </div>
                </div>
            </section>

             {/* STEP 3: SUMMARY & CONFIRMATION */}
            <section>
                <h3 className="text-xl font-bold mb-4">Passo 3: Orçamento e Confirmação</h3>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Valor Financiado:</span> <span className="font-bold">{financing.financedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Total em Parcelas:</span> <span className="font-bold">{financing.totalInstallments.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    <div className="flex justify-between text-red-600 dark:text-red-400"><span >Juros Totais:</span> <span className="font-bold">{financing.totalInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                </div>
            </section>
            
            {submitMessage && <Alert message={submitMessage.text} type={submitMessage.type} />}

            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setView('list')} className="py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                <button type="button" onClick={handleFormSubmit} disabled={isSubmitting} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                    {isSubmitting ? <LoadingSpinner /> : 'Confirmar e Gerar Faturas'}
                </button>
            </div>
        </div>
    );
    
    const renderInvoicesList = () => (
        <>
            <button onClick={() => setView('form')} className="my-4 py-2 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm">
                + Nova Venda / Análise
            </button>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Mês/Parcela</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Valor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">ID do Usuário</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900/50 divide-y divide-slate-200 dark:divide-slate-700">
                        {allInvoices.map(invoice => (
                            <tr key={invoice.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{invoice.month}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ invoice.status === 'Paga' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400' }`}>{invoice.status}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">{invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-mono" title={invoice.user_id}>{invoice.user_id.slice(0, 15)}...</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </>
    );

    if (isLoading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;
    if (errorInfo) return <div className="p-4"><Alert message={errorInfo.message} type="error" /></div>;

    return view === 'form' ? renderSaleForm() : renderInvoicesList();
};

export default CreditAnalysisTab;
