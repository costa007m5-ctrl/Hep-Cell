
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import { useToast } from './Toast';
import Modal from './Modal';
import StoreCarousel from './store/StoreCarousel';
import CategoryIcons from './store/CategoryIcons';
import BrandLogos from './store/BrandLogos';
import ProductDetails from './store/ProductDetails';
import ProductCarousel from './store/ProductCarousel';
import SearchBar from './store/SearchBar';
import CartDrawer from './store/CartDrawer';
import PurchaseModal from './store/PurchaseModal';

// ... (ProductListingView mantido igual ao anterior, omitido para brevidade se não houve mudança lógica nele, mas vou incluir para garantir integridade do arquivo) ...
const ProductListingView: React.FC<{
    title: string;
    products: Product[];
    onBack: () => void;
    onProductClick: (p: Product) => void;
    searchQuery?: string;
    setSearchQuery?: (q: string) => void;
}> = ({ title, products, onBack, onProductClick, searchQuery, setSearchQuery }) => {
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'default'>('default');

    const sortedProducts = useMemo(() => {
        if (sortOrder === 'default') return products;
        return [...products].sort((a, b) => 
            sortOrder === 'asc' ? a.price - b.price : b.price - a.price
        );
    }, [products, sortOrder]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 animate-fade-in-right pb-safe relative z-20">
            <div className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center gap-3 shadow-sm">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {setSearchQuery ? (
                    <div className="flex-1">
                        <SearchBar value={searchQuery || ''} onChange={setSearchQuery} />
                    </div>
                ) : (
                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight truncate flex-1">{title}</h2>
                )}
                <button 
                    onClick={() => setSortOrder(prev => prev === 'default' ? 'asc' : prev === 'asc' ? 'desc' : 'default')}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
                >
                    {sortOrder === 'default' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>}
                    {sortOrder === 'asc' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>}
                    {sortOrder === 'desc' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" transform="rotate(180 12 12)" /></svg>}
                </button>
            </div>
            <div className="p-4">
                <p className="text-xs font-bold text-slate-400 uppercase mb-4 pl-1">
                    {sortedProducts.length} {sortedProducts.length === 1 ? 'Produto' : 'Produtos'} encontrados
                </p>
                {sortedProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum resultado</h3>
                        <p className="text-slate-500 text-sm mt-1">Tente buscar por outro termo ou categoria.</p>
                        <button onClick={onBack} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg">Voltar para Loja</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 pb-24">
                        {sortedProducts.map(p => (
                            <div key={p.id} onClick={() => onProductClick(p)} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]">
                                <div className="aspect-square w-full bg-white rounded-xl mb-3 flex items-center justify-center p-2 relative overflow-hidden">
                                    <img src={p.image_url!} className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                                    {p.promotional_price && (
                                        <span className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded">OFERTA</span>
                                    )}
                                </div>
                                <p className="text-xs font-bold text-slate-700 dark:text-white line-clamp-2 leading-tight h-8">{p.name}</p>
                                <div className="mt-2">
                                    {p.promotional_price ? (
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 line-through">R$ {p.price.toLocaleString('pt-BR')}</span>
                                            <span className="text-sm font-black text-slate-900 dark:text-white">R$ {p.promotional_price.toLocaleString('pt-BR')}</span>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-black text-slate-900 dark:text-white">R$ {p.price.toLocaleString('pt-BR')}</p>
                                    )}
                                    <p className="text-[9px] text-green-600 font-bold mt-0.5">12x sem juros</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const PageLoja: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [banners, setBanners] = useState<any[]>([]);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Navigation States
    const [view, setView] = useState<'home' | 'listing' | 'details'>('home');
    const [listingConfig, setListingConfig] = useState<{ title: string; filter: (p: Product) => boolean; isSearch?: boolean }>({ title: '', filter: () => true });
    
    // Search
    const [searchQuery, setSearchQuery] = useState('');
    
    // Selection
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [activeBrand, setActiveBrand] = useState<string | undefined>(undefined);
    
    // Cart
    const [cart, setCart] = useState<Product[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [productToBuy, setProductToBuy] = useState<Product | null>(null);
    
    // Address Modal
    const [showCepModal, setShowCepModal] = useState(false);
    const [newCep, setNewCep] = useState('');
    const [tempAddress, setTempAddress] = useState({ street: '', neighborhood: '', city: '', uf: '', number: '', complement: '' });
    const [isUpdatingCep, setIsUpdatingCep] = useState(false);
    const numberInputRef = useRef<HTMLInputElement>(null);

    const { addToast } = useToast();

    // Listeners
    useEffect(() => {
        const openCart = () => setIsCartOpen(true);
        window.addEventListener('open-cart', openCart);
        return () => window.removeEventListener('open-cart', openCart);
    }, []);

    // Initial Fetch
    useEffect(() => {
        const init = async () => {
            try {
                const [productsRes, bannersRes, userRes] = await Promise.all([
                    fetch('/api/products'),
                    fetch('/api/admin?action=banners'),
                    supabase.auth.getUser()
                ]);
                
                const productsData = await productsRes.json();
                const bannersData = await bannersRes.json();
                
                const enrichedProducts = Array.isArray(productsData) ? productsData.map((p: any) => ({
                    ...p,
                    price: Number(p.price),
                    promotional_price: p.promotional_price ? Number(p.promotional_price) : null,
                    weight: p.weight || 500,
                    is_full: p.price > 1000, 
                    free_shipping: p.price > 200,
                })) : [];

                setProducts(enrichedProducts);
                if (Array.isArray(bannersData)) setBanners(bannersData);
                
                if (userRes.data.user) {
                    const profile = await getProfile(userRes.data.user.id);
                    if(profile) {
                        setUserProfile({ ...profile, id: userRes.data.user.id });
                        if (profile.zip_code) {
                            setTempAddress({
                                street: profile.street_name || '', neighborhood: profile.neighborhood || '',
                                city: profile.city || '', uf: profile.federal_unit || '', number: profile.street_number || '', complement: ''
                            });
                        }
                    }
                }
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        init();
    }, []);

    // Handlers
    const navigateToProduct = (p: Product) => {
        setSelectedProduct(p);
    };

    const navigateToListing = (title: string, filterFn: (p: Product) => boolean, isSearch = false) => {
        setListingConfig({ title, filter: filterFn, isSearch });
        if (isSearch) setSearchQuery('');
        setView('listing');
    };

    const handleSearchInput = (q: string) => {
        setSearchQuery(q);
        if (view === 'home' && q.trim().length > 0) {
            navigateToListing("Busca", (p) => true, true);
        }
    };

    const handleBannerClick = (link: string) => {
        if (!link) return;
        
        if (link.startsWith('category:')) {
            const cat = link.split(':')[1];
            navigateToListing(cat, (p) => p.category === cat);
        } else if (link.startsWith('collection:')) {
            const col = link.split(':')[1];
            if (col === 'Ofertas') navigateToListing('Ofertas Especiais', (p) => !!p.promotional_price);
            else navigateToListing(col, (p) => p.name.includes(col) || p.description?.includes(col) || false);
        } else if (link.startsWith('brand:')) {
            const brand = link.split(':')[1];
            navigateToListing(brand, (p) => p.brand === brand);
        } else {
            navigateToListing(link, (p) => p.name.toLowerCase().includes(link.toLowerCase()));
        }
    };

    // Derived Data for Home (UPDATED LOGIC WITH TYPES)
    const bannerGroups = useMemo(() => {
        const defaultBanners = [
            { id: 'fb1', image_url: 'https://images.unsplash.com/photo-1603539278276-8f328406450f', prompt: 'Acessórios', link: 'category:Acessórios', position: 'hero' },
            { id: 'fb2', image_url: 'https://images.unsplash.com/photo-1595942472934-400890209c73', prompt: 'Moda Tech', link: 'collection:Novidades', position: 'slim' }
        ];
        
        const all = banners.length > 0 ? banners.filter(b => b.active) : defaultBanners;
        
        return {
            hero: all.filter(b => b.position === 'hero' || !b.position), // Default to hero if no position
            mid: all.filter(b => b.position === 'slim'),
            bottom: all.filter(b => b.position === 'grid')
        };
    }, [banners]);

    const offers = useMemo(() => products.filter(p => p.promotional_price), [products]);
    const bestSellers = useMemo(() => products.slice(0, 5), [products]);
    const recent = useMemo(() => products.slice(5, 15), [products]);
    const accessories = useMemo(() => products.filter(p => p.category === 'Acessórios' || p.price < 200).slice(0, 10), [products]);

    // Cart Logic
    const addToCart = (product: Product) => {
        setCart([...cart, product]);
        addToast(`${product.name} adicionado!`, "success");
    };
    const removeFromCart = (index: number) => setCart(prev => prev.filter((_, i) => i !== index));
    const handleCheckoutFromCart = () => {
        if (cart.length === 0) return;
        setProductToBuy(cart[0]); 
        setIsCartOpen(false);
    };

    // Address Logic
    const handleLookupCep = async (cep: string) => {
        setIsUpdatingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (data.erro) throw new Error("CEP não encontrado");
            if (data.uf !== 'AP') throw new Error("A Relp Cell atende exclusivamente o estado do Amapá.");
            setTempAddress(prev => ({ ...prev, street: data.logradouro, neighborhood: data.bairro, city: data.localidade, uf: data.uf }));
            setTimeout(() => numberInputRef.current?.focus(), 100);
        } catch (e: any) { addToast(e.message, "error"); setNewCep(''); } finally { setIsUpdatingCep(false); }
    };
    useEffect(() => {
        const cleanCep = newCep.replace(/\D/g, '');
        if (cleanCep.length === 8) handleLookupCep(cleanCep);
    }, [newCep]);
    const handleConfirmLocation = async () => {
        if (!tempAddress.number) { addToast("Informe o número.", "error"); return; }
        setIsUpdatingCep(true);
        try {
            const finalAddress = { zip_code: newCep.replace(/\D/g, ''), street_name: tempAddress.street, street_number: tempAddress.number, neighborhood: tempAddress.neighborhood, city: tempAddress.city, federal_unit: tempAddress.uf };
            if (userProfile) {
                const updated = { ...userProfile, ...finalAddress };
                await updateProfile(updated);
                setUserProfile(updated);
            }
            addToast("Endereço atualizado!", "success");
            setShowCepModal(false);
        } catch (e) { addToast("Erro ao salvar.", "error"); } finally { setIsUpdatingCep(false); }
    };

    // --- RENDER ---

    if (selectedProduct) {
        return (
            <ProductDetails 
                product={selectedProduct} 
                allProducts={products} 
                userProfile={userProfile} 
                onBack={() => setSelectedProduct(null)} 
                onProductClick={navigateToProduct} 
            />
        );
    }

    if (view === 'listing') {
        const filteredProducts = products.filter(p => {
            if (listingConfig.isSearch && searchQuery) {
                const q = searchQuery.toLowerCase();
                return p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
            }
            return listingConfig.filter(p);
        });

        return (
            <ProductListingView 
                title={listingConfig.title}
                products={filteredProducts}
                onBack={() => { setView('home'); setSearchQuery(''); }}
                onProductClick={navigateToProduct}
                searchQuery={listingConfig.isSearch ? searchQuery : undefined}
                setSearchQuery={listingConfig.isSearch ? setSearchQuery : undefined}
            />
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans animate-fade-in">
            {/* Header Amarelo/Indigo */}
            <header className="sticky top-0 z-30 bg-indigo-600 shadow-md">
                <div className="max-w-md mx-auto px-4 pt-3 pb-2 space-y-2">
                    {/* Barra de Busca */}
                    <div className="flex gap-3 items-center">
                        <div className="flex-1">
                            <SearchBar value={searchQuery} onChange={handleSearchInput} />
                        </div>
                        <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            {cart.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-indigo-600">{cart.length}</span>}
                        </button>
                    </div>
                    
                    {/* Barra de Endereço */}
                    <button onClick={() => setShowCepModal(true)} className="flex items-center gap-1.5 py-1 px-1 max-w-full hover:bg-white/10 rounded transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <div className="flex flex-col items-start truncate">
                            <span className="text-[10px] text-white/70 leading-none">Enviar para {userProfile?.first_name || 'Visitante'}</span>
                            <span className="text-[11px] text-white font-medium truncate leading-tight w-full text-left">{tempAddress.street ? `${tempAddress.street}, ${tempAddress.number}` : 'Informe seu CEP para ver prazos'}</span>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white/50 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </header>

            <main className="max-w-md mx-auto">
                {/* 1. HERO CAROUSEL */}
                <div className="bg-gradient-to-b from-indigo-600 to-indigo-500 pb-12 pt-2 px-4 rounded-b-[2rem] shadow-sm mb-[-40px]">
                    <StoreCarousel variant="hero" bannersData={bannerGroups.hero} onBannerClick={handleBannerClick} />
                </div>

                {/* 2. CATEGORIAS (Navegáveis) */}
                <div className="relative px-2 mb-4">
                    <CategoryIcons activeCategory="none" onSelect={(cat) => navigateToListing(cat, (p) => p.category === cat)} />
                </div>

                <div className="space-y-4">
                    {/* 3. OFERTAS */}
                    {offers.length > 0 && (
                        <ProductCarousel 
                            title="Ofertas Relâmpago" 
                            products={offers} 
                            onProductClick={navigateToProduct} 
                            linkText="Ver tudo"
                            onLinkClick={() => navigateToListing("Ofertas", (p) => !!p.promotional_price)}
                            variant="default"
                        />
                    )}

                    {/* 4. BANNER SLIM */}
                    {bannerGroups.mid.length > 0 && (
                        <div className="py-2">
                            <StoreCarousel variant="slim" bannersData={bannerGroups.mid} onBannerClick={handleBannerClick} />
                        </div>
                    )}

                    {/* 5. MARCAS */}
                    <div className="bg-white dark:bg-slate-900 py-3 border-y border-slate-100 dark:border-slate-800">
                        <BrandLogos activeBrand={undefined} onSelect={(brand) => navigateToListing(brand, (p) => p.brand === brand)} />
                    </div>

                    {/* 6. MAIS VENDIDOS */}
                    <ProductCarousel 
                        title="Destaques da Semana" 
                        products={bestSellers} 
                        onProductClick={navigateToProduct}
                        variant="large"
                    />

                    {/* 7. COLEÇÕES (BANNERS CLICKABLE) */}
                    {bannerGroups.bottom.length > 0 && (
                        <div className="mt-4">
                            <h2 className="px-4 text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Coleções</h2>
                            <StoreCarousel variant="grid" bannersData={bannerGroups.bottom} onBannerClick={handleBannerClick} />
                        </div>
                    )}

                    {/* 8. ACESSÓRIOS */}
                    {accessories.length > 0 && (
                        <ProductCarousel 
                            title="Acessórios Essenciais" 
                            products={accessories} 
                            onProductClick={navigateToProduct}
                            linkText="Ver mais"
                            onLinkClick={() => navigateToListing("Acessórios", (p) => p.category === 'Acessórios')}
                            variant="compact"
                        />
                    )}

                    {/* 9. RECOMENDADOS */}
                    <div className="px-4 py-4 pb-12">
                        <h2 className="text-base font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tight">Sugestões para você</h2>
                        {isLoading ? <div className="flex justify-center"><LoadingSpinner /></div> : (
                            <div className="grid grid-cols-2 gap-3">
                                {recent.map(p => (
                                    <div key={p.id} onClick={() => navigateToProduct(p)} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer group hover:-translate-y-1 transition-transform duration-300">
                                        <div className="relative w-full h-40 bg-white flex items-center justify-center p-4">
                                            <img src={p.image_url!} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300 mix-blend-multiply" />
                                            {p.promotional_price && <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">Promo</span>}
                                        </div>
                                        <div className="p-3 border-t border-slate-50 dark:border-slate-700">
                                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 h-8 mb-1 leading-tight font-medium">{p.name}</p>
                                            <p className="text-base font-black text-slate-900 dark:text-white">R$ {p.price.toLocaleString('pt-BR')}</p>
                                            <p className="text-[10px] text-green-600 font-bold">12x R$ {(p.price/12).toFixed(2).replace('.', ',')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Modais */}
            <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cart} onRemoveItem={removeFromCart} onCheckout={handleCheckoutFromCart} />
            {productToBuy && userProfile && (
                <PurchaseModal product={productToBuy} profile={userProfile} onClose={() => setProductToBuy(null)} onSuccess={() => { setProductToBuy(null); setCart([]); addToast("Compra realizada!", "success"); }} />
            )}
            <Modal isOpen={showCepModal} onClose={() => setShowCepModal(false)}>
                <div className="space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Onde você está?</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">CEP (Amapá)</label>
                            <input type="text" value={newCep} onChange={e => setNewCep(e.target.value)} className="w-full p-4 text-2xl font-black text-center bg-slate-100 dark:bg-slate-700 rounded-2xl outline-none" placeholder="00000-000" maxLength={9} />
                            {isUpdatingCep && <div className="absolute right-4 top-10"><LoadingSpinner /></div>}
                        </div>
                        {tempAddress.street && (
                            <div className="space-y-4 animate-fade-in-up">
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100">
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{tempAddress.street}</p>
                                    <p className="text-xs text-slate-500">{tempAddress.neighborhood}, {tempAddress.city}</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 ml-1">Número</label>
                                    <input ref={numberInputRef} type="text" value={tempAddress.number} onChange={e => setTempAddress({...tempAddress, number: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-800 border rounded-xl" placeholder="Ex: 123" />
                                </div>
                                <button onClick={handleConfirmLocation} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Confirmar Localização</button>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PageLoja;
