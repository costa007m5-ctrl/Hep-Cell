import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Invoice, Profile } from '../types';
import { supabase } from '../services/clients';
import { getProfile } from '../services/profileService';
import Alert from './Alert';
import { diagnoseDatabaseError } from '../services/geminiService';
import PaymentMethodSelector from './PaymentMethodSelector';
import PaymentForm from './PaymentForm';
import PixPayment from './PixPayment';
import BoletoPayment from './BoletoPayment';
import BoletoDetails from './BoletoDetails';
import { CardSkeleton } from './Skeleton';
import { useToast } from './Toast';
import Confetti from './Confetti';
import jsPDF from 'jspdf';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';

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
    id: string;
    name: string;
    totalAmount: number;
    remainingAmount: number;
    paidAmount: number;
    totalInstallments: number;
    paidInstallments: number;
    nextDueDate: string | null;
    status: 'active' | 'completed' | 'late';
    invoices: Invoice[];
}

// --- Icons ---
const ChevronDown = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
);

const CheckCircle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
);

const ChartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
);

// --- Components ---

// Modal de Renegociação
const RenegotiationModal: React.FC<{
    overdueInvoices: Invoice[];
    onClose: () => void;
    onConfirm: (deal: Invoice) => void;
    maxInterestRate?: number;
}> = ({ overdueInvoices, onClose, onConfirm, maxInterestRate = 15 }) => {
    const [installments, setInstallments] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);

    const totalOriginal = overdueInvoices.reduce((acc, inv) => acc + inv.amount, 0);
    
    // Regra: Juros progressivo até a taxa máxima configurada (padrão 15%) na parcela 7
    // Fórmula: Juros % = TaxaMaxima * (parcelas / 7)
    const interestPercentage = (maxInterestRate * (installments / 7)) / 100;
    const totalWithInterest = totalOriginal * (1 + interestPercentage);
    const installmentValue = totalWithInterest / installments;

    const handleGenerateDeal = () => {
        setIsGenerating(true);
        
        const dealInvoice: Invoice = {
            id: `reneg_${Date.now()}`,
            user_id: overdueInvoices[0].user_id,
            month: `Acordo de Renegociação (${overdueInvoices.length} faturas)`,
            due_date: new Date().toISOString().split('T')[0], 
            amount: totalWithInterest,
            status: 'Em aberto',
            notes: `Renegociação de débitos. ${installments}x de ${installmentValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`,
            created_at: new Date().toISOString()
        };

        setTimeout(() => {
            onConfirm(dealInvoice);
            setIsGenerating(false);
        }, 1000);
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Renegociar Dívidas</h3>
                <p className="text-sm text-slate-500 mt-1">Regularize {overdueInvoices.length} faturas em atraso.</p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/50 text-center">
                <p className="text-xs text-red-600 dark:text-red-300 uppercase font-bold mb-1">Total em Atraso</p>
                <p className="text-3xl font-black text-red-700 dark:text-red-400">
                    {totalOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Parcelar em: {installments}x
                </label>
                <input 
                    type="range" 
                    min="1" 
                    max="7" 
                    value={installments} 
                    onChange={(e) => setInstallments(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1 px-1">
                    <span>1x</span>
                    <span>7x</span>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Juros Aplicados:</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-white">{(interestPercentage * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between mb-2 pt-2 border-t border-slate-100 dark:border-slate-600">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Novo Total:</span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{totalWithInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="text-center mt-4">
                    <p className="text-xs text-slate-500">Valor da Parcela</p>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-white">
                        {installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            </div>

            <button 
                onClick={handleGenerateDeal}
                disabled={isGenerating}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
            >
                {isGenerating ? <LoadingSpinner /> : 'Gerar Boleto de Acordo'}
            </button>
        </div>
    );
};

// Novo Componente: Gráfico de Gastos Simplificado
const SpendingChart: React.FC<{ invoices: Invoice[] }> = ({ invoices }) => {
    const monthlyData = useMemo(() => {
        const data: Record<string, number> = {};
        // Pega os últimos 6 meses
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleString('pt-BR', { month: 'short' });
            data[key] = 0;
        }
        
        invoices.forEach(inv => {
            if (inv.status === 'Paga') {
                const date = new Date(inv.payment_date || inv.created_at);
                const key = date.toLocaleString('pt-BR', { month: 'short' });
                if (data[key] !== undefined) {
                    data[key] += inv.amount;
                }
            }
        });
        return data;
    }, [invoices]);

    const maxVal = Math.max(...(Object.values(monthlyData) as number[]), 100);

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mb-4">
            <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600">
                    <ChartIcon />
                </div>
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Gastos Mensais</h3>
            </div>
            <div className="flex items-end justify-between h-24 gap-2">
                {Object.entries(monthlyData).map(([month, val]) => {
                    const amount = val as number;
                    return (
                    <div key={month} className="flex flex-col items-center flex-1 group">
                        <div className="relative w-full flex justify-center">
                             <div 
                                className="w-full max-w-[24px] bg-indigo-500/20 dark:bg-indigo-500/40 rounded-t-sm group-hover:bg-indigo-500 transition-colors"
                                style={{ height: `${(amount / maxVal) * 80 + 10}%` }}
                            ></div>
                            {amount > 0 && (
                                <div className="absolute -top-6 text-[10px] font-bold text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-black px-1 rounded shadow-sm">
                                    {Math.round(amount)}
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 uppercase">{month}</span>
                    </div>
                )})}
            </div>
        </div>
    );
};

// Novo Componente: Header Financeiro
const FinancialHeader: React.FC<{ totalDue: number; creditLimit: number; availableLimit: number }> = ({ totalDue, creditLimit, availableLimit }) => (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-black dark:to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden mb-6">
        <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        
        <div className="relative z-10">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Total a Pagar</p>
            <h2 className="text-3xl font-bold mb-4">{totalDue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
            
            <div className="flex gap-4 pt-4 border-t border-white/10">
                <div>
                    <p className="text-slate-400 text-[10px]">Limite Total</p>
                    <p className="font-semibold text-sm">{creditLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="w-px bg-white/10"></div>
                <div>
                    <p className="text-slate-400 text-[10px]">Disponível</p>
                    <p className="font-semibold text-sm text-green-400">{availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            </div>
        </div>
    </div>
);

const InvoiceItemRow: React.FC<{ 
    invoice: Invoice; 
    onPay?: (invoice: Invoice) => void; 
    onDetails?: (invoice: Invoice) => void; 
    onReceipt?: (invoice: Invoice) => void;
    selectable?: boolean;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
}> = ({ invoice, onPay, onDetails, onReceipt, selectable, isSelected, onSelect }) => {
    const dateParts = invoice.due_date.split('-');
    const dueDateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const formattedDueDate = dueDateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    
    const isPaid = invoice.status === 'Paga';
    const isLate = !isPaid && dueDateObj < new Date();
    
    const installmentMatch = invoice.month.match(/\((\d+)\/\d+\)/);
    const installmentNum = installmentMatch ? `${installmentMatch[1]}ª` : '';

    return (
        <div className={`flex items-center justify-between p-3 rounded-lg border mb-2 last:mb-0 transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-700'}`}>
            <div className="flex items-center gap-3">
                {selectable && !isPaid ? (
                    <div onClick={(e) => { e.stopPropagation(); onSelect?.(invoice.id); }} className="cursor-pointer">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                    </div>
                ) : (
                    <div className={`w-2 h-2 rounded-full ${isPaid ? 'bg-green-500' : isLate ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                )}
                
                <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {installmentNum ? `Parcela ${installmentNum}` : invoice.month}
                    </p>
                    <p className={`text-[10px] font-bold ${isLate && !isPaid ? 'text-red-500' : 'text-slate-400'}`}>
                        {isPaid ? `Pago em ${new Date(invoice.payment_date!).toLocaleDateString('pt-BR')}` : `Vence ${formattedDueDate}`}
                        {isLate && !isPaid && ' (Atrasada)'}
                    </p>
                </div>
            </div>
            <div className="flex flex-col items-end">
                <span className={`text-sm font-bold ${isPaid ? 'text-slate-500 dark:text-slate-400 line-through decoration-slate-400' : 'text-slate-900 dark:text-white'}`}>
                    {invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                
                {!selectable && !isPaid && (
                    <button 
                        onClick={() => invoice.status === 'Boleto Gerado' ? onDetails?.(invoice) : onPay?.(invoice)}
                        className="mt-1 text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-bold hover:bg-indigo-50 dark:hover:bg-slate-600 transition-colors"
                    >
                        {invoice.status === 'Boleto Gerado' ? 'Ver Boleto' : 'Pagar'}
                    </button>
                )}
                 {isPaid && onReceipt && (
                     <button onClick={() => onReceipt(invoice)} className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        Recibo
                    </button>
                )}
            </div>
        </div>
    );
};

const PurchaseGroupCard: React.FC<{ 
    group: ProductGroup; 
    onPay: (i: Invoice) => void; 
    onDetails: (i: Invoice) => void; 
    onReceipt: (i: Invoice) => void; 
    onSelectMultiple: (ids: string[]) => void;
    isOpenDefault?: boolean 
}> = ({ group, onPay, onDetails, onReceipt, onSelectMultiple, isOpenDefault = false }) => {
    const [isOpen, setIsOpen] = useState(isOpenDefault);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    const progressPercent = (group.paidInstallments / group.totalInstallments) * 100;
    const isCompleted = group.status === 'completed';
    const hasLate = group.status === 'late';

    const handleToggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
        onSelectMultiple(Array.from(newSet));
    };

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border overflow-hidden transition-all ${hasLate ? 'border-red-200 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-700'}`}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 flex flex-col gap-3"
            >
                <div className="w-full flex justify-between items-start">
                    <div className="flex items-center gap-3 text-left">
                        <div className={`p-2 rounded-lg ${isCompleted ? 'bg-green-100 dark:bg-green-900/20 text-green-600' : hasLate ? 'bg-red-100 dark:bg-red-900/20 text-red-600' : 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600'}`}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base line-clamp-1">{group.name}</h3>
                            <p className={`text-xs ${hasLate ? 'text-red-500 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                                {isCompleted ? 'Finalizado' : hasLate ? 'Pagamento Atrasado' : `${group.paidInstallments}/${group.totalInstallments} parcelas pagas`}
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
                         <span className={`${hasLate ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'}`}>{Math.round(progressPercent)}% pago</span>
                         {!isCompleted && <span className="text-slate-500">Resta {group.remainingAmount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>}
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : hasLate ? 'bg-red-500' : 'bg-indigo-600'}`} 
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="px-4 pb-4 pt-0 animate-fade-in">
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50 space-y-1">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parcelas</p>
                            {!isCompleted && (
                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                                    Selecione para antecipar
                                </span>
                            )}
                        </div>
                        {group.invoices.map(invoice => (
                            <InvoiceItemRow 
                                key={invoice.id} 
                                invoice={invoice} 
                                onPay={onPay} 
                                onDetails={onDetails}
                                onReceipt={onReceipt}
                                selectable={!isCompleted}
                                isSelected={selectedIds.has(invoice.id)}
                                onSelect={handleToggleSelect}
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
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [showConfetti, setShowConfetti] = useState(false);
    const [bulkSelection, setBulkSelection] = useState<Invoice[]>([]); 
    const [isRenegotiating, setIsRenegotiating] = useState(false); 
    const [negotiationRate, setNegotiationRate] = useState(15);
    
    const { addToast } = useToast();

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true); setErrorInfo(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado.');
            
            // Fetch invoices, profile and settings in parallel
            const [invoicesRes, profileRes, settingsRes] = await Promise.all([
                supabase.from('invoices').select('*').eq('user_id', user.id).order('due_date', { ascending: true }),
                getProfile(user.id),
                fetch('/api/admin/settings')
            ]);

            if (invoicesRes.error) throw invoicesRes.error;
            setInvoices(invoicesRes.data || []);
            if (profileRes) setProfile({ ...profileRes, id: user.id, email: user.email });
            
            if(settingsRes.ok) {
                const settingsData = await settingsRes.json();
                if(settingsData.negotiation_interest) {
                    setNegotiationRate(parseFloat(settingsData.negotiation_interest));
                }
            }

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
            let groupName = inv.month;
            const match = inv.month.match(/^(.*?)\s*\(\d+\/\d+\)$/);
            if (match) {
                groupName = match[1].trim();
            } else if (inv.notes && inv.notes.includes('Referente a compra de')) {
                 const noteMatch = inv.notes.match(/Referente a compra de (.*?) parcelada/);
                 if (noteMatch) groupName = noteMatch[1].trim();
            }

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
                const isLate = new Date(inv.due_date) < new Date();
                g.status = isLate ? 'late' : 'active';
                
                if (!g.nextDueDate || new Date(inv.due_date) < new Date(g.nextDueDate)) {
                    g.nextDueDate = inv.due_date;
                }
            }
        });

        return Object.values(groups).sort((a, b) => {
            if (a.status === 'late' && b.status !== 'late') return -1;
            if (a.status !== 'late' && b.status === 'late') return 1;
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            if (a.nextDueDate && b.nextDueDate) return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
            return 0;
        });
    }, [invoices]);

    const activeGroups = groupedInvoices.filter(g => g.status !== 'completed');
    const completedGroups = groupedInvoices.filter(g => g.status === 'completed');
    const totalDue = activeGroups.reduce((acc, g) => acc + g.remainingAmount, 0);
    const overdueInvoices = invoices.filter(i => (i.status === 'Em aberto' || i.status === 'Boleto Gerado') && new Date(i.due_date) < new Date());
    const lateCount = overdueInvoices.length;

    // Calculate Limits
    const creditLimit = profile?.credit_limit || 0;
    const availableLimit = Math.max(0, creditLimit - totalDue);

    const handlePaymentSuccess = useCallback(async (paymentId: string | number) => {
        // Se for pagamento em massa
        if (bulkSelection.length > 0) {
            const updates = bulkSelection.map(inv => 
                supabase.from('invoices').update({ status: 'Paga', payment_id: String(paymentId), payment_date: new Date().toISOString() }).eq('id', inv.id)
            );
            await Promise.all(updates);
            
            setInvoices(prev => prev.map(inv => 
                bulkSelection.find(b => b.id === inv.id) ? {...inv, status: 'Paga', payment_date: new Date().toISOString()} : inv
            ));
            setBulkSelection([]);
        } else if (selectedInvoice) {
            // Pagamento único
            setInvoices(prev => prev.map(inv => inv.id === selectedInvoice.id ? {...inv, status: 'Paga', payment_date: new Date().toISOString()} : inv));
            await supabase.from('invoices').update({ status: 'Paga', payment_id: String(paymentId), payment_date: new Date().toISOString() }).eq('id', selectedInvoice.id);
        }

        setSelectedInvoice(null);
        setPaymentStep('list');
        addToast('Pagamento confirmado!', 'success');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
    }, [selectedInvoice, bulkSelection, addToast]);

    const generateReceipt = (invoice: Invoice) => {
        const doc = new jsPDF();
        doc.setFont('helvetica', 'bold');
        doc.text("RECIBO DE PAGAMENTO - RELP CELL", 20, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text(`Pagador: ${profile?.first_name} ${profile?.last_name}`, 20, 40);
        doc.text(`CPF: ${profile?.identification_number || 'N/A'}`, 20, 46);
        doc.text(`Referente a: ${invoice.month}`, 20, 56);
        doc.text(`Valor: ${invoice.amount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}`, 20, 62);
        doc.text(`Data do Pagamento: ${new Date(invoice.payment_date!).toLocaleDateString('pt-BR')}`, 20, 68);
        doc.text(`ID da Transação: ${invoice.payment_id}`, 20, 74);
        doc.save(`recibo_${invoice.id}.pdf`);
        addToast('Recibo baixado!', 'success');
    };

    const handleBulkPay = () => {
        if (bulkSelection.length === 0) return;
        
        // Create a "Virtual" Invoice summing everything up
        const totalAmount = bulkSelection.reduce((sum, i) => sum + i.amount, 0);
        const virtualInvoice: Invoice = {
            ...bulkSelection[0], // Inherit base props
            id: 'bulk_' + Date.now(), // Temp ID
            amount: totalAmount,
            month: `Antecipação de ${bulkSelection.length} parcelas`,
            discountValue: totalAmount * 0.05 // 5% discount simulation for anticipation
        };
        // Aplica desconto
        virtualInvoice.amount = totalAmount - (virtualInvoice.discountValue || 0);

        setSelectedInvoice(virtualInvoice);
        setPaymentStep('select_method');
    };

    const updateBulkSelection = (invoiceId: string) => {
        const inv = invoices.find(i => i.id === invoiceId);
        if (!inv) return;

        setBulkSelection(prev => {
            if (prev.find(i => i.id === invoiceId)) {
                return prev.filter(i => i.id !== invoiceId);
            }
            return [...prev, inv];
        });
    };

    const handleRenegotiationConfirm = (dealInvoice: Invoice) => {
        // Fecha o modal de renegociação
        setIsRenegotiating(false);
        // Abre o fluxo normal de pagamento com boleto já pré-selecionado
        setSelectedInvoice(dealInvoice);
        setPaymentStep('pay_boleto'); // Vai direto para a geração do boleto com os dados do acordo
    };

    // Render Payment Flow
    if (paymentStep !== 'list' && selectedInvoice) {
        switch (paymentStep) {
            case 'select_method': return <PaymentMethodSelector invoice={selectedInvoice} onSelectMethod={(m) => { if(m==='brick') setPaymentStep('pay_card'); else if(m==='pix') setPaymentStep('pay_pix'); else if(m==='boleto') setPaymentStep('pay_boleto'); }} onBack={() => {setPaymentStep('list'); setBulkSelection([]);}} />;
            case 'pay_card': return <PaymentForm invoice={selectedInvoice} mpPublicKey={mpPublicKey} onBack={() => setPaymentStep('select_method')} onPaymentSuccess={handlePaymentSuccess} />;
            case 'pay_pix': return <PixPayment invoice={selectedInvoice} onBack={() => setPaymentStep('select_method')} onPaymentConfirmed={() => {setPaymentStep('list'); fetchInvoices(); setShowConfetti(true);}} />;
            case 'pay_boleto': return <BoletoPayment invoice={selectedInvoice} onBack={() => {setPaymentStep('list'); setSelectedInvoice(null);}} onBoletoGenerated={(updated) => { setInvoices(p => p.map(i => i.id === updated.id ? updated : i)); setSelectedInvoice(updated); setPaymentStep('boleto_details'); }} />;
            case 'boleto_details': return <BoletoDetails invoice={selectedInvoice} onBack={() => setPaymentStep('list')} />;
            default: return null;
        }
    }

    return (
        <div className="w-full max-w-md space-y-6 animate-fade-in pb-safe relative">
            {showConfetti && <Confetti />}
            
            {/* Banner de Renegociação se houver atrasos */}
            {lateCount > 0 && activeTab === 'active' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center justify-between shadow-sm animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 dark:bg-red-800 p-2 rounded-full text-red-600 dark:text-red-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <p className="font-bold text-red-700 dark:text-red-300 text-sm">Faturas em Atraso</p>
                            <p className="text-xs text-red-600 dark:text-red-400">Evite bloqueios e juros.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsRenegotiating(true)}
                        className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg shadow hover:bg-red-700 transition-colors"
                    >
                        Renegociar
                    </button>
                </div>
            )}

            {/* Header Financeiro */}
            <FinancialHeader totalDue={totalDue} creditLimit={creditLimit} availableLimit={availableLimit} />

            {/* Abas de Navegação */}
            <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
                <button onClick={() => setActiveTab('active')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    Em Aberto
                </button>
                <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    Histórico
                </button>
            </div>

            {/* Conteúdo */}
            <div className="space-y-4 min-h-[300px]">
                {isLoading ? (
                    <> <CardSkeleton /> <CardSkeleton /> </>
                ) : errorInfo ? (
                    <Alert message={errorInfo.message} type="error" />
                ) : activeTab === 'active' ? (
                    <>
                        {activeGroups.length > 0 ? (
                            activeGroups.map(group => (
                                <PurchaseGroupCard 
                                    key={group.id} 
                                    group={group} 
                                    isOpenDefault={group.status === 'late'}
                                    onPay={(i) => { setSelectedInvoice(i); setPaymentStep('select_method'); }}
                                    onDetails={(i) => { setSelectedInvoice(i); setPaymentStep('boleto_details'); }}
                                    onReceipt={generateReceipt}
                                    onSelectMultiple={(ids) => { 
                                        ids.forEach(id => {
                                            if(!bulkSelection.find(b=>b.id===id)) updateBulkSelection(id);
                                        });
                                    }}
                                />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center opacity-70">
                                <CheckCircle />
                                <p className="mt-2 text-slate-600 dark:text-slate-300 font-medium">Tudo em dia!</p>
                                <p className="text-xs text-slate-400">Aproveite seu limite disponível na loja.</p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="animate-fade-in">
                        <SpendingChart invoices={invoices} />
                        
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent dark:before:via-slate-700">
                            {completedGroups.length > 0 ? (
                                completedGroups.map(group => (
                                    <div key={group.id} className="relative pl-10">
                                        <div className="absolute left-0 top-5 mt-1.5 ml-1.5 h-2 w-2 rounded-full border border-white bg-slate-300 dark:border-slate-900 dark:bg-slate-700"></div>
                                        <PurchaseGroupCard 
                                            group={group} 
                                            onPay={() => {}} 
                                            onDetails={() => {}}
                                            onReceipt={generateReceipt}
                                            onSelectMultiple={() => {}}
                                        />
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-slate-400 text-sm">Nenhum histórico disponível.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Botão Flutuante de Pagamento em Massa */}
            {bulkSelection.length > 0 && (
                <div className="fixed bottom-24 left-0 right-0 px-4 z-50 animate-fade-in-up">
                    <div className="max-w-md mx-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-4 rounded-2xl shadow-xl flex justify-between items-center">
                        <div>
                            <p className="text-xs opacity-80">{bulkSelection.length} faturas selecionadas</p>
                            <p className="font-bold text-lg">
                                {bulkSelection.reduce((acc, i) => acc + i.amount, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                        <button 
                            onClick={handleBulkPay}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold transition-colors"
                        >
                            Pagar Agora
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Renegociação */}
            <Modal isOpen={isRenegotiating} onClose={() => setIsRenegotiating(false)}>
                <RenegotiationModal 
                    overdueInvoices={overdueInvoices} 
                    onClose={() => setIsRenegotiating(false)}
                    onConfirm={handleRenegotiationConfirm}
                    maxInterestRate={negotiationRate}
                />
            </Modal>
        </div>
    );
};

export default PageFaturas;