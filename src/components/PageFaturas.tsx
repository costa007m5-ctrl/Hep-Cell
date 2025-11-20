import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Invoice } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { diagnoseDatabaseError } from '../services/geminiService';

// Importa os componentes de fluxo de pagamento
import PaymentMethodSelector from './PaymentMethodSelector';
import PaymentForm from './PaymentForm';
import PixPayment from './PixPayment';
import BoletoPayment from './BoletoPayment';
import BoletoDetails from './BoletoDetails';

type PaymentStep = 'list' | 'select_method' | 'pay_card' | 'pay_pix' | 'pay_boleto' | 'boleto_details' | 'redirecting';

interface PageFaturasProps {
    mpPublicKey: string;
}

interface ErrorInfo {
    message: string;
    diagnosis?: string;
    isDiagnosing: boolean;
}

// Componente para exibir grupos de faturas (por produto)
const InvoiceGroup: React.FC<{ 
    groupName: string; 
    invoices: Invoice[]; 
    onPay: (invoice: Invoice) => void; 
    onDetails: (invoice: Invoice) => void 
}> = ({ groupName, invoices, onPay, onDetails }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    // Ordena: Em aberto primeiro, depois por data
    const sortedInvoices = [...invoices].sort((a, b) => {
        if (a.status === 'Em aberto' && b.status !== 'Em aberto') return -1;
        if (a.status !== 'Em aberto' && b.status === 'Em aberto') return 1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    const totalAmount = sortedInvoices.reduce((acc, inv) => acc + inv.amount, 0);
    const pendingCount = sortedInvoices.filter(i => i.status === 'Em aberto' || i.status === 'Boleto Gerado').length;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-3 text-left">
                     <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                     </div>
                     <div>
                         <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">{groupName}</h3>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Total: {totalAmount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                     </div>
                </div>
                <div className="flex items-center gap-3">
                    {pendingCount > 0 ? (
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-bold rounded-full">
                            {pendingCount} pendentes
                        </span>
                    ) : (
                         <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-bold rounded-full">
                            Concluído
                        </span>
                    )}
                     <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>
            
            {isExpanded && (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {sortedInvoices.map(invoice => {
                         const discountInfo = invoice.status === 'Em aberto' ? getDiscountInfo(invoice.due_date, invoice.amount) : null;
                         return (
                            <InvoiceItem 
                                key={invoice.id} 
                                invoice={invoice} 
                                onPay={onPay} 
                                onDetails={onDetails} 
                                discountInfo={discountInfo}
                                showProductName={false} // Já estamos dentro do grupo do produto
                            />
                         );
                    })}
                </div>
            )}
        </div>
    );
};

// Helper para calcular desconto
const getDiscountInfo = (dueDateString: string, originalAmount: number) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dueDateString + 'T00:00:00');
  if (isNaN(dueDate.getTime())) return null;
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return null;
  const MAX_DISCOUNT_PERCENTAGE = 15;
  const MAX_DISCOUNT_DAYS = 30;
  const effectiveDays = Math.min(diffDays, MAX_DISCOUNT_DAYS);
  const discountPercentage = (effectiveDays / MAX_DISCOUNT_DAYS) * MAX_DISCOUNT_PERCENTAGE;
  if (discountPercentage <= 0) return null;
  const discountValue = (originalAmount * discountPercentage) / 100;
  const roundedDiscountValue = Math.round(discountValue * 100) / 100;
  const discountedAmount = originalAmount - roundedDiscountValue;
  return { discountedAmount, discountValue: roundedDiscountValue, discountPercentage };
};

const InvoiceIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>);
const CheckIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const ClockIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const statusConfig = { 'Paga': { icon: <CheckIcon />, bgColor: 'bg-green-100 dark:bg-green-900/40', textColor: 'text-slate-700 dark:text-slate-300', label: 'Pago' }, 'Em aberto': { icon: <InvoiceIcon />, bgColor: 'bg-orange-100 dark:bg-orange-900/40', textColor: 'text-orange-600 dark:text-orange-400', label: '' }, 'Boleto Gerado': { icon: <ClockIcon />, bgColor: 'bg-blue-100 dark:bg-blue-900/40', textColor: 'text-blue-600 dark:text-blue-400', label: 'Aguardando Pagamento' }, 'Expirado': { icon: <InvoiceIcon />, bgColor: 'bg-red-100 dark:bg-red-900/40', textColor: 'text-red-600 dark:text-red-400', label: 'Expirado' }, 'Cancelado': { icon: <InvoiceIcon />, bgColor: 'bg-red-100 dark:bg-red-900/40', textColor: 'text-red-600 dark:text-red-400', label: 'Cancelado' } };

