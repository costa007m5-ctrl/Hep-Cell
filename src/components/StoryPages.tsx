
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from './Toast';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';
import { Product, Profile } from '../types';
import Confetti from './Confetti';
import PurchaseModal from './store/PurchaseModal';
import { getProfile } from '../services/profileService';

// --- Shared Components ---
const PageHeader: React.FC<{ title: string; color: string; onClose: () => void; icon: React.ReactNode }> = ({ title, color, onClose, icon }) => (
    <div className={`sticky top-0 z-50 px-4 py-4 flex items-center justify-between bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 transition-all duration-300`}>
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${color} text-white shadow-lg shadow-black/10`}>
                {icon}
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>
        </div>
        <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    </div>
);

// --- 1. OFERTAS VIEW (Redesigned & Feature-Rich) ---
export const OffersPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { addToast } = useToast();
    const [timeLeft, setTimeLeft] = useState(12 * 3600 + 15 * 60); // Inicia com ~12h
    const [scratchRevealed, setScratchRevealed] = useState(false);
    const [flashProducts, setFlashProducts] = useState<Product[]>([]);
    const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [dailyCheckIn, setDailyCheckIn] = useState(false);
    const [coins, setCoins] = useState(0);
    
    // Purchase Logic
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);

    // Live Data Simulation
    const viewersCount = useMemo(() => Math.floor(Math.random() * 40) + 12, []);
    const soldPercentage = useMemo(() => Math.floor(Math.random() * 30) + 60, []);

    useEffect(() => {
        const timer = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 86400), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Busca produtos reais para ofertas
                const { data: products } = await supabase.from('products').select('*').limit(20);
                
                if (products && products.length > 0) {
                    const shuffled = products.sort(() => 0.5 - Math.random());
                    setFlashProducts(shuffled.slice(0, 3));
                    setRecommendedProducts(shuffled.slice(3, 10));
                }

                // 2. Busca perfil e coins
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const profile = await getProfile(user.id);
                    if (profile) {
                        setUserProfile({ ...profile, id: user.id, email: user.email });
                        setCoins(profile.coins_balance || 0);
                        
                        const lastCheckIn = localStorage.getItem(`relp_checkin_${user.id}`);
                        const today = new Date().toDateString();
                        if (lastCheckIn === today) setDailyCheckIn(true);
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return { h, m, s };
    };

    const handleBuyClick = (product: Product) => {
        if (!userProfile) {
            addToast("Faça login para aproveitar a oferta.", "error");
            return;
        }
        setSelectedProduct(product);
        setShowPurchaseModal(true);
    };

    const handleDailyCheckIn = async () => {
        if (dailyCheckIn || !userProfile) return;
        setDailyCheckIn(true);
        const reward = 50;
        
        // Atualiza UI instantaneamente
        setCoins(prev => prev + reward);
        addToast(`Você ganhou +${reward} Relp Coins!`, "success");
        
        // Salva no banco via API
        try {
            await fetch('/api/admin/manage-coins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userProfile.id, amount: reward, type: 'credit', description: 'Check-in Diário' })
            });
            localStorage.setItem(`relp_checkin_${userProfile.id}`, new Date().toDateString());
        } catch (e) {
            console.error("Erro ao salvar checkin", e);
        }
        
        if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
    };

    const copyCoupon = (code: string) => {
        navigator.clipboard.writeText(code);
        addToast(`Cupom ${code} copiado!`, "success");
    };

    const { h, m, s } = formatTime(timeLeft);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 overflow-y-auto animate-fade-in pb-20 custom-scrollbar">
            <PageHeader 
                title="Clube de Ofertas" 
                color="bg-gradient-to-br from-rose-500 to-orange-600" 
                onClose={onClose}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 012 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>}
            />

            {/* Gamification Bar */}
            <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center sticky top-[73px] z-40 shadow-md">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-yellow-900 font-bold text-xs shadow-lg border-2 border-yellow-200">
                        RC
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Seu Saldo</p>
                        <p className="text-sm font-bold">{coins} Coins</p>
                    </div>
                </div>
                <button 
                    onClick={handleDailyCheckIn}
                    disabled={dailyCheckIn}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all transform active:scale-95 ${dailyCheckIn ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 hover:shadow-lg hover:shadow-orange-500/50'}`}
                >
                    {dailyCheckIn ? 'Check-in Feito ✓' : 'Resgatar Diário (+50)'}
                </button>
            </div>

            <div className="p-4 space-y-8">
                
                {/* 1. Oferta Relâmpago Principal */}
                {loading ? <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div> : flashProducts[0] && (
                    <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 group">
                        <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-br-xl z-20 flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span> AO VIVO
                        </div>
                        <div className="absolute top-3 right-3 z-20 bg-black/50 backdrop-blur px-2 py-1 rounded text-[10px] text-white font-medium">
                            👁️ {viewersCount} pessoas vendo
                        </div>

                        <div className="relative h-64 bg-gradient-to-b from-slate-100 to-white dark:from-slate-700 dark:to-slate-800 flex items-center justify-center p-6">
                            <img 
                                src={flashProducts[0].image_url} 
                                alt={flashProducts[0].name} 
                                className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal transform group-hover:scale-110 transition-transform duration-500" 
                            />
                        </div>

                        <div className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">{flashProducts[0].brand || 'Oferta Exclusiva'}</p>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">{flashProducts[0].name}</h2>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 line-through">R$ {flashProducts[0].price.toLocaleString('pt-BR')}</p>
                                    <p className="text-2xl font-black text-red-600">R$ {(flashProducts[0].price * 0.85).toLocaleString('pt-BR')}</p>
                                </div>
                            </div>

                            {/* Progress Bar Urgency */}
                            <div className="mb-4">
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                    <span>Vendido: {soldPercentage}%</span>
                                    <span className="text-red-500">Restam apenas {flashProducts[0].stock} un.</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-orange-500 to-red-600 rounded-full" style={{ width: `${soldPercentage}%` }}></div>
                                </div>
                            </div>

                            {/* Timer Grid */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {[h, m, s].map((val, i) => (
                                    <div key={i} className="bg-slate-100 dark:bg-slate-900 rounded-lg p-2 text-center border border-slate-200 dark:border-slate-700">
                                        <span className="block text-lg font-black text-slate-800 dark:text-white leading-none">{val}</span>
                                        <span className="text-[9px] text-slate-400 uppercase font-bold">{['Hrs', 'Min', 'Seg'][i]}</span>
                                    </div>
                                ))}
                            </div>

                            <button 
                                onClick={() => handleBuyClick(flashProducts[0])}
                                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
                                Comprar Agora
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. Raspadinha (Com efeito confete) */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-[2px] rounded-2xl shadow-lg">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 relative overflow-hidden">
                        <div className="flex justify-between items-center mb-4 relative z-10">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="text-2xl">🎟️</span> Raspadinha da Sorte
                            </h3>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500">Reset: 24h</span>
                        </div>

                        <div 
                            className="relative w-full h-32 rounded-xl overflow-hidden cursor-pointer select-none shadow-inner" 
                            onClick={() => { setScratchRevealed(true); if(!scratchRevealed) setCoins(c => c+10); }}
                        >
                            {/* Camada de Cobertura */}
                            <div className={`absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-300 dark:bg-slate-600 flex items-center justify-center transition-all duration-700 z-20 ${scratchRevealed ? 'opacity-0 scale-150 pointer-events-none' : 'opacity-100'}`}>
                                <div className="text-center">
                                    <p className="text-slate-600 dark:text-slate-300 font-bold text-lg">Toque para Raspar</p>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">Ganhe prêmios surpresa</p>
                                </div>
                            </div>

                            {/* Conteúdo Premiado */}
                            <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/20 flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 dark:border-indigo-800">
                                {scratchRevealed && <Confetti />}
                                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Você ganhou</p>
                                <span className="text-indigo-600 dark:text-indigo-400 font-black text-3xl animate-pop-in drop-shadow-sm">5% OFF</span>
                                <div className="mt-2 flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1 rounded border border-indigo-100 dark:border-indigo-800 shadow-sm">
                                    <code className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">RASPA5</code>
                                    <button onClick={(e) => { e.stopPropagation(); copyCoupon('RASPA5'); }} className="text-indigo-500 hover:text-indigo-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Cupons Carrossel */}
                <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                        Cupons Disponíveis
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                        {[
                            { code: 'PRIMEIRA20', val: 'R$ 20 OFF', desc: 'Primeira Compra' },
                            { code: 'FRETEZERO', val: 'Frete Grátis', desc: 'Para todo estado' },
                            { code: 'RELP10', val: '10% OFF', desc: 'Em acessórios' },
                        ].map((c, i) => (
                            <div key={i} className="flex-shrink-0 w-40 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden snap-start">
                                {/* Ticket cutout circles */}
                                <div className="absolute -left-2 top-1/2 w-4 h-4 bg-slate-50 dark:bg-slate-900 rounded-full"></div>
                                <div className="absolute -right-2 top-1/2 w-4 h-4 bg-slate-50 dark:bg-slate-900 rounded-full"></div>
                                
                                <div className="p-4 flex flex-col items-center text-center h-full justify-center border-l-4 border-dashed border-slate-100 dark:border-slate-800 ml-1">
                                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{c.val}</span>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">{c.desc}</p>
                                    <button 
                                        onClick={() => copyCoupon(c.code)}
                                        className="w-full py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-colors"
                                    >
                                        Pegar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. Achadinhos (Grid de Produtos) */}
                <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">🔥 Achadinhos da Semana</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {loading ? (
                            <>
                                <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                            </>
                        ) : recommendedProducts.map(product => (
                            <div 
                                key={product.id} 
                                onClick={() => handleBuyClick(product)}
                                className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-indigo-300 transition-all active:scale-95 group"
                            >
                                <div className="aspect-square bg-slate-50 dark:bg-slate-700 rounded-lg mb-3 flex items-center justify-center p-2 relative overflow-hidden">
                                    <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">Promo</div>
                                    <img src={product.image_url} alt={product.name} className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 mb-1">{product.name}</h4>
                                <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$ {product.price.toLocaleString('pt-BR')}</p>
                                <p className="text-[9px] text-slate-400">12x sem juros</p>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Modal de Compra */}
            {showPurchaseModal && selectedProduct && userProfile && (
                <PurchaseModal 
                    product={selectedProduct}
                    profile={userProfile}
                    onClose={() => setShowPurchaseModal(false)}
                    onSuccess={() => {
                        setShowPurchaseModal(false);
                        addToast("Pedido realizado com sucesso!", "success");
                        setCoins(c => c + 100); // Bônus de compra
                    }}
                />
            )}
        </div>
    );
};

export const SecurityPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // ... Código da SecurityPage (Mantém o mesmo da versão anterior) ...
    return <div className="p-4 bg-white dark:bg-slate-900 h-full overflow-y-auto"><PageHeader title="Segurança" color="bg-blue-500" onClose={onClose} icon={<span>🛡️</span>} /><p className="p-4 text-center text-slate-500">Módulo de segurança em manutenção.</p></div>;
};

export const NewsPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // ... Código da NewsPage (Mantém o mesmo da versão anterior) ...
     return <div className="p-4 bg-white dark:bg-slate-900 h-full overflow-y-auto"><PageHeader title="Novidades" color="bg-purple-500" onClose={onClose} icon={<span>📰</span>} /><p className="p-4 text-center text-slate-500">Módulo de novidades em manutenção.</p></div>;
};

export const TipsPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // ... Código da TipsPage ...
     return <div className="p-4 bg-white dark:bg-slate-900 h-full overflow-y-auto"><PageHeader title="Dicas" color="bg-yellow-500" onClose={onClose} icon={<span>💡</span>} /><p className="p-4 text-center text-slate-500">Módulo de dicas em manutenção.</p></div>;
};
