
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navbar from './components/Navbar';
import PageInicio from './components/PageInicio';
import PageFaturas from './components/PageFaturas';
import PageLoja from './components/PageLoja';
import PagePerfil from './components/PagePerfil';
import PageNotifications from './components/PageNotifications';
import AuthPage from './components/AuthPage';
import AdminLoginPage from './components/AdminLoginPage';
import AdminDashboard from './components/AdminDashboard';
import ResetPasswordPage from './components/ResetPasswordPage'; 
import SplashScreen from './components/SplashScreen';
import { Tab } from './types';
import { supabase } from './services/clients';
import { Session } from '@supabase/supabase-js';
import LoadingSpinner from './components/LoadingSpinner';
import { ToastProvider, useToast } from './components/Toast';
import SupportChat from './components/SupportChat';

const MERCADO_PAGO_PUBLIC_KEY = "TEST-c1f09c65-832f-45a8-9860-5a3b9846b532";

type View = 'customer' | 'adminLogin' | 'adminDashboard';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.INICIO);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>('customer');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const { addToast } = useToast();

  // O ID que define quem é o administrador supremo
  const ADMIN_ID = '1da77e27-f1df-4e35-bcec-51dc2c5a9062';

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('payment_status');
    
    if (status) {
        if (status === 'approved' || status === 'success') {
            addToast('Pagamento concluído com sucesso!', 'success');
        } else if (status === 'failure' || status === 'rejected') {
            addToast('O pagamento falhou. Tente novamente.', 'error');
        }
        setActiveTab(Tab.FATURAS);
        window.history.replaceState(null, '', window.location.pathname);
    }
  }, [addToast]);

  useEffect(() => {
    // Se o sinalizador de Admin estiver ativo, pula para a dashboard
    if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
      setView('adminDashboard');
      setAuthLoading(false);
      return;
    }

    const fetchSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(data.session);
      } catch (error) {
        console.warn("Erro ao recuperar sessão:", error);
        setSession(null);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
       if (event === 'SIGNED_OUT') {
         setSession(null);
         setView('customer');
         sessionStorage.removeItem('isAdminLoggedIn');
       } else {
         // Mantém a view atual se o admin logar
         if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
            setSession(session);
         }
       }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAdminLogout = async () => {
    sessionStorage.removeItem('isAdminLoggedIn');
    await supabase.auth.signOut();
    setView('customer');
    window.location.href = '/'; // Reinicia o app
  };

  if (window.location.pathname === '/reset-password') return <ResetPasswordPage />;
  if (showSplash) return <SplashScreen onFinish={() => setShowSplash(false)} />;

  // LOGICA DE ROTEAMENTO DE AMBIENTES
  if (view === 'adminLogin') {
      return <AdminLoginPage onLoginSuccess={() => setView('adminDashboard')} onBackToCustomer={() => setView('customer')} />;
  }

  if (view === 'adminDashboard') {
      return <AdminDashboard onLogout={handleAdminLogout} />;
  }

  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900"><LoadingSpinner /></div>;

  if (!session) return <AuthPage onAdminLoginClick={() => setView('adminLogin')} />;

  const renderContent = () => {
    switch (activeTab) {
      case Tab.INICIO: return <PageInicio setActiveTab={setActiveTab} />;
      case Tab.FATURAS: return <PageFaturas mpPublicKey={MERCADO_PAGO_PUBLIC_KEY} />;
      case Tab.LOJA: return <PageLoja />;
      case Tab.PERFIL: return <PagePerfil session={session} toggleTheme={toggleTheme} isDarkMode={isDarkMode} onGoToAdmin={() => setView('adminLogin')} />;
      case Tab.NOTIFICATIONS: return <PageNotifications onBack={() => setActiveTab(Tab.INICIO)} />;
      default: return <PageInicio setActiveTab={setActiveTab} />;
    }
  };

  const showHeader = activeTab !== Tab.LOJA && activeTab !== Tab.NOTIFICATIONS;

  return (
    <div className="flex flex-col min-h-screen font-sans text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 transition-colors duration-300 animate-fade-in">
      {showHeader && <Header toggleTheme={toggleTheme} isDarkMode={isDarkMode} setActiveTab={setActiveTab} />}
      
      <main className={activeTab === Tab.LOJA ? "flex-grow w-full pb-20" : "flex-grow flex items-center justify-center p-4 pb-24"}>
        {renderContent()}
      </main>
      
      <SupportChat />
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;
