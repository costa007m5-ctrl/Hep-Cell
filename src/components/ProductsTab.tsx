
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
                addToast("Ficha técnica preenchida pela IA!", "success");
            } else throw new Error(data.error);
        } catch (e: any) { addToast(e.message, "error"); }
        finally { setIsAILoading(false); }
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
                addToast("Eletrônico salvo com sucesso!", "success");
                setEditingProduct(null);
                fetchProducts();
            } else throw new Error("Erro ao salvar produto.");
        } catch (error: any) { setSaveError(error.message); }
        finally { setIsSaving(false); }
    };

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Gestão de Catálogo</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Controle total de eletrônicos</p>
                </div>
                <button onClick={() => { 
                    setEditingProduct({ 
                        status: 'active', condition: 'novo', is_new: true, allow_reviews: true, 
                        max_installments: 12, min_stock_alert: 2, stock: 0, cost_price: 0, price: 0,
                        availability: 'pronta_entrega', has_invoice: true 
                    }); 
                    setActiveFormTab('geral'); 
                }} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:scale-105 transition-all text-xs uppercase">+ Novo Produto</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 px-2">
                {products.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm group">
                        <div className="aspect-square bg-white flex items-center justify-center p-4">
                            <img src={p.image_url!} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform" alt={p.name} />
                        </div>
                        <div className="p-3 border-t border-slate-50 dark:border-slate-700">
                            <h4 className="text-[10px] font-black text-indigo-600 truncate">{p.brand}</h4>
                            <h3 className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.name}</h3>
                            <div className="flex justify-between items-end mt-2">
                                <p className="text-sm font-black text-slate-900 dark:text-white">R$ {p.price.toLocaleString('pt-BR')}</p>
                                <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-400">{p.stock} un</span>
                            </div>
                            <button onClick={() => { setEditingProduct(p); setActiveFormTab('geral'); }} className="mt-3 w-full py-2 text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Editar</button>
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
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Editor de Produto</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{editingProduct.id ? 'Atualizando Item' : 'Novo Cadastro'}</p>
                            </div>
                            <button onClick={() => setEditingProduct(null)} className="p-2.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 hover:text-red-500 transition-colors">✕</button>
                        </div>

                        {/* IA Assistant Bar */}
                        <div className="p-4 bg-indigo-600 text-white flex gap-3 items-center">
                            <div className="bg-white/20 p-2 rounded-xl text-xl">🤖</div>
                            <input 
                                type="text" value={aiInput} onChange={e => setAiInput(e.target.value)}
                                placeholder="Cole a ficha técnica bruta (ex: specs da Motorola) aqui..."
                                className="flex-1 bg-white/10 border-none rounded-xl placeholder-white/60 text-sm focus:ring-0 text-white font-medium"
                            />
                            <button onClick={handleAutoFill} disabled={isAILoading || !aiInput} className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-100 disabled:opacity-50 transition-all">
                                {isAILoading ? 'Extraindo...' : 'Auto-Preencher IA'}
                            </button>
                        </div>

                        {/* Tabs Internas (As 11 Seções solicitadas) */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 overflow-x-auto no-scrollbar border-b dark:border-slate-700">
                            {[
                                { id: 'geral', label: 'Geral' },
                                { id: 'desc', label: 'Descrição' },
                                { id: 'specs', label: 'Técnico' },
                                { id: 'preço', label: 'Preço' },
                                { id: 'estoque', label: 'Estoque' },
                                { id: 'frete', label: 'Frete/Log' },
                                { id: 'garantia', label: 'Garantia' },
                                { id: 'visibilidade', label: 'Status/Visib' },
                                { id: 'legal', label: 'Legal' }
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

                            {/* 1. SEÇÃO GERAL */}
                            {activeFormTab === 'geral' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="w-full md:w-1/3 space-y-4">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Foto Principal</label>
                                            <div onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-indigo-500 transition-all shadow-inner">
                                                {editingProduct.image_url ? <img src={editingProduct.image_url} className="w-full h-full object-contain" /> : <span className="text-[10px] font-bold text-slate-400 uppercase">Enviar Foto</span>}
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div><label className="text-[10px] font-black uppercase text-slate-400">Nome do Produto</label><input type="text" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold" required /></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className="text-[10px] font-black uppercase text-slate-400">Marca</label><input type="text" value={editingProduct.brand || ''} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                                <div><label className="text-[10px] font-black uppercase text-slate-400">Modelo</label><input type="text" value={editingProduct.model || ''} onChange={e => setEditingProduct({...editingProduct, model: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><label className="text-[10px] font-black uppercase text-slate-400">Categoria</label><input type="text" value={editingProduct.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                                <div><label className="text-[10px] font-black uppercase text-slate-400">Código/SKU</label><input type="text" value={editingProduct.sku || ''} onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 2. DESCRIÇÃO */}
                            {activeFormTab === 'desc' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Descrição Curta (Resumo)</label><input type="text" value={editingProduct.description_short || ''} onChange={e => setEditingProduct({...editingProduct, description_short: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Descrição Completa (Benefícios e Uso)</label><textarea value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-medium text-sm h-32" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Destaques (Bullet Points)</label><textarea value={editingProduct.highlights || ''} onChange={e => setEditingProduct({...editingProduct, highlights: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-medium text-sm h-24" placeholder="Ex: Bateria longa, Tela 120Hz, NFC..." /></div>
                                </div>
                            )}

                            {/* 4. ESPECIFICAÇÕES TÉCNICAS */}
                            {activeFormTab === 'specs' && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 animate-fade-in">
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Processador</label><input type="text" value={editingProduct.processor || ''} onChange={e => setEditingProduct({...editingProduct, processor: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Memória RAM</label><input type="text" value={editingProduct.ram || ''} onChange={e => setEditingProduct({...editingProduct, ram: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Armazenamento</label><input type="text" value={editingProduct.storage || ''} onChange={e => setEditingProduct({...editingProduct, storage: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Tela (Tamanho/Hz)</label><input type="text" value={editingProduct.display || ''} onChange={e => setEditingProduct({...editingProduct, display: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Bateria</label><input type="text" value={editingProduct.battery || ''} onChange={e => setEditingProduct({...editingProduct, battery: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Sistema Operacional</label><input type="text" value={editingProduct.os || ''} onChange={e => setEditingProduct({...editingProduct, os: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div className="col-span-2"><label className="text-[10px] font-black uppercase text-slate-400">Câmeras</label><input type="text" value={editingProduct.camera || ''} onChange={e => setEditingProduct({...editingProduct, camera: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                    <div className="col-span-3"><label className="text-[10px] font-black uppercase text-slate-400">Conectividade</label><input type="text" value={editingProduct.connectivity || ''} onChange={e => setEditingProduct({...editingProduct, connectivity: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-sm" /></div>
                                </div>
                            )}

                            {/* 5. PREÇO */}
                            {activeFormTab === 'preço' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                            <label className="text-[10px] font-black uppercase text-indigo-500">Preço Venda (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-transparent border-none text-3xl font-black text-indigo-700 dark:text-indigo-400 outline-none" required />
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Custo Interno (R$)</label>
                                            <input type="number" step="0.01" value={editingProduct.cost_price || 0} onChange={e => setEditingProduct({...editingProduct, cost_price: Number(e.target.value)})} className="w-full bg-transparent border-none text-2xl font-black text-slate-700 dark:text-slate-300 outline-none" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Preço Promo (R$)</label><input type="number" value={editingProduct.promotional_price || ''} onChange={e => setEditingProduct({...editingProduct, promotional_price: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Desc. Pix (%)</label><input type="number" value={editingProduct.pix_discount_percent || 0} onChange={e => setEditingProduct({...editingProduct, pix_discount_percent: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                    </div>
                                </div>
                            )}

                            {/* 6. ESTOQUE */}
                            {activeFormTab === 'estoque' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Em Estoque</label><input type="number" value={editingProduct.stock || 0} onChange={e => setEditingProduct({...editingProduct, stock: Number(e.target.value)})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-black text-2xl" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-red-500">Alerta Mínimo</label><input type="number" value={editingProduct.min_stock_alert || 2} onChange={e => setEditingProduct({...editingProduct, min_stock_alert: Number(e.target.value)})} className="w-full p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border-none font-black text-red-600 text-2xl" /></div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400">Disponibilidade</label>
                                        <select value={editingProduct.availability || 'pronta_entrega'} onChange={e => setEditingProduct({...editingProduct, availability: e.target.value as any})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold">
                                            <option value="pronta_entrega">Pronta Entrega</option>
                                            <option value="sob_encomenda">Sob Encomenda</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* 7. FRETE E LOGISTICA */}
                            {activeFormTab === 'frete' && (
                                <div className="space-y-6 animate-fade-in">
                                    <p className="text-xs text-slate-500 font-bold bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">Dados internos para cálculo automático de frete no Amapá.</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Peso (Gramas)</label><input type="number" value={editingProduct.weight || 0} onChange={e => setEditingProduct({...editingProduct, weight: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Altura (cm)</label><input type="number" value={editingProduct.height || 0} onChange={e => setEditingProduct({...editingProduct, height: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Largura (cm)</label><input type="number" value={editingProduct.width || 0} onChange={e => setEditingProduct({...editingProduct, width: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Compr. (cm)</label><input type="number" value={editingProduct.length || 0} onChange={e => setEditingProduct({...editingProduct, length: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                    </div>
                                </div>
                            )}

                            {/* 8. GARANTIA E CONTEÚDO */}
                            {activeFormTab === 'garantia' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Garantia Fábrica (Meses)</label><input type="number" value={editingProduct.warranty_manufacturer || 12} onChange={e => setEditingProduct({...editingProduct, warranty_manufacturer: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                        <div><label className="text-[10px] font-black uppercase text-slate-400">Garantia Loja (Meses)</label><input type="number" value={editingProduct.warranty_store || 3} onChange={e => setEditingProduct({...editingProduct, warranty_store: Number(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" /></div>
                                    </div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Conteúdo da Embalagem</label><input type="text" value={editingProduct.package_content || ''} onChange={e => setEditingProduct({...editingProduct, package_content: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" placeholder="Ex: Aparelho, Cabo, Manual..." /></div>
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Certificações</label><input type="text" value={editingProduct.certifications || ''} onChange={e => setEditingProduct({...editingProduct, certifications: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold" placeholder="Ex: Anatel, Inmetro..." /></div>
                                </div>
                            )}

                            {/* 10. VISIBILIDADE E AVALIAÇÕES */}
                            {activeFormTab === 'visibilidade' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Permitir Avaliações</span>
                                            <input type="checkbox" checked={editingProduct.allow_reviews} onChange={e => setEditingProduct({...editingProduct, allow_reviews: e.target.checked})} className="w-5 h-5 rounded text-indigo-600 focus:ring-0" />
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Destaque na Home</span>
                                            <input type="checkbox" checked={editingProduct.is_highlight} onChange={e => setEditingProduct({...editingProduct, is_highlight: e.target.checked})} className="w-5 h-5 rounded text-indigo-600 focus:ring-0" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400">Condição do Item</label>
                                        <select value={editingProduct.condition || 'novo'} onChange={e => setEditingProduct({...editingProduct, condition: e.target.value as any})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold">
                                            <option value="novo">Novo / Aberto</option>
                                            <option value="lacrado">Lacrado de Fábrica</option>
                                            <option value="recondicionado">Recondicionado (Grade A)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400">Status Geral</label>
                                        <select value={editingProduct.status || 'active'} onChange={e => setEditingProduct({...editingProduct, status: e.target.value as any})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold">
                                            <option value="active">Publicado / Visível</option>
                                            <option value="inactive">Pausado / Oculto</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* 11. LEGAL */}
                            {activeFormTab === 'legal' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div><label className="text-[10px] font-black uppercase text-slate-400">Informações Legais e Avisos</label><textarea value={editingProduct.legal_info || ''} onChange={e => setEditingProduct({...editingProduct, legal_info: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-medium text-sm h-32" placeholder="Avisos sobre bateria, política de troca..." /></div>
                                </div>
                            )}

                            <div className="pt-10 flex gap-4 pb-12">
                                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-2xl active:scale-95 transition-all">DESCARTAR</button>
                                <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/40 disabled:opacity-50 active:scale-[0.98] transition-all flex justify-center items-center gap-2">
                                    {isSaving ? <LoadingSpinner /> : (editingProduct.id ? 'ATUALIZAR ELETRÔNICO' : 'PUBLICAR NA LOJA')}
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
