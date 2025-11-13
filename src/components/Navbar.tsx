import React from 'react';
import { Tab } from '../types';

interface NavbarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

// Ícones com traço mais fino para uma aparência moderna (strokeWidth={1.5})
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a.75.75 0 011.06 0l8.955 8.955M4.5 12.75l.75 8.25a.75.75 0 00.75.75h12a.75.75 0 00.75-.75l.75-8.25M9 21.75v-6.375a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v6.375" />
  </svg>
);
const DocumentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);
const StoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5A.75.75 0 0114.25 12h.75c.414 0 .75.336.75.75v7.5m0 0H18M15 21h.75m-1.5 0H12m3.75 0H15m-3.75 0H9.75m0 0H12m-3.75 0H6.375m0 0H12m0 0h.75m-1.5 0H12m3.75 0h.75m-1.5 0H15m2.25-4.5h.75m-1.5 0H15m1.5 0h.75M15 12h.75m-1.5 0H12m9-7.5h-1.5c0-.621-.504-1.125-1.125-1.125H15V2.25m0 3h-1.5m0 0h.75m-1.5 0H12m3 0h.75m-1.5 0H15m-3 0h.75M9 7.5H7.5m0 0H6m1.5 0H9m-3 0H3m3.75 0h.75m-1.5 0H6m3 0h.75M6 12h.75m-1.5 0H3m3.75 0h.75M3 15h.75m-1.5 0H3" />
  </svg>
);
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);


const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: Tab.INICIO, label: 'Início', icon: <HomeIcon /> },
    { id: Tab.FATURAS, label: 'Faturas', icon: <DocumentIcon /> },
    { id: Tab.LOJA, label: 'Loja', icon: <StoreIcon />, soon: true },
    { id: Tab.PERFIL, label: 'Perfil', icon: <UserIcon /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-700/80">
      <div className="flex justify-around max-w-md mx-auto px-2 py-2 gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-grow flex flex-col items-center justify-center h-14 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-offset-slate-900 ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl animate-fade-in" style={{ animationDuration: '0.3s' }}></span>
              )}

              {tab.soon && (
                   <span className="absolute top-1 right-1.5 text-[9px] bg-indigo-500 text-white font-semibold px-1 py-0.5 rounded-full z-10">
                  Em breve
                </span>
              )}
              <div className="w-6 h-6">{tab.icon}</div>
              <span className="text-xs mt-1 font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  );
};

export default Navbar;