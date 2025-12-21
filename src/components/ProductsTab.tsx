
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
                addToast("IA preencheu especificações e converteu mm para cm!", "success");
            } else {
                addToast("Falha ao extrair dados. Tente colar um texto mais completo.", "error");
            }
        } catch (e) { addToast("Falha na conexão com a IA.", "error"); }
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
                addToast("Produto salvo com sucesso!", "success");
                setEditingProduct(null);
                fetchProducts();
            } else {
                setSaveError(result.error || "Erro ao salvar. Verifique se as colunas 'allow_reviews', 'cost_price' e 'min_stock_alert' existem no seu banco.");
            }
        } catch (error: any) {
            setSaveError("Erro de conexão com o servidor.");
        } finally {
            setIsSaving(false);
        }
    };

    // Cálculos Financeiros em tempo real
    const price = Number(editingProduct?.price) || 0;
    const cost = Number(editingProduct?.cost_price) || 0;
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Estoque e Catálogo</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Relp Cell Macapá / Santana</p>
                </div>
                <button onClick={() => { setEditingProduct({ status: 'active', condition: 'novo', is_new: true, allow_reviews: true, max_installments: 12, cost_price: 0, min_stock_alert: 2 }); setActiveFormTab('geral'); setSaveError(null); }} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/30 active:scale-95 transition-all text-xs uppercase tracking-tighter">+ Novo Produto</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 px-2">
                {products.map(p => (
                    <div key={p.id} className={`bg-white dark:bg-slate-800 rounded-3xl border overflow-hidden shadow-sm hover:shadow-md transition-all group ${p.stock <= p.min_stock_alert ? 'border-red-200 dark:border-red-900/50 ring-1 ring-red-100 dark:ring-red-900/20' : 'border-slate-100 dark:border-slate-700'}`}>
                        <div className="aspect-square bg-white flex items-center justify-center p-4 relative">
                            <img src={p.image_url!} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500" />
                            {p.stock <= p.min_stock_alert && (
                                <div className="absolute top-2 left-2 bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase animate-pulse shadow-lg">Estoque Baixo</div>
                            )}
                        </div>
                        <div className="p-3 border-t border-slate-50 dark:border-slate-700">
                            <h3 className="text-[9px] font-black text-slate-400 uppercase truncate">{p.brand}</h3>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.name}</h4>
                            <div className="flex justify-between items-end mt-2">
                                <p className="text-sm font-black text-indigo-600">R$ {p.price.toLocaleString('pt-BR')}</p>
                                <span className={`text-[10px] font-bold ${p.stock > 0 ? 'text-slate-400' : 'text-red-500'}`}>{p.stock} un</span>
                            </div>
                            <button onClick={() => { setEditingProduct(p); setActiveFormTab('geral'); setSaveError(null); }} className="mt-3 w-full py-2 text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Editar Ficha</button>
                        </div>
                    </div>
                ))}
            </div>

            {editingProduct && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl h-[92vh] flex flex-col shadow-2xl animate-pop-in overflow-hidden border border-white/20">
                        {/* Header Modal */}
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Ficha Técnica do Produto</h3>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">MODO: {editingProduct.id ? 'EDIÇÃO' : 'CADASTRO'}</span>
                                    {profit > 0 && <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">Lucro: R$ {profit.toLocaleString('pt-BR')} ({margin.toFixed(1)}%)</span>}
                                </div>
                            </div>
                            <button onClick={() => setEditingProduct(null)} className="p-2.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 hover:text-red-500 transition-colors">✕</button>
                        </div>

                        {/* AI Assistant Bar */}
                        <div className="p-4 bg-indigo-600 text-white flex gap-3 items-center">
                            <div className="bg-white/20 p-2 rounded-xl"><span className="text-xl">🤖</span></div>
                            <div className="flex-1">
                                <input 
                                    type="text" value={aiInput} onChange={e => setAiInput(e.target.value)}
                                    placeholder="Cole aqui o texto do fabricante (ex: Motorola G06 171,4mm...)"
                                    className="w-full bg-white/10 border-none rounded-xl placeholder-white/60 text-sm focus:ring-0 text-white"
                                />
                            </div>
                            <button onClick={handleAutoFill} disabled={isAILoading || !aiInput} className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase shadow-lg disabled:opacity-50 active:scale-95 transition-all">
                                {isAILoading ? 'Processando...' : 'Auto-Preencher IA'}
                            </button>
                        </div>

                        {/* Tabs Internas */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 gap-1">
                            {[
                                { id: 'geral', label: 'Cadastro', icon: '📝' },
                                { id: 'specs', label: 'Specs', icon: '⚙️' },
                                { id: 'financeiro', label: 'Financeiro', icon: '💰' },
                                { id: 'logistica', label: 'Logística', icon: '🚚' }
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
                            
                            {saveError && (
                                <div className="space-y-2">
                                    <Alert message={saveError} type="error" />
                                    <p className="text-[10px] text-red-500 font-bold ml-1 uppercase">Dica: Use o Terminal SQL na aba de Ferramentas Dev para adicionar as colunas faltantes.</p>
                                </div>
                            )}

                            {activeFormTab === 'geral' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="w-full md:w-1/3 flex flex-col items-center">
                                            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Foto do Produto</label>
                                            <div 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full aspect-square rounded-[2rem] bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-indigo-500 transition-all shadow-inner"
                                            >
                                                {editingProduct.image_url ? (
                                                    <img src={editingProduct.image_url} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="text-center p-4">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Carregar Imagem</span>
                                                    </div>
                                                )}
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                                        </div>

                                        <div className="flex-1 space-y-4">
                                            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nome Comercial</label><input type="text" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold focus:ring-2 focus:ring-indigo-500 shadow-sm" required /></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Marca</label><input type="text" value={editingProduct.brand || ''} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                                <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Categoria</label><input type="text" value={editingProduct.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                            </div>
                                            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Descrição</label><textarea rows={3} value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none text-sm focus:ring-2 focus:ring-indigo-500 shadow-sm"></textarea></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeFormTab === 'specs' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Processador</label><input type="text" value={editingProduct.processor || ''} onChange={e => setEditingProduct({...editingProduct, processor: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">RAM</label><input type="text" value={editingProduct.ram || ''} onChange={e => setEditingProduct({...editingProduct, ram: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Armazenamento</label><input type="text" value={editingProduct.storage || ''} onChange={e => setEditingProduct({...editingProduct, storage: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Bateria</label><input type="text" value={editingProduct.battery || ''} onChange={e => setEditingProduct({...editingProduct, battery: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none" /></div>
                                    </div>
                                </div>
                            )}

                            {activeFormTab === 'financeiro' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-800">
                                            <label className="text-[10px] font-black uppercase text-indigo-500 ml-1">Preço de Venda (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-transparent border-none text-3xl font-black text-indigo-700 dark:text-indigo-300 focus:ring-0" required />
                                        </div>
                                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700">
                                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Preço de Custo (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.cost_price || 0} onChange={e => setEditingProduct({...editingProduct, cost_price: Number(e.target.value)})} className="w-full bg-transparent border-none text-3xl font-black text-slate-700 dark:text-slate-300 focus:ring-0" />
                                        </div>
                                    </div>

                                    {/* Dashboard de Lucro */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className={`p-4 rounded-2xl border flex flex-col justify-center ${profit >= 0 ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-100'}`}>
                                            <span className={`text-[10px] font-black uppercase mb-1 ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Lucro Bruto Estimado</span>
                                            <span className={`text-xl font-black ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700'}`}>R$ {profit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                        </div>
                                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 flex flex-col justify-center">
                                            <span className="text-[10px] font-black text-blue-600 uppercase mb-1">Margem Operacional</span>
                                            <span className="text-xl font-black text-blue-700 dark:text-blue-400">{margin.toFixed(1)}%</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Estoque Total</label><input type="number" value={editingProduct.stock || 0} onChange={e => setEditingProduct({...editingProduct, stock: Number(e.target.value)})} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none font-black text-lg focus:ring-2 focus:ring-indigo-500 shadow-inner" required /></div>
                                        <div><label className="text-[10px] font-black uppercase text-red-500 ml-1">Alerta de Mínimo</label><input type="number" value={editingProduct.min_stock_alert || 2} onChange={e => setEditingProduct({...editingProduct, min_stock_alert: Number(e.target.value)})} className="w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border-none font-black text-red-600 text-lg focus:ring-2 focus:ring-red-500 shadow-inner" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Max Parcelas</label><input type="number" value={editingProduct.max_installments || 12} onChange={e => setEditingProduct({...editingProduct, max_installments: Number(e.target.value)})} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none font-black text-lg focus:ring-2 focus:ring-indigo-500 shadow-inner" /></div>
                                    </div>
                                </div>
                            )}

                            {activeFormTab === 'logistica' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                        <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Informações Logísticas (Amapá)</h4>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Peso (Gramas)</label>
                                                <div className="relative">
                                                    <input type="number" value={editingProduct.weight || 0} onChange={e => setEditingProduct({...editingProduct, weight: Number(e.target.value)})} className="w-full p-4 pr-10 bg-white dark:bg-slate-900 rounded-2xl border-none font-black shadow-sm" />
                                                    <span className="absolute right-4 top-4 text-xs font-bold text-slate-400">g</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center">
                                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-[10px] text-indigo-600 dark:text-indigo-400 font-bold leading-tight border border-indigo-100 dark:border-indigo-800">
                                                    Dica: O Moto G06 pesa 194g. <br/>Use ~450g para o conjunto com caixa.
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Altura (cm)</label>
                                                <input type="number" step="0.01" value={editingProduct.height || 0} onChange={e => setEditingProduct({...editingProduct, height: Number(e.target.value)})} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border-none font-bold shadow-sm" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Largura (cm)</label>
                                                <input type="number" step="0.01" value={editingProduct.width || 0} onChange={e => setEditingProduct({...editingProduct, width: Number(e.target.value)})} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border-none font-bold shadow-sm" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Profund. (cm)</label>
                                                <input type="number" step="0.01" value={editingProduct.length || 0} onChange={e => setEditingProduct({...editingProduct, length: Number(e.target.value)})} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border-none font-bold shadow-sm" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">🌟</div>
                                            <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">Permitir Avaliações de Clientes</span>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setEditingProduct({...editingProduct, allow_reviews: !editingProduct.allow_reviews})}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editingProduct.allow_reviews ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editingProduct.allow_reviews ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
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
