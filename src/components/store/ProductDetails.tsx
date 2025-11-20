
import React, { useState, useEffect } from 'react';
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

const ShippingCalculator = () => {
    const [cep, setCep] = useState('');
    const [shipping, setShipping] = useState<{ price: string; days: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const calculate = () => {
        if (cep.length < 8) return;
        setLoading(true);
        setTimeout(() => {
            setShipping({ price: 'R$ 25,90', days: '3 a 5 dias úteis' });
            setLoading(false);
        }, 1000);
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mt-4">
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Calcular Frete e Prazo</p>
            <div className="flex gap-2">
                <input type="text" placeholder="00000-000" maxLength={9} value={cep} onChange={(e) => setCep(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
                <button onClick={calculate} className="px-4 py-2 bg-slate-800 dark:bg-slate-600 text-white rounded-lg text-xs font-bold">OK</button>
            </div>
            {loading && <p className="text-xs text-slate-500 mt-2">Calculando...</p>}
            {shipping && (
                <div className="mt-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-300">Expresso</span>
                        <span className="font-bold text-slate-800 dark:text-white">{shipping.price}</span>
                    </div>
                    <p className="text-xs text-green-600 mt-1">Chega em {shipping.days}</p>
                </div>
            )}
        </div>
    );
};

// Novo componente para renderizar a descrição em blocos organizados
const DescriptionSection: React.FC<{ description: string }> = ({ description }) => {
    if (!description) return <p className="text-slate-600 dark:text-slate-300 text-sm">Sem descrição.</p>;

    // Tenta dividir por seções Markdown (### Titulo)
    const sections = description.split(/###\s+/).filter(Boolean);

    // Se não houver seções claras, exibe o texto completo
    if (sections.length <= 1 && !description.includes('###')) {
        return <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">{description}</p>;
    }

    return (
        <div className="space-y-4">
            {sections.map((section, index) => {
                const [title, ...contentLines] = section.split('\n');
                const content = contentLines.join('\n').trim();
                
                // Layout especial para Ficha Técnica (Tabela Zebrada)
                if (title.toLowerCase().includes('ficha') || title.toLowerCase().includes('técnica') || title.toLowerCase().includes('specs')) {
                     const specs = content.split('\n').filter(line => line.trim().length > 0);
                     return (
                        <div key={index} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                             <h3 className="bg-slate-100 dark:bg-slate-700/80 px-4 py-2 text-sm font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-600 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                                {title}
                             </h3>
                             <div className="text-sm">
                                {specs.map((line, i) => {
                                    const [key, val] = line.split(':').map(s => s.trim().replace(/^-/, ''));
                                    return (
                                        <div key={i} className={`px-4 py-2 flex justify-between ${i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                                            <span className="text-slate-500 dark:text-slate-400 font-medium">{key}</span>
                                            <span className="text-slate-800 dark:text-slate-200 text-right ml-4">{val || ''}</span>
                                        </div>
                                    )
                                })}
                             </div>
                        </div>
                     )
                }

                // Layout Exclusivo para Destaques
                if (title.toLowerCase().includes('destaques') || title.toLowerCase().includes('highlights') || title.toLowerCase().includes('principais')) {
                    const points = content.split('\n').filter(line => line.trim().length > 0);
                    return (
                         <div key={index} className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/50 p-5 shadow-sm relative overflow-hidden">
                            {/* Detalhe decorativo */}
                            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                            
                            <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200 mb-4 flex items-center gap-2 relative z-10">
                                <span className="bg-yellow-400 rounded-full p-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                </span>
                                {title}
                            </h3>
                            <ul className="grid grid-cols-1 gap-2 relative z-10">
                                {points.map((point, i) => {
                                    // Remove bullet chars like -, *, •
                                    const cleanPoint = point.replace(/^[-*•]\s*/, '').trim();
                                    return (
                                        <li key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-indigo-50 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mt-0.5">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-600 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-tight pt-0.5">{cleanPoint}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )
                }

                // Layout Padrão para outras seções (Card Simples)
                return (
                    <div key={index} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
                         <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 border-l-4 border-indigo-500 pl-2">
                            {title}
                        </h3>
                        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {content}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

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

    const handleGenerateQuote = async () => {
        setIsGeneratingPdf(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        const doc = new jsPDF();
        doc.text(`Orçamento: ${product.name}`, 10, 10);
        doc.text(`Preço: R$ ${product.price}`, 10, 20);
        doc.save('orcamento.pdf');
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
                            {/* Usa o novo componente de Renderização Organizada */}
                            <DescriptionSection description={product.description || ''} />
                            <ShippingCalculator />
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
                        {isGeneratingPdf ? '...' : 'Orçamento PDF'}
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
