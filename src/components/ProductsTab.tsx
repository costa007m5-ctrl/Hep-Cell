
import React, { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

type FormTab = 'geral' | 'specs' | 'financeiro' | 'logistica';

const ProductsTab: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [activeFormTab, setActiveFormTab] = useState<FormTab>('geral');
    const [aiInput, setAiInput] = useState('');
    const [isAILoading, setIsAILoading] = useState(false);
    
    const { addToast } = useToast();

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/products');
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch (e) { setError("Erro ao carregar catálogo."); }
        finally { setIsLoading(false); }
    }, []);

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
                addToast("IA preencheu os campos detectados!", "success");
            }
        } catch (e) { addToast("Falha na IA.", "error"); }
        finally { setIsAILoading(false); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        const res = await fetch('/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingProduct)
        });
        if (res.ok) {
            addToast("Produto salvo com sucesso!", "success");
            setEditingProduct(null);
            fetchProducts();
        } else {
            addToast("Erro ao salvar.", "error");
        }
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Gerenciar Loja</h2>
                <button onClick={() => { setEditingProduct({ status: 'active', condition: 'novo', is_new: true, allow_reviews: true, max_installments: 12 }); setActiveFormTab('geral'); }} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30">+ Novo Produto</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {products.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                        <div className="aspect-square bg-white flex items-center justify-center p-4 relative">
                            <img src={p.image_url!} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform" />
                            {p.stock <= p.min_stock_alert && <span className="absolute top-2 right-2 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded font-bold uppercase">Baixo Estoque</span>}
                        </div>
                        <div className="p-3 border-t border-slate-50 dark:border-slate-700">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase mb-1">{p.brand}</h3>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.name}</h4>
                            <p className="text-sm font-black text-indigo-600 mt-1">R$ {p.price.toLocaleString('pt-BR')}</p>
                            <button onClick={() => { setEditingProduct(p); setActiveFormTab('geral'); }} className="mt-3 w-full py-2 text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">Editar Ficha</button>
                        </div>
                    </div>
                ))}
            </div>

            {editingProduct && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl animate-pop-in overflow-hidden">
                        {/* Header Modal */}
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-xl font-black">Ficha do Eletrônico</h3>
                                <p className="text-xs text-slate-500">Cadastre ou edite as informações completas</p>
                            </div>
                            <button onClick={() => setEditingProduct(null)} className="p-2 text-slate-400 hover:text-red-500">✕</button>
                        </div>

                        {/* AI Assistant Bar */}
                        <div className="p-4 bg-indigo-600 text-white flex gap-3 items-center">
                            <div className="bg-white/20 p-2 rounded-lg"><span className="text-xl">🤖</span></div>
                            <div className="flex-1">
                                <input 
                                    type="text" value={aiInput} onChange={e => setAiInput(e.target.value)}
                                    placeholder="Cole aqui o texto do fabricante para preencher tudo..."
                                    className="w-full bg-white/10 border-none rounded-lg placeholder-white/60 text-sm focus:ring-0"
                                />
                            </div>
                            <button onClick={handleAutoFill} disabled={isAILoading || !aiInput} className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-bold text-xs uppercase disabled:opacity-50">
                                {isAILoading ? 'Extraindo...' : 'Auto-Preencher'}
                            </button>
                        </div>

                        {/* Tabs Internas */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1">
                            {[
                                { id: 'geral', label: '1. Geral', icon: '📝' },
                                { id: 'specs', label: '2. Especificações', icon: '⚙️' },
                                { id: 'financeiro', label: '3. Preço/Estoque', icon: '💰' },
                                { id: 'logistica', label: '4. Logística/Legal', icon: '🚚' }
                            ].map(tab => (
                                <button 
                                    key={tab.id} onClick={() => setActiveFormTab(tab.id as any)}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 rounded-xl transition-all ${activeFormTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                                >
                                    <span>{tab.icon}</span> {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Conteúdo Form */}
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                            
                            {activeFormTab === 'geral' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nome do Produto</label><input type="text" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" required /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Categoria</label><input type="text" value={editingProduct.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" required /></div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Marca</label><input type="text" value={editingProduct.brand || ''} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Modelo</label><input type="text" value={editingProduct.model || ''} onChange={e => setEditingProduct({...editingProduct, model: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Condição</label>
                                            <select value={editingProduct.condition} onChange={e => setEditingProduct({...editingProduct, condition: e.target.value as any})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none">
                                                <option value="novo">Novo</option>
                                                <option value="lacrado">Lacrado</option>
                                                <option value="recondicionado">Vitrine/Usado</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">URL Imagem Principal</label><input type="text" value={editingProduct.image_url || ''} onChange={e => setEditingProduct({...editingProduct, image_url: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Descrição Detalhada</label><textarea rows={3} value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none text-sm"></textarea></div>
                                </div>
                            )}

                            {activeFormTab === 'specs' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Processador</label><input type="text" value={editingProduct.processor || ''} onChange={e => setEditingProduct({...editingProduct, processor: e.target.value})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Memória RAM</label><input type="text" value={editingProduct.ram || ''} onChange={e => setEditingProduct({...editingProduct, ram: e.target.value})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Armazenamento</label><input type="text" value={editingProduct.storage || ''} onChange={e => setEditingProduct({...editingProduct, storage: e.target.value})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Bateria</label><input type="text" value={editingProduct.battery || ''} onChange={e => setEditingProduct({...editingProduct, battery: e.target.value})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Câmeras</label><input type="text" value={editingProduct.camera || ''} onChange={e => setEditingProduct({...editingProduct, camera: e.target.value})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Cor</label><input type="text" value={editingProduct.color || ''} onChange={e => setEditingProduct({...editingProduct, color: e.target.value})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-none" /></div>
                                    </div>
                                </div>
                            )}

                            {activeFormTab === 'financeiro' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                                            <label className="text-[10px] font-black uppercase text-indigo-500 ml-1">Preço de Venda (R$)</label>
                                            <input type="number" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-transparent border-none text-2xl font-black text-indigo-700 dark:text-indigo-300" required />
                                        </div>
                                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Custo Interno (R$)</label>
                                            <input type="number" value={editingProduct.cost_price || 0} onChange={e => setEditingProduct({...editingProduct, cost_price: Number(e.target.value)})} className="w-full bg-transparent border-none text-2xl font-black text-slate-700 dark:text-slate-300" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Estoque Atual</label><input type="number" value={editingProduct.stock || 0} onChange={e => setEditingProduct({...editingProduct, stock: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" required /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Estoque Mínimo</label><input type="number" value={editingProduct.min_stock_alert || 0} onChange={e => setEditingProduct({...editingProduct, min_stock_alert: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Max Parcelas</label><input type="number" value={editingProduct.max_installments || 12} onChange={e => setEditingProduct({...editingProduct, max_installments: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                    </div>
                                </div>
                            )}

                            {activeFormTab === 'logistica' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-4 gap-2">
                                        <div><label className="text-[10px] font-bold text-slate-400">Peso (g)</label><input type="number" value={editingProduct.weight || 0} onChange={e => setEditingProduct({...editingProduct, weight: Number(e.target.value)})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-none" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-400">Alt (cm)</label><input type="number" value={editingProduct.height || 0} onChange={e => setEditingProduct({...editingProduct, height: Number(e.target.value)})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-none" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-400">Larg (cm)</label><input type="number" value={editingProduct.width || 0} onChange={e => setEditingProduct({...editingProduct, width: Number(e.target.value)})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-none" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-400">Comp (cm)</label><input type="number" value={editingProduct.length || 0} onChange={e => setEditingProduct({...editingProduct, length: Number(e.target.value)})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-none" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Garantia Fabr. (meses)</label><input type="number" value={editingProduct.warranty_manufacturer || 12} onChange={e => setEditingProduct({...editingProduct, warranty_manufacturer: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Garantia Loja (meses)</label><input type="number" value={editingProduct.warranty_store || 3} onChange={e => setEditingProduct({...editingProduct, warranty_store: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                    </div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Conteúdo da Embalagem</label><input type="text" value={editingProduct.package_content || ''} onChange={e => setEditingProduct({...editingProduct, package_content: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" placeholder="Ex: Aparelho, Cabo, Adaptador" /></div>
                                </div>
                            )}

                            <div className="pt-8 flex gap-4">
                                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-2xl hover:bg-slate-200">CANCELAR</button>
                                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">SALVAR PRODUTO</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductsTab;
