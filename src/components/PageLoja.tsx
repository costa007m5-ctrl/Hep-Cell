
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Profile, Tab } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import { useToast } from './Toast';
import Modal from './Modal';
import Logo from './Logo';
import StoreCarousel from './store/StoreCarousel';
import CategoryIcons from './store/CategoryIcons';
import BrandLogos from './store/BrandLogos';
import ProductDetails from './store/ProductDetails';

const TruckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" /></svg>;
const BoltIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>;

const PageLoja: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [activeBrand, setActiveBrand] = useState<string | undefined>(undefined);
    
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showCepModal, setShowCepModal] = useState(false);
    
    // Estados do Endereço no Modal
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
                
                const enrichedProducts = productsData.map((p: any) => ({
                    ...p,
                    weight: p.weight || 500,
                    height: p.height || 15,
                    width: p.width || 10,
                    length: p.length || 5,
                    is_full: Math.random() > 0.7,
                    free_shipping: p.price > 79.90
                }));

                setProducts(enrichedProducts);
                if (userRes.data.user) {
                    const profile = await getProfile(userRes.data.user.id);
                    if(profile) setUserProfile({ ...profile, id: userRes.data.user.id });
                }
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        init();
    }, []);

    // Busca automática ao digitar o CEP
    useEffect(() => {
        const cleanCep = newCep.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            handleLookupCep(cleanCep);
        } else {
            setTempAddress({ street: '', neighborhood: '', city: '', uf: '', number: '', complement: '' });
        }
    }, [newCep]);

    const handleLookupCep = async (cep: string) => {
        setIsUpdatingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            
            if (data.erro) throw new Error("CEP não encontrado");
            if (data.uf !== 'AP') throw new Error("Entregamos apenas no Amapá.");
            
            const allowedCities = ['Macapá', 'Santana'];
            if (!allowedCities.includes(data.localidade)) {
                throw new Error("Entregamos apenas em Macapá e Santana.");
            }
            
            setTempAddress(prev => ({
                ...prev,
                street: data.logradouro,
                neighborhood: data.bairro,
                city: data.localidade,
                uf: data.uf
            }));

            // Foca no campo de número após carregar o endereço
            setTimeout(() => numberInputRef.current?.focus(), 100);

        } catch (e: any) {
            addToast(e.message || "Erro ao buscar CEP", "error");
            setNewCep('');
        } finally { setIsUpdatingCep(false); }
    };

    const handleConfirmLocation = async () => {
        if (!tempAddress.number) {
            addToast("Por favor, informe o número da residência.", "error");
            return;
        }

        setIsUpdatingCep(true);
        try {
            const finalAddress = {
                zip_code: newCep.replace(/\D/g, ''),
                street_name: tempAddress.street,
                street_number: tempAddress.number,
                neighborhood: tempAddress.neighborhood,
                city: tempAddress.city,
                federal_unit: tempAddress.uf,
                // Opcionalmente você pode adicionar o campo complement ao seu tipo Profile
            };

            if (userProfile) {
                const updated = { ...userProfile, ...finalAddress };
                await updateProfile(updated);
                setUserProfile(updated);
            } else {
                sessionStorage.setItem('relp_temp_location', JSON.stringify(finalAddress));
            }

            addToast("Localização salva com sucesso!", "success");
            setShowCepModal(false);
        } catch (e: any) {
            addToast("Erro ao salvar localização.", "error");
        } finally { setIsUpdatingCep(false); }
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
            const matchesBrand = !activeBrand || activeBrand === 'Todas' || (p.brand && p.brand.toLowerCase() === activeBrand.toLowerCase());
            return matchesSearch && matchesCategory && matchesBrand;
        });
    }, [products, searchQuery, activeCategory, activeBrand]);

    if (selectedProduct) {
        return <ProductDetails product={selectedProduct} allProducts={products} onBack={() => setSelectedProduct(null)} onProductClick={setSelectedProduct} />;
    }

    return (
        <div className="min-h-screen bg-[#f5f5f5] dark:bg-slate-900 pb-24 animate-fade-in font-sans">
            <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-md mx-auto px-4 py-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <Logo className="h-8 w-8" showText={true} />
                        <div 
                            onClick={() => {
                                if (userProfile?.zip_code) {
                                    setNewCep(userProfile.zip_code);
                                    setTempAddress({
                                        street: userProfile.street_name || '',
                                        neighborhood: userProfile.neighborhood || '',
                                        city: userProfile.city || '',
                                        uf: userProfile.federal_unit || '',
                                        number: userProfile.street_number || '',
                                        complement: ''
                                    });
                                }
                                setShowCepModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full cursor-pointer hover:bg-slate-200 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                                {userProfile?.zip_code ? `${userProfile.city}, ${userProfile.federal_unit}` : 'Informe seu CEP'}
                            </span>
                        </div>
                    </div>
                    <div className="relative">
                        <input 
                            type="text" placeholder="O que você está procurando?" value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto">
                {!searchQuery && activeCategory === 'Todos' && (
                    <>
                        <div className="pt-4 px-4">
                            <StoreCarousel />
                        </div>
                        
                        <div className="mt-4 mx-4 bg-indigo-600 text-white rounded-2xl p-4 flex justify-between items-center shadow-lg shadow-indigo-500/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg"><BoltIcon /></div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight">Entrega Expressa AP</p>
                                    <p className="text-[10px] opacity-90">Macapá e Santana • Peça agora</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded">FRETE REDUZIDO</span>
                            </div>
                        </div>

                        <CategoryIcons activeCategory={activeCategory} onSelect={setActiveCategory} />
                        <BrandLogos activeBrand={activeBrand} onSelect={setActiveBrand} />
                    </>
                )}

                <div className="px-4 pb-12 pt-4">
                    {isLoading ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="h-48 bg-slate-200 rounded-xl animate-pulse"></div>
                            <div className="h-48 bg-slate-200 rounded-xl animate-pulse"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {filteredProducts.map(product => (
                                <div key={product.id} onClick={() => setSelectedProduct(product)} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden group active:scale-95 transition-all">
                                    <div className="aspect-square p-4 flex items-center justify-center bg-white border-b border-slate-50 dark:border-slate-700">
                                        <img src={product.image_url!} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500" alt={product.name} />
                                    </div>
                                    <div className="p-3">
                                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 h-8 mb-2 leading-tight">{product.name}</h3>
                                        <div className="flex items-end justify-between">
                                            <p className="text-base font-black text-indigo-600 dark:text-indigo-400">R$ {product.price.toLocaleString('pt-BR')}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <Modal isOpen={showCepModal} onClose={() => setShowCepModal(false)}>
                <div className="space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Onde você está?</h3>
                    </div>
                    
                    <p className="text-sm text-slate-500 dark:text-slate-400">Preencha seu CEP e nós cuidaremos do resto.</p>
                    
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">CEP (Apenas Macapá/Santana)</label>
                            <input 
                                type="text" value={newCep} 
                                onChange={e => setNewCep(e.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2'))}
                                className="w-full p-4 text-2xl font-black text-center bg-slate-100 dark:bg-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/20 dark:text-white transition-all"
                                placeholder="00000-000" maxLength={9}
                            />
                            {isUpdatingCep && <div className="absolute right-4 top-10"><LoadingSpinner /></div>}
                        </div>

                        {tempAddress.street && (
                            <div className="space-y-4 animate-fade-in-up">
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                    <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Endereço Encontrado</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{tempAddress.street}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{tempAddress.neighborhood}, {tempAddress.city} - {tempAddress.uf}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Número</label>
                                        <input 
                                            ref={numberInputRef}
                                            type="text" 
                                            value={tempAddress.number}
                                            onChange={e => setTempAddress({...tempAddress, number: e.target.value})}
                                            className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ex: 123"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Complemento (Opcional)</label>
                                        <input 
                                            type="text" 
                                            value={tempAddress.complement}
                                            onChange={e => setTempAddress({...tempAddress, complement: e.target.value})}
                                            className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ex: Apto 12, Fundos..."
                                        />
                                    </div>
                                </div>

                                <button 
                                    onClick={handleConfirmLocation} 
                                    disabled={!tempAddress.number || isUpdatingCep}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    Confirmar Localização
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PageLoja;
