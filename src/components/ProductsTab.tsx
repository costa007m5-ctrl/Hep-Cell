
import React, { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

const ProductsTab: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const { addToast } = useToast();

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/products');
            if (!response.ok) throw new Error('Falha no servidor');
            const data = await response.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch (err) {
            setError("Não foi possível carregar o catálogo.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        try {
            const res = await fetch('/api/admin/products', {
                method: editingProduct.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingProduct)
            });
            if (res.ok) {
                addToast("Produto salvo!", "success");
                setShowForm(false);
                fetchProducts();
            }
        } catch (e) { addToast("Erro ao salvar.", "error"); }
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Catálogo de Produtos</h2>
                <button onClick={() => { setEditingProduct({}); setShowForm(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase shadow-lg shadow-indigo-500/20 transition-all active:scale-95">+ Adicionar</button>
            </div>

            {error && <Alert message={error} type="error" />}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {products.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm group">
                        <div className="aspect-square bg-white flex items-center justify-center p-4">
                            <img src={p.image_url || ''} className="max-h-full object-contain" alt={p.name} />
                        </div>
                        <div className="p-3">
                            <h3 className="text-[11px] font-bold text-slate-800 dark:text-white truncate">{p.name}</h3>
                            <p className="text-sm font-black text-indigo-600">R$ {p.price.toLocaleString('pt-BR')}</p>
                            <div className="mt-2 flex justify-between items-center">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Est: {p.stock}</span>
                                <button onClick={() => { setEditingProduct(p); setShowForm(true); }} className="text-[10px] text-indigo-500 font-bold hover:underline">EDITAR</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showForm && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-pop-in">
                        <h3 className="text-xl font-black mb-6">Ficha do Produto</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div><label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Nome</label><input type="text" value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700" required /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Preço</label><input type="number" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700" required /></div>
                                <div><label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Estoque</label><input type="number" value={editingProduct?.stock || ''} onChange={e => setEditingProduct({...editingProduct, stock: Number(e.target.value)})} className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700" required /></div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 font-bold text-slate-400 hover:text-slate-600">Cancelar</button>
                                <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30">Salvar Alterações</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductsTab;
