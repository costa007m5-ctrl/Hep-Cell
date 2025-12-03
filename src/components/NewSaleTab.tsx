import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Profile, Product, Invoice } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import jsPDF from 'jspdf';

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
    discountTotal: number;
}

type PaymentMode = 'crediario' | 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'mixed';

const StockBadge: React.FC<{ stock: number }> = ({ stock }) => {
    let color = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (stock <= 0) color = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    else if (stock < 3) color = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${color}`}>Estoque: {stock}</span>;
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
            <div className="absolute top-2 right-2"><StockBadge stock={product.stock} /></div>
        </div>
        <div className="p-3 flex flex-col flex-1 w-full border-t border-slate-100 dark:border-slate-700">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-tight line-clamp-2 mb-auto" title={product.name}>{product.name}</h4>
            <div className="mt-2">
                <span className="text-slate-900 dark:text-white font-black text-base block">
                    {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
            </div>
        </div>
    </button>
);

const PaymentResultModal: React.FC<{ data: any; onClose: () => void }> = ({ data, onClose }) => {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Venda Criada!</h3>
                <p className="text-sm text-slate-500">O pagamento da entrada (ou total) foi gerado. Peça ao cliente para pagar agora.</p>
                
                {data.type === 'pix' && (
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.qrCode)}`} className="mx-auto w-32 h-32 rounded-lg" alt="QR Code" />
                        <p className="text-xs font-mono text-slate-500 mt-2 break-all">{data.qrCode}</p>
                    </div>
                )}
                
                {data.type === 'boleto' && (
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="font-bold text-sm text-slate-700 dark:text-white">Código de Barras</p>
                        <p className="text-xs font-mono text-slate-500 mt-1 break-all select-all">{data.barcode}</p>
                        <a href={data.url} target="_blank" className="text-indigo-600 text-xs underline mt-2 block">Imprimir Boleto</a>
                    </div>
                )}

                <button onClick={onClose} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Concluir</button>
            </div>
        </div>
    );
};

