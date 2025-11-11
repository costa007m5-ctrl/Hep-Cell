import React, { useState, useEffect } from 'react';
import { getProfile } from '../services/profileService';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';

const PageInicio: React.FC = () => {
  const [creditLimit, setCreditLimit] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCreditLimit = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const profile = await getProfile(user.id);
          setCreditLimit(profile?.credit_limit ?? 0);
        }
      } catch (error) {
        console.error("Erro ao buscar limite de crédito:", error);
        setCreditLimit(0); // Define 0 em caso de erro
      } finally {
        setIsLoading(false);
      }
    };
    fetchCreditLimit();
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
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Seu Limite Aprovado</p>
        {isLoading ? (
          <div className="mt-2"><LoadingSpinner /></div>
        ) : (
          <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
            {(creditLimit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Use seu limite para financiar compras em nossa loja.
        </p>
      </div>
    </div>
  );
};

export default PageInicio;