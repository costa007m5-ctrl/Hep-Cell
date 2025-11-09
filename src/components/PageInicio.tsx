import React from 'react';

const PageInicio: React.FC = () => {
  return (
    <div className="w-full max-w-md text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
         <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            </div>
        </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Bem-vindo à Relp Cell
      </h2>
      <p className="text-slate-500 dark:text-slate-400">
        Use o menu abaixo para pagar faturas, explorar nossos produtos ou gerenciar seu perfil.
      </p>
    </div>
  );
};

export default PageInicio;