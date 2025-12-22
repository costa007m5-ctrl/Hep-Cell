
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
                addToast("IA preencheu a ficha técnica!", "success");
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
                addToast("Produto salvo com sucesso!", "success");
                setEditingProduct(null);
                fetchProducts();
            } else throw new Error(result.error);
        } catch (error: any) { 
            setSaveError(error.message); 
            addToast(error.message, "error");
        }
        finally { setIsSaving(false); }
    };

    const updateField = (field: keyof Product, value: any) => {
        setEditingProduct(prev => prev ? { ...prev, [field]: value } : null);
    };

    const inputClass = "w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-medium focus:ring-2 focus:ring-indigo-500 transition-all text-sm";
    const labelClass = "block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-wider";

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
                {products.map(p => (
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
                        
                        {/* Header do Modal */}
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <span className="p-2 bg-indigo-600 text-white rounded-xl text-xl">📱</span>
                                <h3 className="text-xl font-black uppercase tracking-tighter">Editor de Produto</h3>
                            </div>
                            <button onClick={() => setEditingProduct(null)} className="p-2.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 hover:text-red-500 transition-colors">✕</button>
                        </div>

                        {/* Motor IA */}
                        <div className="p-4 bg-indigo-600 text-white flex gap-3 items-center">
                            <div className="bg-white/20 p-2 rounded-xl text-xl animate-pulse">🤖</div>
                            <input 
                                type="text" value={aiInput} onChange={e => setAiInput(e.target.value)}
                                placeholder="Cole as specs brutas aqui para preencher via IA..."
                                className="flex-1 bg-white/10 border-none rounded-xl placeholder-white/60 text-sm focus:ring-0 text-white font-medium"
                            />
                            <button onClick={handleAutoFill} disabled={isAILoading || !aiInput} className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase shadow-lg disabled:opacity-50 transition-all active:scale-95">
                                {isAILoading ? 'Processando...' : 'Preencher com IA'}
                            </button>
                        </div>

                        {/* Abas do Formulário */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 overflow-x-auto no-scrollbar border-b dark:border-slate-700">
                            {[
                                { id: 'geral', label: 'Geral' },
                                { id: 'desc', label: 'Descrição' },
                                { id: 'specs', label: 'Specs' },
                                { id: 'preço', label: 'Preço' },
                                { id: 'estoque', label: 'Estoque' },
                                { id: 'frete', label: 'Logística' },
                                { id: 'garantia', label: 'Garantia' },
                                { id: 'visibilidade', label: 'Destaque' },
                                { id: 'legal', label: 'Legal' }
                            ].map(tab => (
                                <button 
                                    key={tab.id} 
                                    onClick={() => setActiveFormTab(tab.id as any)} 
                                    className={`flex-shrink-0 px-5 py-3 text-[10px] font-black uppercase transition-all rounded-xl ${activeFormTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Corpo do Formulário */}
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-slate-900">
                            {saveError && <div className="mb-6"><Alert message={saveError} type="error" /></div>}

                            {/* ABA: GERAL */}
                            {activeFormTab === 'geral' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="w-full md:w-1/3">
                                            <label className={labelClass}>Foto Principal</label>
                                            <div onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer overflow-hidden group relative">
                                                {editingProduct.image_url ? (
                                                    <img src={editingProduct.image_url} className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className="text-3xl">📸</span>
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-black uppercase transition-opacity">Alterar</div>
                                            </div>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = () => updateField('image_url', reader.result as string);
                                                    reader.readAsDataURL(file);
                                                }
                                            }} />
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div>
                                                <label className={labelClass}>Nome Comercial do Produto</label>
                                                <input type="text" value={editingProduct.name || ''} onChange={e => updateField('name', e.target.value)} className={inputClass} required />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className={labelClass}>Marca</label><input type="text" value={editingProduct.brand || ''} onChange={e => updateField('brand', e.target.value)} className={inputClass} /></div>
                                                <div><label className={labelClass}>Modelo</label><input type="text" value={editingProduct.model || ''} onChange={e => updateField('model', e.target.value)} className={inputClass} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className={labelClass}>Categoria</label><input type="text" value={editingProduct.category || ''} onChange={e => updateField('category', e.target.value)} className={inputClass} /></div>
                                                <div><label className={labelClass}>SKU / Código</label><input type="text" value={editingProduct.sku || ''} onChange={e => updateField('sku', e.target.value)} className={inputClass} /></div>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Condição do Aparelho</label>
                                                <select value={editingProduct.condition} onChange={e => updateField('condition', e.target.value)} className={inputClass}>
                                                    <option value="novo">Novo (Vitrini)</option>
                                                    <option value="lacrado">Lacrado (Na Caixa)</option>
                                                    <option value="recondicionado">Recondicionado (A+)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ABA: DESCRIÇÃO */}
                            {activeFormTab === 'desc' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div><label className={labelClass}>Resumo Rápido (Max 150 caracteres)</label><input type="text" value={editingProduct.description_short || ''} onChange={e => updateField('description_short', e.target.value)} className={inputClass} /></div>
                                    <div><label className={labelClass}>Destaques (Ex: Tela 120Hz, Bateria 2 dias)</label><textarea value={editingProduct.highlights || ''} onChange={e => updateField('highlights', e.target.value)} className={`${inputClass} h-24`} /></div>
                                    <div><label className={labelClass}>Descrição Detalhada para o Site</label><textarea value={editingProduct.description || ''} onChange={e => updateField('description', e.target.value)} className={`${inputClass} h-48`} /></div>
                                </div>
                            )}

                            {/* ABA: SPECS */}
                            {activeFormTab === 'specs' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                                    <div><label className={labelClass}>Processador</label><input type="text" value={editingProduct.processor || ''} onChange={e => updateField('processor', e.target.value)} className={inputClass} /></div>
                                    <div><label className={labelClass}>RAM</label><input type="text" value={editingProduct.ram || ''} onChange={e => updateField('ram', e.target.value)} className={inputClass} /></div>
                                    <div><label className={labelClass}>Armazenamento</label><input type="text" value={editingProduct.storage || ''} onChange={e => updateField('storage', e.target.value)} className={inputClass} /></div>
                                    <div><label className={labelClass}>Tela / Display</label><input type="text" value={editingProduct.display || ''} onChange={e => updateField('display', e.target.value)} className={inputClass} /></div>
                                    <div><label className={labelClass}>Sistema (OS)</label><input type="text" value={editingProduct.os || ''} onChange={e => updateField('os', e.target.value)} className={inputClass} /></div>
                                    <div><label className={labelClass}>Câmeras</label><input type="text" value={editingProduct.camera || ''} onChange={e => updateField('camera', e.target.value)} className={inputClass} /></div>
                                    <div><label className={labelClass}>Bateria</label><input type="text" value={editingProduct.battery || ''} onChange={e => updateField('battery', e.target.value)} className={inputClass} /></div>
                                    <div><label className={labelClass}>Conectividade</label><input type="text" value={editingProduct.connectivity || ''} onChange={e => updateField('connectivity', e.target.value)} className={inputClass} /></div>
                                    <div><label className={labelClass}>Cor Principal</label><input type="text" value={editingProduct.color || ''} onChange={e => updateField('color', e.target.value)} className={inputClass} /></div>
                                </div>
                            )}

                            {/* ABA: PREÇO */}
                            {activeFormTab === 'preço' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2rem] border border-indigo-100">
                                            <label className="text-xs font-black text-indigo-600 uppercase mb-2 block">Venda à Vista (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.price || 0} onChange={e => updateField('price', e.target.value)} className="w-full bg-transparent border-none text-3xl font-black text-slate-800 dark:text-white outline-none" required />
                                        </div>
                                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100">
                                            <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Preço de Custo (Oculto)</label>
                                            <input type="number" step="0.01" value={editingProduct.cost_price || 0} onChange={e => updateField('cost_price', e.target.value)} className="w-full bg-transparent border-none text-2xl font-black text-slate-700 dark:text-slate-300 outline-none" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div><label className={labelClass}>Preço Promo (Site)</label><input type="number" value={editingProduct.promotional_price || 0} onChange={e => updateField('promotional_price', e.target.value)} className={inputClass} /></div>
                                        <div><label className={labelClass}>Max Parcelas</label><input type="number" value={editingProduct.max_installments || 12} onChange={e => updateField('max_installments', e.target.value)} className={inputClass} /></div>
                                        <div><label className={labelClass}>Desc. Pix (%)</label><input type="number" value={editingProduct.pix_discount_percent || 0} onChange={e => updateField('pix_discount_percent', e.target.value)} className={inputClass} /></div>
                                    </div>
                                </div>
                            )}

                            {/* ABA: ESTOQUE */}
                            {activeFormTab === 'estoque' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-3 gap-6">
                                        <div><label className={labelClass}>Qtd em Estoque</label><input type="number" value={editingProduct.stock || 0} onChange={e => updateField('stock', e.target.value)} className={inputClass} /></div>
                                        <div><label className={labelClass}>Mínimo para Alerta</label><input type="number" value={editingProduct.min_stock_alert || 2} onChange={e => updateField('min_stock_alert', e.target.value)} className={inputClass} /></div>
                                        <div>
                                            <label className={labelClass}>Disponibilidade</label>
                                            <select value={editingProduct.availability} onChange={e => updateField('availability', e.target.value)} className={inputClass}>
                                                <option value="pronta_entrega">Pronta Entrega</option>
                                                <option value="sob_encomenda">Sob Encomenda</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ABA: LOGISTICA */}
                            {activeFormTab === 'frete' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div><label className={labelClass}>Peso (g)</label><input type="number" value={editingProduct.weight || 0} onChange={e => updateField('weight', e.target.value)} className={inputClass} /></div>
                                        <div><label className={labelClass}>Altura (cm)</label><input type="number" value={editingProduct.height || 0} onChange={e => updateField('height', e.target.value)} className={inputClass} /></div>
                                        <div><label className={labelClass}>Largura (cm)</label><input type="number" value={editingProduct.width || 0} onChange={e => updateField('width', e.target.value)} className={inputClass} /></div>
                                        <div><label className={labelClass}>Comp. (cm)</label><input type="number" value={editingProduct.length || 0} onChange={e => updateField('length', e.target.value)} className={inputClass} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className={labelClass}>Porte do Volume</label>
                                            <select value={editingProduct.product_class} onChange={e => updateField('product_class', e.target.value)} className={inputClass}>
                                                <option value="pequeno">Pequeno (Celular/Fone)</option>
                                                <option value="médio">Médio (Tablet/Note)</option>
                                                <option value="grande">Grande (Monitor/PC)</option>
                                            </select>
                                        </div>
                                        <div><label className={labelClass}>Prazo Amapá Express (Dias)</label><input type="number" value={editingProduct.delivery_lead_time || 3} onChange={e => updateField('delivery_lead_time', e.target.value)} className={inputClass} /></div>
                                    </div>
                                </div>
                            )}

                            {/* ABA: GARANTIA */}
                            {activeFormTab === 'garantia' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div><label className={labelClass}>Garantia Fabricante (Meses)</label><input type="number" value={editingProduct.warranty_manufacturer || 0} onChange={e => updateField('warranty_manufacturer', e.target.value)} className={inputClass} /></div>
                                        <div><label className={labelClass}>Garantia Relp Store (Meses)</label><input type="number" value={editingProduct.warranty_store || 3} onChange={e => updateField('warranty_store', e.target.value)} className={inputClass} /></div>
                                    </div>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl cursor-pointer flex-1">
                                            <input type="checkbox" checked={editingProduct.has_invoice} onChange={e => updateField('has_invoice', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                            <span className="text-sm font-bold">Emitir Nota Fiscal (NFe)</span>
                                        </label>
                                        <div className="flex-1">
                                            <label className={labelClass}>Certificações (Ex: Anatel)</label>
                                            <input type="text" value={editingProduct.certifications || ''} onChange={e => updateField('certifications', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                    <div><label className={labelClass}>Conteúdo da Embalagem</label><textarea value={editingProduct.package_content || ''} onChange={e => updateField('package_content', e.target.value)} className={`${inputClass} h-20`} placeholder="Ex: 1x Aparelho, 1x Cabo USB-C, 1x Manual" /></div>
                                </div>
                            )}

                            {/* ABA: DESTAQUES */}
                            {activeFormTab === 'visibilidade' && (
                                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                    {[
                                        { id: 'is_highlight', label: 'Em Destaque (Home)' },
                                        { id: 'is_best_seller', label: 'Mais Vendido' },
                                        { id: 'is_new', label: 'Novo Lançamento' },
                                        { id: 'allow_reviews', label: 'Permitir Comentários' }
                                    ].map(check => (
                                        <label key={check.id} className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-800 rounded-[2rem] cursor-pointer hover:bg-indigo-50 transition-colors">
                                            <input type="checkbox" checked={!!(editingProduct as any)[check.id]} onChange={e => updateField(check.id as any, e.target.checked)} className="w-6 h-6 rounded-lg text-indigo-600" />
                                            <span className="font-bold text-sm">{check.label}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {/* ABA: LEGAL */}
                            {activeFormTab === 'legal' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div><label className={labelClass}>Política de Troca Relp Cell</label><textarea value={editingProduct.exchange_policy || ''} onChange={e => updateField('exchange_policy', e.target.value)} className={`${inputClass} h-24`} /></div>
                                    <div><label className={labelClass}>Avisos Legais</label><textarea value={editingProduct.legal_info || ''} onChange={e => updateField('legal_info', e.target.value)} className={`${inputClass} h-24`} /></div>
                                    <div><label className={labelClass}>Notas Internas (Oculto)</label><textarea value={editingProduct.internal_notes || ''} onChange={e => updateField('internal_notes', e.target.value)} className={`${inputClass} h-24 bg-amber-50 dark:bg-amber-900/10`} /></div>
                                </div>
                            )}

                            {/* AÇÕES FIXAS */}
                            <div className="pt-10 flex gap-4 pb-12">
                                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-3xl hover:bg-slate-200 transition-all">DESCARTAR</button>
                                <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl shadow-indigo-500/30 hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-3">
                                    {isSaving ? <LoadingSpinner /> : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0l4-4z" clipRule="evenodd" /></svg>
                                            PUBLICAR NO CATÁLOGO
                                        </>
                                    )}
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
