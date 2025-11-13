import React, { useState, useEffect } from 'react';
import { getProfile } from '../services/profileService';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import CreditScoreGauge from './CreditScoreGauge';
import InfoCarousel from './InfoCarousel'; // Novo carrossel de informações

const CreditCardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h5M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
);

const PageInicio: React.FC = () => {
  const [profileData, setProfileData] = useState<{
    name: string | null;
    limit: number | null;
    score: number | null;
  }>({ name: null, limit: null, score: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCreditData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const profile = await getProfile(user.id);
          setProfileData({
            name: profile?.first_name || null,
            limit: profile?.credit_limit ?? 0,
            score: profile?.credit_score ?? 0,
          });
        }
      } catch (error) {
        console.error("Erro ao buscar dados de crédito:", error);
        setProfileData({ name: null, limit: 0, score: 0 });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCreditData();
  }, []);

  return (
    <div className="w-full max-w-md space-y-6 animate-fade-in">
      {/* Mensagem de boas-vindas */}
      <div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Olá, {profileData.name || 'Cliente'}!
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Confira suas informações e novidades.
        </p>
      </div>

      {/* Carrossel de Informações */}
      <InfoCarousel />

      {/* Cartão de Limite de Crédito */}
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg dark:shadow-blue-500/10 p-6 border border-slate-200 dark:border-slate-700">
        {isLoading ? (
          <div className="h-24 flex justify-center items-center"><LoadingSpinner /></div>
        ) : (
          <div className="animate-fade-in-up">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span className="font-medium">Limite de Crédito</span>
              <CreditCardIcon />
            </div>
            <p className="text-4xl font-bold text-slate-800 dark:text-white mt-2">
              {(profileData.limit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              Disponível para compras parceladas na loja.
            </p>
          </div>
        )}
      </div>

      {/* Cartão de Score de Crédito */}
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg dark:shadow-blue-500/10 p-6 border border-slate-200 dark:border-slate-700">
        {isLoading ? (
          <div className="h-40 flex justify-center items-center"><LoadingSpinner /></div>
        ) : (
           <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
                    <span className="font-medium">Seu Score</span>
                </div>
                <div className="flex justify-center">
                     <CreditScoreGauge score={profileData.score ?? 0} />
                </div>
                <p className="text-xs text-center text-slate-400 dark:text-slate-500 -mt-2">
                    Pague suas faturas em dia para aumentar seu score.
                </p>
           </div>
        )}
      </div>
    </div>
  );
};

export default PageInicio;