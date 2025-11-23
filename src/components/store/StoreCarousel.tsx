import React, { useState, useEffect, useCallback, useRef } from 'react';

const fallbackBanners = [
    { id: 'f1', image_url: 'https://images.pexels.com/photos/1092644/pexels-photo-1092644.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', prompt: 'Smartphones', link: 'category:Celulares' },
    { id: 'f2', image_url: 'https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', prompt: 'Acessórios', link: 'category:Acessórios' },
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
                const res = await fetch('/api/admin/banners');
                if (res.ok) {
                    const data = await res.json();
                    // Filtra banners que são especificamente para a Loja ou que não têm localização definida (legado)
                    const storeBanners = data.filter((b: any) => (b.location === 'store' || !b.location) && b.active);
                    
                    if (storeBanners && storeBanners.length > 0) {
                        setBanners(storeBanners);
                    } else {
                        setBanners(fallbackBanners);
                    }
                } else {
                    setBanners(fallbackBanners);
                }
            } catch (error) {
                console.error("Error fetching banners", error);
                setBanners(fallbackBanners);
            }
        };
        fetchBanners();
    }, []);

    const resetTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
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
    
    const goToSlide = (index: number) => {
        setCurrentIndex(index);
    };

    const handleBannerClick = (link?: string) => {
        if (link && onBannerClick) {
            onBannerClick(link);
        }
    };

    if (banners.length === 0) return null;

    return (
        <div className="px-4">
            <div className="relative w-full aspect-[2/1] sm:aspect-[2.5/1] md:aspect-[3/1] overflow-hidden rounded-2xl shadow-md group">
                <div className="flex transition-transform duration-700 ease-in-out h-full" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                    {banners.map((banner) => (
                        <div 
                            key={banner.id} 
                            className={`flex-shrink-0 w-full h-full relative ${banner.link ? 'cursor-pointer' : ''}`}
                            onClick={() => handleBannerClick(banner.link)}
                        >
                             <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10 pointer-events-none"></div>
                            <img src={banner.image_url} alt={banner.prompt || 'Banner'} className="w-full h-full object-cover" />
                        </div>
                    ))}
                </div>

                {/* Indicators */}
                {banners.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-20">
                        {banners.map((_, index) => (
                            <button 
                                key={index} 
                                onClick={(e) => { e.stopPropagation(); goToSlide(index); }} 
                                className={`h-1.5 rounded-full transition-all duration-300 ${currentIndex === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StoreCarousel;