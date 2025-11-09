import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navbar from './components/Navbar';
import PageInicio from './components/PageInicio';
import PageFaturas from './components/PageFaturas';
import PageLoja from './components/PageLoja';
import PagePerfil from './components/PagePerfil';
import AuthPage from './components/AuthPage';
import { Tab } from './types';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import LoadingSpinner from './components/LoadingSpinner';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.INICIO);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
