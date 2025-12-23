
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Logo from '../Logo';

// Banners de Fallback (Caso não tenha no banco ou falhe)
const fallbackBanners = [
    { 
        id: 'f1', 
        image_url: 'https://images.unsplash.com/photo-1556656793-02715d8dd660?auto=format&fit=crop&w=1200&q=80', 
        prompt: 'Renove seu Smartphone', 
        subtitle: 'As melhores marcas com as melhores condições.',
        link: 'category:Celulares'
    },
    { 
        id: 'f2', 
        image_url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=1200&q=80', 
        prompt: 'Smartwatches em Oferta', 
        subtitle: 'Tecnologia que acompanha seu ritmo.',
        link: 'category:Smartwatch'
    },
    { 
        id: 'f3', 
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80', 
        prompt: 'Áudio Imersivo', 
        subtitle: 'Fones de ouvido com cancelamento de ruído.',
        link: 'category:Fones'
    }
];

interface StoreCarouselProps {
    onBannerClick?: (link: string) => void;
}

const StoreCarousel: React.FC<StoreCarouselProps> = ({ onBannerClick }) => {
    const [banners, setBanners] = useState<any[]>(fallbackBanners); // Inicia com fallback
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const res = await fetch('/api/admin?action=banners');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        setBanners(data);
                    }
                }
            } catch (error) {
                console.warn("Usando banners padrão devido a erro na API");
            }
        };
        fetchBanners();
    }, []);

    const resetTimeout = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    const nextSlide = useCallback(() => {
        if (banners.length === 0) return;
        setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, [banners.length]);
    
    useEffect(() => {
        if (banners.length === 0) return;
        resetTimeout();
        timeoutRef.current = window.setTimeout(nextSlide, 5000);
        return () => resetTimeout();
    }, [currentIndex, nextSlide, resetTimeout, banners.length]);
    
    const handleBannerClick = (link?: string) => {
        if (link && onBannerClick) onBannerClick(link);
    };

    if (banners.length === 0) return null;

    return (
        <div className="px-4 pt-4 pb-2">
            <div className="relative w-full aspect-[2/1] sm:aspect-[2.5/1] overflow-hidden rounded-[2rem] shadow-2xl shadow-indigo-500/20 group">
                <div className="flex transition-transform duration-700 ease-in-out h-full" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                    {banners.map((banner, index) => (
                        <div 
                            key={banner.id || index} 
                            className={`flex-shrink-0 w-full h-full relative ${banner.link ? 'cursor-pointer' : ''}`}
                            onClick={() => handleBannerClick(banner.link)}
                        >
                             {/* Overlay Gradiente para legibilidade */}
                             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent z-10 pointer-events-none"></div>
                             
                             <img 
                                src={banner.image_url} 
                                alt={banner.prompt} 
                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000" 
                             />
                             
                             {/* Marca D'água Sutil */}
                             <div className="absolute top-4 right-4 z-20 opacity-40 scale-75">
                                <Logo className="h-8 w-8 text-white" variant="light" />
                             </div>

                             {/* Conteúdo de Texto */}
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

                {/* Indicadores */}
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
