
import React from 'react';
import { Invoice } from '../types';

interface PaymentMethodSelectorProps {
  invoice: Invoice & { originalAmount?: number; discountValue?: number };
  onSelectMethod: (method: string) => void;
  onBack: () => void;
}

// --- Ícones Modernos e Coloridos ---

const CreditCardIcon = () => (
    <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3.375m-3.375 0h16.5m0 0h-16.5m16.5 0v-8.25m0 8.25v-8.25m-16.5 8.25v-8.25m16.5-1.5h-19.5a2.25 2.25 0 00-2.25 2.25v10.5a2.25 2.25 0 002.25 2.25h19.5a2.25 2.25 0 002.25-2.25v-10.5a2.25 2.25 0 00-2.25-2.25z" />
        </svg>
    </div>
);

const PixIcon = () => (
    <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125-1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125-1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 15.375a1.125 1.125 0 011.125-1.125h4.5a1.125 1.125 0 011.125 1.125v4.5a1.125 1.125 0 01-1.125-1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
        </svg>
    </div>
);

const BoletoIcon = () => (
    <div className="p-3 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 6.375c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v3.026a2.25 2.25 0 01-2.25 2.25H3.75a2.25 2.25 0 01-2.25-2.25V6.375z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 12.375h21M9 16.125h6M9 19.125h6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5v15M19.5 4.5v15" />
        </svg>
    </div>
);

const ExternalLinkIcon = () => (
    <div className="p-3 rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5 0V6.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125V10.5m-7.5-4.5h4.5m-4.5 4.5l7.5-7.5" />
        </svg>
    </div>
);

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({ invoice, onSelectMethod, onBack }) => {

    const paymentOptions = [
      { 
          id: 'redirect', 
          name: 'App Mercado Pago', 
          description: "Pague com Saldo, Cartão ou Crédito MP", 
          icon: <ExternalLinkIcon />,
          badge: null,
          badgeColor: "",
          disabled: false
      },
      { 
          id: 'pix', 
          name: 'PIX', 
          description: "Liberação imediata", 
          icon: <PixIcon />, 
          badge: "Aprova na hora",
          badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
          disabled: false
      },
      { 
          id: 'brick', 
          name: 'Cartão de Crédito', 
          description: "Em manutenção temporária", 
          icon: <CreditCardIcon />,
          badge: "Em breve",
          badgeColor: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
          disabled: true // Desabilitado conforme solicitado
      },
      { 
          id: 'boleto', 
          name: 'Boleto Bancário', 
          description: "Até 2 dias úteis para compensar", 
          icon: <BoletoIcon />,
          badge: null,
          badgeColor: "",
          disabled: false
      },
    ];

    const hasDiscount = invoice.discountValue && invoice.discountValue > 0;

    return (
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl transform transition-all animate-fade-in overflow-hidden">
        
        {/* Header Financeiro */}
        <div className="relative p-8 bg-slate-900 text-white overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -ml-10 -mb-10"></div>
            
            <div className="relative z-10 text-center">
                <p className="text-sm text-slate-300 font-medium uppercase tracking-wider mb-1">Total a Pagar</p>
                <h2 className="text-4xl font-bold tracking-tight mb-2">
                    {invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </h2>
                <p className="text-sm text-slate-400">
                    Fatura de {invoice.month}
                </p>

                {hasDiscount && (
                    <div className="mt-4 inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-4 py-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        <span className="text-xs font-bold text-green-300">
                            Economia de {invoice.discountValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                )}
            </div>
        </div>

        {/* Opções de Pagamento */}
        <div className="p-6 space-y-4 bg-white dark:bg-slate-800">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">Escolha o método</p>
          
          {paymentOptions.map(option => (
            <button
              key={option.id}
              onClick={() => !option.disabled && onSelectMethod(option.id)}
              disabled={option.disabled}
              className={`group w-full flex items-center p-4 border rounded-2xl transition-all duration-200 text-left relative overflow-hidden ${
                  option.disabled 
                  ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 opacity-60 cursor-not-allowed' 
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md dark:hover:bg-slate-700/50'
              }`}
            >
              <div className={`flex-shrink-0 mr-4 z-10 transition-transform ${!option.disabled && 'group-hover:scale-110'}`}>
                  {option.icon}
              </div>
              <div className="flex-1 z-10">
                <div className="flex items-center gap-2">
                    <p className={`font-bold ${option.disabled ? 'text-slate-500 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>{option.name}</p>
                    {option.badge && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${option.badgeColor}`}>
                            {option.badge}
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{option.description}</p>
              </div>
              
              {!option.disabled && (
                  <div className="ml-2 z-10 text-slate-300 group-hover:text-indigo-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
              )}
            </button>
          ))}
        </div>

        {/* Footer Seguro */}
        <div className="px-6 pb-6 pt-2">
            <div className="flex items-center justify-center gap-2 mb-4 opacity-60">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <span className="text-xs text-slate-500 font-medium">Pagamento 100% Seguro via Mercado Pago</span>
            </div>

            <button
                type="button"
                onClick={onBack}
                className="w-full flex justify-center py-3.5 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
                Cancelar e Voltar
            </button>
        </div>
      </div>
    );
  };

export default PaymentMethodSelector;
