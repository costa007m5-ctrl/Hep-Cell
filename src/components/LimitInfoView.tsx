
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

// --- Componentes Visuais Premium ---

const LiquidGauge: React.FC<{ value: number; max: number }> = ({ value, max }) => {
    const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    
    // Cores dinâmicas baseadas na disponibilidade
    let colorClass = "from-emerald-400 to-green-600";
    let shadowClass = "shadow-emerald-500/20";
    if (percentage < 40) { colorClass = "from-amber-400 to-orange-500"; shadowClass = "shadow-orange-500/20"; }
    if (percentage < 10) { colorClass = "from-rose-500 to-red-600"; shadowClass = "shadow-red-500/20"; }

    return (
        <div className="relative w-64 h-64 mx-auto my-6">
            {/* Glow externo */}
            <div className={`absolute inset-0 bg-gradient-to-tr ${colorClass} rounded-full blur-3xl opacity-20 animate-pulse`}></div>
            
            {/* Círculo Principal */}
            <div className={`relative w-full h-full rounded-full bg-white dark:bg-slate-800 shadow-2xl ${shadowClass} border-4 border-slate-50 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden`}>
                
                {/* Onda de fundo (Representando o limite DISPONÍVEL) */}
                <div 
                    className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${colorClass} opacity-10 transition-all duration-1000 ease-out`}
                    style={{ height: `${percentage}%` }}
                ></div>

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

                {/* Anel de Progresso SVG */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
                    <circle
                        cx="50%" cy="50%" r="48%"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-slate-100 dark:text-slate-700"
                    />
                    <circle
                        cx="50%" cy="50%" r="48%"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray="301.59" // 2 * PI * r (aprox 48%)
                        strokeDashoffset={301.59 - (301.59 * percentage) / 100}
                        strokeLinecap="round"
                        className={`text-indigo-500 transition-all duration-1000 ease-out drop-shadow-md`}
                        style={{ stroke: percentage < 20 ? '#ef4444' : percentage < 50 ? '#f59e0b' : '#10b981' }}
                    />
                </svg>
            </div>
        </div>
    );
};

const DNAItem: React.FC<{ label: string; value: string; icon: React.ReactNode; status: 'good' | 'neutral' | 'bad' }> = ({ label, value, icon, status }) => {
    const statusColors = {
        good: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        neutral: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        bad: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };

    return (
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${statusColors[status]}`}>
                    {icon}
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{value}</p>
                </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${status === 'good' ? 'bg-green-500' : status === 'neutral' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
        </div>
    );
};

