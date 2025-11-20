
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Profile } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Alert from '../Alert';
import { supabase } from '../../services/clients';
import jsPDF from 'jspdf';

interface PurchaseModalProps {
    product: Product;
    profile: Profile;
    onClose: () => void;
    onSuccess: () => void;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ product, profile, onClose, onSuccess }) => {
    const [downPayment, setDownPayment] = useState<string>('');
    const [installments, setInstallments] = useState<number>(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [interestRate, setInterestRate] = useState(0);

    // Carregar taxa de juros
    useEffect(() => {
        const fetchInterest = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                if(res.ok) {
                    const data = await res.json();
                    setInterestRate(parseFloat(data.interest_rate) || 0);
                }
            } catch (e) {
                console.error("Erro ao carregar juros", e);
            }
        };
        fetchInterest();
    }, []);

    // Constantes
    const MAX_INSTALLMENTS = 8;
    const creditLimit = profile.credit_limit ?? 0;
    
    // Cálculos reativos
    const downPaymentValue = parseFloat(downPayment) || 0;
    const principalAmount = Math.max(0, product.price - downPaymentValue);
    
    const totalFinancedWithInterest = useMemo(() => {
        if (installments <= 1 || interestRate <= 0) return principalAmount;
        const rateDecimal = interestRate / 100;
        return principalAmount * Math.pow(1 + rateDecimal, installments);
    }, [principalAmount, installments, interestRate]);

    const installmentValue = totalFinancedWithInterest / installments;
    const isLimitExceeded = installmentValue > creditLimit;
    
    const suggestion = useMemo(() => {
        if (!isLimitExceeded) return null;
        let minEntry = 0;
        if (installments > 1 && interestRate > 0) {
             const factor = Math.pow(1 + (interestRate/100), installments);
             minEntry = product.price - ((creditLimit * installments) / factor);
        } else {
             minEntry = product.price - (creditLimit * installments);
        }
        if (minEntry > 0) {
            return {
                type: 'entry',
                text: `Para ${installments}x, você precisa dar uma entrada de pelo menos ${minEntry.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
            };
        }
        return { type: 'none', text: 'Limite insuficiente para esta compra.' };
    }, [isLimitExceeded, installments, interestRate, creditLimit, product.price]);

    const handleConfirmPurchase = async () => {
        if (isLimitExceeded) return;
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
                    installments: installments
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

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl transform transition-all animate-fade-in-up flex flex-col max-h-[90vh] relative z-[160]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Simular Compra</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl flex justify-between items-center">
                        <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Seu Limite por Parcela</span>
                        <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                            {creditLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
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
                                <p className="text-sm text-red-700 dark:text-red-300"><span className="font-bold">Atenção:</span> Essa parcela é maior que seu limite de {creditLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.</p>
                                {suggestion && <p className="text-sm text-red-700 dark:text-red-300 mt-1 font-medium">💡 Dica: {suggestion.text}</p>}
                            </div>
                        )}
                    </div>
                    {error && <Alert message={error} type="error" />}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                    <button onClick={handleConfirmPurchase} disabled={isLimitExceeded || isProcessing || principalAmount <= 0} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
                        {isProcessing ? <LoadingSpinner /> : 'Confirmar Compra'}
                    </button>
                    {principalAmount <= 0 && <p className="text-xs text-center text-red-500 mt-2">O valor financiado deve ser maior que zero.</p>}
                </div>
            </div>
        </div>
    );
};

export default PurchaseModal;