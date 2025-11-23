
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
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Disponível para Compras</span>
                    <div className="flex items-baseline justify-center">
                        <span className="text-sm font-bold text-slate-500 mr-1">R$</span>
                        <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">
                            {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="w-12 h-1 bg-slate-100 dark:bg-slate-700 rounded-full mx-auto my-2"></div>
                    <p className="text-xs text-slate-400 font-medium">
                        Limite Total: R$ {max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
    const canBuyFull = productValue <= availableLimit;
    const entryNeeded = canBuyFull ? 0 : productValue - availableLimit;

    return (
        <div className="space-y-6 animate-fade-in pt-2">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">Simulador de Compra</h3>
                        <p className="text-xs text-slate-500">Planeje sua próxima aquisição.</p>
                    </div>
                </div>
                
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Valor do Produto</label>
                        <span className="text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">R$ {productValue.toLocaleString('pt-BR')}</span>
                    </div>
                    <input type="range" min="100" max={totalLimit * 2 || 5000} step="50" value={productValue} onChange={(e) => setProductValue(Number(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
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
                        <span className="text-2xl font-black text-slate-800 dark:text-white">{installmentValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-slate-700/50 my-3"></div>
                    {canBuyFull ? (
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                            <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>
                            <span className="font-bold text-sm">Aprovado sem entrada!</span>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
                                <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg></div>
                                <span className="font-bold text-sm">Entrada Necessária</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 ml-7">Para liberar esta compra, você precisaria dar uma entrada de aprox. <strong className="text-slate-900 dark:text-white">{entryNeeded.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</strong>.</p>
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
    const [usedLimit, setUsedLimit] = useState(0);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [lastRequest, setLastRequest] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                // 1. Faturas
                const { data: invoices, error } = await supabase
                    .from('invoices')
                    .select('amount')
                    .eq('user_id', profile.id)
                    .or('status.eq.Em aberto,status.eq.Boleto Gerado');

                if (error) throw error;
                const totalUsed = invoices?.reduce((acc, inv) => acc + inv.amount, 0) || 0;
                setUsedLimit(totalUsed);

                // 2. Última solicitação
                const { data: requests } = await supabase
                    .from('limit_requests')
                    .select('*')
                    .eq('user_id', profile.id)
                    .order('created_at', { ascending: false })
                    .limit(1);
                
                if (requests && requests.length > 0) {
                    setLastRequest(requests[0]);
                }

            } catch (err) {
                console.error("Erro ao buscar dados do perfil:", err);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, [profile.id]);
    
    const creditLimit = profile.credit_limit || 0;
    const availableLimit = Math.max(0, creditLimit - usedLimit);

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
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        Meus Limites
                    </h2>
                    <div className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800">
                        NÍVEL {profile.credit_score && profile.credit_score > 700 ? 'OURO' : 'PRATA'}
                    </div>
                </div>
                <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl relative mb-2 border border-slate-200 dark:border-slate-700">
                    <button onClick={() => setActiveTab('visão_geral')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'visão_geral' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Resumo</button>
                    <button onClick={() => setActiveTab('simulador')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'simulador' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Simulador</button>
                    <button onClick={() => setActiveTab('historico')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'historico' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Histórico</button>
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
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Utilizado</p>
                                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">R$ {usedLimit.toLocaleString('pt-BR')}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Score</p>
                                        <p className="text-lg font-bold text-indigo-600">{profile.credit_score || 0}</p>
                                    </div>
                                </div>

                                {/* Última Solicitação Status */}
                                {lastRequest && lastRequest.status !== 'pending' && (
                                    <div className={`p-4 rounded-xl border animate-fade-in-up shadow-sm ${lastRequest.status === 'approved' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className={`font-bold text-sm flex items-center gap-2 ${lastRequest.status === 'approved' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                                                {lastRequest.status === 'approved' ? (
                                                    <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg> Aprovado</>
                                                ) : (
                                                    <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg> Recusado</>
                                                )}
                                            </h4>
                                            <span className="text-xs opacity-70 text-slate-500 dark:text-slate-400">{new Date(lastRequest.updated_at || lastRequest.created_at).toLocaleDateString()}</span>
                                        </div>
                                        
                                        {/* Seção de Motivo/Resposta com destaque */}
                                        {lastRequest.admin_response_reason && (
                                            <div className="mt-3 bg-white dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Mensagem da Análise</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                                                    "{lastRequest.admin_response_reason}"
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h4 className="font-bold text-lg mb-1">Precisa de mais limite?</h4>
                                        <p className="text-xs text-indigo-100 mb-4 opacity-90">Solicite uma reanálise do seu perfil agora mesmo.</p>
                                        <button onClick={() => setShowRequestForm(true)} className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors shadow-sm active:scale-95">
                                            Solicitar Aumento
                                        </button>
                                    </div>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'simulador' && <SimulatorTab availableLimit={availableLimit} totalLimit={creditLimit} />}
                        {activeTab === 'historico' && (
                            <div className="space-y-6 animate-fade-in pt-2">
                                <div className="relative pl-8 border-l-2 border-dashed border-slate-200 dark:border-slate-700 space-y-8">
                                    <div className="relative">
                                        <div className="absolute -left-[39px] top-0 w-5 h-5 bg-indigo-600 rounded-full border-4 border-white dark:border-slate-900 shadow-md"></div>
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-indigo-100 dark:border-slate-700">
                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1 block uppercase tracking-wide">Limite Atual</span>
                                            <p className="text-2xl font-black text-slate-900 dark:text-white">{creditLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">Aprovado e vigente.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default LimitInfoView;
