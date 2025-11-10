import React from 'react';
import { Invoice } from '../types';

interface PaymentMethodSelectorProps {
  invoice: Invoice;
  onSelectMethod: (method: string) => void;
  onBack: () => void;
}

const CreditCardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-700 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3.375m-3.375 0h16.5m0 0h-16.5m16.5 0v-8.25m0 8.25v-8.25m-16.5 8.25v-8.25m16.5-1.5h-19.5a2.25 2.25 0 00-2.25 2.25v10.5a2.25 2.25 0 002.25 2.25h19.5a2.25 2.25 0 002.25-2.25v-10.5a2.25 2.25 0 00-2.25-2.25z" />
    </svg>
);

const ExternalLinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-700 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5 0V6.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125V10.5m-7.5-4.5h4.5m-4.5 4.5l7.5-7.5" />
    </svg>
);

const PixIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-700 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 15.375a1.125 1.125 0 011.125-1.125h4.5a1.125 1.125 0 011.125 1.125v4.5a1.125 1.125 0 01-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
    </svg>
);


const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({ invoice, onSelectMethod, onBack }) => {

    const paymentOptions = [
      { id: 'brick', name: 'Cartão, PIX e outros', icon: <CreditCardIcon />, description: "Pague com segurança nesta tela." },
      { id: 'pix', name: 'Pagar com PIX', icon: <PixIcon />, description: "Gere um QR Code e chave copia e cola." },
      { id: 'redirect', name: 'Pagar no site do Mercado Pago', icon: <ExternalLinkIcon />, description: "Você será redirecionado." },
    ];

    return (
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in">
        <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Escolha como Pagar</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Fatura de {invoice.month} - <strong>{invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-4">
          {paymentOptions.map(option => (
            <button
              key={option.id}
              onClick={() => onSelectMethod(option.id)}
              className="w-full flex items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label={`Pagar com ${option.name}`}
            >
              <div className="flex-shrink-0 mr-4">{option.icon}</div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{option.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{option.description}</p>
              </div>
               <div className="ml-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </button>
          ))}
           <p className="text-xs text-center text-slate-400 dark:text-slate-500 pt-2">
            Todas as transações são processadas com a segurança do Mercado Pago.
          </p>
        </div>

        <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onBack}
            className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  };

export default PaymentMethodSelector;