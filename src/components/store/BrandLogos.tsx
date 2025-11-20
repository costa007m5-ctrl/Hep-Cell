import React from 'react';

// SVGs de marcas populares para garantir que sempre carreguem e fiquem bonitos no tema escuro
const AppleLogo = () => (
    <svg viewBox="0 0 384 512" fill="currentColor" className="h-8 w-auto">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z"/>
    </svg>
);

const SamsungLogo = () => (
    <svg viewBox="0 0 200 50" fill="currentColor" className="h-6 w-auto">
         <text x="10" y="35" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="32" letterSpacing="-1">SAMSUNG</text>
    </svg>
);

const XiaomiLogo = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 bg-[#FF6900] text-white rounded-md p-1">
        <path d="M14.66 5.5H5.5v13h1.83v-11.2h7.33V18.5h1.83V5.5h-1.83zm4.58 5.5v7.5h1.83V11h-1.83z"/>
    </svg>
);

const MotorolaLogo = () => (
    <svg viewBox="0 0 50 50" fill="currentColor" className="h-8 w-8 bg-[#001428] text-white rounded-full p-1">
        <path d="M25 0C11.193 0 0 11.193 0 25s11.193 25 25 25 25-11.193 25-25S38.807 0 25 0zm-2.955 35.955h-4.773l5.227-16.818h-5.909l3.182-6.136h4.773l-5.227 16.818h5.909l-3.182 6.136zM32.727 35.955h-4.773l5.227-16.818h-5.909l3.182-6.136h4.773l-5.227 16.818h5.909l-3.182 6.136z" fillRule="evenodd"/>
        <path d="M15 35l8-20h-5l5-10h8l-8 20h5l-5 10z" style={{display:'none'}}/> {/* Fallback shape */}
        <text x="13" y="35" fill="white" fontSize="30" fontWeight="bold">M</text>
    </svg>
);

const BrandCard: React.FC<{ name: string; icon: React.ReactNode }> = ({ name, icon }) => (
     <div className="flex-shrink-0 flex flex-col items-center justify-center h-24 w-28 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all active:scale-95 group">
        <div className="text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {icon}
        </div>
        <span className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300">{name}</span>
    </div>
);

const BrandLogos: React.FC = () => {
    return (
        <section className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between px-4">
                 <h2 className="text-lg font-bold text-slate-900 dark:text-white">Marcas em Destaque</h2>
            </div>
           
            <div className="flex space-x-3 overflow-x-auto pb-4 px-4 scrollbar-hide snap-x">
                <BrandCard name="Apple" icon={<AppleLogo />} />
                <BrandCard name="Samsung" icon={<SamsungLogo />} />
                <BrandCard name="Xiaomi" icon={<XiaomiLogo />} />
                <BrandCard name="Motorola" icon={<MotorolaLogo />} />
                
                {/* Marcas genéricas com texto estilizado se não tiver SVG */}
                 <div className="flex-shrink-0 flex flex-col items-center justify-center h-24 w-28 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all">
                     <span className="text-xl font-black text-slate-800 dark:text-white tracking-tighter">LG</span>
                     <span className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">LG</span>
                 </div>
                 <div className="flex-shrink-0 flex flex-col items-center justify-center h-24 w-28 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all">
                     <span className="text-xl font-black text-blue-600 tracking-tighter">ASUS</span>
                     <span className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">Asus</span>
                 </div>
            </div>
        </section>
    );
};

export default BrandLogos;