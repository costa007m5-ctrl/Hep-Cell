
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
    endereco: "Avenida Principal, 123, Centro, Macapá - AP",
    telefone: "(96) 99171-8167"
};

const PurchaseModal: React.FC<PurchaseModalProps> = ({ product, profile, onClose, onSuccess }) => {
    const [step, setStep] = useState<Step>('config');
    const [saleType, setSaleType] = useState<SaleType>('crediario');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    
    const [downPayment, setDownPayment] = useState<string>('');
    const [installments, setInstallments] = useState<number>(1);
    const [selectedDueDay, setSelectedDueDay] = useState<number>(10); 
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [interestRate, setInterestRate] = useState(0);
    const [minEntryPercentage, setMinEntryPercentage] = useState(0.15);
    const [signature, setSignature] = useState<string | null>(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    
    // Controle de Limite Mensal
    const [usedMonthlyLimit, setUsedMonthlyLimit] = useState(0);
    const [isLoadingLimit, setIsLoadingLimit] = useState(true);

    const isDiamond = (profile.credit_score || 0) >= 850;

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

                // Busca faturas em aberto para calcular o comprometimento MENSAL
                const { data: invoices, error } = await supabase
                    .from('invoices')
                    .select('amount, due_date')
                    .eq('user_id', profile.id)
                    .or('status.eq.Em aberto,status.eq.Boleto Gerado');
                
                if (error) throw error;
                
                // Lógica de Maior Comprometimento Mensal
                const monthlyCommitments: Record<string, number> = {};
                invoices?.forEach(inv => {
                    const dueMonth = inv.due_date.substring(0, 7); // YYYY-MM
                    monthlyCommitments[dueMonth] = (monthlyCommitments[dueMonth] || 0) + inv.amount;
                });
                
                const maxMonthly = Math.max(0, ...Object.values(monthlyCommitments));
                setUsedMonthlyLimit(maxMonthly);

            } catch (e) {
                console.error("Erro ao carregar dados iniciais", e);
            } finally {
                setIsLoadingLimit(false);
            }
        };
        fetchInitialData();
    }, [profile.id]);

    const MAX_INSTALLMENTS_CREDIARIO = 12;
    const MAX_INSTALLMENTS_CARD = 12;
    
    // Interpretação correta: Credit Limit é o LIMITE DE PARCELA MENSAL
    const monthlyLimitTotal = profile.credit_limit ?? 0;
    const availableMonthlyLimit = Math.max(0, monthlyLimitTotal - usedMonthlyLimit);
    
    const downPaymentValue = parseFloat(downPayment) || 0;
    const principalAmount = Math.max(0, product.price - downPaymentValue);
    
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
    
    // Nova Validação baseada em Limite de Parcela
    const validationStatus = useMemo(() => {
        if (saleType !== 'crediario') return { isValid: true, message: null, mandatoryEntry: 0, limitGapEntry: 0 };
        
        // 1. Entrada Mínima da Loja (Ex: 15% do valor total)
        const regulatoryEntry = product.price * minEntryPercentage;
        
        // 2. Entrada por Limite de Parcela Excedido
        // A parcela calculada não pode ser maior que o availableMonthlyLimit.
        // Se installmentValue > availableMonthlyLimit, precisamos de mais entrada.
        // Cálculo reverso: Qual entrada (E) faz a parcela ser <= limite?
        // Parcela = ((Preco - E) * FatorJuros) / Parcelas <= Limite
        // (Preco - E) <= (Limite * Parcelas) / FatorJuros
        // E >= Preco - [(Limite * Parcelas) / FatorJuros]
        
        const interestFactor = installments > 1 ? Math.pow(1 + (interestRate/100), installments) : 1;
        const maxPrincipalAllowed = (availableMonthlyLimit * installments) / interestFactor;
        
        const limitGapEntry = Math.max(0, product.price - maxPrincipalAllowed);
        
        // A entrada necessária é a maior entre a regra da loja e a necessidade financeira
        const requiredEntry = Math.max(regulatoryEntry, limitGapEntry);
        
        if (downPaymentValue < requiredEntry) {
            return { 
                isValid: false, 
                message: `Entrada insuficiente.`,
                mandatoryEntry: regulatoryEntry,
                limitGapEntry: limitGapEntry,
                requiredTotal: requiredEntry
            };
        }
        return { isValid: true, message: 'Entrada Aprovada', mandatoryEntry: regulatoryEntry, limitGapEntry: limitGapEntry, requiredTotal: requiredEntry };
    }, [saleType, product.price, availableMonthlyLimit, installments, interestRate, downPaymentValue, minEntryPercentage]);

    const handleNextStep = () => {
        if (saleType === 'crediario' && !validationStatus.isValid) return;
        if (principalAmount < 0) return;
        setStep(saleType === 'crediario' ? 'contract' : 'summary');
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
                    dueDay: selectedDueDay
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

    // --- Helper para Gerar Lista de Parcelas ---
    const generateInstallmentList = () => {
        let list = "";
        let currentMonth = new Date().getMonth() + 1;
        let currentYear = new Date().getFullYear();
        
        for (let i = 1; i <= installments; i++) {
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            const maxDay = new Date(currentYear, currentMonth + 1, 0).getDate();
            const day = Math.min(selectedDueDay, maxDay);
            const dueDate = new Date(currentYear, currentMonth, day);
            list += `${i}ª Parcela: R$ ${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} - Vencimento: ${dueDate.toLocaleDateString('pt-BR')}\n`;
            currentMonth++;
        }
        return list;
    };

    const renderConfigStep = () => (
        <div className="space-y-6">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button onClick={() => { setSaleType('crediario'); setInstallments(1); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'crediario' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Crediário Próprio</button>
                <button onClick={() => { setSaleType('direct'); setInstallments(1); setDownPayment(''); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Pagamento Direto</button>
            </div>

            {saleType === 'crediario' ? (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl flex justify-between items-center">
                    <div>
                        <span className="block text-xs font-medium text-indigo-900 dark:text-indigo-200 uppercase">Margem Mensal Livre</span>
                        <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{availableMonthlyLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="text-right">
                        <span className="block text-xs text-slate-500 dark:text-slate-400">Limite Parcela: {monthlyLimitTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-2">
                    {['pix', 'boleto', 'credit_card'].map(m => (
                        <button key={m} onClick={() => setPaymentMethod(m as any)} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === m ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                            <span className="text-xs font-bold uppercase">{m.replace('_', ' ')}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 dark:text-slate-400">Valor do Produto</span>
                <span className="font-medium text-slate-900 dark:text-white">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            
            {saleType === 'crediario' && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Valor da Entrada (R$)</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">R$</span>
                            <input type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} placeholder="0,00" className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                        <p className="text-xs text-slate-500 mt-1 text-right">Saldo a financiar: {principalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dia de Vencimento</label>
                        <div className="flex gap-2">
                            {[5, 10, 15, 20, 25].map(day => (
                                <button key={day} onClick={() => setSelectedDueDay(day)} className={`flex-1 py-2 border rounded-lg text-xs font-bold transition-colors ${selectedDueDay === day ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>Dia {day}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Parcelamento</label>
                <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: saleType === 'direct' ? MAX_INSTALLMENTS_CARD : MAX_INSTALLMENTS_CREDIARIO }, (_, i) => i + 1).map((num) => (
                        <button key={num} onClick={() => setInstallments(num)} className={`py-2 rounded-lg text-sm font-medium transition-all ${installments === num ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{num}x</button>
                    ))}
                </div>
                {currentInterestRate > 0 && installments > 1 && <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 text-center">*Inclui juros de {currentInterestRate}% a.m.</p>}
            </div>

            {/* Resumo Dinâmico */}
            <div className={`p-4 rounded-xl border-2 transition-all ${!validationStatus.isValid && saleType === 'crediario' ? 'border-red-100 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50' : 'border-green-100 bg-green-50 dark:bg-green-900/20 dark:border-green-800/50'}`}>
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Valor da Parcela</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    {!validationStatus.isValid && saleType === 'crediario' ? 
                        <span className="px-2 py-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 text-xs rounded-md font-bold">Entrada Insuficiente</span> : 
                        <span className="px-2 py-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded-md font-bold">Aprovado</span>
                    }
                </div>
                <div className="flex justify-between items-center mt-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                    <p className="text-xs text-slate-500">Total Final:</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{totalFinancedWithInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                
                {/* Detalhe do Erro de Entrada */}
                {!validationStatus.isValid && saleType === 'crediario' && (
                    <div className="mt-3 pt-2 border-t border-red-200 dark:border-red-800/30 text-xs text-red-700 dark:text-red-300">
                        <p className="font-bold mb-1">Motivo:</p>
                        <ul className="list-disc list-inside opacity-90 space-y-0.5">
                            <li>Mínimo da Loja ({(minEntryPercentage * 100).toFixed(0)}%): <strong>R$ {validationStatus.mandatoryEntry.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></li>
                            <li>Ajuste ao Limite Mensal: <strong>R$ {validationStatus.limitGapEntry.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></li>
                        </ul>
                        <p className="mt-2 font-bold">Entrada Necessária: R$ {validationStatus.requiredTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderContractStep = () => (
        <div className="space-y-6 flex-1 overflow-y-auto">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg h-80 overflow-y-auto text-xs text-justify border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-serif leading-relaxed">
                
                <div className="flex justify-center mb-4">
                    <div className="text-center">
                        <h2 className="font-bold text-sm">CONTRATO DE CONFISSÃO DE DÍVIDA</h2>
                        <p className="text-[10px]">COM RESERVA DE DOMÍNIO</p>
                    </div>
                </div>

                <p><strong>CREDOR:</strong> {COMPANY_DATA.razaoSocial}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {COMPANY_DATA.cnpj}, com sede em {COMPANY_DATA.endereco}.</p>
                <p className="mt-2"><strong>DEVEDOR:</strong> {profile.first_name} {profile.last_name}, inscrito(a) no CPF sob o nº {profile.identification_number || 'N/A'}, residente e domiciliado(a) no endereço cadastrado neste aplicativo.</p>
                
                <p className="mt-3 font-bold">CLÁUSULA PRIMEIRA - DO OBJETO</p>
                <p>1.1. O presente contrato tem por objeto a compra e venda do produto/serviço: "<strong>{product.name}</strong>", adquirido pelo DEVEDOR junto ao CREDOR.</p>

                <p className="mt-3 font-bold">CLÁUSULA SEGUNDA - DO PREÇO E FORMA DE PAGAMENTO</p>
                <p>2.1. O preço total ajustado para a aquisição do produto, já inclusos os encargos financeiros pactuados, é de R$ {totalFinancedWithInterest.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.</p>
                <p>2.2. O pagamento será realizado da seguinte forma:</p>
                <p className="pl-4">a) Entrada de R$ {downPaymentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}, paga no ato.</p>
                <p className="pl-4">b) O saldo restante será pago em {installments} parcelas mensais e sucessivas de R$ {installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.</p>

                <p className="mt-3 font-bold">CLÁUSULA TERCEIRA - DO VENCIMENTO E DAS PARCELAS</p>
                <p>3.1. As parcelas terão os seguintes vencimentos e valores:</p>
                <pre className="font-mono text-[10px] bg-slate-100 dark:bg-slate-900 p-2 rounded mt-1 mb-1 whitespace-pre-wrap">
                    {generateInstallmentList()}
                </pre>

                <p className="mt-3 font-bold">CLÁUSULA QUARTA - DA MORA E INADIMPLEMENTO</p>
                <p>4.1. O não pagamento de qualquer parcela na data de seu vencimento sujeitará o DEVEDOR ao pagamento de multa de 2% (dois por cento) sobre o valor do débito e juros moratórios de 1% (um por cento) ao mês, conforme artigo 52, § 1º do Código de Defesa do Consumidor.</p>
                <p>4.2. O atraso superior a 30 (trinta) dias poderá ensejar a inclusão do nome do DEVEDOR nos órgãos de proteção ao crédito (SPC/SERASA), bem como o protesto do título e a cobrança judicial da dívida.</p>

                <p className="mt-3 font-bold">CLÁUSULA QUINTA - DA ANTECIPAÇÃO DE PAGAMENTO</p>
                <p>5.1. É assegurado ao DEVEDOR o direito à liquidação antecipada do débito, total ou parcialmente, mediante redução proporcional dos juros e demais acréscimos, na forma do artigo 52, § 2º do Código de Defesa do Consumidor.</p>

                <p className="mt-3 font-bold">CLÁUSULA SEXTA - DA RESERVA DE DOMÍNIO</p>
                <p>6.1. Em virtude da venda ser a prazo, o CREDOR reserva para si o domínio do bem alienado até a liquidação total da dívida, transferindo-se ao DEVEDOR apenas a posse direta, nos termos dos artigos 521 e seguintes do Código Civil Brasileiro.</p>

                <p className="mt-3 font-bold">CLÁUSULA SÉTIMA - DAS DISPOSIÇÕES GERAIS</p>
                <p>7.1. O DEVEDOR declara ter conferido o produto no ato da entrega, recebendo-o em perfeitas condições de uso.</p>
                <p>7.2. A assinatura digital aposta neste instrumento, realizada mediante senha pessoal e intransferível no aplicativo do CREDOR, é válida e eficaz para todos os fins legais, conforme Medida Provisória nº 2.200-2/2001.</p>

                <p className="mt-3 font-bold">CLÁUSULA OITAVA - DO FORO</p>
                <p>8.1. As partes elegem o foro da Comarca de Macapá/AP para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>

                <p className="mt-6 text-center">Macapá, {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}.</p>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Assine no espaço abaixo:</label>
                <SignaturePad onEnd={setSignature} />
            </div>

            <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <input 
                    type="checkbox" 
                    id="terms" 
                    checked={termsAccepted} 
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500" 
                />
                <label htmlFor="terms" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    Li, compreendi e concordo com todos os termos do contrato acima e autorizo a emissão das faturas em meu nome.
                </label>
            </div>
        </div>
    );

    const renderSummaryStep = () => (
        <div className="text-center p-6">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Confirmar Pedido?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Revise os dados antes de finalizar.</p>
            
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-6 text-left space-y-2">
                <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Produto</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{product.name}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Pagamento</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">{paymentMethod.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">R$ {totalFinancedWithInterest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{step === 'config' ? 'Configurar' : step === 'contract' ? 'Contrato Jurídico' : 'Confirmar'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">✕</button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    {step === 'config' && renderConfigStep()}
                    {step === 'contract' && renderContractStep()}
                    {step === 'summary' && renderSummaryStep()}
                    {error && <div className="mt-4"><Alert message={error} type="error" /></div>}
                </div>
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                    {step !== 'config' && <button onClick={() => setStep('config')} className="flex-1 py-3 border rounded-xl font-bold">Voltar</button>}
                    {step === 'config' ? (
                        <button onClick={handleNextStep} disabled={(saleType === 'crediario' && !validationStatus.isValid) || isLoadingLimit} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold disabled:opacity-50">
                            {isLoadingLimit ? <LoadingSpinner /> : 'Continuar'}
                        </button>
                    ) : (
                        <button onClick={handleConfirmPurchase} disabled={isProcessing || (step === 'contract' && (!signature || !termsAccepted))} className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold disabled:opacity-50">
                            {isProcessing ? <LoadingSpinner /> : 'Confirmar Compra'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PurchaseModal;
