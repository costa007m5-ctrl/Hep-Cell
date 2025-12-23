
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

const PageLoja: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [banners, setBanners] = useState<any[]>([]);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [activeBrand, setActiveBrand] = useState<string | undefined>(undefined);
    
    // Estados do Carrinho e Compra
    const [cart, setCart] = useState<Product[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [productToBuy, setProductToBuy] = useState<Product | null>(null);
    
    const [showCepModal, setShowCepModal] = useState(false);
    
    // Endereço
    const [newCep, setNewCep] = useState('');
    const [tempAddress, setTempAddress] = useState({
        street: '', neighborhood: '', city: '', uf: '', number: '', complement: ''
    });
    const [isUpdatingCep, setIsUpdatingCep] = useState(false);
    const numberInputRef = useRef<HTMLInputElement>(null);

    const { addToast } = useToast();

    useEffect(() => {
        const openCart = () => setIsCartOpen(true);
        window.addEventListener('open-cart', openCart);
        return () => window.removeEventListener('open-cart', openCart);
    }, []);

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
                
                // Normaliza dados de produtos
                const enrichedProducts = Array.isArray(productsData) ? productsData.map((p: any) => ({
                    ...p,
                    price: Number(p.price),
                    promotional_price: p.promotional_price ? Number(p.promotional_price) : null,
                    weight: p.weight || 500,
                    is_full: p.price > 1000, 
                    free_shipping: p.price > 200,
                })) : [];

                setProducts(enrichedProducts);
                
                if (Array.isArray(bannersData)) {
                    setBanners(bannersData);
                }
                
                if (userRes.data.user) {
                    const profile = await getProfile(userRes.data.user.id);
                    if(profile) {
                        setUserProfile({ ...profile, id: userRes.data.user.id });
                        if (profile.zip_code) {
                            setTempAddress({
                                street: profile.street_name || '',
                                neighborhood: profile.neighborhood || '',
                                city: profile.city || '',
                                uf: profile.federal_unit || '',
                                number: profile.street_number || '',
                                complement: ''
                            });
                        }
                    }
                }
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        init();
    }, []);

    // Lógica de distribuição de banners
    // Divide os banners em grupos para espalhar pela loja
    const bannerGroups = useMemo(() => {
        // Fallbacks se não tiver banners suficientes
        const defaultBanners = [
            { id: 'fb1', image_url: 'https://images.unsplash.com/photo-1603539278276-8f328406450f?auto=format&fit=crop&w=1200&q=80', prompt: 'Acessórios', link: '' },
            { id: 'fb2', image_url: 'https://images.unsplash.com/photo-1595942472934-400890209c73?auto=format&fit=crop&w=1200&q=80', prompt: 'Moda Tech', link: '' },
            { id: 'fb3', image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80', prompt: 'Celulares', link: '' },
            { id: 'fb4', image_url: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=800&q=80', prompt: 'Eletrônicos', link: '' }
        ];
        
        const all = banners.length > 0 ? banners : defaultBanners;
        
        return {
            hero: all.slice(0, 3), // Primeiros 3 para o topo
            mid: all.slice(3, 4).length > 0 ? all.slice(3, 4) : [defaultBanners[0]], // 1 para o meio
            bottom: all.slice(4, 6).length > 0 ? all.slice(4, 6) : defaultBanners.slice(2, 4) // 2 para o grid final
        };
    }, [banners]);

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
            const finalAddress = {
                zip_code: newCep.replace(/\D/g, ''),
                street_name: tempAddress.street,
                street_number: tempAddress.number,
                neighborhood: tempAddress.neighborhood,
                city: tempAddress.city,
                federal_unit: tempAddress.uf,
            };
            if (userProfile) {
                const updated = { ...userProfile, ...finalAddress };
                await updateProfile(updated);
                setUserProfile(updated);
            }
            addToast("Endereço atualizado!", "success");
            setShowCepModal(false);
        } catch (e) { addToast("Erro ao salvar.", "error"); } finally { setIsUpdatingCep(false); }
    };

    // Lógica de Filtros
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
            const matchesBrand = !activeBrand || activeBrand === 'Todas' || (p.brand && p.brand.toLowerCase() === activeBrand.toLowerCase());
            return matchesSearch && matchesCategory && matchesBrand;
        });
    }, [products, searchQuery, activeCategory, activeBrand]);

    // Separação de produtos
    const offers = useMemo(() => products.filter(p => p.promotional_price), [products]);
    const bestSellers = useMemo(() => products.slice(0, 5), [products]);
    const recent = useMemo(() => products.slice(5, 15), [products]);
    const accessories = useMemo(() => products.filter(p => p.category === 'Acessórios' || p.price < 200).slice(0, 10), [products]);

    // Carrinho
    const addToCart = (product: Product) => {
        setCart([...cart, product]);
        addToast(`${product.name} adicionado!`, "success");
    };

    const removeFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const handleCheckoutFromCart = () => {
        if (cart.length === 0) return;
        setProductToBuy(cart[0]); 
        setIsCartOpen(false);
    };

    const handleBannerClick = (link: string) => {
        if (link && link.startsWith('category:')) {
            const cat = link.split(':')[1];
            setActiveCategory(cat);
            setSearchQuery(cat);
        }
    };

    if (selectedProduct) {
        return (
            <ProductDetails 
                product={selectedProduct} 
                allProducts={products} 
                userProfile={userProfile} 
                onBack={() => setSelectedProduct(null)} 
                onProductClick={setSelectedProduct} 
            />
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24 font-sans animate-fade-in">
            {/* Header Amarelo/Indigo */}
            <header className="sticky top-0 z-30 bg-indigo-600 shadow-md">
                <div className="max-w-md mx-auto px-4 pt-3 pb-2 space-y-2">
                    {/* Barra de Busca */}
                    <div className="flex gap-3 items-center">
                        <div className="flex-1">
                            <SearchBar value={searchQuery} onChange={setSearchQuery} />
                        </div>
                        <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            {cart.length > 0 && (
                                <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-indigo-600">
                                    {cart.length}
                                </span>
                            )}
                        </button>
                    </div>
                    
                    {/* Barra de Endereço */}
                    <button 
                        onClick={() => setShowCepModal(true)}
                        className="flex items-center gap-1.5 py-1 px-1 max-w-full hover:bg-white/10 rounded transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <div className="flex flex-col items-start truncate">
                            <span className="text-[10px] text-white/70 leading-none">Enviar para {userProfile?.first_name || 'Visitante'}</span>
                            <span className="text-[11px] text-white font-medium truncate leading-tight w-full text-left">
                                {tempAddress.street ? `${tempAddress.street}, ${tempAddress.number}` : 'Informe seu CEP para ver prazos'}
                            </span>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white/50 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </header>

            <main className="max-w-md mx-auto">
                {/* BUSCA ATIVA */}
                {searchQuery ? (
                    <div className="p-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-sm font-bold text-slate-500 uppercase">
                                Resultados ({filteredProducts.length})
                            </h2>
                            <button onClick={() => setSearchQuery('')} className="text-xs text-indigo-600 font-bold">Limpar</button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {filteredProducts.map(p => (
                                <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-3 cursor-pointer hover:shadow-md transition-all">
                                    <img src={p.image_url!} className="w-full h-32 object-contain mb-2 mix-blend-multiply dark:mix-blend-normal" />
                                    <p className="text-xs font-medium text-slate-700 dark:text-white line-clamp-2 leading-tight">{p.name}</p>
                                    <div className="mt-2">
                                        <p className="font-black text-slate-900 dark:text-white">R$ {p.price.toLocaleString('pt-BR')}</p>
                                        <p className="text-[9px] text-slate-400">12x sem juros</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* 1. HERO CAROUSEL (Topo) */}
                        <div className="bg-gradient-to-b from-indigo-600 to-indigo-500 pb-12 pt-2 px-4 rounded-b-[2rem] shadow-sm mb-[-40px]">
                            <StoreCarousel variant="hero" bannersData={bannerGroups.hero} onBannerClick={handleBannerClick} />
                        </div>

                        {/* 2. CATEGORIAS */}
                        <div className="relative px-2 mb-4">
                            <CategoryIcons activeCategory={activeCategory} onSelect={(cat) => { setActiveCategory(cat); if(cat !== 'Todos') setSearchQuery(''); }} />
                        </div>

                        {activeCategory === 'Todos' ? (
                            <div className="space-y-4">
                                
                                {/* 3. OFERTAS (Carrossel Padrão) */}
                                {offers.length > 0 && (
                                    <ProductCarousel 
                                        title="Ofertas Relâmpago" 
                                        products={offers} 
                                        onProductClick={setSelectedProduct} 
                                        linkText="Ver tudo"
                                        variant="default"
                                    />
                                )}

                                {/* 4. BANNER SLIM (Meio) */}
                                <div className="py-2">
                                    <StoreCarousel variant="slim" bannersData={bannerGroups.mid} onBannerClick={handleBannerClick} />
                                </div>

                                {/* 5. MARCAS */}
                                <div className="bg-white dark:bg-slate-900 py-3 border-y border-slate-100 dark:border-slate-800">
                                    <BrandLogos activeBrand={activeBrand} onSelect={setActiveBrand} />
                                </div>

                                {/* 6. MAIS VENDIDOS (Carrossel Large) */}
                                <ProductCarousel 
                                    title="Destaques da Semana" 
                                    products={bestSellers} 
                                    onProductClick={setSelectedProduct}
                                    variant="large"
                                />

                                {/* 7. BANNERS MOSAICO (Fundo) */}
                                <div className="mt-4">
                                    <h2 className="px-4 text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Coleções</h2>
                                    <StoreCarousel variant="grid" bannersData={bannerGroups.bottom} onBannerClick={handleBannerClick} />
                                </div>

                                {/* 8. ACESSÓRIOS (Carrossel Compacto) */}
                                {accessories.length > 0 && (
                                    <ProductCarousel 
                                        title="Acessórios Essenciais" 
                                        products={accessories} 
                                        onProductClick={setSelectedProduct}
                                        variant="compact"
                                    />
                                )}

                                {/* 9. RECOMENDADOS (Grid Final) */}
                                <div className="px-4 py-4 pb-12">
                                    <h2 className="text-base font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tight">Sugestões para você</h2>
                                    {isLoading ? <div className="flex justify-center"><LoadingSpinner /></div> : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {recent.map(p => (
                                                <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer group hover:-translate-y-1 transition-transform duration-300">
                                                    <div className="relative w-full h-40 bg-white flex items-center justify-center p-4">
                                                        <img src={p.image_url!} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" />
                                                        {p.free_shipping && <span className="absolute bottom-2 left-2 bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">Frete Grátis</span>}
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
                        ) : (
                            <div className="p-4 pt-12 text-center text-slate-500">
                                <p>Filtrando por {activeCategory}...</p>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Modais */}
            <CartDrawer 
                isOpen={isCartOpen} 
                onClose={() => setIsCartOpen(false)} 
                cart={cart} 
                onRemoveItem={removeFromCart} 
                onCheckout={handleCheckoutFromCart} 
            />

            {productToBuy && userProfile && (
                <PurchaseModal 
                    product={productToBuy} 
                    profile={userProfile} 
                    onClose={() => setProductToBuy(null)} 
                    onSuccess={() => {
                        setProductToBuy(null);
                        setCart([]); 
                        addToast("Compra realizada com sucesso!", "success");
                    }} 
                />
            )}

            <Modal isOpen={showCepModal} onClose={() => setShowCepModal(false)}>
                <div className="space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
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
