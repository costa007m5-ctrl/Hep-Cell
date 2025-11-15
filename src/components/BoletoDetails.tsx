import React, { useState } from 'react';
import { Invoice } from '../types';
import jsPDF from 'jspdf';

interface BoletoDetailsProps {
    invoice: Invoice;
    onBack: () => void;
}

// Ícones SVG para a nova interface
const PrintIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
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

    const handleDownloadPdf = () => {
        const doc = new jsPDF();
    
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("Relp Cell", 20, 20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text("Boleto de Pagamento", 20, 28);
        doc.line(20, 32, 190, 32);
    
        doc.setFontSize(12);
        doc.text(`Fatura referente a: ${invoice.month}`, 20, 45);
        doc.text(`Valor: ${invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, 55);
        doc.text(`Vencimento: ${new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}`, 20, 65);
    
        doc.line(20, 75, 190, 75); 
    
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Código de Barras para Pagamento:", 20, 85);
        
        doc.setFont('courier', 'normal');
        doc.setFontSize(12);
        
        const barcode = invoice.boleto_barcode || 'Código indisponível. Verifique o link do boleto online.';
        const chunks = barcode.match(/.{1,55}/g) || [];
        chunks.forEach((chunk, index) => {
            doc.text(chunk, 20, 95 + (index * 7));
        });
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text("Pague este boleto em qualquer banco, casa lotérica ou via internet banking.", 20, 130);
        
        if (invoice.boleto_url) {
            doc.text("Para visualizar o boleto completo, acesse:", 20, 140);
            doc.setTextColor(0, 0, 255);
            doc.textWithLink(invoice.boleto_url, 20, 147, { url: invoice.boleto_url });
        }
        
        doc.save(`boleto-relp-cell-${invoice.month.toLowerCase().replace(/ /g, '-')}.pdf`);
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

                 <div className="w-full">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 text-center">Pague com o código de barras</label>
                    {invoice.boleto_barcode ? (
                        <div className="p-3 bg-slate-100 dark:bg-slate-900/50 rounded-md">
                            <p className="text-sm text-center break-all text-slate-700 dark:text-slate-300 font-mono">
                                {invoice.boleto_barcode}
                            </p>
                        </div>
                    ) : (
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-md text-center text-sm text-red-800 dark:text-red-300">
                            Código de barras não disponível. Tente baixar o PDF.
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <button 
                        onClick={handleCopy} 
                        disabled={!invoice.boleto_barcode}
                        className="w-full flex justify-center items-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        <CopyIcon />
                        {copyButtonText}
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                        <PrintIcon />
                        Baixar Boleto (PDF)
                    </button>
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
