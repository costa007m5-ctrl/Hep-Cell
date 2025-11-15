import React from 'react';
import { Product } from '../../types';

interface ProductCarouselProps {
    title: string;
    products: Product[];
}

const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
    const installmentValue = (product.price / 12).toFixed(2).replace('.', ',');

    return (
        <div className="flex-shrink-0 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden snap-start">
            <img 
                src={product.image_url || 'https://via.placeholder.com/400x400.png/E2E8F0/475569?text=Relp'} 
                alt={product.name}
                className="w-full h-48 object-cover"
            />
            <div className="p-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{product.name}</p>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                    em 12x R$ {installmentValue}
                </p>
            </div>
        </div>
    );
};


const ProductCarousel: React.FC<ProductCarouselProps> = ({ title, products }) => {
    if (products.length === 0) {
        return null;
    }

    return (
        <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white px-4">{title}</h2>
            <div className="flex space-x-4 overflow-x-auto pb-4 px-4 scrollbar-hide snap-x snap-mandatory scroll-smooth">
                {products.map(product => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
        </section>
    );
};

export default ProductCarousel;