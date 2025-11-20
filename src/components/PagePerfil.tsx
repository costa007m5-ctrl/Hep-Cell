import React, { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import { Profile, Address, Order } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';
import { useToast } from './Toast';

interface PagePerfilProps {
    session: Session;
}

// Timeline Component for Orders
const OrderTimeline: React.FC<{ status: string }> = ({ status }) => {
    const steps = ['pending', 'processing', 'shipped', 'delivered'];
    // Normaliza status
    const currentStep = steps.indexOf(status.toLowerCase()) === -1 ? 0 : steps.indexOf(status.toLowerCase());
    const labels = ['Aprovado', 'Separando', 'Enviado', 'Entregue'];

    return (
        <div className="relative flex items-center justify-between w-full mt-4 mb-2">
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-0.5 bg-slate-200 dark:bg-slate-700 -z-10"></div>
            <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-green-500 -z-10 transition-all duration-500`} style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}></div>
            {steps.map((step, index) => (
                <div key={step} className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 z-10 ${index <= currentStep ? 'bg-green-500 border-green-500' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}></div>
                    <span className={`text-[10px] mt-1 ${index <= currentStep ? 'text-green-600 font-bold' : 'text-slate-400'}`}>{labels[index]}</span>
                </div>
            ))}
        </div>
    );
};

// Sub-views
const OrdersView = ({ userId }: { userId: string }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                // Join orders with items
                const { data, error } = await supabase
                    .from('orders')
                    .select(`
                        *,
                        order_items (
                            product_name,
                            quantity
                        )
                    `)
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                setOrders(data || []);
            } catch (e) {
                console.error('Failed to load orders', e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [userId]);

    if (loading) return <LoadingSpinner />;

    if (orders.length === 0) {
        return (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-slate-500 dark:text-slate-400">Você ainda não fez nenhum pedido.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Meus Pedidos</h3>
            {orders.map(order => (
                <div key={order.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-800 dark:text-white">#{order.id.slice(0,8)}</span>
                        <span className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                        {order.order_items.map((i: any, idx: number) => (
                            <div key={idx}>{i.quantity}x {i.product_name}</div>
                        ))}
                        <div className="font-bold mt-1 text-indigo-600">Total: R$ {order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                    </div>
                    <OrderTimeline status={order.status} />
                </div>
            ))}
        </div>
    );
};

const AddressView = ({ userId }: { userId: string }) => {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newAddress, setNewAddress] = useState<Partial<Address>>({});
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    const fetchAddresses = async () => {
        setLoading(true);
        const { data } = await supabase.from('addresses').select('*').eq('user_id', userId).order('created_at');
        setAddresses(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchAddresses(); }, [userId]);

    const handleSave = async () => {
        if (!newAddress.street || !newAddress.zipCode || !newAddress.number) {
             addToast('Preencha os campos obrigatórios.', 'error');
             return;
        }
        try {
            const { error } = await supabase.from('addresses').insert([{ ...newAddress, user_id: userId }]);
            if (error) throw error;
            addToast('Endereço salvo!', 'success');
            setIsAdding(false);
            setNewAddress({});
            fetchAddresses();
        } catch (e: any) {
            addToast(e.message || 'Erro ao salvar.', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if(!confirm('Excluir endereço?')) return;
        await supabase.from('addresses').delete().eq('id', id);
        fetchAddresses();
        addToast('Endereço removido.', 'success');
    };

    const handleCepBlur = async () => {
        if (newAddress.zipCode?.length === 9) { // Formato 00000-000
            const cep = newAddress.zipCode.replace(/\D/g, '');
            try {
                const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    setNewAddress(prev => ({
                        ...prev,
                        street: data.logradouro,
                        neighborhood: data.bairro,
                        city: data.localidade,
                        state: data.uf
                    }));
                }
            } catch(e) {}
        }
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Meus Endereços</h3>
                <button onClick={() => setIsAdding(!isAdding)} className="text-sm text-indigo-600 font-bold">{isAdding ? 'Cancelar' : '+ Adicionar'}</button>
            </div>

            {isAdding && (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-3 border border-slate-200 dark:border-slate-700">
                     <InputField 
                        label="CEP" name="zipCode" placeholder="00000-000" maxLength={9}
                        value={newAddress.zipCode || ''} 
                        onChange={e => {
                            const v = e.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2');
                            setNewAddress({...newAddress, zipCode: v})
                        }}
                        onBlur={handleCepBlur}
                    />
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                            <InputField label="Rua" name="street" value={newAddress.street || ''} onChange={e => setNewAddress({...newAddress, street: e.target.value})} />
                        </div>
                        <InputField label="Número" name="number" value={newAddress.number || ''} onChange={e => setNewAddress({...newAddress, number: e.target.value})} />
                    </div>
                    <InputField label="Bairro" name="neighborhood" value={newAddress.neighborhood || ''} onChange={e => setNewAddress({...newAddress, neighborhood: e.target.value})} />
                    <div className="grid grid-cols-2 gap-2">
                        <InputField label="Cidade" name="city" value={newAddress.city || ''} onChange={e => setNewAddress({...newAddress, city: e.target.value})} />
                        <InputField label="Estado" name="state" value={newAddress.state || ''} onChange={e => setNewAddress({...newAddress, state: e.target.value})} />
                    </div>
                    <button onClick={handleSave} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold">Salvar Endereço</button>
                </div>
            )}

            {loading ? <LoadingSpinner /> : addresses.map(addr => (
                <div key={addr.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl flex justify-between items-start bg-white dark:bg-slate-800">
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white">{addr.street}, {addr.number}</p>
                        <p className="text-sm text-slate-500">{addr.neighborhood}, {addr.city} - {addr.state}</p>
                        <p className="text-xs text-slate-400 mt-1">CEP: {addr.zipCode}</p>
                    </div>
                    <button onClick={() => handleDelete(addr.id)} className="text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </button>
                </div>
            ))}
        </div>
    )
};

const WalletView = ({ userId }: { userId: string }) => {
    const [cashback, setCashback] = useState(0);
    
    useEffect(() => {
        // Calcula cashback baseado em 1% das faturas pagas
        const calc = async () => {
            const { data } = await supabase.from('invoices').select('amount').eq('user_id', userId).eq('status', 'Paga');
            if(data) {
                const totalPaid = data.reduce((acc, curr) => acc + curr.amount, 0);
                setCashback(totalPaid * 0.01);
            }
        }
        calc();
    }, [userId]);

    return (
        <div className="animate-fade-in space-y-4">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <p className="text-sm opacity-80 font-medium">Cashback Disponível</p>
                <h2 className="text-4xl font-bold mt-1 tracking-tight">{cashback.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
                <p className="text-xs mt-4 opacity-70">1% de retorno em todas as faturas pagas</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                    Cupons Ativos
                </h3>
                <div className="border-l-4 border-green-500 pl-3 py-2 bg-green-50 dark:bg-green-900/10 rounded-r-md">
                    <p className="font-bold text-slate-800 dark:text-white">BEMVINDO10</p>
                    <p className="text-xs text-slate-500">10% off na primeira compra</p>
                </div>
            </div>
        </div>
    );
};

const PagePerfil: React.FC<PagePerfilProps> = ({ session }) => {
    const [activeView, setActiveView] = useState<'main' | 'data' | 'orders' | 'wallet' | 'addresses'>('main');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

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
                addToast('Foto de perfil atualizada!', 'success');
            };
            reader.readAsDataURL(file);
        }
    };

    const MenuBtn = ({ icon, label, onClick }: any) => (
        <button onClick={onClick} className="w-full flex items-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-[0.99] group">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">{icon}</div>
            <span className="ml-3 font-medium text-slate-700 dark:text-slate-200 flex-1 text-left">{label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
        </button>
    );

    const handleLogout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('relp_cart');
        localStorage.removeItem('isAdminLoggedIn');
        window.location.reload();
    }

    if (isLoading) return <div className="flex justify-center p-10"><LoadingSpinner /></div>;

    return (
        <div className="w-full max-w-md p-4 mx-auto pb-24">
            {activeView === 'main' ? (
                <div className="space-y-6 animate-fade-in">
                     {/* Header Profile */}
                    <div className="flex flex-col items-center text-center pt-4">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-indigo-100 dark:ring-indigo-900 shadow-lg">
                                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><svg className="w-10 h-10 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg></div>}
                            </div>
                            <div className="absolute bottom-0 right-0 bg-indigo-600 p-1.5 rounded-full text-white border-2 border-white dark:border-slate-900 shadow-md"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*"/>
                        </div>
                        <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">{profile?.first_name || 'Cliente'} {profile?.last_name}</h2>
                        <p className="text-sm text-slate-500">{session.user.email}</p>
                    </div>

                    {/* Menu Grid */}
                    <div className="space-y-3">
                        <MenuBtn icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>} label="Meus Pedidos" onClick={() => setActiveView('orders')} />
                        <MenuBtn icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} label="Carteira & Cashback" onClick={() => setActiveView('wallet')} />
                        <MenuBtn icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Meus Endereços" onClick={() => setActiveView('addresses')} />
                        {/* Placeholder for personal data editing logic */}
                    </div>

                    <button onClick={handleLogout} className="w-full py-3 text-red-600 font-bold border border-red-200 dark:border-red-900/50 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sair da conta
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <button onClick={() => setActiveView('main')} className="flex items-center text-indigo-600 font-bold mb-4 hover:underline">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Voltar
                    </button>
                    {activeView === 'orders' && <OrdersView userId={session.user.id} />}
                    {activeView === 'wallet' && <WalletView userId={session.user.id} />}
                    {activeView === 'addresses' && <AddressView userId={session.user.id} />}
                </div>
            )}
        </div>
    );
};

export default PagePerfil;