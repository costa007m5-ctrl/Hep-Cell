
import React, { useState, useEffect, useMemo } from 'react';
import { Profile, Invoice } from '../types';
import LimitRequestForm from './LimitRequestForm';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';

interface LimitInfoViewProps {
  profile: Profile;
  onClose: () => void;
}

type Tab = 'visão_geral' | 'simulador' | 'historico';

const LiquidGauge: React.FC<{ value: number; max: number }> = ({ value, max }) => {
    const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    let colorClass = "from-emerald-400 to-green-600";
    let shadowClass = "shadow-emerald-500/20";
    if (percentage < 40) { colorClass = "from-amber-400 to-orange-500"; shadowClass = "shadow-orange-500/20"; }
    if (percentage < 10) { colorClass = "from-rose-500 to-red-600"; shadowClass = "shadow-red-500/20"; }

    return (
        <div className="relative w-64 h-64 mx-auto my-6">
            <div className={`absolute inset-0 bg-gradient-to-tr ${colorClass} rounded-full blur-3xl opacity-20 animate-pulse`}></div>
            <div className={`relative w-full h-full rounded-full bg-white dark:bg-slate-800 shadow-2xl ${shadowClass} border-4 border-slate-50 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden`}>
                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${colorClass} opacity-10 transition-all duration-1000 ease-out`} style={{ height: `${percentage}%` }}></div>
                <div className="relative z-10 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Margem Mensal</span>
                    <div className="flex items-baseline justify-center">
                        <span className="text-sm font-bold text-slate-500 mr-1">R$</span>
                        <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">
                            {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="w-12 h-1 bg-slate-100 dark:bg-slate-700 rounded-full mx-auto my-2"></div>
                    <p className="text-xs text-slate-400 font-medium">
                        De R$ {max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Totais
                    </p>
                </div>
                <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
                    <circle cx="50%" cy="50%" r="48%" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-100 dark:text-slate-700"/>
                    <circle cx="50%" cy="50%" r="48%" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="301.59" strokeDashoffset={301.59 - (301.59 * percentage) / 100} strokeLinecap="round" className={`text-indigo-500 transition-all duration-1000 ease-out drop-shadow-md`} style={{ stroke: percentage < 20 ? '#ef4444' : percentage < 50 ? '#f59e0b' : '#10b981' }}/>
                </svg>
            </div>
        </div>
    );
};

const SimulatorTab: React.FC<{ availableLimit: number; totalLimit: number }> = ({ availableLimit, totalLimit }) => {
    const [productValue, setProductValue] = useState<number>(1500);
    const [installments, setInstallments] = useState(10);
    const installmentValue = installments > 0 ? productValue / installments : 0;
    // Lógica corrigida: Verifica se a PARCELA cabe na MARGEM DISPONÍVEL
    const canBuyFull = installmentValue <= availableLimit;
    
    // Se não couber, calcula quanto de entrada é necessária para reduzir a parcela até caber no limite
    // ParcelaDesejada = ValorFinanciado / Parcelas <= Limite
    // ValorFinanciado <= Limite * Parcelas
    // ValorProduto - Entrada <= Limite * Parcelas
    // Entrada >= ValorProduto - (Limite * Parcelas)
    const entryNeeded = Math.max(0, productValue - (availableLimit * installments));

    return (
        <div className="space-y-6 animate-fade-in pt-2">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">Simulador de Crediário</h3>
                        <p className="text-xs text-slate-500">Veja seu poder de compra mensal.</p>
                    </div>
                </div>
                
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Valor do Produto</label>
                        <span className="text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">R$ {productValue.toLocaleString('pt-BR')}</span>
                    </div>
                    <input type="range" min="500" max="10000" step="100" value={productValue} onChange={(e) => setProductValue(Number(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                </div>

                <div className="mb-8">
                    <div className="flex justify-between mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Parcelas</label>
                        <span className="text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">{installments}x</span>
                    </div>
                    <input type="range" min="1" max="12" step="1" value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                </div>

                <div className={`p-5 rounded-2xl border-l-4 transition-all shadow-sm ${canBuyFull ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10' : 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10'}`}>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Valor da Parcela:</span>
                        <span className={`text-2xl font-black ${canBuyFull ? 'text-green-600' : 'text-amber-600'}`}>{installmentValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-slate-700/50 my-3"></div>
                    {canBuyFull ? (
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                            <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>
                            <span className="font-bold text-sm">Aprovado! Cabe na sua margem.</span>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
                                <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg></div>
                                <span className="font-bold text-sm">Margem Excedida</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 ml-7">
                                Sugestão: Dê uma entrada de <strong className="text-slate-900 dark:text-white">{entryNeeded.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</strong> para conseguir comprar.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const LimitInfoView: React.FC<LimitInfoViewProps> = ({ profile, onClose }) => {
    const [activeTab, setActiveTab] = useState<Tab>('visão_geral');
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [usedMonthlyLimit, setUsedMonthlyLimit] = useState(0);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [requestHistory, setRequestHistory] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                // 1. Faturas para calcular Comprometimento MENSAL
                const { data: invoices, error } = await supabase
                    .from('invoices')
                    .select('amount, due_date, notes, month')
                    .eq('user_id', profile.id)
                    .or('status.eq.Em aberto,status.eq.Boleto Gerado');

                if (error) throw error;
                
                const monthlyCommitments: Record<string, number> = {};
                invoices?.forEach(inv => {
                    // CORREÇÃO CRÍTICA: 
                    // Vendas à vista e Entradas NÃO devem consumir o limite mensal do crediário.
                    // O limite de crédito define o valor máximo da *parcela mensal* que o cliente pode assumir.
                    const isCashSale = inv.notes?.includes('VENDA_AVISTA') || inv.notes?.includes('Compra Direta');
                    const isEntry = inv.notes?.includes('ENTRADA') || inv.month.toLowerCase().includes('entrada');

                    if (isCashSale || isEntry) return;

                    const dueMonth = inv.due_date.substring(0, 7); // YYYY-MM
                    monthlyCommitments[dueMonth] = (monthlyCommitments[dueMonth] || 0) + inv.amount;
                });
                
                // O limite usado é o maior valor comprometido em qualquer mês futuro
                const maxMonthly = Math.max(0, ...Object.values(monthlyCommitments));
                setUsedMonthlyLimit(maxMonthly);

                // 2. Histórico de Solicitações
                const { data: requests } = await supabase
                    .from('limit_requests')
                    .select('*')
                    .eq('user_id', profile.id)
                    .order('created_at', { ascending: false });
                
                if (requests) setRequestHistory(requests);
            } catch (err) { console.error(err); } finally { setIsLoadingData(false); }
        };
        fetchData();
    }, [profile.id]);
    
    // O Credit Limit no banco representa a "Margem de Parcela Mensal"
    const creditLimit = profile.credit_limit || 0;
    const availableLimit = Math.max(0, creditLimit - usedMonthlyLimit);

    if (showRequestForm) {
        return (
            <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-900">
                <LimitRequestForm 
                    currentLimit={creditLimit} 
                    onClose={() => setShowRequestForm(false)} 
                    score={profile.credit_score || 0} 
                    lastRequestDate={profile.last_limit_request_date}
                />
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-40 bg-slate-100 dark:bg-slate-900 flex flex-col animate-fade-in h-full">
            <div className="bg-white dark:bg-slate-800 px-4 pt-safe pb-2 shadow-sm z-50">
                <div className="flex items-center justify-between mb-3 pt-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <button onClick={onClose} className="mr-1 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        Meus Limites
                    </h2>
                    <div className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800">
                        NÍVEL {profile.credit_score && profile.credit_score > 700 ? 'OURO' : 'PRATA'}
                    </div>
                </div>
                <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl relative mb-2 border border-slate-200 dark:border-slate-700">
                    <button onClick={() => setActiveTab('visão_geral')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'visão_geral' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Resumo</button>
                    <button onClick={() => setActiveTab('simulador')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'simulador' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Simulador</button>
                    <button onClick={() => setActiveTab('historico')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'historico' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Histórico</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24 custom-scrollbar">
                {isLoadingData ? (
                    <div className="flex justify-center py-20"><LoadingSpinner /></div>
                ) : (
                    <>
                        {activeTab === 'visão_geral' && (
                            <div className="space-y-6 animate-fade-in">
                                <LiquidGauge value={availableLimit} max={creditLimit} />
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Comprometido (Mês)</p>
                                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">R$ {usedMonthlyLimit.toLocaleString('pt-BR')}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Score</p>
                                        <p className="text-lg font-bold text-indigo-600">{profile.credit_score || 0}</p>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h4 className="font-bold text-lg mb-1">Aumentar Margem?</h4>
                                        <p className="text-xs text-indigo-100 mb-4 opacity-90">Seu limite define o valor máximo da sua parcela mensal.</p>
                                        <button onClick={() => setShowRequestForm(true)} className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors">Solicitar Aumento</button>
                                    </div>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'simulador' && <SimulatorTab availableLimit={availableLimit} totalLimit={creditLimit} />}
                        {activeTab === 'historico' && (
                            <div className="space-y-4 pt-2">
                                {requestHistory.length > 0 ? requestHistory.map((req) => (
                                    <div key={req.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm ${req.status === 'approved' ? 'border-green-200' : req.status === 'rejected' ? 'border-red-200' : 'border-slate-200'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${req.status === 'approved' ? 'bg-green-100 text-green-700' : req.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                            </span>
                                            <span className="text-xs text-slate-400">{new Date(req.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm font-bold">Solicitado: R$ {req.requested_amount?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                        {req.admin_response_reason && (
                                            <div className="mt-3 p-3 rounded-lg text-xs bg-slate-50 dark:bg-slate-900">
                                                <p className="font-bold mb-1 uppercase opacity-70">Análise:</p>
                                                <p>"{req.admin_response_reason}"</p>
                                            </div>
                                        )}
                                    </div>
                                )) : <div className="text-center py-10 text-slate-400">Nenhum histórico.</div>}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default LimitInfoView;
