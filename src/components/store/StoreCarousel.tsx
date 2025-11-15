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
            <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] md:aspect-[2.5/1] overflow-hidden rounded-2xl shadow-lg group">
                <div className="flex transition-transform duration-700 ease-in-out h-full" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                    {banners.map((banner) => (
                        <a href={banner.href} key={banner.id} className="flex-shrink-0 w-full h-full">
                            <img src={banner.src} alt={banner.alt} className="w-full h-full object-cover" />
                        </a>
                    ))}
                </div>

                {/* Navigation Buttons */}
                <button onClick={prevSlide} className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/30 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-white z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={nextSlide} className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/30 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-white z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                {/* Indicators */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
                    {banners.map((_, index) => (
                        <button key={index} onClick={() => goToSlide(index)} className={`w-3 h-3 rounded-full transition-colors ${currentIndex === index ? 'bg-white' : 'bg-white/50'}`}></button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StoreCarousel;
