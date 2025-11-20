import React from 'react';

const SearchBar: React.FC = () => {
    return (
        <div className="relative group">
            <input
                type="search"
                placeholder="O que você procura?"
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none shadow-inner focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                </svg>
            </div>
        </div>
    );
};

export default SearchBar;