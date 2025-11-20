import React, { useState, useEffect, useCallback, useRef } from 'react';

const banners = [
    { id: 1, src: 'https://images.pexels.com/photos/1092644/pexels-photo-1092644.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', alt: 'Promoção de smartphones', href: '#' },
    { id: 2, src: 'https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', alt: 'Acessórios com desconto', href: '#' },
    { id: 3, src: 'https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', alt: 'Novos lançamentos de celulares', href: '#' },
];

const StoreCarousel: React.FC = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef<number | null>(null);

    const resetTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    const nextSlide = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, []);
    
    useEffect(() => {
        resetTimeout();
        timeoutRef.current = window.setTimeout(nextSlide, 5000);
        return () => resetTimeout();
    }, [currentIndex, nextSlide, resetTimeout]);
    
    const prevSlide = () => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + banners.length) % banners.length);
    };

    const goToSlide = (index: number) => {
        setCurrentIndex(index);
    };

    return (
        <div className="px-4">
            <div className="relative w-full aspect-[2/1] sm:aspect-[2.5/1] md:aspect-[3/1] overflow-hidden rounded-2xl shadow-md group">
                <div className="flex transition-transform duration-700 ease-in-out h-full" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                    {banners.map((banner) => (
                        <a href={banner.href} key={banner.id} className="flex-shrink-0 w-full h-full relative">
                             <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10"></div>
                            <img src={banner.src} alt={banner.alt} className="w-full h-full object-cover" />
                        </a>
                    ))}
                </div>

                {/* Indicators */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-20">
                    {banners.map((_, index) => (
                        <button key={index} onClick={() => goToSlide(index)} className={`h-1.5 rounded-full transition-all duration-300 ${currentIndex === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}></button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StoreCarousel;