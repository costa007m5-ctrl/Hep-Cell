
import React from 'react';
import { Product } from '../../types';

interface ProductCarouselProps {
    title: string;
    products: Product[];
    onProductClick: (product: Product) => void;
    linkText?: string;
    onLinkClick?: () => void;
}

const ProductCard: React.FC<{ product: Product; onClick: () => void }> = ({ product, onClick }) => {
    const installmentValue = (product.price / 12).toFixed(2).replace('.', ',');
    const discount = product.promotional_price ? Math.round(((product.price - product.promotional_price) / product.price) * 100) : 0;
    const finalPrice = product.promotional_price || product.price;

    return (
        <button 
            onClick={onClick}
            className="flex-shrink-0 w-36 sm:w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-lg overflow-hidden snap-start text-left border border-slate-100 dark:border-slate-700 relative group transition-all duration-300 transform hover:-translate-y-1"
        >
            <div className="relative w-full h-36 bg-white p-3 flex items-center justify-center">
                <img 
                    src={product.image_url || 'https://placehold.co/400x400/png?text=Relp'} 
                    alt={product.name}
                    className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                />
                {discount > 0 && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                        -{discount}%
                    </span>
                )}
            </div>
            
            <div className="p-3">
                <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 h-8 mb-1 leading-tight font-medium">{product.name}</p>
                
                <div className="mt-1">
                    <div className="flex flex-col">
                        {discount > 0 && <span className="text-[10px] text-slate-400 line-through">R$ {product.price.toLocaleString('pt-BR')}</span>}
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                            R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </span>
                    </div>
                    
                    <p className="text-[9px] text-green-600 dark:text-green-400 font-bold mt-0.5">
                        12x R$ {installmentValue}
                    </p>
                </div>
            </div>
        </button>
    );
};

const ProductCarousel: React.FC<ProductCarouselProps> = ({ title, products, onProductClick, linkText, onLinkClick }) => {
    if (products.length === 0) return null;

    return (
        <section className="mb-6 animate-fade-in-up">
            <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
            <div className="flex justify-between items-center px-4 mb-3">
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight uppercase">
                    {title}
                </h2>
                {linkText && (
                    <button onClick={onLinkClick} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                        {linkText} <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                )}
            </div>
            {/* Removida borda inferior e adicionado padding bottom para sombra dos cards não cortar */}
            <div className="flex space-x-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory scroll-smooth">
                {products.map(product => (
                    <ProductCard 
                        key={product.id} 
                        product={product} 
                        onClick={() => onProductClick(product)}
                    />
                ))}
                {/* Espaço extra no final */}
                <div className="w-2 flex-shrink-0"></div>
            </div>
        </section>
    );
};

export default ProductCarousel;
