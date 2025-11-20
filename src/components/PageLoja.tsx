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
        <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Preparando a vitrine...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md p-4 mx-auto mt-20">
        <Alert message={error} type="error" />
        <button onClick={() => window.location.reload()} className="mt-4 w-full py-3 bg-indigo-600 text-white rounded-lg">Tentar Novamente</button>
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

  // Divide os produtos para diferentes carrosséis e grid
  const offers = products.slice(0, 8);
  const allProductsGrid = products; // Mostra todos no grid final

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-900 animate-fade-in min-h-screen pb-24">
        {/* Header Fixo e Translucido */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 001-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h1 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Relp Store</h1>
                </div>
                <SearchBar />
            </div>
        </header>
            
        <main className="space-y-6 pt-4">
            {/* Banner Principal */}
            <div className="md:max-w-7xl md:mx-auto">
                <StoreCarousel />
            </div>
            
            {/* Categorias */}
            <div className="max-w-7xl mx-auto">
                <CategoryIcons />
            </div>

            {products.length > 0 ? (
                <>
                     {/* Carrossel de Ofertas */}
                    <div className="max-w-7xl mx-auto py-2">
                        <ProductCarousel 
                            title="🔥 Ofertas Imperdíveis" 
                            products={offers} 
                            onProductClick={handleProductClick}
                        />
                    </div>

                    {/* Marcas */}
                    <div className="max-w-7xl mx-auto">
                         <BrandLogos />
                    </div>

                    {/* Grid de Todos os Produtos (Layout Estilo App) */}
                    <div className="max-w-7xl mx-auto px-4 pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Para Você</h2>
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">Ver tudo</span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                            {allProductsGrid.map(product => (
                                <div 
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                                >
                                    <div className="relative aspect-square bg-white p-4 flex items-center justify-center">
                                        <img 
                                            src={product.image_url || 'https://via.placeholder.com/400x400.png/E2E8F0/475569?text=Relp'} 
                                            alt={product.name}
                                            className="max-w-full max-h-full object-contain"
                                            loading="lazy"
                                        />
                                        {/* Badge de Parcelamento */}
                                        <div className="absolute bottom-2 right-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                            12x
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h3 className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 line-clamp-2 h-8 sm:h-10 leading-tight">
                                            {product.name}
                                        </h3>
                                        <div className="mt-2">
                                            <p className="text-xs text-slate-400 line-through">R$ {(product.price * 1.2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            <p className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                                {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </p>
                                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                ou 12x de R$ {(product.price / 12).toFixed(2).replace('.', ',')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                 <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-2xl shadow-sm mx-4 border border-slate-100 dark:border-slate-700 mt-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">Nossa loja está vazia</h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Adicione produtos no painel de administrador para que eles apareçam aqui.</p>
                </div>
            )}
        </main>
    </div>
  );
};

export default PageLoja;