
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Logo from '../Logo';

const fallbackBanners = [
    { 
        id: 'f1', 
        image_url: 'https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', 
        prompt: 'Novos Smartphones', 
        link: 'category:Celulares',
        subtitle: 'Tecnologia de ponta ao seu alcance' 
    },
    { 
        id: 'f2', 
        image_url: 'https://images.pexels.com/photos/3945657/pexels-photo-3945657.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', 
        prompt: 'Acessórios Premium', 
        link: 'category:Acessórios',
        subtitle: 'Complete sua experiência'
    },
];

interface StoreCarouselProps {
    onBannerClick?: (link: string) => void;
}

const StoreCarousel: React.FC<StoreCarouselProps> = ({ onBannerClick }) => {
    const [banners, setBanners] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                // Busca banners reais do Supabase
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
                console.error("Erro ao buscar banners", error);
                setBanners(fallbackBanners);
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
        <div className="px-4">
            <div className="relative w-full aspect-[2/1] sm:aspect-[2.5/1] md:aspect-[3/1] overflow-hidden rounded-[2rem] shadow-xl group">
                <div className="flex transition-transform duration-700 ease-in-out h-full" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                    {banners.map((banner) => (
                        <div 
                            key={banner.id} 
                            className={`flex-shrink-0 w-full h-full relative ${banner.link ? 'cursor-pointer' : ''}`}
                            onClick={() => handleBannerClick(banner.link)}
                        >
                             {/* Overlay Gradiente Profissional */}
                             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 pointer-events-none"></div>
                             
                             {/* Imagem */}
                             <img src={banner.image_url} alt={banner.prompt} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000" />
                             
                             {/* Logo Marca D'água */}
                             <div className="absolute top-4 right-4 z-20 opacity-30 scale-75">
                                <Logo variant="light" className="h-8 w-8" />
                             </div>

                             {/* Conteúdo de Texto com Blur */}
                             <div className="absolute bottom-0 left-0 right-0 p-6 z-20 flex flex-col items-start">
                                <div className="backdrop-blur-md bg-white/10 border border-white/10 rounded-2xl px-4 py-2 mb-2">
                                    <h3 className="text-white font-black text-xl sm:text-2xl tracking-tight drop-shadow-md">
                                        {banner.prompt || 'Oferta Especial'}
                                    </h3>
                                </div>
                                {banner.subtitle && <p className="text-slate-200 text-xs sm:text-sm font-medium pl-1">{banner.subtitle}</p>}
                             </div>
                        </div>
                    ))}
                </div>

                {/* Indicadores Modernos */}
                {banners.length > 1 && (
                    <div className="absolute bottom-4 right-4 flex space-x-1.5 z-30">
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
