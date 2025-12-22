
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getProfile } from '../services/profileService';
import { supabase } from '../services/clients';
import { CardSkeleton } from './Skeleton'; 
import ScoreHistoryView from './ScoreHistoryView';
import LimitInfoView from './LimitInfoView';
import Modal from './Modal';
import { Profile, Invoice, Tab, Contract } from '../types';
import SignaturePad from './SignaturePad';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from './Toast';
import { OffersPage, SecurityPage, NewsPage, TipsPage } from './StoryPages';

interface PageInicioProps {
    setActiveTab: (tab: Tab) => void;
}

// --- WIDGET DE STATUS DE ENTREGA ---
const DeliveryTrackingWidget: React.FC<{ order: any, onClick: () => void }> = ({ order, onClick }) => {
    // Mapeamento de Status
    const steps = [
        { id: 'processing', label: 'Aprovado' },
        { id: 'preparing', label: 'Preparando' },
        { id: 'shipped', label: 'Enviado' },
        { id: 'out_for_delivery', label: 'Saiu p/ Entrega' },
        { id: 'delivered', label: 'Entregue' }
    ];

    const currentStepIndex = steps.findIndex(s => s.id === order.status);
    const progress = Math.max(5, (currentStepIndex / (steps.length - 1)) * 100);

    return (
        <div onClick={onClick} className="mx-2 mt-4 bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-lg border border-indigo-100 dark:border-slate-700 relative overflow-hidden cursor-pointer group">
            {/* Background Animation */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>
                {order.status === 'out_for_delivery' && (
                    <div className="absolute -bottom-10 -left-10 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10 animate-slide-reveal"></div>
                )}
            </div>
            
            <div className="flex justify-between items-center mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl text-white shadow-md ${order.status === 'delivered' ? 'bg-green-500' : 'bg-indigo-600'}`}>
                        {order.status === 'out_for_delivery' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 animate-bounce-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v3.28a1 1 0 00.684.948l6 2.5a1 1 0 00.816-.948V6.3" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.364 8.636L13.5 11.5M16.364 8.636l2.828-2.828M16.364 8.636L13.5 5.8" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                            {order.status === 'delivered' ? 'Pedido Entregue!' : 'Acompanhar Entrega'}
                        </h3>
                        <p className="text-xs text-slate-500">#{order.id.slice(0,6).toUpperCase()}</p>
                    </div>
                </div>
                <div className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-600'}`}>
                    {steps[currentStepIndex]?.label || 'Processando'}
                </div>
            </div>

            {/* Barra de Progresso Animada */}
            <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full mb-3 overflow-visible">
                <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    style={{ width: `${progress}%` }}
                >
                    {/* Caminhão Animado */}
                    {order.status !== 'delivered' && (
                        <div className="absolute -right-2 -top-2.5 text-lg transform rotate-y-180 drop-shadow-md">
                            🚚
                        </div>
                    )}
                </div>
            </div>

            {/* Observações Dinâmicas */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 flex items-start gap-2">
                <span className="text-sm">ℹ️</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-tight">
                    {order.tracking_notes || "Aguardando atualização da equipe de logística..."}
                </p>
            </div>
        </div>
    );
};

// ... (Resto do código PageInicio mantido, apenas adicionando o Widget no return) ...

const PageInicio: React.FC<PageInicioProps> = ({ setActiveTab }) => {
  const [profileData, setProfileData] = useState<Profile & { coins_balance?: number } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null); // Novo estado para pedido
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);
  const [activeLimitNotification, setActiveLimitNotification] = useState<{id: string, status: string} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI States
  const [showValues, setShowValues] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'score' | 'limit' | 'sign_contract' | null>(null);
  const [activeStory, setActiveStory] = useState<'ofertas' | 'seguranca' | 'novidades' | 'dicas' | null>(null); 
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const { addToast } = useToast();

  const stories = [
      { id: 'ofertas', img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=150&h=150&fit=crop', label: 'Ofertas' },
      { id: 'seguranca', img: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?w=150&h=150&fit=crop', label: 'Segurança' },
      { id: 'novidades', img: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=150&h=150&fit=crop', label: 'Novidades' },
      { id: 'dicas', img: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=150&h=150&fit=crop', label: 'Dicas' },
  ];

  // ... (Hooks de PWA e Helpers mantidos) ...
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const fetchHomeData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [profile, invoicesData, contractsData, requestsData, ordersData] = await Promise.all([
          getProfile(user.id),
          supabase.from('invoices').select('*').eq('user_id', user.id),
          supabase.from('contracts').select('*').eq('user_id', user.id).eq('status', 'pending_signature').limit(1),
          supabase.from('limit_requests').select('id, status, updated_at').eq('user_id', user.id).order('created_at', {ascending: false}).limit(1),
          supabase.from('orders').select('*').eq('user_id', user.id).neq('status', 'cancelled').order('created_at', {ascending: false}).limit(1)
        ]);

        setProfileData({ id: user.id, email: user.email, ...profile });
        setInvoices(invoicesData.data || []);
        if (ordersData.data && ordersData.data.length > 0) setActiveOrder(ordersData.data[0]);
        else setActiveOrder(null);
        
        if (contractsData.data && contractsData.data.length > 0) setPendingContract(contractsData.data[0]);
        else setPendingContract(null);

        if (requestsData.data && requestsData.data.length > 0) {
            const lastReq = requestsData.data[0];
            if (lastReq.status !== 'pending') {
                const seenId = localStorage.getItem('relp_seen_limit_req_id');
                if (seenId !== lastReq.id) {
                    setActiveLimitNotification({ id: lastReq.id, status: lastReq.status });
                }
            }
        }
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeData();
    const handleFocus = () => fetchHomeData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchHomeData]);
  
  // ... (handleSignContract e outros handlers mantidos) ...
  const handleSignContract = async () => {
      if (!signature || !pendingContract) return;
      setIsSigning(true);
      try {
          const { error: contractError } = await supabase.from('contracts').update({ 
              status: 'Assinado', 
              signature_data: signature, 
              terms_accepted: true 
          }).eq('id', pendingContract.id);

          if (contractError) throw new Error("Falha ao salvar assinatura.");

          await supabase.from('invoices')
            .update({ status: 'Em aberto' })
            .eq('user_id', pendingContract.user_id)
            .eq('status', 'Aguardando Assinatura');

          addToast("Contrato assinado com sucesso!", "success");
          setPendingContract(null); 
          setIsModalOpen(false);
          setSignature(null); 
          fetchHomeData();

      } catch (e: any) {
          addToast(e.message || "Erro ao assinar contrato.", "error");
      } finally {
          setIsSigning(false);
      }
  };

  const handleLimitNotificationClick = () => {
      if (activeLimitNotification) {
          localStorage.setItem('relp_seen_limit_req_id', activeLimitNotification.id);
          setActiveLimitNotification(null);
          setModalView('limit');
          setIsModalOpen(true);
      }
  };

  const { maxMonthlyCommitment } = useMemo(() => {
      const monthlyCommitments: Record<string, number> = {};
      invoices.filter(i => i.status === 'Em aberto' || i.status === 'Boleto Gerado').forEach(inv => {
          const dueMonth = inv.due_date.substring(0, 7); 
          monthlyCommitments[dueMonth] = (monthlyCommitments[dueMonth] || 0) + inv.amount;
      });
      return { maxMonthlyCommitment: Math.max(0, ...Object.values(monthlyCommitments)) };
  }, [invoices]);

  const creditLimit = profileData?.credit_limit || 0;
  const availableLimit = Math.max(0, creditLimit - maxMonthlyCommitment);
  const limitUsedPercent = creditLimit > 0 ? ((creditLimit - availableLimit) / creditLimit) * 100 : 0;
  
  const entryInvoice = useMemo(() => {
      return invoices.find(i => i.notes?.includes('ENTRADA') && i.status === 'Em aberto');
  }, [invoices]);

  const nextInvoice = invoices.filter(i => !i.notes?.includes('ENTRADA') && (i.status === 'Em aberto' || i.status === 'Boleto Gerado')).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  const overdueCount = useMemo(() => {
      const now = new Date().getTime();
      const hours48 = 48 * 60 * 60 * 1000;
      return invoices.filter(i => {
          const dueTime = new Date(i.due_date + 'T23:59:59').getTime();
          const isLate = (dueTime + hours48) < now;
          const isEntry = i.notes?.includes('ENTRADA') || i.month.startsWith('Entrada');
          return i.status === 'Em aberto' && isLate && !isEntry;
      }).length;
  }, [invoices]);

  const formatValue = (value: number) => {
      if (!showValues) return '••••••';
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const coinsValue = (profileData?.coins_balance || 0) / 100;

  if (isLoading) {
    return (
        <div className="w-full max-w-md space-y-6 p-4 pt-10">
            <div className="flex justify-between items-center"><div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div><div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></div></div>
            <div className="h-20 w-full bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse"></div>
            <CardSkeleton />
            <div className="h-40 w-full bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse"></div>
        </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-md space-y-6 animate-fade-in pb-6 relative">
        
        {/* Header */}
        <div className="flex justify-between items-center px-2 pt-4">
            <div className="flex items-center gap-3">
                <div onClick={() => setActiveTab(Tab.PERFIL)} className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-indigo-500 to-purple-500 cursor-pointer">
                    {profileData?.avatar_url ? (
                        <img src={profileData.avatar_url} alt="Avatar" className="w-full h-full object-cover rounded-full border-2 border-slate-50 dark:border-slate-900" />
                    ) : (
                        <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-50 dark:border-slate-900">
                            <span className="text-indigo-600 font-bold text-lg">{profileData?.first_name?.[0] || 'U'}</span>
                        </div>
                    )}
                </div>
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-none mb-1">{getGreeting()},</p>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-none">{profileData?.first_name || 'Cliente'}</h2>
                    
                    <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 mt-1 rounded-full w-fit">
                        <span className="w-4 h-4 rounded-full bg-yellow-400 text-yellow-900 flex items-center justify-center text-[8px] font-bold border border-yellow-300">RC</span>
                        <span className="text-xs font-bold text-yellow-800 dark:text-yellow-200">
                            {profileData?.coins_balance || 0} Coins (R$ {coinsValue.toFixed(2)})
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setShowValues(!showValues)} className="p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700 active:scale-95 transition-all">
                    {showValues ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.572-2.572m3.76-3.76a9.953 9.953 0 015.674-1.334c2.744 0 5.258.953 7.26 2.548m2.24 2.24a9.958 9.958 0 011.342 2.144c-1.274 4.057-5.064 7-9.542 7a9.97 9.97 0 01-2.347-.278M9.88 9.88a3 3 0 104.24 4.24" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>}
                </button>
            </div>
        </div>

        {/* ACTIVE ORDER TRACKING (NEW) */}
        {activeOrder && <DeliveryTrackingWidget order={activeOrder} onClick={() => setActiveTab(Tab.PERFIL)} />}

        {/* Alerts Priority */}
        {overdueCount > 0 && (
            <div className="mx-4 mt-4 p-4 bg-red-100 dark:bg-red-900/40 border-l-4 border-red-600 rounded-r-xl shadow-md animate-bounce-slow flex flex-col gap-2">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-200 dark:bg-red-800 rounded-full text-red-800 dark:text-red-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-red-900 dark:text-white">Regularize seu Crediário</h3>
                        <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                            Você possui <strong>{overdueCount} fatura(s)</strong> com mais de 48h de atraso. Evite o bloqueio.
                        </p>
                    </div>
                </div>
                <button onClick={() => setActiveTab(Tab.FATURAS)} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow transition-colors">
                    Ver Faturas em Atraso
                </button>
            </div>
        )}
        
        {entryInvoice && (
            <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl shadow-sm animate-pulse flex flex-col gap-3">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full text-red-700 dark:text-red-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-red-800 dark:text-red-100">Pagamento de Entrada Pendente</h3>
                        <p className="text-xs text-red-700 dark:text-red-200 mt-1">
                            Valor: <strong>R$ {entryInvoice.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                            <br/>
                            Atenção: Pague em até 12h para evitar o cancelamento.
                        </p>
                    </div>
                </div>
                <button onClick={() => setActiveTab(Tab.FATURAS)} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow-md transition-colors">
                    Pagar Entrada Agora
                </button>
            </div>
        )}

        {pendingContract && !entryInvoice && (
            <div className="mx-4 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl shadow-sm animate-pulse flex flex-col gap-3">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-800 rounded-full text-yellow-700 dark:text-yellow-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-yellow-800 dark:text-yellow-100">{pendingContract.title || 'Contrato Pendente'}</h3>
                        <p className="text-xs text-yellow-700 dark:text-yellow-200 mt-1">
                            Ação necessária: Leia e assine digitalmente para liberar sua compra.
                        </p>
                    </div>
                </div>
                <button onClick={() => { setModalView('sign_contract'); setIsModalOpen(true); }} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg text-sm shadow-md transition-colors">
                    Ler e Assinar
                </button>
            </div>
        )}

        {/* Stories Rail */}
        <div className="flex gap-3 overflow-x-auto px-2 pb-2 scrollbar-hide">
            {stories.map(story => (
                <button key={story.id} onClick={() => setActiveStory(story.id as any)} className="flex flex-col items-center space-y-1 min-w-[72px] group">
                    <div className={`p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600`}>
                        <div className="p-[2px] bg-slate-50 dark:bg-slate-900 rounded-full">
                            <img src={story.img} alt={story.label} className="w-14 h-14 rounded-full object-cover border border-slate-100 dark:border-slate-800 group-active:scale-95 transition-transform" />
                        </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate w-full text-center">{story.label}</span>
                </button>
            ))}
        </div>
        
        {/* Main Card - Limits */}
        <div className="relative mx-2 h-52 bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/20 overflow-hidden group transition-transform active:scale-[0.99]">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full opacity-20 blur-3xl -mr-20 -mt-20"></div>
             <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600 rounded-full opacity-20 blur-2xl -ml-10 -mb-10"></div>
             <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-pink-500 rounded-full opacity-10 blur-2xl -translate-x-1/2 -translate-y-1/2"></div>

             <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Margem Mensal Disponível</p>
                        <h3 className="text-3xl font-bold tracking-tight">{formatValue(availableLimit)}</h3>
                    </div>
                    <div className="w-10 h-6 rounded-md bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                        <div className="flex gap-0.5">
                            <div className="w-2 h-2 rounded-full bg-red-500/80"></div>
                            <div className="w-2 h-2 rounded-full bg-yellow-500/80"></div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                     <div className="flex justify-between text-sm">
                         <span className="text-slate-300">Limite de Parcela</span>
                         <span className="font-semibold">{formatValue(creditLimit)}</span>
                     </div>
                     <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Utilizado</span>
                            <span>{Math.round(limitUsedPercent)}% do limite mensal</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                             <div className={`h-full rounded-full transition-all duration-1000 ${limitUsedPercent > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} style={{ width: `${limitUsedPercent}%` }}></div>
                        </div>
                     </div>
                </div>
             </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 px-2">
             {/* ... Buttons ... */}
             <button onClick={() => setActiveTab(Tab.FATURAS)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 w-full active:scale-95 transition-all">
                <div className="text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
                <span className="text-xs font-bold">Pagar Fatura</span>
             </button>
             <button onClick={() => setActiveTab(Tab.LOJA)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 shadow-sm w-full active:scale-95 transition-all">
                <div className="text-indigo-600 dark:text-indigo-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg></div>
                <span className="text-xs font-bold">Ir para Loja</span>
             </button>
             <button onClick={() => { setModalView('limit'); setIsModalOpen(true); }} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 shadow-sm w-full active:scale-95 transition-all">
                <div className="text-indigo-600 dark:text-indigo-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
                <span className="text-xs font-bold">Meus Limites</span>
             </button>
             <button onClick={() => { setModalView('score'); setIsModalOpen(true); }} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 shadow-sm w-full active:scale-95 transition-all">
                <div className="text-indigo-600 dark:text-indigo-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 012-2v10m-6 0a2 2 0 002 2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
                <span className="text-xs font-bold">Hub de Score</span>
             </button>
        </div>

        {/* Banner */}
        <div onClick={() => setActiveTab(Tab.LOJA)} className="mx-2 relative h-32 rounded-2xl overflow-hidden cursor-pointer group">
            <img src="https://images.unsplash.com/photo-1605236453806-67791431f370?w=600&auto=format&fit=crop&q=60" alt="Offer" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-black/40 flex flex-col justify-center px-6">
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded w-fit mb-2">OFERTA RELÂMPAGO</span>
                <h3 className="text-white font-bold text-xl">iPhone 15 Pro</h3>
                <p className="text-white/90 text-sm">A partir de R$ 299/mês</p>
            </div>
        </div>

        {/* Help Button */}
        <button onClick={() => window.dispatchEvent(new Event('open-support-chat'))} className="mx-auto mt-4 flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-indigo-600 transition-colors p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Precisa de ajuda?
        </button>

      </div>

      {/* --- OVERLAYS (Modais) --- */}
      {/* ... (Mantidos do original) ... */}
      {activeStory === 'ofertas' && <OffersPage onClose={() => setActiveStory(null)} />}
      {activeStory === 'seguranca' && <SecurityPage onClose={() => setActiveStory(null)} />}
      {activeStory === 'novidades' && <NewsPage onClose={() => setActiveStory(null)} />}
      {activeStory === 'dicas' && <TipsPage onClose={() => setActiveStory(null)} />}
      
      {/* Modal de Assinatura de Contrato */}
      {modalView === 'sign_contract' && isModalOpen && pendingContract && (
          <Modal isOpen={true} onClose={() => setIsModalOpen(false)}>
              <div className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Assinatura Digital</h3>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-600 whitespace-pre-wrap font-mono leading-relaxed text-justify">
                      {pendingContract.items || "Carregando termos..."}
                  </div>
                  <label className="block text-sm font-medium mb-2">Assine abaixo para confirmar:</label>
                  <SignaturePad onEnd={setSignature} />
                  <button onClick={handleSignContract} disabled={!signature || isSigning} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 flex justify-center">
                      {isSigning ? <LoadingSpinner /> : 'Confirmar e Aceitar Termos'}
                  </button>
              </div>
          </Modal>
      )}
      
      {modalView === 'score' && isModalOpen && (
          <ScoreHistoryView currentScore={profileData?.credit_score ?? 0} onClose={() => setIsModalOpen(false)} onNavigate={(tab: Tab) => { setIsModalOpen(false); setActiveTab(tab); }} />
      )}
      {modalView === 'limit' && isModalOpen && profileData && (
          <LimitInfoView profile={profileData} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
};

export default PageInicio;
