import React, { useState, useEffect, useMemo } from 'react';
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
type Step = 'config' | 'date_selection' | 'contract' | 'processing' | 'payment'; // Adicionado date_selection

const PaymentResultModal: React.FC<{ data: any; onClose: () => void }> = ({ data, onClose }) => {
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pedido Realizado!</h3>
                <p className="text-sm text-slate-500">Realize o pagamento abaixo para liberar sua compra.</p>
                
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
    const [step, setStep] = useState<Step>('config');
    const [saleType, setSaleType] = useState<SaleType>('direct');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    
    const [downPayment, setDownPayment] = useState<string>('');
    const [installments, setInstallments] = useState<number>(1);
    const [signature, setSignature] = useState<string | null>(null);
    const [selectedDueDay, setSelectedDueDay] = useState(profile.preferred_due_day || 10); // Usa do perfil ou 10
    const [countdown, setCountdown] = useState<number | null>(null);
    
    // Coins
    const [useCoins, setUseCoins] = useState(false);
    const [coinsBalance, setCoinsBalance] = useState(profile.coins_balance || 0);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentResult, setPaymentResult] = useState<any>(null);
    
    // Configurações e Limites
    const [interestRate, setInterestRate] = useState(0);
    const [minEntryPercentage, setMinEntryPercentage] = useState(0.15); // Default 15%
    const [usedMonthlyLimit, setUsedMonthlyLimit] = useState(0);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const resSettings = await fetch('/api/admin/settings');
                if(resSettings.ok) {
                    const data = await resSettings.json();
                    setInterestRate(parseFloat(data.interest_rate) || 0);
                    const minEntry = parseFloat(data.min_entry_percentage);
                    if(!isNaN(minEntry)) setMinEntryPercentage(minEntry / 100);
                }

                const { data: invoices } = await supabase
                    .from('invoices')
                    .select('amount, due_date')
                    .eq('user_id', profile.id)
                    .or('status.eq.Em aberto,status.eq.Boleto Gerado');
                
                const monthlyCommitments: Record<string, number> = {};
                invoices?.forEach(inv => {
                    const dueMonth = inv.due_date.substring(0, 7); 
                    monthlyCommitments[dueMonth] = (monthlyCommitments[dueMonth] || 0) + inv.amount;
                });
                
                const maxMonthly = Math.max(0, ...Object.values(monthlyCommitments));
                setUsedMonthlyLimit(maxMonthly);

            } catch (e) { console.error(e); }
        };
        fetchInitialData();
    }, [profile.id]);

    // --- Cálculos Financeiros ---
    const creditLimit = profile.credit_limit || 0;
    const availableMonthlyLimit = Math.max(0, creditLimit - usedMonthlyLimit);
    
    const downPaymentValue = Math.min(parseFloat(downPayment) || 0, product.price);
    const isFullPayment = downPaymentValue >= product.price;

    const coinsValue = coinsBalance / 100;
    const coinsDiscount = useCoins ? Math.min(downPaymentValue > 0 ? downPaymentValue : product.price, coinsValue) : 0;
    const effectiveCashDownPayment = Math.max(0, downPaymentValue - coinsDiscount);
    
    const principalAmount = Math.max(0, product.price - downPaymentValue);
    
    const totalFinancedWithInterest = useMemo(() => {
        if (installments <= 1 || isFullPayment) return principalAmount;
        return principalAmount * Math.pow(1 + (interestRate/100), installments);
    }, [principalAmount, installments, interestRate, isFullPayment]);

    const installmentValue = (installments > 0 && !isFullPayment) ? totalFinancedWithInterest / installments : 0;
    
    // --- Validação ---
    const limitAnalysis = useMemo(() => {
        if (saleType === 'direct') return { isValid: true, message: '' };
        if (isFullPayment) return { isValid: true, message: 'Pagamento Integral (À Vista)' };

        const requiredMinEntry = product.price * minEntryPercentage;
        const maxFinanceable = availableMonthlyLimit * installments;
        const minEntryForLimit = Math.max(0, product.price - maxFinanceable);
        const finalRequiredEntry = Math.max(requiredMinEntry, minEntryForLimit);
        const isSufficient = downPaymentValue >= finalRequiredEntry;

        return {
            isValid: isSufficient,
            requiredEntry: finalRequiredEntry,
            limitExceeded: installmentValue > availableMonthlyLimit,
            message: isSufficient ? '' : `Limite excedido. Entrada mínima necessária: R$ ${finalRequiredEntry.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        };
    }, [saleType, installmentValue, availableMonthlyLimit, downPaymentValue, product.price, minEntryPercentage, installments, isFullPayment]);

    const validationStatus = useMemo(() => {
        if (saleType === 'direct') return { isValid: true };
        return { isValid: limitAnalysis.isValid, message: limitAnalysis.message };
    }, [saleType, limitAnalysis]);

    // Countdown Timer
    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) {
            setCountdown(null);
            handleConfirmPurchase();
        } else {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleConfirmPurchase = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const coinsUsedAmount = useCoins ? Math.floor(coinsDiscount * 100) : 0;
            const generatedContractText = generateContractText();

            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: profile.id,
                    productName: product.name,
                    totalAmount: saleType === 'crediario' ? (downPaymentValue + totalFinancedWithInterest) : product.price,
                    installments: (isFullPayment || saleType === 'direct') ? 1 : installments,
                    signature: isFullPayment ? 'AUTO_SIGNED_FULL_PAYMENT' : signature,
                    saleType: isFullPayment ? 'direct' : saleType,
                    paymentMethod: paymentMethod,
                    downPayment: effectiveCashDownPayment,
                    coinsUsed: coinsUsedAmount,
                    dueDay: selectedDueDay,
                    couponCode: '',
                    contractItems: generatedContractText
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao processar compra.');
            setPaymentResult(result.paymentData);
        } catch (err: any) {
            setError(err.message);
            setStep('config');
        } finally {
            setIsProcessing(false);
        }
    };

    const nextStep = () => {
        if (step === 'config') {
            if (!validationStatus.isValid) {
                setError(validationStatus.message || "Verifique os dados.");
                return;
            }
            
            // Se for crediário e pagamento não total, verificar se precisa escolher a data
            if (saleType === 'crediario' && !isFullPayment) {
                // Se não tem data preferida no perfil, vai para seleção de data
                if (!profile.preferred_due_day) {
                     setStep('date_selection');
                } else {
                     setStep('contract');
                }
            } else if (saleType === 'crediario' && isFullPayment) {
                 setStep('processing');
                 setCountdown(5);
            } else {
                handleConfirmPurchase(); // Venda Direta
            }

        } else if (step === 'date_selection') {
            setStep('contract');
        } else if (step === 'contract') {
            if (!signature) {
                setError("Você precisa assinar o contrato.");
                return;
            }
            handleConfirmPurchase();
        }
    };

    const generateContractText = () => {
        const today = new Date();
        const installmentsList = Array.from({length: installments}, (_, i) => {
            const d = new Date();
            d.setMonth(today.getMonth() + i + 1);
            d.setDate(Math.min(selectedDueDay, 28));
            return `<tr><td style="border: 1px solid #ddd; padding: 4px;">${i+1}ª</td><td style="border: 1px solid #ddd; padding: 4px;">R$ ${installmentValue.toFixed(2)}</td><td style="border: 1px solid #ddd; padding: 4px;">${d.toLocaleDateString('pt-BR')}</td></tr>`;
        }).join('');

        // Retorna texto puro para armazenamento e visualização simples, mas formatado
        return `CONTRATO DE COMPRA E VENDA MERCANTIL COM RESERVA DE DOMÍNIO
Nº PEDIDO: ${Date.now().toString().slice(-8)}

1. DAS PARTES
VENDEDOR: RELP CELL ELETRÔNICOS LTDA, inscrita no CNPJ sob nº 43.735.304/0001-00, com sede em Macapá/AP.
COMPRADOR: ${profile.first_name} ${profile.last_name}, CPF nº ${profile.identification_number}.

2. DO OBJETO
O presente contrato tem como objeto a venda do seguinte produto:
Item: ${product.name}
Valor à Vista: R$ ${product.price.toFixed(2)}

3. DO PREÇO E CONDIÇÕES DE PAGAMENTO
O COMPRADOR pagará à VENDEDORA a importância total de R$ ${(downPaymentValue + totalFinancedWithInterest).toFixed(2)}, da seguinte forma:
3.1. Entrada de R$ ${downPaymentValue.toFixed(2)}, a ser paga na data de assinatura deste instrumento.
3.2. O saldo remanescente de R$ ${principalAmount.toFixed(2)} será acrescido de juros de ${interestRate}% a.m., totalizando R$ ${totalFinancedWithInterest.toFixed(2)}, dividido em ${installments} parcelas mensais e consecutivas.

4. CRONOGRAMA DE VENCIMENTOS
As parcelas vencerão todo dia ${selectedDueDay} de cada mês.

5. DA INADIMPLÊNCIA
O não pagamento de qualquer parcela na data de vencimento acarretará:
a) Multa de mora de 2% (dois por cento) sobre o valor do débito;
b) Juros de mora de 1% (um por cento) ao mês;
c) Vencimento antecipado de todas as parcelas vincendas;
d) Inclusão do nome do COMPRADOR nos órgãos de proteção ao crédito (SPC/SERASA) após 5 dias de atraso.

