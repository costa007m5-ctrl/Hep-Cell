import React, { useState, useEffect } from 'react';
import { getProfile } from '../services/profileService';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import CreditScoreGauge from './CreditScoreGauge';
import InfoCarousel from './InfoCarousel';
import Modal from './Modal';
import ScoreHistoryView from './ScoreHistoryView';
import LimitInfoView from './LimitInfoView';
import { Profile, Invoice, Tab } from '../types';

// Componente de Ação Rápida
const QuickAction: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; color: string }> = ({ icon, label, onClick, color }) => (
  <button 
    onClick={onClick} 
    className="flex flex-col items-center gap-2 group"
  >
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200 ${color} text-white`}>
      {icon}
    </div>
    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 text-center">{label}</span>
  </button>
);

const PageInicio: React.FC = () => {
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [nextInvoice, setNextInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'score' | 'limit' | null>(null);
  
  // Determina a saudação com base na hora
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
          // Busca perfil e faturas em paralelo
          const [profile, invoicesData] = await Promise.all([
            getProfile(user.id),
            supabase
              .from('invoices')
              .select('*')
              .eq('user_id', user.id)
              .in('status', ['Em aberto', 'Boleto Gerado'])
              .order('due_date', { ascending: true })
              .limit(1)
          ]);

          setProfileData({
            id: user.id,
            email: user.email,
            ...profile,
          });

          if (invoicesData.data && invoicesData.data.length > 0) {
            setNextInvoice(invoicesData.data[0]);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar dados da home:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHomeData();
  }, []);
  
  const handleOpenModal = (view: 'score' | 'limit') => {
    setModalView(view);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Simulação de navegação via disparo de evento de clique no Navbar (solução temporária para manter a estrutura atual)
  const navigateToTab = (tabId: number) => {
    // Em uma arquitetura ideal, passaríamos a função setActiveTab via props.
    // Como paliativo visual:
    const buttons = document.querySelectorAll('nav button');
    if(buttons[tabId]) (buttons[tabId] as HTMLButtonElement).click();
  };

  if (isLoading) {
    return <div className="h-[60vh] flex items-center justify-center"><LoadingSpinner /></div>;
  }

  return (
    <>
      <div className="w-full max-w-md space-y-6 animate-fade-in pb-6">
        
        {/* Header com Saudação */}
        <div className="flex justify-between items-center px-2 pt-2">
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{getGreeting()},</p>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {profileData?.first_name || 'Cliente'}
                </h2>
            </div>
            <div 
                onClick={() => navigateToTab(Tab.PERFIL)}
                className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold cursor-pointer"
            >
                {profileData?.first_name?.[0] || 'U'}
            </div>
        </div>

        {/* Card de Fatura Principal */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg p-6 relative overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    {nextInvoice && (
                         <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold rounded-full">
                            Vence em {new Date(nextInvoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}
                        </span>
                    )}
                </div>
                
                {nextInvoice ? (
                    <>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Fatura Atual</p>
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                            {nextInvoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                        <button 
                            onClick={() => navigateToTab(Tab.FATURAS)}
                            className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                        >
                            Pagar Agora
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Status da Conta</p>
                        <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1 flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Tudo em dia!
                        </h3>
                        <p className="text-sm text-slate-400 mt-2">Você não possui faturas pendentes.</p>
                        <button 
                            onClick={() => navigateToTab(Tab.FATURAS)}
                            className="mt-4 w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold transition-all active:scale-95"
                        >
                            Ver Histórico
                        </button>
                    </>
                )}
            </div>
            {/* Decorative Circle */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
        </div>

        {/* Acesso Rápido */}
        <div>
             <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 px-2">Acesso Rápido</h3>
             <div className="flex justify-between px-2">
                <QuickAction 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                    label="Loja"
                    onClick={() => navigateToTab(Tab.LOJA)}
                    color="bg-blue-500"
                />
                 <QuickAction 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    label="Faturas"
                    onClick={() => navigateToTab(Tab.FATURAS)}
                    color="bg-emerald-500"
                />
                 <QuickAction 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                    label="Limites"
                    onClick={() => handleOpenModal('limit')}
                    color="bg-violet-500"
                />
                 <QuickAction 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                    label="Perfil"
                    onClick={() => navigateToTab(Tab.PERFIL)}
                    color="bg-slate-500"
                />
             </div>
        </div>

        {/* Carrossel de Novidades */}
        <div className="pt-2">
            <InfoCarousel />
        </div>

        {/* Widget de Score */}
        <div 
          onClick={() => handleOpenModal('score')}
          className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
        >
             <div className="flex items-center gap-4">
                 <div className="h-12 w-12 relative">
                     {/* Mini Gauge visual simplificado */}
                     <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <path className="text-slate-200 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className={`${(profileData?.credit_score || 0) > 700 ? 'text-green-500' : (profileData?.credit_score || 0) > 400 ? 'text-yellow-500' : 'text-red-500'}`} strokeDasharray={`${(profileData?.credit_score || 0) / 10}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    </svg>
                 </div>
                 <div>
                     <p className="font-bold text-slate-800 dark:text-white">Meu Score</p>
                     <p className="text-xs text-slate-500 dark:text-slate-400">Veja o histórico da sua pontuação</p>
                 </div>
             </div>
             <div className="flex items-center gap-2">
                 <span className="font-bold text-lg text-slate-700 dark:text-slate-200">{profileData?.credit_score || 0}</span>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
             </div>
        </div>

      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        {modalView === 'score' && <ScoreHistoryView currentScore={profileData?.credit_score ?? 0} />}
        {modalView === 'limit' && profileData && <LimitInfoView profile={profileData} onClose={handleCloseModal} />}
      </Modal>
    </>
  );
};

export default PageInicio;