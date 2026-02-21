import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductReview, Profile } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import { supabase } from '../../services/clients';
import { useToast } from '../Toast';
import PurchaseModal from './PurchaseModal';
import ShippingCalculator from './ShippingCalculator';
import ProductCarousel from './ProductCarousel';

const StarIcon: React.FC<{ filled: boolean; onClick?: () => void }> = ({ filled, onClick }) => (
    <svg 
        onClick={onClick}
        className={`w-5 h-5 ${onClick ? 'cursor-pointer transition-transform active:scale-125' : ''} ${filled ? 'text-yellow-400 fill-current' : 'text-slate-300'}`} 
        viewBox="0 0 20 20"
    >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

interface ProductDetailsProps {
    product: Product;
    userProfile: Profile | null;
    onBack: () => void;
    onProductClick: (p: Product) => void;
    allProducts: Product[];
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, userProfile, onBack, onProductClick, allProducts }) => {
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(true);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [shippingInfo, setShippingInfo] = useState<{cost: number, days: number} | null>(null);
    const { addToast } = useToast();

    // Filtra produtos similares (mesma categoria, excluindo o atual)
    const similarProducts = useMemo(() => {
        return allProducts
            .filter(p => p.id !== product.id && (p.category === product.category || p.brand === product.brand))
            .sort(() => 0.5 - Math.random()) // Embaralha para variar
            .slice(0, 10);
    }, [product, allProducts]);

    useEffect(() => {
        const fetchReviews = async () => {
            setIsLoadingReviews(true);
            const { data } = await supabase
                .from('product_reviews')
                .select('*')
                .eq('product_id', product.id)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });
            setReviews(data || []);
            setIsLoadingReviews(false);
        };
        fetchReviews();
        
        // Faz scroll para o topo ao trocar de produto
        const container = document.getElementById('product-details-container');
        if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
        
    }, [product.id]);

    const handleSendReview = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingReview(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Faça login para avaliar");

            const { error } = await supabase.from('product_reviews').insert({
                product_id: product.id,
                user_id: user.id,
                user_name: user.user_metadata.first_name || 'Cliente',
                rating,
                comment,
                status: 'pending'
            });

            if (error) throw error;
            addToast("Obrigado! Avaliação enviada para moderação.", "success");
            setComment('');
        } catch (e: any) { addToast(e.message, "error"); } finally { setIsSubmittingReview(false); }
    };

    return (
        <div id="product-details-container" className="fixed inset-0 z-[130] bg-white dark:bg-slate-900 flex flex-col overflow-y-auto">
            {/* Header Flutuante */}
            <div className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-[140] pointer-events-none">
                <button 
                    onClick={onBack} 
                    className="p-3 bg-white/90 dark:bg-black/60 backdrop-blur-lg rounded-full shadow-xl border border-slate-100 dark:border-slate-800 pointer-events-auto active:scale-90 transition-transform"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                
                <div className="pointer-events-auto">
                    {product.is_full && (
                        <span className="bg-yellow-400 text-slate-900 text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg italic animate-bounce">ENVIO FULL</span>
                    )}
                </div>
            </div>

            <div className="p-6 pt-24 max-w-lg mx-auto w-full space-y-8">
                {/* Imagem Principal */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-50 dark:border-slate-800 flex items-center justify-center aspect-square relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <img 
                        src={product.image_url!} 
                        className="max-h-full max-w-full object-contain transform transition-transform duration-700 group-hover:scale-110" 
                        alt={product.name}
                    />
                </div>

                {/* Info Básica */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">{product.brand}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{product.category}</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{product.name}</h1>
                    <div className="flex items-baseline gap-2 mt-4">
                         <p className="text-3xl font-black text-slate-900 dark:text-white">R$ {product.price.toLocaleString('pt-BR')}</p>
                         <p className="text-xs text-slate-400 font-bold mb-1">à vista</p>
                    </div>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 font-bold">
                        ou até 12x de R$ {(product.price / 12).toFixed(2).replace('.', ',')}
                    </p>
                </div>

                {/* Bloco de Frete Automático */}
                <ShippingCalculator 
                    product={product} 
                    userProfile={userProfile} 
                    onCalculate={(cost, days) => setShippingInfo({ cost, days })}
                />

                {/* Vantagens */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <span className="text-2xl">🛡️</span>
                        <div className="leading-tight">
                            <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">Garantia Relp</p>
                            <p className="text-[9px] text-slate-500">{product.warranty_store || 3} meses direto na loja</p>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <span className="text-2xl">⚡</span>
                        <div className="leading-tight">
                            <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">Pronta Entrega</p>
                            <p className="text-[9px] text-slate-500">Envio em até 24h</p>
                        </div>
                    </div>
                </div>

                {/* Descrição */}
                <div className="space-y-3">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Sobre este produto</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{product.description}</p>
                </div>

                {/* FICHA TÉCNICA RÁPIDA */}
                {(product.processor || product.ram || product.storage) && (
                    <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Especificações</h3>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                            {product.processor && (
                                <div>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Processador</p>
                                    <p className="text-xs font-bold truncate">{product.processor}</p>
                                </div>
                            )}
                            {product.ram && (
                                <div>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Memória RAM</p>
                                    <p className="text-xs font-bold truncate">{product.ram}</p>
                                </div>
                            )}
                            {product.storage && (
                                <div>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Armazenamento</p>
                                    <p className="text-xs font-bold truncate">{product.storage}</p>
                                </div>
                            )}
                            {product.battery && (
                                <div>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Bateria</p>
                                    <p className="text-xs font-bold truncate">{product.battery}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- PRODUTOS SIMILARES --- */}
                {similarProducts.length > 0 && (
                    <div className="pt-4 -mx-6">
                        <ProductCarousel 
                            title="Quem viu este, também viu" 
                            products={similarProducts} 
                            onProductClick={(p) => onProductClick(p)} 
                        />
                    </div>
                )}

                {/* Seção Avaliações */}
                <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">O que dizem os clientes</h3>
                        <div className="flex items-center gap-1">
                             <span className="text-sm font-black text-slate-900 dark:text-white">4.9</span>
                             <StarIcon filled />
                        </div>
                    </div>
                    
                    <form onSubmit={handleSendReview} className="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-3xl mb-8 space-y-4 border border-indigo-100/50 dark:border-indigo-800/30">
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase text-center">Sua nota para este item</p>
                        <div className="flex justify-center gap-2">
                            {[1,2,3,4,5].map(s => <StarIcon key={s} filled={s <= rating} onClick={() => setRating(s)} />)}
                        </div>
                        <textarea 
                            value={comment} onChange={e => setComment(e.target.value)}
                            className="w-full p-4 rounded-2xl border-none bg-white dark:bg-slate-800 text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                            placeholder="Conte sua experiência com o produto..." rows={3} required
                        />
                        <button disabled={isSubmittingReview} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all active:scale-95">
                            {isSubmittingReview ? <LoadingSpinner /> : 'PUBLICAR AVALIAÇÃO'}
                        </button>
                    </form>

                    <div className="space-y-6 pb-24">
                        {isLoadingReviews ? (
                            <div className="flex justify-center py-4"><LoadingSpinner /></div>
                        ) : reviews.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-slate-400 text-sm italic">Este produto ainda não possui avaliações.</p>
                                <p className="text-xs text-slate-400 mt-1">Seja o primeiro a avaliar!</p>
                            </div>
                        ) : (
                            reviews.map(rev => (
                                <div key={rev.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-indigo-600">
                                                {rev.user_name[0]}
                                            </div>
                                            <div>
                                                <span className="font-bold text-sm text-slate-800 dark:text-white block">{rev.user_name}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{new Date(rev.created_at).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <StarIcon key={s} filled={s <= rev.rating} />)}</div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">"{rev.comment}"</p>
                                    
                                    {rev.reply && (
                                        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border-l-2 border-indigo-500">
                                            <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">Resposta da Relp Cell:</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{rev.reply}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Barra de Ação Fixa Inferior */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 pb-safe z-[140] flex gap-3 max-w-lg mx-auto w-full">
                <button 
                    onClick={() => window.dispatchEvent(new Event('open-support-chat'))}
                    className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl active:scale-95 transition-transform"
                    title="Dúvidas no WhatsApp"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </button>
                <button 
                    onClick={() => setShowPurchaseModal(true)} 
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-indigo-500/40 active:scale-[0.98] transition-all tracking-wider"
                >
                    COMPRAR AGORA
                </button>
            </div>

            {showPurchaseModal && userProfile && (
                <PurchaseModal 
                    product={product} 
                    profile={userProfile} 
                    onClose={() => setShowPurchaseModal(false)} 
                    onSuccess={() => { setShowPurchaseModal(false); onBack(); }}
                />
            )}
        </div>
    );
};

export default ProductDetails;