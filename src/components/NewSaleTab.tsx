
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Profile, Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';
import jsPDF from 'jspdf';
import { supabase } from '../services/clients';

// --- Types & Interfaces ---

interface CartItem extends Product {
    cartId: string;
    quantity: number;
    discount: number; // Valor monetário
}

interface SaleContext {
    sellerName: string;
    notes: string;
    tradeInValue: number;
    tradeInDescription: string;
}

type PaymentMode = 'crediario' | 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'mixed';

// --- Helper Components ---

const StockBadge: React.FC<{ stock: number }> = ({ stock }) => {
    let color = 'bg-emerald-100 text-emerald-700';
    let label = 'Em Estoque';
    if (stock === 0) {
        color = 'bg-slate-100 text-slate-500';
        label = 'Esgotado';
    } else if (stock < 3) {
        color = 'bg-red-100 text-red-700';
        label = 'Últimas Unidades';
    } else if (stock < 10) {
        color = 'bg-amber-100 text-amber-700';
        label = 'Baixo Estoque';
    }
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${color}`}>{label} ({stock})</span>;
};

const ProductCard: React.FC<{ product: Product; onAdd: (p: Product) => void }> = ({ product, onAdd }) => (
    <button 
        onClick={() => product.stock > 0 && onAdd(product)}
        disabled={product.stock <= 0}
        className={`flex flex-col text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-md transition-all active:scale-[0.98] group h-full ${product.stock <= 0 ? 'opacity-60 grayscale' : ''}`}
    >
        <div className="h-32 w-full bg-white p-4 flex items-center justify-center relative overflow-hidden">
            <img 
                src={product.image_url || 'https://via.placeholder.com/150'} 
                alt={product.name} 
                className="max-h-full object-contain group-hover:scale-110 transition-transform duration-500" 
            />
            <div className="absolute top-2 right-2">
                <StockBadge stock={product.stock} />
            </div>
        </div>
        <div className="p-3 flex flex-col flex-1 w-full">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{product.category || 'Geral'}</p>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2 mb-auto">{product.name}</h4>
            <div className="mt-2 flex justify-between items-end">
                <span className="text-indigo-600 dark:text-indigo-400 font-black text-lg">
                    {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                </div>
            </div>
        </div>
    </button>
);

const CartItemRow: React.FC<{ item: CartItem; onRemove: (id: string) => void; onUpdateQty: (id: string, d: number) => void }> = ({ item, onRemove, onUpdateQty }) => (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50 animate-fade-in">
        <img src={item.image_url || ''} className="w-12 h-12 rounded object-contain bg-white" alt="" />
        <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{item.name}</p>
            <p className="text-xs text-slate-500">
                {item.quantity}x {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                <button onClick={() => onUpdateQty(item.cartId, -1)} className="px-2 py-1 text-slate-500 hover:text-indigo-600">-</button>
                <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                <button onClick={() => onUpdateQty(item.cartId, 1)} className="px-2 py-1 text-slate-500 hover:text-indigo-600">+</button>
            </div>
            <button onClick={() => onRemove(item.cartId)} className="text-red-400 hover:text-red-600 p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            </button>
        </div>
    </div>
);

// --- Main Component ---

const NewSaleTab: React.FC = () => {
    // --- Data States ---
    const [products, setProducts] = useState<Product[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [interestRate, setInterestRate] = useState(0);
    const [loading, setLoading] = useState(true);

    // --- POS States ---
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Todos');
    
    // --- Checkout States ---
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('crediario');
    const [installments, setInstallments] = useState(1);
    const [entryValue, setEntryValue] = useState('');
    const [saleContext, setSaleContext] = useState<SaleContext>({ sellerName: 'Admin', notes: '', tradeInValue: 0, tradeInDescription: '' });
    const [isProcessing, setIsProcessing] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // --- Refs ---
    const searchInputRef = useRef<HTMLInputElement>(null);

    // --- Load Data ---
    useEffect(() => {
        const load = async () => {
            try {
                const [prodRes, profRes, setRes] = await Promise.all([
                    fetch('/api/admin/products'),
                    fetch('/api/admin/profiles'),
                    fetch('/api/admin/settings')
                ]);
                
                if (prodRes.ok) setProducts(await prodRes.json());
                if (profRes.ok) setProfiles(await profRes.json());
                if (setRes.ok) {
                    const settings = await setRes.json();
                    setInterestRate(parseFloat(settings.interest_rate) || 0);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();

        // Keyboard Shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); }
            if (e.key === 'F9') { e.preventDefault(); if(cart.length > 0 && selectedProfile) setIsCheckoutOpen(true); }
            if (e.key === 'Escape') { setIsCheckoutOpen(false); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart.length, selectedProfile]);

    // --- Logic ---

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'Todos' || p.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, categoryFilter]);

    const categories = useMemo(() => ['Todos', ...Array.from(new Set(products.map(p => p.category || 'Outros')))], [products]);

    // Financial Calculations
    const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);
    const tradeIn = saleContext.tradeInValue || 0;
    const entry = parseFloat(entryValue) || 0;
    
    const principal = Math.max(0, cartTotal - entry - tradeIn);
    
    const totalWithInterest = useMemo(() => {
        if (paymentMode !== 'crediario' && paymentMode !== 'credit_card') return principal; // Pix/Cash sem juros (ou com desconto)
        
        // Regra: Juros apenas se parcelas > 1 (ou configurável)
        if (installments <= 1) return principal;
        
        // Juros Composto
        return principal * Math.pow(1 + (interestRate/100), installments);
    }, [principal, installments, interestRate, paymentMode]);

    const installmentValue = installments > 0 ? totalWithInterest / installments : 0;

    // --- Handlers ---

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) {
                    alert("Estoque insuficiente!");
                    return prev;
                }
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, cartId: Math.random().toString(36), quantity: 1, discount: 0 }];
        });
        if (navigator.vibrate) navigator.vibrate(50); // Haptic
    };

    const removeFromCart = (cartId: string) => {
        setCart(prev => prev.filter(item => item.cartId !== cartId));
    };

    const updateQty = (cartId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) {
                const newQty = Math.max(1, item.quantity + delta);
                if (newQty > item.stock) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const handleFinishSale = async () => {
        if (!selectedProfile) return alert("Selecione um cliente!");
        setIsProcessing(true);
        try {
            // 1. Construir descrição detalhada para a fatura
            const itemsDescription = cart.map(i => `${i.quantity}x ${i.name}`).join(', ');
            const fullNotes = `Venda PDV. Itens: ${itemsDescription}. \n` +
                              (tradeIn > 0 ? `Trade-in: R$${tradeIn} (${saleContext.tradeInDescription}). ` : '') +
                              (entry > 0 ? `Entrada: R$${entry}. ` : '') +
                              `Vendedor: ${saleContext.sellerName}. Obs: ${saleContext.notes}`;

            // 2. Chamar API de criação de venda (reaproveitando a lógica existente no backend)
            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedProfile.id,
                    totalAmount: totalWithInterest,
                    installments: installments,
                    productName: itemsDescription.substring(0, 50) + (itemsDescription.length > 50 ? '...' : ''), // Nome curto para o título da fatura
                    saleType: paymentMode === 'crediario' ? 'crediario' : 'direct',
                    paymentMethod: paymentMode,
                    downPayment: entry + tradeIn, // Soma entrada + troca como 'entrada total'
                    signature: null, // PDV presencial pode pular assinatura digital ou implementar depois
                    // Enviar notas completas como hack se a API suportar, ou teremos que adaptar a API
                }),
            });

            if (!response.ok) throw new Error('Erro ao processar venda.');

            setSuccessMsg("Venda realizada com sucesso!");
            
            // Reset
            setTimeout(() => {
                setCart([]);
                setSelectedProfile(null);
                setSaleContext({ sellerName: 'Admin', notes: '', tradeInValue: 0, tradeInDescription: '' });
                setIsCheckoutOpen(false);
                setSuccessMsg(null);
                setEntryValue('');
            }, 2000);

        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-slate-100 dark:bg-slate-900 -m-4 lg:-m-8">
            
            {/* ESQUERDA: CATÁLOGO (65%) */}
            <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header / Toolbar */}
                <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex gap-4 items-center shrink-0">
                    <div className="relative flex-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Buscar produto (F2)..." 
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-[400px]">
                        {categories.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => setCategoryFilter(cat)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${categoryFilter === cat ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid de Produtos */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredProducts.map(product => (
                            <ProductCard key={product.id} product={product} onAdd={addToCart} />
                        ))}
                    </div>
                    {filteredProducts.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <p>Nenhum produto encontrado.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* DIREITA: CARRINHO E CHECKOUT (35%) */}
            <div className="w-full lg:w-[400px] bg-white dark:bg-slate-800 flex flex-col shadow-2xl z-20">
                
                {/* Cliente Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-900/20">
                    <label className="block text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase mb-2">Cliente Selecionado</label>
                    {selectedProfile ? (
                        <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                    {selectedProfile.first_name?.[0]}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{selectedProfile.first_name} {selectedProfile.last_name}</p>
                                    <p className="text-xs text-slate-500">Limite: R$ {selectedProfile.credit_limit}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedProfile(null)} className="text-slate-400 hover:text-red-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <select 
                                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                                onChange={(e) => {
                                    const p = profiles.find(pr => pr.id === e.target.value);
                                    if (p) setSelectedProfile(p);
                                }}
                                value=""
                            >
                                <option value="" disabled>Selecionar Cliente...</option>
                                {profiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name} (CPF: {p.identification_number})</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-3 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </div>
                        </div>
                    )}
                </div>

                {/* Lista do Carrinho */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            <p>Carrinho vazio</p>
                        </div>
                    ) : (
                        cart.map(item => <CartItemRow key={item.cartId} item={item} onRemove={removeFromCart} onUpdateQty={updateQty} />)
                    )}
                </div>

                {/* Footer Totais */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 text-sm">Subtotal ({cart.length} itens)</span>
                        <span className="font-bold text-slate-800 dark:text-white">R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <button 
                        onClick={() => setIsCheckoutOpen(true)}
                        disabled={cart.length === 0 || !selectedProfile}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Finalizar Venda (F9)
                    </button>
                </div>
            </div>

            {/* MODAL DE CHECKOUT (OVERLAY) */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                        
                        {/* Coluna 1: Resumo e Trade-in */}
                        <div className="w-full md:w-1/2 p-6 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Resumo da Venda</h3>
                            
                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Cliente</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{selectedProfile?.first_name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Total Produtos</span>
                                    <span className="font-bold text-slate-900 dark:text-white">R$ {cartTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-6">
                                <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                    Trade-In (Troca)
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Valor do Aparelho Usado</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-500 font-bold">R$</span>
                                            <input 
                                                type="number" 
                                                value={saleContext.tradeInValue || ''} 
                                                onChange={e => setSaleContext({...saleContext, tradeInValue: parseFloat(e.target.value) || 0})}
                                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Descrição do Item</label>
                                        <input 
                                            type="text" 
                                            value={saleContext.tradeInDescription} 
                                            onChange={e => setSaleContext({...saleContext, tradeInDescription: e.target.value})}
                                            className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                            placeholder="Ex: iPhone 11 64GB Preto (Tela trincada)"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center text-lg font-bold">
                                    <span>A Pagar</span>
                                    <span className="text-indigo-600 dark:text-indigo-400">R$ {principal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Coluna 2: Pagamento */}
                        <div className="w-full md:w-1/2 p-6 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto flex flex-col">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Forma de Pagamento</h3>
                            
                            <div className="flex gap-2 mb-6">
                                {['crediario', 'credit_card', 'pix', 'cash'].map(mode => (
                                    <button 
                                        key={mode}
                                        onClick={() => { setPaymentMode(mode as any); setInstallments(1); }}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${paymentMode === mode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                                    >
                                        {mode.replace('_', ' ').toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4 flex-1">
                                {(paymentMode === 'crediario' || paymentMode === 'credit_card') && (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between mb-4">
                                            <label className="font-bold text-sm">Entrada (Dinheiro/Pix)</label>
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Opcional</span>
                                        </div>
                                        <div className="relative mb-4">
                                            <span className="absolute left-3 top-2.5 text-slate-500 font-bold">R$</span>
                                            <input 
                                                type="number" 
                                                value={entryValue} 
                                                onChange={e => setEntryValue(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="0,00"
                                            />
                                        </div>

                                        <label className="font-bold text-sm mb-2 block">Parcelas</label>
                                        <select 
                                            value={installments}
                                            onChange={e => setInstallments(Number(e.target.value))}
                                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none"
                                        >
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(num => {
                                                const val = paymentMode === 'crediario' 
                                                    ? (principal * Math.pow(1 + (interestRate/100), num)) / num 
                                                    : principal / num; // Simplificado para cartão
                                                return (
                                                    <option key={num} value={num}>
                                                        {num}x de R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {interestRate > 0 && paymentMode === 'crediario' && (
                                            <p className="text-xs text-orange-600 mt-2 text-center">* Inclui juros de {interestRate}% a.m.</p>
                                        )}
                                    </div>
                                )}

                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <label className="font-bold text-sm mb-2 block">Vendedor / Notas</label>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <input 
                                            type="text" 
                                            placeholder="Nome do Vendedor"
                                            value={saleContext.sellerName}
                                            onChange={e => setSaleContext({...saleContext, sellerName: e.target.value})}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                                        />
                                    </div>
                                    <textarea 
                                        rows={2}
                                        placeholder="Observações internas..."
                                        value={saleContext.notes}
                                        onChange={e => setSaleContext({...saleContext, notes: e.target.value})}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm resize-none"
                                    ></textarea>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button onClick={() => setIsCheckoutOpen(false)} className="px-4 py-3 rounded-xl font-bold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleFinishSale}
                                    disabled={isProcessing}
                                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
                                >
                                    {isProcessing ? <LoadingSpinner /> : 'Confirmar Venda'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {successMsg && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl text-center shadow-2xl max-w-sm mx-4 transform scale-110 transition-transform">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Sucesso!</h3>
                        <p className="text-slate-500 mb-6">{successMsg}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewSaleTab;
