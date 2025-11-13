import React, { useState, useEffect } from 'react';
import { getProfile } from '../services/profileService';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import CreditScoreGauge from './CreditScoreGauge';
import InfoCarousel from './InfoCarousel';
import Modal from './Modal';
import ScoreHistoryView from './ScoreHistoryView';
import LimitInfoView from './LimitInfoView';
import { Profile } from '../types';

const CreditCardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h5M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
);

const PageInicio: React.FC = () => {
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'score' | 'limit' | null>(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const profile = await getProfile(user.id);
          setProfileData({
            id: user.id,
            email: user.email,
            ...profile,
          });
        }
      } catch (error) {
        console.error("Erro ao buscar dados do perfil:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfileData();
  }, []);
  
  const handleOpenModal = (view: 'score' | 'limit') => {
    setModalView(view);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const renderModalContent = () => {
    if (!profileData) return null;
    switch (modalView) {
      case 'score':
        return <ScoreHistoryView currentScore={profileData.credit_score ?? 0} />;
      case 'limit':
        return <LimitInfoView profile={profileData} onClose={handleCloseModal} />;
      default:
        return null;
    }
  };


  return (
    <>
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Mensagem de boas-vindas */}
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            Olá, {profileData?.first_name || 'Cliente'}!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Confira suas informações e novidades.
          </p>
        </div>

        {/* Carrossel de Informações */}
        <InfoCarousel />

        {/* Cartão de Limite de Crédito */}
        <div 
          onClick={() => handleOpenModal('limit')}
          className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg dark:shadow-blue-500/10 p-6 border border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all duration-200"
          role="button"
          tabIndex={0}
          aria-label="Ver detalhes do limite de crédito"
        >
          {isLoading ? (
            <div className="h-24 flex justify-center items-center"><LoadingSpinner /></div>
          ) : (
            <div className="animate-fade-in-up">
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span className="font-medium">Limite de Crédito</span>
                <CreditCardIcon />
              </div>
              <p className="text-4xl font-bold text-slate-800 dark:text-white mt-2">
                {(profileData?.credit_limit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Disponível para compras parceladas na loja.
              </p>
            </div>
          )}
        </div>

        {/* Cartão de Score de Crédito */}
        <div 
          onClick={() => handleOpenModal('score')}
          className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg dark:shadow-blue-500/10 p-6 border border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all duration-200"
          role="button"
          tabIndex={0}
          aria-label="Ver detalhes e histórico do score"
        >
          {isLoading ? (
            <div className="h-40 flex justify-center items-center"><LoadingSpinner /></div>
          ) : (
            <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
                      <span className="font-medium">Seu Score</span>
                  </div>
                  <div className="flex justify-center">
                      <CreditScoreGauge score={profileData?.credit_score ?? 0} />
                  </div>
                  <p className="text-xs text-center text-slate-400 dark:text-slate-500 -mt-2">
                      Pague suas faturas em dia para aumentar seu score.
                  </p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        {renderModalContent()}
      </Modal>
    </>
  );
};

export default PageInicio;