
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

type FormTab = 'geral' | 'desc' | 'specs' | 'preço' | 'estoque' | 'frete' | 'garantia' | 'visibilidade' | 'legal';

const ProductsTab: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [activeFormTab, setActiveFormTab] = useState<FormTab>('geral');
    const [aiInput, setAiInput] = useState('');
    const [isAILoading, setIsAILoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/products');
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch (e) { addToast("Erro ao carregar catálogo.", "error"); }
        finally { setIsLoading(false); }
    }, [addToast]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const handleAutoFill = async () => {
        if (!aiInput.trim()) return;
        setIsAILoading(true);
        try {
            const res = await fetch('/api/admin/auto-fill-product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawText: aiInput })
            });
            const data = await res.json();
            if (res.ok) {
                setEditingProduct(prev => ({ ...prev, ...data }));
                setAiInput('');
                addToast("Ficha técnica preenchida!", "success");
            } else throw new Error(data.error);
        } catch (e: any) { addToast(e.message, "error"); }
        finally { setIsAILoading(false); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            const res = await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingProduct)
            });
            const result = await res.json();
            if (res.ok) {
                addToast("Eletrônico salvo com sucesso!", "success");
                setEditingProduct(null);
                fetchProducts();
            } else {
                let msg = result.error || "Erro ao salvar.";
                if (msg.includes("column") || msg.includes("relation")) {
                    msg = "Erro de banco: Colunas ausentes. Vá em Ferramentas Dev e execute o Reparo Automático.";
                }
                throw new Error(msg);
            }
        } catch (error: any) { 
            setSaveError(error.message); 
            addToast(error.message, "error");
        }
        finally { setIsSaving(false); }
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Gestão de Catálogo</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Controle total Relp Cell</p>
                </div>
                <button onClick={() => { 
                    setEditingProduct({ 
                        status: 'active', condition: 'novo', is_new: true, allow_reviews: true, 
                        max_installments: 12, min_stock_alert: 2, stock: 0, cost_price: 0, price: 0,
                        availability: 'pronta_entrega', has_invoice: true 
                    }); 
                    setActiveFormTab('geral'); 
                }} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:scale-105 transition-all text-xs uppercase">+ Adicionar Produto</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 px-2">
                {Array.isArray(products) && products.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm group">
                        <div className="aspect-square bg-white flex items-center justify-center p-4">
                            <img src={p.image_url!} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform" alt={p.name} />
                        </div>
                        <div className="p-3 border-t border-slate-50 dark:border-slate-700">
                            <h4 className="text-[10px] font-black text-indigo-600 truncate uppercase">{p.brand}</h4>
                            <h3 className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.name}</h3>
                            <p className="text-sm font-black text-slate-900 dark:text-white mt-1">R$ {Number(p.price).toLocaleString('pt-BR')}</p>
                            <button onClick={() => { setEditingProduct(p); setActiveFormTab('geral'); }} className="mt-3 w-full py-2 text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Editar</button>
                        </div>
                    </div>
                ))}
            </div>

            {editingProduct && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-4xl h-[94vh] flex flex-col shadow-2xl animate-pop-in overflow-hidden border border-white/20">
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="text-xl font-black uppercase tracking-tighter">Ficha Técnica</h3>
                            <button onClick={() => setEditingProduct(null)} className="p-2.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 hover:text-red-500 transition-colors">✕</button>
                        </div>

                        <div className="p-4 bg-indigo-600 text-white flex gap-3 items-center">
                            <div className="bg-white/20 p-2 rounded-xl text-xl animate-pulse">🤖</div>
                            <input 
                                type="text" value={aiInput} onChange={e => setAiInput(e.target.value)}
                                placeholder="Cole as specs brutas aqui..."
                                className="flex-1 bg-white/10 border-none rounded-xl placeholder-white/60 text-sm focus:ring-0 text-white font-medium"
                            />
                            <button onClick={handleAutoFill} disabled={isAILoading || !aiInput} className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase shadow-lg disabled:opacity-50">
                                {isAILoading ? 'Extraindo...' : 'Auto-Preencher'}
                            </button>
                        </div>

                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 overflow-x-auto no-scrollbar border-b dark:border-slate-700">
                            {[
                                { id: 'geral', label: 'Geral' },
                                { id: 'specs', label: 'Hardware' },
                                { id: 'preço', label: 'Financeiro' },
                                { id: 'estoque', label: 'Logística' }
                            ].map(tab => (
                                <button key={tab.id} onClick={() => setActiveFormTab(tab.id as any)} className={`flex-shrink-0 px-5 py-3 text-[10px] font-black uppercase transition-all rounded-xl ${activeFormTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{tab.label}</button>
                            ))}
                        </div>

                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-slate-900">
                            {saveError && <div className="mb-4"><Alert message={saveError} type="error" /></div>}

                            {activeFormTab === 'geral' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="w-full md:w-1/3">
                                            <div onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer overflow-hidden group">
                                                {editingProduct.image_url ? <img src={editingProduct.image_url} className="w-full h-full object-contain" /> : <span className="text-[10px] font-bold text-slate-400 uppercase">FOTO</span>}
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = () => setEditingProduct({...editingProduct, image_url: reader.result as string});
                                                    reader.readAsDataURL(file);
                                                }
                                            }} accept="image/*" className="hidden" />
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div><label className="text-[10px] font-black uppercase text-slate-400">Nome Comercial</label><input type="text" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold" required /></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className="text-[10px] font-black uppercase text-slate-400">Marca</label><input type="text" value={editingProduct.brand || ''} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                                <div><label className="text-[10px] font-black uppercase text-slate-400">SKU</label><input type="text" value={editingProduct.sku || ''} onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeFormTab === 'specs' && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 animate-fade-in">
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Processador</label><input type="text" value={editingProduct.processor || ''} onChange={e => setEditingProduct({...editingProduct, processor: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">RAM</label><input type="text" value={editingProduct.ram || ''} onChange={e => setEditingProduct({...editingProduct, ram: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Display</label><input type="text" value={editingProduct.display || ''} onChange={e => setEditingProduct({...editingProduct, display: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                </div>
                            )}

                            {activeFormTab === 'preço' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                                            <label className="text-[10px] font-black uppercase text-indigo-500">Venda (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: e.target.value})} className="w-full bg-transparent border-none text-3xl font-black text-indigo-700 outline-none" required />
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Custo (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.cost_price || 0} onChange={e => setEditingProduct({...editingProduct, cost_price: e.target.value})} className="w-full bg-transparent border-none text-2xl font-black text-slate-700 outline-none" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-10 flex gap-4 pb-12">
                                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl">DESCARTAR</button>
                                <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl disabled:opacity-50">
                                    {isSaving ? <LoadingSpinner /> : 'SALVAR NO CATÁLOGO'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductsTab;
