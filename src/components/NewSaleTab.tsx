
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Profile, Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from './Toast';
import Alert from './Alert';

const NewSaleTab: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchProd, setSearchProd] = useState('');
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [cart, setCart] = useState<Product[]>([]);
    const { addToast } = useToast();

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [pRes, clRes] = await Promise.all([
                fetch('/api/admin/products'),
                fetch('/api/admin/profiles')
            ]);
            
            const pData = await pRes.json();
            const clData = await clRes.json();

            setProducts(Array.isArray(pData) ? pData : []);
            setProfiles(Array.isArray(clData) ? clData : []);
        } catch (e: any) {
            setError("Erro ao carregar dados do catálogo.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered = useMemo(() => {
        if (!Array.isArray(products)) return [];
        return products.filter(p => p.name.toLowerCase().includes(searchProd.toLowerCase()));
    }, [products, searchProd]);

    const total = cart.reduce((acc, curr) => acc + curr.price, 0);

    const handleFinish = async () => {
        if (!selectedClient || cart.length === 0) {
            addToast("Selecione um cliente e produtos.", "error");
            return;
        }
        addToast("Processando venda...", "info");
        setTimeout(() => {
            addToast("Venda realizada com sucesso!", "success");
            setCart([]);
            setSelectedClient('');
        }, 1500);
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;
    if (error) return <div className="p-10"><Alert message={error} type="error" /></div>;

    return (
        <div className="flex h-[calc(100vh-120px)] gap-6 animate-fade-in">
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                    <input 
                        type="text" placeholder="Filtrar catálogo..." 
                        value={searchProd} onChange={e => setSearchProd(e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map(p => (
                        <button key={p.id} onClick={() => setCart([...cart, p])} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 text-left hover:border-indigo-500 transition-all active:scale-95 group">
                            <div className="aspect-square bg-white rounded-lg mb-2 flex items-center justify-center p-2">
                                <img src={p.image_url || ''} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase truncate">{p.brand}</p>
                            <p className="text-xs font-bold truncate text-slate-800 dark:text-white">{p.name}</p>
                            <p className="text-sm font-black text-indigo-600 mt-1">R$ {p.price.toLocaleString('pt-BR')}</p>
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-[320px] bg-slate-900 text-white rounded-[2rem] p-6 flex flex-col shadow-2xl">
                <h3 className="text-lg font-black mb-6 uppercase tracking-tighter italic">Checkout Rápido</h3>
                
                <div className="mb-6">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cliente Beneficiário</label>
                    <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="w-full p-3 rounded-xl bg-white/10 border border-white/10 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="" disabled className="text-slate-900">Selecionar cliente...</option>
                        {profiles.map(p => <option key={p.id} value={p.id} className="text-slate-900">{p.first_name} {p.last_name}</option>)}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 mb-6 custom-scrollbar">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 group">
                            <div className="flex-1 min-w-0 mr-2">
                                <span className="text-[10px] block truncate text-slate-400">{item.name}</span>
                                <span className="text-xs font-bold">R$ {item.price.toLocaleString('pt-BR')}</span>
                            </div>
                            <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                    ))}
                </div>

                <div className="pt-6 border-t border-white/10">
                    <div className="flex justify-between items-end mb-6">
                        <span className="text-slate-400 text-xs font-bold uppercase">Total Geral</span>
                        <span className="text-3xl font-black text-white">R$ {total.toLocaleString('pt-BR')}</span>
                    </div>
                    <button onClick={handleFinish} disabled={cart.length === 0} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50">FINALIZAR VENDA</button>
                </div>
            </div>
        </div>
    );
};

export default NewSaleTab;
