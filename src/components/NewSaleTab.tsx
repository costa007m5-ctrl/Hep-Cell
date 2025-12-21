
import React, { useState, useEffect, useMemo } from 'react';
import { Profile, Product, Invoice } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import SignaturePad from './SignaturePad';
import Modal from './Modal';

interface CartItem extends Product {
    cartId: string;
    quantity: number;
    discount: number;
}

type SaleType = 'crediario' | 'direct';
type PaymentMethod = 'pix' | 'boleto' | 'redirect' | 'cash';

const StockBadge: React.FC<{ stock: number }> = ({ stock }) => {
    let color = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (stock <= 0) color = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    else if (stock < 3) color = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${color}`}>Est: {stock}</span>;
};

const ProductCard: React.FC<{ product: Product; onAdd: (p: Product) => void }> = ({ product, onAdd }) => (
    <button 
        onClick={() => product.stock > 0 && onAdd(product)}
        disabled={product.stock <= 0}
        className={`flex flex-col text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-lg transition-all active:scale-[0.98] group h-full focus:ring-2 focus:ring-indigo-500 outline-none ${product.stock <= 0 ? 'opacity-60 grayscale cursor-not-allowed' : ''}`}
    >
        <div className="h-24 w-full bg-white p-2 flex items-center justify-center relative overflow-hidden">
            <img src={product.image_url || 'https://via.placeholder.com/150'} alt={product.name} className="max-h-full object-contain group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute top-1 right-1"><StockBadge stock={product.stock} /></div>
        </div>
        <div className="p-2 flex flex-col flex-1 w-full border-t border-slate-100 dark:border-slate-700">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-tight line-clamp-2 mb-auto">{product.name}</h4>
            <div className="mt-1">
                <span className="text-slate-900 dark:text-white font-black text-sm block">
                    {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
            </div>
        </div>
    </button>
);

const PaymentResultModal: React.FC<{ data: any; onClose: () => void }> = ({ data, onClose }) => {
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Venda Confirmada!</h3>
                <p className="text-sm text-slate-500">Realize a cobrança abaixo.</p>
                
                {data.type === 'pix' && (
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.qrCode)}`} className="mx-auto w-32 h-32 rounded-lg mix-blend-multiply dark:mix-blend-normal" alt="QR Code" />
                        <p className="text-[10px] font-mono text-slate-500 mt-2 break-all bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700 select-all">{data.qrCode}</p>
                        <p className="text-xs font-bold text-indigo-600 mt-2">Pagamento Pix</p>
                    </div>
                )}
                
                {data.type === 'boleto' && (
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="font-bold text-sm text-slate-700 dark:text-white">Código de Barras</p>
                        <p className="text-xs font-mono text-slate-500 mt-1 break-all select-all bg-white dark:bg-slate-900 p-2 rounded">{data.barcode}</p>
                        <a href={data.url} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs underline mt-2 block font-bold">Imprimir Boleto</a>
                    </div>
                )}

                {data.type === 'redirect' && (
                    <div className="space-y-2">
                        <a href={data.url} target="_blank" rel="noreferrer" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold block hover:bg-blue-700">Abrir Link de Pagamento</a>
                    </div>
                )}

                {data.type === 'cash' && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 rounded-xl">
                        <p className="font-bold">Pagamento em Dinheiro</p>
                        <p className="text-xs">Registrado no caixa.</p>
                    </div>
                )}

                <button onClick={onClose} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700">Fechar</button>
            </div>
        </Modal>
    );
};

const NewSaleTab: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
    const [interestRate, setInterestRate] = useState(0);
    const [minEntryPercentage, setMinEntryPercentage] = useState(0.15);
    const [loading, setLoading] = useState(true);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isSignatureOpen, setIsSignatureOpen] = useState(false);
    
    const [saleType, setSaleType] = useState<SaleType>('crediario');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
    const [installments, setInstallments] = useState(1);
    const [entryValue, setEntryValue] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [signature, setSignature] = useState<string | null>(null);
    const [dueDay, setDueDay] = useState(10);

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

    const filteredProducts = useMemo(() => {
        return products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand?.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [products, searchQuery]);

    const cartSubTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    const discountApplied = useMemo(() => {
        const code = couponCode.toUpperCase();
        if (code === 'RELP10') return cartSubTotal * 0.10;
        if (code === 'BOASVINDAS') return 20;
        if (code === 'PROMO5') return cartSubTotal * 0.05;
        if (code === 'DESC50') return 50;
        return 0;
    }, [couponCode, cartSubTotal]);

    const cartTotal = Math.max(0, cartSubTotal - discountApplied);
    const entry = parseFloat(entryValue) || 0;
    const principal = Math.max(0, cartTotal - entry);
    
    const totalWithInterest = useMemo(() => {
        if (saleType !== 'crediario') return cartTotal; 
        if (installments <= 1) return principal;
        return principal * Math.pow(1 + (interestRate/100), installments);
    }, [principal, installments, interestRate, saleType, cartTotal]);

    const installmentValue = installments > 0 ? totalWithInterest / installments : 0;

    const availableLimit = useMemo(() => {
        if (!selectedProfile) return 0;
        const totalMonthly = selectedProfile.credit_limit || 0;
        
        // CORREÇÃO: Ignorar faturas marcadas como venda direta/à vista no cálculo do limite comprometido
        const userOpenInvoices = allInvoices.filter(inv => 
            inv.user_id === selectedProfile.id && 
            (inv.status === 'Em aberto' || inv.status === 'Boleto Gerado') &&
            !inv.notes?.includes('VENDA_AVISTA')
        );

        const monthlyCommitments: Record<string, number> = {};
        userOpenInvoices.forEach(inv => {
            const dueMonth = inv.due_date.substring(0, 7); 
            monthlyCommitments[dueMonth] = (monthlyCommitments[dueMonth] || 0) + inv.amount;
        });
        const maxMonthlyCommitment = Math.max(0, ...Object.values(monthlyCommitments));
        return Math.max(0, totalMonthly - maxMonthlyCommitment);
    }, [selectedProfile, allInvoices]);

    const limitAnalysis = useMemo(() => {
        if (saleType !== 'crediario') return { isValid: true, message: '', requiredEntry: 0 };
        const requiredMinEntry = cartTotal * minEntryPercentage;
        const maxFinanceable = availableLimit * installments;
        const minEntryForLimit = Math.max(0, cartTotal - maxFinanceable);
        const finalRequiredEntry = Math.max(requiredMinEntry, minEntryForLimit);
        const isSufficient = entry >= finalRequiredEntry;
        return {
            isValid: isSufficient,
            requiredEntry: finalRequiredEntry,
            limitExceeded: installmentValue > availableLimit,
            message: isSufficient ? 'Aprovado' : `Entrada insuficiente. Mínimo: R$ ${finalRequiredEntry.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        };
    }, [saleType, cartTotal, minEntryPercentage, availableLimit, installments, entry, installmentValue]);

    const validationStatus = useMemo(() => {
        if (saleType !== 'crediario') return { isValid: true, message: 'Venda Direta' };
        return { isValid: limitAnalysis.isValid, message: limitAnalysis.message };
    }, [saleType, limitAnalysis]);

    const handleProcessSale = async () => {
        if (!selectedProfile) return;
        setIsProcessing(true);
        try {
            const itemsDescription = cart.map(i => `${i.quantity}x ${i.name}`).join(', ');
            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedProfile.id,
                    totalAmount: cartSubTotal, 
                    installments: installments,
                    productName: itemsDescription.substring(0, 100),
                    saleType: saleType,
                    paymentMethod: paymentMethod,
                    downPayment: entry,
                    coinsUsed: 0,
                    dueDay: dueDay,
                    couponCode: couponCode,
                    signature: signature
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao processar venda.');
            setPaymentResult(result.paymentData || { type: 'cash' });
            setCart([]);
            setEntryValue('');
            setCouponCode('');
            setIsCheckoutOpen(false);
            setIsSignatureOpen(false);
            setSignature(null);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePreSubmit = () => {
        if (!validationStatus.isValid) {
            alert(validationStatus.message);
            return;
        }
        if (saleType === 'crediario') setIsSignatureOpen(true);
        else handleProcessSale();
    };

    if (loading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-slate-100 dark:bg-slate-900 -m-4 lg:-m-8 font-sans">
            <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-700 overflow-hidden relative">
                <div className="p-4 bg-white dark:bg-slate-800 border-b flex gap-3 items-center shrink-0 shadow-sm z-10">
                    <input type="text" placeholder="Buscar produto..." className="flex-1 pl-4 pr-4 py-2.5 rounded-lg border bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredProducts.map(p => (
                            <ProductCard key={p.id} product={p} onAdd={(prod) => setCart(prev => [...prev, {...prod, cartId: Math.random().toString(), quantity: 1, discount: 0}])} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-[420px] bg-white dark:bg-slate-800 flex flex-col shadow-2xl z-20 border-l border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
                    <select className="w-full p-2.5 rounded-lg border bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" onChange={(e) => setSelectedProfile(profiles.find(p => p.id === e.target.value) || null)} value={selectedProfile?.id || ""}>
                        <option value="" disabled>Selecionar...</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                    </select>
                    {selectedProfile && (
                        <div className="mt-2 text-xs flex justify-between font-bold text-slate-500">
                            <span>Limite Mensal: R$ {selectedProfile.credit_limit?.toFixed(2)}</span>
                            <span className={availableLimit < 0 ? 'text-red-500' : 'text-green-600'}>Disp: R$ {availableLimit.toFixed(2)}</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 dark:bg-slate-900/30">
                    {cart.map(item => (
                        <div key={item.cartId} className="flex justify-between p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-700">
                            <span className="text-sm font-bold truncate w-40 dark:text-white">{item.name}</span>
                            <span className="text-sm font-bold dark:text-white">R$ {item.price.toFixed(2)}</span>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white dark:bg-slate-800 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] space-y-3">
                    <div className="flex justify-between text-sm font-bold dark:text-white">
                        <span>Total Produtos</span>
                        <span>R$ {cartSubTotal.toFixed(2)}</span>
                    </div>
                    <button onClick={() => setIsCheckoutOpen(true)} disabled={cart.length === 0 || !selectedProfile} className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]">
                        Ir para Pagamento
                    </button>
                </div>
            </div>

            {isCheckoutOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pagamento e Entrega</h3>
                            <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white p-2 rounded-full">✕</button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-4">
                                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex">
                                    <button onClick={() => setSaleType('crediario')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${saleType === 'crediario' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Crediário</button>
                                    <button onClick={() => { setSaleType('direct'); setInstallments(1); setEntryValue(''); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500'}`}>À Vista</button>
                                </div>

                                <div className="space-y-3">
                                    {saleType === 'crediario' && (
                                        <div className={`p-4 rounded-xl border ${limitAnalysis.isValid ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'}`}>
                                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                                                <span>Análise de Crédito</span>
                                                <span className={limitAnalysis.isValid ? 'text-green-600' : 'text-amber-600'}>
                                                    {limitAnalysis.limitExceeded ? 'Limite Insuficiente' : 'Disponível'}
                                                </span>
                                            </div>
                                            
                                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Entrada Necessária (R$)</label>
                                            <input 
                                                type="number" 
                                                value={entryValue} 
                                                onChange={e => setEntryValue(e.target.value)} 
                                                className={`w-full p-2.5 border rounded-lg dark:bg-slate-800 dark:text-white font-bold text-lg focus:ring-2 outline-none transition-all ${!limitAnalysis.isValid ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200 focus:ring-indigo-500'}`}
                                                placeholder="0.00" 
                                            />
                                            {!limitAnalysis.isValid && (
                                                <p className="text-xs text-amber-600 mt-1 font-bold">
                                                    Mínimo para aprovar: R$ {limitAnalysis.requiredEntry.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Cupom</label>
                                        <div className="flex gap-2">
                                            <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-slate-800 dark:text-white uppercase font-mono" placeholder="CÓDIGO" />
                                        </div>
                                        {discountApplied > 0 && <p className="text-xs text-green-600 font-bold mt-1">Desconto: -R$ {discountApplied.toFixed(2)}</p>}
                                    </div>

                                    {saleType === 'crediario' && (
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Parcelas</label>
                                            <select value={installments} onChange={e => setInstallments(Number(e.target.value))} className="w-full p-2.5 border rounded-lg dark:bg-slate-800 dark:text-white font-bold">
                                                {Array.from({length:12},(_,i)=>i+1).map(n => <option key={n} value={n}>{n}x</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 flex flex-col">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Forma de Pagamento (Entrada/Total)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setPaymentMethod('pix')} className={`py-3 border rounded-lg font-bold text-xs flex flex-col items-center gap-1 transition-all ${paymentMethod === 'pix' ? 'bg-green-50 border-green-500 text-green-700' : ''}`}>Pix</button>
                                        <button onClick={() => setPaymentMethod('boleto')} className={`py-3 border rounded-lg font-bold text-xs flex flex-col items-center gap-1 transition-all ${paymentMethod === 'boleto' ? 'bg-orange-50 border-orange-500 text-orange-700' : ''}`}>Boleto</button>
                                        <button onClick={() => setPaymentMethod('redirect')} className={`py-3 border rounded-lg font-bold text-xs flex flex-col items-center gap-1 transition-all ${paymentMethod === 'redirect' ? 'bg-blue-50 border-blue-500 text-blue-700' : ''}`}>Link</button>
                                        <button onClick={() => setPaymentMethod('cash')} className={`py-3 border rounded-lg font-bold text-xs flex flex-col items-center gap-1 transition-all ${paymentMethod === 'cash' ? 'bg-slate-200 border-slate-400 text-slate-700' : ''}`}>Dinheiro</button>
                                    </div>
                                </div>

                                <div className="mt-auto bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm text-slate-500">Subtotal</span>
                                        <span className="text-sm font-bold dark:text-white">R$ {cartSubTotal.toFixed(2)}</span>
                                    </div>
                                    {discountApplied > 0 && (
                                        <div className="flex justify-between mb-2 text-green-600">
                                            <span className="text-sm">Desconto</span>
                                            <span className="text-sm font-bold">- R$ {discountApplied.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">Total</span>
                                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">R$ {cartTotal.toFixed(2)}</span>
                                    </div>
                                    {saleType === 'crediario' && (
                                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-xs">
                                            <span>Sua Parcela:</span>
                                            <span className={`font-bold ${!validationStatus.isValid ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>{installments}x de R$ {installmentValue.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {!validationStatus.isValid && saleType === 'crediario' && (
                            <div className="mb-4">
                                <Alert message={validationStatus.message || "Erro validação"} type="error" />
                            </div>
                        )}

                        <button 
                            onClick={handlePreSubmit} 
                            disabled={isProcessing || (saleType === 'crediario' && !validationStatus.isValid)} 
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        >
                            {isProcessing ? <LoadingSpinner /> : (saleType === 'crediario' ? 'Assinar e Concluir' : 'Concluir Venda')}
                        </button>
                    </div>
                </div>
            )}

            {isSignatureOpen && (
                <Modal isOpen={true} onClose={() => setIsSignatureOpen(false)}>
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Assinatura Digital</h3>
                        <p className="text-xs text-slate-500">Ao assinar, você concorda com os termos do contrato de crediário.</p>
                        <SignaturePad onEnd={setSignature} />
                        <button onClick={handleProcessSale} disabled={!signature || isProcessing} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 flex justify-center shadow-lg">
                            {isProcessing ? <LoadingSpinner /> : 'Confirmar Venda'}
                        </button>
                    </div>
                </Modal>
            )}

            {paymentResult && <PaymentResultModal data={paymentResult} onClose={() => { setPaymentResult(null); }} />}
        </div>
    );
};

export default NewSaleTab;
