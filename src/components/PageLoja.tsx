
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

const PageLoja: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [activeBrand, setActiveBrand] = useState<string | undefined>(undefined);
    
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showCepModal, setShowCepModal] = useState(false);
    
    // Estados do Endereço
    const [newCep, setNewCep] = useState('');
    const [tempAddress, setTempAddress] = useState({
        street: '',
        neighborhood: '',
        city: '',
        uf: '',
        number: '',
        complement: ''
    });
    const [isUpdatingCep, setIsUpdatingCep] = useState(false);
    const numberInputRef = useRef<HTMLInputElement>(null);

    const { addToast } = useToast();

    useEffect(() => {
        const init = async () => {
            try {
                const [productsRes, userRes] = await Promise.all([
                    fetch('/api/products'),
                    supabase.auth.getUser()
                ]);
                const productsData = await productsRes.json();
                
                // Mock de dados para visualização rica se faltar no banco
                const enrichedProducts = productsData.map((p: any) => ({
                    ...p,
                    weight: p.weight || 500,
                    is_full: p.price > 1000, // Simula produto "Full"
                    free_shipping: p.price > 200,
                    promotional_price: Math.random() > 0.7 ? p.price * 0.9 : null // Simula promoção em 30% dos itens
                }));

                setProducts(enrichedProducts);
                
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

    // Busca automática CEP
    useEffect(() => {
        const cleanCep = newCep.replace(/\D/g, '');
        if (cleanCep.length === 8) handleLookupCep(cleanCep);
    }, [newCep]);

    const handleLookupCep = async (cep: string) => {
        setIsUpdatingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            
            if (data.erro) throw new Error("CEP não encontrado");
            if (data.uf !== 'AP') throw new Error("A Relp Cell atende exclusivamente o estado do Amapá.");
            
            setTempAddress(prev => ({
                ...prev,
                street: data.logradouro,
                neighborhood: data.bairro,
                city: data.localidade,
                uf: data.uf
            }));
            setTimeout(() => numberInputRef.current?.focus(), 100);
        } catch (e: any) {
            addToast(e.message, "error");
            setNewCep('');
        } finally { setIsUpdatingCep(false); }
    };

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

    // Filtros e Categorias
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
            const matchesBrand = !activeBrand || activeBrand === 'Todas' || (p.brand && p.brand.toLowerCase() === activeBrand.toLowerCase());
            return matchesSearch && matchesCategory && matchesBrand;
        });
    }, [products, searchQuery, activeCategory, activeBrand]);

    // Separação por seções (simulada)
    const offers = useMemo(() => products.filter(p => p.promotional_price), [products]);
    const bestSellers = useMemo(() => products.slice(0, 8), [products]); // Pegaria do backend em app real
    const recent = useMemo(() => products.slice(8, 16), [products]);

    if (selectedProduct) {
        return <ProductDetails product={selectedProduct} allProducts={products} userProfile={userProfile} onBack={() => setSelectedProduct(null)} onProductClick={setSelectedProduct} />;
    }

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24 font-sans animate-fade-in">
            {/* Header Amarelo/Indigo estilo ML */}
            <header className="sticky top-0 z-30 bg-indigo-600 shadow-md">
                <div className="max-w-md mx-auto px-4 pt-3 pb-2 space-y-2">
                    {/* Barra de Busca */}
                    <div className="flex gap-3 items-center">
                        <SearchBar value={searchQuery} onChange={setSearchQuery} />
                        <button onClick={() => window.dispatchEvent(new Event('open-cart'))} className="relative p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
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
                {/* Se estiver buscando, mostra grid direto */}
                {searchQuery ? (
                    <div className="p-4">
                        <h2 className="text-sm font-bold text-slate-500 mb-4 uppercase">Resultados da busca</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {filteredProducts.map(p => (
                                <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 p-3 cursor-pointer">
                                    <img src={p.image_url!} className="w-full h-32 object-contain mb-2" />
                                    <p className="text-xs text-slate-700 dark:text-white line-clamp-2">{p.name}</p>
                                    <p className="font-bold text-slate-900 dark:text-white mt-1">R$ {p.price.toLocaleString('pt-BR')}</p>
                                </div>
                            ))}
                        </div>
                        {filteredProducts.length === 0 && <div className="text-center py-10 text-slate-400">Nenhum produto encontrado.</div>}
                    </div>
                ) : (
                    <>
                        {/* Conteúdo Principal Organizado */}
                        <div className="bg-gradient-to-b from-indigo-600 to-indigo-500 pb-12 pt-2 px-4 rounded-b-[2rem] shadow-sm mb-[-40px]">
                            <StoreCarousel />
                        </div>

                        {/* Ícones de Categoria Flutuantes */}
                        <div className="relative px-2 mb-2">
                            <CategoryIcons activeCategory={activeCategory} onSelect={setActiveCategory} />
                        </div>

                        {activeCategory === 'Todos' ? (
                            <div className="space-y-2">
                                {/* Seção de Ofertas */}
                                {offers.length > 0 && (
                                    <ProductCarousel 
                                        title="Ofertas do Dia" 
                                        products={offers} 
                                        onProductClick={setSelectedProduct} 
                                        linkText="Ver todas"
                                    />
                                )}

                                {/* Seção Marcas */}
                                <div className="bg-white dark:bg-slate-900 py-2 border-y border-slate-100 dark:border-slate-800 my-4">
                                    <BrandLogos activeBrand={activeBrand} onSelect={setActiveBrand} />
                                </div>

                                {/* Mais Vendidos */}
                                <ProductCarousel 
                                    title="Mais Vendidos" 
                                    products={bestSellers} 
                                    onProductClick={setSelectedProduct} 
                                />

                                {/* Grid "Você pode gostar" */}
                                <div className="px-4 py-4">
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-3">Você pode gostar</h2>
                                    {isLoading ? <div className="flex justify-center"><LoadingSpinner /></div> : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {recent.map(p => (
                                                <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden cursor-pointer group">
                                                    <div className="relative w-full h-40 bg-white flex items-center justify-center p-4 border-b border-slate-50">
                                                        <img src={p.image_url!} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" />
                                                        {p.free_shipping && <span className="absolute bottom-2 left-2 bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded">Frete Grátis</span>}
                                                    </div>
                                                    <div className="p-3">
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 h-8 mb-1 leading-tight">{p.name}</p>
                                                        <p className="text-base font-bold text-slate-900 dark:text-white">R$ {p.price.toLocaleString('pt-BR')}</p>
                                                        <p className="text-[10px] text-green-600 font-medium">12x R$ {(p.price/12).toFixed(2).replace('.', ',')}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            // Grid de Categoria Específica
                            <div className="p-4 grid grid-cols-2 gap-3 pt-12">
                                {filteredProducts.map(p => (
                                    <div key={p.id} onClick={() => setSelectedProduct(p)} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-3 border border-slate-100">
                                        <img src={p.image_url!} className="w-full h-32 object-contain mb-2" />
                                        <p className="text-xs font-bold">{p.name}</p>
                                        <p className="text-sm font-black text-indigo-600 mt-1">R$ {p.price.toLocaleString('pt-BR')}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Modal de Endereço (Mantido Lógica Original) */}
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
