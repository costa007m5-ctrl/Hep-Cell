import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/clients';
import { AppNotification, Tab } from '../types';
import Logo from './Logo';

interface HeaderProps {
  toggleTheme?: () => void;
  isDarkMode?: boolean;
  setActiveTab?: (tab: Tab) => void;
}

const Header: React.FC<HeaderProps> = ({ toggleTheme, isDarkMode, setActiveTab }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastNotificationIdRef = useRef<string | null>(null);

  // Solicita permissão para notificações do sistema ao carregar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const triggerSystemNotification = (notification: AppNotification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      // Usa o Service Worker se disponível para melhor integração mobile
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(notification.title, {
            body: notification.message,
            icon: 'https://placehold.co/192x192/4f46e5/ffffff.png?text=Relp',
            badge: 'https://placehold.co/96x96/4f46e5/ffffff.png?text=R',
            vibrate: [200, 100, 200],
            tag: notification.id,
            data: { url: '/' }
          } as any);
        });
      } else {
        // Fallback para API padrão
        new Notification(notification.title, {
          body: notification.message,
          icon: 'https://placehold.co/192x192/4f46e5/ffffff.png?text=Relp'
        });
      }
    }
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (data && data.length > 0) {
            setUnreadCount(data.filter(n => !n.read).length);

            // Verifica se a notificação mais recente é diferente da última vista e se não foi lida
            const latest = data[0];
            if (latest.id !== lastNotificationIdRef.current) {
                // Se não é a primeira carga (ref não é null) e não foi lida, notifica
                if (lastNotificationIdRef.current !== null && !latest.read) {
                    triggerSystemNotification(latest);
                }
                lastNotificationIdRef.current = latest.id;
            }
        } else {
            if (lastNotificationIdRef.current === null) {
                lastNotificationIdRef.current = '';
            }
        }
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Configurar intervalo para polling simples (30s)
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 py-3 px-4 sm:px-6 lg:px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50 transition-colors duration-300">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center">
          <Logo className="h-10 w-10" showText slogan />
        </div>

        <div className="flex items-center gap-3">
             <button 
                onClick={() => setActiveTab && setActiveTab(Tab.NOTIFICATIONS)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none relative"
                aria-label="Notificações"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-2 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
                )}
            </button>

            {toggleTheme && (
                <button 
                    onClick={toggleTheme}
                    className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none"
                    aria-label="Alternar tema"
                >
                    {isDarkMode ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    )}
                </button>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;