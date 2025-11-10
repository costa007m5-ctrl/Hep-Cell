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
  onPaymentSuccess: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ invoice, mpPublicKey, onBack, onPaymentSuccess }) => {
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.IDLE);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const paymentBrickContainerRef = useRef<HTMLDivElement>(null);
  const brickControllerRef = useRef<any>(null);
  
  const onPaymentSuccessRef = useRef(onPaymentSuccess);
  useEffect(() => {
    onPaymentSuccessRef.current = onPaymentSuccess;
  }, [onPaymentSuccess]);

  useEffect(() => {
    let isComponentMounted = true;
    
    const unmountBrick = () => {
      if (brickControllerRef.current) {
        brickControllerRef.current.unmount();
        brickControllerRef.current = null;
      }
    };

    const initializePayment = async () => {
      if (!mpPublicKey || !paymentBrickContainerRef.current) {
        console.warn("O formulário de pagamento não pode ser inicializado, o contêiner não está pronto.");
        return;
      }
      
      unmountBrick();
      setStatus(PaymentStatus.IDLE);
      setMessage('');
      setIsLoading(true);

      try {
        const prefResponse = await fetch('/api/mercadopago/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: invoice.id,
            description: `Fatura Relp Cell - ${invoice.month}`,
            amount: invoice.amount,
          }),
        });

        if (!prefResponse.ok) {
          throw new Error('Falha ao criar a preferência de pagamento.');
        }

        const preference = await prefResponse.json();
        
        if (!isComponentMounted) return;

        const mp = new window.MercadoPago(mpPublicKey, { locale: 'pt-BR' });
        const bricks = mp.bricks();

        // Configuração simplificada para o Payment Brick.
        // Removendo 'customization' e usando apenas 'preferenceId'.
        // Isso torna a integração mais robusta, delegando as opções de pagamento
        // para a configuração da sua conta Mercado Pago e da preferência criada.
        const settings = {
          initialization: {
            preferenceId: preference.id,
          },
          callbacks: {
            onReady: () => {
              if (isComponentMounted) {
                console.log('Payment Brick está pronto e renderizado.');
                setIsLoading(false);
              }
            },
            onSubmit: async (formData: any) => {
              if (!isComponentMounted) return;
              setStatus(PaymentStatus.PENDING);
              try {
                const response = await fetch('/api/mercadopago/process-payment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                if (!response.ok) {
                  throw new Error(result.message || 'Falha no processamento do pagamento.');
                }
                
                const customerName = formData?.payer?.firstName || 'Cliente';
                const successMsg = await generateSuccessMessage(customerName, String(invoice.amount));
                
                if (isComponentMounted) {
                  setMessage(successMsg);
                  setStatus(PaymentStatus.SUCCESS);
                  setTimeout(() => {
                    onPaymentSuccessRef.current();
                  }, 4000);
                }

              } catch (error: any) {
                if (isComponentMounted) {
                  setStatus(PaymentStatus.ERROR);
                  setMessage(error.message || 'Erro ao finalizar pagamento.');
                }
              }
            },
            onError: (error: any) => {
              console.error("Mercado Pago Brick Error:", error);
              if (isComponentMounted) {
                setStatus(PaymentStatus.ERROR);
                setMessage('Ocorreu um erro. Verifique os dados e tente novamente.');
              }
            },
          },
        };

        const brickInstance = await bricks.create('payment', paymentBrickContainerRef.current!.id, settings);
        brickControllerRef.current = brickInstance;

      } catch (error) {
        console.error("Falha ao inicializar pagamento:", error);
        if (isComponentMounted) {
          setStatus(PaymentStatus.ERROR);
          setMessage('Não foi possível iniciar o pagamento. Tente novamente mais tarde.');
          setIsLoading(false);
        }
      }
    };

    initializePayment();

    return () => {
      isComponentMounted = false;
      unmountBrick();
    };
  }, [invoice, mpPublicKey]);


  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in">
       <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento Seguro</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Fatura de {invoice.month} - R$ {invoice.amount.toFixed(2).replace('.', ',')}</p>
      </div>

      <div className="p-6 sm:p-8 min-h-[200px] flex items-center justify-center">
        {/* Container para o brick, sempre no DOM para o SDK do MP */}
        <div id="paymentBrick_container" ref={paymentBrickContainerRef} className={isLoading || status !== PaymentStatus.IDLE ? 'hidden' : 'w-full'}></div>

        {/* Indicadores de Status */}
        {isLoading && (
            <div className="flex flex-col items-center justify-center space-y-4">
                <LoadingSpinner />
                <p className="text-slate-500 dark:text-slate-400">Preparando pagamento seguro...</p>
            </div>
        )}

        {!isLoading && status === PaymentStatus.ERROR && (
            <div className="w-full"><Alert message={message} type="error" /></div>
        )}

        {!isLoading && status === PaymentStatus.SUCCESS && (
            <div className="w-full"><Alert message={message} type="success" /></div>
        )}
        
        {!isLoading && status === PaymentStatus.PENDING && (
            <div className="flex flex-col items-center justify-center space-y-4">
                <LoadingSpinner />
                <p className="text-slate-500 dark:text-slate-400">Processando seu pagamento...</p>
                <p className="text-sm text-slate-400">Por favor, não feche ou atualize a página.</p>
            </div>
        )}
      </div>
      
      {status !== PaymentStatus.PENDING && status !== PaymentStatus.SUCCESS && (
        <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-700">
             <button type="button" onClick={onBack} className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
                Voltar
            </button>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;
