import React, { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import { Profile, Address, Order } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';

interface PagePerfilProps {
    session: Session;
}

// Timeline Component for Orders
const OrderTimeline: React.FC<{ status: Order['status'] }> = ({ status }) => {
    const steps = ['pending', 'processing', 'shipped', 'delivered'];
    const currentStep = steps.indexOf(status);
    const labels = ['Aprovado', 'Separando', 'Enviado', 'Entregue'];

    return (
        <div className="relative flex items-center justify-between w-full mt-4 mb-2">
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-0.5 bg-slate-200 dark:bg-slate-700 -z-10"></div>
            <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-green-500 -z-10 transition-all duration-500`} style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}></div>
            {steps.map((step, index) => (
                <div key={step} className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 ${index <= currentStep ? 'bg-green-500 border-green-500' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}></div>
                    <span className={`text-[10px] mt-1 ${index <= currentStep ? 'text-green-600 font-bold' : 'text-slate-400'}`}>{labels[index]}</span>
                </div>
            ))}
        </div>
    );
};

// Sub-views
const OrdersView = () => {
    // Mock Data
    const orders: Order[] = [
        { id: '#4920', date: '15/05/2024', status: 'shipped', total: 2400.00, items: [{ name: 'iPhone 13', quantity: 1, price: 2400 }], trackingCode: 'BR123456789' },
        { id: '#4812', date: '10/04/2024', status: 'delivered', total: 150.00, items: [{ name: 'Fone Bluetooth', quantity: 1, price: 150 }] }
    ];

    return (
        <div className="space-y-4 animate-fade-in">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Meus Pedidos</h3>
            {orders.map(order => (
                <div key={order.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-800 dark:text-white">{order.id}</span>
                        <span className="text-xs text-slate-500">{order.date}</span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                        {order.items.map((i, idx) => <div key={idx}>{i.quantity}x {i.name}</div>)}
                    </div>
                    <OrderTimeline status={order.status} />
                    {order.trackingCode && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <span className="text-xs text-slate-500">Rastreio: {order.trackingCode}</span>
                            <button className="text-xs text-indigo-600 font-bold">Copiar</button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const WalletView = ({ profile }: { profile: Profile | null }) => (
    <div className="animate-fade-in space-y-4">
         <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
             <p className="text-sm opacity-80">Cashback Disponível</p>
             <h2 className="text-3xl font-bold mt-1">R$ 45,90</h2>
             <p className="text-xs mt-4 opacity-70">Expira em 20/12/2024</p>
         </div>
         <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm">
             <h3 className="font-bold text-slate-800 dark:text-white mb-3">Cupons Ativos</h3>
             <div className="border-l-4 border-green-500 pl-3 py-1">
                 <p className="font-bold text-slate-800 dark:text-white">BEMVINDO10</p>
                 <p className="text-xs text-slate-500">10% off na primeira compra</p>
             </div>
         </div>
    </div>
);

const PagePerfil: React.FC<PagePerfilProps> = ({ session }) => {
    const [activeView, setActiveView] = useState<'main' | 'data' | 'orders' | 'wallet' | 'addresses'>('main');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            const p = await getProfile(session.user.id);
            if(p) setProfile({...p, id: session.user.id, email: session.user.email});
            setIsLoading(false);
        };
        load();
    }, [session]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                setProfile(prev => prev ? { ...prev, avatar_url: base64 } : null);
                await updateProfile({ ...profile!, id: session.user.id, avatar_url: base64 });
            };
            reader.readAsDataURL(file);
        }
    };

    const MenuBtn = ({ icon, label, onClick }: any) => (
        <button onClick={onClick} className="w-full flex items-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">{icon}</div>
            <span className="ml-3 font-medium text-slate-700 dark:text-slate-200 flex-1 text-left">{label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
        </button>
    );

    if (isLoading) return <div className="flex justify-center p-10"><LoadingSpinner /></div>;

    return (
        <div className="w-full max-w-md p-4 mx-auto pb-20">
            {activeView === 'main' ? (
                <div className="space-y-6 animate-fade-in">
                     {/* Header Profile */}
                    <div className="flex flex-col items-center text-center pt-4">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-indigo-100 dark:ring-indigo-900 shadow-lg">
                                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><svg className="w-10 h-10 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg></div>}
                            </div>
                            <div className="absolute bottom-0 right-0 bg-indigo-600 p-1.5 rounded-full text-white border-2 border-white dark:border-slate-900"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*"/>
                        </div>
                        <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">{profile?.first_name || 'Cliente'} {profile?.last_name}</h2>
                        <p className="text-sm text-slate-500">{session.user.email}</p>
                    </div>

                    {/* Menu Grid */}
                    <div className="space-y-3">
                        <MenuBtn icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>} label="Meus Pedidos" onClick={() => setActiveView('orders')} />
                        <MenuBtn icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} label="Carteira & Cupons" onClick={() => setActiveView('wallet')} />
                        <MenuBtn icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Meus Endereços" onClick={() => alert('Em breve')} />
                        <MenuBtn icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Meus Dados" onClick={() => setActiveView('data')} />
                    </div>

                    <button onClick={() => supabase.auth.signOut()} className="w-full py-3 text-red-600 font-bold border border-red-200 dark:border-red-900 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Sair da conta</button>
                </div>
            ) : (
                <div className="space-y-4">
                    <button onClick={() => setActiveView('main')} className="flex items-center text-indigo-600 font-bold mb-4">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Voltar
                    </button>
                    {activeView === 'orders' && <OrdersView />}
                    {activeView === 'wallet' && <WalletView profile={profile} />}
                    {/* Outras views seriam renderizadas aqui */}
                </div>
            )}
        </div>
    );
};

export default PagePerfil;
