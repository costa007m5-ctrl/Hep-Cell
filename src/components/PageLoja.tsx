import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

const ProductCard: React.FC<{ product: Product }> = ({ product }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col animate-fade-in-up">
    <img 
      src={product.image_url || 'https://via.placeholder.com/400x300.png/E2E8F0/475569?text=Relp+Cell'} 
      alt={product.name} 
      className="w-full h-48 object-cover"
    />
    <div className="p-6 flex flex-col flex-grow">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{product.name}</h3>
      <p className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">
        {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
      {product.description && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 flex-grow">{product.description}</p>
      )}
       <div className="mt-6">
        <button 
            disabled 
            className="w-full text-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
        >
            Ver Detalhes
        </button>
        <p className="text-xs text-center text-slate-400 mt-2">Compra via painel administrativo.</p>
       </div>
    </div>
  </div>
);

const PageLoja: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/products');
        if (!response.ok) {
          throw new Error('Não foi possível carregar os produtos da loja.');
        }
        const data = await response.json();
        setProducts(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center space-y-4 p-8">
        <LoadingSpinner />
        <p className="text-slate-500 dark:text-slate-400">Carregando produtos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md p-4">
        <Alert message={error} type="error" />
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-4xl space-y-8 px-4">
        <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Nossa Loja</h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Confira os produtos disponíveis na Relp Cell.</p>
        </div>
        {products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
        ) : (
            <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
                 <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-slate-900 dark:text-white">Nenhum produto encontrado</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nossos produtos aparecerão aqui em breve.</p>
            </div>
        )}
    </div>
  );
};

export default PageLoja;
