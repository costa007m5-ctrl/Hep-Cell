
import React, { useState, useEffect, useMemo } from 'react';
import { ScoreHistory, Invoice, Profile } from '../types';
import { supabase } from '../services/clients';
import { getProfile } from '../services/profileService';
import LoadingSpinner from './LoadingSpinner';
import CreditScoreGauge from './CreditScoreGauge';
import Confetti from './Confetti';
import { Tab } from '../types'; 

interface ScoreHistoryViewProps {
  currentScore: number;
  onClose: () => void;
  onNavigate?: (tab: Tab) => void;
}

// --- Componentes Auxiliares ---

const DNAProgressBar: React.FC<{ value: number; color: string; label: string; description: string }> = ({ value, color, label, description }) => (
    <div className="mb-4 group">
        <div className="flex justify-between text-xs mb-1.5">
            <span className="font-bold text-slate-700 dark:text-slate-200">{label}</span>
            <span className={`font-black ${color.replace('bg-', 'text-')}`}>{Math.round(value)}/100</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
            <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${color} relative`} 
                style={{ width: `${value}%` }}
            >
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/30"></div>
            </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors">{description}</p>
    </div>
);

const BenefitCard: React.FC<{ title: string; desc: string; locked: boolean; icon: string; badge?: string }> = ({ title, desc, locked, icon, badge }) => (
    <div className={`p-4 rounded-2xl border flex items-start gap-4 transition-all duration-300 relative overflow-hidden group ${locked ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 opacity-80 grayscale-[0.8]' : 'bg-white dark:bg-slate-800 border-indigo-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner shrink-0 ${locked ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
                <h4 className="font-bold text-slate-900 dark:text-white truncate pr-2">{title}</h4>
                {locked ? (
                    <div className="text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg></div>
                ) : (
                    <div className="text-green-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" /></svg></div>
                )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">{desc}</p>
            {badge && !locked && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold uppercase rounded-md">
                    {badge}
                </span>
            )}
        </div>
    </div>
);

// Componente de Missão Inteligente
const MissionItem: React.FC<{ 
    id: string;
    title: string; 
    xp: number; 
    status: 'pending' | 'claimable' | 'claimed'; 
    onAction: () => void; 
    actionLabel: string;
    isLoading?: boolean;
}> = ({ title, xp, status, onAction, actionLabel, isLoading }) => (
    <div className={`flex items-center justify-between p-3 rounded-xl border mb-3 transition-all ${
        status === 'claimed' ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 opacity-70' : 
        status === 'claimable' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-700' : 
        'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
    }`}>
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                status === 'claimed' ? 'bg-green-500 border-green-500 text-white' : 
                status === 'claimable' ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-500 animate-pulse' :
                'border-slate-300 dark:border-slate-600 text-slate-300'
            }`}>
                {status === 'claimed' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : (
                    <span className="text-xs font-bold">+{xp}</span>
                )}
            </div>
            <div>
                <p className={`text-sm font-medium ${status === 'claimed' ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'}`}>{title}</p>
                <p className="text-[10px] text-slate-400">
                    {status === 'claimed' ? 'Recompensa resgatada' : status === 'claimable' ? 'Pronto para resgatar!' : `Ganhe +${xp} de score`}
                </p>
            </div>
        </div>
        
        {status !== 'claimed' && (
            <button 
                onClick={onAction}
                disabled={isLoading}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    status === 'claimable' 
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30' 
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300'
                }`}
            >
                {isLoading ? <LoadingSpinner /> : status === 'claimable' ? 'Resgatar' : actionLabel}
                {status === 'pending' && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
            </button>
        )}
    </div>
);

const SparklineChart: React.FC<{ data: number[] }> = ({ data }) => {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="h-16 w-full relative">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                <defs>
                    <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={`M0,100 L${points} L100,100 Z`} fill="url(#gradient)" />
                <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {data.map((val, i) => (
                    <circle key={i} cx={(i / (data.length - 1)) * 100} cy={100 - ((val - min) / range) * 100} r="1.5" fill="#fff" stroke="#6366f1" strokeWidth="1" />
                ))}
            </svg>
        </div>
    );
};

const ScoreHistoryView: React.FC<ScoreHistoryViewProps> = ({ currentScore, onClose, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'missoes' | 'beneficios' | 'historico'>('dashboard');
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [animateGauge, setAnimateGauge] = useState(false);
  
  // Dados reais para validação das missões
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [userInvoices, setUserInvoices] = useState<Invoice[]>([]);
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [isClaiming, setIsClaiming] = useState<string | null>(null);

  // Trigger animations on mount
  useEffect(() => {
      setTimeout(() => setAnimateGauge(true), 100);
      if (currentScore > 850) setShowConfetti(true);
  }, [currentScore]);

  // DNA Logic
  const dna = useMemo(() => {
      const factor = currentScore / 1000;
      return {
          pagamento: Math.min(100, Math.round(factor * 100 + 10)),
          limite: Math.min(100, Math.max(30, Math.round((1 - factor) * 60 + 40))),
          tempo: Math.min(100, Math.round(factor * 90)),
          consultas: Math.min(100, Math.round(factor * 95)),
      };
  }, [currentScore]);

  const getTier = (score: number) => {
      if (score < 300) return { name: 'Start', color: 'text-slate-500', bg: 'from-slate-400 to-slate-600', next: 300, icon: '🌱' };
      if (score < 500) return { name: 'Bronze', color: 'text-amber-700', bg: 'from-amber-600 to-orange-700', next: 500, icon: '🥉' };
      if (score < 700) return { name: 'Prata', color: 'text-slate-400', bg: 'from-slate-400 to-zinc-500', next: 700, icon: '🥈' };
      if (score < 850) return { name: 'Ouro', color: 'text-yellow-500', bg: 'from-yellow-400 to-yellow-600', next: 850, icon: '🥇' };
      return { name: 'Black', color: 'text-slate-900 dark:text-white', bg: 'from-slate-800 via-black to-slate-900', next: 1000, icon: '💎' };
  };

  const tier = getTier(currentScore);

  // Fetch Data (History, Profile, Invoices, Missions)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const [histRes, profileRes, invRes, missionsRes] = await Promise.all([
                supabase.from('score_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
                getProfile(user.id),
                supabase.from('invoices').select('*').eq('user_id', user.id),
                supabase.from('user_missions').select('mission_id').eq('user_id', user.id)
            ]);

            if (histRes.data) setHistory(histRes.data);
            if (profileRes) setUserProfile({ ...profileRes, id: user.id, email: user.email });
            if (invRes.data) setUserInvoices(invRes.data);
            if (missionsRes.data) {
                const claimedSet = new Set(missionsRes.data.map(m => m.mission_id));
                setCompletedMissions(claimedSet);
            }
        }
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // Lógica de Validação de Missões
  const getMissionStatus = (id: string): 'pending' | 'claimable' | 'claimed' => {
      if (completedMissions.has(id)) return 'claimed';
      if (!userProfile) return 'pending';

      switch(id) {
          case 'complete_profile':
              // Verifica se tem CPF, Telefone e Sobrenome
              return (userProfile.identification_number && userProfile.phone && userProfile.last_name) ? 'claimable' : 'pending';
          case 'pay_on_time':
              // Verifica se tem pelo menos uma fatura paga
              return userInvoices.some(inv => inv.status === 'Paga') ? 'claimable' : 'pending';
          case 'referral':
              // Simulação: Disponível sempre para incentivar
              return 'pending'; 
          default: return 'pending';
      }
  };

  const handleClaimMission = async (missionId: string, xp: number, reason: string) => {
      if (isClaiming) return;
      setIsClaiming(missionId);
      try {
          // Chama a RPC segura no banco para garantir a transação (add score + mark claimed)
          const { error } = await supabase.rpc('claim_mission_reward', {
              mission_id_input: missionId,
              xp_reward: xp,
              reason_input: reason
          });

          if (error) throw error;

          // Sucesso: Atualiza estado local
          setCompletedMissions(prev => new Set(prev).add(missionId));
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);
          
          // Atualiza histórico localmente para feedback imediato
          setHistory(prev => [{
              id: 'temp_' + Date.now(),
              user_id: userProfile?.id || '',
              change: xp,
              new_score: currentScore + xp,
              reason: reason,
              created_at: new Date().toISOString()
          }, ...prev]);

      } catch (err) {
          console.error("Erro ao resgatar:", err);
          alert("Erro ao resgatar recompensa. Tente novamente.");
      } finally {
          setIsClaiming(null);
      }
  };

  const handleNavigate = (tab: Tab, section?: string) => {
      if (section) sessionStorage.setItem('relp_profile_section', section);
      if (onNavigate) {
          onClose(); // Fecha o modal primeiro
          onNavigate(tab);
      }
  };

  if (loading) return <div className="fixed inset-0 bg-white dark:bg-slate-900 flex items-center justify-center z-[200]"><LoadingSpinner /></div>;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-50 dark:bg-slate-900 overflow-y-auto flex flex-col animate-fade-in">
        {showConfetti && <Confetti />}
        
        {/* Top Navigation Bar */}
        <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between transition-all">
            <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h1 className="text-base font-bold text-slate-900 dark:text-white opacity-90">Central de Crédito</h1>
            <div className="w-10 flex justify-end">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
        </div>

        <div className="flex-1 pb-safe overflow-x-hidden">
            
            {/* Hero Section - Score Gauge */}
            <div className="relative pt-2 pb-8 px-4 flex flex-col items-center bg-white dark:bg-slate-900 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-gradient-to-b from-indigo-50/50 via-transparent to-transparent dark:from-indigo-900/10 pointer-events-none"></div>
                <CreditScoreGauge score={currentScore} size={280} animate={animateGauge} />
                
                <div className="mt-[-30px] relative z-10 flex flex-col items-center animate-fade-in-up" style={{animationDelay: '0.3s'}}>
                    <div className={`px-5 py-1.5 rounded-full bg-gradient-to-r ${tier.bg} text-white font-bold text-xs shadow-lg shadow-black/10 flex items-center gap-2 ring-2 ring-white dark:ring-slate-800 transform hover:scale-105 transition-transform cursor-default`}>
                        <span className="text-lg">{tier.icon}</span>
                        <span className="tracking-wide">NÍVEL {tier.name.toUpperCase()}</span>
                    </div>
                    {tier.next < 1000 && (
                        <p className="text-[10px] text-slate-400 mt-2 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            Faltam {tier.next - currentScore} pontos para subir
                        </p>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-4 sticky top-[60px] z-40 bg-slate-50 dark:bg-slate-900 pb-2 pt-1 shadow-sm">
                <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar snap-x">
                    {[
                        { id: 'dashboard', label: 'Visão Geral' },
                        { id: 'missoes', label: 'Missões' },
                        { id: 'beneficios', label: 'Benefícios' },
                        { id: 'historico', label: 'Histórico' },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`flex-1 min-w-[90px] py-2.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap snap-start ${
                                activeTab === t.id 
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md transform scale-[1.02]' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 py-4 space-y-6 min-h-[400px]">
                
                {/* --- TAB: DASHBOARD --- */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-fade-in-up">
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    Análise de DNA
                                </h3>
                                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-2 py-1 rounded-md">Atualizado hoje</span>
                            </div>
                            
                            <DNAProgressBar label="Pagamento em Dia" value={dna.pagamento} color="bg-green-500" description="Impacto Alto: Sua pontualidade é excelente." />
                            <DNAProgressBar label="Uso de Crédito" value={dna.limite} color="bg-blue-500" description="Impacto Médio: Mantenha o uso consciente." />
                            <DNAProgressBar label="Histórico" value={dna.tempo} color="bg-purple-500" description="Impacto Baixo: Continue construindo relação." />
                            
                            <div className={`mt-6 p-3 rounded-xl border flex items-center gap-3 ${currentScore < 300 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'}`}>
                                <div className="text-xl">{currentScore < 300 ? '⚠️' : '🛡️'}</div>
                                <div>
                                    <p className="text-xs font-bold">CPF na Receita Federal</p>
                                    <p className="text-[10px] opacity-80">{currentScore < 300 ? 'Pendência Identificada (Atenção)' : 'Situação Regular (Protegido)'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: MISSÕES (FUNCIONAL E BALANCEADA) --- */}
                {activeTab === 'missoes' && (
                    <div className="space-y-4 animate-fade-in-up">
                        <div className="flex items-center justify-between px-1 mb-2">
                            <h3 className="font-bold text-slate-900 dark:text-white">Tarefas Disponíveis</h3>
                            <span className="text-xs text-slate-500">Pontos ajustados e seguros</span>
                        </div>
                        
                        <MissionItem 
                            id="complete_profile"
                            title="Completar Cadastro" 
                            xp={15} 
                            status={getMissionStatus('complete_profile')}
                            actionLabel="Ir para Dados"
                            isLoading={isClaiming === 'complete_profile'}
                            onAction={() => {
                                if (getMissionStatus('complete_profile') === 'claimable') {
                                    handleClaimMission('complete_profile', 15, 'Missão: Cadastro Completo');
                                } else {
                                    handleNavigate(Tab.PERFIL, 'data');
                                }
                            }}
                        />
                        
                        <MissionItem 
                            id="pay_on_time"
                            title="Pagar 1ª Fatura" 
                            xp={30} 
                            status={getMissionStatus('pay_on_time')}
                            actionLabel="Pagar Agora"
                            isLoading={isClaiming === 'pay_on_time'}
                            onAction={() => {
                                if (getMissionStatus('pay_on_time') === 'claimable') {
                                    handleClaimMission('pay_on_time', 30, 'Missão: Pagamento em Dia');
                                } else {
                                    handleNavigate(Tab.FATURAS);
                                }
                            }}
                        />
                        
                        <MissionItem 
                            id="referral"
                            title="Indicar um Amigo" 
                            xp={10} 
                            status={getMissionStatus('referral')}
                            actionLabel="Indicar"
                            isLoading={isClaiming === 'referral'}
                            onAction={() => handleNavigate(Tab.PERFIL, 'referral')}
                        />
                        
                        <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center">
                            <p className="text-xs text-indigo-800 dark:text-indigo-300 font-bold mb-1">Continue evoluindo!</p>
                            <div className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden mt-2">
                                <div className="h-full bg-indigo-600" style={{width: `${(currentScore / 1000) * 100}%`}}></div>
                            </div>
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">{currentScore}/1000 Score</p>
                        </div>
                    </div>
                )}

                {/* --- TAB: BENEFÍCIOS --- */}
                {activeTab === 'beneficios' && (
                    <div className="space-y-4 animate-fade-in-up">
                        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl mb-4 flex items-center gap-3">
                            <span className="text-3xl">{tier.icon}</span>
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Nível Atual</p>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">{tier.name}</h3>
                            </div>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-white px-1 uppercase tracking-wide mb-2">Vantagens Desbloqueadas</h3>
                        
                        <BenefitCard 
                            title="Compras Parceladas" 
                            desc="Até 12x no cartão ou crediário próprio."
                            locked={false}
                            icon="🛍️"
                            badge="Essencial"
                        />
                        <BenefitCard 
                            title="Frete Grátis" 
                            desc="Entrega expressa em 1 dia útil."
                            locked={false}
                            icon="🚚"
                            badge="Válido para Macapá e Santana"
                        />
                        
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white px-1 uppercase tracking-wide mt-6 mb-2 opacity-70">Próximos Níveis</h3>
                        <BenefitCard 
                            title="Aumento Automático" 
                            desc="Análise prioritária todo mês."
                            locked={currentScore < 700}
                            icon="🚀"
                            badge="Nível Ouro"
                        />
                        <BenefitCard 
                            title="Taxa Zero" 
                            desc="Desconto total de juros em renegociações."
                            locked={currentScore < 850}
                            icon="💎"
                            badge="Nível Black"
                        />
                    </div>
                )}

                {/* --- TAB: HISTÓRICO --- */}
                {activeTab === 'historico' && (
                    <div className="space-y-6 animate-fade-in-up">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Evolução Recente</h3>
                            <SparklineChart data={[300, 320, 310, 450, 480, currentScore]} />
                        </div>

                        <div className="space-y-0">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white px-1 mb-3">Timeline</h3>
                            {history.length > 0 ? (
                                <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-6 pb-4">
                                    {history.map((h, i) => (
                                        <div key={i} className="relative pl-6">
                                            <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${h.change >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-white">{h.reason}</p>
                                                    <p className="text-[10px] text-slate-400">{new Date(h.created_at).toLocaleDateString('pt-BR')} às {new Date(h.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                                </div>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${h.change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {h.change > 0 ? '+' : ''}{h.change}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-xs">
                                    Nenhum registro histórico encontrado.
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};

export default ScoreHistoryView;
