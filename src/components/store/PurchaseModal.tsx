
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

type Step = 'config' | 'contract' | 'summary';
type SaleType = 'crediario' | 'direct';
type PaymentMethod = 'pix' | 'boleto' | 'credit_card';

const COMPANY_DATA = {
    razaoSocial: "RELP CELL ELETRONICOS LTDA",
    cnpj: "43.735.304/0001-00",
    endereco: "Rua Claudomiro de Moraes, 256 - Congós, Macapá - AP",
    telefone: "(96) 99171-8167"
};

const PurchaseModal: React.FC<PurchaseModalProps> = ({ product, profile, onClose, onSuccess }) => {
    const [step, setStep] = useState<Step>('config');
    const [saleType, setSaleType] = useState<SaleType>('crediario');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    
    const [downPayment, setDownPayment] = useState<string>('');
    const [installments, setInstallments] = useState<number>(1);
    const [selectedDueDay, setSelectedDueDay] = useState<number>(10); // Default
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [interestRate, setInterestRate] = useState(0);
    const [signature, setSignature] = useState<string | null>(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [totalUsedLimit, setTotalUsedLimit] = useState(0);
    const [isLoadingLimit, setIsLoadingLimit] = useState(true);

    // Verifica se é Cliente Diamante (Score >= 850)
    const isDiamond = (profile.credit_score || 0) >= 850;

    // Regra de Negócio: Entrada mínima obrigatória para crediário (ex: 15%)
    const MIN_ENTRY_PERCENTAGE = 0.15;

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
    const MAX_INSTALLMENTS_CREDIARIO = 12;
    const MAX_INSTALLMENTS_CARD = 12;
    const creditLimit = profile.credit_limit ?? 0;
    const availableLimit = Math.max(0, creditLimit - totalUsedLimit);
    
    // Cálculos reativos
    const downPaymentValue = parseFloat(downPayment) || 0;
    const principalAmount = Math.max(0, product.price - downPaymentValue);
    
    // Lógica de Juros Dinâmica
    const currentInterestRate = useMemo(() => {
        if (saleType === 'crediario') return interestRate;
        
        if (saleType === 'direct') {
            if (paymentMethod === 'credit_card') {
                const interestFreeLimit = isDiamond ? 4 : 1;
                if (installments <= interestFreeLimit) return 0;
                return interestRate; 
            }
            return 0;
        }
        return 0;
    }, [saleType, paymentMethod, installments, interestRate, isDiamond]);

    const totalFinancedWithInterest = useMemo(() => {
        if (installments <= 1 || currentInterestRate <= 0) return principalAmount;
        const rateDecimal = currentInterestRate / 100;
        return principalAmount * Math.pow(1 + rateDecimal, installments);
    }, [principalAmount, installments, currentInterestRate]);

    const installmentValue = totalFinancedWithInterest / installments;
    
    // Geração de Lista de Parcelas para Contrato
    const installmentSchedule = useMemo(() => {
        const schedule = [];
        const today = new Date();
        // Se o dia de hoje for maior ou igual ao dia escolhido, a primeira parcela é no próximo mês.
        // Se for menor, e a diferença for pequena (ex: hoje dia 2, escolhe dia 5), joga para o próximo para dar tempo.
        // Regra simplificada: Sempre proximo mês ou mês seguinte dependendo do "corte" (ex: 10 dias antes).
        
        let startMonth = today.getMonth() + 1; // Próximo mês
        // Se comprar dia 20 e escolher dia 5, dia 5 do próximo mês é muito perto (15 dias). 
        // Vamos assumir sempre o próximo mês, mas se a data escolhida for menor que hoje no mês seguinte, pula +1 mês
        // Implementação simples: data base = hoje + 30 dias, ajusta para o dia escolhido.
        
        let baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + 30); // Pelo menos 30 dias pra primeira
        
        // Ajusta para o dia escolhido no mês calculado
        if (baseDate.getDate() > selectedDueDay) {
             baseDate.setMonth(baseDate.getMonth() + 1);
        }
        baseDate.setDate(selectedDueDay);

        for (let i = 0; i < installments; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(baseDate.getMonth() + i);
            schedule.push({
                num: i + 1,
                date: dueDate.toLocaleDateString('pt-BR'),
                value: installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            });
        }
        return schedule;
    }, [installments, selectedDueDay, installmentValue]);

    // Cálculo da Sugestão de Entrada
    const validationStatus = useMemo(() => {
        if (saleType !== 'crediario') return { isValid: true, message: null, type: 'success' };

        const mandatoryEntry = product.price * MIN_ENTRY_PERCENTAGE;
        let limitGapEntry = 0;
        if (installments > 1 && interestRate > 0) {
             const factor = Math.pow(1 + (interestRate/100), installments);
             const maxPrincipal = availableLimit / factor;
             limitGapEntry = product.price - maxPrincipal;
        } else {
             limitGapEntry = product.price - availableLimit;
        }

        const requiredEntry = Math.max(mandatoryEntry, limitGapEntry);

        if (downPaymentValue < requiredEntry) {
            const reason = limitGapEntry > mandatoryEntry ? "Limite insuficiente" : "Regra da loja";
            return {
                isValid: false,
                type: 'error',
                minEntry: requiredEntry,
                message: `Entrada mínima obrigatória: R$ ${requiredEntry.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${reason}).`
            };
        }

        return { isValid: true, message: 'Entrada aprovada.', type: 'success' };

    }, [saleType, product.price, availableLimit, installments, interestRate, downPaymentValue]);

    const handleNextStep = () => {
        if (saleType === 'crediario' && !validationStatus.isValid) return;
        if (principalAmount < 0) return;
        
        if (saleType === 'crediario') {
            setStep('contract');
        } else {
            setStep('summary');
        }
    };

    const handleConfirmPurchase = async () => {
        if (saleType === 'crediario' && (!signature || !termsAccepted)) {
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
                    signature: signature,
                    saleType: saleType,
                    paymentMethod: paymentMethod,
                    downPayment: downPaymentValue,
                    selectedDay: selectedDueDay // Envia o dia escolhido
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
            {/* Abas de Tipo de Venda */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button 
                    onClick={() => { setSaleType('crediario'); setInstallments(1); }}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'crediario' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Crediário Próprio
                </button>
                <button 
                    onClick={() => { setSaleType('direct'); setInstallments(1); setDownPayment(''); }}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Pagamento Direto
                </button>
            </div>

            {/* Informações Condicionais */}
            {saleType === 'crediario' ? (
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
            ) : (
                <div className="grid grid-cols-3 gap-2">
                    <button 
                        onClick={() => { setPaymentMethod('pix'); setInstallments(1); }}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'pix' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span className="text-xs font-bold">Pix</span>
                    </button>
                    <button 
                        onClick={() => { setPaymentMethod('boleto'); setInstallments(1); }}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'boleto' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <span className="text-xs font-bold">Boleto</span>
                    </button>
                    <button 
                        onClick={() => setPaymentMethod('credit_card')}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'credit_card' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                        <span className="text-xs font-bold">Cartão</span>
                    </button>
                </div>
            )}

            {/* Inputs de Valor */}
            <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 dark:text-slate-400">Valor do Produto</span>
                <span className="font-medium text-slate-900 dark:text-white">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            
            {saleType === 'crediario' && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Valor da Entrada (R$)</label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">R$</span>
                        <input type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} placeholder="0,00" className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 text-right">Saldo a financiar: {principalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            )}

            {/* Seletor de Parcelas */}
            {(saleType === 'crediario' || (saleType === 'direct' && paymentMethod === 'credit_card')) && (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Parcelamento {saleType === 'direct' ? '(Cartão)' : '(Crediário)'}
                        </label>
                        {isDiamond && saleType === 'direct' && (
                            <span className="text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                💎 Diamante: 4x Sem Juros
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: saleType === 'direct' ? MAX_INSTALLMENTS_CARD : MAX_INSTALLMENTS_CREDIARIO }, (_, i) => i + 1).map((num) => {
                            const isInterestFree = saleType === 'direct' && num <= (isDiamond ? 4 : 1);
                            return (
                                <button 
                                    key={num} 
                                    onClick={() => setInstallments(num)} 
                                    className={`py-2 rounded-lg text-sm font-medium transition-all relative overflow-hidden ${installments === num ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                >
                                    {num}x
                                    {isInterestFree && <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500"></div>}
                                </button>
                            )
                        })}
                    </div>
                    {currentInterestRate > 0 && installments > 1 && <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 text-center">*Inclui juros de {currentInterestRate}% a.m.</p>}
                </div>
            )}

            {/* SELEÇÃO DE DIA DE VENCIMENTO (Apenas Crediário) */}
            {saleType === 'crediario' && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Melhor Dia de Vencimento
                    </label>
                    <div className="flex gap-2">
                        {[5, 15, 25].map(day => (
                            <button
                                key={day}
                                onClick={() => setSelectedDueDay(day)}
                                className={`flex-1 py-3 rounded-xl font-bold border transition-all ${
                                    selectedDueDay === day 
                                    ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-500 shadow-sm' 
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                Dia {day.toString().padStart(2, '0')}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">A primeira parcela será cobrada a partir do próximo mês.</p>
                </div>
            )}

            {/* Resumo do Cálculo e Validação */}
            <div className={`p-4 rounded-xl border-2 transition-all ${!validationStatus.isValid && saleType === 'crediario' ? 'border-red-100 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50' : 'border-green-100 bg-green-50 dark:bg-green-900/20 dark:border-green-800/50'}`}>
                <div className="flex justify-between items-end">
                    <div>
                        <p className={`text-sm font-medium ${!validationStatus.isValid && saleType === 'crediario' ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'}`}>Valor da Parcela</p>
                        <p className={`text-2xl font-bold ${!validationStatus.isValid && saleType === 'crediario' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    {!validationStatus.isValid && saleType === 'crediario' ? 
                        <span className="px-2 py-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 text-xs rounded-md font-bold">Entrada Insuficiente</span> : 
                        <span className="px-2 py-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded-md font-bold">Aprovado</span>
                    }
                </div>
                <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-slate-500">Total Final:</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{totalFinancedWithInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                {!validationStatus.isValid && saleType === 'crediario' && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800/30">
                        <p className="text-sm text-red-700 dark:text-red-300 font-bold">Atenção:</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationStatus.message}</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderContractStep = () => (
        <div className="space-y-6 flex-1 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 h-96 overflow-y-auto text-xs text-slate-700 dark:text-slate-300 text-justify leading-relaxed font-serif shadow-inner">
                <h4 className="text-center font-bold text-base mb-4 uppercase text-slate-900 dark:text-white border-b pb-2">Contrato de Confissão de Dívida</h4>
                
                <p className="mb-3">
                    <strong>1. PARTES:</strong><br/>
                    <strong>CREDORA:</strong> {COMPANY_DATA.razaoSocial}, inscrita no CNPJ sob o nº {COMPANY_DATA.cnpj}, com sede em {COMPANY_DATA.endereco}.<br/>
                    <strong>DEVEDOR(A):</strong> {profile.first_name} {profile.last_name}, CPF nº {profile.identification_number}.
                </p>

                <p className="mb-3">
                    <strong>2. OBJETO:</strong><br/>
                    O DEVEDOR reconhece e confessa dever à CREDORA a importância líquida, certa e exigível de <strong>{totalFinancedWithInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>, referente à aquisição do produto: <em>{product.name}</em>.
                </p>

                <p className="mb-3">
                    <strong>3. FORMA DE PAGAMENTO:</strong><br/>
                    O valor será pago em <strong>{installments}</strong> parcelas mensais e sucessivas de <strong>{installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>, com vencimento todo dia <strong>{selectedDueDay}</strong> de cada mês, conforme cronograma abaixo:
                </p>

                <div className="mb-4 bg-slate-100 dark:bg-slate-900/50 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-left text-[10px]">
                        <thead>
                            <tr className="border-b border-slate-300 dark:border-slate-600">
                                <th className="pb-1">Parcela</th>
                                <th className="pb-1">Vencimento</th>
                                <th className="pb-1 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {installmentSchedule.map((inst) => (
                                <tr key={inst.num} className="border-b border-slate-200 dark:border-slate-800 last:border-0">
                                    <td className="py-1">{inst.num}/{installments}</td>
                                    <td className="py-1">{inst.date}</td>
                                    <td className="py-1 text-right">{inst.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className="mb-3">
                    <strong>4. INADIMPLÊNCIA:</strong><br/>
                    O não pagamento de qualquer parcela na data de seu vencimento acarretará:
                    a) Multa moratória de 2% (dois por cento) sobre o valor do débito;
                    b) Juros de mora de 1% (um por cento) ao mês, calculados *pro rata die*;
                    c) Correção monetária;
                    d) Vencimento antecipado das demais parcelas, facultando à CREDORA a cobrança judicial ou extrajudicial da dívida total, bem como a inscrição do nome do DEVEDOR nos órgãos de proteção ao crédito (SPC/SERASA).
                </p>

                <p>
                    <strong>5. FORO:</strong><br/>
                    Fica eleito o foro da comarca de Macapá/AP para dirimir quaisquer dúvidas oriundas deste contrato.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Assinatura Digital do Devedor:</label>
                <SignaturePad onEnd={setSignature} />
            </div>

            <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                <input 
                    type="checkbox" 
                    id="terms" 
                    checked={termsAccepted} 
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="terms" className="text-xs text-slate-600 dark:text-slate-400">
                    Declaro que li e concordo com todas as cláusulas do contrato de confissão de dívida acima, reconhecendo a dívida e as condições de pagamento.
                </label>
            </div>
        </div>
    );

    const renderSummaryStep = () => (
        <div className="space-y-6 flex-1">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Resumo do Pedido</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{product.name}</p>
                
                <div className="mt-6 space-y-3 text-sm">
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                        <span className="text-slate-500">Método</span>
                        <span className="font-bold text-slate-800 dark:text-white capitalize">{paymentMethod.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                        <span className="text-slate-500">Parcelas</span>
                        <span className="font-bold text-slate-800 dark:text-white">{installments}x</span>
                    </div>
                    <div className="flex justify-between pt-2">
                        <span className="text-slate-500">Total</span>
                        <span className="font-black text-lg text-indigo-600 dark:text-indigo-400">{totalFinancedWithInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>
            </div>
            
            {saleType === 'direct' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                        Ao confirmar, sua fatura será criada imediatamente. Você poderá visualizar o código Pix ou Boleto na aba <strong>Faturas</strong>.
                    </p>
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl transform transition-all animate-fade-in-up flex flex-col max-h-[90vh] relative z-[160]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {step === 'config' ? 'Configurar Compra' : step === 'contract' ? 'Contrato Digital' : 'Confirmar Pedido'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {step === 'config' && renderConfigStep()}
                    {step === 'contract' && renderContractStep()}
                    {step === 'summary' && renderSummaryStep()}
                    {error && <div className="mt-4"><Alert message={error} type="error" /></div>}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl flex gap-3">
                    {step !== 'config' && (
                        <button onClick={() => setStep('config')} disabled={isProcessing} className="flex-1 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800">
                            Voltar
                        </button>
                    )}
                    
                    {step === 'config' ? (
                        <button 
                            onClick={handleNextStep} 
                            disabled={(saleType === 'crediario' && !validationStatus.isValid) || principalAmount <= 0 || isLoadingLimit} 
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {isLoadingLimit ? <LoadingSpinner /> : 'Continuar'}
                        </button>
                    ) : (
                        <button onClick={handleConfirmPurchase} disabled={isProcessing || (step === 'contract' && (!signature || !termsAccepted))} className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex justify-center items-center gap-2">
                            {isProcessing ? <LoadingSpinner /> : (
                                <>
                                    {step === 'contract' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                    {step === 'contract' ? 'Assinar e Finalizar' : 'Finalizar Pedido'}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PurchaseModal;
