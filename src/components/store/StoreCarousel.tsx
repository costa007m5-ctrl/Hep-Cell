
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Logo from '../Logo';

// Banners de Fallback profissionais
const fallbackBanners = [
    { 
        id: 'f1', 
        image_url: 'https://images.unsplash.com/photo-1616348436168-de43ad0db179?auto=format&fit=crop&w=1200&q=80', 
        prompt: 'iPhone 15 Pro Max', 
        subtitle: 'Titânio. Tão robusto. Tão leve.',
        link: 'category:Celulares'
    },
    { 
        id: 'f2', 
        image_url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80', 
        prompt: 'Trabalhe com Estilo', 
        subtitle: 'Setup completo para sua produtividade.',
        link: 'category:Acessórios'
    },
    { 
        id: 'f3', 
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80', 
        prompt: 'Som Premium', 
        subtitle: 'Mergulhe na música.',
        link: 'category:Fones'
    },
    { 
        id: 'f4', 
        image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80', 
        prompt: 'Acessórios', 
        subtitle: 'O melhor para seu gadget.',
        link: 'category:Acessórios'
    },
    { 
        id: 'f5', 
        image_url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80', 
        prompt: 'Smartwatch', 
        subtitle: 'Conectado o tempo todo.',
        link: 'category:Smartwatch'
    }
];

interface StoreCarouselProps {
    onBannerClick?: (link: string) => void;
    variant?: 'hero' | 'slim' | 'grid'; // Variantes visuais
    bannersData?: any[]; // Permite passar banners específicos
}

const StoreCarousel: React.FC<StoreCarouselProps> = ({ onBannerClick, variant = 'hero', bannersData }) => {
    const [banners, setBanners] = useState<any[]>(bannersData || []);
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef<number | null>(null);

    // Se não passar dados, busca do servidor
    useEffect(() => {
        if (bannersData) {
            setBanners(bannersData);
            return;
        }

        const fetchBanners = async () => {
            try {
                const res = await fetch('/api/admin?action=banners');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        setBanners(data);
                    } else {
                        setBanners(fallbackBanners);
                    }
                } else {
                    setBanners(fallbackBanners);
                }
            } catch (error) {
                setBanners(fallbackBanners);
            }
        };
        fetchBanners();
    }, [bannersData]);

    const resetTimeout = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    const nextSlide = useCallback(() => {
        if (banners.length === 0) return;
        setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, [banners.length]);
    
    // Auto-play apenas para Hero e Slim (se tiver mais de 1)
    useEffect(() => {
        if (variant === 'grid' || banners.length <= 1) return;
        resetTimeout();
        timeoutRef.current = window.setTimeout(nextSlide, variant === 'hero' ? 5000 : 7000);
        return () => resetTimeout();
    }, [currentIndex, nextSlide, resetTimeout, banners.length, variant]);
    
    const handleBannerClick = (link?: string) => {
        if (link && onBannerClick) onBannerClick(link);
    };

    if (banners.length === 0) return null;

    // --- RENDER: GRID (Dois quadrados lado a lado) ---
    if (variant === 'grid') {
        const displayBanners = banners.slice(0, 2); // Pega os 2 primeiros
        return (
            <div className="px-4 py-2 grid grid-cols-2 gap-3 animate-fade-in-up">
                {displayBanners.map((banner) => (
                    <div 
                        key={banner.id}
                        onClick={() => handleBannerClick(banner.link)}
                        className="relative aspect-square rounded-2xl overflow-hidden shadow-sm cursor-pointer group active:scale-95 transition-transform"
                    >
                        <img src={banner.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={banner.prompt} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-3">
                            <p className="text-white font-bold text-sm leading-tight shadow-black drop-shadow-md">{banner.prompt}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // --- RENDER: SLIM (Faixa estreita) ---
    if (variant === 'slim') {
        return (
            <div className="px-4 py-4 animate-fade-in">
                <div className="relative w-full h-24 sm:h-32 rounded-2xl overflow-hidden shadow-md cursor-pointer group" onClick={() => handleBannerClick(banners[currentIndex].link)}>
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10"></div>
                    <img 
                        src={banners[currentIndex].image_url} 
                        className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-1000" 
                        alt="Promo"
                    />
                    <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-6 z-20 bg-gradient-to-r from-black/80 via-black/20 to-transparent w-3/4">
                        <h3 className="text-white font-black text-lg uppercase italic tracking-wide drop-shadow-md">{banners[currentIndex].prompt}</h3>
                        {banners[currentIndex].subtitle && <p className="text-white/80 text-xs font-medium">{banners[currentIndex].subtitle}</p>}
                        <span className="mt-2 text-[10px] font-bold text-black bg-white px-2 py-0.5 rounded w-fit">Ver Agora &rarr;</span>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: HERO (Padrão Grande) ---
    return (
        <div className="px-4 pt-4 pb-2">
            <div className="relative w-full aspect-[2/1] sm:aspect-[2.5/1] overflow-hidden rounded-[2rem] shadow-2xl shadow-indigo-500/20 group cursor-pointer">
                <div className="flex transition-transform duration-700 ease-in-out h-full" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                    {banners.map((banner, index) => (
                        <div 
                            key={banner.id || index} 
                            className="flex-shrink-0 w-full h-full relative"
                            onClick={() => handleBannerClick(banner.link)}
                        >
                             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent z-10 pointer-events-none"></div>
                             <img 
                                src={banner.image_url} 
                                alt={banner.prompt} 
                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000" 
                             />
                             <div className="absolute top-4 right-4 z-20 opacity-40 scale-75">
                                <Logo className="h-8 w-8 text-white" variant="light" />
                             </div>
                             <div className="absolute bottom-0 left-0 right-0 p-6 z-20 flex flex-col items-start">
                                <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl px-4 py-2 mb-1 shadow-lg">
                                    <h3 className="text-white font-black text-xl sm:text-2xl tracking-tight drop-shadow-md">
                                        {banner.prompt || 'Oferta Especial'}
                                    </h3>
                                </div>
                                {banner.subtitle && (
                                    <p className="text-slate-200 text-xs sm:text-sm font-medium pl-1 drop-shadow-md">
                                        {banner.subtitle}
                                    </p>
                                )}
                             </div>
                        </div>
                    ))}
                </div>
                {banners.length > 1 && (
                    <div className="absolute bottom-6 right-6 flex space-x-1.5 z-30">
                        {banners.map((_, index) => (
                            <button 
                                key={index} 
                                onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }} 
                                className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${currentIndex === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StoreCarousel;
