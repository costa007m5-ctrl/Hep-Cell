import React, { useState, useEffect, useRef } from 'react';
import { PaymentStatus, Invoice } from '../types';
import { generateSuccessMessage } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface PaymentFormProps {
  invoice: Invoice;
  mpPublicKey: string;
  onBack: () => void;
  onPaymentSuccess: (paymentId: string | number) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ invoice, mpPublicKey, onBack, onPaymentSuccess }) => {
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.IDLE);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  
  const paymentBrickRef = useRef<HTMLDivElement>(null);
  const brickInstance = useRef<any>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const createPreference = async () => {
      setIsLoading(true);
      setStatus(PaymentStatus.IDLE);
      try {
        const response = await fetch('/api/mercadopago/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: invoice.id,
            description: `Fatura Relp Cell - ${invoice.month}`,
            amount: invoice.amount,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Falha ao criar a preferência de pagamento.');
        }
        
        const data = await response.json();
        if (isMountedRef.current) {
          setPreferenceId(data.id);
        }
      } catch (error: any) {
        if (isMountedRef.current) {
          setStatus(PaymentStatus.ERROR);
          setMessage(error.message || 'Não foi possível iniciar o pagamento. Tente novamente mais tarde.');
          setIsLoading(false);
        }
      }
    };
    createPreference();
  }, [invoice]);

  useEffect(() => {
    if (!preferenceId || !mpPublicKey || !paymentBrickRef.current || !window.MercadoPago) {
      return;
    }

    const initializeBrick = async () => {
      try {
        const mp = new window.MercadoPago(mpPublicKey, { locale: 'pt-BR' });
        const bricks = mp.bricks();

        const brick = await bricks.create('payment', 'paymentBrick_container', {
          initialization: {
            amount: invoice.amount,
            preferenceId: preferenceId,
          },
          customization: {
            paymentMethods: {
              ticket: 'all',
              creditCard: 'all',
              debitCard: 'all',
              mercadoPago: 'all',
            },
          },
          callbacks: {
            onReady: () => {
              if (isMountedRef.current) {
                setIsLoading(false);
              }
            },
            onSubmit: async (formData: any) => {
              if (!isMountedRef.current) return;
              
              setStatus(PaymentStatus.PENDING);
              try {
                formData.external_reference = invoice.id;
                
                const response = await fetch('/api/mercadopago/process-payment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(formData),
                });
                
                const paymentResult = await response.json();
                
                if (!response.ok) {
                  throw new Error(paymentResult.message || 'O pagamento foi recusado.');
                }

                if (paymentResult.status === 'approved') {
                  const successMsg = await generateSuccessMessage('Cliente', String(invoice.amount));
                  setMessage(successMsg);
                  setStatus(PaymentStatus.SUCCESS);
                  setTimeout(() => {
                    if (isMountedRef.current) {
                      onPaymentSuccess(paymentResult.id);
                    }
                  }, 3000);
                } else {
                  setMessage("Seu pagamento está sendo processado. Você receberá a confirmação em breve.");
                  setStatus(PaymentStatus.SUCCESS);
                  setTimeout(() => {
                    if (isMountedRef.current) {
                      onPaymentSuccess(paymentResult.id);
                    }
                  }, 3000);
                }
              } catch (error: any) {
                if (isMountedRef.current) {
                  setStatus(PaymentStatus.ERROR);
                  setMessage(error.message || 'Erro ao finalizar o pagamento.');
                }
              }
            },
            onError: (error: any) => {
              console.error('Payment Brick Error:', error);
              if (isMountedRef.current) {
                setStatus(PaymentStatus.ERROR);
                setMessage('Ocorreu um erro. Verifique os dados e tente novamente.');
              }
            },
          },
        });

        brickInstance.current = brick;
      } catch (error) {
        console.error('Erro ao inicializar Payment Brick:', error);
        if (isMountedRef.current) {
          setStatus(PaymentStatus.ERROR);
          setMessage('Erro ao carregar o formulário de pagamento. Tente novamente.');
          setIsLoading(false);
        }
      }
    };

    initializeBrick();

    return () => {
      if (brickInstance.current) {
        try {
          brickInstance.current.unmount();
        } catch (e) {
          console.error('Erro ao desmontar brick:', e);
        }
      }
    };
  }, [preferenceId, mpPublicKey, invoice.amount, invoice.id, invoice.month, onPaymentSuccess]);

  const renderContent = () => {
    if (status === PaymentStatus.ERROR) {
      return (
        <div className="p-4">
          <Alert message={message} type="error" />
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    
    if (status === PaymentStatus.SUCCESS) {
      return <div className="p-4"><Alert message={message} type="success" /></div>;
    }
    
    if (status === PaymentStatus.PENDING) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <LoadingSpinner />
          <p className="text-slate-500 dark:text-slate-400">Processando seu pagamento...</p>
          <p className="text-sm text-slate-400">Por favor, não feche ou atualize a página.</p>
        </div>
      );
    }

    return (
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white dark:bg-slate-800 flex flex-col items-center justify-center p-8 space-y-4 z-10">
            <LoadingSpinner />
            <p className="text-slate-500 dark:text-slate-400">Preparando pagamento seguro...</p>
          </div>
        )}
        <div id="paymentBrick_container" ref={paymentBrickRef}></div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in">
      <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento Seguro</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Fatura de {invoice.month} - R$ {invoice.amount.toFixed(2).replace('.', ',')}
        </p>
      </div>

      <div className="p-2 sm:p-4 min-h-[400px]">
        {renderContent()}
      </div>
      
      {status !== PaymentStatus.PENDING && status !== PaymentStatus.SUCCESS && (
        <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-700">
          <button 
            type="button" 
            onClick={onBack} 
            className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;