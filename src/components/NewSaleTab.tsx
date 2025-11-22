
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Profile, Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

// --- Interfaces PDV ---
interface CartItem extends Product {
    cartId: string;
    quantity: number;
    discount: number;
}

interface SaleContext {
    sellerName: string;
    notes: string;
    tradeInValue: number;
    tradeInDescription: string;
}

type PaymentMode = 'crediario' | 'pix' | 'credit_card' | 'cash' | 'mixed';

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

    const searchInputRef = useRef<HTMLInputElement>(null);

    // --- Load Data ---
    useEffect(() => {
        const load = async () => {
            try {
                // Carrega dados via API Admin (sem RLS)
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

        // Atalhos de Teclado
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

    // Cálculos Financeiros
    const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);
    const tradeIn = saleContext.tradeInValue || 0;
    const entry = parseFloat(entryValue) || 0;
    const principal = Math.max(0, cartTotal - entry - tradeIn);
    
    const totalWithInterest = useMemo(() => {
        if (paymentMode !== 'crediario' && paymentMode !== 'credit_card') return principal;
        if (installments <= 1) return principal;
        return principal * Math.pow(1 + (interestRate/100), installments);
    }, [principal, installments, interestRate, paymentMode]);

    const installmentValue = installments > 0 ? totalWithInterest / installments : 0;

    // --- Handlers ---
    const addToCart = (product: Product) => {
        if (product.stock <= 0) return alert("Produto Esgotado!");
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            return [...prev, { ...product, cartId: Math.random().toString(36), quantity: 1, discount: 0 }];
        });
        // Feedback sonoro simulado visualmente ou beep real se permitido
    };

    const removeFromCart = (cartId: string) => setCart(prev => prev.filter(item => item.cartId !== cartId));

    const updateQty = (cartId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) return { ...item, quantity: Math.max(1, item.quantity + delta) };
            return item;
        }));
    };

    const handleFinishSale = async () => {
        if (!selectedProfile) return alert("Selecione um cliente!");
        setIsProcessing(true);
        try {
            const itemsDescription = cart.map(i => `${i.quantity}x ${i.name}`).join(', ');
            
            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedProfile.id,
                    totalAmount: totalWithInterest,
                    installments: installments,
                    productName: itemsDescription.substring(0, 50),
                    saleType: paymentMode === 'crediario' ? 'crediario' : 'direct', // Importante para definir status
                    paymentMethod: paymentMode,
                    downPayment: entry + tradeIn,
                }),
            });

            if (!response.ok) throw new Error('Erro ao processar venda.');

            setSuccessMsg(paymentMode === 'crediario' ? "Venda Enviada! Aguardando aceite do contrato pelo cliente." : "Venda Finalizada com Sucesso!");
            
            setTimeout(() => {
                setCart([]);
                setSelectedProfile(null);
                setSaleContext({ sellerName: 'Admin', notes: '', tradeInValue: 0, tradeInDescription: '' });
                setIsCheckoutOpen(false);
                setSuccessMsg(null);
                setEntryValue('');
            }, 3000);

        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-slate-100 dark:bg-slate-900 -m-4 lg:-m-8">
            
            {/* ESQUERDA: CATÁLOGO */}
            <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 bg-white dark:bg-slate-800 border-b flex gap-4 items-center shrink-0">
                    <div className="relative flex-1">
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Buscar produto (F2)..." 
                            className="w-full pl-4 pr-4 py-2 rounded-lg border bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto max-w-[400px]">
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${categoryFilter === cat ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>{cat}</button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredProducts.map(product => (
                            <button 
                                key={product.id} 
                                onClick={() => addToCart(product)}
                                className="flex flex-col text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-md transition-all active:scale-95 group h-full"
                            >
                                <div className="h-32 w-full bg-white p-4 flex items-center justify-center relative">
                                    <img src={product.image_url || 'https://via.placeholder.com/150'} alt={product.name} className="max-h-full object-contain" />
                                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${product.stock < 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {product.stock} un
                                    </span>
                                </div>
                                <div className="p-3 flex flex-col flex-1">
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2 mb-auto">{product.name}</h4>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-black text-lg mt-2">
                                        {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* DIREITA: CARRINHO E CHECKOUT */}
            <div className="w-full lg:w-[400px] bg-white dark:bg-slate-800 flex flex-col shadow-2xl z-20">
                <div className="p-4 border-b bg-indigo-50 dark:bg-indigo-900/20">
                    <label className="block text-xs font-bold text-indigo-800 uppercase mb-2">Cliente</label>
                    <select 
                        className="w-full p-3 rounded-xl border bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        onChange={(e) => setSelectedProfile(profiles.find(pr => pr.id === e.target.value) || null)}
                        value={selectedProfile?.id || ""}
                    >
                        <option value="" disabled>Selecionar Cliente...</option>
                        {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.first_name} {p.last_name} (CPF: {p.identification_number})</option>
                        ))}
                    </select>
                    {selectedProfile && (
                        <div className="mt-2 flex justify-between text-xs text-slate-500">
                            <span>Limite: R$ {selectedProfile.credit_limit}</span>
                            <span className={selectedProfile.credit_status === 'Bloqueado' ? 'text-red-500 font-bold' : 'text-green-500'}>{selectedProfile.credit_status}</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.map(item => (
                        <div key={item.cartId} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{item.name}</p>
                                <p className="text-xs text-slate-500">{item.quantity}x {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => updateQty(item.cartId, -1)} className="px-2 bg-slate-200 rounded">-</button>
                                <span className="text-xs font-bold">{item.quantity}</span>
                                <button onClick={() => updateQty(item.cartId, 1)} className="px-2 bg-slate-200 rounded">+</button>
                                <button onClick={() => removeFromCart(item.cartId)} className="text-red-500 ml-1">x</button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-bold">Total</span>
                        <span className="text-2xl font-black text-indigo-600">R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <button 
                        onClick={() => setIsCheckoutOpen(true)}
                        disabled={cart.length === 0 || !selectedProfile}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
                    >
                        Finalizar Venda (F9)
                    </button>
                </div>
            </div>

            {/* CHECKOUT MODAL */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                        {/* Resumo e Trade-In */}
                        <div className="w-full md:w-1/2 p-6 border-r overflow-y-auto">
                            <h3 className="text-xl font-bold mb-6">Resumo</h3>
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl mb-6">
                                <h4 className="font-bold text-indigo-800 mb-3">Trade-In (Troca)</h4>
                                <div className="space-y-3">
                                    <input 
                                        type="number" 
                                        value={saleContext.tradeInValue || ''} 
                                        onChange={e => setSaleContext({...saleContext, tradeInValue: parseFloat(e.target.value) || 0})}
                                        className="w-full p-2 rounded border" placeholder="Valor do usado (R$)"
                                    />
                                    <input 
                                        type="text" 
                                        value={saleContext.tradeInDescription} 
                                        onChange={e => setSaleContext({...saleContext, tradeInDescription: e.target.value})}
                                        className="w-full p-2 rounded border" placeholder="Descrição do aparelho usado"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t pt-4">
                                <span>A Pagar</span>
                                <span className="text-indigo-600">R$ {principal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {/* Pagamento */}
                        <div className="w-full md:w-1/2 p-6 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto flex flex-col">
                            <h3 className="text-xl font-bold mb-6">Pagamento</h3>
                            <div className="flex gap-2 mb-6">
                                {['crediario', 'credit_card', 'pix', 'cash'].map(mode => (
                                    <button key={mode} onClick={() => { setPaymentMode(mode as any); setInstallments(1); }} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${paymentMode === mode ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>
                                        {mode.toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            {paymentMode === 'crediario' && (
                                <div className="space-y-4 mb-4">
                                    <input 
                                        type="number" 
                                        value={entryValue} 
                                        onChange={e => setEntryValue(e.target.value)}
                                        className="w-full p-3 rounded border" placeholder="Entrada (R$)"
                                    />
                                    <select 
                                        value={installments}
                                        onChange={e => setInstallments(Number(e.target.value))}
                                        className="w-full p-3 rounded border"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                                            <option key={n} value={n}>{n}x de R$ {((principal * Math.pow(1 + (interestRate/100), n)) / n).toFixed(2)}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-orange-600">* Juros de {interestRate}% a.m. aplicados.</p>
                                </div>
                            )}

                            <div className="mt-auto flex gap-3">
                                <button onClick={() => setIsCheckoutOpen(false)} className="px-4 py-3 rounded-xl border font-bold">Cancelar</button>
                                <button onClick={handleFinishSale} disabled={isProcessing} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold">
                                    {isProcessing ? <LoadingSpinner /> : 'Confirmar Venda'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {successMsg && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl text-center shadow-2xl">
                        <h3 className="text-2xl font-black text-green-600 mb-2">Sucesso!</h3>
                        <p className="text-slate-500">{successMsg}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewSaleTab;
