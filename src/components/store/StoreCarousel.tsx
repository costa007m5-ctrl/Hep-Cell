import React from 'react';

const banners = [
    { id: 1, src: 'https://images.pexels.com/photos/1092644/pexels-photo-1092644.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', alt: 'Promoção de smartphones' },
    { id: 2, src: 'https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', alt: 'Acessórios com desconto' },
    { id: 3, src: 'https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', alt: 'Novos lançamentos de celulares' },
];

const StoreCarousel: React.FC = () => {
    return (
        <div className="px-4">
            <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] md:aspect-[2.5/1] overflow-hidden rounded-2xl shadow-lg">
                <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide">
                    {banners.map((banner, index) => (
                        <div key={banner.id} id={`slide-${index}`} className="flex-shrink-0 w-full h-full snap-center">
                            <img
                                src={banner.src}
                                alt={banner.alt}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StoreCarousel;
