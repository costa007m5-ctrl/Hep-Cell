import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PaymentForm from './PaymentForm';
import { Invoice } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { diagnoseDatabaseError } from '../services/geminiService';

interface PageFaturasProps {
    mpPublicKey: string;
}

interface ErrorInfo {
    message: string;
    diagnosis?: string;
    isDiagnosing: boolean;
}

// Helper para calcular o desconto por antecipação
const getDiscountInfo = (dueDateString: string, originalAmount: number) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normaliza para o início do dia

  // Adiciona T00:00:00 para garantir que a data seja interpretada no fuso horário local
  const dueDate = new Date(dueDateString + 'T00:00:00');

  if (isNaN(dueDate.getTime())) return null;
  
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return null; // Sem desconto no dia ou após o vencimento

  const MAX_DISCOUNT_PERCENTAGE = 15;
  const MAX_DISCOUNT_DAYS = 30; // O desconto escala ao longo de 30 dias

  const effectiveDays = Math.min(diffDays, MAX_DISCOUNT_DAYS);
  const discountPercentage = (effectiveDays / MAX_DISCOUNT_DAYS) * MAX_DISCOUNT_PERCENTAGE;

  if (discountPercentage <= 0) return null;

  const discountValue = (originalAmount * discountPercentage) / 100;
  // Arredonda para 2 casas decimais para evitar problemas com centavos
  const roundedDiscountValue = Math.round(discountValue * 100) / 100;
  const discountedAmount = originalAmount - roundedDiscountValue;

  return {
    discountedAmount,
    discountValue: roundedDiscountValue,
    discountPercentage,
  };
};


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
const InvoiceItem: React.FC<{ invoice: Invoice; onPay?: (invoice: Invoice) => void; discountInfo: ReturnType<typeof getDiscountInfo> | null }> = ({ invoice, onPay, discountInfo }) => {
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
                {discountInfo && invoice.status === 'Em aberto' ? (
                    <>
                        <p className="font-semibold text-green-600 dark:text-green-400">
                            {discountInfo.discountedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-through">
                            {invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </>
                ) : (
                    <p className={`font-semibold ${config.textColor}`}>
                        {invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                )}
                {invoice.status === 'Em aberto' && onPay && (
                    <button onClick={() => onPay(invoice)} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none mt-1">
                         {discountInfo ? (
                             <span className="flex items-center justify-end gap-1">
                                <span>Antecipar com</span>
                                <span className="font-bold bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 px-1.5 py-0.5 rounded-full text-xs">
                                    {discountInfo.discountPercentage.toFixed(0)}% OFF
                                </span>
                             </span>
                        ) : 'Pagar'}
                    </button>
                )}
            </div>
        </div>
    );
};

const PageFaturas: React.FC<PageFaturasProps> = ({ mpPublicKey }) => {
    const [selectedInvoice, setSelectedInvoice] = useState<(Invoice & { originalAmount?: number; discountValue?: number; }) | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true);
        setErrorInfo(null);
        try {
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
            console.error('Error fetching invoices:', err);
            const errorMessage = err.message || 'Ocorreu um erro desconhecido.';
            setErrorInfo({
                message: `Falha ao carregar as faturas: ${errorMessage}`,
                isDiagnosing: true,
            });

            diagnoseDatabaseError(errorMessage).then(diagnosis => {
                setErrorInfo(prev => prev ? { ...prev, diagnosis, isDiagnosing: false } : null);
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
      if (!selectedInvoice) {
        fetchInvoices();
      }
    }, [selectedInvoice, fetchInvoices]);

    const openInvoices = useMemo(() => invoices.filter(inv => inv.status === 'Em aberto' || inv.status === 'Boleto Gerado'), [invoices]);
    const paidInvoices = useMemo(() => invoices.filter(inv => inv.status === 'Paga' || inv.status === 'Expirado' || inv.status === 'Cancelado'), [invoices]);
    const totalDue = useMemo(() => invoices.filter(i => i.status === 'Em aberto').reduce((sum, inv) => sum + inv.amount, 0), [invoices]);

    const handlePayClick = (invoice: Invoice) => {
        const discountInfo = getDiscountInfo(invoice.due_date, invoice.amount);
        const invoiceToPay = {
            ...invoice,
            amount: discountInfo ? discountInfo.discountedAmount : invoice.amount,
            originalAmount: invoice.amount,
            discountValue: discountInfo ? discountInfo.discountValue : 0,
        };
        setSelectedInvoice(invoiceToPay);
    };
    
    const handleBackToList = () => {
        setSelectedInvoice(null);
    };

    const handlePaymentSuccess = useCallback(async (paymentId: string | number) => {
        if (selectedInvoice) {
             // Atualiza a fatura localmente de forma otimista para uma UI mais rápida
            setInvoices(prevInvoices => prevInvoices.map(inv =>
                inv.id === selectedInvoice.id ? { ...inv, status: 'Paga' } : inv
            ));
            
            // Atualiza o banco de dados em segundo plano
            const { error: updateError } = await supabase
                .from('invoices')
                .update({ 
                    status: 'Paga', 
                    payment_id: String(paymentId),
                    payment_date: new Date().toISOString()
                })
                .eq('id', selectedInvoice.id);

            if (updateError) {
                console.error('Failed to update invoice status:', updateError);
                 setErrorInfo({ message: 'Houve um erro ao atualizar o status do pagamento. Seus dados estão seguros, mas a fatura pode demorar a atualizar.', isDiagnosing: false });
                 // Reverte a atualização local se o DB falhar
                 setInvoices(prevInvoices => prevInvoices.map(inv =>
                    inv.id === selectedInvoice.id ? { ...inv, status: selectedInvoice.status } : inv
                 ));
            }
        }
        setSelectedInvoice(null);
    }, [selectedInvoice]);
    
    if (selectedInvoice) {
        return <PaymentForm invoice={selectedInvoice} mpPublicKey={mpPublicKey} onBack={handleBackToList} onPaymentSuccess={handlePaymentSuccess} />;
    }
    
    if (isLoading) {
        return <div className="w-full max-w-md flex flex-col items-center justify-center space-y-4 p-8"><LoadingSpinner /><p className="text-slate-500 dark:text-slate-400">Carregando faturas...</p></div>;
    }

    if (errorInfo) {
        return (
            <div className="w-full max-w-md p-4 space-y-4 animate-fade-in">
                <Alert message={errorInfo.message} type="error" />
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
                        Análise da IA
                    </h3>
                    {errorInfo.isDiagnosing && (
                        <div className="flex items-center space-x-2 mt-2">
                            <LoadingSpinner />
                            <p className="text-sm text-slate-500 dark:text-slate-400">Analisando o problema...</p>
                        </div>
                    )}
                    {errorInfo.diagnosis && (
                         <div className="mt-2 text-slate-600 dark:text-slate-300 space-y-2 text-sm">
                            {errorInfo.diagnosis.split('\n').map((line, index) => {
                                if (line.startsWith('### ')) {
                                    return <h4 key={index} className="font-bold text-base text-slate-800 dark:text-slate-100 pt-2">{line.replace('### ', '')}</h4>
                                }
                                if (line.trim() === '') return null;
                                return <p key={index}>{line}</p>
                            })}
                        </div>
                    )}
                </div>
                <button onClick={fetchInvoices} className="w-full text-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Tentar Novamente</button>
            </div>
        );
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
                            {invoices.filter(i => i.status === 'Em aberto').length} {invoices.filter(i => i.status === 'Em aberto').length === 1 ? 'fatura pendente' : 'faturas pendentes'}
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
                    {openInvoices.map(invoice => {
                         const discountInfo = invoice.status === 'Em aberto' ? getDiscountInfo(invoice.due_date, invoice.amount) : null;
                         return (
                            <InvoiceItem 
                                key={invoice.id} 
                                invoice={invoice} 
                                onPay={handlePayClick}
                                discountInfo={discountInfo}
                             />
                        );
                    })}
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
                                <InvoiceItem key={invoice.id} invoice={invoice} discountInfo={null} />
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default PageFaturas;
