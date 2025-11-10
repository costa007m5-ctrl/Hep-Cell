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
  mpPublicKey: string; // Recebe a chave pública como prop
  onBack: () => void;
  onPaymentSuccess: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ invoice, mpPublicKey, onBack, onPaymentSuccess }) => {
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.IDLE);
  const [message, setMessage] = useState('');
  const [isLoadingPreference, setIsLoadingPreference] = useState(true);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const brickContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const createPreference = async () => {
      try {
        const response = await fetch('/api/create-preference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: invoice.id,
            description: `Fatura Relp Cell - ${invoice.month}`,
            amount: invoice.amount,
          }),
        });

        if (!response.ok) {
          throw new Error('Falha ao criar a preferência de pagamento.');
        }

        const data = await response.json();
        setPreferenceId(data.id);
      } catch (error) {
        console.error(error);
        setStatus(PaymentStatus.ERROR);
        setMessage('Não foi possível iniciar o pagamento. Tente novamente mais tarde.');
      } finally {
        setIsLoadingPreference(false);
      }
    };

    createPreference();
  }, [invoice]);

  useEffect(() => {
    if (preferenceId && mpPublicKey && brickContainerRef.current) {
      if (brickContainerRef.current.innerHTML.trim() !== '') {
        return;
      }

      const mp = new window.MercadoPago(mpPublicKey, {
        locale: 'pt-BR',
      });

      const bricks = mp.bricks();

      const renderPaymentBrick = async () => {
          await bricks.create('payment', brickContainerRef.current!.id, {
              initialization: {
                  amount: invoice.amount,
                  preferenceId: preferenceId,
              },
              customization: {
                paymentMethods: {
                    ticket: 'all',
                    pix: 'all', 
                    creditCard: 'all',
                    debitCard: [],
                },
              },
              callbacks: {
                  onSubmit: async (formData: any) => {
                      setStatus(PaymentStatus.PENDING);
                      try {
                          const response = await fetch('/api/process-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              ...formData,
                              description: `Fatura Relp Cell - ${invoice.month}`,
                              transaction_amount: invoice.amount,
                            })
                          });
                          
                          const result = await response.json();

                          if (!response.ok) {
                            throw new Error(result.message || 'Falha no processamento do pagamento.');
                          }

                          const customerName = formData?.payer?.firstName || 'Cliente';
                          const successMsg = await generateSuccessMessage(customerName, String(invoice.amount));
                          setMessage(successMsg);
                          setStatus(PaymentStatus.SUCCESS);
                          
                          setTimeout(() => {
                              onPaymentSuccess();
                          }, 4000);

                      } catch (error: any) {
                          console.error(error);
                          setStatus(PaymentStatus.ERROR);
                          setMessage(error.message || 'Erro ao finalizar pagamento.');
                      }
                  },
                  onError: (error: any) => {
                      setStatus(PaymentStatus.ERROR);
                      setMessage('Ocorreu um erro. Verifique os dados e tente novamente.');
                      console.error("Mercado Pago Error:", error);
                  },
                  onReady: () => {
                    /* O brick está pronto para ser usado */
                  }
              },
          });
      };
      
      renderPaymentBrick();
    }
    
    return () => {
        if (brickContainerRef.current) {
            try {
              const brickInstance = window.MercadoPago?.getBrick("payment");
              if (brickInstance) {
                brickInstance.unmount();
              }
            } catch (e) {
                console.error("Error unmounting brick:", e);
            }
            brickContainerRef.current.innerHTML = '';
        }
    };
  }, [preferenceId, mpPublicKey, onPaymentSuccess, invoice.amount, invoice.month]);


  const renderContent = () => {
    if (isLoadingPreference) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <LoadingSpinner />
            <p className="text-slate-500 dark:text-slate-400">Preparando pagamento seguro...</p>
        </div>
      );
    }

    if (status === PaymentStatus.ERROR) {
      return <div className="p-4"><Alert message={message} type="error" /></div>;
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
        )
    }

    return (
        <>
            <div id="paymentBrick_container" ref={brickContainerRef}></div>
        </>
    );
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in">
       <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento Seguro</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Fatura de {invoice.month} - R$ {invoice.amount.toFixed(2).replace('.', ',')}</p>
      </div>

      <div className="p-6 sm:p-8">
        {renderContent()}
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