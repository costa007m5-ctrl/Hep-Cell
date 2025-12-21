
import React from 'react';

const categories = [
    { name: 'Celulares', icon: '📱', color: 'from-blue-500 to-indigo-600' },
    { name: 'Acessórios', icon: '⚡', color: 'from-purple-500 to-violet-600' },
    { name: 'Fones', icon: '🎧', color: 'from-pink-500 to-rose-600' },
    { name: 'Smartwatch', icon: '⌚', color: 'from-emerald-500 to-teal-600' },
    { name: 'Ofertas', icon: '🔥', color: 'from-orange-500 to-red-600' },
];

interface CategoryIconsProps {
    activeCategory: string;
    onSelect: (category: string) => void;
}

const CategoryIcons: React.FC<CategoryIconsProps> = ({ activeCategory, onSelect }) => {
    return (
        <section className="py-6 overflow-hidden">
            <div className="flex space-x-4 overflow-x-auto pb-4 px-4 scrollbar-hide snap-x">
                {categories.map((cat) => (
                    <button 
                        key={cat.name} 
                        onClick={() => onSelect(cat.name)}
                        className="flex-shrink-0 flex flex-col items-center gap-3 snap-start group"
                    >
                        <div className={`relative w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-500 transform ${
                            activeCategory === cat.name 
                            ? 'scale-110 shadow-2xl -translate-y-1 ring-4 ring-white dark:ring-slate-700' 
                            : 'bg-white dark:bg-slate-800 shadow-lg group-hover:scale-105'
                        }`}>
                            {activeCategory === cat.name && (
                                <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} rounded-3xl opacity-90 animate-pulse`}></div>
                            )}
                            <span className={`text-3xl relative z-10 transition-transform ${activeCategory === cat.name ? 'scale-125 rotate-6' : 'grayscale group-hover:grayscale-0'}`}>
                                {cat.icon}
                            </span>
                        </div>
                        <span className={`text-xs font-bold transition-colors ${
                            activeCategory === cat.name ? 'text-indigo-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                            {cat.name}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
};

export default CategoryIcons;