const InvoiceItem: React.FC<{ invoice: Invoice; onPay?: (invoice: Invoice) => void; onDetails?: (invoice: Invoice) => void; discountInfo: ReturnType<typeof getDiscountInfo> | null; showProductName?: boolean }> = ({ invoice, onPay, onDetails, discountInfo, showProductName = true }) => {
    const config = statusConfig[invoice.status] || statusConfig['Em aberto'];
    const formattedDueDate = new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR');
    
    // Se showProductName for false, tentamos mostrar apenas a parcela "1/5"
    let displayText = invoice.month;
    if (!showProductName) {
         const parts = invoice.month.match(/\(\d+\/\d+\)/);
         if (parts) displayText = `Parcela ${parts[0]}`;
         else displayText = invoice.month;
    }

    return (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-200">
            <div className="flex items-center space-x-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor} scale-90`}>{config.icon}</div>
                <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{displayText}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{invoice.status === 'Em aberto' ? `Vence em ${formattedDueDate}` : config.label}</p>
                </div>
            </div>
            <div className="text-right">
                {discountInfo && invoice.status === 'Em aberto' ? (<><p className="font-semibold text-green-600 dark:text-green-400 text-sm">{discountInfo.discountedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p><p className="text-xs text-slate-500 dark:text-slate-400 line-through">{invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></>) : (<p className={`font-semibold ${config.textColor} text-sm`}>{invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>)}
                {invoice.status === 'Em aberto' && onPay && (<button onClick={() => onPay(invoice)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none mt-1">{discountInfo ? (<span className="flex items-center justify-end gap-1"><span>Antecipar</span><span className="font-bold bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 px-1.5 py-0.5 rounded-full text-[10px]">-{discountInfo.discountPercentage.toFixed(0)}%</span></span>) : 'Pagar'}</button>)}
                {invoice.status === 'Boleto Gerado' && onDetails && (<button onClick={() => onDetails(invoice)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none mt-1">Ver Boleto</button>)}
            </div>
        </div>
    );
};


const PageFaturas: React.FC<PageFaturasProps> = ({ mpPublicKey }) => {
    const [paymentStep, setPaymentStep] = useState<PaymentStep>('list');
    const [selectedInvoice, setSelectedInvoice] = useState<(Invoice & { originalAmount?: number; discountValue?: number; }) | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
    
    // Estado para armazenar os grupos
    const [groupedInvoices, setGroupedInvoices] = useState<Record<string, Invoice[]>>({});

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true); setErrorInfo(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado.');
            const { data, error: dbError } = await supabase.from('invoices').select('*').eq('user_id', user.id).order('due_date', { ascending: false });
            if (dbError) throw dbError;
            
            const fetchedInvoices = data || [];
            setInvoices(fetchedInvoices);
            
            // Lógica de agrupamento
            const groups: Record<string, Invoice[]> = {};
            fetchedInvoices.forEach(inv => {
                // Tenta extrair o nome do produto do campo 'month' (ex: "iPhone 15 (1/5)")
                // Regex pega tudo antes do primeiro parêntese "("
                let groupName = inv.month.split('(')[0].trim();
                if (!groupName) groupName = 'Outros';
                
                if (!groups[groupName]) {
                    groups[groupName] = [];
                }
                groups[groupName].push(inv);
            });
            setGroupedInvoices(groups);

        } catch (err: any) {
            const errorMessage = err.message || 'Ocorreu um erro desconhecido.';
            setErrorInfo({ message: `Falha ao carregar as faturas: ${errorMessage}`, isDiagnosing: true });
            diagnoseDatabaseError(errorMessage).then(diagnosis => setErrorInfo(prev => prev ? { ...prev, diagnosis, isDiagnosing: false } : null));
        } finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const handlePayClick = (invoice: Invoice) => {
        const discountInfo = getDiscountInfo(invoice.due_date, invoice.amount);
        const invoiceToPay = { ...invoice, amount: discountInfo ? discountInfo.discountedAmount : invoice.amount, originalAmount: invoice.amount, discountValue: discountInfo ? discountInfo.discountValue : 0 };
        setSelectedInvoice(invoiceToPay);
        setPaymentStep('select_method');
    };

    const handleSelectMethod = async (method: string) => {
        if (!selectedInvoice) return;
        if (method === 'brick') setPaymentStep('pay_card');
        else if (method === 'pix') setPaymentStep('pay_pix');
        else if (method === 'boleto') setPaymentStep('pay_boleto');
        else if (method === 'redirect') {
            setPaymentStep('redirecting');
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const response = await fetch('/api/mercadopago/create-preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedInvoice.id, description: `Fatura Relp Cell - ${selectedInvoice.month}`, amount: selectedInvoice.amount, redirect: true, payerEmail: user?.email }) });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                window.location.href = data.init_point;
            } catch (err) { setErrorInfo({ message: 'Não foi possível redirecionar para o pagamento.', isDiagnosing: false }); setPaymentStep('select_method'); }
        }
    };
    
    const handleBoletoGenerated = (updatedInvoice: Invoice) => {
        setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
        setSelectedInvoice(updatedInvoice);
        setPaymentStep('boleto_details');
    };

    const handleBackToList = () => {
        setSelectedInvoice(null);
        setPaymentStep('list');
        fetchInvoices();
    };

    const handlePaymentSuccess = useCallback(async (paymentId: string | number) => {
        if (selectedInvoice) {
            const { error: updateError } = await supabase.from('invoices').update({ status: 'Paga', payment_id: String(paymentId), payment_date: new Date().toISOString() }).eq('id', selectedInvoice.id);
            if (updateError) setErrorInfo({ message: 'Houve um erro ao atualizar o status do pagamento.', isDiagnosing: false });
        }
        handleBackToList();
    }, [selectedInvoice]);
    
    // RENDERIZAÇÃO CONDICIONAL DO FLUXO DE PAGAMENTO
    if (paymentStep !== 'list') {
        switch (paymentStep) {
            case 'select_method': return <PaymentMethodSelector invoice={selectedInvoice!} onSelectMethod={handleSelectMethod} onBack={handleBackToList} />;
            case 'pay_card': return <PaymentForm invoice={selectedInvoice!} mpPublicKey={mpPublicKey} onBack={() => setPaymentStep('select_method')} onPaymentSuccess={handlePaymentSuccess} />;
            case 'pay_pix': return <PixPayment invoice={selectedInvoice!} onBack={() => setPaymentStep('select_method')} onPaymentConfirmed={handleBackToList} />;
            case 'pay_boleto': return <BoletoPayment invoice={selectedInvoice!} onBack={() => setPaymentStep('select_method')} onBoletoGenerated={handleBoletoGenerated} />;
            case 'boleto_details': return <BoletoDetails invoice={selectedInvoice!} onBack={handleBackToList} />;
            case 'redirecting': return <div className="w-full max-w-md flex flex-col items-center justify-center space-y-4 p-8"><LoadingSpinner /><p className="text-slate-500 dark:text-slate-400">Redirecionando para o Mercado Pago...</p></div>;
            default: setPaymentStep('list'); return null;
        }
    }
    
    // RENDERIZAÇÃO PADRÃO (LISTA DE FATURAS)
    if (isLoading) return <div className="w-full max-w-md flex flex-col items-center justify-center space-y-4 p-8"><LoadingSpinner /><p className="text-slate-500 dark:text-slate-400">Carregando faturas...</p></div>;
    if (errorInfo) return (
        <div className="w-full max-w-md p-4 space-y-4 animate-fade-in">
            <Alert message={errorInfo.message} type="error" />
            <button onClick={fetchInvoices} className="w-full text-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Tentar Novamente</button>
        </div>
    );

    const totalDue = invoices.filter(i => i.status === 'Em aberto').reduce((sum, inv) => sum + inv.amount, 0);

    return (
        <div className="w-full max-w-md space-y-6 animate-fade-in">
            <section aria-labelledby="summary-title">
                 <h2 id="summary-title" className="sr-only">Resumo das Faturas</h2>
                {totalDue > 0 ? (
                     <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 text-center">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total em aberto</p>
                        <p className="text-4xl font-bold text-slate-900 dark:text-white mt-2">{totalDue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                ) : (
                    <div className="bg-green-50 dark:bg-green-900/30 rounded-2xl shadow-lg p-6 flex items-center space-x-4">
                         <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                        <div><h3 className="text-lg font-bold text-green-900 dark:text-green-200">Você está em dia!</h3><p className="text-sm text-green-700 dark:text-green-300">Nenhuma fatura pendente no momento.</p></div>
                    </div>
                )}
            </section>
            
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 px-1">Minhas Compras</h2>
                {Object.entries(groupedInvoices).length > 0 ? (
                    Object.entries(groupedInvoices).map(([groupName, invoices]) => (
                        <InvoiceGroup 
                            key={groupName} 
                            groupName={groupName} 
                            invoices={invoices} 
                            onPay={handlePayClick} 
                            onDetails={(inv) => { setSelectedInvoice(inv); setPaymentStep('boleto_details'); }} 
                        />
                    ))
                ) : (
                    <p className="text-center text-slate-500 py-8">Nenhuma fatura encontrada.</p>
                )}
            </section>
        </div>
    );
};

export default PageFaturas;