6. DA RESERVA DE DOMÍNIO
Em conformidade com os arts. 521 a 528 do Código Civil Brasileiro, a VENDEDORA reserva para si a propriedade do bem objeto deste contrato até que o preço esteja integralmente pago pelo COMPRADOR.

7. DO FORO
Fica eleito o foro da comarca de Macapá/AP para dirimir quaisquer dúvidas oriundas deste contrato.

Macapá, ${today.toLocaleDateString('pt-BR')}.`;
    };

    // Renderização do Contrato Visual
    const renderVisualContract = () => {
        const text = generateContractText();
        const today = new Date();
        
        return (
            <div className="bg-white p-8 shadow-sm text-slate-900 font-serif text-xs leading-relaxed border border-slate-200 select-none">
                {/* Header Papel Timbrado */}
                <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-6">
                    <Logo className="h-10 w-10 text-slate-900" showText={false} />
                    <div className="text-right">
                        <h1 className="font-bold text-sm uppercase">Relp Cell Eletrônicos</h1>
                        <p className="text-[10px] text-slate-500">CNPJ: 43.735.304/0001-00</p>
                        <p className="text-[10px] text-slate-500">Macapá - Amapá</p>
                    </div>
                </div>

                <div className="text-center mb-6">
                    <h2 className="font-bold text-base underline">CONTRATO DE COMPRA E VENDA</h2>
                </div>

                {/* Conteúdo Texto */}
                <div className="whitespace-pre-wrap mb-8 font-normal text-justify">
                    {text}
                </div>

                {/* Assinatura da Empresa */}
                <div className="mt-10 mb-6">
                    <div className="relative w-48">
                        <div className="absolute bottom-2 left-0 text-[8px] text-slate-400 font-mono">
                            Assinado digitalmente em {today.toLocaleString()} <br/>
                            Hash: {Math.random().toString(36).substring(2, 15)}
                        </div>
                        <img src="/logo.svg" alt="Assinatura Empresa" className="h-12 w-12 opacity-20 absolute -top-4 left-10" />
                        <div className="border-b border-slate-400 mb-1"></div>
                        <p className="text-[10px] font-bold">RELP CELL ELETRÔNICOS LTDA</p>
                        <p className="text-[8px]">Vendedor Autorizado</p>
                    </div>
                </div>

                {/* Área para Assinatura do Cliente (Visualização) */}
                <div className="mt-10">
                    <div className="w-full h-24 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center relative">
                        {signature ? (
                            <img src={signature} className="max-h-full" alt="Sua Assinatura" />
                        ) : (
                            <span className="text-slate-300 text-[10px]">Sua assinatura aparecerá aqui</span>
                        )}
                    </div>
                    <p className="text-center text-[10px] mt-1 font-bold">{profile.first_name} {profile.last_name}</p>
                </div>
            </div>
        );
    };
    
    const renderDateSelectionStep = () => (
        <div className="space-y-6 text-center p-4">
             <h3 className="text-lg font-bold text-slate-900 dark:text-white">Escolha o Dia do Vencimento</h3>
             <p className="text-sm text-slate-600 dark:text-slate-300">
                Para sua comodidade, escolha o melhor dia para o pagamento das suas parcelas mensais.
             </p>
             
             <div className="grid grid-cols-3 gap-4 my-6">
                 {[5, 15, 25].map(day => (
                     <button
                        key={day}
                        onClick={() => setSelectedDueDay(day)}
                        className={`p-4 rounded-xl border-2 transition-all ${selectedDueDay === day ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold shadow-md transform scale-105' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                     >
                         <span className="text-2xl block mb-1">{day}</span>
                         <span className="text-[10px] uppercase">De cada mês</span>
                     </button>
                 ))}
             </div>
             
             <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl text-xs text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800 text-left">
                 <strong>Atenção:</strong> Esta escolha será salva no seu perfil. Futuras alterações só poderão ser feitas a cada 90 dias através do menu "Configurações" no seu perfil.
             </div>
        </div>
    );

    const renderContractStep = () => (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                {renderVisualContract()}
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-10">
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Assine para concordar:</label>
                <SignaturePad onEnd={setSignature} />
            </div>
        </div>
    );

    const renderConfigStep = () => (
        // ... (Mantido igual ao NewSaleTab logicamente, apenas adaptado para o modal)
        <div className="space-y-6">
            {/* Seleção de Tipo */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button onClick={() => { setSaleType('crediario'); setInstallments(1); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'crediario' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Crediário</button>
                <button onClick={() => { setSaleType('direct'); setInstallments(1); setDownPayment(''); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500'}`}>À Vista</button>
            </div>

            {saleType === 'crediario' && (
                <>
                    {/* Info Limites */}
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-500 uppercase">Valor do Produto</span>
                            <span className="font-bold text-slate-900 dark:text-white">R$ {product.price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Limite Total</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">R$ {creditLimit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Disponível</span>
                                <span className={`font-bold text-sm ${availableMonthlyLimit > 0 ? 'text-green-600' : 'text-red-500'}`}>R$ {availableMonthlyLimit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    </div>

                    {/* Input Entrada */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Sua Entrada (R$)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={downPayment} 
                                onChange={e => { 
                                    const val = Math.min(parseFloat(e.target.value), product.price);
                                    setDownPayment(isNaN(val) ? '' : String(val)); 
                                    setError(null); 
                                }} 
                                max={product.price}
                                className={`w-full p-3 border rounded-lg dark:bg-slate-800 dark:text-white font-bold text-lg focus:ring-2 outline-none transition-all ${!limitAnalysis.isValid ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200 focus:ring-indigo-500'}`}
                                placeholder="0.00" 
                            />
                            {isFullPayment && <span className="absolute right-3 top-3.5 text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">Total</span>}
                        </div>
                        {!limitAnalysis.isValid && <p className="text-xs text-amber-600 mt-1 font-bold">{limitAnalysis.message}</p>}
                    </div>
                    
                    {/* Coins */}
                    {coinsBalance > 0 && (
                        <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] text-yellow-900 font-bold">RC</span>
                                <div>
                                    <p className="text-xs font-bold text-yellow-900">Usar Saldo</p>
                                    <p className="text-[10px] text-yellow-700">Disp: R$ {coinsValue.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {useCoins && <span className="text-xs text-green-600 font-bold">- R$ {coinsDiscount.toFixed(2)}</span>}
                                <input type="checkbox" checked={useCoins} onChange={e => setUseCoins(e.target.checked)} className="w-5 h-5 text-yellow-600 rounded" />
                            </div>
                        </div>
                    )}

                    {/* Parcelas */}
                    {!isFullPayment && (
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Parcelas</label>
                            <select value={installments} onChange={e => setInstallments(Number(e.target.value))} className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-bold bg-white text-slate-900 dark:text-white">
                                {Array.from({length:12},(_,i)=>i+1).map(n => {
                                    const simPrincipal = Math.max(0, product.price - downPaymentValue);
                                    const simTotal = n > 1 ? simPrincipal * Math.pow(1 + (interestRate/100), n) : simPrincipal;
                                    const simVal = simTotal / n;
                                    return <option key={n} value={n}>{n}x de R$ {simVal.toFixed(2)}</option>
                                })}
                            </select>
                        </div>
                    )}

                    {/* Resumo Parcela */}
                    {!isFullPayment && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-indigo-800 dark:text-indigo-300 font-medium">Valor da Parcela</span>
                                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">R$ {installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="h-px bg-indigo-200 dark:bg-indigo-800 my-2"></div>
                            <div className="flex justify-between items-center text-xs text-indigo-600/80 dark:text-indigo-400/80">
                                <span>Financiado: R$ {totalFinancedWithInterest.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                <span>{installments}x</span>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Forma de Pagamento */}
            <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Forma de Pagamento (Entrada/Total)</label>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPaymentMethod('pix')} className={`py-3 border rounded-lg font-bold text-xs flex flex-col items-center gap-1 transition-all ${paymentMethod === 'pix' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Pix</button>
                    <button onClick={() => setPaymentMethod('boleto')} className={`py-3 border rounded-lg font-bold text-xs flex flex-col items-center gap-1 transition-all ${paymentMethod === 'boleto' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Boleto</button>
                    <button onClick={() => setPaymentMethod('redirect')} className={`py-3 border rounded-lg font-bold text-xs flex flex-col items-center gap-1 transition-all ${paymentMethod === 'redirect' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Link</button>
                </div>
            </div>
        </div>
    );

    const renderProcessingStep = () => (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-20 h-20 relative mb-6">
                 <LoadingSpinner />
                <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-indigo-600">
                    {countdown}
                </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Gerando Pagamento...</h3>
            <p className="text-slate-500">Contrato dispensado (Pagamento Total).</p>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
                {step !== 'processing' && (
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {step === 'config' ? 'Configuração do Pedido' : step === 'date_selection' ? 'Vencimento' : 'Contrato Digital'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">✕</button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                    {step === 'config' && renderConfigStep()}
                    {step === 'date_selection' && renderDateSelectionStep()}
                    {step === 'contract' && renderContractStep()}
                    {step === 'processing' && renderProcessingStep()}
                </div>

                {error && <div className="mt-4 shrink-0"><Alert message={error} type="error" /></div>}

                {step !== 'processing' && (
                    <div className="mt-6 flex gap-3 shrink-0 pt-4 border-t border-slate-100 dark:border-slate-800">
                        {step !== 'config' && (
                            <button onClick={() => setStep(step === 'contract' && saleType === 'crediario' && !profile.preferred_due_day ? 'date_selection' : 'config')} className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl font-bold">Voltar</button>
                        )}
                        <button 
                            onClick={nextStep} 
                            disabled={isProcessing || (saleType === 'crediario' && !validationStatus.isValid) || (step === 'date_selection' && !selectedDueDay)} 
                            className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        >
                            {isProcessing ? <LoadingSpinner /> : (step === 'config' ? (isFullPayment ? 'Pagar Agora' : 'Continuar') : step === 'date_selection' ? 'Confirmar Dia' : 'Finalizar e Pagar')}
                        </button>
                    </div>
                )}
            </div>

            {paymentResult && <PaymentResultModal data={paymentResult} onClose={() => { setPaymentResult(null); onSuccess(); }} />}
        </div>
    );
};

export default PurchaseModal;