import React from 'react';

const brands = [
  { name: 'Samsung', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg' },
  { name: 'Apple', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg' },
  { name: 'Motorola', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Motorola_logo.svg' },
  { name: 'Xiaomi', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Xiaomi_logo_%282021-%29.svg' },
  { name: 'Asus', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Asus_logo.svg' },
  { name: 'LG', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/LG_logo_%282014%29.svg' },
  { name: 'Nokia', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Nokia_wordmark.svg' },
];

const BrandLogos: React.FC = () => {
    return (
        <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white px-4">Marcas Parceiras</h2>
            <div className="flex space-x-4 overflow-x-auto pb-4 px-4 scrollbar-hide">
                {brands.map(brand => (
                    <div key={brand.name} className="flex-shrink-0 flex items-center justify-center h-20 w-32 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm cursor-pointer hover:shadow-lg transition-shadow">
                        <img 
                            src={brand.logoUrl} 
                            alt={`${brand.name} logo`}
                            className="max-h-12 max-w-full object-contain dark:invert"
                        />
                    </div>
                ))}
            </div>
        </section>
    );
};

export default BrandLogos;