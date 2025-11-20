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

type PaymentStep = 'list' | 'select_method' | 'pay_card' | 'pay_pix' | 'pay_boleto' | 'boleto_details';

interface PageFaturasProps {
    mpPublicKey: string;
}

interface ErrorInfo {
    message: string;
    diagnosis?: string;
    isDiagnosing: boolean;
}

interface ProductGroup {
    id: string; // derived from product name
    name: string;
    totalAmount: number;
    remainingAmount: number;
    paidAmount: number;
    totalInstallments: number;
    paidInstallments: number;
    nextDueDate: string | null;
    status: 'active' | 'completed';
    invoices: Invoice[];
}

// --- Icons ---
const ChevronDown = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
);

const CheckCircle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
);

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

// --- Components ---

const InvoiceItemRow: React.FC<{ invoice: Invoice; onPay?: (invoice: Invoice) => void; onDetails?: (invoice: Invoice) => void; onReceipt?: (invoice: Invoice) => void; }> = ({ invoice, onPay, onDetails, onReceipt }) => {
    const dateParts = invoice.due_date.split('-');
    const dueDateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const formattedDueDate = dueDateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    
    const isPaid = invoice.status === 'Paga';
    const isLate = !isPaid && dueDateObj < new Date();
    
    // Extrai número da parcela se disponível "Produto (1/10)"
    const installmentMatch = invoice.month.match(/\((\d+)\/\d+\)/);
    const installmentNum = installmentMatch ? `${installmentMatch[1]}ª` : '';

    return (
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 mb-2 last:mb-0">
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isPaid ? 'bg-green-500' : isLate ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {installmentNum ? `Parcela ${installmentNum}` : invoice.month}
                    </p>
                    <p className={`text-xs ${isLate && !isPaid ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                        {isPaid ? 'Pago' : `Vence ${formattedDueDate}`}
                    </p>
                </div>
            </div>
            <div className="flex flex-col items-end">
                <span className={`text-sm font-bold ${isPaid ? 'text-slate-500 dark:text-slate-400 line-through decoration-slate-400' : 'text-slate-900 dark:text-white'}`}>
                    {invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                
                {!isPaid && (
                    <button 
                        onClick={() => invoice.status === 'Boleto Gerado' ? onDetails?.(invoice) : onPay?.(invoice)}
                        className="mt-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-bold hover:bg-indigo-200 transition-colors"
                    >
                        {invoice.status === 'Boleto Gerado' ? 'Ver Boleto' : 'Pagar'}
                    </button>
                )}
                 {isPaid && onReceipt && (
                     <button onClick={() => onReceipt(invoice)} className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline">
                        Recibo
                    </button>
                )}
            </div>
        </div>
    );
};

const PurchaseGroupCard: React.FC<{ group: ProductGroup; onPay: (i: Invoice) => void; onDetails: (i: Invoice) => void; onReceipt: (i: Invoice) => void; isOpenDefault?: boolean }> = ({ group, onPay, onDetails, onReceipt, isOpenDefault = false }) => {
    const [isOpen, setIsOpen] = useState(isOpenDefault);
    const progressPercent = (group.paidInstallments / group.totalInstallments) * 100;
    const isCompleted = group.status === 'completed';

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 flex flex-col gap-3"
            >
                <div className="w-full flex justify-between items-start">
                    <div className="flex items-center gap-3 text-left">
                        <div className={`p-2 rounded-lg ${isCompleted ? 'bg-green-100 dark:bg-green-900/20 text-green-600' : 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600'}`}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base line-clamp-1">{group.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {isCompleted ? 'Finalizado' : `${group.paidInstallments} de ${group.totalInstallments} parcelas pagas`}
                            </p>
                        </div>
                    </div>
                    <div className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        <ChevronDown />
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                         <span className="text-indigo-600 dark:text-indigo-400">{Math.round(progressPercent)}% pago</span>
                         {!isCompleted && <span className="text-slate-500">Resta {group.remainingAmount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>}
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-indigo-600'}`} 
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="px-4 pb-4 pt-0 animate-fade-in">
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50 space-y-2">
                        {group.invoices.map(invoice => (
                            <InvoiceItemRow 
                                key={invoice.id} 
                                invoice={invoice} 
                                onPay={onPay} 
                                onDetails={onDetails}
                                onReceipt={onReceipt}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const PageFaturas: React.FC<PageFaturasProps> = ({ mpPublicKey }) => {
    const [paymentStep, setPaymentStep] = useState<PaymentStep>('list');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const { addToast } = useToast();

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true); setErrorInfo(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado.');
            const { data, error: dbError } = await supabase.from('invoices').select('*').eq('user_id', user.id).order('due_date', { ascending: true });
            if (dbError) throw dbError;
            setInvoices(data || []);
        } catch (err: any) {
            const errorMessage = err.message || 'Ocorreu um erro desconhecido.';
            setErrorInfo({ message: `Falha ao carregar: ${errorMessage}`, isDiagnosing: true });
            diagnoseDatabaseError(errorMessage).then(diagnosis => setErrorInfo(prev => prev ? { ...prev, diagnosis, isDiagnosing: false } : null));
        } finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const groupedInvoices = useMemo(() => {
        const groups: Record<string, ProductGroup> = {};
        
        invoices.forEach(inv => {
            // Tenta extrair o nome do produto: "iPhone 15 (1/10)" -> "iPhone 15"
            let groupName = inv.month;
            const match = inv.month.match(/^(.*?)\s*\(\d+\/\d+\)$/);
            if (match) {
                groupName = match[1].trim();
            } else if (inv.notes && inv.notes.includes('Referente a compra de')) {
                 const noteMatch = inv.notes.match(/Referente a compra de (.*?) parcelada/);
                 if (noteMatch) groupName = noteMatch[1].trim();
            }

            // Se o nome ainda for muito genérico (ex: "Janeiro"), agrupa em "Outros"
            // Mas para MVP, vamos usar o groupName extraído
            
            if (!groups[groupName]) {
                groups[groupName] = {
                    id: groupName,
                    name: groupName,
                    totalAmount: 0,
                    remainingAmount: 0,
                    paidAmount: 0,
                    totalInstallments: 0,
                    paidInstallments: 0,
                    nextDueDate: null,
                    status: 'completed',
                    invoices: []
                };
            }
            
            const g = groups[groupName];
            g.invoices.push(inv);
            g.totalAmount += inv.amount;
            g.totalInstallments++;

            if (inv.status === 'Paga') {
                g.paidAmount += inv.amount;
                g.paidInstallments++;
            } else {
                g.remainingAmount += inv.amount;
                g.status = 'active';
                // Find earliest due date
                if (!g.nextDueDate || new Date(inv.due_date) < new Date(g.nextDueDate)) {
                    g.nextDueDate = inv.due_date;
                }
            }
        });

        return Object.values(groups).sort((a, b) => {
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            // Se ambos ativos, o que vence primeiro aparece antes
            if (a.nextDueDate && b.nextDueDate) return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
            return 0;
        });
    }, [invoices]);

    const activeGroups = groupedInvoices.filter(g => g.status === 'active');
    const completedGroups = groupedInvoices.filter(g => g.status === 'completed');
    const totalDue = activeGroups.reduce((acc, g) => acc + g.remainingAmount, 0);

    const handlePaymentSuccess = useCallback(async (paymentId: string | number) => {
        if (selectedInvoice) {
            setInvoices(prev => prev.map(inv => inv.id === selectedInvoice.id ? {...inv, status: 'Paga', payment_date: new Date().toISOString()} : inv));
            await supabase.from('invoices').update({ status: 'Paga', payment_id: String(paymentId), payment_date: new Date().toISOString() }).eq('id', selectedInvoice.id);
        }
        setSelectedInvoice(null);
        setPaymentStep('list');
        addToast('Pagamento confirmado!', 'success');
    }, [selectedInvoice, addToast]);

    const generateReceipt = (invoice: Invoice) => {
        const doc = new jsPDF();
        doc.text("RECIBO DE PAGAMENTO - RELP CELL", 20, 20);
        doc.text(`Valor: ${invoice.amount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}`, 20, 40);
        doc.save(`recibo_${invoice.id}.pdf`);
        addToast('Recibo baixado!', 'success');
    };

    if (paymentStep !== 'list' && selectedInvoice) {
        // ... Payment Flow Rendering (Same as before)
        switch (paymentStep) {
            case 'select_method': return <PaymentMethodSelector invoice={selectedInvoice} onSelectMethod={(m) => { if(m==='brick') setPaymentStep('pay_card'); else if(m==='pix') setPaymentStep('pay_pix'); else if(m==='boleto') setPaymentStep('pay_boleto'); }} onBack={() => setPaymentStep('list')} />;
            case 'pay_card': return <PaymentForm invoice={selectedInvoice} mpPublicKey={mpPublicKey} onBack={() => setPaymentStep('select_method')} onPaymentSuccess={handlePaymentSuccess} />;
            case 'pay_pix': return <PixPayment invoice={selectedInvoice} onBack={() => setPaymentStep('select_method')} onPaymentConfirmed={() => {setPaymentStep('list'); fetchInvoices();}} />;
            case 'pay_boleto': return <BoletoPayment invoice={selectedInvoice} onBack={() => setPaymentStep('select_method')} onBoletoGenerated={(updated) => { setInvoices(p => p.map(i => i.id === updated.id ? updated : i)); setSelectedInvoice(updated); setPaymentStep('boleto_details'); }} />;
            case 'boleto_details': return <BoletoDetails invoice={selectedInvoice} onBack={() => setPaymentStep('list')} />;
            default: return null;
        }
    }

    return (
        <div className="w-full max-w-md space-y-6 animate-fade-in pb-safe">
             {/* Header Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total em Aberto</p>
                <p className="text-4xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
                    {isLoading ? <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto"></div> : 
                    totalDue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                {!isLoading && activeGroups.length > 0 && (
                    <p className="text-xs text-slate-400 mt-2">{activeGroups.length} compras ativas</p>
                )}
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
                <button onClick={() => setActiveTab('active')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    Ativas
                </button>
                <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    Histórico
                </button>
            </div>

            {/* Content */}
            <div className="space-y-4 min-h-[300px]">
                {isLoading ? (
                    <> <CardSkeleton /> <CardSkeleton /> </>
                ) : errorInfo ? (
                    <Alert message={errorInfo.message} type="error" />
                ) : activeTab === 'active' ? (
                    activeGroups.length > 0 ? (
                        activeGroups.map(group => (
                            <PurchaseGroupCard 
                                key={group.id} 
                                group={group} 
                                isOpenDefault={true}
                                onPay={(i) => { setSelectedInvoice(i); setPaymentStep('select_method'); }}
                                onDetails={(i) => { setSelectedInvoice(i); setPaymentStep('boleto_details'); }}
                                onReceipt={generateReceipt}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center opacity-70">
                            <CheckCircle />
                            <p className="mt-2 text-slate-600 dark:text-slate-300 font-medium">Tudo pago!</p>
                            <p className="text-xs text-slate-400">Nenhuma fatura pendente.</p>
                        </div>
                    )
                ) : (
                    completedGroups.length > 0 ? (
                        completedGroups.map(group => (
                            <PurchaseGroupCard 
                                key={group.id} 
                                group={group} 
                                onPay={() => {}} // Should not be called
                                onDetails={() => {}}
                                onReceipt={generateReceipt}
                            />
                        ))
                    ) : (
                        <div className="text-center py-12 text-slate-400 text-sm">Nenhum histórico disponível.</div>
                    )
                )}
            </div>
        </div>
    );
};

export default PageFaturas;