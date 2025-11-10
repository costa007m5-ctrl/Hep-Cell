import React from 'react';

const PageLoja: React.FC = () => {
  return (
    <div className="w-full max-w-md text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg animate-fade-in">
        <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
            </div>
        </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Loja em Breve!
      </h2>
      <p className="text-slate-500 dark:text-slate-400">
        Estamos preparando uma loja incrível com os melhores produtos e serviços para você.
      </p>
    </div>
  );
};

export default PageLoja;
