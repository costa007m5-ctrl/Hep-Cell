import React from 'react';

const brands = [
  { name: 'Samsung', logoUrl: 'https://cdn.worldvectorlogo.com/logos/samsung-5.svg' },
  { name: 'Apple', logoUrl: 'https://cdn.worldvectorlogo.com/logos/apple-14.svg' },
  { name: 'Motorola', logoUrl: 'https://cdn.worldvectorlogo.com/logos/motorola-5.svg' },
  { name: 'Xiaomi', logoUrl: 'https://cdn.worldvectorlogo.com/logos/xiaomi-5.svg' },
  { name: 'Asus', logoUrl: 'https://cdn.worldvectorlogo.com/logos/asus-6.svg' },
  { name: 'LG', logoUrl: 'https://cdn.worldvectorlogo.com/logos/lg-1.svg' },
  { name: 'Nokia', logoUrl: 'https://cdn.worldvectorlogo.com/logos/nokia-5.svg' },
];

const BrandLogos: React.FC = () => {
    return (
        <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white px-4">Marcas Populares</h2>
            <div className="flex space-x-8 overflow-x-auto pb-4 px-4 scrollbar-hide">
                {brands.map(brand => (
                    <div key={brand.name} className="flex-shrink-0 flex items-center justify-center h-16 w-32 cursor-pointer">
                        <img 
                            src={brand.logoUrl} 
                            alt={`${brand.name} logo`}
                            className="max-h-8 max-w-full object-contain filter grayscale hover:grayscale-0 transition-all duration-300 ease-in-out"
                        />
                    </div>
                ))}
            </div>
        </section>
    );
};

export default BrandLogos;