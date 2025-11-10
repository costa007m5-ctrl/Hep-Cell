import React, { useState, useEffect } from 'react';
import { Invoice } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface BoletoPaymentProps {
  invoice: Invoice;
  onBack: () => void;
  onPaymentConfirmed: () => void;
}

const BoletoPayment: React.FC<BoletoPaymentProps> = ({ invoice, onBack, onPaymentConfirmed }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boletoData, setBoletoData] = useState<{ boletoUrl: string; barCode: string } | null>(null);
  const [copyButtonText, setCopyButtonText] = useState('Copiar Código');

  useEffect(() => {
    const createBoletoPayment = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) {
          throw new Error('Não foi possível identificar o usuário para gerar o boleto.');
        }

        const response = await fetch('/api/mercadopago/create-boleto-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: invoice.amount,
            description: `Fatura Relp Cell - ${invoice.month}`,
            payerEmail: user.email,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Falha ao gerar o boleto.');
        }
        setBoletoData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    createBoletoPayment();
  }, [invoice]);

  const handleCopy = () => {
    if (boletoData?.barCode) {
      navigator.clipboard.writeText(boletoData.barCode);
      setCopyButtonText('Copiado!');
      setTimeout(() => setCopyButtonText('Copiar Código'), 2000);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <LoadingSpinner />
          <p className="text-slate-500 dark:text-slate-400">Gerando seu boleto...</p>
        </div>
      );
    }

    if (error) {
      return <div className="p-4 w-full"><Alert message={error} type="error" /></div>;
    }

    if (boletoData) {
      return (
        <div className="flex flex-col items-center text-center p-6 space-y-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Boleto Gerado com Sucesso!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Clique no botão abaixo para visualizar e imprimir seu boleto. O pagamento pode levar até 2 dias úteis para ser confirmado.
          </p>
          <a
            href={boletoData.boletoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Visualizar Boleto
          </a>
          <div className="w-full">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Ou copie o código de barras para pagar no app do seu banco:
            </p>
            <div className="relative p-3 bg-slate-100 dark:bg-slate-700 rounded-md">
              <p className="text-xs text-left break-all text-slate-600 dark:text-slate-300 font-mono">
                {boletoData.barCode}
              </p>
            </div>
            <button onClick={handleCopy} className="mt-2 w-full flex justify-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              {copyButtonText}
            </button>
          </div>
          <button onClick={onPaymentConfirmed} className="mt-4 text-sm font-bold text-green-600 dark:text-green-400 hover:underline">
            Entendido, voltar ao início
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in">
      <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento via Boleto</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Fatura de {invoice.month} - R$ {invoice.amount.toFixed(2).replace('.', ',')}</p>
      </div>
      <div className="min-h-[250px] flex items-center justify-center">
        {renderContent()}
      </div>
      <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-700">
        <button type="button" onClick={onBack} className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
          Voltar
        </button>
      </div>
    </div>
  );
};

export default BoletoPayment;