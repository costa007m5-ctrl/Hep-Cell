
import React, { useState, useEffect } from 'react';
import { Product, ProductReview, Profile } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import { supabase } from '../../services/clients';
import { useToast } from '../Toast';
import PurchaseModal from './PurchaseModal';
import ShippingCalculator from './ShippingCalculator';

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

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, userProfile, onBack }) => {
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(true);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [shippingInfo, setShippingInfo] = useState<{cost: number, days: number} | null>(null);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchReviews = async () => {
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
            addToast("Obrigado! Avaliação enviada.", "success");
            setComment('');
        } catch (e: any) { addToast(e.message, "error"); } finally { setIsSubmittingReview(false); }
    };

    return (
        <div className="fixed inset-0 z-[130] bg-white dark:bg-slate-900 flex flex-col overflow-y-auto">
            <button onClick={onBack} className="fixed top-4 left-4 p-3 bg-white/80 dark:bg-black/50 backdrop-blur rounded-full shadow-lg z-[140] active:scale-90 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>

            <div className="p-6 pt-20 max-w-lg mx-auto w-full space-y-6">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center aspect-square">
                    <img src={product.image_url!} className="max-h-full max-w-full object-contain" />
                </div>

                <div className="space-y-2">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{product.brand}</p>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{product.name}</h1>
                    <div className="flex items-center gap-3">
                         <p className="text-3xl font-black text-slate-900 dark:text-white">R$ {product.price.toLocaleString('pt-BR')}</p>
                         {product.is_full && <span className="bg-yellow-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded shadow-sm italic">FULL</span>}
                    </div>
                </div>

                {/* Bloco de Frete Automático */}
                <ShippingCalculator 
                    product={product} 
                    userProfile={userProfile} 
                    onCalculate={(cost, days) => setShippingInfo({ cost, days })}
                />

                <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">Destaques</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">💳</span>
                            <div className="text-[10px] leading-tight"><p className="font-bold">12x Sem Juros</p><p className="text-slate-400">Cartão Relp</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🔄</span>
                            <div className="text-[10px] leading-tight"><p className="font-bold">Troca Grátis</p><p className="text-slate-400">Até 7 dias</p></div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="font-bold text-slate-900 dark:text-white">Descrição</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{product.description}</p>
                </div>

                {/* Seção Avaliações */}
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-lg mb-6">Avaliações</h3>
                    
                    <form onSubmit={handleSendReview} className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl mb-8 space-y-4">
                        <div className="flex gap-2">
                            {[1,2,3,4,5].map(s => <StarIcon key={s} filled={s <= rating} onClick={() => setRating(s)} />)}
                        </div>
                        <textarea 
                            value={comment} onChange={e => setComment(e.target.value)}
                            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                            placeholder="Sua opinião é importante..." rows={2} required
                        />
                        <button disabled={isSubmittingReview} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50">
                            {isSubmittingReview ? <LoadingSpinner /> : 'Enviar'}
                        </button>
                    </form>

                    <div className="space-y-6 pb-20">
                        {reviews.length === 0 ? <p className="text-slate-400 text-center py-4 italic">Sem avaliações.</p> : reviews.map(rev => (
                            <div key={rev.id} className="space-y-1">
                                <div className="flex justify-between">
                                    <span className="font-bold text-xs">{rev.user_name}</span>
                                    <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <StarIcon key={s} filled={s <= rev.rating} />)}</div>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{rev.comment}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe z-[140]">
                <button onClick={() => setShowPurchaseModal(true)} className="w-full max-w-lg mx-auto py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-2xl shadow-indigo-500/20 active:scale-95 transition-transform">Comprar Agora</button>
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
