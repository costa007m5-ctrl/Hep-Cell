
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PaymentForm from './PaymentForm';
import { Invoice, Profile } from '../types';
import { supabase } from '../services/clients';
import { getProfile } from '../services/profileService';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Confetti from './Confetti';
import PaymentMethodSelector from './PaymentMethodSelector';
import PixPayment from './PixPayment';
import BoletoPayment from './BoletoPayment';
import BoletoDetails from './BoletoDetails';
import { useToast } from './Toast';
import jsPDF from 'jspdf'; 

interface PageFaturasProps {
    mpPublicKey: string;
}

type ViewTab = 'open' | 'current' | 'paid' | 'statement'; 
type PaymentStep = 'list' | 'select_method' | 'pay_pix' | 'pay_boleto' | 'pay_credit' | 'boleto_details';

interface PurchaseGroup {
    id: string; 
    title: string; 
    invoices: Invoice[];
    totalRemaining: number;
    nextDue: string;
    status: 'active' | 'paid' | 'late';
    type: 'crediario' | 'avista'; 
}

// --- Ícones ---
const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

const PackageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
);

const TimerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

// --- Componente Temporizador ---
const EntryTimer: React.FC<{ createdAt: string }> = ({ createdAt }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        const created = new Date(createdAt).getTime();
        const expireTime = created + (24 * 60 * 60 * 1000); // 24 horas

        const updateTimer = () => {
            const now = new Date().getTime();
            const distance = expireTime - now;

            if (distance < 0) {
                setIsExpired(true);
                setTimeLeft("Expirado");
                return;
            }

            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        };

        const interval = setInterval(updateTimer, 1000);
        updateTimer();

        return () => clearInterval(interval);
    }, [createdAt]);

    if (isExpired) {
        return <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">Tempo Esgotado</span>;
    }

    return (
        <div className="flex items-center gap-1 text-xs font-mono font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded">
            <TimerIcon />
            {timeLeft}
        </div>
    );
};

// --- Funções Auxiliares ---
const generateInvoicePDF = (invoice: Invoice) => {
     const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE PAGAMENTO", 105, 20, { align: "center" });
    doc.setFillColor(79, 70, 229); 
    doc.circle(20, 20, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text("R", 18, 22);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    let y = 50;
    const addLine = (label: string, value: string) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, 20, y);
        doc.setFont("helvetica", "normal");
        doc.text(value, 80, y);
        y += 10;
    };
    addLine("Beneficiário:", "Relp Cell Eletrônicos");
    addLine("Descrição:", invoice.month);
    addLine("Vencimento Original:", new Date(invoice.due_date).toLocaleDateString('pt-BR'));
    if (invoice.payment_date) {
        addLine("Data do Pagamento:", new Date(invoice.payment_date).toLocaleDateString('pt-BR'));
        addLine("Hora:", new Date(invoice.payment_date).toLocaleTimeString('pt-BR'));
    }
    y += 5;
    doc.setDrawColor(200);
    doc.line(20, y, 190, y);
    y += 15;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    addLine("Valor Pago:", invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    if (invoice.payment_id) {
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`ID Transação: ${invoice.payment_id}`, 20, y + 10);
    }
    doc.save(`Fatura_${invoice.month.replace(/[^a-z0-9]/gi, '_')}.pdf`);
};

