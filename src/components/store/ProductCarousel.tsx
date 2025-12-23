
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
    // Cálculo de parcela simples (sem juros visualmente para atrair)
    const installmentValue = (product.price / 12).toFixed(2).replace('.', ',');
    const discount = product.promotional_price ? Math.round(((product.price - product.promotional_price) / product.price) * 100) : 0;
    const finalPrice = product.promotional_price || product.price;

    return (
        <button 
            onClick={onClick}
            className="flex-shrink-0 w-40 sm:w-48 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:shadow-md overflow-hidden snap-start text-left border border-slate-100 dark:border-slate-700 relative group transition-all duration-300"
        >
            <div className="relative w-full h-40 bg-white p-4 flex items-center justify-center border-b border-slate-50 dark:border-slate-700">
                <img 
                    src={product.image_url || 'https://via.placeholder.com/400x400.png/E2E8F0/475569?text=Relp'} 
                    alt={product.name}
                    className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300 mix-blend-multiply dark:mix-blend-normal"
                    loading="lazy"
                />
                {product.free_shipping && (
                    <span className="absolute bottom-2 left-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                        FRETE GRÁTIS
                    </span>
                )}
            </div>
            
            <div className="p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 h-8 mb-1 leading-tight">{product.name}</p>
                
                <div className="mt-1">
                    {discount > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 line-through">R$ {product.price.toLocaleString('pt-BR')}</span>
                            <span className="text-[10px] text-green-600 font-bold">{discount}% OFF</span>
                        </div>
                    )}
                    
                    <div className="flex items-baseline gap-1">
                        <span className="text-xs font-medium text-slate-900 dark:text-white">R$</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    
                    <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                        em 12x R$ {installmentValue}
                    </p>

                    {product.is_full && (
                        <p className="text-[10px] text-indigo-600 font-bold mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                            Chega amanhã
                        </p>
                    )}
                </div>
            </div>
        </button>
    );
};


const ProductCarousel: React.FC<ProductCarouselProps> = ({ title, products, onProductClick, linkText, onLinkClick }) => {
    if (products.length === 0) return null;

    return (
        <section className="py-4 bg-white dark:bg-slate-900 border-t border-b border-slate-100 dark:border-slate-800 mb-3">
            <div className="flex justify-between items-center px-4 mb-3">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
                    {title}
                </h2>
                {linkText && (
                    <button onClick={onLinkClick} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                        {linkText} ›
                    </button>
                )}
            </div>
            <div className="flex space-x-3 overflow-x-auto pb-2 px-4 scrollbar-hide snap-x snap-mandatory scroll-smooth">
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
