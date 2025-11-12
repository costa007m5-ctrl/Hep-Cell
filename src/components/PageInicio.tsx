import React, { useState, useEffect } from 'react';
import { getProfile } from '../services/profileService';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import CreditScoreGauge from './CreditScoreGauge'; // Novo componente visual

const PageInicio: React.FC = () => {
  const [profileData, setProfileData] = useState<{ limit: number | null, score: number | null }>({ limit: null, score: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCreditData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const profile = await getProfile(user.id);
          setProfileData({
            limit: profile?.credit_limit ?? 0,
            score: profile?.credit_score ?? 0,
          });
        }
      } catch (error) {
        console.error("Erro ao buscar dados de crédito:", error);
        setProfileData({ limit: 0, score: 0 }); // Define 0 em caso de erro
      } finally {
        setIsLoading(false);
      }
    };
    fetchCreditData();
  }, []);

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg animate-fade-in">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Bem-vindo à Relp Cell
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Use o menu abaixo para pagar faturas, explorar nossos produtos ou gerenciar seu perfil.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 text-center animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Seu Crédito na Loja</h3>
        {isLoading ? (
          <div className="mt-4 flex justify-center"><LoadingSpinner /></div>
        ) : (
          <>
            <CreditScoreGauge score={profileData.score ?? 0} />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 -mt-4">Limite por Parcela</p>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {(profileData.limit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
             <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              Use seu limite para financiar compras em nossa loja.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default PageInicio;