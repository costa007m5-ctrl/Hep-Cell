
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Profile } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Alert from '../Alert';
import SignaturePad from '../SignaturePad';
import Modal from '../Modal';
import Logo from '../Logo'; 
import { supabase } from '../../services/clients';

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
    const [step, setStep] = useState<Step>('config');
    const [saleType, setSaleType] = useState<SaleType>('direct');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    const [downPayment, setDownPayment] = useState<string>('');
    const [installments, setInstallments] = useState<number>(1);
    const [signature, setSignature] = useState<string | null>(null);
    const [selectedDueDay, setSelectedDueDay] = useState(10);
    
    // Endereço
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
    const [shippingDays, setShippingDays] = useState(0);
    const [isLoadingCep, setIsLoadingCep] = useState(false);
    const numRef = useRef<HTMLInputElement>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentResult, setPaymentResult] = useState<any>(null);
    
    const [interestRate, setInterestRate] = useState(0);

    // Classes de Input Padronizadas para Alta Visibilidade
    const inputClass = "w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all";
    const selectClass = "w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all";

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await fetch('/api/admin/settings').then(r => r.json());
                setInterestRate(parseFloat(data?.interest_rate) || 0);
            } catch(e) { console.error(e); }
        };
        load();
        if (cep) handleCepLookup(cep);
    }, []);

    const handleCepLookup = async (value: string) => {
        const clean = value.replace(/\D/g, '');
        if (clean.length !== 8) return;
        setIsLoadingCep(true);
        setError(null);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
            const data = await res.json();
            if (data.erro) throw new Error("CEP não encontrado.");
            if (data.uf !== 'AP') throw new Error("Entregamos apenas no Amapá.");
            
            setAddress(prev => ({
                ...prev,
                street: data.logradouro,
                neighborhood: data.bairro,
                city: data.localidade,
                uf: data.uf
            }));

            // Cálculo Frete
            const isLarge = (product.weight || 0) > 2000;
            const base = data.localidade === 'Santana' ? 7.90 : 12.90;
            setShippingCost(base + ((product.weight || 500)/1000) * 2.5);
            setShippingDays(isLarge ? 6 : 3);
            
            numRef.current?.focus();
        } catch (e: any) { setError(e.message); } finally { setIsLoadingCep(false); }
    };

    const finalPrice = product.price + shippingCost;
    const dpVal = Math.min(parseFloat(downPayment) || 0, finalPrice);
    const financed = Math.max(0, finalPrice - dpVal);
    const totalWithInterest = installments > 1 ? financed * Math.pow(1 + (interestRate/100), installments) : financed;
    const instVal = installments > 0 ? totalWithInterest / installments : 0;

    const handleConfirm = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: profile.id,
                    productName: product.name,
                    totalAmount: financed + dpVal,
                    installments,
                    signature,
                    saleType,
                    paymentMethod,
                    downPayment: dpVal,
                    dueDay: selectedDueDay,
                    address: { ...address, cep }
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Erro ao processar venda.");
            setPaymentResult(result.paymentData);
        } catch (err: any) { 
            console.error(err);
            setError(err.message); 
            // Se erro, volta para step anterior apropriado
            if (step === 'contract') setStep('contract'); 
            else setStep('config');
        } finally { 
            setIsProcessing(false); 
        }
    };

    const next = () => {
        if (step === 'config') setStep('address');
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
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Finalizar Compra</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{product.name}</p>
                    </div>
                    <Logo className="h-8 w-8" />
                </div>

                {step === 'config' && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                            <button onClick={() => setSaleType('direct')} className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-white dark:bg-slate-600 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-300'}`}>À Vista</button>
                            <button onClick={() => setSaleType('crediario')} className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${saleType === 'crediario' ? 'bg-white dark:bg-slate-600 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-300'}`}>Crediário</button>
                        </div>
                        
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
                    </div>
                )}

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
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Endereço Confirmado</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{address.street}, {address.neighborhood}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{address.city}, {address.uf}</p>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nº</label>
                                    <input ref={numRef} type="text" value={address.number} onChange={e => setAddress({...address, number: e.target.value})} className={inputClass} />
                                </div>
                                <div className="col-span-4">
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Complemento (Opcional)</label>
                                    <input type="text" value={address.complement} onChange={e => setAddress({...address, complement: e.target.value})} className={inputClass} placeholder="Ex: Apto 101" />
                                </div>
                            </div>
                        )}
                        {shippingCost > 0 && (
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex justify-between items-center">
                                <span className="text-xs font-bold text-green-700 dark:text-green-300">Frete Amapá Express:</span>
                                <span className="font-black text-green-800 dark:text-green-200">R$ {shippingCost.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                )}

                {step === 'contract' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Assine digitalmente para confirmar o crediário.</p>
                        </div>
                        <div className="h-32 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed">
                             CONTRATO DE ADESÃO AO CREDIÁRIO RELP CELL... (Texto Legal Simulado)
                        </div>
                        <SignaturePad onEnd={setSignature} />
                    </div>
                )}

                {error && <div className="animate-fade-in"><Alert message={error} type="error" /></div>}

                <div className="pt-2">
                    <button 
                        onClick={next} 
                        disabled={isProcessing || (step === 'address' && isLoadingCep)}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/30 disabled:opacity-50 flex justify-center items-center gap-2 transition-all active:scale-[0.98]"
                    >
                        {isProcessing ? <LoadingSpinner /> : (step === 'contract' ? 'CONFIRMAR E ASSINAR' : 'CONTINUAR')}
                    </button>
                </div>
            </div>

            {paymentResult && (
                <div className="fixed inset-0 z-[300] bg-white dark:bg-slate-900 p-8 flex flex-col items-center justify-center text-center animate-pop-in">
                    <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 mb-6 shadow-lg shadow-green-500/20">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Pedido Criado!</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs mx-auto">
                        Sua compra foi registrada. Acesse suas faturas para realizar o pagamento.
                    </p>
                    <button onClick={() => { onClose(); onSuccess(); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Ver Minhas Faturas</button>
                </div>
            )}
        </Modal>
    );
};

export default PurchaseModal;
