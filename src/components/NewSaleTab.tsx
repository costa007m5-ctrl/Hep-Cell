
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Profile, Product, CartItem } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';
import SignaturePad from './SignaturePad';
import { supabase } from '../services/clients';

// --- Types & Interfaces ---
type SaleType = 'crediario' | 'direct';
type PaymentMethod = 'pix' | 'boleto' | 'credit_card' | 'money';

interface SaleConfig {
    sellerName: string;
    saleType: SaleType;
    paymentMethod: PaymentMethod;
    installments: number;
    downPayment: number;
    discount: number;
    deliveryFee: number;
    isDelivery: boolean;
}

// --- Components ---

const ProductCard: React.FC<{ product: Product; onAdd: () => void }> = ({ product, onAdd }) => (
    <button 
        onClick={onAdd}
        className="flex flex-col items-start p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-md hover:border-indigo-500 transition-all group text-left w-full h-full"
    >
        <div className="w-full aspect-square bg-slate-100 dark:bg-slate-700 rounded-lg mb-2 overflow-hidden relative">
            <img 
                src={product.image_url || 'https://via.placeholder.com/150'} 
                alt={product.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                {product.stock} un
            </div>
        </div>
        <h4 className="font-bold text-slate-800 dark:text-white text-sm line-clamp-2 h-10">{product.name}</h4>
        <p className="text-indigo-600 dark:text-indigo-400 font-black text-lg mt-1">
            {product.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
        </p>
    </button>
);

const CartItemRow: React.FC<{ item: CartItem; onUpdate: (d: number) => void; onRemove: () => void }> = ({ item, onUpdate, onRemove }) => (
    <div className="flex items-center justify-between p-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
        <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden">
                <img src={item.image_url || ''} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{item.name}</p>
                <p className="text-xs text-slate-500">Unit: {item.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button onClick={() => onUpdate(-1)} className="px-2 py-1 text-slate-500 hover:text-red-500 font-bold">-</button>
                <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                <button onClick={() => onUpdate(1)} className="px-2 py-1 text-slate-500 hover:text-green-500 font-bold">+</button>
            </div>
            <p className="text-sm font-bold w-20 text-right">
                {(item.price * item.quantity).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
            </p>
            <button onClick={onRemove} className="text-slate-400 hover:text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
        </div>
    </div>
);

const NewSaleTab: React.FC = () => {
    // --- State Management ---
    
    // Data
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    
    // Config
    const [config, setConfig] = useState<SaleConfig>({
        sellerName: 'Admin',
        saleType: 'crediario',
        paymentMethod: 'pix',
        installments: 1,
        downPayment: 0,
        discount: 0,
        deliveryFee: 0,
        isDelivery: false
    });
    const { saleType, paymentMethod, installments, downPayment } = config;

    const [interestRate, setInterestRate] = useState(0); // Juros base
    
    // --- CHANGE: Set MAX Installments to 8 ---
    const [maxInstallments, setMaxInstallments] = useState(8); 

    // UI
    const [searchTerm, setSearchTerm] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [feedback, setFeedback] = useState<{text:string, type:'success'|'error'} | null>(null);
    const [signature, setSignature] = useState<string | null>(null);

    // Refs
    const productSearchInput = useRef<HTMLInputElement>(null);

    // --- Init ---
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [profRes, prodRes, setRes] = await Promise.all([
                    supabase.from('profiles').select('*'), // Direct Supabase Call for consistency
                    fetch('/api/products'), // Corrected endpoint
                    fetch('/api/admin/settings')
                ]);
                
                if(profRes.data) setProfiles(profRes.data);
                if(prodRes.ok) setProducts(await prodRes.json());
                if(setRes.ok) {
                    const settings = await setRes.json();
                    setInterestRate(parseFloat(settings.interest_rate) || 0);
                }
            } catch(e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // --- Computed Values ---
    const filteredProducts = useMemo(() => {
        if(!searchTerm) return products;
        const lower = searchTerm.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(lower) || p.brand?.toLowerCase().includes(lower));
    }, [products, searchTerm]);

    const filteredCustomers = useMemo(() => {
        if(!customerSearch) return [];
        const lower = customerSearch.toLowerCase();
        return profiles.filter(p => 
            p.first_name?.toLowerCase().includes(lower) || 
            p.last_name?.toLowerCase().includes(lower) || 
            p.identification_number?.includes(lower)
        ).slice(0, 5);
    }, [profiles, customerSearch]);

    const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);
    
    const finalTotal = useMemo(() => {
        return Math.max(0, cartTotal - config.discount + (config.isDelivery ? config.deliveryFee : 0));
    }, [cartTotal, config]);

    const financingTotal = useMemo(() => {
        const principal = Math.max(0, finalTotal - config.downPayment);
        if (config.installments <= 1 || interestRate <= 0) return principal;
        
        // Juros Composto para Crediário
        const rate = interestRate / 100;
        return principal * Math.pow(1 + rate, config.installments);
    }, [finalTotal, config.downPayment, config.installments, interestRate]);

    const installmentValue = useMemo(() => {
        return config.installments > 0 ? financingTotal / config.installments : 0;
    }, [financingTotal, config.installments]);

    // --- Handlers ---

    const handleAddToCart = (product: Product) => {
        setCart(prev => {
            const exists = prev.find(i => i.id === product.id);
            if(exists) {
                return prev.map(i => i.id === product.id ? {...i, quantity: i.quantity + 1} : i);
            }
            return [...prev, {...product, quantity: 1}];
        });
        setSearchTerm(''); // Limpa busca para "Scan Mode"
        productSearchInput.current?.focus();
    };

    const updateCartItem = (id: string, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i.id === id) {
                const newQ = i.quantity + delta;
                return newQ > 0 ? {...i, quantity: newQ} : null;
            }
            return i;
        }).filter(Boolean) as CartItem[]);
    };

    const handleFinishSale = async () => {
        if (cart.length === 0) { setFeedback({text: 'Carrinho vazio.', type: 'error'}); return; }
        if (!selectedProfile) { setFeedback({text: 'Selecione um cliente.', type: 'error'}); return; }
        if (config.saleType === 'crediario' && !signature) { setShowSignatureModal(true); return; }

        setIsProcessing(true);
        try {
            // Preparar notas da venda (agrupada)
            const itemsDesc = cart.map(i => `${i.quantity}x ${i.name}`).join(', ');
            
            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedProfile.id,
                    totalAmount: financingTotal, // Valor financiado total (com juros)
                    installments: config.installments,
                    productName: itemsDesc, // Descrição resumida dos itens
                    signature: signature,
                    saleType: config.saleType,
                    paymentMethod: config.paymentMethod,
                    downPayment: config.downPayment
                }),
            });

            const data = await response.json();
            if(!response.ok) throw new Error(data.error || "Erro ao registrar venda.");

            setFeedback({text: "Venda realizada com sucesso e salva no banco!", type: "success"});
            
            // Reset
            setCart([]);
            setSelectedProfile(null);
            setSignature(null);
            setCustomerSearch('');
            setConfig(prev => ({...prev, downPayment: 0, discount: 0, installments: 1}));

        } catch(e: any) {
            console.error("Sale error:", e);
            setFeedback({text: e.message, type: 'error'});
        } finally {
            setIsProcessing(false);
            setShowSignatureModal(false);
            setTimeout(() => setFeedback(null), 4000);
        }
    };

    if (isLoading) return <div className="p-10 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-6 p-2 animate-fade-in">
            
            {/* === COLUNA ESQUERDA: CATÁLOGO === */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Search Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex gap-3 bg-slate-50 dark:bg-slate-900/50">
                    <div className="relative flex-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input 
                            ref={productSearchInput}
                            type="text" 
                            placeholder="Buscar produto ou código..." 
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <button className="p-2.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 transition-colors" title="Scan Barcode">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                    </button>
                </div>

                {/* Grid de Produtos */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredProducts.map(p => (
                            <ProductCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} />
                        ))}
                        {filteredProducts.length === 0 && (
                            <div className="col-span-full text-center py-10 text-slate-400">
                                Nenhum produto encontrado.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* === COLUNA DIREITA: CAIXA / CHECKOUT === */}
            <div className="w-full lg:w-[450px] flex flex-col gap-4">
                
                {/* 1. Seleção de Cliente */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 relative z-20">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cliente</label>
                    {selectedProfile ? (
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                                    {selectedProfile.first_name?.[0]}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white leading-tight">{selectedProfile.first_name} {selectedProfile.last_name}</p>
                                    <p className="text-xs text-indigo-600 dark:text-indigo-300">Limite: {selectedProfile.credit_limit?.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedProfile(null)} className="text-slate-400 hover:text-red-500 p-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414-1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Buscar cliente..."
                                value={customerSearch}
                                onChange={e => setCustomerSearch(e.target.value)}
                            />
                            {customerSearch && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto z-30">
                                    {filteredCustomers.map(p => (
                                        <button key={p.id} onClick={() => { setSelectedProfile(p); setCustomerSearch(''); }} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                            <p className="font-bold text-sm">{p.first_name} {p.last_name}</p>
                                            <p className="text-xs text-slate-500">{p.identification_number} • {p.email}</p>
                                        </button>
                                    ))}
                                    {filteredCustomers.length === 0 && <div className="p-3 text-sm text-slate-500">Nenhum cliente encontrado.</div>}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 2. Carrinho */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex flex-col overflow-hidden">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase text-slate-500">Itens ({cart.length})</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Vendedor: {config.sellerName}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-48 p-2 custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                <p className="text-sm">Carrinho vazio</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <CartItemRow key={item.id} item={item} onUpdate={(d) => updateCartItem(item.id, d)} onRemove={() => updateCartItem(item.id, -item.quantity)} />
                            ))
                        )}
                    </div>
                    
                    {/* Totais Intermediários */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 space-y-2 text-sm">
                        <div className="flex justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span>{cartTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                        </div>
                        
                        {/* Configs Rápidas */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                                <span className="absolute left-2 top-1.5 text-xs text-slate-400">Desc.</span>
                                <input 
                                    type="number" 
                                    className="w-full pl-10 pr-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 outline-none focus:border-indigo-500"
                                    value={config.discount || ''}
                                    onChange={e => setConfig({...config, discount: parseFloat(e.target.value) || 0})}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="relative">
                                <button 
                                    onClick={() => setConfig(p => ({...p, isDelivery: !p.isDelivery}))}
                                    className={`w-full py-1 px-2 rounded border text-xs font-bold transition-colors flex items-center justify-center gap-1 h-full ${config.isDelivery ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                >
                                    {config.isDelivery ? '🚚 Entrega' : '🏪 Retirada'}
                                </button>
                            </div>
                        </div>
                        
                        {config.isDelivery && (
                             <div className="flex justify-between text-slate-500">
                                <span>Taxa Entrega</span>
                                <input 
                                    type="number" 
                                    className="w-20 text-right bg-transparent border-b border-slate-300 focus:border-indigo-500 outline-none"
                                    value={config.deliveryFee || ''}
                                    onChange={e => setConfig({...config, deliveryFee: parseFloat(e.target.value) || 0})}
                                    placeholder="0.00"
                                />
                            </div>
                        )}

                        <div className="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-2">
                            <span>Total à Pagar</span>
                            <span>{finalTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Configuração de Pagamento (Painel de Controle) */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-lg mb-4">
                        <button onClick={() => setConfig(prev => ({ ...prev, saleType: 'crediario', installments: 1 }))} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${saleType === 'crediario' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}>Crediário Próprio</button>
                        <button onClick={() => setConfig(prev => ({ ...prev, saleType: 'direct', installments: 1, downPayment: 0 }))} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${saleType === 'direct' ? 'bg-white dark:bg-slate-700 shadow text-green-600' : 'text-slate-500'}`}>Pagamento Direto</button>
                    </div>

                    {saleType === 'direct' ? (
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <button 
                                onClick={() => setConfig(prev => ({ ...prev, paymentMethod: 'pix', installments: 1 }))}
                                className={`py-2 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${paymentMethod === 'pix' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                Pix
                            </button>
                            <button 
                                onClick={() => setConfig(prev => ({ ...prev, paymentMethod: 'money', installments: 1 }))}
                                className={`py-2 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${paymentMethod === 'money' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                Dinheiro
                            </button>
                            <button 
                                onClick={() => setConfig(prev => ({ ...prev, paymentMethod: 'boleto', installments: 1 }))}
                                className={`py-2 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${paymentMethod === 'boleto' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Boleto
                            </button>
                            <button 
                                onClick={() => setConfig({...config, paymentMethod: 'credit_card'})}
                                className={`py-2 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${paymentMethod === 'credit_card' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                Cartão
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Entrada</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400">R$</span>
                                    <input 
                                        type="number" 
                                        className="w-full pl-8 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={config.downPayment || ''}
                                        onChange={e => setConfig({...config, downPayment: parseFloat(e.target.value) || 0})}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Parcelas: {config.installments}x</label>
                                    <span className="text-xs font-bold text-indigo-600">{installmentValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}/mês</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max={maxInstallments} 
                                    value={config.installments}
                                    onChange={e => setConfig({...config, installments: parseInt(e.target.value)})}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                    <span>1x</span>
                                    <span>{maxInstallments}x</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={handleFinishSale}
                        disabled={isProcessing}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isProcessing ? <LoadingSpinner /> : 'Finalizar Venda'}
                    </button>
                </div>
                
                {feedback && <Alert message={feedback.text} type={feedback.type} />}
            </div>

            {/* Modal de Assinatura para Crediário */}
            {showSignatureModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Assinatura do Contrato</h3>
                        <p className="text-sm text-slate-500 mb-4">Confirmo a dívida de <strong>{financingTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</strong> parcelada em {config.installments}x.</p>
                        <SignaturePad onEnd={setSignature} />
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowSignatureModal(false)} className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 font-bold">Cancelar</button>
                            <button onClick={handleFinishSale} disabled={!signature} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold shadow-md disabled:opacity-50">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewSaleTab;
