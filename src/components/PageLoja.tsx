import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import SearchBar from './store/SearchBar';
import StoreCarousel from './store/StoreCarousel';
import CategoryIcons from './store/CategoryIcons';
import ProductCarousel from './store/ProductCarousel';
import BrandLogos from './store/BrandLogos'; // Import the new component

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
        <p className="text-slate-500 dark:text-slate-400">Construindo a loja...</p>
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

  // Divide os produtos para diferentes carrosséis
  const offers = products.slice(0, 8);
  const newArrivals = products.slice(8, 16);

  return (
    <div className="w-full h-full bg-slate-100 dark:bg-slate-900 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
            <header className="p-4 sticky top-0 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
                <SearchBar />
            </header>
            
            <main className="space-y-8 pb-8">
                <StoreCarousel />
                <CategoryIcons />
                <BrandLogos /> {/* Add the new brand logos carousel */}

                {products.length > 0 ? (
                    <>
                        <ProductCarousel title="Ofertas do Dia" products={offers} />
                        <ProductCarousel title="Novidades" products={newArrivals} />
                    </>
                ) : (
                     <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-2xl shadow-lg mx-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <h3 className="mt-2 text-lg font-medium text-slate-900 dark:text-white">Nossa loja está vazia</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Adicione produtos no painel de administrador para que eles apareçam aqui.</p>
                    </div>
                )}
            </main>
        </div>
    </div>
  );
};

export default PageLoja;
