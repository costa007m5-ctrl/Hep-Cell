
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Profile } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Alert from '../Alert';
import SignaturePad from '../SignaturePad';
import Modal from '../Modal';
import Logo from '../Logo'; // Importando Logo para o contrato
import { supabase } from '../../services/clients';

interface PurchaseModalProps {
    product: Product;
    profile: Profile;
    onClose: () => void;
    onSuccess: () => void;
}

type SaleType = 'crediario' | 'direct';
type PaymentMethod = 'pix' | 'boleto' | 'redirect';
type Step = 'config' | 'contract' | 'processing' | 'payment';

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
    const [selectedDueDay, setSelectedDueDay] = useState(10);
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
    
    // Limita a entrada ao valor do produto
    const downPaymentValue = Math.min(parseFloat(downPayment) || 0, product.price);
    const isFullPayment = downPaymentValue >= product.price; // Verifica se está pagando tudo

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

    // Countdown Timer Logic
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
                    signature: isFullPayment ? 'AUTO_SIGNED_FULL_PAYMENT' : signature, // Assinatura automática se pago a vista
                    saleType: isFullPayment ? 'direct' : saleType, // Converte para direct se pagou tudo
                    paymentMethod: paymentMethod,
                    downPayment: effectiveCashDownPayment,
                    coinsUsed: coinsUsedAmount,
                    dueDay: selectedDueDay,
                    couponCode: '',
                    contractItems: generatedContractText // Salva o texto exato do contrato
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao processar compra.');
            setPaymentResult(result.paymentData);
        } catch (err: any) {
            setError(err.message);
            setStep('config'); // Volta se der erro
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
            if (saleType === 'crediario') {
                if (isFullPayment) {
                    // Se pagou tudo, pula contrato e inicia countdown
                    setStep('processing');
                    setCountdown(5);
                } else {
                    setStep('contract');
                }
            } else {
                handleConfirmPurchase();
            }
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
            return `${i+1}ª Parcela: R$ ${installmentValue.toFixed(2)} - Vencimento: ${d.toLocaleDateString('pt-BR')}`;
        }).join('\n');

        return `CONTRATO DE COMPRA E VENDA COM RESERVA DE DOMÍNIO

IDENTIFICAÇÃO DAS PARTES:
VENDEDOR: RELP CELL ELETRÔNICOS, CNPJ: 43.735.304/0001-00.
COMPRADOR: ${profile.first_name} ${profile.last_name}, CPF: ${profile.identification_number}.

OBJETO DO CONTRATO:
Produto: ${product.name}
Valor Total: R$ ${(downPaymentValue + totalFinancedWithInterest).toFixed(2)}

CONDIÇÕES DE PAGAMENTO (CREDIÁRIO):
1. Entrada: R$ ${downPaymentValue.toFixed(2)} (Pagamento Imediato via ${paymentMethod.toUpperCase()}).
2. Saldo Financiado: R$ ${principalAmount.toFixed(2)} acrescido de juros de ${interestRate}% a.m.
3. Plano: ${installments} parcelas mensais fixas.

CRONOGRAMA DE DESEMBOLSO:
${installmentsList}

CLÁUSULAS GERAIS:
1. O não pagamento de qualquer parcela na data de vencimento acarretará em multa de 2% e juros de mora de 1% ao mês, além de correção monetária.
2. O atraso superior a 30 dias poderá ensejar a inclusão do nome do COMPRADOR nos órgãos de proteção ao crédito (SPC/SERASA).
3. O produto permanece como propriedade da VENDEDORA (Reserva de Domínio) até a quitação integral do preço.

FORO:
Fica eleito o foro da comarca de Macapá/AP para dirimir quaisquer dúvidas oriundas deste contrato.

Macapá, ${today.toLocaleDateString('pt-BR')}.
`;
    };

    // --- Renderização dos Passos ---

    const renderConfigStep = () => (
        <div className="space-y-6">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button onClick={() => { setSaleType('crediario'); setInstallments(1); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'crediario' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Crediário</button>
                <button onClick={() => { setSaleType('direct'); setInstallments(1); setDownPayment(''); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500'}`}>À Vista</button>
            </div>

            {saleType === 'crediario' && (
                <>
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

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Sua Entrada (R$)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={downPayment} 
                                onChange={e => { 
                                    // Impede valor maior que o preço
                                    const val = Math.min(parseFloat(e.target.value), product.price);
                                    setDownPayment(isNaN(val) ? '' : String(val)); 
                                    setError(null); 
                                }} 
                                max={product.price}
                                className={`w-full p-3 border rounded-lg dark:bg-slate-800 dark:text-white font-bold text-lg focus:ring-2 outline-none transition-all ${!limitAnalysis.isValid ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200 focus:ring-indigo-500'}`}
                                placeholder="0.00" 
                            />
                            {isFullPayment && (
                                <span className="absolute right-3 top-3.5 text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                    Pagamento Total
                                </span>
                            )}
                        </div>
                        {!limitAnalysis.isValid && (
                            <p className="text-xs text-amber-600 mt-1 font-bold animate-pulse">
                                {limitAnalysis.message}
                            </p>
                        )}
                        {isFullPayment && (
                            <p className="text-xs text-green-600 mt-1 font-bold">
                                Você está pagando o valor total. O contrato será dispensado.
                            </p>
                        )}
                    </div>
                    
                    {coinsBalance > 0 && (
                        <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] text-yellow-900 font-bold">RC</span>
                                <div>
                                    <p className="text-xs font-bold text-yellow-900">Usar Saldo (Coins)</p>
                                    <p className="text-[10px] text-yellow-700">Disponível: R$ {coinsValue.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {useCoins && <span className="text-xs text-green-600 font-bold">- R$ {coinsDiscount.toFixed(2)}</span>}
                                <input type="checkbox" checked={useCoins} onChange={e => setUseCoins(e.target.checked)} className="w-5 h-5 text-yellow-600 rounded" />
                            </div>
                        </div>
                    )}

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

    const renderContractStep = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Contrato Digital
            </h3>
            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 max-h-[50vh] overflow-y-auto border border-slate-200 dark:border-slate-700 font-mono leading-relaxed text-justify shadow-inner">
                <div className="flex justify-center mb-4">
                    <Logo className="h-12 w-12" showText={true} />
                </div>
                <div className="whitespace-pre-wrap">
                    {generateContractText()}
                </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    <strong>Atenção:</strong> Ao assinar, você concorda com os termos acima e reconhece a dívida. O contrato ficará disponível em seu perfil.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Assine abaixo:</label>
                <SignaturePad onEnd={setSignature} />
            </div>
        </div>
    );

    const renderProcessingStep = () => (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-20 h-20 relative mb-6">
                 <svg className="animate-spin w-full h-full text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-indigo-600">
                    {countdown}
                </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Gerando Pagamento...</h3>
            <p className="text-slate-500">Como você optou pelo pagamento total, o contrato foi dispensado.</p>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] flex flex-col">
                {step !== 'processing' && (
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {step === 'config' ? 'Configuração do Pedido' : 'Contrato'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">✕</button>
                    </div>
                )}

                {step === 'config' && renderConfigStep()}
                {step === 'contract' && renderContractStep()}
                {step === 'processing' && renderProcessingStep()}

                {error && <div className="mt-4"><Alert message={error} type="error" /></div>}

                {step !== 'processing' && (
                    <div className="mt-6 flex gap-3">
                        {step === 'contract' && (
                            <button onClick={() => setStep('config')} className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl font-bold">Voltar</button>
                        )}
                        <button 
                            onClick={nextStep} 
                            disabled={isProcessing || (saleType === 'crediario' && !validationStatus.isValid)} 
                            className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        >
                            {isProcessing ? <LoadingSpinner /> : (step === 'config' ? (isFullPayment ? 'Pagar Agora (Sem Contrato)' : 'Revisar Contrato') : 'Finalizar Pedido')}
                        </button>
                    </div>
                )}
            </div>

            {paymentResult && <PaymentResultModal data={paymentResult} onClose={() => { setPaymentResult(null); onSuccess(); }} />}
        </div>
    );
};

export default PurchaseModal;
