import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-center space-x-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-9 w-9 text-indigo-500"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
            <path d="M14.25 4.842A3.858 3.858 0 0012 4a3.858 3.858 0 00-2.25.842 4.01 4.01 0 00-1.728 3.425c0 2.223 1.833 4.025 4.09 4.025s4.09-1.802 4.09-4.025a4.01 4.01 0 00-1.728-3.425zM12 10.42a2.122 2.122 0 01-2.17-2.058 2.05 2.05 0 01.89-1.63 2.03 2.03 0 012.56 0c.48.37.89.96.89 1.63a2.122 2.122 0 01-2.17 2.058zM19.14 14.33a.916.916 0 00-1.28.16l-3.06 4.31-.11.14a1.86 1.86 0 01-2.6-.14l-1-1.05-3.09-3.2a.885.885 0 00-1.28.12.923.923 0 00.12 1.28l3.09 3.2 1 1.05a3.69 3.69 0 005.18.28l.11-.14 3.06-4.31a.91.91 0 00-.14-1.28zM4.86 14.33a.916.916 0 011.28.16l3.06 4.31.11.14a1.86 1.86 0 002.6-.14l1-1.05 3.09-3.2a.885.885 0 011.28.12.923.923 0 01-.12 1.28l-3.09 3.2-1 1.05a3.69 3.69 0 01-5.18.28l-.11-.14-3.06-4.31a.91.91 0 01.14-1.28z" />
        </svg>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Relp Cell
        </h1>
      </div>
       <p className="text-center text-slate-600 dark:text-slate-400 mt-2">Pagamento de Faturas</p>
    </header>
  );
};

export default Header;