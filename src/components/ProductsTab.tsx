
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

const ProductsTab: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const { addToast } = useToast();

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/products');
            setProducts(await res.json());
        } catch (e) { addToast("Erro ao carregar catálogo", "error"); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchProducts(); }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        const res = await fetch('/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingProduct)
        });
        if (res.ok) {
            addToast("Produto salvo!", "success");
            setEditingProduct(null);
            fetchProducts();
        }
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">Catálogo de Produtos</h2>
                <button onClick={() => setEditingProduct({})} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold">+ Adicionar</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {products.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                        <div className="aspect-square bg-white flex items-center justify-center p-4">
                            <img src={p.image_url || ''} className="max-h-full object-contain" alt={p.name} />
                        </div>
                        <div className="p-3 border-t border-slate-50 dark:border-slate-700">
                            <h3 className="text-xs font-bold truncate">{p.name}</h3>
                            <p className="text-sm font-black text-indigo-600">R$ {p.price.toLocaleString('pt-BR')}</p>
                            <button onClick={() => setEditingProduct(p)} className="mt-2 w-full py-1.5 text-[10px] font-black uppercase border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50">Editar</button>
                        </div>
                    </div>
                ))}
            </div>

            {editingProduct && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-pop-in">
                        <h3 className="text-xl font-black mb-6">Ficha do Produto</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Nome</label><input type="text" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl" required /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Preço (R$)</label><input type="number" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl" required /></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Estoque</label><input type="number" value={editingProduct.stock || 0} onChange={e => setEditingProduct({...editingProduct, stock: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl" required /></div>
                            </div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">URL da Imagem</label><input type="text" value={editingProduct.image_url || ''} onChange={e => setEditingProduct({...editingProduct, image_url: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl" /></div>
                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-3 text-slate-400 font-bold">Cancelar</button>
                                <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">Salvar Produto</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductsTab;
