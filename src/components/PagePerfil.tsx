import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import { Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';

interface PagePerfilProps {
    session: Session;
}

interface NotificationPrefs {
    notify_due_date: boolean;
    notify_new_invoice: boolean;
    notify_promotions: boolean;
}

// Componente de toggle switch reutilizável
const ToggleSwitch: React.FC<{ label: string; description: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; name: string; }> = ({ label, description, checked, onChange, name }) => (
  <div className="flex items-center justify-between py-3">
    <div className="pr-4">
      <p className="font-medium text-slate-800 dark:text-slate-200">{label}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} name={name} className="sr-only peer" />
      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/50 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
    </label>
  </div>
);


const PagePerfil: React.FC<PagePerfilProps> = ({ session }) => {
  const [activeView, setActiveView] = useState<'main' | 'data' | 'notifications'>('main');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
      notify_due_date: true,
      notify_new_invoice: true,
      notify_promotions: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detecta evento de instalar PWA
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const fetchUserProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userProfile = await getProfile(session.user.id);
      const fullProfile = {
          id: session.user.id,
          email: session.user.email,
          ...userProfile
      };
      setProfile(fullProfile);
      // Define as preferências de notificação com base no perfil, com fallback para true
      setNotificationPrefs({
          notify_due_date: userProfile?.notify_due_date ?? true,
          notify_new_invoice: userProfile?.notify_new_invoice ?? true,
          notify_promotions: userProfile?.notify_promotions ?? true,
      });
    } catch (err: any) {
      setError('Não foi possível carregar seus dados.');
    } finally {
      setIsLoading(false);
    }
  }, [session.user.id, session.user.email]);

  useEffect(() => {
    // Carrega o perfil completo na primeira vez
    if (activeView !== 'main' || !profile) {
      fetchUserProfile();
    }
  }, [activeView, fetchUserProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      let { name, value } = e.target;
      if (name === 'zip_code') {
          value = value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
      } else if (name === 'identification_number') {
          value = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
      }
      setProfile(prev => prev ? { ...prev, [name]: value } : null);
  };
  
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
        await updateProfile(profile);
        setSuccessMessage('Seus dados foram salvos com sucesso!');
    } catch (err: any) {
        setError('Ocorreu um erro ao salvar seus dados.');
    } finally {
        setIsSaving(false);
        setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleNotificationChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = e.target;
      
      // Se o usuário estiver ativando, solicitamos permissão do navegador
      if (checked && 'Notification' in window && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
             alert('Você precisa permitir notificações no navegador para ativar esta função.');
             return; // Não muda o estado
        }
      }

      setNotificationPrefs(prev => ({ ...prev, [name]: checked }));
  };

  const handleSaveNotifications = async () => {
      if (!profile) return;
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
      try {
          await updateProfile({ id: profile.id, ...notificationPrefs });
          setSuccessMessage('Preferências salvas com sucesso!');
      } catch (err: any) {
          setError('Erro ao salvar suas preferências.');
      } finally {
          setIsSaving(false);
          setTimeout(() => setSuccessMessage(null), 3000);
      }
  };

  const handleAvatarClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !profile) return;

      // Valida tamanho (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
          alert("A imagem deve ter no máximo 2MB.");
          return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64String = reader.result as string;
          
          // Atualiza estado local para feedback imediato
          setProfile(prev => prev ? { ...prev, avatar_url: base64String } : null);
          
          // Salva no banco
          try {
              await updateProfile({ ...profile, avatar_url: base64String });
          } catch (error) {
              console.error("Erro ao salvar avatar:", error);
              alert("Erro ao salvar foto de perfil.");
          }
      };
      reader.readAsDataURL(file);
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  
  const renderProfileDataView = () => {
    if (isLoading) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
    
    return (
        <form onSubmit={handleSaveProfile} className="space-y-4 animate-fade-in text-left">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-6">Meus Dados</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Nome" name="first_name" value={profile?.first_name || ''} onChange={handleInputChange} />
                <InputField label="Sobrenome" name="last_name" value={profile?.last_name || ''} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de Documento</label>
                    <select name="identification_type" value={profile?.identification_type || 'CPF'} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="CPF">CPF</option>
                    </select>
                </div>
                <InputField label="Número do Documento" name="identification_number" value={profile?.identification_number || ''} onChange={handleInputChange} placeholder="000.000.000-00" maxLength={14} />
            </div>
            <InputField label="CEP" name="zip_code" value={profile?.zip_code || ''} onChange={handleInputChange} placeholder="00000-000" maxLength={9} />
            <InputField label="Rua / Avenida" name="street_name" value={profile?.street_name || ''} onChange={handleInputChange} />
            <div className="grid grid-cols-3 gap-4">
                <InputField label="Número" name="street_number" value={profile?.street_number || ''} onChange={handleInputChange} />
                <div className="col-span-2">
                    <InputField label="Bairro" name="neighborhood" value={profile?.neighborhood || ''} onChange={handleInputChange} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <InputField label="Cidade" name="city" value={profile?.city || ''} onChange={handleInputChange} />
                <InputField label="UF" name="federal_unit" value={profile?.federal_unit || ''} onChange={handleInputChange} maxLength={2} />
            </div>

            {error && <Alert message={error} type="error" />}
            {successMessage && <Alert message={successMessage} type="success" />}

            <div className="flex flex-col sm:flex-row-reverse gap-3 pt-4">
                <button type="submit" disabled={isSaving} className="w-full sm:w-auto flex justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                    {isSaving ? <LoadingSpinner /> : 'Salvar Alterações'}
                </button>
                <button type="button" onClick={() => setActiveView('main')} className="w-full sm:w-auto flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                    Voltar
                </button>
            </div>
        </form>
    );
  };
  
  const renderNotificationsView = () => {
      if (isLoading) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
      if (error) return <Alert message={error} type="error" />;

      return (
        <div className="space-y-4 animate-fade-in">
             <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Notificações</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Gerencie como você recebe atualizações sobre suas faturas e novidades.
                </p>
             </div>
             {successMessage && <Alert message={successMessage} type="success" />}
             
             <div className="divide-y divide-slate-200 dark:divide-slate-700">
                 <ToggleSwitch 
                    label="Lembrete de Vencimento"
                    description="Receba um aviso antes da fatura vencer."
                    checked={notificationPrefs.notify_due_date}
                    onChange={handleNotificationChange}
                    name="notify_due_date"
                 />
                  <ToggleSwitch 
                    label="Nova Fatura"
                    description="Seja notificado ao gerar uma nova fatura."
                    checked={notificationPrefs.notify_new_invoice}
                    onChange={handleNotificationChange}
                    name="notify_new_invoice"
                 />
                  <ToggleSwitch 
                    label="Promoções e Ofertas"
                    description="Novidades exclusivas da loja."
                    checked={notificationPrefs.notify_promotions}
                    onChange={handleNotificationChange}
                    name="notify_promotions"
                 />
             </div>

            <div className="flex flex-col sm:flex-row-reverse gap-3 pt-4">
                <button type="button" onClick={handleSaveNotifications} disabled={isSaving} className="w-full sm:w-auto flex justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                    {isSaving ? <LoadingSpinner /> : 'Salvar Preferências'}
                </button>
                <button type="button" onClick={() => setActiveView('main')} className="w-full sm:w-auto flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                    Voltar
                </button>
            </div>
        </div>
      );
  };


  const renderMainView = () => (
    <div className="flex flex-col items-center text-center animate-fade-in">
        <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 overflow-hidden ring-4 ring-white dark:ring-slate-800 shadow-lg">
                 {profile?.avatar_url ? (
                     <img src={profile.avatar_url} alt="Perfil" className="w-full h-full object-cover" />
                 ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                 )}
            </div>
            <div className="absolute bottom-4 right-0 bg-indigo-600 text-white p-1.5 rounded-full shadow-md hover:bg-indigo-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange}
            />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Seu Perfil</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 break-all">{session.user.email}</p>
        
         <div className="w-full space-y-3 mt-8">
            <button
                onClick={() => setActiveView('data')}
                className="w-full flex justify-center items-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h4a2 2 0 012 2v1m-6.121 2.879a3 3 0 00-4.242 0 3 3 0 004.242 0zM19.121 15.121a3 3 0 00-4.242 0 3 3 0 004.242 0z" />
                </svg>
                Meus Dados
            </button>
             <button
                onClick={() => setActiveView('notifications')}
                className="w-full flex justify-center items-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Notificações
            </button>
            
            {installPrompt && (
                <button
                    onClick={handleInstallClick}
                    className="w-full flex justify-center items-center py-3 px-4 border border-indigo-200 dark:border-indigo-800 rounded-md shadow-sm text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Instalar Aplicativo
                </button>
            )}

            <button
                onClick={handleLogout}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
            </button>
        </div>
   </div>
  );

  return (
    <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
        {activeView === 'main' && renderMainView()}
        {activeView === 'data' && renderProfileDataView()}
        {activeView === 'notifications' && renderNotificationsView()}
    </div>
  );
};

export default PagePerfil;