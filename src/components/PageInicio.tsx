
import React, { useState, useEffect, useMemo } from 'react';
import { getProfile } from '../services/profileService';
import { supabase } from '../services/clients';
import { CardSkeleton } from './Skeleton'; 
import ScoreHistoryView from './ScoreHistoryView';
import LimitInfoView from './LimitInfoView';
import Modal from './Modal';
import { Profile, Invoice, Tab, Contract } from '../types';
import SignaturePad from './SignaturePad';
import LoadingSpinner from './LoadingSpinner';

interface PageInicioProps {
    setActiveTab: (tab: Tab) => void;
}

// --- Componentes Internos ---

const PendingContractAlert: React.FC<{ contract: Contract; onSign: () => void }> = ({ contract, onSign }) => (
    <div className="mx-4 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl shadow-sm animate-pulse flex flex-col gap-3">
        <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-800 rounded-full text-yellow-700 dark:text-yellow-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
                <h3 className="font-bold text-yellow-800 dark:text-yellow-100">Contrato Pendente</h3>
                <p className="text-xs text-yellow-700 dark:text-yellow-200 mt-1">
                    Você tem uma compra de <strong>{contract.items}</strong> aguardando assinatura. Assine em até 24h para evitar o cancelamento.
                </p>
            </div>
        </div>
        <button onClick={onSign} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg text-sm shadow-md transition-colors">
            Assinar Agora
        </button>
    </div>
);

const StoryCircle: React.FC<{ img: string; label: string; viewed?: boolean; onClick?: () => void }> = ({ img, label, viewed, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center space-y-1 min-w-[72px] group">
        <div className={`p-[2px] rounded-full ${viewed ? 'bg-slate-200 dark:bg-slate-700' : 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600'}`}>
            <div className="p-[2px] bg-slate-50 dark:bg-slate-900 rounded-full">
                <img src={img} alt={label} className="w-14 h-14 rounded-full object-cover border border-slate-100 dark:border-slate-800 group-active:scale-95 transition-transform" />
            </div>
        </div>
        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate w-full text-center">{label}</span>
    </button>
);

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }> = ({ icon, label, onClick, primary }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all active:scale-95 w-full ${
            primary 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 shadow-sm'
        }`}
    >
        <div className={primary ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}>{icon}</div>
        <span className="text-xs font-bold">{label}</span>
    </button>
);

const ActivityItem: React.FC<{ title: string; date: string; amount?: string; type: 'payment' | 'purchase' | 'info'; onClick?: () => void }> = ({ title, date, amount, type, onClick }) => {
    const getIcon = () => {
        if (type === 'payment') return <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>;
        if (type === 'purchase') return <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg></div>;
        return <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg></div>;
    };

    return (
        <div 
            onClick={onClick}
            className={`flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-50 dark:border-slate-700/50 ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors active:scale-95' : ''}`}
        >
            <div className="flex items-center gap-3">
                {getIcon()}
                <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</p>
                    <p className="text-xs text-slate-500">{date}</p>
                </div>
            </div>
            {amount && <span className={`text-sm font-bold ${type === 'payment' ? 'text-green-600' : 'text-slate-900 dark:text-white'}`}>{amount}</span>}
        </div>
    );
};

