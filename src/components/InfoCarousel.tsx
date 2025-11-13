import React, { useState, useEffect, useCallback, useRef } from 'react';

const slides = [
    { 
        title: "Aumente seu Limite!", 
        description: "Pague suas faturas em dia e veja seu crédito na loja crescer.",
        bgColor: "from-blue-500 to-indigo-600",
    },
    { 
        title: "Novidades na Loja",
        description: "Confira os últimos lançamentos de smartphones e acessórios.",
        bgColor: "from-purple-500 to-violet-600",
    },
    { 
        title: "Segurança em Primeiro Lugar",
        description: "Seus dados e pagamentos estão protegidos com a mais alta tecnologia.",
        bgColor: "from-slate-700 to-slate-800",
    }
];

const InfoCarousel: React.FC = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef<number | null>(null);

    const resetTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    const nextSlide = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, []);
    
    useEffect(() => {
        resetTimeout();
        timeoutRef.current = window.setTimeout(nextSlide, 5000);
        return () => resetTimeout();
    }, [currentIndex, nextSlide, resetTimeout]);
    
    const goToSlide = (index: number) => {
        setCurrentIndex(index);
    };

    return (
        <div className="relative w-full h-32 overflow-hidden rounded-2xl shadow-lg group">
            <div 
                className="flex transition-transform duration-700 ease-in-out h-full" 
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {slides.map((slide, index) => (
                    <div 
                        key={index} 
                        className={`flex-shrink-0 w-full h-full p-6 flex flex-col justify-center text-white bg-gradient-to-br ${slide.bgColor}`}
                    >
                        <h3 className="font-bold text-lg">{slide.title}</h3>
                        <p className="text-sm mt-1">{slide.description}</p>
                    </div>
                ))}
            </div>
            
            {/* Indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
                {slides.map((_, index) => (
                    <button 
                        key={index} 
                        onClick={() => goToSlide(index)} 
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${currentIndex === index ? 'bg-white scale-125' : 'bg-white/50'}`}
                        aria-label={`Ir para o slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default InfoCarousel;