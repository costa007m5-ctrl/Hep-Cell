
import React from 'react';

const categories = [
    { name: 'Celulares', icon: '📱' },
    { name: 'Acessórios', icon: '⚡' },
    { name: 'Fones', icon: '🎧' },
    { name: 'Smartwatch', icon: '⌚' },
    { name: 'Ofertas', icon: '🔥' },
    { name: 'Games', icon: '🎮' },
];

interface CategoryIconsProps {
    activeCategory: string;
    onSelect: (category: string) => void;
}

const CategoryIcons: React.FC<CategoryIconsProps> = ({ activeCategory, onSelect }) => {
    return (
        <section className="py-2">
            <div className="flex space-x-4 overflow-x-auto pb-2 px-4 scrollbar-hide">
                {categories.map((cat) => (
                    <button 
                        key={cat.name} 
                        onClick={() => onSelect(cat.name)}
                        className="flex-shrink-0 flex flex-col items-center gap-2 group"
                    >
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm border ${
                            activeCategory === cat.name 
                            ? 'bg-indigo-600 text-white border-indigo-600 scale-105 shadow-md' 
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                        }`}>
                            <span className="text-xl">{cat.icon}</span>
                        </div>
                        <span className={`text-[10px] font-medium transition-colors ${
                            activeCategory === cat.name ? 'text-indigo-600 font-bold' : 'text-slate-500'
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