const PageInicio: React.FC<PageInicioProps> = ({ setActiveTab }) => {
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [homeBanner, setHomeBanner] = useState<any>(null); // Novo estado para o banner dinâmico
  
  // UI States
  const [showValues, setShowValues] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'score' | 'limit' | 'sign_contract' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  // Mock Data for Stories
  const stories = [
      { id: 1, img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=150&h=150&fit=crop', label: 'Ofertas' },
      { id: 2, img: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?w=150&h=150&fit=crop', label: 'Segurança' },
      { id: 3, img: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=150&h=150&fit=crop', label: 'Novidades' },
      { id: 4, img: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=150&h=150&fit=crop', label: 'Dicas' },
  ];

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
    console.log(`User choice: ${outcome}`);
    setDeferredPrompt(null);
  };
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [profile, invoicesData, contractsData] = await Promise.all([
            getProfile(user.id),
            supabase.from('invoices').select('*').eq('user_id', user.id),
            supabase.from('contracts').select('*').eq('user_id', user.id).eq('status', 'pending_signature').limit(1)
          ]);

          setProfileData({ id: user.id, email: user.email, ...profile });
          setInvoices(invoicesData.data || []);
          
          if (contractsData.data && contractsData.data.length > 0) {
              setPendingContract(contractsData.data[0]);
          }
        }

        // Fetch Home Banner - Busca banner especifico da HOME
        const bannersRes = await fetch('/api/admin/banners');
        if (bannersRes.ok) {
            const banners = await bannersRes.json();
            // Encontra o banner ativo marcado para 'home' mais recente
            const activeHomeBanner = banners.find((b: any) => b.location === 'home' && b.active);
            if (activeHomeBanner) {
                setHomeBanner(activeHomeBanner);
            }
        }

      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHomeData();
  }, []);
  
  const handleSignContract = async () => {
      if (!signature || !pendingContract) return;
      setIsSigning(true);
      try {
          // 1. Atualiza Contrato
          await supabase.from('contracts').update({ 
              status: 'Ativo', 
              signature_data: signature, 
              terms_accepted: true 
          }).eq('id', pendingContract.id);

          // 2. Ativa as Faturas (usando lógica de tempo/user pois não temos FK direta)
          // Simplificação: Ativa todas 'Aguardando Assinatura' deste usuário
          await supabase.from('invoices').update({ status: 'Em aberto' }).eq('user_id', pendingContract.user_id).eq('status', 'Aguardando Assinatura');

          setPendingContract(null);
          setIsModalOpen(false);
          // Recarrega faturas
          const { data } = await supabase.from('invoices').select('*').eq('user_id', pendingContract.user_id);
          setInvoices(data || []);

      } catch (e) {
          console.error(e);
          alert("Erro ao assinar contrato.");
      } finally {
          setIsSigning(false);
      }
  };

  const totalDebt = useMemo(() => invoices.filter(i => i.status === 'Em aberto' || i.status === 'Boleto Gerado').reduce((acc, inv) => acc + inv.amount, 0), [invoices]);
  const creditLimit = profileData?.credit_limit || 0;
  const availableLimit = Math.max(0, creditLimit - totalDebt);
  const limitUsedPercent = creditLimit > 0 ? ((creditLimit - availableLimit) / creditLimit) * 100 : 0;
  
  const nextInvoice = invoices.filter(i => i.status === 'Em aberto' || i.status === 'Boleto Gerado').sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  const formatValue = (value: number) => {
      if (!showValues) return '••••••';
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
        <div className="w-full max-w-md space-y-6 p-4 pt-10">
            <div className="flex justify-between items-center">
                 <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                 <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></div>
            </div>
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
                <div 
                    onClick={() => setActiveTab(Tab.PERFIL)}
                    className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-indigo-500 to-purple-500 cursor-pointer"
                >
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
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-none">
                        {profileData?.first_name || 'Cliente'}
                    </h2>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowValues(!showValues)}
                    className="p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700 active:scale-95 transition-all"
                >
                    {showValues ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.572-2.572m3.76-3.76a9.953 9.953 0 015.674-1.334c2.744 0 5.258.953 7.26 2.548m2.24 2.24a9.958 9.958 0 011.342 2.144c-1.274 4.057-5.064 7-9.542 7a9.97 9.97 0 01-2.347-.278M9.88 9.88a3 3 0 104.24 4.24" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                    )}
                </button>
            </div>
        </div>

        {/* Pending Contract Alert */}
        {pendingContract && (
            <PendingContractAlert 
                contract={pendingContract} 
                onSign={() => { setModalView('sign_contract'); setIsModalOpen(true); }} 
            />
        )}

        {/* Stories Rail */}
        <div className="flex gap-3 overflow-x-auto px-2 pb-2 scrollbar-hide">
            {stories.map(story => (
                <StoryCircle 
                    key={story.id} 
                    img={story.img} 
                    label={story.label} 
                    onClick={() => setActiveTab(Tab.LOJA)} 
                />
            ))}
        </div>
        
        {/* PWA Install Button (Condicional) */}
        {deferredPrompt && (
            <div className="px-2">
                <button 
                    onClick={handleInstallClick}
                    className="w-full py-3 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 animate-fade-in-up"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Instalar App
                </button>
            </div>
        )}

        {/* Main Financial Card */}
        <div className="relative mx-2 h-52 bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/20 overflow-hidden group transition-transform active:scale-[0.99]">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full opacity-20 blur-3xl -mr-20 -mt-20"></div>
             <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600 rounded-full opacity-20 blur-2xl -ml-10 -mb-10"></div>
             <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-pink-500 rounded-full opacity-10 blur-2xl -translate-x-1/2 -translate-y-1/2"></div>

             <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Limite Disponível</p>
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
                         <span className="text-slate-300">Fatura Atual</span>
                         <span className="font-semibold">{formatValue(totalDebt)}</span>
                     </div>
                     
                     <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Utilizado</span>
                            <span>{Math.round(limitUsedPercent)}% do limite</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                             <div 
                                className={`h-full rounded-full transition-all duration-1000 ${limitUsedPercent > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                                style={{ width: `${limitUsedPercent}%` }}
                             ></div>
                        </div>
                     </div>
                </div>
             </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3 px-2">
            <ActionButton 
                primary 
                label="Pagar Fatura" 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                onClick={() => setActiveTab(Tab.FATURAS)}
            />
             <ActionButton 
                label="Ir para Loja" 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                onClick={() => setActiveTab(Tab.LOJA)}
            />
             <ActionButton 
                label="Meus Limites" 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                onClick={() => { setModalView('limit'); setIsModalOpen(true); }}
            />
             <ActionButton 
                label="Hub de Score" 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 012-2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                onClick={() => { setModalView('score'); setIsModalOpen(true); }}
            />
        </div>

        {/* Featured Offer Banner (Dynamic or Fallback) */}
        <div 
            onClick={() => setActiveTab(Tab.LOJA)}
            className="mx-2 relative h-32 rounded-2xl overflow-hidden cursor-pointer group"
        >
            <img 
                src={homeBanner ? homeBanner.image_url : "https://images.unsplash.com/photo-1605236453806-67791431f370?w=600&auto=format&fit=crop&q=60"} 
                alt="Offer" 
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-black/40 flex flex-col justify-center px-6">
                {homeBanner && homeBanner.subtitle && (
                    <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded w-fit mb-2">
                        {homeBanner.subtitle}
                    </span>
                )}
                {!homeBanner && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded w-fit mb-2">OFERTA RELÂMPAGO</span>
                )}
                
                <h3 className="text-white font-bold text-xl">{homeBanner ? homeBanner.title : 'iPhone 15 Pro'}</h3>
                <p className="text-white/90 text-sm">{homeBanner ? homeBanner.cta_text : 'A partir de R$ 299/mês'}</p>
            </div>
        </div>

        {/* Recent Activity / Feed */}
        <div className="px-4 pt-2">
            <h3 className="font-bold text-slate-800 dark:text-white mb-3 text-sm uppercase tracking-wide">Atividade Recente</h3>
            <div className="space-y-3">
                {nextInvoice ? (
                    <ActivityItem 
                        title={`Fatura de ${nextInvoice.month}`} 
                        date={`Vence em ${new Date(nextInvoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}`} 
                        amount={formatValue(nextInvoice.amount)}
                        type="purchase"
                        onClick={() => setActiveTab(Tab.FATURAS)}
                    />
                ) : (
                    <ActivityItem 
                        title="Tudo em dia!" 
                        date="Nenhuma fatura pendente" 
                        type="info" 
                        onClick={() => setActiveTab(Tab.FATURAS)} 
                    />
                )}
                <ActivityItem 
                    title="Hub de Score" 
                    date="Verifique sua pontuação" 
                    type="info" 
                    onClick={() => { setModalView('score'); setIsModalOpen(true); }}
                />
            </div>
        </div>

        {/* Help Button Floating */}
        <button 
            onClick={() => window.dispatchEvent(new Event('open-support-chat'))}
            className="mx-auto mt-4 flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-indigo-600 transition-colors p-2"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Precisa de ajuda?
        </button>

      </div>

      {/* Modals & Full Screen Views */}
      {modalView === 'score' && isModalOpen && (
          <ScoreHistoryView 
            currentScore={profileData?.credit_score ?? 0} 
            onClose={() => setIsModalOpen(false)} 
            onNavigate={(tab: Tab) => {
                setIsModalOpen(false);
                setActiveTab(tab);
            }}
          />
      )}
      
      {modalView === 'limit' && isModalOpen && profileData && (
          <LimitInfoView profile={profileData} onClose={() => setIsModalOpen(false)} />
      )}

      {modalView === 'sign_contract' && isModalOpen && pendingContract && (
          <Modal isOpen={true} onClose={() => setIsModalOpen(false)}>
              <div className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Assinatura Digital</h3>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 max-h-40 overflow-y-auto">
                      <p>Eu, {profileData?.first_name} {profileData?.last_name}, CPF {profileData?.identification_number}, reconheço a dívida referente a compra de {pendingContract.items} no valor total de {pendingContract.total_value?.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}, parcelado em {pendingContract.installments}x.</p>
                  </div>
                  <label className="block text-sm font-medium mb-2">Assine abaixo:</label>
                  <SignaturePad onEnd={setSignature} />
                  <button 
                    onClick={handleSignContract} 
                    disabled={!signature || isSigning}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                      {isSigning ? <LoadingSpinner /> : 'Confirmar e Liberar Compra'}
                  </button>
              </div>
          </Modal>
      )}
    </>
  );
};

export default PageInicio;
