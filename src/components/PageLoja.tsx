
import React, { useState, useEffect, useMemo } from 'react';
import { Product, CartItem } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import SearchBar from './store/SearchBar';
import StoreCarousel from './store/StoreCarousel';
import CategoryIcons from './store/CategoryIcons';
import ProductCarousel from './store/ProductCarousel';
import BrandLogos from './store/BrandLogos';
import ProductDetails from './store/ProductDetails';
import Modal from './Modal';
import { supabase } from '../services/clients';
import { useToast } from './Toast';

// --- Components Auxiliares ---

// Stories Component
const StoriesRail = () => {
    const stories = [
        { id: 1, name: 'Ofertas', img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=150&h=150&fit=crop', active: true },
        { id: 2, name: 'iPhone', img: 'https://images.unsplash.com/photo-1510557880104-b3891d4ba843?w=150&h=150&fit=crop', active: false },
        { id: 3, name: 'Samsung', img: 'https://images.unsplash.com/photo-1610945265078-386f3b58d823?w=150&h=150&fit=crop', active: false },
        { id: 4, name: 'Xiaomi', img: 'https://images.unsplash.com/photo-1598327105666-5b8936cd52ba?w=150&h=150&fit=crop', active: false },
        { id: 5, name: 'Fones', img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&h=150&fit=crop', active: false },
    ];

    return (
        <div className="flex space-x-4 overflow-x-auto pb-4 px-4 scrollbar-hide pt-2">
            {stories.map(story => (
                <div key={story.id} className="flex flex-col items-center space-y-1 flex-shrink-0 cursor-pointer">
                    <div className={`w-16 h-16 rounded-full p-[2px] ${story.active ? 'bg-gradient-to-tr from-yellow-400 to-pink-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        <img src={story.img} alt={story.name} className="w-full h-full rounded-full object-cover border-2 border-white dark:border-slate-900" />
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{story.name}</span>
                </div>
            ))}
        </div>
    );
};

// Cart Drawer
const CartDrawer: React.FC<{ isOpen: boolean; onClose: () => void; cartItems: CartItem[]; onRemove: (id: string) => void; onCheckout: () => void; isCheckingOut: boolean }> = ({ isOpen, onClose, cartItems, onRemove, onCheckout, isCheckingOut }) => {
    if (!isOpen) return null;
    const total = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    return (
        <div className="fixed inset-0 z-[110] flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-up">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Meu Carrinho ({cartItems.length})</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {cartItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-slate-300 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            <p className="font-medium">Seu carrinho está vazio</p>
                            <button onClick={onClose} className="mt-4 text-indigo-600 font-semibold">Começar a comprar</button>
                        </div>
                    ) : (
                        cartItems.map(item => (
                            <div key={item.id} className="flex gap-3 items-start bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                <img src={item.image_url || 'https://via.placeholder.com/80'} className="w-20 h-20 rounded-lg object-cover bg-white" alt={item.name} />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{item.name}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">Qtd: {item.quantity}</span>
                                        <p className="text-sm font-bold text-indigo-600">{item.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                    </div>
                                </div>
                                <button onClick={() => onRemove(item.id)} className="text-slate-400 hover:text-red-500 p-1 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ))
                    )}
                </div>
                {cartItems.length > 0 && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-safe shadow-top">
                        <div className="flex justify-between mb-4 text-lg font-bold text-slate-900 dark:text-white">
                            <span>Total</span>
                            <span>{total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                        </div>
                        <button 
                            onClick={onCheckout}
                            disabled={isCheckingOut}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {isCheckingOut ? <LoadingSpinner /> : 'Finalizar Compra'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const PageLoja: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Novos Estados
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Filtros
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [activeBrand, setActiveBrand] = useState('Todas');
  const [sortOption, setSortOption] = useState('relevance'); // relevance, price_asc, price_desc
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { addToast } = useToast();

  // Carrega carrinho do localStorage ao iniciar
  useEffect(() => {
      const savedCart = localStorage.getItem('relp_cart');
      if (savedCart) {
          try {
              setCart(JSON.parse(savedCart));
          } catch (e) {
              console.error("Erro ao carregar carrinho", e);
          }
      }
      
      // Carrega wishlist
      const savedWishlist = localStorage.getItem('relp_wishlist');
      if (savedWishlist) {
          setWishlist(new Set(JSON.parse(savedWishlist)));
      }
  }, []);

  // Salva carrinho sempre que mudar
  useEffect(() => {
      localStorage.setItem('relp_cart', JSON.stringify(cart));
  }, [cart]);
  
  // Salva wishlist
  useEffect(() => {
      localStorage.setItem('relp_wishlist', JSON.stringify(Array.from(wishlist)));
  }, [wishlist]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/products');
        if (!response.ok) throw new Error('Erro ao carregar loja.');
        const data = await response.json();
        
        const now = new Date();
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));

        const enhancedData = data.map((p: any) => ({
            ...p, 
            rating: (Math.random() * 2 + 3).toFixed(1), 
            reviews_count: Math.floor(Math.random() * 200),
            is_new: new Date(p.created_at) > sevenDaysAgo 
        }));
        setProducts(enhancedData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleAddToCart = (product: Product) => {
      setCart(prev => {
          const existing = prev.find(p => p.id === product.id);
          if (existing) {
              if (existing.quantity >= product.stock) {
                   addToast('Estoque máximo atingido!', 'error');
                   return prev;
              }
              addToast('Quantidade atualizada!', 'success');
              return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
          }
          if (product.stock <= 0) {
              addToast('Produto fora de estoque.', 'error');
              return prev;
          }
          addToast('Adicionado ao carrinho!', 'success');
          // Feedback tátil
          if (navigator.vibrate) navigator.vibrate(50);
          return [...prev, { ...product, quantity: 1 }];
      });
  };

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            addToast('Faça login para finalizar.', 'error');
            setIsCheckingOut(false);
            return;
        }

        const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        // 1. Cria o pedido na tabela 'orders'
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: user.id,
                total: total,
                status: 'pending'
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // 2. Cria os itens do pedido na tabela 'order_items'
        const orderItems = cart.map(item => ({
            order_id: order.id,
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
            product_name: item.name // redundancy for display
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (itemsError) throw itemsError;

        // 3. Atualiza o estoque (Opcional, mas recomendado)
        for (const item of cart) {
             await supabase.rpc('decrement_stock', { product_id: item.id, qty: item.quantity }).catch(() => {
                 // Se a RPC não existir, tenta update manual (menos seguro concorrentemente mas ok para MVP)
                 const newStock = Math.max(0, item.stock - item.quantity);
                 supabase.from('products').update({ stock: newStock }).eq('id', item.id);
             });
        }

        setCart([]); // Limpa carrinho
        localStorage.removeItem('relp_cart');
        setIsCartOpen(false);
        addToast('Pedido realizado com sucesso!', 'success');

    } catch (error: any) {
        console.error('Erro no checkout:', error);
        addToast('Erro ao processar pedido. Tente novamente.', 'error');
    } finally {
        setIsCheckingOut(false);
    }
  };

  const toggleWishlist = (id: string) => {
      setWishlist(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          return newSet;
      });
  };

  const filteredProducts = useMemo(() => {
      let result = [...products];

      // Filtro de Categoria
      if (activeCategory !== 'Todos') {
          result = result.filter(p => {
              // Se a categoria for "Ofertas", não temos uma lógica clara sem campo de desconto, 
              // mas vamos assumir que se a categoria for explicitamente salva como "Ofertas", mostramos.
              // Ou, se o nome contém "Promoção".
              if (activeCategory === 'Ofertas') {
                  return p.category === 'Ofertas' || p.name.toLowerCase().includes('oferta') || p.name.toLowerCase().includes('promo');
              }
              
              if (p.category) return p.category === activeCategory;
              // Fallback se categoria não estiver definida
              return p.name.toLowerCase().includes(activeCategory.toLowerCase().slice(0, 4));
          });
      }

      // Filtro de Marca
      if (activeBrand !== 'Todas') {
          result = result.filter(p => {
              if (p.brand) return p.brand.toLowerCase() === activeBrand.toLowerCase();
              // Fallback
              return p.name.toLowerCase().includes(activeBrand.toLowerCase());
          });
      }

      // Ordenação
      if (sortOption === 'price_asc') result.sort((a, b) => a.price - b.price);
      if (sortOption === 'price_desc') result.sort((a, b) => b.price - a.price);
      
      return result;
  }, [products, activeCategory, activeBrand, sortOption]);

  if (selectedProduct) {
      return (
          <ProductDetails 
              product={selectedProduct} 
              allProducts={products} 
              onBack={() => setSelectedProduct(null)} 
              onProductClick={setSelectedProduct}
          />
      );
  }

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-900 animate-fade-in min-h-screen pb-24">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50 transition-all">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Relp Store</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsFilterOpen(true)} className="p-2 text-slate-600 dark:text-slate-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        </button>
                        <button onClick={() => setIsCartOpen(true)} className="p-2 text-slate-600 dark:text-slate-300 relative">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            {cart.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{cart.length}</span>}
                        </button>
                    </div>
                </div>
                <SearchBar />
            </div>
        </header>

        <main className="space-y-6">
            <StoriesRail />
            
            <div className="md:max-w-7xl md:mx-auto">
                <StoreCarousel />
            </div>
            
            <div className="max-w-7xl mx-auto">
                <CategoryIcons activeCategory={activeCategory} onSelect={setActiveCategory} />
            </div>

            {isLoading ? <div className="flex justify-center py-20"><LoadingSpinner /></div> : (
                <>
                    <div className="max-w-7xl mx-auto">
                        <ProductCarousel 
                            title="🔥 Ofertas Relâmpago" 
                            products={products.filter(p => p.category === 'Ofertas' || p.name.toLowerCase().includes('promo')).slice(0, 6)} 
                            onProductClick={setSelectedProduct}
                        />
                    </div>

                    <div className="max-w-7xl mx-auto pt-2">
                        <BrandLogos activeBrand={activeBrand} onSelect={setActiveBrand} />
                    </div>

                    <div className="max-w-7xl mx-auto px-4 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {activeCategory !== 'Todos' ? activeCategory : 'Para Você'}
                                {activeBrand !== 'Todas' && <span className="text-slate-500 dark:text-slate-400 text-sm ml-2">({activeBrand})</span>}
                            </h2>
                            <button onClick={() => setIsFilterOpen(true)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Filtrar</button>
                        </div>
                        
                        {filteredProducts.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                                {filteredProducts.map(product => (
                                    <div key={product.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden relative group">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                                            className="absolute top-2 right-2 z-10 p-1.5 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill={wishlist.has(product.id) ? "currentColor" : "none"} stroke="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                                        </button>

                                        {product.is_new && (
                                            <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold uppercase rounded shadow-sm">Novo</span>
                                        )}

                                        <div onClick={() => setSelectedProduct(product)} className="relative aspect-square bg-white p-4 flex items-center justify-center cursor-pointer">
                                            <img src={product.image_url || ''} alt={product.name} className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                        </div>

                                        <div className="p-3" onClick={() => setSelectedProduct(product)}>
                                            <div className="flex items-center gap-1 mb-1">
                                                <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                <span className="text-[10px] text-slate-500 font-medium">{product.rating} ({product.reviews_count})</span>
                                            </div>
                                            <h3 className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 line-clamp-2 h-8 sm:h-10 leading-tight">{product.name}</h3>
                                            <div className="mt-2">
                                                <p className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">12x R$ {(product.price / 12).toFixed(2).replace('.', ',')}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleAddToCart(product)}
                                            className="w-full py-2 bg-slate-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 text-xs font-bold uppercase hover:bg-indigo-600 hover:text-white transition-colors flex items-center justify-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                            Adicionar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
                                <p>Nenhum produto encontrado com esses filtros.</p>
                                <button onClick={() => { setActiveCategory('Todos'); setActiveBrand('Todas'); }} className="mt-4 text-indigo-600 font-bold hover:underline">
                                    Limpar Filtros
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </main>

        <CartDrawer 
            isOpen={isCartOpen} 
            onClose={() => setIsCartOpen(false)} 
            cartItems={cart} 
            onRemove={(id) => setCart(p => p.filter(i => i.id !== id))}
            onCheckout={handleCheckout}
            isCheckingOut={isCheckingOut}
        />

        {/* Filter Modal */}
        <Modal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)}>
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Filtros</h3>
                <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ordenar por</p>
                    <div className="flex flex-wrap gap-2">
                        {['Relevância', 'Menor Preço', 'Maior Preço'].map(opt => (
                            <button 
                                key={opt}
                                onClick={() => setSortOption(opt === 'Menor Preço' ? 'price_asc' : opt === 'Maior Preço' ? 'price_desc' : 'relevance')}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                    (sortOption === 'relevance' && opt === 'Relevância') || (sortOption === 'price_asc' && opt === 'Menor Preço') || (sortOption === 'price_desc' && opt === 'Maior Preço')
                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                    : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
                 <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Categorias</p>
                    <div className="flex flex-wrap gap-2">
                        {['Todos', 'Celulares', 'Fones', 'Acessórios', 'Smartwatch', 'Ofertas'].map(cat => (
                             <button 
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Marcas</p>
                    <div className="flex flex-wrap gap-2">
                        {['Todas', 'Apple', 'Samsung', 'Xiaomi', 'Motorola', 'LG', 'Asus'].map(brand => (
                             <button 
                                key={brand}
                                onClick={() => setActiveBrand(brand)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${activeBrand === brand ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'}`}
                            >
                                {brand}
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={() => setIsFilterOpen(false)} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Aplicar Filtros</button>
            </div>
        </Modal>
    </div>
  );
};

export default PageLoja;
