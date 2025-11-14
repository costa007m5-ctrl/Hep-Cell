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
import { supabase } from './services/clients';
import { Session } from '@supabase/supabase-js';
import LoadingSpinner from './components/LoadingSpinner';
import Alert from './components/Alert';

// A chave pública do Mercado Pago pode ser exposta com segurança no frontend.
const MERCADO_PAGO_PUBLIC_KEY = "TEST-c1f09c65-832f-45a8-9860-5a3b9846b532";

type View = 'customer' | 'adminLogin' | 'adminDashboard';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.INICIO);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>('customer');
  const [isAdmin, setIsAdmin] = useState(false);
  const [paymentNotification, setPaymentNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Efeito para verificar o status do pagamento no retorno de um redirecionamento
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('payment_status');
    
    if (status) {
        if (status === 'approved' || status === 'success') {
            setPaymentNotification({ message: 'Pagamento concluído com sucesso!', type: 'success' });
        } else if (status === 'failure' || status === 'rejected') {
            setPaymentNotification({ message: 'O pagamento falhou. Por favor, tente novamente.', type: 'error' });
        }
        
        setActiveTab(Tab.FATURAS);
        window.history.replaceState(null, '', window.location.pathname); // Limpa a URL

        setTimeout(() => setPaymentNotification(null), 6000);
    }
  }, []);

  // Efeito para verificar sessão de admin ou buscar a do cliente
  useEffect(() => {
    if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
      setView('adminDashboard');
      setIsAdmin(true); // Garante que o estado é consistente
      setAuthLoading(false);
      return;
    }

    setAuthLoading(true);
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setAuthLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Se já somos admin, não mude a sessão
      if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAdminLoginSuccess = () => {
    sessionStorage.setItem('isAdminLoggedIn', 'true');
    setView('adminDashboard');
    setIsAdmin(true);
  };

  const handleAdminLogout = async () => {
    sessionStorage.removeItem('isAdminLoggedIn');
    setIsAdmin(false);
    await supabase.auth.signOut(); // Também desloga do Supabase
    setView('customer');
    window.location.reload();
  };
  
  const handleBackToCustomer = () => {
    setView('customer');
  }

  // Renderiza a área de Admin
  if (view === 'adminLogin') {
    return <AdminLoginPage 
      onLoginSuccess={handleAdminLoginSuccess} 
      onBackToCustomer={handleBackToCustomer}
    />;
  }

  if (view === 'adminDashboard') {
    return <AdminDashboard onLogout={handleAdminLogout} />;
  }

  // --- Renderização da área do cliente ---

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen font-sans items-center justify-center bg-slate-50 dark:bg-slate-900">
        <LoadingSpinner />
        <p className="mt-4 text-slate-500 dark:text-slate-400">
            Verificando acesso...
        </p>
      </div>
    );
  }

  if (!session) {
    return <AuthPage onAdminLoginClick={() => setView('adminLogin')} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case Tab.INICIO:
        return <PageInicio />;
      case Tab.FATURAS:
        return <PageFaturas mpPublicKey={MERCADO_PAGO_PUBLIC_KEY} />;
      case Tab.LOJA:
        return <PageLoja />;
      case Tab.PERFIL:
        return <PagePerfil session={session} />;
      default:
        return <PageInicio />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-gradient-to-b dark:from-slate-900 dark:to-black">
      <Header />
       {paymentNotification && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-md p-4 z-50 animate-fade-in-up">
              <Alert message={paymentNotification.message} type={paymentNotification.type} />
          </div>
      )}
      <main className="flex-grow flex items-center justify-center p-4 pb-24">
        {renderContent()}
      </main>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default App;
