
import React from 'react';
import { Tab } from '../types';

interface NavbarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

interface IconProps {
  isActive: boolean;
}

// Ícones Modernos: Versão Outline (Inativo) e Solid (Ativo)

const HomeIcon: React.FC<IconProps> = ({ isActive }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isActive ? 0 : 1.5} className="w-6 h-6 transition-transform duration-300">
    {isActive ? (
       <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
    ) : (
       <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a.75.75 0 011.06 0l8.955 8.955M4.5 12.75l.75 8.25a.75.75 0 00.75.75h12a.75.75 0 00.75-.75l.75-8.25M9 21.75v-6.375a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v6.375" />
    )}
    {isActive && <path d="M12 5.432l8.159 8.159c.753.753.32 2.059-.738 2.059h-1.05v5.1a2.25 2.25 0 01-2.25 2.25h-8.25A2.25 2.25 0 015.625 20.85V15.65h-1.05c-1.058 0-1.491-1.306-.738-2.059L12 5.432z" />}
  </svg>
);

const DocumentIcon: React.FC<IconProps> = ({ isActive }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isActive ? 0 : 1.5} className="w-6 h-6 transition-transform duration-300">
    {isActive ? (
        <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" clipRule="evenodd" />
    ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    )}
     {isActive && <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />}
  </svg>
);

const StoreIcon: React.FC<IconProps> = ({ isActive }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isActive ? 0 : 1.5} className="w-6 h-6 transition-transform duration-300">
    {isActive ? (
        <path fillRule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 004.25 22.5h15.5a1.875 1.875 0 001.865-2.071l-1.263-12a1.875 1.875 0 00-1.865-1.679H16.5V6a4.5 4.5 0 10-9 0zM12 3a3 3 0 00-3 3v.75h6V6a3 3 0 00-3-3zm-3 8.25a3 3 0 106 0v-.75a.75.75 0 011.5 0v.75a4.5 4.5 0 11-9 0v-.75a.75.75 0 011.5 0v.75z" clipRule="evenodd" />
    ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    )}
  </svg>
);

const UserIcon: React.FC<IconProps> = ({ isActive }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isActive ? 0 : 1.5} className="w-6 h-6 transition-transform duration-300">
    {isActive ? (
         <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
    ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    )}
  </svg>
);


const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: Tab.INICIO, label: 'Início', icon: HomeIcon },
    { id: Tab.FATURAS, label: 'Faturas', icon: DocumentIcon },
    { id: Tab.LOJA, label: 'Loja', icon: StoreIcon }, // 'soon' removido
    { id: Tab.PERFIL, label: 'Perfil', icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 pb-safe transition-all duration-300">
      <div className="flex justify-around max-w-md mx-auto px-1 py-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const IconComponent = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group relative flex-grow flex flex-col items-center justify-center h-16 rounded-2xl transition-all duration-300 focus:outline-none ${
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active Indicator (Top Line Glow) - Optional, removed for cleaner iOS look, keeping just icon color */}
              
              <div className={`relative flex items-center justify-center transition-transform duration-300 ${isActive ? 'scale-110 -translate-y-1' : 'group-active:scale-95'}`}>
                 <IconComponent isActive={isActive} />
                 {/* Glow effect behind active icon */}
                 {isActive && (
                    <div className="absolute inset-0 bg-indigo-500/20 blur-lg rounded-full w-6 h-6 -z-10"></div>
                 )}
              </div>
              
              <span className={`text-[10px] mt-1 font-medium transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-80'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  );
};

export default Navbar;
