
import React from 'react';
import { Product } from '../../types';

interface ProductCarouselProps {
    title: string;
    products: Product[];
    onProductClick: (product: Product) => void;
    linkText?: string;
    onLinkClick?: () => void;
    variant?: 'default' | 'large' | 'compact';
}

const ProductCard: React.FC<{ product: Product; onClick: () => void; variant: 'default' | 'large' | 'compact' }> = ({ product, onClick, variant }) => {
    const installmentValue = (product.price / 12).toFixed(2).replace('.', ',');
    const discount = product.promotional_price ? Math.round(((product.price - product.promotional_price) / product.price) * 100) : 0;
    const finalPrice = product.promotional_price || product.price;

    // Estilos baseados na variante
    const widthClass = variant === 'large' ? 'w-64 sm:w-72' : variant === 'compact' ? 'w-28 sm:w-32' : 'w-36 sm:w-44';
    const imageHeight = variant === 'large' ? 'h-52' : variant === 'compact' ? 'h-24' : 'h-36';
    const titleSize = variant === 'large' ? 'text-sm font-bold' : variant === 'compact' ? 'text-[10px] font-medium' : 'text-[11px] font-medium';
    const priceSize = variant === 'large' ? 'text-xl' : variant === 'compact' ? 'text-xs' : 'text-sm';

    return (
        <button 
            onClick={onClick}
            className={`flex-shrink-0 ${widthClass} bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-lg overflow-hidden snap-start text-left border border-slate-100 dark:border-slate-700 relative group transition-all duration-300 transform hover:-translate-y-1`}
        >
            <div className={`relative w-full ${imageHeight} bg-white p-3 flex items-center justify-center`}>
                <img 
                    src={product.image_url || 'https://placehold.co/400x400/png?text=Relp'} 
                    alt={product.name}
                    className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500 mix-blend-multiply dark:mix-blend-normal"
                    loading="lazy"
                />
                {discount > 0 && (
                    <span className={`absolute top-2 left-2 bg-red-500 text-white font-black px-1.5 py-0.5 rounded shadow-sm ${variant === 'compact' ? 'text-[8px]' : 'text-[9px]'}`}>
                        -{discount}%
                    </span>
                )}
                {/* Badge exclusiva para Large */}
                {variant === 'large' && (
                    <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur text-white text-[9px] font-bold px-2 py-1 rounded-lg">
                        OFERTA
                    </span>
                )}
            </div>
            
            <div className="p-3">
                <p className={`${titleSize} text-slate-700 dark:text-slate-200 line-clamp-2 h-8 mb-1 leading-tight`}>{product.name}</p>
                
                <div className="mt-1">
                    <div className="flex flex-col">
                        {discount > 0 && <span className="text-[10px] text-slate-400 line-through">R$ {product.price.toLocaleString('pt-BR')}</span>}
                        <span className={`${priceSize} font-black text-slate-900 dark:text-white`}>
                            R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </span>
                    </div>
                    
                    {variant !== 'compact' && (
                        <p className="text-[9px] text-green-600 dark:text-green-400 font-bold mt-0.5 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded w-fit">
                            12x R$ {installmentValue}
                        </p>
                    )}
                </div>
            </div>
        </button>
    );
};

const ProductCarousel: React.FC<ProductCarouselProps> = ({ title, products, onProductClick, linkText, onLinkClick, variant = 'default' }) => {
    if (products.length === 0) return null;

    return (
        <section className="mb-6 animate-fade-in-up">
            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            
            <div className="flex justify-between items-end px-4 mb-3">
                <div>
                    <h2 className={`font-black text-slate-900 dark:text-white tracking-tight uppercase ${variant === 'large' ? 'text-xl italic' : 'text-base'}`}>
                        {title}
                    </h2>
                    {variant === 'large' && <div className="h-1 w-12 bg-indigo-600 rounded-full mt-1"></div>}
                </div>
                {linkText && (
                    <button onClick={onLinkClick} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg">
                        {linkText} <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                )}
            </div>
            
            <div className="flex space-x-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory scroll-smooth">
                {products.map(product => (
                    <ProductCard 
                        key={product.id} 
                        product={product} 
                        onClick={() => onProductClick(product)}
                        variant={variant}
                    />
                ))}
                <div className="w-2 flex-shrink-0"></div>
            </div>
        </section>
    );
};

export default ProductCarousel;
