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
            // Se não tiver perfil carregado, tenta recarregar ou alerta
            const confirmLogin = window.confirm("Para usar seu saldo do crediário, você precisa estar logado. Deseja ir para o login?");
            if(confirmLogin) {
                window.location.reload();
            }
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
            {/* Header de Navegação Transparente com Blur */}
            <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                <button 
                    onClick={onBack}
                    className="p-2.5 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors text-white pointer-events-auto shadow-lg border border-white/10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            {/* Conteúdo Scrollável */}
            <div className="flex-grow pb-40"> 
                {/* Imagem Principal Full Bleed */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 aspect-square relative flex justify-center items-center overflow-hidden">
                     <img 
                        src={product.image_url || 'https://via.placeholder.com/600'} 
                        alt={product.name}
                        className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal"
                    />
                </div>

                {/* Informações Principais */}
                <div className="px-6 pt-8 space-y-6 -mt-8 relative z-10 bg-white dark:bg-slate-900 rounded-t-3xl shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-none min-h-[60vh]">
                    {/* Barra de arraste decorativa */}
                    <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 opacity-50"></div>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between items-start gap-4">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                                {product.name}
                            </h2>
                            {/* Badge Estoque */}
                            <span className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${product.stock > 0 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {product.stock > 0 ? 'Disponível' : 'Esgotado'}
                            </span>
                        </div>
                        
                        <div className="flex flex-col">
                            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                                {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                à vista ou parcelado
                            </p>
                        </div>
                    </div>

                    {/* Garantia Card */}
                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                         <div className="p-2 bg-white dark:bg-slate-700 rounded-full text-indigo-600 dark:text-indigo-400 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                         </div>
                         <div>
                             <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Compra Garantida Relp</p>
                             <p className="text-xs text-slate-500 dark:text-slate-400">Receba o produto que está esperando ou devolvemos o dinheiro.</p>
                         </div>
                    </div>

                    {/* Descrição */}
                    <div className="pt-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Ficha Técnica</h3>
                        <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                            {product.description || 'Descrição detalhada não disponível para este produto.'}
                        </div>
                    </div>
                </div>

                 {/* Produtos Relacionados */}
                 {relatedProducts.length > 0 && (
                     <div className="mt-4 pt-6 px-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                         <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 px-1">Quem viu, comprou também</h3>
                        <ProductCarousel 
                            title="" 
                            products={relatedProducts} 
                            onProductClick={onProductClick}
                        />
                     </div>
                 )}
            </div>

            {/* Sticky Footer Actions (Barra fixa de compra com efeito Glass) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 z-40 pb-safe">
                <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800/50 shadow-2xl shadow-black/10"></div>
                <div className="relative max-w-4xl mx-auto flex flex-col gap-3">
                     {/* Card de Resumo da Parcela */}
                    <div className="flex justify-between items-center px-2">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Melhor Condição</span>
                             <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                12x de {(product.price / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <button 
                            onClick={handleGenerateQuote}
                            className="text-xs font-medium text-slate-500 hover:text-indigo-600 underline decoration-2 underline-offset-2"
                            disabled={isGeneratingPdf}
                        >
                            {isGeneratingPdf ? 'Gerando...' : 'Baixar Orçamento'}
                        </button>
                    </div>

                    <button 
                        onClick={handleBuyClick}
                        disabled={isLoadingProfile || product.stock <= 0}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
                     >
                        {isLoadingProfile ? <LoadingSpinner /> : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                                <span>Comprar no Crediário</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Padding extra no final para compensar o footer fixo e a navbar inferior */}
            <div className="h-20"></div>

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