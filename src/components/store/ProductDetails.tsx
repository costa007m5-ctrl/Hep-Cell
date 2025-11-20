import React, { useState, useEffect } from 'react';
import { Product, Profile } from '../../types';
import ProductCarousel from './ProductCarousel';
import jsPDF from 'jspdf';
import LoadingSpinner from '../LoadingSpinner';
import { supabase } from '../../services/clients';
import { getProfile } from '../../services/profileService';
import PurchaseModal from './PurchaseModal';
import Alert from '../Alert';

interface ProductDetailsProps {
    product: Product;
    allProducts: Product[];
    onBack: () => void;
    onProductClick: (product: Product) => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, allProducts, onBack, onProductClick }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [purchaseSuccess, setPurchaseSuccess] = useState(false);

    // Busca o perfil do usuário para ter o limite de crédito atualizado
    useEffect(() => {
        const fetchUser = async () => {
            setIsLoadingProfile(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const profile = await getProfile(user.id);
                    // Merge auth data with profile data
                    if (profile) {
                        setUserProfile({ ...profile, id: user.id, email: user.email });
                    }
                }
            } catch (error) {
                console.error("Erro ao buscar perfil para compra:", error);
            } finally {
                setIsLoadingProfile(false);
            }
        };
        fetchUser();
    }, []);

    // Filtra produtos relacionados (excluindo o atual)
    const relatedProducts = allProducts
        .filter(p => p.id !== product.id)
        .slice(0, 6);

    const handleGenerateQuote = async () => {
        setIsGeneratingPdf(true);
        await new Promise(resolve => setTimeout(resolve, 500)); 

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Cabeçalho
        doc.setFillColor(79, 70, 229); // Indigo-600
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Relp Cell', 20, 20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Soluções em Tecnologia', 20, 30);
        
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 60, 20);

        // Info Produto
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(product.name, 20, 60);

        // Caixa de Preço
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(20, 70, pageWidth - 40, 40, 3, 3, 'FD');

        doc.setFontSize(14);
        doc.text('Valor:', 30, 85);
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229); 
        doc.text(product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), pageWidth - 80, 85);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text('Condição:', 30, 100);
        const installmentVal = (product.price / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        doc.text(`12x de ${installmentVal}`, pageWidth - 80, 100);

        // Descrição
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalhes do Produto:', 20, 140);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        
        const splitDesc = doc.splitTextToSize(product.description || 'Sem descrição adicional.', pageWidth - 40);
        doc.text(splitDesc, 20, 150);

        // Rodapé
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Orçamento válido por 5 dias.', 20, 270);
        doc.text('Relp Cell - Contato: contato@relpcell.com.br', 20, 275);

        doc.save(`Orcamento_${product.name.replace(/\s+/g, '_')}.pdf`);
        setIsGeneratingPdf(false);
    };

    const handleBuyClick = () => {
        if (userProfile) {
            setShowPurchaseModal(true);
        } else {
            // Fallback simples se o perfil não carregar
            alert("Faça login novamente para realizar compras.");
        }
    };

    const handlePurchaseSuccess = () => {
        setShowPurchaseModal(false);
        setPurchaseSuccess(true);
        window.scrollTo(0, 0);
    };

    if (purchaseSuccess) {
        return (
            <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Compra Realizada!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm">
                    Seu pedido do <strong>{product.name}</strong> foi recebido. As faturas do parcelamento já estão disponíveis na sua conta.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button onClick={onBack} className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors">
                        Continuar Comprando
                    </button>
                     <button onClick={() => window.location.reload()} className="py-3 px-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-colors">
                        Ver Minhas Faturas
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-slate-900 min-h-full animate-fade-in pb-24">
            {/* Header de Navegação */}
            <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
                <button 
                    onClick={onBack}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-lg font-semibold text-slate-800 dark:text-white truncate flex-1">
                    Detalhes do Produto
                </h1>
            </div>

            <div className="max-w-4xl mx-auto">
                {/* Imagem Principal */}
                <div className="w-full bg-white dark:bg-slate-800 aspect-square sm:aspect-[16/9] relative flex justify-center items-center p-4">
                     <img 
                        src={product.image_url || 'https://via.placeholder.com/600'} 
                        alt={product.name}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    />
                </div>

                {/* Informações Principais */}
                <div className="px-4 py-6 space-y-6 bg-white dark:bg-slate-900 relative rounded-t-3xl shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] dark:shadow-slate-800/50">
                    
                    {/* Informações do App */}
                    <div className="flex items-center space-x-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                         <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                         </div>
                         <div>
                             <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Vendido por Relp Cell</h3>
                             <p className="text-xs text-indigo-700 dark:text-indigo-400">Garantia e Qualidade Comprovada</p>
                         </div>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                            {product.name}
                        </h2>
                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                            <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                                {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">à vista ou parcelado no limite</span>
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={handleGenerateQuote}
                            disabled={isGeneratingPdf}
                            className="flex items-center justify-center gap-2 py-3 px-4 border border-indigo-600 dark:border-indigo-500 rounded-xl font-semibold text-indigo-600 dark:text-indigo-400 bg-transparent hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
                        >
                            {isGeneratingPdf ? <LoadingSpinner /> : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>Orçamento</span>
                                </>
                            )}
                        </button>
                         <button 
                            onClick={handleBuyClick}
                            disabled={isLoadingProfile}
                            className="flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-wait"
                         >
                            {isLoadingProfile ? <LoadingSpinner /> : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                    </svg>
                                    <span>Comprar</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Descrição */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Sobre o produto</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                            {product.description || 'Descrição detalhada não disponível para este produto.'}
                        </p>
                    </div>
                </div>

                 {/* Produtos Relacionados */}
                 {relatedProducts.length > 0 && (
                     <div className="mt-4 pt-6 border-t-4 border-slate-100 dark:border-slate-800 px-4">
                         <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Outras opções para você</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Produtos similares que podem te interessar.</p>
                         </div>
                        <ProductCarousel 
                            title="" 
                            products={relatedProducts} 
                            onProductClick={onProductClick}
                        />
                     </div>
                 )}
            </div>

            {/* Purchase Modal */}
            {showPurchaseModal && userProfile && (
                <PurchaseModal 
                    product={product}
                    profile={userProfile}
                    onClose={() => setShowPurchaseModal(false)}
                    onSuccess={handlePurchaseSuccess}
                />
            )}
        </div>
    );
};

export default ProductDetails;