const SimulatorTab: React.FC<{ availableLimit: number; totalLimit: number }> = ({ availableLimit, totalLimit }) => {
    const [productValue, setProductValue] = useState<number>(1500);
    const [installments, setInstallments] = useState(10);
    
    const installmentValue = installments > 0 ? productValue / installments : 0;
    
    // Lógica de Crediário: Geralmente o limite é sobre o valor TOTAL da compra.
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
                
                {/* Slider Valor */}
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Valor do Produto</label>
                        <span className="text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">R$ {productValue.toLocaleString('pt-BR')}</span>
                    </div>
                    <input 
                        type="range" 
                        min="100" 
                        max={totalLimit * 2 || 5000} 
                        step="50"
                        value={productValue}
                        onChange={(e) => setProductValue(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                </div>

                {/* Slider Parcelas */}
                <div className="mb-8">
                    <div className="flex justify-between mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Parcelas</label>
                        <span className="text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">{installments}x</span>
                    </div>
                    <input 
                        type="range" 
                        min="1" 
                        max="12" 
                        step="1"
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                </div>

                {/* Resultado */}
                <div className={`p-5 rounded-2xl border-l-4 transition-all shadow-sm ${canBuyFull ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10' : 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10'}`}>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Valor da Parcela:</span>
                        <span className="text-2xl font-black text-slate-800 dark:text-white">
                            {installmentValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                        </span>
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
                            <p className="text-xs text-slate-600 dark:text-slate-400 ml-7">
                                Para liberar esta compra, você precisaria dar uma entrada de aprox. <strong className="text-slate-900 dark:text-white">{entryNeeded.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</strong>.
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
    const [usedLimit, setUsedLimit] = useState(0);
    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        const calculateUsedLimit = async () => {
            setIsLoadingData(true);
            try {
                // Busca faturas reais para calcular o limite usado
                const { data: invoices, error } = await supabase
                    .from('invoices')
                    .select('amount')
                    .eq('user_id', profile.id)
                    .or('status.eq.Em aberto,status.eq.Boleto Gerado');

                if (error) throw error;

                const totalUsed = invoices?.reduce((acc, inv) => acc + inv.amount, 0) || 0;
                setUsedLimit(totalUsed);
            } catch (err) {
                console.error("Erro ao calcular limite usado:", err);
            } finally {
                setIsLoadingData(false);
            }
        };
        calculateUsedLimit();
    }, [profile.id]);
    
    const creditLimit = profile.credit_limit || 0;
    const availableLimit = Math.max(0, creditLimit - usedLimit);
    
    // Proteção contra divisão por zero
    const percentageAvailable = creditLimit > 0 ? (availableLimit / creditLimit) * 100 : 0;

    // Lógica simples para "Melhor dia de compra"
    const today = new Date();
    const bestDay = new Date();
    bestDay.setDate(today.getDate() + 5); // Simulação: Melhor dia é daqui a 5 dias

    if (showRequestForm) {
        return (
            <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-900">
                <LimitRequestForm currentLimit={creditLimit} onClose={() => setShowRequestForm(false)} score={profile.credit_score || 0} />
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-40 bg-slate-100 dark:bg-slate-900 flex flex-col animate-fade-in h-full">
            
            {/* Header Fixo com Navegação */}
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

                {/* Tabs Superiores - Estilo Segmented Control */}
                <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl relative mb-2 border border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={() => setActiveTab('visão_geral')} 
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'visão_geral' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Resumo
                    </button>
                    <button 
                        onClick={() => setActiveTab('simulador')} 
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'simulador' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Simulador
                    </button>
                    <button 
                        onClick={() => setActiveTab('historico')} 
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'historico' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Histórico
                    </button>
                </div>
            </div>

            {/* Conteúdo Scrollável com padding-bottom para não esconder atrás da navbar do app */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 custom-scrollbar">
                {isLoadingData ? (
                    <div className="flex justify-center py-20"><LoadingSpinner /></div>
                ) : (
                    <>
                        {activeTab === 'visão_geral' && (
                            <div className="space-y-6 animate-fade-in">
                                
                                {/* Gráfico Principal */}
                                <LiquidGauge value={availableLimit} max={creditLimit} />

                                {/* Informações Rápidas */}
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

                                {/* Análise de Crédito */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 px-1 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        Análise do Perfil
                                    </h3>
                                    <div className="space-y-2">
                                        <DNAItem 
                                            label="Histórico de Pagamentos" 
                                            value="Excelente" 
                                            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
                                            status="good" 
                                        />
                                        <DNAItem 
                                            label="Comprometimento" 
                                            value={`${(100 - percentageAvailable).toFixed(0)}% Usado`} 
                                            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} 
                                            status={percentageAvailable > 50 ? 'good' : 'neutral'} 
                                        />
                                    </div>
                                </div>

                                {/* Ações */}
                                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h4 className="font-bold text-lg mb-1">Precisa de mais limite?</h4>
                                        <p className="text-xs text-indigo-100 mb-4 opacity-90">Solicite uma reanálise do seu perfil agora mesmo.</p>
                                        <button 
                                            onClick={() => setShowRequestForm(true)}
                                            className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors shadow-sm active:scale-95"
                                        >
                                            Solicitar Aumento
                                        </button>
                                    </div>
                                    {/* Decor */}
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
                                            <p className="text-2xl font-black text-slate-900 dark:text-white">
                                                {creditLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-1">Aprovado e vigente.</p>
                                        </div>
                                    </div>

                                    <div className="relative opacity-60">
                                        <div className="absolute -left-[39px] top-0 w-5 h-5 bg-slate-300 dark:bg-slate-600 rounded-full border-4 border-white dark:border-slate-900"></div>
                                        <div className="pl-2">
                                            <span className="text-xs font-bold text-slate-400 mb-1 block uppercase">Inicial</span>
                                            <p className="text-xl font-bold text-slate-600 dark:text-slate-400">R$ 0,00</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Início do relacionamento.</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex items-start gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                                        <strong>Dica Pro:</strong> Pagar suas faturas antes do vencimento por 3 meses seguidos aumenta significativamente suas chances de aumento automático.
                                    </p>
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
