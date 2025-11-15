import React, { useState } from 'react';
import { Invoice } from '../types';
import jsPDF from 'jspdf'; // Importar a biblioteca

interface BoletoDetailsProps {
    invoice: Invoice;
    onBack: () => void;
}

// Ícones SVG
const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);
const ExternalLinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
);
const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const BoletoDetails: React.FC<BoletoDetailsProps> = ({ invoice, onBack }) => {
    const [copyButtonText, setCopyButtonText] = useState('Copiar código');

    const handleCopy = () => {
        if (invoice.boleto_barcode) {
            navigator.clipboard.writeText(invoice.boleto_barcode);
            setCopyButtonText('Copiado!');
            setTimeout(() => setCopyButtonText('Copiar código'), 2000);
        }
    };
    
    // Função para gerar e baixar o PDF simplificado
    const handleDownloadPdf = () => {
        const doc = new jsPDF();
        
        // Cabeçalho
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('Relp Cell', 20, 20);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Boleto Simplificado para Pagamento', 20, 30);
        
        doc.line(20, 35, 190, 35); // Linha separadora

        // Detalhes da Fatura
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Fatura:', 20, 45);
        doc.setFont('helvetica', 'normal');
        doc.text(invoice.month, 40, 45);

        doc.setFont('helvetica', 'bold');
        doc.text('Vencimento:', 20, 55);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR'), 50, 55);

        doc.setFont('helvetica', 'bold');
        doc.text('Valor:', 20, 65);
        doc.setFont('helvetica', 'normal');
        doc.text(invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 35, 65);
        
        doc.line(20, 75, 190, 75); // Linha separadora
        
        // Código de Barras
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Código de Barras para Pagamento', 20, 85);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        if (invoice.boleto_barcode) {
            doc.text(invoice.boleto_barcode, 20, 95, { maxWidth: 170 });
        } else {
            doc.text('Código de barras não disponível neste comprovante.', 20, 95);
        }

        // Salva o arquivo
        doc.save(`boleto-relpcell-${invoice.id}.pdf`);
    };
    
    return (
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in">
            <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Seu boleto está pronto!</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Fatura de {invoice.month} - <strong>{invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
                 <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                    A confirmação do pagamento pode levar até 2 dias úteis.
                </p>
                
                {/* Ações principais */}
                <div className="space-y-3">
                    <button
                        onClick={handleDownloadPdf}
                        className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                        <DownloadIcon />
                        Baixar Boleto Simplificado (PDF)
                    </button>
                    {invoice.boleto_url && (
                        <a
                            href={invoice.boleto_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex justify-center items-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"
                        >
                            <ExternalLinkIcon />
                            Visualizar Boleto Completo Online
                        </a>
                    )}
                </div>
                
                 <div className="relative flex items-center justify-center">
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                    <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">OU</span>
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                </div>

                {/* Código de Barras */}
                <div className="w-full">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 text-center">Pague com o código de barras</label>
                    <div className="p-3 bg-slate-100 dark:bg-slate-900/50 rounded-md">
                        <p className="text-sm text-center break-all text-slate-700 dark:text-slate-300 font-mono">
                            {invoice.boleto_barcode || 'Código de barras indisponível.'}
                        </p>
                    </div>
                    {invoice.boleto_barcode && (
                         <button onClick={handleCopy} className="mt-3 w-full flex justify-center items-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                            <CopyIcon />
                            {copyButtonText}
                        </button>
                    )}
                </div>
            </div>
            
            <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-700">
                <button
                    type="button"
                    onClick={onBack}
                    className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                    Voltar para Faturas
                </button>
            </div>
        </div>
    );
};

export default BoletoDetails;