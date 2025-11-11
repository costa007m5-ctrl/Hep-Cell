import React, { useState } from 'react';
import { Invoice } from '../types';

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

                <div className="text-center">
                    <a
                        href={invoice.boleto_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                        <PrintIcon />
                        Visualizar / Imprimir Boleto (PDF)
                    </a>
                     <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        Ao abrir, use a função 'Imprimir' (Ctrl+P) do seu navegador para salvar como PDF.
                    </p>
                </div>
                
                 <div className="relative flex items-center justify-center">
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                    <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">OU</span>
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                </div>

                {invoice.boleto_barcode && (
                     <div className="w-full">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 text-center">Pague com o código de barras</label>
                        <div className="p-3 bg-slate-100 dark:bg-slate-900/50 rounded-md">
                            <p className="text-sm text-center break-all text-slate-700 dark:text-slate-300 font-mono">
                                {invoice.boleto_barcode}
                            </p>
                        </div>
                        <button onClick={handleCopy} className="mt-3 w-full flex justify-center items-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                            <CopyIcon />
                            {copyButtonText}
                        </button>
                    </div>
                )}
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