
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

type FormTab = 'geral' | 'specs' | 'financeiro' | 'logistica';

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
                addToast("IA processou as dimensões em CM e peso em G!", "success");
            }
        } catch (e) { addToast("Falha na IA.", "error"); }
        finally { setIsAILoading(false); }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result as string;
                setEditingProduct(prev => ({ ...prev, image_url: base64 }));
            };
            reader.readAsDataURL(file);
        }
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
                addToast("Produto salvo!", "success");
                setEditingProduct(null);
                fetchProducts();
            } else throw new Error(result.error);
        } catch (error: any) {
            setSaveError(error.message || "Erro ao salvar.");
        } finally { setIsSaving(false); }
    };

    // Cálculos de Lucro
    const price = Number(editingProduct?.price) || 0;
    const cost = Number(editingProduct?.cost_price) || 0;
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Catálogo Relp Cell</h2>
                    <p className="text-xs text-slate-500 font-bold">Gestão de Estoque e Margem de Lucro.</p>
                </div>
                <button onClick={() => { setEditingProduct({ status: 'active', condition: 'novo', is_new: true, allow_reviews: true, max_installments: 12, min_stock_alert: 2, cost_price: 0 }); setActiveFormTab('geral'); setSaveError(null); }} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/30 active:scale-95 transition-all text-xs uppercase tracking-tighter">+ Novo Item</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 px-2">
                {products.map(p => (
                    <div key={p.id} className={`bg-white dark:bg-slate-800 rounded-3xl border overflow-hidden shadow-sm hover:shadow-md transition-all group ${p.stock <= p.min_stock_alert ? 'border-red-400 animate-pulse ring-2 ring-red-100' : 'border-slate-100 dark:border-slate-700'}`}>
                        <div className="aspect-square bg-white flex items-center justify-center p-4 relative">
                            <img src={p.image_url!} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform" />
                            {p.stock <= p.min_stock_alert && <div className="absolute top-2 left-2 bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase">Estoque Crítico</div>}
                        </div>
                        <div className="p-3 border-t border-slate-50 dark:border-slate-700">
                            <h3 className="text-[9px] font-black text-slate-400 uppercase">{p.brand}</h3>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.name}</h4>
                            <div className="flex justify-between items-end mt-2">
                                <p className="text-sm font-black text-indigo-600">R$ {p.price.toLocaleString('pt-BR')}</p>
                                <span className={`text-[10px] font-bold ${p.stock <= p.min_stock_alert ? 'text-red-600' : 'text-slate-400'}`}>{p.stock} un</span>
                            </div>
                            <button onClick={() => { setEditingProduct(p); setActiveFormTab('geral'); setSaveError(null); }} className="mt-3 w-full py-2 text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Editar</button>
                        </div>
                    </div>
                ))}
            </div>

            {editingProduct && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl h-[92vh] flex flex-col shadow-2xl animate-pop-in overflow-hidden border border-white/20">
                        {/* Header Modal */}
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Editor de Produto</h3>
                                {profit > 0 && <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">Lucro: R$ {profit.toLocaleString('pt-BR')} ({margin.toFixed(1)}%)</span>}
                            </div>
                            <button onClick={() => setEditingProduct(null)} className="p-2.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 hover:text-red-500 transition-colors">✕</button>
                        </div>

                        {/* IA Assistant Bar */}
                        <div className="p-4 bg-indigo-600 text-white flex gap-3 items-center">
                            <div className="bg-white/20 p-2 rounded-xl text-xl">🤖</div>
                            <input 
                                type="text" value={aiInput} onChange={e => setAiInput(e.target.value)}
                                placeholder="Cole as specs do Moto G06 ou outro aqui..."
                                className="flex-1 bg-white/10 border-none rounded-xl placeholder-white/60 text-sm focus:ring-0 text-white"
                            />
                            <button onClick={handleAutoFill} disabled={isAILoading || !aiInput} className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase shadow-lg disabled:opacity-50 active:scale-95 transition-all">
                                {isAILoading ? 'Processando...' : 'Auto-Cadastro IA'}
                            </button>
                        </div>

                        {/* Tabs Internas */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 gap-1">
                            {[
                                { id: 'geral', label: 'Cadastro', icon: '📝' },
                                { id: 'specs', label: 'Técnico', icon: '⚙️' },
                                { id: 'financeiro', label: 'Lucro & Estoque', icon: '💰' },
                                { id: 'logistica', label: 'Dimensões', icon: '🚚' }
                            ].map(tab => (
                                <button 
                                    key={tab.id} onClick={() => setActiveFormTab(tab.id as any)}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 rounded-xl transition-all ${activeFormTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-800' : 'text-slate-400'}`}
                                >
                                    <span>{tab.icon}</span> {tab.label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-white dark:bg-slate-900">
                            {saveError && <Alert message={saveError} type="error" />}

                            {activeFormTab === 'geral' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="w-full md:w-1/3 flex flex-col items-center">
                                            <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-square rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-indigo-500 transition-all">
                                                {editingProduct.image_url ? <img src={editingProduct.image_url} className="w-full h-full object-contain" /> : <span className="text-[10px] font-bold text-slate-400">ENVIAR FOTO</span>}
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div><label className="text-[10px] font-black uppercase text-slate-400">Nome Comercial</label><input type="text" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold shadow-sm" required /></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className="text-[10px] font-black uppercase text-slate-400">Marca</label><input type="text" value={editingProduct.brand || ''} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                                <div><label className="text-[10px] font-black uppercase text-slate-400">Categoria</label><input type="text" value={editingProduct.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeFormTab === 'specs' && (
                                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Processador</label><input type="text" value={editingProduct.processor || ''} onChange={e => setEditingProduct({...editingProduct, processor: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">RAM</label><input type="text" value={editingProduct.ram || ''} onChange={e => setEditingProduct({...editingProduct, ram: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Armazenamento</label><input type="text" value={editingProduct.storage || ''} onChange={e => setEditingProduct({...editingProduct, storage: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Bateria</label><input type="text" value={editingProduct.battery || ''} onChange={e => setEditingProduct({...editingProduct, battery: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                </div>
                            )}

                            {activeFormTab === 'financeiro' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100">
                                            <label className="text-[10px] font-black uppercase text-indigo-500">Venda (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-transparent border-none text-2xl font-black text-indigo-700 outline-none" required />
                                        </div>
                                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-3xl border border-slate-200">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Custo (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.cost_price || 0} onChange={e => setEditingProduct({...editingProduct, cost_price: Number(e.target.value)})} className="w-full bg-transparent border-none text-2xl font-black text-slate-700 outline-none" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100">
                                            <span className="text-[10px] font-black text-emerald-600 uppercase">Lucro Bruto: R$ {profit.toFixed(2)}</span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100">
                                            <span className="text-[10px] font-black text-blue-600 uppercase">Margem: {margin.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Estoque Atual</label><input type="number" value={editingProduct.stock || 0} onChange={e => setEditingProduct({...editingProduct, stock: Number(e.target.value)})} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none font-black text-xl" required /></div>
                                        <div><label className="text-[10px] font-black uppercase text-red-500">Alerta de Mínimo</label><input type="number" value={editingProduct.min_stock_alert || 2} onChange={e => setEditingProduct({...editingProduct, min_stock_alert: Number(e.target.value)})} className="w-full p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border-none font-black text-red-600 text-xl" /></div>
                                    </div>
                                </div>
                            )}

                            {activeFormTab === 'logistica' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100">
                                        <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Cálculo de Frete Amapá</h4>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div><label className="text-[10px] font-black uppercase text-slate-500">Peso (Gramas)</label><input type="number" value={editingProduct.weight || 0} onChange={e => setEditingProduct({...editingProduct, weight: Number(e.target.value)})} className="w-full p-4 bg-white dark:bg-slate-900 rounded-2xl border-none font-black shadow-sm" /><span className="text-[9px] text-slate-400 mt-1 block">Ex: 194g (Moto G06)</span></div>
                                            <div className="flex items-center"><div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-[10px] text-indigo-600 font-bold leading-tight italic">Dica: Medidas em CM ajudam no cálculo de cubagem da transportadora.</div></div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div><label className="text-[10px] font-black uppercase text-slate-500">Altura (cm)</label><input type="number" step="0.01" value={editingProduct.height || 0} onChange={e => setEditingProduct({...editingProduct, height: Number(e.target.value)})} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border-none font-bold" /></div>
                                            <div><label className="text-[10px] font-black uppercase text-slate-500">Largura (cm)</label><input type="number" step="0.01" value={editingProduct.width || 0} onChange={e => setEditingProduct({...editingProduct, width: Number(e.target.value)})} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border-none font-bold" /></div>
                                            <div><label className="text-[10px] font-black uppercase text-slate-500">Profund. (cm)</label><input type="number" step="0.01" value={editingProduct.length || 0} onChange={e => setEditingProduct({...editingProduct, length: Number(e.target.value)})} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border-none font-bold" /></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-10 flex gap-4 pb-12">
                                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-2xl active:scale-95 transition-all">CANCELAR</button>
                                <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/40 disabled:opacity-50 active:scale-[0.98] transition-all flex justify-center items-center gap-2">
                                    {isSaving ? <LoadingSpinner /> : (editingProduct.id ? 'ATUALIZAR PRODUTO' : 'CADASTRAR NOVO')}
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
