import React, { useState, useEffect } from 'react';
import { getProfile } from '../services/profileService';
import { supabase } from '../services/clients';
import { CardSkeleton } from './Skeleton'; 
import CreditScoreGauge from './CreditScoreGauge';
import InfoCarousel from './InfoCarousel';
import Modal from './Modal';
import ScoreHistoryView from './ScoreHistoryView';
import LimitInfoView from './LimitInfoView';
import { Profile, Invoice, Tab } from '../types';

interface PageInicioProps {
    setActiveTab: (tab: Tab) => void;
}

const QuickAction: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; color: string }> = ({ icon, label, onClick, color }) => (
  <button 
    onClick={onClick} 
    className="flex flex-col items-center gap-2 group active:scale-95 transition-transform"
  >
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200 ${color} text-white`}>
      {icon}
    </div>
    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 text-center">{label}</span>
  </button>
);

const PageInicio: React.FC<PageInicioProps> = ({ setActiveTab }) => {
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'score' | 'limit' | null>(null);
  
  // Estado para instalação PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      // Impede que o mini-infobar apareça no mobile
      e.preventDefault();
      // Salva o evento para ser disparado depois
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Mostra o prompt de instalação
    deferredPrompt.prompt();
    // Espera pela escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // Limpa o prompt salvo, pois ele só pode ser usado uma vez
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
          const [profile, invoicesData] = await Promise.all([
            getProfile(user.id),
            supabase.from('invoices').select('*').eq('user_id', user.id)
          ]);

          setProfileData({ id: user.id, email: user.email, ...profile });
          setInvoices(invoicesData.data || []);
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHomeData();
  }, []);
  
  // Helper para abrir o chat
  const openSupportChat = () => {
      window.dispatchEvent(new Event('open-support-chat'));
  };
  
  // Cálculos de progresso
  const totalDebt = invoices.reduce((acc, inv) => acc + inv.amount, 0);
  const paidDebt = invoices.filter(inv => inv.status === 'Paga').reduce((acc, inv) => acc + inv.amount, 0);
  const progressPercent = totalDebt > 0 ? (paidDebt / totalDebt) * 100 : 100;
  const nextInvoice = invoices.filter(i => i.status === 'Em aberto' || i.status === 'Boleto Gerado').sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  if (isLoading) {
    return (
        <div className="w-full max-w-md space-y-6 p-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></div>
                <div className="space-y-2 flex-1">
                    <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                    <div className="h-6 w-1/2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                </div>
            </div>
            <CardSkeleton />
            <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse"></div>
        </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-md space-y-6 animate-fade-in pb-6">
        
        {/* Header */}
        <div className="flex justify-between items-center px-2 pt-2">
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{getGreeting()},</p>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {profileData?.first_name || 'Cliente'}
                </h2>
            </div>
            <div 
                onClick={() => setActiveTab(Tab.PERFIL)}
                className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center cursor-pointer overflow-hidden ring-2 ring-transparent hover:ring-indigo-500 transition-all"
            >
                {profileData?.avatar_url ? (
                    <img src={profileData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    <span className="text-indigo-600 font-bold">{profileData?.first_name?.[0] || 'U'}</span>
                )}
            </div>
        </div>
        
        {/* Install App Button */}
        {deferredPrompt && (
            <button 
                onClick={handleInstallClick}
                className="w-full py-3 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 animate-fade-in-up"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Instalar Aplicativo
            </button>
        )}

        {/* Payment Progress */}
        {totalDebt > 0 && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                 <div className="flex justify-between text-xs text-slate-500 mb-2">
                    <span>Pagamentos Realizados</span>
                    <span>{Math.round(progressPercent)}%</span>
                 </div>
                 <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                     <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                        style={{ width: `${progressPercent}%` }}
                     ></div>
                 </div>
                 <p className="text-xs text-right mt-1 text-slate-400">
                    Restam {invoices.filter(i => i.status !== 'Paga').length} parcelas
                 </p>
            </div>
        )}

        {/* Card Principal */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl shadow-xl shadow-indigo-500/30 p-6 relative overflow-hidden text-white">
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    {nextInvoice && (
                         <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-full">
                            Vence {new Date(nextInvoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}
                        </span>
                    )}
                </div>
                
                {nextInvoice ? (
                    <>
                        <p className="text-indigo-100 text-sm font-medium">Próxima Fatura</p>
                        <h3 className="text-3xl font-bold mt-1 tracking-tight">
                            {nextInvoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                        <button 
                            onClick={() => setActiveTab(Tab.FATURAS)}
                            className="mt-4 w-full py-3 bg-white text-indigo-700 rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            Pagar Agora
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-indigo-100 text-sm">Status da Conta</p>
                        <h3 className="text-2xl font-bold mt-1 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Tudo pago!
                        </h3>
                        <button 
                            onClick={() => setActiveTab(Tab.LOJA)}
                            className="mt-4 w-full py-3 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-xl font-semibold hover:bg-white/30 transition-colors"
                        >
                            Ir para a Loja
                        </button>
                    </>
                )}
            </div>
            {/* Decorative Shapes */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>
        </div>

        {/* Acesso Rápido */}
        <div>
             <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 px-2">Acesso Rápido</h3>
             <div className="grid grid-cols-4 gap-2">
                <QuickAction 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                    label="Loja"
                    onClick={() => setActiveTab(Tab.LOJA)}
                    color="bg-blue-500"
                />
                 <QuickAction 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                    label="Faturas"
                    onClick={() => setActiveTab(Tab.FATURAS)}
                    color="bg-emerald-500"
                />
                 <QuickAction 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                    label="Limites"
                    onClick={() => { setModalView('limit'); setIsModalOpen(true); }}
                    color="bg-violet-500"
                />
                 <QuickAction 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                    label="Suporte"
                    onClick={openSupportChat}
                    color="bg-pink-500"
                />
             </div>
        </div>

        {/* Carrossel */}
        <div className="pt-2">
            <InfoCarousel />
        </div>

        {/* Widget Score */}
        <div 
          onClick={() => { setModalView('score'); setIsModalOpen(true); }}
          className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
        >
             <div className="flex items-center gap-4">
                 <div className="h-12 w-12 rounded-full border-4 border-slate-100 dark:border-slate-700 flex items-center justify-center relative">
                     <span className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent rotate-45"></span>
                     <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Score</span>
                 </div>
                 <div>
                     <p className="font-bold text-slate-800 dark:text-white">Meu Score</p>
                     <p className="text-xs text-slate-500 dark:text-slate-400">Clique para ver detalhes</p>
                 </div>
             </div>
             <div className="text-right">
                 <span className="block text-2xl font-bold text-slate-800 dark:text-white">{profileData?.credit_score || 0}</span>
                 <span className="text-xs text-green-500 font-medium">Bom histórico</span>
             </div>
        </div>

      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {modalView === 'score' && <ScoreHistoryView currentScore={profileData?.credit_score ?? 0} />}
        {modalView === 'limit' && profileData && <LimitInfoView profile={profileData} onClose={() => setIsModalOpen(false)} />}
      </Modal>
    </>
  );
};

export default PageInicio;