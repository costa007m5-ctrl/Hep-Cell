
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, CartItem, Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';
import { getProfile } from '../services/profileService';
import { useToast } from './Toast';
import Modal from './Modal';

// Importação dos Novos Sub-Componentes
import StoreCarousel from './store/StoreCarousel';
import CategoryIcons from './store/CategoryIcons';
import BrandLogos from './store/BrandLogos';
import ProductDetails from './store/ProductDetails';

// --- Ícones SVG ---
const TruckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" /></svg>;
const BoltIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>;
const FilterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>;
const LocationIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

// --- Componentes Internos ---

// Barra de Localização Estilo ML
const LocationBar: React.FC<{ address?: string }> = ({ address }) => (
    <div className="bg-gradient-to-r from-yellow-200 via-yellow-100 to-yellow-200 dark:from-slate-800 dark:to-slate-900 px-4 py-2 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 shadow-inner">
        <LocationIcon />
        <span className="truncate">
            {address ? `Enviar para ${address}` : "Informe seu endereço para ver o frete"}
        </span>
    </div>
);

// Drawer de Carrinho (Refinado)
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-md bg-slate-50 dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right">
                <div className="p-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Carrinho
                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-extrabold">{cartItems.length}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cartItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            </div>
                            <p className="font-bold text-slate-600 dark:text-slate-300">Seu carrinho está vazio</p>
                            <p className="text-sm mt-1">Milhares de ofertas esperam por você!</p>
                            <button onClick={onClose} className="mt-6 text-indigo-600 font-bold text-sm hover:underline">Ver ofertas</button>
                        </div>
                    ) : (
                        cartItems.map(item => (
                            <div key={item.cartId} className="flex gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                                <img src={item.image_url || 'https://via.placeholder.com/80'} className="w-20 h-20 rounded-lg object-cover bg-slate-50" alt={item.name} />
                                <div className="flex-1 flex flex-col justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 leading-tight">{item.name}</p>
                                        <p className="text-xs text-slate-500 mt-1">{item.brand}</p>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-base font-bold text-slate-900 dark:text-white">{item.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                                            <button onClick={() => onUpdateQuantity(item.id, -1)} className="px-2 py-1 text-slate-600 hover:text-indigo-600 font-bold">-</button>
                                            <span className="text-xs font-bold px-1 min-w-[20px] text-center">{item.quantity}</span>
                                            <button onClick={() => onUpdateQuantity(item.id, 1)} className="px-2 py-1 text-slate-600 hover:text-indigo-600 font-bold">+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {cartItems.length > 0 && (
                    <div className="p-5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                        <div className="flex justify-between mb-2 text-sm text-slate-500">
                            <span>Produtos</span>
                            <span>{total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                        </div>
                        <div className="flex justify-between mb-6 text-sm text-green-600 font-medium">
                            <span>Frete</span>
                            <span>Grátis</span>
                        </div>
                        <div className="flex justify-between mb-6 items-end">
                            <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                        </div>
                        <button 
                            onClick={onCheckout}
                            disabled={isCheckingOut}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {isCheckingOut ? <LoadingSpinner /> : 'Continuar a compra'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Drawer de Wishlist
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">Favoritos</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                    {wishlistItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <p>Sua lista de desejos está vazia.</p>
                        </div>
                    ) : (
                        wishlistItems.map(item => (
                            <div key={item.id} className="flex gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <img src={item.image_url || 'https://via.placeholder.com/80'} className="w-20 h-20 rounded-lg object-cover" alt={item.name} />
                                <div className="flex-1 flex flex-col justify-between">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2">{item.name}</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{item.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={() => onRemove(item.id)} className="text-xs text-red-500 font-bold px-3 py-1.5 hover:bg-red-50 rounded-lg transition-colors">Excluir</button>
                                        <button onClick={() => onMoveToCart(item)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm active:scale-95 transition-transform">Adicionar</button>
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
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [activeBrand, setActiveBrand] = useState<string | undefined>(undefined);
    const [loadError, setLoadError] = useState<string | null>(null);
    
    // Sort & Filter
    const [sortOption, setSortOption] = useState<'relevance' | 'price_asc' | 'price_desc'>('relevance');
    const [showFilters, setShowFilters] = useState(false);

    // View states
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isWishlistOpen, setIsWishlistOpen] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    // Data Persistance & Sections
    const [cart, setCart] = useState<CartItem[]>([]);
    const [wishlist, setWishlist] = useState<Set<string>>(new Set());
    const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);

    const { addToast } = useToast();

    // --- Effects ---
    useEffect(() => {
        const init = async () => {
            try {
                setIsLoading(true);
                setLoadError(null);
                
                const [productsRes, userRes] = await Promise.all([
                    fetch('/api/products'),
                    supabase.auth.getUser()
                ]);

                if (!productsRes.ok) throw new Error('Erro ao carregar produtos.');
                const productsData = await productsRes.json();
                
                // Enhance products with mocked properties for "Mercado Livre" feel
                const enhanced = productsData.map((p: any) => ({
                    ...p,
                    is_new: new Date(p.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    rating: (Math.random() * 2 + 3).toFixed(1), // Mock rating 3.0 - 5.0
                    reviews_count: Math.floor(Math.random() * 500),
                    is_full: Math.random() > 0.7, // Mock "Full" badge
                    free_shipping: p.price > 79.90
                }));
                
                setProducts(enhanced);

                if (userRes.data.user) {
                    const profile = await getProfile(userRes.data.user.id);
                    if(profile) setUserProfile({ ...profile, id: userRes.data.user.id, email: userRes.data.user.email });
                }

            } catch (e: any) {
                console.error(e);
                setLoadError(e.message || 'Sem conexão.');
            } finally {
                setIsLoading(false);
            }
        };
        init();

        // Local Storage Init
        const savedCart = localStorage.getItem('relp_cart');
        if (savedCart) setCart(JSON.parse(savedCart));
        
        const savedWishlist = localStorage.getItem('relp_wishlist');
        if (savedWishlist) setWishlist(new Set(JSON.parse(savedWishlist)));

        const savedHistory = localStorage.getItem('relp_recent_views');
        if (savedHistory) setRecentlyViewedIds(JSON.parse(savedHistory));

    }, [addToast]);

    useEffect(() => { localStorage.setItem('relp_cart', JSON.stringify(cart)); }, [cart]);
    useEffect(() => { localStorage.setItem('relp_wishlist', JSON.stringify(Array.from(wishlist))); }, [wishlist]);
    useEffect(() => { localStorage.setItem('relp_recent_views', JSON.stringify(recentlyViewedIds)); }, [recentlyViewedIds]);

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
            return [...prev, { ...product, quantity: 1, cartId: Math.random().toString() }];
        });
    };

    const updateCartQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, item.quantity + delta);
                if (newQty === 0) return null;
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

    const handleProductView = (product: Product) => {
        setSelectedProduct(product);
        // Add to history
        setRecentlyViewedIds(prev => {
            const filtered = prev.filter(id => id !== product.id);
            return [product.id, ...filtered].slice(0, 10);
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
        let result = products.filter(p => {
            const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = activeCategory === 'Todos' || (activeCategory === 'Ofertas' ? p.category === 'Ofertas' || p.name.toLowerCase().includes('promo') : p.category === activeCategory);
            const matchesBrand = !activeBrand || activeBrand === 'Todas' || (p.brand && p.brand.toLowerCase() === activeBrand.toLowerCase());
            return matchesSearch && matchesCategory && matchesBrand;
        });

        // Sorting
        if (sortOption === 'price_asc') result.sort((a, b) => a.price - b.price);
        if (sortOption === 'price_desc') result.sort((a, b) => b.price - a.price);
        
        return result;
    }, [products, searchQuery, activeCategory, activeBrand, sortOption]);

    const recentlyViewedProducts = useMemo(() => {
        return recentlyViewedIds.map(id => products.find(p => p.id === id)).filter(Boolean) as Product[];
    }, [recentlyViewedIds, products]);

    // Se um produto estiver selecionado, mostre a tela de detalhes
    if (selectedProduct) {
        return (
            <ProductDetails 
                product={selectedProduct} 
                allProducts={products}
                onBack={() => setSelectedProduct(null)}
                onProductClick={handleProductView}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f5f5] dark:bg-slate-900 pb-24 animate-fade-in font-sans">
            
            {/* 1. Header Fixo */}
            <header className="sticky top-0 z-30 bg-yellow-400 dark:bg-slate-900 shadow-md transition-colors duration-300">
                <div className="max-w-md mx-auto px-4 pt-3 pb-2 space-y-2">
                    <div className="flex justify-between items-center gap-3">
                        <div className="flex-1 relative">
                            <input 
                                type="text" 
                                placeholder="Buscar produtos, marcas e mais..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 rounded-full text-sm text-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-400"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <button onClick={() => setIsCartOpen(true)} className="p-2 relative text-slate-800 dark:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            {cart.length > 0 && <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-yellow-400 dark:border-slate-900">{cart.length}</span>}
                        </button>
                    </div>
                    {/* Location Bar */}
                    <div className="flex items-center text-xs text-slate-800 dark:text-slate-300 pb-1 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="truncate max-w-[250px]">
                            {userProfile?.street_name 
                                ? `Enviar para ${userProfile.first_name} - ${userProfile.street_name}, ${userProfile.street_number}` 
                                : 'Informe seu CEP'}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                </div>
            </header>

            {/* 2. Conteúdo Principal */}
            <main className="max-w-md mx-auto space-y-4">
                
                {!searchQuery && activeCategory === 'Todos' && (
                    <>
                        <div className="bg-gradient-to-b from-yellow-400 to-[#f5f5f5] dark:from-slate-900 dark:to-slate-900 pt-2 pb-6 px-4">
                            <StoreCarousel onBannerClick={(link) => {
                                if (link.startsWith('category:')) setActiveCategory(link.split(':')[1]);
                                else if (link.startsWith('brand:')) setActiveBrand(link.split(':')[1]);
                            }} />
                        </div>
                        
                        <div className="-mt-6 relative z-10 bg-white dark:bg-slate-800 rounded-t-xl shadow-sm mx-4 p-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-full text-blue-600"><TruckIcon /></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">Frete Grátis</p>
                                    <p className="text-[10px] text-slate-500">Em milhões de produtos</p>
                                </div>
                            </div>
                            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-full text-green-600"><BoltIcon /></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">Chega Amanhã</p>
                                    <p className="text-[10px] text-slate-500">Compre agora</p>
                                </div>
                            </div>
                        </div>

                        <CategoryIcons activeCategory={activeCategory} onSelect={setActiveCategory} />
                        <BrandLogos activeBrand={activeBrand} onSelect={setActiveBrand} />
                        
                        {/* Seção Visto Recentemente */}
                        {recentlyViewedProducts.length > 0 && (
                            <section className="px-4">
                                <div className="flex justify-between items-end mb-3">
                                    <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">Visto recentemente</h3>
                                    <button className="text-xs text-blue-600 font-medium">Ver histórico</button>
                                </div>
                                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                                    {recentlyViewedProducts.map(p => (
                                        <div key={`recent-${p.id}`} onClick={() => handleProductView(p)} className="w-32 flex-shrink-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-2 cursor-pointer">
                                            <div className="w-full h-28 flex items-center justify-center mb-2">
                                                <img src={p.image_url} className="max-h-full max-w-full object-contain" alt={p.name} />
                                            </div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">R$ {p.price.toLocaleString('pt-BR', {minimumFractionDigits:0})}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{p.name}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}

                {/* Filtros e Lista de Produtos */}
                <div className="px-4 pb-6">
                    <div className="flex justify-between items-center mb-4 mt-2">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                            {searchQuery ? `Resultados para "${searchQuery}"` : (activeCategory === 'Todos' ? 'Ofertas do Dia' : activeCategory)}
                        </h2>
                        <button onClick={() => setShowFilters(!showFilters)} className="text-xs font-bold text-blue-600 flex items-center gap-1 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-md shadow-sm border border-slate-200 dark:border-slate-700">
                            <FilterIcon /> Filtrar
                        </button>
                    </div>

                    {showFilters && (
                        <div className="mb-4 flex gap-2 animate-fade-in">
                            <button onClick={() => setSortOption('relevance')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${sortOption === 'relevance' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200'}`}>Relevância</button>
                            <button onClick={() => setSortOption('price_asc')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${sortOption === 'price_asc' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200'}`}>Menor Preço</button>
                            <button onClick={() => setSortOption('price_desc')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${sortOption === 'price_desc' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200'}`}>Maior Preço</button>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex justify-center py-20"><LoadingSpinner /></div>
                    ) : loadError ? (
                        <div className="text-center py-20 px-6">
                            <p className="text-slate-500 mb-4">{loadError}</p>
                            <button onClick={() => window.location.reload()} className="text-blue-600 font-bold">Tentar novamente</button>
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {filteredProducts.map(product => (
                                <div 
                                    key={product.id} 
                                    onClick={() => handleProductView(product)}
                                    className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-md transition-shadow relative group"
                                >
                                    <div className="aspect-[4/5] bg-white p-4 relative flex items-center justify-center border-b border-slate-50 dark:border-slate-700">
                                        <img src={product.image_url} alt={product.name} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                        {/* Badges Estilo ML */}
                                        {product.is_full && (
                                            <span className="absolute bottom-2 left-2 bg-[#00a650] text-white text-[9px] font-black italic px-1.5 py-0.5 rounded-sm flex items-center gap-0.5 shadow-sm">
                                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                                                FULL
                                            </span>
                                        )}
                                        {/* Wishlist Heart */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                                            className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-full text-slate-300 hover:text-blue-500 transition-colors shadow-sm"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={wishlist.has(product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} color={wishlist.has(product.id) ? "#3b82f6" : "currentColor"}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                        </button>
                                    </div>

                                    <div className="p-3">
                                        <h3 className="text-xs text-slate-600 dark:text-slate-300 font-normal line-clamp-2 min-h-[32px] leading-tight mb-2">{product.name}</h3>
                                        
                                        <div className="flex flex-col">
                                            {/* Preço Antigo (Fake deal logic) */}
                                            {product.price > 100 && (
                                                <span className="text-[10px] text-slate-400 line-through">R$ {(product.price * 1.2).toLocaleString('pt-BR', {minimumFractionDigits:0})}</span>
                                            )}
                                            
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl font-normal text-slate-900 dark:text-white">R$ {product.price.toLocaleString('pt-BR', {minimumFractionDigits:0})}</span>
                                                {product.price > 100 && <span className="text-[10px] font-bold text-green-600">20% OFF</span>}
                                            </div>
                                            
                                            <span className="text-[10px] font-medium text-green-600 dark:text-green-500 mt-0.5">
                                                em 12x R$ {(product.price / 12).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                                            </span>

                                            {product.free_shipping && (
                                                <span className="text-[10px] font-bold text-green-600 mt-2 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded w-fit">
                                                    Frete Grátis
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <p className="text-slate-500 font-medium">Não encontramos anúncios para sua busca.</p>
                            <p className="text-sm text-slate-400 mt-1">Revise os termos ou tente outra categoria.</p>
                        </div>
                    )}
                </div>
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
