import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import SearchBar from './store/SearchBar';
import StoreCarousel from './store/StoreCarousel';
import CategoryIcons from './store/CategoryIcons';
import ProductCarousel from './store/ProductCarousel';
import BrandLogos from './store/BrandLogos';
import ProductDetails from './store/ProductDetails';

const PageLoja: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para controlar a navegação interna da loja
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/admin/products');
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

  // Scroll para o topo quando muda de tela
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedProduct]);

  const handleProductClick = (product: Product) => {
      setSelectedProduct(product);
  };

  const handleBackToStore = () => {
      setSelectedProduct(null);
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center space-y-4 p-8">
        <LoadingSpinner />
        <p className="text-slate-500 dark:text-slate-400">Montando a vitrine...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md p-4 mx-auto mt-10">
        <Alert message={error} type="error" />
      </div>
    );
  }

  // Se houver um produto selecionado, mostra a tela de detalhes
  if (selectedProduct) {
      return (
          <ProductDetails 
              product={selectedProduct} 
              allProducts={products} 
              onBack={handleBackToStore} 
              onProductClick={handleProductClick}
          />
      );
  }

  // Divide os produtos para diferentes carrosséis
  const offers = products.slice(0, 8);
  const newArrivals = products.slice(8, 16);

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-900 animate-fade-in min-h-screen">
        {/* Header exclusivo da Loja - Full Width */}
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 001-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Relp Store</h1>
                </div>
                <SearchBar />
            </div>
        </header>
            
        <main className="space-y-8 pb-12 pt-4">
            {/* Banners principais com menos padding lateral para mobile */}
            <div className="md:max-w-7xl md:mx-auto">
                <StoreCarousel />
            </div>
            
            <div className="max-w-7xl mx-auto space-y-8">
                <CategoryIcons />
                <BrandLogos />

                {products.length > 0 ? (
                    <>
                        <div className="bg-white dark:bg-slate-800/50 py-6 border-y border-slate-100 dark:border-slate-800">
                            <ProductCarousel 
                                title="Ofertas do Dia" 
                                products={offers} 
                                onProductClick={handleProductClick}
                            />
                        </div>
                        <div className="py-2">
                            <ProductCarousel 
                                title="Novidades" 
                                products={newArrivals} 
                                onProductClick={handleProductClick}
                            />
                        </div>
                    </>
                ) : (
                     <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-2xl shadow-sm mx-4 border border-slate-100 dark:border-slate-700">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">Nossa loja está vazia</h3>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Adicione produtos no painel de administrador para que eles apareçam aqui.</p>
                    </div>
                )}
            </div>
        </main>
    </div>
  );
};

export default PageLoja;