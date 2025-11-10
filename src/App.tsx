// Removed /// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navbar from './components/Navbar';
import PageInicio from './components/PageInicio';
import PageFaturas from './components/PageFaturas';
import PageLoja from './components/PageLoja';
import PagePerfil from './components/PagePerfil';
import AuthPage from './components/AuthPage';
import AdminLoginPage from './components/AdminLoginPage';
import AdminDashboard from './components/AdminDashboard';
import { Tab } from './types';
import { initializeClients, supabase } from './services/clients';
import { Session } from '@supabase/supabase-js';
import LoadingSpinner from './components/LoadingSpinner';

type AppStatus = 'configuring' | 'ready' | 'error';
type View = 'customer' | 'adminLogin' | 'adminDashboard';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.INICIO);
  const [session, setSession] = useState<Session | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>('configuring');
  const [mercadoPagoPublicKey, setMercadoPagoPublicKey] = useState<string | null>(null);
  const [view, setView] = useState<View>('customer');
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      try {
        const config = await initializeClients();
        setMercadoPagoPublicKey(config.mercadoPagoPublicKey);

        if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
          setView('adminDashboard');
          setIsAdmin(true);
          setAppStatus('ready');
          setAuthLoading(false);
          return;
        }

        // Supabase client is now initialized. Proceed with auth.
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setAuthLoading(false);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
            setSession(session);
          }
        });

        setAppStatus('ready');

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error("Falha ao inicializar o aplicativo:", error);
        setAppStatus('error');
      }
    };

    initApp();
  }, []);

  const handleAdminLoginSuccess = () => {
    sessionStorage.setItem('isAdminLoggedIn', 'true');
    setView('adminDashboard');
    setIsAdmin(true);
  };

  const handleAdminLogout = async () => {
    sessionStorage.removeItem('isAdminLoggedIn');
    setIsAdmin(false);
    if (supabase) {
        await supabase.auth.signOut();
    }
    setView('customer');
    window.location.reload();
  };

  const handleBackToCustomer = () => {
    setView('customer');
  }

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
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Erro de Configuração</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
                Não foi possível carregar as configurações do servidor. Verifique sua conexão com a internet e se as variáveis de ambiente no seu ambiente de hospedagem (Vercel) estão configuradas corretamente.
            </p>
        </div>
      </div>
    );
  }

  if (view === 'adminLogin') {
    return <AdminLoginPage 
      onLoginSuccess={handleAdminLoginSuccess} 
      onBackToCustomer={handleBackToCustomer}
    />;
  }

  if (view === 'adminDashboard') {
    return <AdminDashboard onLogout={handleAdminLogout} />;
  }

  if (!session && !isAdmin) {
    return <AuthPage onAdminLoginClick={() => setView('adminLogin')} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case Tab.INICIO:
        return <PageInicio />;
      case Tab.FATURAS:
        return <PageFaturas mpPublicKey={mercadoPagoPublicKey!} />;
      case Tab.LOJA:
        return <PageLoja />;
      case Tab.PERFIL:
        return <PagePerfil session={session!} />;
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