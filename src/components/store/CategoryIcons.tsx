import React from 'react';

const PhoneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" /></svg>;
const AccessoriesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5l.415-.207a.75.75 0 011.085.67V10.5m0 0h6m-6 0a.75.75 0 00.75.75h4.5a.75.75 0 00.75-.75V7.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 00-.75.75v3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l.75-1.5 1.5-1.5 1.5 1.5.75 1.5m-6 0h6m.75 6l.75-1.5 1.5-1.5 1.5 1.5.75 1.5m-6 0h6" /></svg>;
const HeadphonesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H10.5a2.25 2.25 0 01-2.25-2.25V6.75m4.5 0a2.25 2.25 0 00-2.25-2.25H10.5a2.25 2.25 0 00-2.25 2.25m4.5 0V21" /></svg>;
const CaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" /></svg>;
const ChargerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l3.75-3.75m0 0L11.25 6l3.75 3.75M7.5 9.75h9" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>;
const OfferIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>;

const categories = [
    { name: 'Celulares', icon: <PhoneIcon />, color: 'bg-blue-500' },
    { name: 'Acessórios', icon: <AccessoriesIcon />, color: 'bg-purple-500' },
    { name: 'Fones', icon: <HeadphonesIcon />, color: 'bg-pink-500' },
    { name: 'Capinhas', icon: <CaseIcon />, color: 'bg-orange-500' },
    { name: 'Carregadores', icon: <ChargerIcon />, color: 'bg-green-500' },
    { name: 'Ofertas', icon: <OfferIcon />, color: 'bg-red-500' },
    { name: 'Tablets', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 21h4a2 2 0 002-2V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>, color: 'bg-teal-500' },
    { name: 'Smartwatch', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: 'bg-indigo-500' },
];

const CategoryIcons: React.FC = () => {
    return (
        <section className="py-2">
            <div className="flex space-x-4 overflow-x-auto pb-4 px-4 scrollbar-hide">
                {categories.map(category => (
                    <button key={category.name} className="flex-shrink-0 flex flex-col items-center group">
                        <div className={`w-16 h-16 ${category.color} rounded-full flex items-center justify-center shadow-md group-active:scale-95 transition-transform ring-2 ring-offset-2 ring-transparent hover:ring-${category.color.split('-')[1]}-300`}>
                            {category.icon}
                        </div>
                        <span className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">{category.name}</span>
                    </button>
                ))}
            </div>
        </section>
    );
};

export default CategoryIcons;