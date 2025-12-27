
// ... Imports anteriores mantidos ...
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Profile } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Alert from '../Alert';
import SignaturePad from '../SignaturePad';
import Modal from '../Modal';
import Logo from '../Logo'; 
import { supabase } from '../../services/clients';

// ... Interfaces mantidas ...
interface PurchaseModalProps {
    product: Product;
    profile: Profile;
    onClose: () => void;
    onSuccess: () => void;
}

type SaleType = 'crediario' | 'direct';
type PaymentMethod = 'pix' | 'boleto' | 'redirect';
type Step = 'config' | 'address' | 'contract' | 'processing' | 'payment';

const PurchaseModal: React.FC<PurchaseModalProps> = ({ product, profile, onClose, onSuccess }) => {
    // ... Estados mantidos ...
    const [step, setStep] = useState<Step>('config');
    const [saleType, setSaleType] = useState<SaleType>('direct');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    const [downPayment, setDownPayment] = useState<string>('');
    const [installments, setInstallments] = useState<number>(1);
    const [signature, setSignature] = useState<string | null>(null);
    const [selectedDueDay, setSelectedDueDay] = useState(10);
    
    // Coins & Address & Internal states
    const [useCoins, setUseCoins] = useState(false);
    const [userCoins, setUserCoins] = useState(0);
    const [cep, setCep] = useState(profile.zip_code || '');
    const [address, setAddress] = useState({
        street: profile.street_name || '',
        number: profile.street_number || '',
        neighborhood: profile.neighborhood || '',
        city: profile.city || '',
        uf: profile.federal_unit || '',
        complement: ''
    });
    const [shippingCost, setShippingCost] = useState(0);
    const [isLoadingCep, setIsLoadingCep] = useState(false);
    const numRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentResult, setPaymentResult] = useState<any>(null);
    const [interestRate, setInterestRate] = useState(0);
    
    // --- ESTADO NOVO: LIMITE DISPONÍVEL ---
    const [availableMonthlyLimit, setAvailableMonthlyLimit] = useState(0);

    const inputClass = "w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-400";
    const selectClass = "w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all";

    useEffect(() => {
        const load = async () => {
            try {
                // Carrega juros e saldo atualizado
                const [settingsRes, profileRes] = await Promise.all([
                    fetch('/api/admin/settings'),
                    supabase.from('profiles').select('coins_balance, credit_limit').eq('id', profile.id).single()
                ]);
                
                const settingsData = await settingsRes.json();
                setInterestRate(parseFloat(settingsData?.data?.interest_rate) || 0);
                
                if (profileRes.data) {
                    setUserCoins(profileRes.data.coins_balance || 0);
                    const limitTotal = profileRes.data.credit_limit || 0;

                    // Calcula limite usado MENSALMENTE
                    const { data: invoices } = await supabase
                        .from('invoices')
                        .select('amount, due_date, notes, month')
                        .eq('user_id', profile.id)
                        .or('status.eq.Em aberto,status.eq.Boleto Gerado');
                    
                    const monthlyCommitments: Record<string, number> = {};
                    invoices?.forEach(inv => {
                        // Ignora Avulsas e Entradas no cálculo de comprometimento mensal
                        if (inv.notes?.includes('VENDA_AVISTA') || inv.notes?.includes('ENTRADA')) return;
                        
                        const dueMonth = inv.due_date.substring(0, 7);
                        monthlyCommitments[dueMonth] = (monthlyCommitments[dueMonth] || 0) + inv.amount;
                    });
                    
                    const maxUsed = Math.max(0, ...Object.values(monthlyCommitments));
                    setAvailableMonthlyLimit(Math.max(0, limitTotal - maxUsed));
                }
            } catch(e) { console.error(e); }
        };
        load();
        if (cep) handleCepLookup(cep);
    }, [profile.id]);

    const handleCepLookup = async (value: string) => {
        // ... (Lógica de CEP mantida) ...
        const clean = value.replace(/\D/g, '');
        if (clean.length !== 8) return;
        setIsLoadingCep(true);
        setError(null);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
            const data = await res.json();
            if (data.erro) throw new Error("CEP não encontrado.");
            if (data.uf !== 'AP') throw new Error("Entregamos apenas no Amapá.");
            setAddress(prev => ({ ...prev, street: data.logradouro, neighborhood: data.bairro, city: data.localidade, uf: data.uf }));
            const base = data.localidade === 'Santana' ? 7.90 : 12.90;
            setShippingCost(base + ((product.weight || 500)/1000) * 2.5);
            numRef.current?.focus();
        } catch (e: any) { setError(e.message); } finally { setIsLoadingCep(false); }
    };

    // Cálculos Financeiros
    const basePrice = product.price + shippingCost;
    const coinDiscountValue = useCoins ? Math.min(userCoins / 100, basePrice) : 0;
    const finalPrice = basePrice - coinDiscountValue;

    const dpVal = Math.min(parseFloat(downPayment) || 0, finalPrice);
    const financed = Math.max(0, finalPrice - dpVal);
    const totalWithInterest = installments > 1 ? financed * Math.pow(1 + (interestRate/100), installments) : financed;
    const instVal = installments > 0 ? totalWithInterest / installments : 0;

    // Gerador de Texto do Contrato
    const contractText = useMemo(() => {
        // ... (Lógica de texto mantida) ...
        const today = new Date().toLocaleDateString('pt-BR');
        return `CONTRATO DE COMPRA E VENDA - RELP CELL\n\nOBJETO:\nAquisição de 01 (um) ${product.name} - Valor Original: R$ ${product.price.toFixed(2)}.\n\nCONDIÇÕES:\nValor Financiado: R$ ${financed.toFixed(2)}\nParcelamento: ${installments}x de R$ ${instVal.toFixed(2)}\n\nMacapá/Santana, ${today}.`;
    }, [product, profile, dpVal, financed, installments, instVal, selectedDueDay, address]);

    const handleConfirm = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const response = await fetch('/api/admin?action=create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: profile.id,
                    productName: product.name,
                    totalAmount: finalPrice, 
                    installments,
                    signature,
                    saleType,
                    paymentMethod,
                    downPayment: dpVal,
                    dueDay: selectedDueDay,
                    address: { ...address, cep },
                    coinsUsed: useCoins ? Math.floor(coinDiscountValue * 100) : 0, 
                    discountValue: coinDiscountValue
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Erro ao processar venda.");
            setPaymentResult(result.paymentData);
        } catch (err: any) { 
            console.error(err);
            setError(err.message); 
            if (step === 'contract') setStep('contract'); 
            else setStep('config');
        } finally { 
            setIsProcessing(false); 
        }
    };

    const next = () => {
        if (step === 'config') {
            // VALIDAÇÃO DE CRÉDITO CRÍTICA AQUI
            if (saleType === 'crediario') {
                if (instVal > availableMonthlyLimit) {
                    setError(`Limite excedido! Sua parcela (R$ ${instVal.toFixed(2)}) é maior que sua margem disponível (R$ ${availableMonthlyLimit.toFixed(2)}). Aumente a entrada.`);
                    return;
                }
            }
            setStep('address');
        }
        else if (step === 'address') {
            if (!address.number) { setError("Informe o número da residência."); return; }
            if (saleType === 'crediario') setStep('contract');
            else handleConfirm();
        } else if (step === 'contract') handleConfirm();
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Checkout</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{product.name}</p>
                    </div>
                    <Logo className="h-8 w-8" />
                </div>

                {step === 'config' && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                            <button onClick={() => setSaleType('direct')} className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-white dark:bg-slate-600 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-300'}`}>À Vista</button>
                            <button onClick={() => setSaleType('crediario')} className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${saleType === 'crediario' ? 'bg-white dark:bg-slate-600 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-300'}`}>Crediário</button>
                        </div>

                        {/* Relp Coins Toggle */}
                        {userCoins > 0 && (
                            <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-yellow-400 text-yellow-900 flex items-center justify-center font-bold text-[10px]">RC</div>
                                    <div>
                                        <p className="text-xs font-bold text-yellow-800 dark:text-yellow-200">Usar Relp Coins</p>
                                        <p className="text-[10px] text-yellow-700 dark:text-yellow-300">Saldo: {userCoins} (R$ {(userCoins/100).toFixed(2)})</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={useCoins} onChange={e => setUseCoins(e.target.checked)} />
                                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
                                </label>
                            </div>
                        )}
                        
                        {saleType === 'crediario' && (
                            <div className="space-y-4 p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                <div>
                                    <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase mb-1.5">Entrada (R$)</label>
                                    <input 
                                        type="number" 
                                        value={downPayment} 
                                        onChange={e => setDownPayment(e.target.value)} 
                                        className={inputClass} 
                                        placeholder="0,00" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase mb-1.5">Parcelas</label>
                                    <select value={installments} onChange={e => setInstallments(Number(e.target.value))} className={selectClass}>
                                        {[1,2,3,4,5,6,10,12].map(n => <option key={n} value={n}>{n}x de R$ {(financed / n).toFixed(2)}</option>)}
                                    </select>
                                </div>
                                
                                {/* Aviso de Limite */}
                                <div className="text-right">
                                    <p className="text-[10px] text-indigo-400 font-bold uppercase">Sua Margem Disponível</p>
                                    <p className={`text-lg font-black ${instVal > availableMonthlyLimit ? 'text-red-500' : 'text-indigo-600'}`}>
                                        R$ {availableMonthlyLimit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        {saleType === 'direct' && (
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Método de Pagamento</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['pix', 'boleto', 'redirect'].map(m => (
                                        <button key={m} onClick={() => setPaymentMethod(m as any)} className={`py-3 border rounded-xl text-[10px] font-bold uppercase transition-all ${paymentMethod === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                                            {m === 'redirect' ? 'Cartão' : m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-end">
                                <span className="text-sm text-slate-500">Total Final</span>
                                <span className="text-2xl font-black text-slate-900 dark:text-white">R$ {finalPrice.toFixed(2)}</span>
                            </div>
                            {useCoins && <p className="text-xs text-green-600 text-right font-bold mt-1">- R$ {coinDiscountValue.toFixed(2)} (Coins)</p>}
                        </div>
                    </div>
                )}

                {/* ... Steps Address e Contract mantidos iguais ao original, omitidos para brevidade mas incluídos na estrutura ... */}
                {step === 'address' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Seu CEP</label>
                            <input 
                                type="text" value={cep} 
                                onChange={e => { setCep(e.target.value); handleCepLookup(e.target.value); }} 
                                className={inputClass} placeholder="00000-000" maxLength={9}
                            />
                            {isLoadingCep && <div className="absolute right-3 top-8"><LoadingSpinner /></div>}
                        </div>
                        {address.street && (
                            <div className="grid grid-cols-4 gap-3 animate-fade-in-up">
                                <div className="col-span-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{address.street}, {address.neighborhood}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{address.city}, {address.uf}</p>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nº</label>
                                    <input ref={numRef} type="text" value={address.number} onChange={e => setAddress({...address, number: e.target.value})} className={inputClass} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === 'contract' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="h-48 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                             {contractText}
                        </div>
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
                            <label className="block text-xs font-bold text-slate-500 mb-2">Sua Assinatura:</label>
                            <SignaturePad onEnd={setSignature} />
                        </div>
                    </div>
                )}

                {error && <div className="animate-fade-in"><Alert message={error} type="error" /></div>}

                <div className="pt-2">
                    <button 
                        onClick={next} 
                        disabled={isProcessing || (step === 'address' && isLoadingCep) || (step === 'contract' && !signature)}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/30 disabled:opacity-50 flex justify-center items-center gap-2 transition-all active:scale-[0.98]"
                    >
                        {isProcessing ? <LoadingSpinner /> : (step === 'contract' ? 'CONFIRMAR PEDIDO' : 'CONTINUAR')}
                    </button>
                </div>
            </div>

            {paymentResult && (
                <div className="fixed inset-0 z-[300] bg-white dark:bg-slate-900 p-8 flex flex-col items-center justify-center text-center animate-pop-in">
                    <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 mb-6 shadow-lg shadow-green-500/20">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Pedido Criado!</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto">
                        Sua compra foi registrada.
                    </p>
                    <button onClick={() => { onClose(); onSuccess(); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Ver Meus Pedidos</button>
                </div>
            )}
        </Modal>
    );
};

export default PurchaseModal;
