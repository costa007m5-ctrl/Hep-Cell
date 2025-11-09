import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navbar from './components/Navbar';
import PageInicio from './components/PageInicio';
import PageFaturas from './components/PageFaturas';
import PageLoja from './components/PageLoja';
import PagePerfil from './components/PagePerfil';
import AuthPage from './components/AuthPage';
import { Tab } from './types';
import { supabase, initializeClients } from './services/clients';
import { Session } from '@supabase/supabase-js';
import LoadingSpinner from './components/LoadingSpinner';

type AppStatus = 'configuring' | 'ready' | 'error';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.INICIO);
  const [session, setSession] = useState<Session | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>('configuring');
  const [mercadoPagoPublicKey, setMercadoPagoPublicKey] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Efeito para inicializar os clientes na montagem do componente
  useEffect(() => {
    const initApp = async () => {
      try {
        const config = await initializeClients();
        setMercadoPagoPublicKey(config.mercadoPagoPublicKey);
        setAppStatus('ready');
      } catch (error) {
        console.error("Falha ao inicializar a configuração do aplicativo:", error);
        setAppStatus('error');
      }
    };

    initApp();
  }, []);

  // Efeito para buscar a sessão de autenticação assim que os clientes estiverem prontos
  useEffect(() => {
    if (appStatus === 'ready') {
      setAuthLoading(true);
      const fetchSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setAuthLoading(false);
      };

      fetchSession();

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });

      return () => subscription.unsubscribe();
    }
  }, [appStatus]);

  // Renderiza telas de carregamento ou erro com base no status do aplicativo
  if (appStatus === 'configuring' || (appStatus === 'ready' && authLoading)) {
    return (
      <div className="flex flex-col min-h-screen font-sans items-center justify-center bg-slate-50 dark:bg-slate-900">
        <LoadingSpinner />
        <p className="mt-4 text-slate-500 dark:text-slate-400">
            {appStatus === 'configuring' ? 'Configurando conexão...' : 'Verificando acesso...'}
        </p>
      </div>
    );
  }

  if (appStatus === 'error') {
    return (
      <div className="flex flex-col min-h-screen font-sans items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="w-full max-w-lg text-center bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Erro de Conexão</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
                Não foi possível carregar a configuração do servidor. Verifique sua conexão com a internet ou contate o suporte.
            </p>
        </div>
      </div>
    );
  }

  // Renderiza a página de login se não houver sessão
  if (!session) {
    return <AuthPage />;
  }

  // Renderiza o conteúdo principal do aplicativo
  const renderContent = () => {
    switch (activeTab) {
      case Tab.INICIO:
        return <PageInicio />;
      case Tab.FATURAS:
        return <PageFaturas mpPublicKey={mercadoPagoPublicKey!} />;
      case Tab.LOJA:
        return <PageLoja />;
      case Tab.PERFIL:
        return <PagePerfil session={session} />;
      default:
        return <PageInicio />;
    }
  };

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