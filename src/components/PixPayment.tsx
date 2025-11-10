import React, { useState, useEffect, useRef } from 'react';
import { Invoice } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface PixPaymentProps {
  invoice: Invoice;
  onBack: () => void;
  onPaymentConfirmed: () => void;
}

const PixPayment: React.FC<PixPaymentProps> = ({ invoice, onBack, onPaymentConfirmed }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qrCodeBase64: string; qrCode: string; expires: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [copyButtonText, setCopyButtonText] = useState('Copiar Código');
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const createPixPayment = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) {
            throw new Error('Não foi possível identificar o usuário para gerar o PIX.');
        }

        const response = await fetch('/api/mercadopago/create-pix-payment', {
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
            throw new Error(data.error || 'Falha ao gerar o código PIX.');
        }
        setPixData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    createPixPayment();
    
    return () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
    };
  }, [invoice]);

  useEffect(() => {
    if (pixData?.expires) {
      const expirationDate = new Date(pixData.expires);

      timerIntervalRef.current = window.setInterval(() => {
        const now = new Date();
        const distance = expirationDate.getTime() - now.getTime();

        if (distance < 0) {
          clearInterval(timerIntervalRef.current!);
          setTimeLeft("Expirado");
          setError("Este código PIX expirou. Por favor, gere um novo.");
          return;
        }

        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    }
  }, [pixData]);

  const handleCopy = () => {
    if (pixData?.qrCode) {
        navigator.clipboard.writeText(pixData.qrCode);
        setCopyButtonText('Copiado!');
        setTimeout(() => setCopyButtonText('Copiar Código'), 2000);
    }
  };
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <LoadingSpinner />
            <p className="text-slate-500 dark:text-slate-400">Gerando seu código PIX...</p>
        </div>
      );
    }

    if (error) {
      return <div className="p-4 w-full"><Alert message={error} type="error" /></div>;
    }

    if (pixData) {
        return (
            <div className="flex flex-col items-center text-center p-6 space-y-4">
                <h3 className='text-lg font-semibold text-slate-800 dark:text-slate-200'>Pague com PIX</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Abra o app do seu banco e escaneie o código abaixo.
                </p>
                <img
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                    alt="PIX QR Code"
                    className="max-w-[200px] w-full rounded-lg ring-4 ring-slate-200 dark:ring-slate-700"
                />
                
                {timeLeft && (
                    <div className={`font-mono text-lg font-bold p-2 rounded-md ${timeLeft === 'Expirado' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                        Expira em: {timeLeft}
                    </div>
                )}
                
                <p className="text-sm text-slate-500 dark:text-slate-400">
                   Ou use a chave "Copia e Cola":
                </p>
                 <div className="w-full">
                    <div className="relative p-3 bg-slate-100 dark:bg-slate-700 rounded-md">
                        <p className="text-xs text-left break-all text-slate-600 dark:text-slate-300 font-mono">
                            {pixData.qrCode}
                        </p>
                    </div>
                    <button onClick={handleCopy} className="mt-2 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                        {copyButtonText}
                    </button>
                </div>
                 <button onClick={onPaymentConfirmed} className="mt-4 text-sm font-bold text-green-600 dark:text-green-400 hover:underline">
                    Já paguei, concluir
                </button>
            </div>
        );
    }
    
    return null;
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in">
       <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento via PIX</h2>
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

export default PixPayment;
