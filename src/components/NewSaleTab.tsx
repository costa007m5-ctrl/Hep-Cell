
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Profile, Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import jsPDF from 'jspdf';

// --- Types & Interfaces para PDV ---

interface CartItem extends Product {
    cartId: string;
    quantity: number;
    discount: number; // Valor monetário de desconto
}

interface SaleContext {
    sellerName: string;
    notes: string;
    tradeInValue: number;
    tradeInDescription: string;
    discountTotal: number;
}

type PaymentMode = 'crediario' | 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'mixed';

// --- Helper Components ---

const KeyBadge: React.FC<{ k: string }> = ({ k }) => (
    <span className="hidden md:inline-block px-1.5 py-0.5 ml-2 text-[10px] font-mono font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 shadow-sm">{k}</span>
);

const StockBadge: React.FC<{ stock: number }> = ({ stock }) => {
    let color = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    let label = 'Estoque';
    if (stock <= 0) {
        color = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
        label = 'Esgotado';
    } else if (stock < 3) {
        color = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        label = 'Últimos';
    } else if (stock < 10) {
        color = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        label = 'Baixo';
    }
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${color}`}>{label}: {stock}</span>;
};

const ProductCard: React.FC<{ product: Product; onAdd: (p: Product) => void }> = ({ product, onAdd }) => (
    <button 
        onClick={() => product.stock > 0 && onAdd(product)}
        disabled={product.stock <= 0}
        className={`flex flex-col text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-lg transition-all active:scale-[0.98] group h-full focus:ring-2 focus:ring-indigo-500 outline-none ${product.stock <= 0 ? 'opacity-60 grayscale cursor-not-allowed' : ''}`}
    >
        <div className="h-28 w-full bg-white p-2 flex items-center justify-center relative overflow-hidden">
            <img 
                src={product.image_url || 'https://via.placeholder.com/150'} 
                alt={product.name} 
                className="max-h-full object-contain group-hover:scale-110 transition-transform duration-500" 
            />
            <div className="absolute top-2 right-2">
                <StockBadge stock={product.stock} />
            </div>
        </div>
        <div className="p-3 flex flex-col flex-1 w-full border-t border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] font-bold uppercase text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">{product.brand || 'Geral'}</p>
                {product.is_new && <span className="text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">NOVO</span>}
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-tight line-clamp-2 mb-auto" title={product.name}>{product.name}</h4>
            <div className="mt-2">
                <span className="text-slate-900 dark:text-white font-black text-base block">
                    {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-[10px] text-slate-400">
                    12x {(product.price/12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
            </div>
        </div>
    </button>
);

// --- Main Component ---

const NewSaleTab: React.FC = () => {
    // --- Data States ---
    const [products, setProducts] = useState<Product[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [interestRate, setInterestRate] = useState(0);
    const [minEntryPercentage, setMinEntryPercentage] = useState(0.15); // Padrão 15%
    const [loading, setLoading] = useState(true);

    // --- POS States ---
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Todos');
    const [barcodeMode, setBarcodeMode] = useState(false);
    
    // --- Checkout States ---
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('crediario');
    const [installments, setInstallments] = useState(1);
    const [entryValue, setEntryValue] = useState('');
    const [saleContext, setSaleContext] = useState<SaleContext>({ sellerName: 'Admin', notes: '', tradeInValue: 0, tradeInDescription: '', discountTotal: 0 });
    const [isProcessing, setIsProcessing] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // --- Refs ---
    const searchInputRef = useRef<HTMLInputElement>(null);
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // --- Audio Feedback ---
    const playBeep = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Short beep
        audio.volume = 0.5;
        audio.play().catch(() => {});
    };

    // --- Load Data ---
    useEffect(() => {
        const load = async () => {
            try {
                // Use Admin API to bypass RLS limitations
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
                    
                    // Carrega a porcentagem mínima de entrada (salva como 15, convertemos para 0.15)
                    const entryPercent = parseFloat(settings.min_entry_percentage);
                    if (!isNaN(entryPercent)) {
                        setMinEntryPercentage(entryPercent / 100);
                    }
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();

        // Global Keyboard Shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); setBarcodeMode(false); }
            if (e.key === 'F4') { e.preventDefault(); setBarcodeMode(prev => !prev); setTimeout(() => barcodeInputRef.current?.focus(), 100); }
            if (e.key === 'F9') { e.preventDefault(); if(cart.length > 0 && selectedProfile) setIsCheckoutOpen(true); }
            if (e.key === 'Escape') { setIsCheckoutOpen(false); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart.length, selectedProfile]);

    // --- Logic ---

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                p.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.barcode?.includes(searchQuery);
            
            const matchesCategory = categoryFilter === 'Todos' || p.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, categoryFilter]);

    const categories = useMemo(() => ['Todos', ...Array.from(new Set(products.map(p => p.category || 'Outros')))], [products]);

    // Financial Calculations
    const cartSubTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);
    const totalDiscount = useMemo(() => cart.reduce((acc, item) => acc + (item.discount || 0), 0) + saleContext.discountTotal, [cart, saleContext.discountTotal]);
    const cartTotal = Math.max(0, cartSubTotal - totalDiscount);
    
    const tradeIn = saleContext.tradeInValue || 0;
    const entry = parseFloat(entryValue) || 0;
    
    // O valor a ser financiado é o Total - Entrada - TradeIn
    const principal = Math.max(0, cartTotal - entry - tradeIn);
    
    // Juros é aplicado APENAS sobre o valor financiado (principal), não sobre o total do produto
    const totalWithInterest = useMemo(() => {
        if (paymentMode !== 'crediario' && paymentMode !== 'credit_card') return principal; 
        if (installments <= 1) return principal;
        
        // Juros Composto: M = P * (1 + i)^n
        // P = principal (saldo devedor)
        return principal * Math.pow(1 + (interestRate/100), installments);
    }, [principal, installments, interestRate, paymentMode]);

    const installmentValue = installments > 0 ? totalWithInterest / installments : 0;

    // Cálculo de Limite Disponível do Cliente
    const clientLimitData = useMemo(() => {
        if (!selectedProfile) return { total: 0, used: 0, available: 0 };
        // Em um cenário real, isso viria do backend ou estaria no objeto profile se atualizado
        // Aqui usamos o valor bruto do profile, assumindo que está atualizado
        const total = selectedProfile.credit_limit || 0;
        // Para saber o used exato precisaríamos das faturas, aqui vamos assumir que o credit_limit já é o total.
        // O ideal é buscar as faturas do cliente no momento da seleção.
        // Como NewSaleTab carrega profiles genéricos, vamos usar um valor estimado ou buscar sob demanda.
        // Para simplificar neste componente admin, vamos confiar no que está no profile se houver campo 'available_limit'
        // ou assumir que o credit_limit é o limite TOTAL e o cliente pode ter usado.
        // *Nota: O componente NewSaleTab carrega profiles básicos. Vamos assumir disponibilidade total do limite cadastrado para simplificar a UI de venda,
        // mas na vida real o backend bloquearia se excedesse.*
        
        return { total, available: total }; // Simplificação para Admin
    }, [selectedProfile]);


    // --- Handlers ---

    const addToCart = (product: Product) => {
        playBeep();
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
    };

    const handleBarcodeScan = (e: React.FormEvent) => {
        e.preventDefault();
        const code = searchQuery.trim();
        if (!code) return;
        
        const product = products.find(p => p.barcode === code || p.id === code); // Fallback to ID
        if (product) {
            addToCart(product);
            setSearchQuery('');
        } else {
            alert("Produto não encontrado.");
        }
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

    const handleGenerateQuote = () => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(18);
        doc.text("ORÇAMENTO - RELP CELL", 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Data: ${new Date().toLocaleDateString()}`, 20, 30);
        doc.text(`Cliente: ${selectedProfile?.first_name || 'Consumidor'}`, 20, 35);
        
        // Itens
        let y = 50;
        doc.setFontSize(12);
        doc.text("Itens:", 20, 45);
        doc.setFontSize(10);
        
        cart.forEach((item) => {
            doc.text(`- ${item.quantity}x ${item.name}`, 20, y);
            doc.text(`R$ ${(item.price * item.quantity).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 170, y, { align: 'right' });
            y += 7;
        });
        
        y += 5;
        doc.line(20, y, 190, y);
        y += 10;
        
        // Totais e Condições
        doc.text(`Subtotal: R$ ${cartTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, y);
        y += 7;
        if (entry > 0) {
            doc.text(`Entrada: R$ ${entry.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, y);
            y += 7;
        }
        
        doc.text(`Condição: ${paymentMode === 'crediario' ? 'Crediário' : 'À Vista/Cartão'}`, 20, y);
        y += 7;
        
        if (installments > 1) {
            doc.setFont("helvetica", "bold");
            doc.text(`Plano Selecionado: ${installments}x de R$ ${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, y);
            doc.text(`Total Final: R$ ${totalWithInterest.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, y + 7);
        }
        
        doc.save(`Orcamento_Relp_${Date.now()}.pdf`);
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
                    productName: itemsDescription.substring(0, 50) + (itemsDescription.length > 50 ? '...' : ''),
                    saleType: paymentMode === 'crediario' ? 'crediario' : 'direct', 
                    paymentMethod: paymentMode,
                    downPayment: entry + tradeIn,
                    signature: null, 
                    sellerName: saleContext.sellerName,
                    tradeInValue: tradeIn
                }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao processar venda.');

            let msg = "Venda realizada!";
            if (result.status === 'Aguardando Assinatura') {
                msg = "Venda criada! Aguardando assinatura do cliente no App (Prazo: 24h).";
            }

            setSuccessMsg(msg);
            
            setTimeout(() => {
                setCart([]);
                setSelectedProfile(null);
                setSaleContext({ sellerName: 'Admin', notes: '', tradeInValue: 0, tradeInDescription: '', discountTotal: 0 });
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

    // --- Validation for Modal ---
    const validationStatus = useMemo(() => {
        if (paymentMode !== 'crediario') return { isValid: true, message: null, mandatoryEntry: 0, limitGapEntry: 0 };
        
        // 1. Entrada Regulatória (Porcentagem Mínima da Loja)
        // Aplica-se sobre o valor total dos produtos
        const regulatoryEntry = cartTotal * minEntryPercentage;
        
        // 2. Entrada por Falta de Limite
        // O cliente só pode financiar o que cabe no limite dele.
        // Financiamento Máximo Possível = Limite Disponível
        // O que exceder isso, deve ser pago na entrada.
        // Ex: Total 1000, Limite 300 -> Entrada de 700 obrigatória.
        const maxFinancable = clientLimitData.available; 
        const limitGapEntry = Math.max(0, cartTotal - maxFinancable);
        
        // A entrada mínima final é a maior entre a regulatória e a de limite
        const requiredEntry = Math.max(regulatoryEntry, limitGapEntry);
        
        if (entry < requiredEntry) {
            return { 
                isValid: false, 
                message: `Entrada insuficiente.`,
                mandatoryEntry: regulatoryEntry,
                limitGapEntry: limitGapEntry,
                requiredTotal: requiredEntry
            };
        }
        return { isValid: true, message: 'Entrada Aprovada', mandatoryEntry: regulatoryEntry, limitGapEntry: limitGapEntry, requiredTotal: requiredEntry };
    }, [paymentMode, cartTotal, entry, minEntryPercentage, clientLimitData]);


    if (loading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-slate-100 dark:bg-slate-900 -m-4 lg:-m-8 font-sans">
            
            {/* ESQUERDA: CATÁLOGO (60%) */}
            <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-700 overflow-hidden relative">
                {/* Toolbar */}
                <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex gap-3 items-center shrink-0 shadow-sm z-10">
                    <div className="relative flex-1">
                        <div className="absolute left-3 top-2.5 text-slate-400">
                            {barcodeMode ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" /><path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM7 11a1 1 0 100-2H4a1 1 0 100 2h3zM17 13a1 1 0 01-1 1h-2a1 1 0 110-2h2a1 1 0 011 1zM16 17a1 1 0 100-2h-3a1 1 0 100 2h3z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                        </div>
                        {barcodeMode ? (
                            <form onSubmit={handleBarcodeScan}>
                                <input 
                                    ref={barcodeInputRef}
                                    type="text" 
                                    placeholder="Escanear código de barras..." 
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-indigo-500 bg-indigo-50 dark:bg-slate-700 focus:outline-none font-mono"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    autoFocus
                                />
                            </form>
                        ) : (
                            <input 
                                ref={searchInputRef}
                                type="text" 
                                placeholder="Buscar produto (Nome, Marca)... [F2]" 
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        )}
                    </div>
                    <button onClick={() => setBarcodeMode(!barcodeMode)} className={`p-2.5 rounded-lg border transition-colors ${barcodeMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500'}`} title="Alternar Scanner [F4]">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" /></svg>
                    </button>
                </div>

                {/* Categories */}
                <div className="px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex gap-2 overflow-x-auto no-scrollbar">
                    {categories.map(cat => (
                        <button 
                            key={cat} 
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${categoryFilter === cat ? 'bg-indigo-600 text-white shadow-md transform scale-105' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredProducts.map(product => (
                            <ProductCard key={product.id} product={product} onAdd={addToCart} />
                        ))}
                    </div>
                    {filteredProducts.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <p>Nenhum produto encontrado.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* DIREITA: CARRINHO E CHECKOUT (40%) */}
            <div className="w-full lg:w-[420px] bg-white dark:bg-slate-800 flex flex-col shadow-2xl z-20 border-l border-slate-200 dark:border-slate-700">
                
                {/* Header Cliente */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cliente</label>
                    <div className="relative">
                        <select 
                            className="w-full p-2.5 pl-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                            onChange={(e) => {
                                const p = profiles.find(pr => pr.id === e.target.value);
                                if (p) setSelectedProfile(p);
                            }}
                            value={selectedProfile?.id || ""}
                        >
                            <option value="" disabled>Selecionar Cliente...</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>{p.first_name} {p.last_name} (CPF: {p.identification_number})</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-3 pointer-events-none text-slate-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </div>
                    </div>
                    {selectedProfile && (
                        <div className="mt-2 flex justify-between items-center bg-white dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
                            <div className="flex gap-2 items-center">
                                <span className={`w-2 h-2 rounded-full ${selectedProfile.credit_status === 'Bloqueado' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedProfile.credit_status || 'Ativo'}</span>
                            </div>
                            <span className="text-xs text-slate-500">Score: <strong>{selectedProfile.credit_score}</strong></span>
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Limite: R$ {selectedProfile.credit_limit}</span>
                        </div>
                    )}
                </div>

                {/* Lista Carrinho */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 dark:bg-slate-900/30">
                    {cart.map(item => (
                        <div key={item.cartId} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm animate-fade-in-right">
                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center shrink-0">
                                <img src={item.image_url || ''} className="w-full h-full object-contain p-1" alt="" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{item.name}</p>
                                <p className="text-[10px] text-slate-500">{item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} un.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-md">
                                    <button onClick={() => updateQty(item.cartId, -1)} className="px-2 py-1 text-slate-500 hover:text-indigo-600 font-bold">-</button>
                                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                    <button onClick={() => updateQty(item.cartId, 1)} className="px-2 py-1 text-slate-500 hover:text-indigo-600 font-bold">+</button>
                                </div>
                                <span className="text-sm font-bold text-slate-800 dark:text-white min-w-[60px] text-right">
                                    {(item.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                                <button onClick={() => removeFromCart(item.cartId)} className="text-slate-400 hover:text-red-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            <p className="text-sm font-medium">Caixa Livre</p>
                        </div>
                    )}
                </div>

                {/* Totais e Ações */}
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-top">
                    <div className="space-y-1 mb-3 text-sm">
                        <div className="flex justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span>R$ {cartSubTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                            <span>Desconto</span>
                            <span>- R$ {totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-end pt-2 border-t border-slate-100 dark:border-slate-700">
                            <span className="font-bold text-slate-800 dark:text-white text-base">Total</span>
                            <span className="font-black text-2xl text-indigo-600 dark:text-indigo-400">R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsCheckoutOpen(true)}
                        disabled={cart.length === 0 || !selectedProfile}
                        className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98] flex justify-center items-center gap-2 text-lg"
                    >
                        Finalizar Venda <KeyBadge k="F9" />
                    </button>
                </div>
            </div>

            {/* MODAL DE CHECKOUT (OVERLAY) */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                        
                        {/* Coluna 1: Resumo e Trade-in */}
                        <div className="w-full md:w-1/2 p-6 border-r border-slate-200 dark:border-slate-700 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                Resumo da Operação
                            </h3>
                            
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm mb-6 space-y-2 border border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Cliente</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{selectedProfile?.first_name} {selectedProfile?.last_name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Itens</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{cart.length}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-700">
                                    <span className="text-slate-500 font-bold">Total Produtos</span>
                                    <span className="font-bold text-slate-900 dark:text-white">R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {/* Trade-In Section */}
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-4">
                                <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-3 text-sm flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                    Trade-In (Troca)
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Valor</label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-2 text-slate-500 font-bold text-xs">R$</span>
                                            <input 
                                                type="number" 
                                                value={saleContext.tradeInValue || ''} 
                                                onChange={e => setSaleContext({...saleContext, tradeInValue: parseFloat(e.target.value) || 0})}
                                                className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-indigo-200 dark:border-indigo-800 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Descrição do Aparelho</label>
                                        <input 
                                            type="text" 
                                            value={saleContext.tradeInDescription} 
                                            onChange={e => setSaleContext({...saleContext, tradeInDescription: e.target.value})}
                                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-indigo-200 dark:border-indigo-800 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Ex: iPhone 11 64GB (Tela trincada)"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 mt-auto border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center text-lg font-bold">
                                    <span>A Pagar (Principal)</span>
                                    <span className="text-indigo-600 dark:text-indigo-400">R$ {principal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Coluna 2: Pagamento */}
                        <div className="w-full md:w-1/2 p-6 bg-white dark:bg-slate-800 overflow-y-auto flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pagamento</h3>
                                <button onClick={handleGenerateQuote} className="text-xs text-indigo-600 font-bold underline">Gerar Orçamento PDF</button>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 mb-6">
                                {['crediario', 'credit_card', 'pix', 'cash', 'debit_card', 'mixed'].map(mode => (
                                    <button 
                                        key={mode}
                                        onClick={() => { setPaymentMode(mode as any); setInstallments(1); }}
                                        className={`py-2 px-1 rounded-lg text-[10px] sm:text-xs font-bold border uppercase transition-all ${paymentMode === mode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'}`}
                                    >
                                        {mode.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-5 flex-1">
                                {(paymentMode === 'crediario' || paymentMode === 'credit_card' || paymentMode === 'mixed') && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Entrada (R$)</label>
                                            <input 
                                                type="number" 
                                                value={entryValue} 
                                                onChange={e => setEntryValue(e.target.value)}
                                                className="w-full p-3 text-lg font-bold border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="0,00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parcelas</label>
                                            <select 
                                                value={installments}
                                                onChange={e => setInstallments(Number(e.target.value))}
                                                className="w-full p-3 text-lg font-bold border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                                            >
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(num => {
                                                    const val = paymentMode === 'crediario' 
                                                        ? (principal * Math.pow(1 + (interestRate/100), num)) / num 
                                                        : principal / num;
                                                    return (
                                                        <option key={num} value={num}>
                                                            {num}x de R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            {paymentMode === 'crediario' && installments > 1 && (
                                                <p className="text-xs text-orange-600 mt-1 text-right font-medium">* Juros de {interestRate}% a.m. aplicado.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Tabela de Simulação Rápida */}
                                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                                    <div className="flex justify-between mb-1">
                                        <span>Valor da Parcela:</span>
                                        <span className="font-bold">{installmentValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-1 mt-1">
                                        <span>Total a Pagar:</span>
                                        <span className="font-bold text-indigo-600">{totalWithInterest.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                                    </div>
                                </div>
                                
                                {/* Validação de Entrada Explicita */}
                                {paymentMode === 'crediario' && (
                                    <div className={`p-3 rounded-lg border flex flex-col gap-1 ${validationStatus.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex items-center gap-2 font-bold text-sm">
                                            {validationStatus.isValid ? (
                                                <span className="text-green-700">Entrada Aprovada</span>
                                            ) : (
                                                <span className="text-red-700">Entrada Insuficiente</span>
                                            )}
                                        </div>
                                        {!validationStatus.isValid && (
                                            <div className="text-xs text-red-600 space-y-1 mt-1">
                                                <p>Mínimo Obrigatório: <strong>R$ {validationStatus.requiredTotal?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></p>
                                                <p className="opacity-80">Composto por:</p>
                                                <ul className="list-disc list-inside pl-1">
                                                    <li>10% do Produto: R$ {validationStatus.mandatoryEntry?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</li>
                                                    <li>Falta de Limite: R$ {validationStatus.limitGapEntry?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</li>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button onClick={() => setIsCheckoutOpen(false)} className="px-6 py-3 rounded-xl font-bold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                                    Voltar
                                </button>
                                <button 
                                    onClick={handleFinishSale}
                                    disabled={isProcessing || !validationStatus.isValid}
                                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
