import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PaymentForm from './PaymentForm';
import { Invoice } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import PaymentMethodSelector from './PaymentMethodSelector';
import PixPayment from './PixPayment';
import BoletoPayment from './BoletoPayment';
import BoletoDetails from './BoletoDetails';

interface PageFaturasProps {
    mpPublicKey: string;
}

type PaymentStep = 'list' | 'select_method' | 'form' | 'pix' | 'boleto' | 'view_boleto';

// Icons
const InvoiceIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);
const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

// Mapeamento de Status para Componentes Visuais
const statusConfig = {
    'Paga': { icon: <CheckIcon />, bgColor: 'bg-green-100 dark:bg-green-900/40', textColor: 'text-slate-700 dark:text-slate-300', label: 'Pago' },
    'Em aberto': { icon: <InvoiceIcon />, bgColor: 'bg-orange-100 dark:bg-orange-900/40', textColor: 'text-orange-600 dark:text-orange-400', label: '' },
    'Boleto Gerado': { icon: <ClockIcon />, bgColor: 'bg-blue-100 dark:bg-blue-900/40', textColor: 'text-blue-600 dark:text-blue-400', label: 'Aguardando Pagamento' },
    'Expirado': { icon: <InvoiceIcon />, bgColor: 'bg-red-100 dark:bg-red-900/40', textColor: 'text-red-600 dark:text-red-400', label: 'Expirado' },
    'Cancelado': { icon: <InvoiceIcon />, bgColor: 'bg-red-100 dark:bg-red-900/40', textColor: 'text-red-600 dark:text-red-400', label: 'Cancelado' },
};

