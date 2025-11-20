import React from 'react';

interface HeaderProps {
  toggleTheme?: () => void;
  isDarkMode?: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleTheme, isDarkMode }) => {
  return (
    <header className="sticky top-0 z-40 py-4 px-4 sm:px-6 lg:px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50 transition-colors duration-300">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
             <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path d="M14.25 4.842A3.858 3.858 0 0012 4a3.858 3.858 0 00-2.25.842 4.01 4.01 0 00-1.728 3.425c0 2.223 1.833 4.025 4.09 4.025s4.09-1.802 4.09-4.025a4.01 4.01 0 00-1.728-3.425zM12 10.42a2.122 2.122 0 01-2.17-2.058 2.05 2.05 0 01.89-1.63 2.03 2.03 0 012.56 0c.48.37.89.96.89 1.63a2.122 2.122 0 01-2.17 2.058zM19.14 14.33a.916.916 0 00-1.28.16l-3.06 4.31-.11.14a1.86 1.86 0 01-2.6-.14l-1-1.05-3.09-3.2a.885.885 0 00-1.28.12.923.923 0 00.12 1.28l3.09 3.2 1 1.05a3.69 3.69 0 005.18.28l.11-.14 3.06-4.31a.91.91 0 00-.14-1.28zM4.86 14.33a.916.916 0 011.28.16l3.06 4.31.11.14a1.86 1.86 0 002.6-.14l1-1.05 3.09-3.2a.885.885 0 011.28.12.923.923 0 01-.12 1.28l-3.09 3.2-1 1.05a3.69 3.69 0 01-5.18.28l-.11-.14-3.06-4.31a.91.91 0 01.14-1.28z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                Relp Cell
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sua loja, seu crédito</p>
          </div>
        </div>

        {toggleTheme && (
            <button 
                onClick={toggleTheme}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    </header>
  );
};

export default Header;