
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Profile, Invoice } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Alert from '../Alert';
import SignaturePad from '../SignaturePad';
import jsPDF from 'jspdf';
import { supabase } from '../../services/clients';
import Modal from '../Modal';

interface PurchaseModalProps {
    product: Product;
    profile: Profile;
    onClose: () => void;
    onSuccess: () => void;
}

type SaleType = 'crediario' | 'direct';
type PaymentMethod = 'pix' | 'boleto' | 'redirect';

const PaymentResultModal: React.FC<{ data: any; onClose: () => void }> = ({ data, onClose }) => {
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pedido Realizado!</h3>
                <p className="text-sm text-slate-500">Realize o pagamento abaixo para confirmar sua compra.</p>
                
                {data.type === 'pix' && (
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.qrCode)}`} className="mx-auto w-32 h-32 rounded-lg mix-blend-multiply dark:mix-blend-normal" alt="QR Code" />
                        <p className="text-[10px] font-mono text-slate-500 mt-2 break-all bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700 select-all">{data.qrCode}</p>
                        <p className="text-xs font-bold text-indigo-600 mt-2">Pagamento Pix</p>
                    </div>
                )}
                
                {data.type === 'boleto' && (
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="font-bold text-sm text-slate-700 dark:text-white">Código de Barras</p>
                        <p className="text-xs font-mono text-slate-500 mt-1 break-all select-all bg-white dark:bg-slate-900 p-2 rounded">{data.barcode}</p>
                        <a href={data.url} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs underline mt-2 block font-bold">Imprimir Boleto</a>
                    </div>
                )}

                {data.type === 'redirect' && (
                    <div className="space-y-2">
                        <a href={data.url} target="_blank" rel="noreferrer" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold block hover:bg-blue-700">Pagar no Mercado Pago</a>
                    </div>
                )}

                <button onClick={onClose} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700">Fechar</button>
            </div>
        </Modal>
    );
};

const PurchaseModal: React.FC<PurchaseModalProps> = ({ product, profile, onClose, onSuccess }) => {
    const [saleType, setSaleType] = useState<SaleType>('direct');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    
    const [downPayment, setDownPayment] = useState<string>('');
    const [installments, setInstallments] = useState<number>(1);
    const [couponCode, setCouponCode] = useState('');
    const [signature, setSignature] = useState<string | null>(null);
    const [selectedDueDay, setSelectedDueDay] = useState(10);
    
    // Coins
    const [useCoins, setUseCoins] = useState(false);
    const [coinsBalance, setCoinsBalance] = useState(profile.coins_balance || 0);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentResult, setPaymentResult] = useState<any>(null);
    
    // Configurações
    const [interestRate, setInterestRate] = useState(0);
    const [minEntryPercentage, setMinEntryPercentage] = useState(0.15);
    const [usedMonthlyLimit, setUsedMonthlyLimit] = useState(0);
    const [isLoadingLimit, setIsLoadingLimit] = useState(true);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoadingLimit(true);
            try {
                const resSettings = await fetch('/api/admin/settings');
                if(resSettings.ok) {
                    const data = await resSettings.json();
                    setInterestRate(parseFloat(data.interest_rate) || 0);
                    const minEntry = parseFloat(data.min_entry_percentage);
                    if(!isNaN(minEntry)) setMinEntryPercentage(minEntry / 100);
                }

                const { data: invoices, error } = await supabase
                    .from('invoices')
                    .select('amount, due_date')
                    .eq('user_id', profile.id)
                    .or('status.eq.Em aberto,status.eq.Boleto Gerado');
                
                if (error) throw error;
                
                const monthlyCommitments: Record<string, number> = {};
                invoices?.forEach(inv => {
                    const dueMonth = inv.due_date.substring(0, 7); 
                    monthlyCommitments[dueMonth] = (monthlyCommitments[dueMonth] || 0) + inv.amount;
                });
                
                const maxMonthly = Math.max(0, ...Object.values(monthlyCommitments));
                setUsedMonthlyLimit(maxMonthly);

            } catch (e) {
                console.error("Erro ao carregar dados", e);
            } finally {
                setIsLoadingLimit(false);
            }
        };
        fetchInitialData();
    }, [profile.id]);

    const availableMonthlyLimit = Math.max(0, (profile.credit_limit || 0) - usedMonthlyLimit);
    const downPaymentValue = parseFloat(downPayment) || 0;
    
    // Coins logic
    const coinsValue = coinsBalance / 100;
    const coinsDiscount = useCoins ? Math.min(downPaymentValue > 0 ? downPaymentValue : product.price, coinsValue) : 0;
    const effectiveCashDownPayment = Math.max(0, downPaymentValue - coinsDiscount);
    
    const principalAmount = Math.max(0, product.price - downPaymentValue);
    
    const totalFinancedWithInterest = useMemo(() => {
        if (installments <= 1) return principalAmount;
        return principalAmount * Math.pow(1 + (interestRate/100), installments);
    }, [principalAmount, installments, interestRate]);

    const installmentValue = totalFinancedWithInterest / installments;
    
    const validationStatus = useMemo(() => {
        if (saleType !== 'crediario') return { isValid: true };
        
        if (installmentValue > availableMonthlyLimit) return { isValid: false, message: 'Limite excedido.' };
        if (downPaymentValue < (product.price * minEntryPercentage)) return { isValid: false, message: 'Entrada baixa.' };
        
        return { isValid: true };
    }, [saleType, product.price, availableMonthlyLimit, installmentValue, downPaymentValue, minEntryPercentage]);

    const handleConfirmPurchase = async () => {
        if (saleType === 'crediario' && !signature) {
            setError('Assinatura necessária.');
            return;
        }

        setIsProcessing(true);
        setError(null);
        try {
            const coinsUsedAmount = useCoins ? Math.floor(coinsDiscount * 100) : 0;

            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: profile.id,
                    productName: product.name,
                    totalAmount: saleType === 'crediario' ? totalFinancedWithInterest : product.price,
                    installments: saleType === 'crediario' ? installments : 1,
                    signature: signature,
                    saleType: saleType,
                    paymentMethod: paymentMethod,
                    downPayment: effectiveCashDownPayment,
                    coinsUsed: coinsUsedAmount,
                    dueDay: selectedDueDay
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao processar compra.');
            
            setPaymentResult(result.paymentData);
            // On success, show modal, then call parent onSuccess when closed
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Confirmar Pedido</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">✕</button>
                </div>

                <div className="space-y-6">
                    {/* Opções de Venda */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button onClick={() => { setSaleType('crediario'); setInstallments(1); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'crediario' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Crediário</button>
                        <button onClick={() => { setSaleType('direct'); setInstallments(1); setDownPayment(''); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500'}`}>À Vista</button>
                    </div>

                    {/* Inputs */}
                    {saleType === 'crediario' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Entrada (R$)</label>
                                <input type="number" value={downPayment} onChange={e => setDownPayment(e.target.value)} className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-bold" placeholder="0.00" />
                            </div>
                            
                            {/* Coins Switch */}
                            {coinsBalance > 0 && (
                                <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] text-yellow-900 font-bold">RC</span>
                                        <div>
                                            <p className="text-xs font-bold text-yellow-900">Usar Coins</p>
                                            <p className="text-[10px] text-yellow-700">Saldo: R$ {coinsValue.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {useCoins && <span className="text-xs text-green-600 font-bold">- R$ {coinsDiscount.toFixed(2)}</span>}
                                        <input type="checkbox" checked={useCoins} onChange={e => setUseCoins(e.target.checked)} className="w-5 h-5 text-yellow-600 rounded" />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Parcelas</label>
                                <select value={installments} onChange={e => setInstallments(Number(e.target.value))} className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-bold">
                                    {Array.from({length:12},(_,i)=>i+1).map(n => <option key={n} value={n}>{n}x de R$ {(totalFinancedWithInterest/n).toFixed(2)}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    {/* Pagamento */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Forma de Pagamento</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setPaymentMethod('pix')} className={`py-3 border rounded-lg font-bold text-xs ${paymentMethod === 'pix' ? 'bg-green-50 border-green-500 text-green-700' : ''}`}>Pix</button>
                            <button onClick={() => setPaymentMethod('boleto')} className={`py-3 border rounded-lg font-bold text-xs ${paymentMethod === 'boleto' ? 'bg-orange-50 border-orange-500 text-orange-700' : ''}`}>Boleto</button>
                            <button onClick={() => setPaymentMethod('redirect')} className={`py-3 border rounded-lg font-bold text-xs ${paymentMethod === 'redirect' ? 'bg-blue-50 border-blue-500 text-blue-700' : ''}`}>Link</button>
                        </div>
                    </div>

                    {/* Resumo */}
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between text-sm">
                            <span>Total</span>
                            <span className="font-bold">R$ {product.price.toFixed(2)}</span>
                        </div>
                        {saleType === 'crediario' && (
                            <div className="flex justify-between text-sm mt-2 pt-2 border-t dark:border-slate-700">
                                <span>Financiado</span>
                                <span className="font-bold text-indigo-600">R$ {totalFinancedWithInterest.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    {/* Assinatura */}
                    {saleType === 'crediario' && (
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Assinatura</label>
                            <SignaturePad onEnd={setSignature} />
                        </div>
                    )}

                    {error && <Alert message={error} type="error" />}

                    <button 
                        onClick={handleConfirmPurchase} 
                        disabled={isProcessing || (saleType === 'crediario' && !validationStatus.isValid)} 
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
                    >
                        {isProcessing ? <LoadingSpinner /> : 'Finalizar Pedido'}
                    </button>
                </div>
            </div>

            {paymentResult && <PaymentResultModal data={paymentResult} onClose={() => { setPaymentResult(null); onSuccess(); }} />}
        </div>
    );
};

export default PurchaseModal;
