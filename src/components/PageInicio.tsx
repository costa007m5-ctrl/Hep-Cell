import React, { useState, useEffect } from 'react';
import { getProfile } from '../services/profileService';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import CreditScoreGauge from './CreditScoreGauge'; // Novo componente visual

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
        setProfileData({ name: null, limit: 0, score: 0 }); // Define 0 em caso de erro
      } finally {
        setIsLoading(false);
      }
    };
    fetchCreditData();
  }, []);

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Modern Welcome Card */}
      <div className="text-center p-6 animate-fade-in">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full flex items-center justify-center ring-8 ring-indigo-500/5 dark:ring-indigo-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-indigo-500 dark:text-indigo-400"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
          </div>
        </div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Olá, {profileData.name || 'Cliente'}!
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Bem-vindo(a) ao seu painel de pagamentos.
        </p>
      </div>

      {/* Modern Credit Card */}
      <div 
        className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg dark:shadow-blue-500/10 p-6 text-center animate-fade-in-up border border-slate-200 dark:border-slate-700" 
        style={{ animationDelay: '200ms' }}
      >
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Seu Crédito na Loja</h3>
        {isLoading ? (
          <div className="mt-4 flex justify-center h-32 items-center"><LoadingSpinner /></div>
        ) : (
          <>
            <CreditScoreGauge score={profileData.score ?? 0} />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 -mt-4">Limite por Parcela</p>
            <p className="text-4xl font-bold text-indigo-500 dark:text-indigo-400 mt-1">
              {(profileData.limit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
             <div className="mt-4 text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/50 py-2 px-3 rounded-full inline-block">
              Use seu limite para financiar compras em nossa loja.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PageInicio;