import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { Profile, Product } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';

interface NewSaleTabProps {
    onSaleCreated: () => void;
}

const NewSaleTab: React.FC<NewSaleTabProps> = ({ onSaleCreated }) => {
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

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);

    const fetchFormData = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        fetchFormData();
    }, [fetchFormData]);

    const handleCustomerSelect = (userId: string) => {
        const selectedUser = profiles.find(u => u.id === userId);
        if (selectedUser) setCustomerData(selectedUser);
        else setCustomerData({ identification_type: 'CPF' });
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
        const totalPaid = totalInstallments + saleData.down_payment;
        const totalInterest = totalInstallments - financedAmount;
        return { 
            financedAmount: financedAmount > 0 ? financedAmount : 0, 
            totalInstallments, 
            totalPaid,
            totalInterest: totalInterest > 0 ? totalInterest : 0
        };
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
            onSaleCreated();
            setTimeout(() => {
                setSubmitMessage(null);
                setCustomerData({ identification_type: 'CPF' });
                setSaleData({ productId: '', product_name: '', sale_price: 0, down_payment: 0, installments_count: 1, installment_value: 0 });
            }, 3000);
        } catch (err: any) {
             setSubmitMessage({ text: err.message, type: 'error' });
        } finally {
             setIsSubmitting(false);
        }
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        const customerName = `${customerData.first_name || ''} ${customerData.last_name || ''}`;
        const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Logo (SVG simples)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#4F46E5');
        doc.setFontSize(22);
        doc.text("Relp Cell", 14, 22);

        // Informações da Empresa
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor('#334155');
        doc.text("Rua Exemplo, 123 - Centro", 14, 30);
        doc.text("São Paulo, SP - 01000-000", 14, 34);
        doc.text("CNPJ: 00.000.000/0001-00", 14, 38);

        // Título do Orçamento
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("Orçamento de Venda a Prazo", 105, 50, { align: 'center' });
        doc.setLineWidth(0.5);
        doc.line(14, 55, 196, 55);

        // Dados do Cliente
        doc.setFontSize(11);
        doc.text("DADOS DO CLIENTE", 14, 65);
        doc.setFont('helvetica', 'normal');
        doc.text(`Nome: ${customerName}`, 14, 72);
        doc.text(`Email: ${customerData.email || 'Não informado'}`, 14, 77);
        doc.text(`CPF: ${customerData.identification_number || 'Não informado'}`, 14, 82);

        // Detalhes do Orçamento
        doc.setFont('helvetica', 'bold');
        doc.text("DETALHES DO ORÇAMENTO", 14, 95);
        const budgetData = [
            ['Produto', saleData.product_name],
            ['Valor do Produto', formatCurrency(saleData.sale_price)],
            ['Valor da Entrada', formatCurrency(saleData.down_payment)],
            ['Valor Financiado', formatCurrency(financing.financedAmount)],
            ['Condição', `${saleData.installments_count}x de ${formatCurrency(saleData.installment_value)}`],
            ['Total Pago a Prazo', formatCurrency(financing.totalInstallments)],
            ['Juros Totais da Operação', formatCurrency(financing.totalInterest)],
            ['Custo Efetivo Total (CET)', formatCurrency(financing.totalPaid)],
        ];

        let startY = 102;
        budgetData.forEach(([label, value], index) => {
            doc.setFont(index === budgetData.length -1 ? 'helvetica' : 'helvetica', 'normal');
            doc.setTextColor(index === budgetData.length -1 ? '#4F46E5' : '#334155');
            doc.text(`${label}:`, 14, startY);
            doc.setFont('helvetica', 'bold');
            doc.text(value, 80, startY);
            startY += 7;
        });

        // Rodapé
        doc.line(14, startY + 5, 196, startY + 5);
        doc.setFontSize(9);
        doc.setTextColor('#64748B');
        doc.text(`Orçamento gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, startY + 12);
        doc.text(`Válido por 7 dias.`, 14, startY + 16);

        doc.save(`orcamento_${customerName.replace(/\s/g, '_')}.pdf`);
    };

    if (isDataLoading) {
      return <div className="flex justify-center p-8"><LoadingSpinner/></div>
    }

    return (
        <div className="p-4 space-y-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nova Venda / Análise de Crédito</h2>
            
            <section>
                <h3 className="text-xl font-bold mb-2 text-indigo-600 dark:text-indigo-400">Passo 1: Cliente</h3>
                <div className="space-y-4 p-4 border-l-4 border-indigo-500 bg-slate-50 dark:bg-slate-900/50 rounded-r-lg">
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
                <h3 className="text-xl font-bold mb-2 text-indigo-600 dark:text-indigo-400">Passo 2: Venda e Financiamento</h3>
                <div className="space-y-4 p-4 border-l-4 border-indigo-500 bg-slate-50 dark:bg-slate-900/50 rounded-r-lg">
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
                <h3 className="text-xl font-bold mb-2 text-indigo-600 dark:text-indigo-400">Passo 3: Orçamento</h3>
                 <div className="p-4 bg-white dark:bg-slate-800 rounded-lg space-y-2 text-sm border-l-4 border-indigo-500">
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Valor Financiado:</span> <span className="font-semibold">{financing.financedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Total em Parcelas:</span> <span className="font-semibold">{financing.totalInstallments.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    <div className="flex justify-between text-red-600 dark:text-red-400"><span>Juros Totais:</span> <span className="font-semibold">{financing.totalInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200 dark:border-slate-700 mt-2"><span className="text-slate-800 dark:text-slate-100">Custo Total:</span> <span className="text-indigo-600 dark:text-indigo-400">{financing.totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                </div>
            </section>
            
            {submitMessage && <div className="my-4"><Alert message={submitMessage.text} type={submitMessage.type} /></div>}

            <div className="flex flex-col sm:flex-row justify-end items-center space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={generatePDF} className="w-full sm:w-auto py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Gerar Orçamento em PDF
                </button>
                <button type="button" onClick={handleFormSubmit} disabled={isSubmitting} className="w-full sm:w-auto py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                    {isSubmitting ? <LoadingSpinner /> : 'Confirmar e Gerar Faturas'}
                </button>
            </div>
        </div>
    );
};

export default NewSaleTab;