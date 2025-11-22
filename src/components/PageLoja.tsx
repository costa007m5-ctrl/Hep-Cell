
import React, { useState, useEffect, useMemo } from 'react';
import { Product, CartItem } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';
import { useToast } from './Toast';
import Modal from './Modal';

// Importação dos Novos Sub-Componentes
import StoreCarousel from './store/StoreCarousel';
import CategoryIcons from './store/CategoryIcons';
import BrandLogos from './store/BrandLogos';
import ProductDetails from './store/ProductDetails';

// --- Sub-Componentes Internos (que não foram externalizados) ---

// 1. Countdown Timer para Ofertas
const FlashSaleBanner = () => {
    const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });

    useEffect(() => {
        // Define o fim do dia como meta
        const target = new Date();
        target.setHours(23, 59, 59, 999);

        const interval = setInterval(() => {
            const now = new Date();
            const diff = target.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft({ h: 0, m: 0, s: 0 });
                return;
            }

            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / 1000 / 60) % 60);
            const s = Math.floor((diff / 1000) % 60);
            setTimeLeft({ h, m, s });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="mx-4 mt-4 mb-6 p-4 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="relative z-10 flex justify-between items-center">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-100 mb-1">Oferta Relâmpago</p>
                    <h3 className="text-xl font-bold">Até 40% OFF</h3>
                    <p className="text-xs text-white/90 mt-1">Em acessórios selecionados</p>
                </div>
                <div className="flex gap-2 text-center">
                    <div className="bg-white/20 backdrop-blur-md rounded-lg p-2 min-w-[40px]">
                        <span className="block font-bold text-lg leading-none">{String(timeLeft.h).padStart(2, '0')}</span>
                        <span className="text-[8px] uppercase">Hrs</span>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md rounded-lg p-2 min-w-[40px]">
                        <span className="block font-bold text-lg leading-none">{String(timeLeft.m).padStart(2, '0')}</span>
                        <span className="text-[8px] uppercase">Min</span>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md rounded-lg p-2 min-w-[40px]">
                        <span className="block font-bold text-lg leading-none">{String(timeLeft.s).padStart(2, '0')}</span>
                        <span className="text-[8px] uppercase">Seg</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 2. Drawer de Carrinho
const CartDrawer: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    cartItems: CartItem[]; 
    onUpdateQuantity: (id: string, delta: number) => void; 
    onCheckout: () => void; 
    isCheckingOut: boolean 
}> = ({ isOpen, onClose, cartItems, onUpdateQuantity, onCheckout, isCheckingOut }) => {
    if (!isOpen) return null;
    const total = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    return (
        <div className="fixed inset-0 z-[110] flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Seu Carrinho
                        <span className="bg-indigo-100 text-indigo-600 text-xs px-2 py-0.5 rounded-full">{cartItems.length}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {cartItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mb-4 text-slate-200 dark:text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            <p className="font-medium text-lg">Carrinho vazio</p>
                            <button onClick={onClose} className="mt-4 text-indigo-600 font-bold text-sm hover:underline">Ir às compras</button>
                        </div>
                    ) : (
                        cartItems.map(item => (
                            <div key={item.id} className="flex gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <img src={item.image_url || 'https://via.placeholder.com/80'} className="w-20 h-20 rounded-lg object-cover bg-slate-50" alt={item.name} />
                                <div className="flex-1 flex flex-col justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{item.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{item.brand}</p>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-sm font-bold text-indigo-600">{item.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg">
                                            <button onClick={() => onUpdateQuantity(item.id, -1)} className="px-2 py-1 text-slate-500 hover:text-indigo-600">-</button>
                                            <span className="text-xs font-bold px-1 min-w-[20px] text-center">{item.quantity}</span>
                                            <button onClick={() => onUpdateQuantity(item.id, 1)} className="px-2 py-1 text-slate-500 hover:text-indigo-600">+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {cartItems.length > 0 && (
                    <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <div className="flex justify-between mb-6">
                            <span className="text-slate-500">Subtotal</span>
                            <span className="text-lg font-bold text-slate-900 dark:text-white">{total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                        </div>
                        <button 
                            onClick={onCheckout}
                            disabled={isCheckingOut}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {isCheckingOut ? <LoadingSpinner /> : 'Finalizar Pedido'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// 3. Drawer de Wishlist
const WishlistDrawer: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    wishlist: Set<string>; 
    allProducts: Product[];
    onRemove: (id: string) => void;
    onMoveToCart: (product: Product) => void;
}> = ({ isOpen, onClose, wishlist, allProducts, onRemove, onMoveToCart }) => {
    if (!isOpen) return null;
    const wishlistItems = allProducts.filter(p => wishlist.has(p.id));

    return (
        <div className="fixed inset-0 z-[110] flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Meus Favoritos
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {wishlistItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <p>Sua lista de desejos está vazia.</p>
                        </div>
                    ) : (
                        wishlistItems.map(item => (
                            <div key={item.id} className="flex gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                <img src={item.image_url || 'https://via.placeholder.com/80'} className="w-20 h-20 rounded-lg object-cover" alt={item.name} />
                                <div className="flex-1 flex flex-col justify-between">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{item.name}</p>
                                    <p className="text-sm font-bold text-indigo-600">{item.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={() => onRemove(item.id)} className="text-xs text-red-500 font-medium px-2 py-1 hover:bg-red-50 rounded">Remover</button>
                                        <button onClick={() => onMoveToCart(item)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg font-bold shadow-sm">Adicionar ao Carrinho</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main Page ---

const PageLoja: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [activeBrand, setActiveBrand] = useState<string | undefined>(undefined);
    
    // View states
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isWishlistOpen, setIsWishlistOpen] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    // Data Persistance
    const [cart, setCart] = useState<CartItem[]>([]);
    const [wishlist, setWishlist] = useState<Set<string>>(new Set());

    const { addToast } = useToast();

    // --- Effects ---
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setIsLoading(true);
                // ROTA CORRIGIDA: Usa /api/products em vez de /api/admin/products
                const response = await fetch('/api/products'); 
                if (!response.ok) throw new Error('Erro ao carregar produtos.');
                const data = await response.json();
                
                const now = new Date();
                const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
                
                const enhanced = data.map((p: any) => ({
                    ...p,
                    is_new: new Date(p.created_at) > sevenDaysAgo
                }));
                
                setProducts(enhanced);
            } catch (e) {
                console.error(e);
                addToast('Erro de conexão.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchProducts();

        // Load local storage
        const savedCart = localStorage.getItem('relp_cart');
        if (savedCart) setCart(JSON.parse(savedCart));
        
        const savedWishlist = localStorage.getItem('relp_wishlist');
        if (savedWishlist) setWishlist(new Set(JSON.parse(savedWishlist)));

    }, [addToast]);

    useEffect(() => {
        localStorage.setItem('relp_cart', JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        localStorage.setItem('relp_wishlist', JSON.stringify(Array.from(wishlist)));
    }, [wishlist]);


    // --- Handlers ---
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
            if (navigator.vibrate) navigator.vibrate(50);
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateCartQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, item.quantity + delta);
                if (newQty === 0) return null; // Will be filtered out
                if (newQty > item.stock) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(Boolean) as CartItem[]);
    };

    const toggleWishlist = (id: string) => {
        setWishlist(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
                addToast('Removido dos favoritos', 'info');
            } else {
                newSet.add(id);
                addToast('Salvo nos favoritos', 'success');
                if (navigator.vibrate) navigator.vibrate([50, 50]);
            }
            return newSet;
        });
    };

    const handleCheckout = async () => {
        setIsCheckingOut(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                addToast('Faça login para finalizar.', 'error');
                return;
            }
            // Simulate Checkout Logic (Integrated with existing backend structure)
            const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({ user_id: user.id, total: total, status: 'pending' })
                .select().single();
            
            if(orderError) throw orderError;
            
            const orderItems = cart.map(item => ({
                order_id: order.id, product_id: item.id, quantity: item.quantity, price: item.price, product_name: item.name
            }));
            await supabase.from('order_items').insert(orderItems);

            setCart([]);
            setIsCartOpen(false);
            addToast('Pedido realizado com sucesso!', 'success');
        } catch (error) {
            addToast('Erro ao processar pedido.', 'error');
        } finally {
            setIsCheckingOut(false);
        }
    };

    // --- Filtering Logic ---
    
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // 1. Search Filter
            const matchesSearch = !searchQuery || 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                p.brand?.toLowerCase().includes(searchQuery.toLowerCase());
            
            // 2. Category Filter
            const matchesCategory = activeCategory === 'Todos' || 
                (activeCategory === 'Ofertas' ? p.category === 'Ofertas' || p.name.toLowerCase().includes('promo') : p.category === activeCategory);
            
            // 3. Brand Filter (if specific brand selected)
            const matchesBrand = !activeBrand || activeBrand === 'Todas' || 
                (p.brand && p.brand.toLowerCase() === activeBrand.toLowerCase());

            return matchesSearch && matchesCategory && matchesBrand;
        });
    }, [products, searchQuery, activeCategory, activeBrand]);

    const handleCategorySelect = (cat: string) => {
        setActiveCategory(cat);
        // Reset brand filter if switching categories might help UX, but optional.
    };

    const handleBannerLink = (link: string) => {
        if (link.startsWith('category:')) {
            const cat = link.split(':')[1];
            setActiveCategory(cat);
        } else if (link.startsWith('brand:')) {
            const brand = link.split(':')[1];
            setActiveBrand(brand);
        }
    };

    // Se um produto estiver selecionado, mostre a tela de detalhes
    if (selectedProduct) {
        return (
            <ProductDetails 
                product={selectedProduct} 
                allProducts={products}
                onBack={() => setSelectedProduct(null)}
                onProductClick={setSelectedProduct} // Permite navegar para produtos relacionados
            />
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 animate-fade-in">
            {/* 1. Header Fixo com Busca */}
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-md mx-auto px-4 py-3 space-y-3">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Relp Store</h1>
                        <div className="flex gap-2">
                             <button onClick={() => setIsWishlistOpen(true)} className="p-2 text-slate-500 hover:text-red-500 transition-colors relative">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={wishlist.size > 0 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                {wishlist.size > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>}
                            </button>
                            <button onClick={() => setIsCartOpen(true)} className="p-2 text-slate-500 hover:text-indigo-600 transition-colors relative">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                {cart.length > 0 && <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{cart.length}</span>}
                            </button>
                        </div>
                    </div>
                    
                    {/* Search Input */}
                    <div className="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input 
                            type="text" 
                            placeholder="Buscar produtos, marcas..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm border-none focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner"
                        />
                    </div>
                </div>
            </header>

            {/* 2. Conteúdo Principal Scrollável */}
            <main className="max-w-md mx-auto pt-2 space-y-4">
                
                {/* Carousel de Destaques (Apenas se não houver busca) */}
                {!searchQuery && activeCategory === 'Todos' && (
                    <>
                        <StoreCarousel onBannerClick={handleBannerLink} />
                        <CategoryIcons activeCategory={activeCategory} onSelect={handleCategorySelect} />
                        <BrandLogos activeBrand={activeBrand} onSelect={setActiveBrand} />
                        <FlashSaleBanner />
                        <h2 className="px-4 text-lg font-bold text-slate-900 dark:text-white">Destaques</h2>
                    </>
                )}

                {/* Category Filters (if specific category selected or searching) */}
                {(searchQuery || activeCategory !== 'Todos') && (
                     <CategoryIcons activeCategory={activeCategory} onSelect={handleCategorySelect} />
                )}

                {/* Product Grid */}
                {isLoading ? (
                    <div className="flex justify-center py-20"><LoadingSpinner /></div>
                ) : filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 px-3 pb-6">
                        {filteredProducts.map(product => (
                            <div 
                                key={product.id} 
                                className="bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 relative group flex flex-col cursor-pointer"
                                onClick={() => setSelectedProduct(product)} // Abre detalhes
                            >
                                {/* Badges */}
                                <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 pointer-events-none">
                                    {product.is_new && <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">NOVO</span>}
                                    {product.stock < 5 && <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">RESTAM {product.stock}</span>}
                                </div>

                                {/* Wishlist Button (Stop Propagation) */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                                    className="absolute top-2 right-2 z-10 p-2 bg-white/80 dark:bg-black/40 backdrop-blur rounded-full text-slate-400 hover:text-red-500 transition-colors shadow-sm"
                                >
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={wishlist.has(product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} color={wishlist.has(product.id) ? "#ef4444" : "currentColor"}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                </button>

                                {/* Image */}
                                <div className="aspect-square bg-white rounded-xl mb-3 flex items-center justify-center p-2 relative overflow-hidden">
                                    <img src={product.image_url || ''} alt={product.name} className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 flex flex-col">
                                    <p className="text-xs text-slate-400 mb-0.5">{product.brand || 'Genérico'}</p>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 mb-2 flex-1">{product.name}</h3>
                                    
                                    <div className="mt-auto">
                                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                            {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">
                                            12x de {(product.price / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                        
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                                            className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-indigo-600 dark:hover:bg-slate-200 transition-colors active:scale-95"
                                        >
                                            Adicionar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <p className="text-slate-500 font-medium">Nenhum produto encontrado.</p>
                        <p className="text-sm text-slate-400 mt-1">Tente buscar por outro termo.</p>
                    </div>
                )}
            </main>

            {/* Drawers (Carrinho e Wishlist) */}
            <CartDrawer 
                isOpen={isCartOpen} 
                onClose={() => setIsCartOpen(false)} 
                cartItems={cart}
                onUpdateQuantity={updateCartQuantity}
                onCheckout={handleCheckout}
                isCheckingOut={isCheckingOut}
            />
            
            <WishlistDrawer
                isOpen={isWishlistOpen}
                onClose={() => setIsWishlistOpen(false)}
                wishlist={wishlist}
                allProducts={products}
                onRemove={(id) => toggleWishlist(id)}
                onMoveToCart={(p) => { handleAddToCart(p); toggleWishlist(p.id); }}
            />
        </div>
    );
};

export default PageLoja;
