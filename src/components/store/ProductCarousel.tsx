import React from 'react';
import { Product } from '../../types';

interface ProductCarouselProps {
    title: string;
    products: Product[];
    onProductClick: (product: Product) => void;
}

const ProductCard: React.FC<{ product: Product; onClick: () => void }> = ({ product, onClick }) => {
    const installmentValue = (product.price / 12).toFixed(2).replace('.', ',');

    return (
        <button 
            onClick={onClick}
            className="flex-shrink-0 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden snap-start text-left hover:shadow-xl transition-all duration-200 group border border-slate-100 dark:border-slate-700"
        >
            <div className="relative overflow-hidden h-48 bg-white p-2 flex items-center justify-center">
                <img 
                    src={product.image_url || 'https://via.placeholder.com/400x400.png/E2E8F0/475569?text=Relp'} 
                    alt={product.name}
                    className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-700 dark:text-slate-300 truncate font-medium">{product.name}</p>
                <p className="mt-1 text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    12x de R$ {installmentValue}
                </p>
            </div>
        </button>
    );
};


const ProductCarousel: React.FC<ProductCarouselProps> = ({ title, products, onProductClick }) => {
    if (products.length === 0) {
        return null;
    }

    return (
        <section className="space-y-4 animate-fade-in-up">
            {title && (
                <div className="flex justify-between items-center px-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
                </div>
            )}
            <div className="flex space-x-4 overflow-x-auto pb-4 px-4 scrollbar-hide snap-x snap-mandatory scroll-smooth">
                {products.map(product => (
                    <ProductCard 
                        key={product.id} 
                        product={product} 
                        onClick={() => onProductClick(product)}
                    />
                ))}
            </div>
        </section>
    );
};

export default ProductCarousel;