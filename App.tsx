import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navbar from './components/Navbar';
import PageInicio from './components/PageInicio';
import PageFaturas from './components/PageFaturas';
import PageLoja from './components/PageLoja';
import PagePerfil from './components/PagePerfil';
import AuthPage from './components/AuthPage';
import { Tab } from './types';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import LoadingSpinner from './components/LoadingSpinner';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.INICIO);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);


  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-col min-h-screen font-sans items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="w-full max-w-lg text-center bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Erro de Configuração</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
                A conexão com o banco de dados não pôde ser estabelecida.
            </p>
            <div className="mt-6 text-left bg-slate-100 dark:bg-slate-700 p-4 rounded-lg">
                <p className="text-sm text-slate-700 dark:text-slate-200">
                    <strong>Causa:</strong> As variáveis de ambiente do Supabase (`SUPABASE_URL` e `SUPABASE_ANON_KEY`) não foram encontradas.
                </p>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                    <strong>Solução:</strong> Por favor, certifique-se de que estas variáveis estão corretamente configuradas nas configurações do seu projeto na Vercel.
                </p>
            </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case Tab.INICIO:
        return <PageInicio />;
      case Tab.FATURAS:
        return <PageFaturas />;
      case Tab.LOJA:
        return <PageLoja />;
      case Tab.PERFIL:
        return <PagePerfil session={session!} />;
      default:
        return <PageInicio />;
    }
  };
  
  if (loading) {
    return (
        <div className="flex flex-col min-h-screen font-sans items-center justify-center bg-slate-50 dark:bg-slate-900">
            <LoadingSpinner />
        </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <div className="flex flex-col min-h-screen font-sans text-slate-800 dark:text-slate-200">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4 pb-24">
        {renderContent()}
      </main>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default App;