const shareInvoice = async (invoice: Invoice) => {
    const text = `Comprovante Relp Cell\nFatura: ${invoice.month}\nValor: ${invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\nPago em: ${new Date(invoice.payment_date || invoice.created_at).toLocaleDateString('pt-BR')}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Comprovante Relp Cell', text: text });
        } catch (error) { console.log('Erro ao compartilhar', error); }
    } else {
        navigator.clipboard.writeText(text);
        alert("Detalhes copiados!");
    }
};

// --- Componentes Visuais ---
const SummaryCard: React.FC<{ 
    currentMonthDue: number;
    creditLimit: number;
    totalDebt: number;
    showValues: boolean;
    onToggleValues: () => void;
}> = ({ currentMonthDue, creditLimit, totalDebt, showValues, onToggleValues }) => {
    const currentMonthName = new Date().toLocaleString('pt-BR', { month: 'long' });
    const availableLimit = Math.max(0, creditLimit - totalDebt);
    const percentageUsed = creditLimit > 0 ? (totalDebt / creditLimit) * 100 : 0;
    return (
        <div className="mx-4 mt-4 p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden transition-all hover:scale-[1.01]">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1 flex items-center gap-2">
                            A Pagar em {currentMonthName}
                            <button onClick={onToggleValues} className="text-indigo-300 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                                {showValues ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.572-2.572m3.76-3.76a9.953 9.953 0 015.674-1.334c2.744 0 5.258.953 7.26 2.548m2.24 2.24a9.958 9.958 0 011.342 2.144c-1.274 4.057-5.064 7-9.542 7a9.97 9.97 0 01-2.347-.278M9.88 9.88a3 3 0 104.24 4.24" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                                )}
                            </button>
                        </p>
                        <h2 className="text-4xl font-black tracking-tight mb-1">
                            {showValues 
                                ? currentMonthDue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                : 'R$ ••••'}
                        </h2>
                    </div>
                </div>
                <div className="space-y-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/5">
                    <div className="flex justify-between text-xs text-indigo-100">
                        <span>Limite Total</span>
                        <span className="font-bold">{showValues ? creditLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '•••'}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden border border-white/5 relative">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.3)] ${percentageUsed > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`} 
                            style={{ width: `${Math.min(100, percentageUsed)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between items-end">
                        <div className="text-xs">
                            <p className="text-slate-400">Utilizado</p>
                            <p className="font-bold text-white">{showValues ? totalDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '•••'}</p>
                        </div>
                        <div className="text-xs text-right">
                            <p className="text-slate-400">Disponível</p>
                            <p className="font-bold text-emerald-400">{showValues ? availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '•••'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PurchaseGroupCard: React.FC<{ 
    group: PurchaseGroup; 
    showValues: boolean;
    onPay: (invoice: Invoice) => void;
}> = ({ group, showValues, onPay }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasLate = group.invoices.some(inv => {
        const isEntry = inv.notes?.includes('ENTRADA') || inv.notes?.includes('VENDA_AVISTA') || inv.month.startsWith('Entrada');
        if (isEntry) return false;
        return new Date(inv.due_date) < new Date() && inv.status === 'Em aberto';
    });
    return (
        <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border overflow-hidden mb-4 animate-fade-in-up transition-all ${hasLate ? 'border-red-200 dark:border-red-900/50' : 'border-slate-100 dark:border-slate-700'}`}>
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900">
                <div className="flex items-center gap-3 text-left">
                    <div className={`p-2.5 rounded-xl shadow-sm ${hasLate ? 'bg-red-100 text-red-600' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                        <PackageIcon />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{group.title}</h4>
                            {hasLate && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Atrasado</span>}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">ID: #{group.id.substring(0,6)}</p>
                    </div>
                </div>
                <div className="text-right flex items-center gap-3">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Total</p>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{showValues ? group.totalRemaining.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : 'R$ •••'}</p>
                    </div>
                    <ChevronDownIcon className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {group.invoices.map((inv) => {
                        const now = new Date().getTime();
                        const dueDate = new Date(inv.due_date + 'T23:59:59').getTime();
                        const isEntry = inv.notes?.includes('ENTRADA') || inv.notes?.includes('VENDA_AVISTA') || inv.month.startsWith('Entrada');
                        const isLate = !isEntry && dueDate < now && inv.status === 'Em aberto';
                        const parcelLabel = inv.month.match(/Parcela \d+\/\d+/) || [inv.month];
                        return (
                            <div key={inv.id} className={`p-4 flex justify-between items-center transition-colors ${isLate ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${isLate ? 'bg-red-500' : isEntry ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{parcelLabel[0]}</p>
                                        {isEntry && !inv.notes?.includes('VENDA_AVISTA') ? <EntryTimer createdAt={inv.created_at} /> : <p className={`text-[10px] ${isLate ? 'text-red-500 font-bold' : 'text-slate-400'}`}>Vence: {new Date(inv.due_date).toLocaleDateString('pt-BR')}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{showValues ? inv.amount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : 'R$ •••'}</span>
                                    <button onClick={() => onPay(inv)} className="px-3 py-1.5 text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 bg-indigo-600">Pagar</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const PaymentHistoryCard: React.FC<{ invoice: Invoice; showValues: boolean }> = ({ invoice, showValues }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md group">
        <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{invoice.month}</p>
                    <p className="text-xs text-slate-500">Pago em {new Date(invoice.payment_date || invoice.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">{showValues ? invoice.amount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : 'R$ •••'}</span>
        </div>
        <div className="flex gap-2 mt-2 pt-2 border-t border-slate-50 dark:border-slate-700/50">
            <button onClick={() => generateInvoicePDF(invoice)} className="flex-1 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1">PDF</button>
            <button onClick={() => shareInvoice(invoice)} className="flex-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors flex items-center justify-center gap-1">Enviar</button>
        </div>
    </div>
);

const PageFaturas: React.FC<PageFaturasProps> = ({ mpPublicKey }) => {
    const [viewTab, setViewTab] = useState<ViewTab>('open');
    const [paymentStep, setPaymentStep] = useState<PaymentStep>('list');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showValues, setShowValues] = useState(true);
    const [showConfetti, setShowConfetti] = useState(false);
    const [useCoins, setUseCoins] = useState(false);
    const [coinsBalance, setCoinsBalance] = useState(0);
    const { addToast } = useToast();

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado.');
            const [invoicesRes, profileRes] = await Promise.all([
                supabase.from('invoices').select('*').eq('user_id', user.id).order('due_date', { ascending: true }),
                getProfile(user.id),
            ]);
            setInvoices(invoicesRes.data || []);
            if (profileRes) {
                setProfile({ ...profileRes, id: user.id, email: user.email });
                setCoinsBalance(profileRes.coins_balance || 0);
            }
        } catch (err: any) { console.error(err); } finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const openInvoices = useMemo(() => invoices.filter(i => i.status === 'Em aberto' || i.status === 'Boleto Gerado'), [invoices]);
    const paidInvoices = useMemo(() => invoices.filter(i => i.status === 'Paga'), [invoices]);
    const currentMonthDue = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        return openInvoices.reduce((acc, inv) => {
            const dueDate = new Date(inv.due_date);
            const isCrediario = !inv.notes?.includes('VENDA_AVISTA');
            if (isCrediario && (dueDate < now || (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear))) {
                return acc + inv.amount;
            }
            return acc;
        }, 0);
    }, [openInvoices]);

    const totalDebt = useMemo(() => {
        return openInvoices
            .filter(inv => !inv.notes?.includes('VENDA_AVISTA'))
            .reduce((acc, inv) => acc + inv.amount, 0);
    }, [openInvoices]);

    const creditLimit = profile?.credit_limit || 0;

    const groupInvoices = (list: Invoice[]) => {
        const groups: Record<string, PurchaseGroup> = {};
        list.forEach(inv => {
            let key = 'avulso';
            let title = 'Faturas Avulsas';
            let type: 'crediario' | 'avista' = 'avista';
            
            if (inv.notes) {
                if (inv.notes.includes('VENDA_AVISTA')) {
                    key = `direct_${inv.id}`; 
                    type = 'avista';
                    title = inv.month;
                } else {
                    const matchContract = inv.notes.match(/Contrato\s+([a-f0-9-]+)/);
                    const matchEntry = inv.notes.match(/ENTRADA\|([a-f0-9-]+)/);
                    if (matchContract) { key = matchContract[1]; type = 'crediario'; }
                    else if (matchEntry) { key = matchEntry[1]; type = 'avista'; title = 'Entrada'; }
                }
            } else if (inv.month.includes('Parcela')) { type = 'crediario'; }

            const nameMatch = inv.month.match(/.* - (.+)/);
            if (nameMatch) title = nameMatch[1].trim();
            else if (!title || title === 'Faturas Avulsas') title = inv.month;

            if (!groups[key]) groups[key] = { id: key, title, invoices: [], totalRemaining: 0, nextDue: inv.due_date, status: 'active', type };
            groups[key].invoices.push(inv);
            groups[key].totalRemaining += inv.amount;
            if (new Date(inv.due_date) < new Date(groups[key].nextDue)) groups[key].nextDue = inv.due_date;
        });
        return Object.values(groups).sort((a, b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime());
    };

    const groupedOpenInvoices = useMemo(() => groupInvoices(openInvoices), [openInvoices]);
    const crediarioGroups = groupedOpenInvoices.filter(g => g.type === 'crediario');
    const avistaGroups = groupedOpenInvoices.filter(g => g.type === 'avista');

    const handlePaymentMethodSelection = async (method: string) => {
        if (!selectedInvoice) return;
        const discount = useCoins ? Math.min(selectedInvoice.amount - 0.01, coinsBalance / 100) : 0;
        const finalAmount = selectedInvoice.amount - discount;
        (selectedInvoice as any)._coinsToUse = Math.floor(discount * 100); 
        (selectedInvoice as any)._finalAmount = finalAmount;
        if (method === 'pix') setPaymentStep('pay_pix');
        else if (method === 'boleto') setPaymentStep('pay_boleto');
        else if (method === 'credit_card') setPaymentStep('pay_credit');
    };

    if (paymentStep !== 'list' && selectedInvoice) {
        const invoiceWithExtras = { ...selectedInvoice, amount: (selectedInvoice as any)._finalAmount || selectedInvoice.amount, coinsToUse: (selectedInvoice as any)._coinsToUse };
        switch (paymentStep) {
            case 'select_method': 
                return <div className="w-full max-w-md pt-4 px-2">
                    <PaymentMethodSelector 
                        invoice={selectedInvoice} 
                        onSelectMethod={handlePaymentMethodSelection} 
                        onBack={() => { setPaymentStep('list'); setUseCoins(false); }}
                        userCoins={coinsBalance}
                        onToggleCoins={setUseCoins}
                        useCoins={useCoins}
                    />
                </div>;
            case 'pay_pix': return <PixPayment invoice={invoiceWithExtras} onBack={() => setPaymentStep('select_method')} onPaymentConfirmed={() => {setPaymentStep('list'); fetchInvoices(); setShowConfetti(true);}} />;
            case 'pay_boleto': return <BoletoPayment invoice={invoiceWithExtras} onBack={() => setPaymentStep('select_method')} onBoletoGenerated={(updated) => { setInvoices(p => p.map(i => i.id === updated.id ? updated : i)); setSelectedInvoice(updated); setPaymentStep('boleto_details'); }} />;
            case 'pay_credit': return <PaymentForm invoice={invoiceWithExtras} mpPublicKey={mpPublicKey} onBack={() => setPaymentStep('select_method')} onPaymentSuccess={() => { setPaymentStep('list'); fetchInvoices(); setShowConfetti(true); }} />;
            case 'boleto_details': return <BoletoDetails invoice={selectedInvoice} onBack={() => setPaymentStep('list')} />;
            default: return null;
        }
    }

    return (
        <div className="w-full max-w-md space-y-5 animate-fade-in pb-24 relative">
            {showConfetti && <Confetti />}
            <SummaryCard currentMonthDue={currentMonthDue} creditLimit={creditLimit} totalDebt={totalDebt} showValues={showValues} onToggleValues={() => setShowValues(!showValues)} />
            <div className="px-4 sticky top-[60px] z-30 bg-slate-50 dark:bg-slate-900 pb-2 pt-1">
                <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl flex overflow-x-auto no-scrollbar">
                    {['open', 'current', 'paid', 'statement'].map(id => (
                        <button key={id} onClick={() => setViewTab(id as any)} className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${viewTab === id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>{id === 'open' ? 'Aberto' : id === 'current' ? 'Do Mês' : id === 'paid' ? 'Pago' : 'Extrato'}</button>
                    ))}
                </div>
            </div>
            <div className="px-4 min-h-[300px]">
                {isLoading ? <div className="flex justify-center py-20"><LoadingSpinner /></div> : (
                    <>
                        {viewTab === 'open' && (
                            <div className="space-y-6">
                                {crediarioGroups.length > 0 && <div className="space-y-3"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2 border-l-2 border-indigo-500">📱 Crediário</h3>{crediarioGroups.map(group => <PurchaseGroupCard key={group.id} group={group} showValues={showValues} onPay={(inv) => { setSelectedInvoice(inv); setPaymentStep('select_method'); setUseCoins(false); }} />)}</div>}
                                {avistaGroups.length > 0 && <div className="space-y-3"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2 border-l-2 border-green-500">🛍️ Vendas à Vista / Entradas</h3>{avistaGroups.map(group => <PurchaseGroupCard key={group.id} group={group} showValues={showValues} onPay={(inv) => { setSelectedInvoice(inv); setPaymentStep('select_method'); setUseCoins(false); }} />)}</div>}
                            </div>
                        )}
                        {viewTab === 'paid' && <div className="space-y-3">{paidInvoices.map(inv => <PaymentHistoryCard key={inv.id} invoice={inv} showValues={showValues} />)}</div>}
                        {viewTab === 'current' && <p className="text-center text-slate-400 py-10">Módulo do mês.</p>}
                        {viewTab === 'statement' && <p className="text-center text-slate-400 py-10">Extrato completo.</p>}
                    </>
                )}
            </div>
        </div>
    );
};

export default PageFaturas;