const NewSaleTab: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
    const [interestRate, setInterestRate] = useState(0);
    const [minEntryPercentage, setMinEntryPercentage] = useState(0.15);
    const [loading, setLoading] = useState(true);

    // POS
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Todos');
    
    // Checkout
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('crediario');
    const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto' | 'cash' | 'redirect'>('pix');
    const [installments, setInstallments] = useState(1);
    const [entryValue, setEntryValue] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [discountApplied, setDiscountApplied] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentResult, setPaymentResult] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [prodRes, profRes, invRes, setRes] = await Promise.all([
                    fetch('/api/admin/products'),
                    fetch('/api/admin/profiles'),
                    fetch('/api/admin/invoices'),
                    fetch('/api/admin/settings')
                ]);
                
                if (prodRes.ok) setProducts(await prodRes.json());
                if (profRes.ok) setProfiles(await profRes.json());
                if (invRes.ok) setAllInvoices(await invRes.json());
                if (setRes.ok) {
                    const settings = await setRes.json();
                    setInterestRate(parseFloat(settings.interest_rate) || 0);
                    const entryPercent = parseFloat(settings.min_entry_percentage);
                    if (!isNaN(entryPercent)) setMinEntryPercentage(entryPercent / 100);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    // Filter Logic
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'Todos' || p.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, categoryFilter]);

    // Financials
    const cartSubTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    // Coupon Effect (Simulated Local Check before sending to backend)
    useEffect(() => {
        let disc = 0;
        const code = couponCode.toUpperCase();
        if (code === 'RELP10') disc = cartSubTotal * 0.10;
        if (code === 'BOASVINDAS') disc = 20;
        if (code === 'PROMO5') disc = cartSubTotal * 0.05;
        setDiscountApplied(disc);
    }, [couponCode, cartSubTotal]);

    const cartTotal = Math.max(0, cartSubTotal - discountApplied);
    const entry = parseFloat(entryValue) || 0;
    const principal = Math.max(0, cartTotal - entry);
    
    const totalWithInterest = useMemo(() => {
        if (paymentMode !== 'crediario') return principal; 
        if (installments <= 1) return principal;
        return principal * Math.pow(1 + (interestRate/100), installments);
    }, [principal, installments, interestRate, paymentMode]);

    const installmentValue = installments > 0 ? totalWithInterest / installments : 0;

    // Limit Logic
    const clientLimitData = useMemo(() => {
        if (!selectedProfile) return { totalMonthly: 0, availableMonthly: 0 };
        const totalMonthly = selectedProfile.credit_limit || 0;
        const userOpenInvoices = allInvoices.filter(inv => inv.user_id === selectedProfile.id && (inv.status === 'Em aberto' || inv.status === 'Boleto Gerado'));
        const monthlyCommitments: Record<string, number> = {};
        userOpenInvoices.forEach(inv => {
            const dueMonth = inv.due_date.substring(0, 7); 
            monthlyCommitments[dueMonth] = (monthlyCommitments[dueMonth] || 0) + inv.amount;
        });
        const maxMonthlyCommitment = Math.max(0, ...Object.values(monthlyCommitments));
        const availableMonthly = Math.max(0, totalMonthly - maxMonthlyCommitment);
        return { totalMonthly, availableMonthly };
    }, [selectedProfile, allInvoices]);

    const validationStatus = useMemo(() => {
        if (paymentMode !== 'crediario') return { isValid: true, message: null };
        const regulatoryEntry = cartTotal * minEntryPercentage;
        const interestFactor = installments > 1 ? Math.pow(1 + (interestRate/100), installments) : 1;
        const maxPrincipalAllowed = (clientLimitData.availableMonthly * installments) / interestFactor;
        const limitGapEntry = Math.max(0, cartTotal - maxPrincipalAllowed);
        const requiredEntry = Math.max(regulatoryEntry, limitGapEntry);
        
        if (entry < requiredEntry) {
            return { isValid: false, message: `Entrada mínima: R$ ${requiredEntry.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` };
        }
        return { isValid: true, message: 'Aprovado' };
    }, [paymentMode, cartTotal, entry, minEntryPercentage, clientLimitData, installments, interestRate]);

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
                    saleType: paymentMode === 'crediario' ? 'crediario' : 'direct', 
                    paymentMethod: paymentMethod, // Método de pagamento da ENTRADA (ou total)
                    downPayment: entry,
                    coinsUsed: 0, 
                    dueDay: 10,
                    couponCode: couponCode
                }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao processar venda.');

            if (result.paymentData) {
                setPaymentResult(result.paymentData);
            } else {
                setPaymentResult({ type: 'cash' }); // Apenas sucesso
            }
            
            // Clear cart
            setCart([]);
            setEntryValue('');
            setCouponCode('');

        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-slate-100 dark:bg-slate-900 -m-4 lg:-m-8 font-sans">
            {/* Catalog (Left) */}
            <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-700 overflow-hidden relative">
                <div className="p-4 bg-white dark:bg-slate-800 border-b flex gap-3 items-center shrink-0 shadow-sm z-10">
                    <input 
                        type="text" 
                        placeholder="Buscar produto..." 
                        className="flex-1 pl-4 pr-4 py-2.5 rounded-lg border bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredProducts.map(p => (
                            <ProductCard key={p.id} product={p} onAdd={(prod) => setCart(prev => [...prev, {...prod, cartId: Math.random().toString(), quantity: 1, discount: 0}])} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Checkout (Right) */}
            <div className="w-full lg:w-[420px] bg-white dark:bg-slate-800 flex flex-col shadow-2xl z-20 border-l">
                <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
                    <select 
                        className="w-full p-2.5 rounded-lg border bg-white dark:bg-slate-800"
                        onChange={(e) => setSelectedProfile(profiles.find(p => p.id === e.target.value) || null)}
                        value={selectedProfile?.id || ""}
                    >
                        <option value="" disabled>Selecionar Cliente...</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                    </select>
                    {selectedProfile && (
                        <div className="mt-2 text-xs flex justify-between font-bold text-slate-500">
                            <span>Limite Mensal: R$ {clientLimitData.totalMonthly.toFixed(2)}</span>
                            <span className="text-green-600">Disp: R$ {clientLimitData.availableMonthly.toFixed(2)}</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 dark:bg-slate-900/30">
                    {cart.map(item => (
                        <div key={item.cartId} className="flex justify-between p-2 bg-white dark:bg-slate-800 rounded border">
                            <span className="text-sm font-bold truncate w-40">{item.name}</span>
                            <span className="text-sm font-bold">R$ {item.price.toFixed(2)}</span>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white dark:bg-slate-800 border-t shadow-top space-y-3">
                    <div className="flex justify-between text-sm font-bold">
                        <span>Total Produtos</span>
                        <span>R$ {cartSubTotal.toFixed(2)}</span>
                    </div>
                    
                    <button onClick={() => setIsCheckoutOpen(true)} disabled={cart.length === 0 || !selectedProfile} className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50">
                        Finalizar Venda
                    </button>
                </div>
            </div>

            {/* Modal de Pagamento/Configuração */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Checkout</h3>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Cupom</label>
                                <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value)} className="w-full p-2 border rounded" placeholder="CODIGO" />
                                {discountApplied > 0 && <p className="text-xs text-green-600 font-bold mt-1">Desconto: -R$ {discountApplied.toFixed(2)}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Total Final</label>
                                <p className="text-xl font-black text-slate-900 dark:text-white">R$ {cartTotal.toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Tipo de Venda</label>
                            <div className="flex gap-2">
                                <button onClick={() => setPaymentMode('crediario')} className={`flex-1 py-2 rounded border font-bold ${paymentMode === 'crediario' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : ''}`}>Crediário</button>
                                <button onClick={() => { setPaymentMode('cash'); setInstallments(1); setEntryValue(''); }} className={`flex-1 py-2 rounded border font-bold ${paymentMode === 'cash' ? 'bg-green-100 border-green-500 text-green-700' : ''}`}>À Vista / Direto</button>
                            </div>
                        </div>

                        {paymentMode === 'crediario' && (
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border mb-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Entrada (R$)</label>
                                        <input type="number" value={entryValue} onChange={e => setEntryValue(e.target.value)} className="w-full p-2 border rounded" placeholder="0.00" />
                                        {!validationStatus.isValid && <p className="text-xs text-red-500 font-bold mt-1">{validationStatus.message}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Parcelas</label>
                                        <select value={installments} onChange={e => setInstallments(Number(e.target.value))} className="w-full p-2 border rounded">
                                            {Array.from({length:12},(_,i)=>i+1).map(n => <option key={n} value={n}>{n}x</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-2 text-right">
                                    <p className="text-xs font-bold text-slate-500">Valor Parcela: R$ {installmentValue.toFixed(2)}</p>
                                    <p className="text-xs font-bold text-indigo-600">Total Financiado: R$ {totalWithInterest.toFixed(2)}</p>
                                </div>
                            </div>
                        )}

                        <div className="mb-6">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Como pagar a Entrada/Total?</label>
                            <div className="grid grid-cols-4 gap-2">
                                <button onClick={() => setPaymentMethod('pix')} className={`py-2 border rounded font-bold text-xs ${paymentMethod === 'pix' ? 'bg-green-100 border-green-500' : ''}`}>PIX</button>
                                <button onClick={() => setPaymentMethod('boleto')} className={`py-2 border rounded font-bold text-xs ${paymentMethod === 'boleto' ? 'bg-orange-100 border-orange-500' : ''}`}>Boleto</button>
                                <button onClick={() => setPaymentMethod('redirect')} className={`py-2 border rounded font-bold text-xs ${paymentMethod === 'redirect' ? 'bg-blue-100 border-blue-500' : ''}`}>Link MP</button>
                                <button onClick={() => setPaymentMethod('cash')} className={`py-2 border rounded font-bold text-xs ${paymentMethod === 'cash' ? 'bg-slate-200 border-slate-400' : ''}`}>Dinheiro</button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsCheckoutOpen(false)} className="flex-1 py-3 border rounded-xl font-bold">Cancelar</button>
                            <button 
                                onClick={handleFinishSale} 
                                disabled={isProcessing || (paymentMode === 'crediario' && !validationStatus.isValid)} 
                                className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50"
                            >
                                {isProcessing ? <LoadingSpinner /> : 'Confirmar e Gerar Pagamento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {paymentResult && <PaymentResultModal data={paymentResult} onClose={() => { setPaymentResult(null); setIsCheckoutOpen(false); }} />}
        </div>
    );
};

export default NewSaleTab;