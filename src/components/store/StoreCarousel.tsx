
import React, { useState, useEffect, useCallback, useRef } from 'react';

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
                const res = await fetch('/api/admin?action=banners');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) setBanners(data);
                }
            } catch (error) { console.error(error); }
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
    
    if (banners.length === 0) return null;

    return (
        <div className="relative w-full aspect-[21/9] sm:aspect-[3/1] overflow-hidden rounded-xl shadow-md group bg-slate-200 dark:bg-slate-800">
            <div className="flex transition-transform duration-500 ease-out h-full" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                {banners.map((banner) => (
                    <div 
                        key={banner.id} 
                        className={`flex-shrink-0 w-full h-full relative ${banner.link ? 'cursor-pointer' : ''}`}
                        onClick={() => banner.link && onBannerClick && onBannerClick(banner.link)}
                    >
                         <img src={banner.image_url} alt={banner.prompt} className="w-full h-full object-cover" />
                         {/* Gradiente sutil na base apenas se tiver texto */}
                         {banner.prompt && (
                             <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                                 <p className="text-white font-bold text-sm md:text-lg shadow-black/50 drop-shadow-md">{banner.prompt}</p>
                             </div>
                         )}
                    </div>
                ))}
            </div>

            {/* Dots Indicadores */}
            {banners.length > 1 && (
                <div className="absolute bottom-2 right-4 flex space-x-1.5 z-10">
                    {banners.map((_, index) => (
                        <button 
                            key={index} 
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }} 
                            className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${currentIndex === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default StoreCarousel;
