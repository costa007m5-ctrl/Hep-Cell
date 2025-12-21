
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

    useEffect(() => {
        const load = async () => {
            const { data } = await fetch('/api/admin/settings').then(r => r.json());
            setInterestRate(parseFloat(data?.interest_rate) || 0);
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
            if (!response.ok) throw new Error(result.error);
            setPaymentResult(result.paymentData);
        } catch (err: any) { setError(err.message); setStep('config'); } finally { setIsProcessing(false); }
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
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Finalizar Compra</h2>
                    <Logo className="h-6 w-6" />
                </div>

                {step === 'config' && (
                    <div className="space-y-4">
                        <div className="flex p-1 bg-slate-100 rounded-xl">
                            <button onClick={() => setSaleType('direct')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-white text-indigo-600' : 'text-slate-500'}`}>À Vista</button>
                            <button onClick={() => setSaleType('crediario')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${saleType === 'crediario' ? 'bg-white text-indigo-600' : 'text-slate-500'}`}>Crediário</button>
                        </div>
                        {saleType === 'crediario' && (
                            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Entrada (R$)</label>
                                <input type="number" value={downPayment} onChange={e => setDownPayment(e.target.value)} className="w-full p-3 rounded-lg border focus:ring-2 focus:ring-indigo-500" placeholder="0,00" />
                                <label className="block text-xs font-bold text-slate-500 uppercase">Parcelas</label>
                                <select value={installments} onChange={e => setInstallments(Number(e.target.value))} className="w-full p-3 rounded-lg border">
                                    {[1,2,3,4,5,6,10,12].map(n => <option key={n} value={n}>{n}x de R$ {(financed / n).toFixed(2)}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                            {['pix', 'boleto', 'redirect'].map(m => (
                                <button key={m} onClick={() => setPaymentMethod(m as any)} className={`py-3 border rounded-xl text-[10px] font-bold uppercase transition-all ${paymentMethod === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500'}`}>{m}</button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 'address' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Seu CEP</label>
                            <input 
                                type="text" value={cep} 
                                onChange={e => { setCep(e.target.value); handleCepLookup(e.target.value); }} 
                                className="w-full p-3 rounded-xl border font-bold" placeholder="00000-000" maxLength={9}
                            />
                            {isLoadingCep && <div className="absolute right-3 top-8"><LoadingSpinner /></div>}
                        </div>
                        {address.street && (
                            <div className="grid grid-cols-4 gap-3 animate-fade-in">
                                <div className="col-span-3">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Endereço Autopreenchido</p>
                                    <p className="text-sm font-bold text-slate-800">{address.street}, {address.neighborhood}</p>
                                    <p className="text-xs text-slate-500">{address.city}, {address.uf}</p>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Nº</label>
                                    <input ref={numRef} type="text" value={address.number} onChange={e => setAddress({...address, number: e.target.value})} className="w-full p-2 border rounded-lg font-bold" />
                                </div>
                                <div className="col-span-4">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Complemento (Opcional)</label>
                                    <input type="text" value={address.complement} onChange={e => setAddress({...address, complement: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Ex: Próximo ao posto..." />
                                </div>
                            </div>
                        )}
                        {shippingCost > 0 && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex justify-between items-center">
                                <span className="text-xs font-bold text-green-700">Frete Amapá Express:</span>
                                <span className="font-black text-green-800">R$ {shippingCost.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                )}

                {step === 'contract' && (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500">Leia e assine o contrato para prosseguir com o crediário.</p>
                        <div className="h-40 overflow-y-auto p-3 bg-slate-50 rounded border text-[10px] text-slate-600">
                             Termos de compra e reserva de domínio para o Amapá...
                        </div>
                        <SignaturePad onEnd={setSignature} />
                    </div>
                )}

                {error && <Alert message={error} type="error" />}

                <button 
                    onClick={next} 
                    disabled={isProcessing || isLoadingCep}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {isProcessing ? <LoadingSpinner /> : 'Continuar'}
                </button>
            </div>
            {paymentResult && (
                <div className="fixed inset-0 z-[200] bg-white dark:bg-slate-900 p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-2xl font-black mb-4">Pedido Reservado!</h3>
                    <p className="text-slate-500 mb-8">Pague o {paymentResult.type.toUpperCase()} agora para liberar sua entrega em {address.city}.</p>
                    <button onClick={() => { onClose(); onSuccess(); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold">Ver Meus Pedidos</button>
                </div>
            )}
        </Modal>
    );
};

export default PurchaseModal;
