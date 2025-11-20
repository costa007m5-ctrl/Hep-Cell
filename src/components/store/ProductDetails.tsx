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
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-bounce-slow">
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
        <div className="bg-white dark:bg-slate-900 min-h-screen animate-fade-in flex flex-col">
            {/* Header de Navegação Transparente */}
            <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/40 to-transparent pointer-events-none">
                <button 
                    onClick={onBack}
                    className="p-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors text-white pointer-events-auto shadow-lg"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex gap-2 pointer-events-auto">
                     <button className="p-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors text-white shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Conteúdo Scrollável */}
            <div className="flex-grow pb-32"> 
                {/* Imagem Principal Full Bleed */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 aspect-square relative flex justify-center items-center overflow-hidden">
                     <img 
                        src={product.image_url || 'https://via.placeholder.com/600'} 
                        alt={product.name}
                        className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal"
                    />
                </div>

                {/* Informações Principais */}
                <div className="px-5 pt-6 space-y-6 -mt-6 relative z-10 bg-white dark:bg-slate-900 rounded-t-3xl shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] dark:shadow-none min-h-[50vh]">
                    {/* Barra de arraste decorativa */}
                    <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 opacity-50"></div>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between items-start">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight max-w-[80%]">
                                {product.name}
                            </h2>
                            {/* Badge Estoque */}
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${product.stock > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700'}`}>
                                {product.stock > 0 ? 'Em Estoque' : 'Esgotado'}
                            </span>
                        </div>
                        
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                                {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                             12x de <span className="font-semibold text-slate-700 dark:text-slate-200">{(product.price / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> sem juros
                        </p>
                    </div>

                    {/* Garantia Card */}
                    <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                         <div className="p-2 bg-white dark:bg-indigo-900/50 rounded-full text-indigo-600 dark:text-indigo-400 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                         </div>
                         <div>
                             <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">Compra Garantida</p>
                             <p className="text-xs text-indigo-700 dark:text-indigo-400">Receba o produto que está esperando ou devolvemos o dinheiro.</p>
                         </div>
                    </div>

                    {/* Descrição */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Descrição</h3>
                        <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                            {product.description || 'Descrição detalhada não disponível para este produto.'}
                        </div>
                    </div>
                </div>

                 {/* Produtos Relacionados */}
                 {relatedProducts.length > 0 && (
                     <div className="mt-2 pt-6 px-4 bg-white dark:bg-slate-900 pb-6">
                         <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 px-1">Quem viu, comprou também</h3>
                        <ProductCarousel 
                            title="" 
                            products={relatedProducts} 
                            onProductClick={onProductClick}
                        />
                     </div>
                 )}
            </div>

            {/* Sticky Footer Actions (Barra fixa de compra) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-40 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] pb-safe">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <button 
                        onClick={handleGenerateQuote}
                        disabled={isGeneratingPdf}
                        className="flex-1 py-3.5 rounded-xl font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors disabled:opacity-50 active:scale-95"
                    >
                        {isGeneratingPdf ? <LoadingSpinner /> : 'Orçamento'}
                    </button>
                     <button 
                        onClick={handleBuyClick}
                        disabled={isLoadingProfile || product.stock <= 0}
                        className="flex-[2] py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
                     >
                        {isLoadingProfile ? <LoadingSpinner /> : (
                            <>
                                <span>Comprar Agora</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Padding extra no final para compensar o footer fixo e a navbar inferior */}
            <div className="h-16"></div>

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