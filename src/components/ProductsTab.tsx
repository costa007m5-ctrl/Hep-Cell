
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

type FormTab = 'geral' | 'desc' | 'specs' | 'preço' | 'estoque' | 'logistica' | 'garantia' | 'visibilidade' | 'legal';

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
                // Mescla profunda dos dados retornados pela IA
                setEditingProduct(prev => ({ 
                    ...prev, 
                    ...data,
                    // Garante que o SKU e Preço existam
                    sku: data.sku || prev?.sku,
                    price: data.price || prev?.price || 0,
                    // Garante booleanos padrão se vazios
                    allow_reviews: true,
                    is_new: true
                }));
                setAiInput('');
                addToast("Ficha técnica extraída com sucesso!", "success");
            } else {
                throw new Error(data.error || "Falha na análise.");
            }
        } catch (e: any) { 
            addToast(e.message, "error"); 
        } finally { 
            setIsAILoading(false); 
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setEditingProduct(prev => ({ ...prev, image_url: reader.result as string }));
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
            if (res.ok) {
                addToast("Produto publicado!", "success");
                setEditingProduct(null);
                fetchProducts();
            } else throw new Error("Erro ao salvar.");
        } catch (error: any) { setSaveError(error.message); }
        finally { setIsSaving(false); }
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Gestão de Catálogo</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Controle Profissional</p>
                </div>
                <button onClick={() => { 
                    setEditingProduct({ 
                        status: 'active', condition: 'novo', is_new: true, allow_reviews: true, 
                        max_installments: 12, min_stock_alert: 2, stock: 0, cost_price: 0, 
                        availability: 'pronta_entrega', has_invoice: true 
                    }); 
                    setActiveFormTab('geral'); 
                }} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/30 active:scale-95 transition-all text-xs uppercase tracking-tighter">+ Novo Cadastro</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 px-2">
                {products.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                        <div className="aspect-square bg-white flex items-center justify-center p-4">
                            <img src={p.image_url!} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform" alt={p.name} />
                        </div>
                        <div className="p-3 border-t border-slate-50 dark:border-slate-700">
                            <h3 className="text-[9px] font-black text-slate-400 uppercase truncate">{p.brand} | {p.sku}</h3>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.name}</h4>
                            <div className="flex justify-between items-end mt-2">
                                <p className="text-sm font-black text-indigo-600">R$ {p.price.toLocaleString('pt-BR')}</p>
                                <span className={`text-[10px] font-bold ${p.stock <= (p.min_stock_alert || 2) ? 'text-red-600' : 'text-slate-400'}`}>{p.stock} un</span>
                            </div>
                            <button onClick={() => { setEditingProduct(p); setActiveFormTab('geral'); }} className="mt-3 w-full py-2 text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Editar</button>
                        </div>
                    </div>
                ))}
            </div>

            {editingProduct && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-4xl h-[94vh] flex flex-col shadow-2xl animate-pop-in overflow-hidden border border-white/20">
                        {/* Header Modal */}
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Ficha do Eletrônico</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{editingProduct.id ? 'Editando Item' : 'Novo Cadastro'}</p>
                            </div>
                            <button onClick={() => setEditingProduct(null)} className="p-2.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 hover:text-red-500 transition-colors">✕</button>
                        </div>

                        {/* IA Assistant Bar - SUPER IMPORTANTE */}
                        <div className="p-4 bg-indigo-600 text-white flex gap-3 items-center">
                            <div className="bg-white/20 p-2 rounded-xl text-xl animate-pulse">🤖</div>
                            <input 
                                type="text" value={aiInput} onChange={e => setAiInput(e.target.value)}
                                placeholder="Cole as especificações aqui para a IA preencher o formulário..."
                                className="flex-1 bg-white/10 border-none rounded-xl placeholder-white/60 text-sm focus:ring-0 text-white font-medium"
                            />
                            <button onClick={handleAutoFill} disabled={isAILoading || !aiInput} className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-100 disabled:opacity-50 active:scale-95 transition-all">
                                {isAILoading ? <LoadingSpinner /> : 'AUTOPREENCHER IA'}
                            </button>
                        </div>

                        {/* Tabs Internas */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 overflow-x-auto no-scrollbar border-b dark:border-slate-700">
                            {[
                                { id: 'geral', label: 'Principal' },
                                { id: 'desc', label: 'Descrição' },
                                { id: 'specs', label: 'Técnico' },
                                { id: 'preço', label: 'Financeiro' },
                                { id: 'estoque', label: 'Estoque' },
                                { id: 'logistica', label: 'Dimensões/Log' },
                                { id: 'garantia', label: 'Garantia' },
                                { id: 'visibilidade', label: 'Status' }
                            ].map(tab => (
                                <button 
                                    key={tab.id} onClick={() => setActiveFormTab(tab.id as any)}
                                    className={`flex-shrink-0 px-5 py-3 text-[10px] font-black uppercase transition-all rounded-xl ${activeFormTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-slate-900">
                            {saveError && <Alert message={saveError} type="error" />}

                            {/* SEÇÃO GERAL */}
                            {activeFormTab === 'geral' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="w-full md:w-1/3 space-y-4">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Foto</label>
                                            <div onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-indigo-500 transition-all">
                                                {editingProduct.image_url ? <img src={editingProduct.image_url} className="w-full h-full object-contain" /> : <span className="text-[10px] font-bold text-slate-400 uppercase">UPLOAD</span>}
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div><label className="text-[10px] font-black uppercase text-slate-400">Nome Comercial</label><input type="text" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold" required /></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className="text-[10px] font-black uppercase text-slate-400">Marca</label><input type="text" value={editingProduct.brand || ''} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                                <div><label className="text-[10px] font-black uppercase text-slate-400">Modelo</label><input type="text" value={editingProduct.model || ''} onChange={e => setEditingProduct({...editingProduct, model: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                            </div>
                                            <div><label className="text-[10px] font-black uppercase text-slate-400">Código/SKU</label><input type="text" value={editingProduct.sku || ''} onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ESPECIFICAÇÕES TÉCNICAS (DETALHADAS) */}
                            {activeFormTab === 'specs' && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 animate-fade-in">
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Processador</label><input type="text" value={editingProduct.processor || ''} onChange={e => setEditingProduct({...editingProduct, processor: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">RAM</label><input type="text" value={editingProduct.ram || ''} onChange={e => setEditingProduct({...editingProduct, ram: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Armazenamento</label><input type="text" value={editingProduct.storage || ''} onChange={e => setEditingProduct({...editingProduct, storage: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Tela</label><input type="text" value={editingProduct.display || ''} onChange={e => setEditingProduct({...editingProduct, display: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Bateria</label><input type="text" value={editingProduct.battery || ''} onChange={e => setEditingProduct({...editingProduct, battery: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Câmeras</label><input type="text" value={editingProduct.camera || ''} onChange={e => setEditingProduct({...editingProduct, camera: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                </div>
                            )}

                            {/* LOGISTICA (PESO E DIMENSÕES) */}
                            {activeFormTab === 'logistica' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Peso (g)</label><input type="number" value={editingProduct.weight || 0} onChange={e => setEditingProduct({...editingProduct, weight: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Altura (cm)</label><input type="number" step="0.01" value={editingProduct.height || 0} onChange={e => setEditingProduct({...editingProduct, height: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Largura (cm)</label><input type="number" step="0.01" value={editingProduct.width || 0} onChange={e => setEditingProduct({...editingProduct, width: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Compr. (cm)</label><input type="number" step="0.01" value={editingProduct.length || 0} onChange={e => setEditingProduct({...editingProduct, length: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                    </div>
                                </div>
                            )}

                            {/* PREÇO */}
                            {activeFormTab === 'preço' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100">
                                            <label className="text-[10px] font-black uppercase text-indigo-500">Preço Venda (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-transparent border-none text-2xl font-black text-indigo-700 outline-none" required />
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Preço Custo (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.cost_price || 0} onChange={e => setEditingProduct({...editingProduct, cost_price: Number(e.target.value)})} className="w-full bg-transparent border-none text-2xl font-black text-slate-700 dark:text-slate-300 outline-none" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-10 flex gap-4 pb-12">
                                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-2xl active:scale-95 transition-all">CANCELAR</button>
                                <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/40 disabled:opacity-50 active:scale-[0.98] transition-all flex justify-center items-center gap-2">
                                    {isSaving ? <LoadingSpinner /> : (editingProduct.id ? 'ATUALIZAR' : 'CADASTRAR')}
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
