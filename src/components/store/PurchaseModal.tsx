
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Profile, Invoice } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Alert from '../Alert';
import SignaturePad from '../SignaturePad';
import jsPDF from 'jspdf';
import { supabase } from '../../services/clients';

interface PurchaseModalProps {
    product: Product;
    profile: Profile;
    onClose: () => void;
    onSuccess: () => void;
}

type Step = 'config' | 'contract';

const COMPANY_DATA = {
    razaoSocial: "RELP CELL ELETRONICOS",
    cnpj: "43.735.304/0001-00",
    endereco: "Endereço Comercial, Estado do Amapá",
    telefone: "(96) 99171-8167"
};

const PurchaseModal: React.FC<PurchaseModalProps> = ({ product, profile, onClose, onSuccess }) => {
    const [step, setStep] = useState<Step>('config');
    const [downPayment, setDownPayment] = useState<string>('');
    const [installments, setInstallments] = useState<number>(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [interestRate, setInterestRate] = useState(0);
    const [signature, setSignature] = useState<string | null>(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [totalUsedLimit, setTotalUsedLimit] = useState(0);
    const [isLoadingLimit, setIsLoadingLimit] = useState(true);

    // Carregar taxa de juros e faturas em aberto
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoadingLimit(true);
            try {
                // 1. Juros
                const resSettings = await fetch('/api/admin/settings');
                if(resSettings.ok) {
                    const data = await resSettings.json();
                    setInterestRate(parseFloat(data.interest_rate) || 0);
                }

                // 2. Faturas em Aberto (para calcular limite usado)
                const { data: invoices, error } = await supabase
                    .from('invoices')
                    .select('amount')
                    .eq('user_id', profile.id)
                    .or('status.eq.Em aberto,status.eq.Boleto Gerado');
                
                if (error) throw error;
                
                const used = invoices?.reduce((acc, inv) => acc + inv.amount, 0) || 0;
                setTotalUsedLimit(used);

            } catch (e) {
                console.error("Erro ao carregar dados iniciais", e);
            } finally {
                setIsLoadingLimit(false);
            }
        };
        fetchInitialData();
    }, [profile.id]);

    // Constantes
    const MAX_INSTALLMENTS = 12;
    const creditLimit = profile.credit_limit ?? 0;
    const availableLimit = Math.max(0, creditLimit - totalUsedLimit);
    
    // Cálculos reativos
    const downPaymentValue = parseFloat(downPayment) || 0;
    const principalAmount = Math.max(0, product.price - downPaymentValue);
    
    const totalFinancedWithInterest = useMemo(() => {
        if (installments <= 1 || interestRate <= 0) return principalAmount;
        const rateDecimal = interestRate / 100;
        return principalAmount * Math.pow(1 + rateDecimal, installments);
    }, [principalAmount, installments, interestRate]);

    const installmentValue = totalFinancedWithInterest / installments;
    
    // BLOQUEIO: Verifica se o valor TOTAL da nova compra cabe no limite disponível
    // Lógica antiga verificava apenas o valor da parcela individual, permitindo compras infinitas.
    const isLimitExceeded = totalFinancedWithInterest > availableLimit;
    
    const suggestion = useMemo(() => {
        if (!isLimitExceeded) return null;
        
        // Quanto falta para caber no limite?
        // Novo Total Financiado deve ser <= Limite Disponível
        // (Preço - Entrada) * Juros <= Disponível
        // Entrada >= Preço - (Disponível / Juros)
        
        let minEntry = 0;
        if (installments > 1 && interestRate > 0) {
             const factor = Math.pow(1 + (interestRate/100), installments);
             minEntry = product.price - (availableLimit / factor);
        } else {
             minEntry = product.price - availableLimit;
        }
        
        if (minEntry > 0) {
            return {
                type: 'entry',
                text: `Seu limite disponível é R$ ${availableLimit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}. Dê uma entrada de R$ ${minEntry.toLocaleString('pt-BR', {minimumFractionDigits: 2})} para liberar.`
            };
        }
        return { type: 'none', text: 'Limite insuficiente. Pague faturas antigas para liberar crédito.' };
    }, [isLimitExceeded, availableLimit, installments, interestRate, product.price]);

    const handleNextStep = () => {
        if (isLimitExceeded || principalAmount <= 0) return;
        setStep('contract');
    };

    const handleConfirmPurchase = async () => {
        if (!signature || !termsAccepted) {
            setError('É necessário assinar e aceitar os termos.');
            return;
        }

        setIsProcessing(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: profile.id,
                    productName: product.name,
                    totalAmount: totalFinancedWithInterest, 
                    installments: installments,
                    signature: signature // Envia a assinatura
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao processar compra.');
            
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const renderConfigStep = () => (
        <div className="space-y-6">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl flex justify-between items-center">
                <div>
                    <span className="block text-xs font-medium text-indigo-900 dark:text-indigo-200 uppercase">Limite Disponível</span>
                    {isLoadingLimit ? <div className="h-4 w-20 bg-indigo-200 dark:bg-indigo-800 rounded animate-pulse mt-1"></div> : (
                        <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                            {availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    )}
                </div>
                <div className="text-right">
                    <span className="block text-xs text-slate-500 dark:text-slate-400">Total: {creditLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
            </div>
            <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 dark:text-slate-400">Valor do Produto</span>
                <span className="font-medium text-slate-900 dark:text-white">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Valor da Entrada (R$)</label>
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">R$</span>
                    <input type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} placeholder="0,00" className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
                </div>
                <p className="text-xs text-slate-500 mt-1 text-right">Saldo a financiar: {principalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Número de Parcelas (Máx. {MAX_INSTALLMENTS}x)</label>
                <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((num) => (
                        <button key={num} onClick={() => setInstallments(num)} className={`py-2 rounded-lg text-sm font-medium transition-all ${installments === num ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{num}x</button>
                    ))}
                </div>
                {interestRate > 0 && installments > 1 && <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 text-center">*Inclui juros de {interestRate}% a.m.</p>}
            </div>
            <div className={`p-4 rounded-xl border-2 transition-all ${isLimitExceeded ? 'border-red-100 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50' : 'border-green-100 bg-green-50 dark:bg-green-900/20 dark:border-green-800/50'}`}>
                <div className="flex justify-between items-end">
                    <div>
                        <p className={`text-sm font-medium ${isLimitExceeded ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'}`}>Valor da Parcela</p>
                        <p className={`text-2xl font-bold ${isLimitExceeded ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    {isLimitExceeded ? <span className="px-2 py-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 text-xs rounded-md font-bold">Excede Limite</span> : <span className="px-2 py-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded-md font-bold">Aprovado</span>}
                </div>
                {interestRate > 0 && installments > 1 && <p className="text-xs text-slate-500 mt-2">Total financiado com juros: {totalFinancedWithInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
                {isLimitExceeded && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800/30">
                        <p className="text-sm text-red-700 dark:text-red-300"><span className="font-bold">Bloqueado:</span> O valor total desta compra excede seu limite disponível.</p>
                        {suggestion && <p className="text-sm text-red-700 dark:text-red-300 mt-1 font-medium">💡 {suggestion.text}</p>}
                    </div>
                )}
            </div>
        </div>
    );

    const renderContractStep = () => (
        <div className="space-y-6 flex-1 overflow-y-auto">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 h-64 overflow-y-auto text-xs text-slate-600 dark:text-slate-300 text-justify leading-relaxed font-serif">
                <h4 className="text-center font-bold text-sm mb-2 uppercase text-slate-900 dark:text-white">Contrato de Confissão de Dívida com Reserva de Domínio</h4>
                <p className="mb-2">
                    <strong>CREDORA:</strong> {COMPANY_DATA.razaoSocial}, CNPJ {COMPANY_DATA.cnpj}, localizada no {COMPANY_DATA.endereco}.
                </p>
                <p className="mb-2">
                    <strong>DEVEDOR(A):</strong> {profile.first_name} {profile.last_name}, CPF {profile.identification_number}.
                </p>
                <p className="mb-2">
                    <strong>CLÁUSULA 1 - DO OBJETO:</strong> O presente contrato tem como objeto o financiamento para aquisição do produto <strong>{product.name}</strong>, pelo valor total de {totalFinancedWithInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.
                </p>
                <p className="mb-2">
                    <strong>CLÁUSULA 2 - DA RESERVA DE DOMÍNIO:</strong> Em garantia do cumprimento das obrigações assumidas neste instrumento, fica instituída a RESERVA DE DOMÍNIO em favor da CREDORA sobre o bem objeto deste contrato. A propriedade do bem só será transferida ao DEVEDOR após a quitação integral de todas as parcelas.
                </p>
                <p className="mb-2">
                    <strong>CLÁUSULA 3 - DO PAGAMENTO:</strong> O pagamento será realizado em {installments} parcelas de {installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.
                </p>
                <p className="mb-2">
                    <strong>CLÁUSULA 4 - DA INADIMPLÊNCIA:</strong> O atraso no pagamento acarretará multa de 2% e juros de mora de 1% ao mês. A falta de pagamento de qualquer parcela autoriza a CREDORA a solicitar a busca e apreensão do bem e o vencimento antecipado de toda a dívida.
                </p>
                <p>
                    <strong>CLÁUSULA 5 - DO FORO:</strong> As partes elegem o foro da Comarca de Macapá-AP para dirimir quaisquer dúvidas.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Assine Abaixo:</label>
                <SignaturePad onEnd={setSignature} />
            </div>

            <div className="flex items-start gap-2">
                <input 
                    type="checkbox" 
                    id="terms" 
                    checked={termsAccepted} 
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="terms" className="text-xs text-slate-600 dark:text-slate-400">
                    Li e concordo com os termos do contrato de Crediário, incluindo a cláusula de Reserva de Domínio e as penalidades por atraso.
                </label>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl transform transition-all animate-fade-in-up flex flex-col max-h-[90vh] relative z-[160]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {step === 'config' ? 'Simular Compra' : 'Contrato Digital'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {step === 'config' ? renderConfigStep() : renderContractStep()}
                    {error && <div className="mt-4"><Alert message={error} type="error" /></div>}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl flex gap-3">
                    {step === 'contract' && (
                        <button onClick={() => setStep('config')} disabled={isProcessing} className="flex-1 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold">
                            Voltar
                        </button>
                    )}
                    
                    {step === 'config' ? (
                        <button onClick={handleNextStep} disabled={isLimitExceeded || principalAmount <= 0 || isLoadingLimit} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
                            {isLoadingLimit ? <LoadingSpinner /> : 'Continuar'}
                        </button>
                    ) : (
                        <button onClick={handleConfirmPurchase} disabled={isProcessing || !signature || !termsAccepted} className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex justify-center items-center gap-2">
                            {isProcessing ? <LoadingSpinner /> : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    Assinar e Finalizar
                                </>
                            )}
                        </button>
                    )}
                </div>
                {step === 'config' && principalAmount <= 0 && <p className="pb-4 text-xs text-center text-red-500">O valor financiado deve ser maior que zero.</p>}
            </div>
        </div>
    );
};

export default PurchaseModal;
