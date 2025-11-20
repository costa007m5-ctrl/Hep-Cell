import React, { useState } from 'react';
import { Product } from '../../types';
import ProductCarousel from './ProductCarousel';
import jsPDF from 'jspdf';
import LoadingSpinner from '../LoadingSpinner';

interface ProductDetailsProps {
    product: Product;
    allProducts: Product[];
    onBack: () => void;
    onProductClick: (product: Product) => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, allProducts, onBack, onProductClick }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Filtra produtos relacionados (excluindo o atual)
    // Em um app real, filtraria por categoria. Aqui pegamos 5 aleatórios ou sequenciais.
    const relatedProducts = allProducts
        .filter(p => p.id !== product.id)
        .slice(0, 6);

    const handleGenerateQuote = async () => {
        setIsGeneratingPdf(true);
        await new Promise(resolve => setTimeout(resolve, 500)); // Pequeno delay visual

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header Style
        doc.setFillColor(79, 70, 229); // Indigo-600
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Relp Cell', 20, 20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Orçamento de Produto', 20, 30);
        
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 60, 20);

        // Product Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(product.name, 20, 60);

        // Price Box
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(20, 70, pageWidth - 40, 40, 3, 3, 'FD');

        doc.setFontSize(14);
        doc.text('Valor à Vista:', 30, 85);
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229); // Indigo
        doc.text(product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), pageWidth - 80, 85);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text('Parcelado:', 30, 100);
        const installmentVal = (product.price / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        doc.text(`12x de ${installmentVal}`, pageWidth - 80, 100);

        // Image (if valid)
        if (product.image_url) {
            try {
                // Tentativa básica de carregar imagem. Pode falhar devido a CORS dependendo da fonte.
                // Se falhar, apenas ignoramos a imagem no PDF.
                const img = new Image();
                img.src = product.image_url;
                // Nota: Em um ambiente real, seria necessário proxy para imagens externas no canvas/pdf
                // Aqui adicionamos um placeholder de texto se não conseguirmos desenhar
                doc.setFontSize(10);
                doc.setTextColor(150, 150, 150);
                doc.text('(Imagem do produto disponível no site)', 20, 130);
            } catch (e) {
                console.log("Imagem não carregada no PDF");
            }
        }

        // Description
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalhes do Produto:', 20, 140);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        
        const splitDesc = doc.splitTextToSize(product.description || 'Sem descrição adicional.', pageWidth - 40);
        doc.text(splitDesc, 20, 150);

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Este orçamento é válido por 5 dias. Sujeito a disponibilidade em estoque.', 20, 270);
        doc.text('Relp Cell - A melhor tecnologia para você.', 20, 275);

        doc.save(`Orcamento_${product.name.replace(/\s+/g, '_')}.pdf`);
        setIsGeneratingPdf(false);
    };

    return (
        <div className="bg-white dark:bg-slate-900 min-h-full animate-fade-in">
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
                <button className="p-2 text-indigo-600 dark:text-indigo-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </button>
            </div>

            <div className="max-w-4xl mx-auto pb-12">
                {/* Imagem Principal */}
                <div className="w-full bg-white dark:bg-slate-800 aspect-square sm:aspect-[16/9] relative">
                     <img 
                        src={product.image_url || 'https://via.placeholder.com/600'} 
                        alt={product.name}
                        className="w-full h-full object-contain p-4"
                    />
                </div>

                {/* Informações Principais */}
                <div className="px-4 py-6 space-y-6 bg-white dark:bg-slate-900 relative -mt-4 rounded-t-3xl shadow-top">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                            {product.name}
                        </h2>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                                {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">à vista</span>
                        </div>
                         <p className="text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 inline-block px-2 py-1 rounded-md">
                            12x de {(product.price / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem juros
                        </p>
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
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>Orçamento</span>
                                </>
                            )}
                        </button>
                         <button className="flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/30 transition-all active:scale-95">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                            </svg>
                            <span>Comprar</span>
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
                     <div className="mt-4 pt-6 border-t-4 border-slate-100 dark:border-slate-800">
                        <ProductCarousel 
                            title="Você também pode gostar" 
                            products={relatedProducts} 
                            onProductClick={onProductClick}
                        />
                     </div>
                 )}
            </div>
        </div>
    );
};

export default ProductDetails;