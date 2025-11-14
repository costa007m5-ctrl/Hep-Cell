import React from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/clients';
import SystemDiagnostics from './SystemDiagnostics';

interface PagePerfilProps {
    session: Session;
}

const PagePerfil: React.FC<PagePerfilProps> = ({ session }) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg animate-fade-in">
       <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Seu Perfil
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 break-all">
                {session.user.email}
            </p>

            {/* System Diagnostics */}
            <SystemDiagnostics />

            <button
                onClick={handleLogout}
                className="mt-6 w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 transition-colors duration-200"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
            </button>
       </div>
    </div>
  );
};

export default PagePerfil;