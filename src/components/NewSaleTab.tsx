
import React, { useState, useEffect, useMemo } from 'react';
import { Profile, Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from './Toast';

const NewSaleTab: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchProd, setSearchProd] = useState('');
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [cart, setCart] = useState<Product[]>([]);
    const { addToast } = useToast();

    useEffect(() => {
        const load = async () => {
            try {
                const [pRes, clRes] = await Promise.all([
                    fetch('/api/admin/products'),
                    fetch('/api/admin/profiles')
                ]);
                setProducts(await pRes.json());
                setProfiles(await clRes.json());
            } catch (e) { console.error(e); }
            finally { setIsLoading(false); }
        };
        load();
    }, []);

    const filtered = products.filter(p => p.name.toLowerCase().includes(searchProd.toLowerCase()));
    const total = cart.reduce((acc, curr) => acc + curr.price, 0);

    const handleFinish = async () => {
        if (!selectedClient || cart.length === 0) {
            addToast("Selecione um cliente e produtos.", "error");
            return;
        }
        addToast("Processando venda...", "info");
        // Simulação de venda simplificada para admin
        setTimeout(() => {
            addToast("Venda realizada com sucesso!", "success");
            setCart([]);
            setSelectedClient('');
        }, 1500);
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="flex h-[calc(100vh-120px)] gap-6 animate-fade-in">
            {/* Esquerda: Produtos */}
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                    <input 
                        type="text" placeholder="Filtrar catálogo..." 
                        value={searchProd} onChange={e => setSearchProd(e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 outline-none"
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map(p => (
                        <button key={p.id} onClick={() => setCart([...cart, p])} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 text-left hover:border-indigo-500 transition-all active:scale-95">
                            <p className="text-xs font-bold truncate">{p.name}</p>
                            <p className="text-sm font-black text-indigo-600">R$ {p.price.toLocaleString('pt-BR')}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Direita: Carrinho */}
            <div className="w-[320px] bg-slate-900 text-white rounded-[2rem] p-6 flex flex-col shadow-2xl">
                <h3 className="text-lg font-black mb-6 uppercase tracking-tighter italic">Checkout Rápido</h3>
                
                <div className="mb-6">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cliente</label>
                    <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="w-full p-3 rounded-xl bg-white/10 border border-white/10 text-sm outline-none">
                        <option value="" disabled className="text-slate-900">Selecionar cliente...</option>
                        {profiles.map(p => <option key={p.id} value={p.id} className="text-slate-900">{p.first_name} {p.last_name}</option>)}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 mb-6">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-xs truncate max-w-[150px]">{item.name}</span>
                            <span className="text-xs font-bold">R$ {item.price.toLocaleString('pt-BR')}</span>
                        </div>
                    ))}
                </div>

                <div className="pt-6 border-t border-white/10">
                    <div className="flex justify-between items-end mb-6">
                        <span className="text-slate-400 text-xs font-bold uppercase">Total</span>
                        <span className="text-3xl font-black text-white">R$ {total.toLocaleString('pt-BR')}</span>
                    </div>
                    <button onClick={handleFinish} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">FINALIZAR VENDA</button>
                </div>
            </div>
        </div>
    );
};

export default NewSaleTab;
