import React, { useState, useEffect } from 'react';
import { supabase } from '../services/clients';
import { AppNotification } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface NotificationCenterProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: AppNotification[];
    refreshNotifications: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose, notifications, refreshNotifications }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleMarkAsRead = async (id: string) => {
        // Otimistic update can be added here for better UX
        try {
            await supabase.from('notifications').update({ read: true }).eq('id', id);
            refreshNotifications();
        } catch (error) {
            console.error("Failed to mark as read", error);
        }
    };

    const handleClearAll = async () => {
        setIsLoading(true);
        try {
            // Only mark visible unread as read, or delete older ones? 
            // For now, let's just mark all unread as read for the user
            const { data: { user } } = await supabase.auth.getUser();
            if(user) {
                await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
                refreshNotifications();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-up">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Notificações
                        <span className="text-xs font-normal bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                            {notifications.filter(n => !n.read).length} novas
                        </span>
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {notifications.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            <p>Nenhuma notificação no momento.</p>
                        </div>
                    ) : (
                        notifications.map(notif => (
                            <div 
                                key={notif.id} 
                                onClick={() => !notif.read && handleMarkAsRead(notif.id)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                    notif.read 
                                    ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 opacity-70' 
                                    : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 shadow-sm'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={`font-bold text-sm ${notif.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>{notif.title}</h3>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                        {new Date(notif.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{notif.message}</p>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-safe">
                        <button 
                            onClick={handleClearAll}
                            disabled={isLoading}
                            className="w-full py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            {isLoading ? <LoadingSpinner /> : 'Marcar todas como lidas'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationCenter;