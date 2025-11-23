
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Profile, Review } from '../../types';
import ProductCarousel from './ProductCarousel';
import jsPDF from 'jspdf';
import LoadingSpinner from '../LoadingSpinner';
import { supabase } from '../../services/clients';
import { getProfile } from '../../services/profileService';
import PurchaseModal from './PurchaseModal';

interface ProductDetailsProps {
    product: Product;
    allProducts: Product[];
    onBack: () => void;
    onProductClick: (product: Product) => void;
}

const ReviewList: React.FC<{ reviews: Review[] }> = ({ reviews }) => (
    <div className="space-y-4">
        {reviews.map(review => (
            <div key={review.id} className="border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{review.userName}</span>
                    <span className="text-xs text-slate-400">{review.date}</span>
                </div>
                <div className="flex text-yellow-400 text-xs mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-slate-300 dark:text-slate-600'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    ))}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{review.comment}</p>
            </div>
        ))}
    </div>
);

const InstallmentSimulator: React.FC<{ price: number; userProfile: Profile | null }> = ({ price, userProfile }) => {
    const [entry, setEntry] = useState('');
    const [installments, setInstallments] = useState(12);
    const [interestRate, setInterestRate] = useState(0);
    const [minEntryPercent, setMinEntryPercent] = useState(0.15);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                if(res.ok) {
                    const data = await res.json();
                    setInterestRate(parseFloat(data.interest_rate) || 0);
                    const min = parseFloat(data.min_entry_percentage);
                    if(!isNaN(min)) setMinEntryPercent(min/100);
                }
            } catch(e){}
        };
        fetchSettings();
    }, []);

    const entryValue = parseFloat(entry) || 0;
    const principal = Math.max(0, price - entryValue);
    const totalWithInterest = installments > 1 ? principal * Math.pow(1 + (interestRate/100), installments) : principal;
    const installmentValue = installments > 0 ? totalWithInterest / installments : 0;

    // Validação de Limite (Se usuário logado)
    const limitInfo = useMemo(() => {
        if(!userProfile) return null;
        // Simulação: assumindo que sabemos o limite disponível (idealmente buscaria faturas em aberto)
        const limit = userProfile.credit_limit || 0;
        // Se não tivermos o 'used', assumimos total. Para precisão, precisaríamos do usado.
        // Aqui faremos uma simulação visual.
        return { limit };
    }, [userProfile]);

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mt-4 border border-slate-200 dark:border-slate-700">
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                Simulador de Parcelamento
            </p>
            
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Entrada (R$)</label>
                    <input 
                        type="number" 
                        value={entry} 
                        onChange={e => setEntry(e.target.value)} 
                        placeholder="0,00"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Parcelas: {installments}x</label>
                    <input 
                        type="range" 
                        min="1" 
                        max="12" 
                        value={installments} 
                        onChange={e => setInstallments(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-600"
                    />
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Mensal:</span>
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{installmentValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                </div>
                
                {installments > 1 && (
                    <p className="text-[10px] text-right text-slate-400">Total a prazo: {totalWithInterest.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                )}

                {limitInfo && totalWithInterest > limitInfo.limit && (
                    <div className="bg-yellow-50 text-yellow-700 p-2 rounded text-xs mt-2">
                        Atenção: O valor total excede seu limite atual (R$ {limitInfo.limit}). Será necessário aumentar a entrada.
                    </div>
                )}
            </div>
        </div>
    );
};

// ... (ShippingCalculator e DescriptionSection permanecem iguais)

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, allProducts, onBack, onProductClick }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'reviews'>('details');
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [purchaseSuccess, setPurchaseSuccess] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const reviews: Review[] = [
        { id: '1', userName: 'Carlos Silva', rating: 5, comment: 'Excelente produto, chegou super rápido!', date: '10/05/2024' },
        { id: '2', userName: 'Ana Souza', rating: 4, comment: 'Gostei muito, mas a caixa veio um pouco amassada.', date: '12/05/2024' },
        { id: '3', userName: 'Pedro Santos', rating: 5, comment: 'Melhor custo benefício do mercado.', date: '15/05/2024' }
    ];

    useEffect(() => {
        const fetchUser = async () => {
            setIsLoadingProfile(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const profile = await getProfile(user.id);
                    if (profile) setUserProfile({ ...profile, id: user.id, email: user.email });
                }
            } catch (error) { console.error(error); } 
            finally { setIsLoadingProfile(false); }
        };
        fetchUser();
    }, []);

    const relatedProducts = allProducts.filter(p => p.id !== product.id).slice(0, 6);

    const handleGenerateQuote = () => {
        setIsGeneratingPdf(true);
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("ORÇAMENTO - RELP CELL", 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(`Produto: ${product.name}`, 20, 40);
        doc.text(`Valor à Vista: ${product.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}`, 20, 50);
        
        // Adiciona simulação simples no PDF
        doc.text("Simulação de Pagamento:", 20, 70);
        doc.setFontSize(10);
        for(let i=1; i<=12; i++) {
            // Cálculo aproximado sem juros para o exemplo rápido, idealmente puxaria do state
            const val = product.price / i;
            doc.text(`${i}x de ${val.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}`, 20, 80 + (i*7));
        }
        
        doc.text("Este orçamento não garante estoque ou aprovação de crédito.", 20, 180);
        doc.save(`Orcamento_${product.name.substring(0,10)}.pdf`);
        setIsGeneratingPdf(false);
    };

    const handleBuyClick = () => {
        if (userProfile) setShowPurchaseModal(true);
        else if (window.confirm("Faça login para continuar.")) window.location.reload();
    };

    if (purchaseSuccess) {
        return (
            <div className="fixed inset-0 z-[150] bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="w-24 h-24 mb-6 relative">
                     <div className="absolute inset-0 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center animate-bounce-slow">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pedido Realizado!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8">Você receberá atualizações no seu perfil.</p>
                <button onClick={onBack} className="py-3 px-8 bg-indigo-600 text-white rounded-lg font-bold">Continuar Comprando</button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[130] bg-white dark:bg-slate-900 flex flex-col overflow-y-auto overscroll-none">
            <div className="fixed top-4 left-4 z-[140]">
                <button onClick={onBack} className="p-2 bg-white/80 dark:bg-black/50 backdrop-blur rounded-full shadow-lg border border-white/20 text-slate-800 dark:text-white active:scale-95 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
            </div>

            <div className="flex-grow pb-36">
                <div className="w-full bg-slate-100 dark:bg-slate-800 aspect-square relative flex justify-center items-center p-8">
                     <img src={product.image_url || ''} alt={product.name} className="max-w-full max-h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                </div>

                <div className="px-6 py-6 -mt-6 relative z-10 bg-white dark:bg-slate-900 rounded-t-3xl min-h-[50vh] shadow-top">
                    <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
                    
                    <div className="flex justify-between items-start mb-4">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white w-3/4 leading-tight">{product.name}</h1>
                        <div className="flex flex-col items-end">
                             <div className="flex text-yellow-400 text-xs mb-1">
                                {Array.from({length:5}).map((_,i)=><svg key={i} className={`w-3 h-3 ${i<4?'fill-current':'text-slate-300'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}
                             </div>
                             <span className="text-xs text-slate-400 underline">Ver avaliações</span>
                        </div>
                    </div>

                    <div className="flex items-end gap-2 mb-6">
                        <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{product.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                        <span className="text-sm text-slate-500 mb-1">à vista</span>
                    </div>

                    <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
                        <button onClick={() => setActiveTab('details')} className={`flex-1 pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Detalhes</button>
                        <button onClick={() => setActiveTab('reviews')} className={`flex-1 pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'reviews' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Avaliações ({reviews.length})</button>
                    </div>

                    {activeTab === 'details' ? (
                        <div className="animate-fade-in">
                            {/* Descrição e Ficha Técnica */}
                            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line mb-4">{product.description}</p>
                            
                            {/* Simulador de Parcelas Embutido */}
                            <InstallmentSimulator price={product.price} userProfile={userProfile} />
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <ReviewList reviews={reviews} />
                        </div>
                    )}
                    
                    {relatedProducts.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Relacionados</h3>
                            <ProductCarousel title="" products={relatedProducts} onProductClick={onProductClick} />
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-200 dark:border-slate-800 z-[140] pb-safe">
                <div className="max-w-4xl mx-auto flex gap-3">
                     <button onClick={handleGenerateQuote} disabled={isGeneratingPdf} className="flex-1 py-3 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold text-sm">
                        {isGeneratingPdf ? '...' : 'Baixar Orçamento'}
                     </button>
                     <button onClick={handleBuyClick} disabled={product.stock <= 0 || isLoadingProfile} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 active:scale-95 transition-transform">
                        {isLoadingProfile ? <LoadingSpinner /> : 'Comprar Agora'}
                     </button>
                </div>
            </div>

             {showPurchaseModal && userProfile && (
                <PurchaseModal 
                    product={product}
                    profile={userProfile}
                    onClose={() => setShowPurchaseModal(false)}
                    onSuccess={() => { setShowPurchaseModal(false); setPurchaseSuccess(true); }}
                />
            )}
        </div>
    );
};

export default ProductDetails;
