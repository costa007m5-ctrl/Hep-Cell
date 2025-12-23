
import React from 'react';

interface BrandLogosProps {
    activeBrand?: string;
    onSelect?: (brand: string) => void;
}

const brands = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Realme', 'JBL'];

const BrandLogos: React.FC<BrandLogosProps> = ({ activeBrand, onSelect }) => {
    return (
        <div className="flex space-x-2 overflow-x-auto px-4 scrollbar-hide items-center">
            <span className="text-xs font-bold text-slate-400 uppercase mr-2 shrink-0">Filtrar:</span>
            {brands.map(brand => (
                <button
                    key={brand}
                    onClick={() => onSelect && onSelect(activeBrand === brand ? 'Todas' : brand)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                        activeBrand === brand
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                >
                    {brand}
                </button>
            ))}
        </div>
    );
};

export default BrandLogos;