// InvoiceItem Component
const InvoiceItem: React.FC<{ invoice: Invoice; onPay?: (invoice: Invoice) => void; onViewBoleto?: (invoice: Invoice) => void; }> = ({ invoice, onPay, onViewBoleto }) => {
    const config = statusConfig[invoice.status] || statusConfig['Em aberto'];
    const formattedDueDate = new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR');

    return (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-200">
            <div className="flex items-center space-x-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${config.bgColor}`}>
                    {config.icon}
                </div>
                <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{invoice.month}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {invoice.status === 'Em aberto' ? `Vence em ${formattedDueDate}` : config.label}
                    </p>
                </div>
            </div>
            <div className="text-right">
                 <p className={`font-semibold ${config.textColor}`}>
                    {invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                {invoice.status === 'Em aberto' && onPay && (
                    <button onClick={() => onPay(invoice)} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none">
                        Pagar
                    </button>
                )}
                 {invoice.status === 'Boleto Gerado' && onViewBoleto && (
                    <button onClick={() => onViewBoleto(invoice)} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none">
                        Ver Boleto
                    </button>
                )}
            </div>
        </div>
    );
};

const PageFaturas: React.FC<PageFaturasProps> = ({ mpPublicKey }) => {
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [paymentStep, setPaymentStep] = useState<PaymentStep>('list');
    const [isRedirecting, setIsRedirecting] = useState(false);

    const fetchInvoices = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado.');

            const { data, error: dbError } = await supabase
                .from('invoices')
                .select('*')
                .eq('user_id', user.id)
                .order('due_date', { ascending: false });
            if (dbError) throw dbError;
            setInvoices(data || []);
        } catch (err: any) {
            setError('Falha ao carregar as faturas. Tente novamente mais tarde.');
            console.error('Error fetching invoices:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (paymentStep === 'list') {
            fetchInvoices();
        }
    }, [paymentStep, fetchInvoices]);

    const openInvoices = useMemo(() => invoices.filter(inv => inv.status === 'Em aberto' || inv.status === 'Boleto Gerado'), [invoices]);
    const paidInvoices = useMemo(() => invoices.filter(inv => inv.status === 'Paga' || inv.status === 'Expirado' || inv.status === 'Cancelado'), [invoices]);
    const totalDue = useMemo(() => openInvoices.reduce((sum, inv) => sum + inv.amount, 0), [openInvoices]);

    const handlePayClick = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setPaymentStep('select_method');
    };
    
    const handleViewBoletoClick = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setPaymentStep('view_boleto');
    };

    const handleMethodSelect = async (method: string) => {
        if (method === 'brick') setPaymentStep('form');
        else if (method === 'pix') setPaymentStep('pix');
        else if (method === 'boleto') setPaymentStep('boleto');
        else if (method === 'redirect') { /* ... (código de redirecionamento existente) ... */ }
    };

    const handleBackToMethodSelection = () => setPaymentStep('select_method');
    const handleBackToList = () => {
        setSelectedInvoice(null);
        setPaymentStep('list');
    };

    const handlePaymentSuccess = useCallback(async () => {
        if (selectedInvoice) {
            const { error: updateError } = await supabase
                .from('invoices')
                .update({ status: 'Paga' })
                .eq('id', selectedInvoice.id);

            if (updateError) {
                console.error('Failed to update invoice status:', updateError);
                setError('Houve um erro ao atualizar o status do pagamento.');
            }
        }
        handleBackToList();
    }, [selectedInvoice]);
    
    if (isRedirecting) { /* ... (código de redirecionamento existente) ... */ }

    if (paymentStep === 'view_boleto' && selectedInvoice) {
        return <BoletoDetails invoice={selectedInvoice} onBack={handleBackToList} />;
    }

    if (paymentStep === 'select_method' && selectedInvoice) {
        return <PaymentMethodSelector invoice={selectedInvoice} onSelectMethod={handleMethodSelect} onBack={handleBackToList} />;
    }
    
    if (paymentStep === 'pix' && selectedInvoice) {
        return <PixPayment invoice={selectedInvoice} onBack={handleBackToMethodSelection} onPaymentConfirmed={handleBackToList} />;
    }

    if (paymentStep === 'boleto' && selectedInvoice) {
        return <BoletoPayment invoice={selectedInvoice} onBack={handleBackToMethodSelection} onPaymentConfirmed={handleBackToList} />;
    }
    
    if (paymentStep === 'form' && selectedInvoice) {
        return <PaymentForm invoice={selectedInvoice} mpPublicKey={mpPublicKey} onBack={handleBackToMethodSelection} onPaymentSuccess={handlePaymentSuccess} />;
    }
    
    if (isLoading) {
        return <div className="w-full max-w-md flex flex-col items-center justify-center space-y-4 p-8"><LoadingSpinner /><p className="text-slate-500 dark:text-slate-400">Carregando faturas...</p></div>;
    }

    if (error) {
        return <div className="w-full max-w-md p-4"><Alert message={error} type="error" /><button onClick={handleBackToList} className="mt-4 w-full text-center text-sm font-medium text-indigo-600 dark:text-indigo-400">Voltar para Faturas</button></div>;
    }

    return (
        <div className="w-full max-w-md space-y-6 animate-fade-in">
            <section aria-labelledby="summary-title">
                 <h2 id="summary-title" className="sr-only">Resumo das Faturas</h2>
                {openInvoices.length > 0 ? (
                     <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 text-center">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total em aberto</p>
                        <p className="text-4xl font-bold text-slate-900 dark:text-white mt-2">
                            {totalDue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                         <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                            {openInvoices.length} {openInvoices.length > 1 ? 'faturas pendentes' : 'fatura pendente'}
                        </p>
                    </div>
                ) : (
                    <div className="bg-green-50 dark:bg-green-900/30 rounded-2xl shadow-lg p-6 flex items-center space-x-4">
                         <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-green-900 dark:text-green-200">Você está em dia!</h3>
                            <p className="text-sm text-green-700 dark:text-green-300">Nenhuma fatura pendente no momento.</p>
                        </div>
                    </div>
                )}
            </section>

            {openInvoices.length > 0 && (
                <section className="space-y-3" aria-labelledby="open-invoices-title">
                    <h2 id="open-invoices-title" className="text-xl font-bold text-slate-800 dark:text-slate-200 px-1">
                        Faturas Pendentes
                    </h2>
                    {openInvoices.map(invoice => (
                        <InvoiceItem key={invoice.id} invoice={invoice} onPay={handlePayClick} onViewBoleto={handleViewBoletoClick} />
                    ))}
                </section>
            )}

            {paidInvoices.length > 0 && (
                 <section className="space-y-3" aria-labelledby="history-title">
                    <button
                        onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                        className="w-full flex justify-between items-center text-left text-xl font-bold text-slate-800 dark:text-slate-200 px-1"
                        aria-expanded={isHistoryExpanded}
                    >
                        <span>Histórico</span>
                        <span className={`transform transition-transform duration-200 ${isHistoryExpanded ? 'rotate-180' : 'rotate-0'}`}>
                            <ChevronDownIcon />
                        </span>
                    </button>
                     {isHistoryExpanded && (
                        <div className="space-y-3 animate-fade-in">
                            {paidInvoices.map(invoice => (
                                <InvoiceItem key={invoice.id} invoice={invoice} />
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default PageFaturas;