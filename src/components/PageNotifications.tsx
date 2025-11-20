
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/clients';
import { AppNotification } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface PageNotificationsProps {
    onBack: () => void;
}

const PageNotifications: React.FC<PageNotificationsProps> = ({ onBack }) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(50);
                setNotifications(data || []);
            }
        } catch (error) {
            console.error("Erro ao buscar notificações:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleMarkAsRead = async (id: string) => {
        try {
            // Atualiza localmente para feedback instantâneo
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            await supabase.from('notifications').update({ read: true }).eq('id', id);
        } catch (error) {
            console.error("Failed to mark as read", error);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('Deseja marcar todas como lidas?')) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success':
                return <div className="p-3 bg-green-100 text-green-600 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>;
            case 'warning':
                return <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>;
            case 'alert':
                return <div className="p-3 bg-red-100 text-red-600 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>;
            default:
                return <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>;
        }
    };

    return (
        <div className="w-full max-w-lg space-y-4 animate-fade-in pb-6 px-2">
            {/* Header da Página */}
            <div className="flex items-center justify-between pt-4 mb-6">
                <button onClick={onBack} className="flex items-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-2 -ml-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="font-bold text-lg">Voltar</span>
                </button>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white absolute left-1/2 -translate-x-1/2">Notificações</h2>
                {notifications.some(n => !n.read) && (
                    <button onClick={handleClearAll} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-1 rounded-full transition-colors">
                        Ler todas
                    </button>
                )}
            </div>

            {/* Lista */}
            {isLoading ? (
                <div className="flex justify-center py-20"><LoadingSpinner /></div>
            ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                    <p className="text-xl font-bold text-slate-700 dark:text-slate-200">Tudo limpo!</p>
                    <p className="mt-2 text-sm">Você não tem novas notificações no momento.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notif) => (
                        <div 
                            key={notif.id} 
                            onClick={() => !notif.read && handleMarkAsRead(notif.id)}
                            className={`relative flex gap-4 p-5 rounded-2xl transition-all active:scale-[0.98] cursor-pointer ${
                                notif.read 
                                ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 opacity-75' 
                                : 'bg-white dark:bg-slate-800 border-l-4 border-l-indigo-500 shadow-md shadow-indigo-500/10'
                            }`}
                        >
                            {!notif.read && (
                                <span className="absolute top-5 right-5 w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></span>
                            )}
                            
                            <div className="flex-shrink-0">
                                {getIcon(notif.type)}
                            </div>
                            
                            <div className="flex-1 pr-4">
                                <h3 className={`text-base font-bold mb-1 ${notif.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                                    {notif.title}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                                    {notif.message}
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                    {new Date(notif.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PageNotifications;
