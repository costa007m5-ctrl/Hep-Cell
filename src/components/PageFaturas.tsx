import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Invoice } from '../types';
import { supabase } from '../services/clients';
import Alert from './Alert';
import { diagnoseDatabaseError } from '../services/geminiService';
import PaymentMethodSelector from './PaymentMethodSelector';
import PaymentForm from './PaymentForm';
import PixPayment from './PixPayment';
import BoletoPayment from './BoletoPayment';
import BoletoDetails from './BoletoDetails';
import { CardSkeleton } from './Skeleton';
import { useToast } from './Toast';
import jsPDF from 'jspdf';

type PaymentStep = 'list' | 'select_method' | 'pay_card' | 'pay_pix' | 'pay_boleto' | 'boleto_details' | 'redirecting';

interface PageFaturasProps {
    mpPublicKey: string;
}

interface ErrorInfo {
    message: string;
    diagnosis?: string;
    isDiagnosing: boolean;
}

// --- Invoice Group & Item ---

const InvoiceItem: React.FC<{ invoice: Invoice; onPay?: (invoice: Invoice) => void; onDetails?: (invoice: Invoice) => void; onReceipt?: (invoice: Invoice) => void; }> = ({ invoice, onPay, onDetails, onReceipt }) => {
    // Ajuste de timezone para exibir a data correta
    const dateParts = invoice.due_date.split('-');
    const dueDateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const formattedDueDate = dueDateObj.toLocaleDateString('pt-BR');
    
    const isPaid = invoice.status === 'Paga';
    const isLate = !isPaid && dueDateObj < new Date();

    return (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
            <div className="flex items-center space-x-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isPaid ? 'bg-green-100 text-green-600' : isLate ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                }`}>
                    {isPaid ? (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                </div>
                <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{invoice.month}</p>
                    <p className={`text-xs ${isLate ? 'text-red-500 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                        {isPaid ? 'Pago com sucesso' : `Vence em ${formattedDueDate}`}
                    </p>
                </div>
            </div>
            <div className="text-right">
                <p className="font-bold text-slate-800 dark:text-white text-sm">
                    {invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                
                {isPaid ? (
                    <button onClick={() => onReceipt && onReceipt(invoice)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-end gap-1 mt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Recibo
                    </button>
                ) : (
                    <button 
                        onClick={() => invoice.status === 'Boleto Gerado' ? onDetails?.(invoice) : onPay?.(invoice)} 
                        className="mt-1 px-3 py-1 bg-indigo-600 text-white text-xs rounded-full font-medium hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shadow-indigo-500/30"
                    >
                        {invoice.status === 'Boleto Gerado' ? 'Ver Boleto' : 'Pagar'}
                    </button>
                )}
            </div>
        </div>
    );
};

const PageFaturas: React.FC<PageFaturasProps> = ({ mpPublicKey }) => {
    const [paymentStep, setPaymentStep] = useState<PaymentStep>('list');
    const [activeStatusTab, setActiveStatusTab] = useState<'open' | 'paid'>('open');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
    const { addToast } = useToast();

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true); setErrorInfo(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado.');
            const { data, error: dbError } = await supabase.from('invoices').select('*').eq('user_id', user.id);
            if (dbError) throw dbError;
            setInvoices(data || []);
        } catch (err: any) {
            const errorMessage = err.message || 'Ocorreu um erro desconhecido.';
            setErrorInfo({ message: `Falha ao carregar: ${errorMessage}`, isDiagnosing: true });
            diagnoseDatabaseError(errorMessage).then(diagnosis => setErrorInfo(prev => prev ? { ...prev, diagnosis, isDiagnosing: false } : null));
        } finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const filteredInvoices = useMemo(() => {
        let result = [];
        if (activeStatusTab === 'open') {
            result = invoices.filter(inv => inv.status === 'Em aberto' || inv.status === 'Boleto Gerado' || inv.status === 'Expirado');
            // Ordenar as abertas pela data de vencimento mais próxima (Crescente)
            result.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        } else {
            result = invoices.filter(inv => inv.status === 'Paga');
            // Ordenar as pagas pela data de pagamento mais recente (Decrescente), ou vencimento se não houver pagto
            result.sort((a, b) => {
                const dateA = a.payment_date ? new Date(a.payment_date).getTime() : new Date(a.due_date).getTime();
                const dateB = b.payment_date ? new Date(b.payment_date).getTime() : new Date(b.due_date).getTime();
                return dateB - dateA;
            });
        }
        return result;
    }, [invoices, activeStatusTab]);

    const generateReceipt = (invoice: Invoice) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Comprovante de Pagamento", 20, 20);
        doc.setFontSize(12);
        doc.text(`Relp Cell`, 20, 30);
        doc.text(`------------------------------------------------`, 20, 40);
        doc.text(`Fatura: ${invoice.month}`, 20, 50);
        doc.text(`Valor: ${invoice.amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`, 20, 60);
        doc.text(`Data de Vencimento: ${new Date(invoice.due_date).toLocaleDateString('pt-BR')}`, 20, 70);
        if (invoice.payment_date) {
             doc.text(`Data de Pagamento: ${new Date(invoice.payment_date).toLocaleDateString('pt-BR')}`, 20, 80);
        }
        doc.text(`ID da Transação: ${invoice.payment_id || 'N/A'}`, 20, 90);
        doc.text(`------------------------------------------------`, 20, 100);
        doc.text(`Autenticação: ${Math.random().toString(36).substring(2, 15).toUpperCase()}`, 20, 110);
        doc.save(`Comprovante_${invoice.month.replace(/\s+/g, '_')}.pdf`);
        addToast('Comprovante baixado!', 'success');
    };

    const handleSelectMethod = async (method: string) => {
        if (!selectedInvoice) return;
        if (method === 'brick') setPaymentStep('pay_card');
        else if (method === 'pix') setPaymentStep('pay_pix');
        else if (method === 'boleto') setPaymentStep('pay_boleto');
    };

    const handlePaymentSuccess = useCallback(async (paymentId: string | number) => {
        if (selectedInvoice) {
            // Optimistic update
            setInvoices(prev => prev.map(inv => inv.id === selectedInvoice.id ? {...inv, status: 'Paga', payment_date: new Date().toISOString()} : inv));
            await supabase.from('invoices').update({ status: 'Paga', payment_id: String(paymentId), payment_date: new Date().toISOString() }).eq('id', selectedInvoice.id);
        }
        setSelectedInvoice(null);
        setPaymentStep('list');
        addToast('Pagamento confirmado!', 'success');
    }, [selectedInvoice, addToast]);

    // Render Logic
    if (paymentStep !== 'list' && selectedInvoice) {
        switch (paymentStep) {
            case 'select_method': return <PaymentMethodSelector invoice={selectedInvoice} onSelectMethod={handleSelectMethod} onBack={() => setPaymentStep('list')} />;
            case 'pay_card': return <PaymentForm invoice={selectedInvoice} mpPublicKey={mpPublicKey} onBack={() => setPaymentStep('select_method')} onPaymentSuccess={handlePaymentSuccess} />;
            case 'pay_pix': return <PixPayment invoice={selectedInvoice} onBack={() => setPaymentStep('select_method')} onPaymentConfirmed={() => {setPaymentStep('list'); fetchInvoices();}} />;
            case 'pay_boleto': return <BoletoPayment invoice={selectedInvoice} onBack={() => setPaymentStep('select_method')} onBoletoGenerated={(updated) => { setInvoices(p => p.map(i => i.id === updated.id ? updated : i)); setSelectedInvoice(updated); setPaymentStep('boleto_details'); }} />;
            case 'boleto_details': return <BoletoDetails invoice={selectedInvoice} onBack={() => setPaymentStep('list')} />;
            default: return null;
        }
    }

    return (
        <div className="w-full max-w-md space-y-6 animate-fade-in pb-safe">
            {/* Resumo Global */}
            <section>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total em Aberto</p>
                    <p className="text-4xl font-extrabold text-slate-900 dark:text-white mt-2">
                        {isLoading ? <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto"></div> : 
                        invoices.filter(i => i.status === 'Em aberto' || i.status === 'Boleto Gerado').reduce((acc, cur) => acc + cur.amount, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            </section>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
                <button onClick={() => setActiveStatusTab('open')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeStatusTab === 'open' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    Pendentes
                </button>
                <button onClick={() => setActiveStatusTab('paid')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeStatusTab === 'paid' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    Pagas
                </button>
            </div>

            {/* Lista */}
            <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700 min-h-[200px]">
                {isLoading ? (
                    <div className="p-4 space-y-3">
                        <CardSkeleton /><CardSkeleton />
                    </div>
                ) : errorInfo ? (
                    <div className="p-4"><Alert message={errorInfo.message} type="error" /></div>
                ) : filteredInvoices.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredInvoices.map(inv => (
                            <InvoiceItem 
                                key={inv.id} 
                                invoice={inv} 
                                onPay={(i) => { setSelectedInvoice(i); setPaymentStep('select_method'); }} 
                                onDetails={(i) => { setSelectedInvoice(i); setPaymentStep('boleto_details'); }}
                                onReceipt={generateReceipt}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                            {activeStatusTab === 'open' ? 
                                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> :
                                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            }
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                            {activeStatusTab === 'open' ? 'Tudo pago!' : 'Nenhum histórico'}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {activeStatusTab === 'open' ? 'Você não tem faturas pendentes.' : 'Suas faturas pagas aparecerão aqui.'}
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default PageFaturas;