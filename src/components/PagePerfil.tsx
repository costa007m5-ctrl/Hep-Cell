import React, { useState, useEffect, useCallback } from 'react';
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

const PagePerfil: React.FC<PagePerfilProps> = ({ session }) => {
  const [activeView, setActiveView] = useState<'main' | 'data'>('main');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userProfile = await getProfile(session.user.id);
      setProfile({
          id: session.user.id,
          email: session.user.email,
          ...userProfile
      });
    } catch (err: any) {
      setError('Não foi possível carregar seus dados.');
    } finally {
      setIsLoading(false);
    }
  }, [session.user.id, session.user.email]);

  useEffect(() => {
    if (activeView === 'data') {
      fetchUserProfile();
    }
  }, [activeView, fetchUserProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  
  const renderProfileDataView = () => {
    if (isLoading) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
    if (error) return <Alert message={error} type="error" />;

    return (
        <form onSubmit={handleSaveProfile} className="space-y-4 animate-fade-in">
             <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Meus Dados</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Mantenha seus dados atualizados para agilizar seus pagamentos.
                </p>
             </div>
             {successMessage && <Alert message={successMessage} type="success" />}
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Nome" name="first_name" value={profile?.first_name || ''} onChange={handleInputChange} required />
                <InputField label="Sobrenome" name="last_name" value={profile?.last_name || ''} onChange={handleInputChange} required />
            </div>
             <InputField label="CPF" name="identification_number" value={profile?.identification_number || ''} onChange={handleInputChange} required placeholder="000.000.000-00" maxLength={14}/>
            
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-200 dark:border-slate-700">Endereço</h3>
            <InputField label="CEP" name="zip_code" value={profile?.zip_code || ''} onChange={handleInputChange} required placeholder="00000-000" maxLength={9} />
            <InputField label="Rua / Avenida" name="street_name" value={profile?.street_name || ''} onChange={handleInputChange} required />
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1"><InputField label="Número" name="street_number" value={profile?.street_number || ''} onChange={handleInputChange} required /></div>
                <div className="col-span-2"><InputField label="Bairro" name="neighborhood" value={profile?.neighborhood || ''} onChange={handleInputChange} required /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Cidade" name="city" value={profile?.city || ''} onChange={handleInputChange} required />
                <InputField label="Estado (UF)" name="federal_unit" value={profile?.federal_unit || ''} onChange={handleInputChange} required maxLength={2} placeholder="SP" />
            </div>

            <div className="flex flex-col sm:flex-row-reverse gap-3 pt-4">
                <button type="submit" disabled={isSaving} className="w-full sm:w-auto flex justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                    {isSaving ? <LoadingSpinner /> : 'Salvar Dados'}
                </button>
                <button type="button" onClick={() => setActiveView('main')} className="w-full sm:w-auto flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                    Voltar
                </button>
            </div>
        </form>
    );
  };

  const renderMainView = () => (
    <div className="flex flex-col items-center text-center animate-fade-in">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
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
        {activeView === 'main' ? renderMainView() : renderProfileDataView()}
    </div>
  );
};

export default PagePerfil;