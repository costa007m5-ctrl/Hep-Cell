
import React, { useState, useEffect, useRef } from 'react';
import { PaymentStatus, Invoice } from '../types';
import { generateSuccessMessage } from '../services/geminiService';
import { supabase } from '../services/clients';
import { getProfile } from '../services/profileService';
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
  const [payerEmail, setPayerEmail] = useState<string>('');
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [brickController, setBrickController] = useState<any>(null); // Controller do Brick
  
  // Busca dados do usuário (Email) para antifraude
  useEffect(() => {
    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setPayerEmail(user.email || 'cliente@relpcell.com');
        }
    };
    fetchUser();
  }, []);

  // Verifica se o script do MP já carregou
  useEffect(() => {
      if (window.MercadoPago) {
          setIsScriptLoaded(true);
      } else {
          const interval = setInterval(() => {
              if (window.MercadoPago) {
                  setIsScriptLoaded(true);
                  clearInterval(interval);
              }
          }, 100);
          return () => clearInterval(interval);
      }
  }, []);

  // Inicializa o Card Payment Brick V2
  useEffect(() => {
    if (!payerEmail || !mpPublicKey || !isScriptLoaded) return;
    if (brickController) return; // Já inicializado

    const container = document.getElementById('cardPaymentBrick_container');
    if (!container) return;

    // Limpa o container antes de renderizar
    container.innerHTML = '';

    try {
        const mp = new window.MercadoPago(mpPublicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        const renderCardPaymentBrick = async () => {
            const settings = {
                initialization: {
                    amount: invoice.amount,
                    payer: {
                        email: payerEmail,
                    },
                },
                customization: {
                    visual: {
                        style: {
                            theme: 'default', // 'default' | 'dark' | 'bootstrap' | 'flat'
                        },
                        hidePaymentButton: false, // Botão padrão do Brick
                    },
                    paymentMethods: {
                        maxInstallments: 12,
                    }
                },
                callbacks: {
                    onReady: () => {
                        // Brick pronto
                    },
                    onSubmit: async (cardFormData: any) => {
                        setStatus(PaymentStatus.PENDING);
                        setMessage("Processando pagamento seguro...");

                        // Adiciona ID da fatura para o backend
                        const payload = {
                            ...cardFormData,
                            description: `Fatura ${invoice.month}`,
                            external_reference: invoice.id,
                            payer: {
                                ...cardFormData.payer,
                                email: payerEmail // Garante email
                            }
                        };

                        try {
                            const response = await fetch('/api/mercadopago/process-payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload),
                            });

                            const result = await response.json();

                            if (!response.ok) {
                                throw new Error(result.message || result.error || 'Erro ao processar.');
                            }

                            if (result.status === 'approved') {
                                const successMsg = await generateSuccessMessage('Cliente', String(invoice.amount));
                                setMessage(successMsg);
                                setStatus(PaymentStatus.SUCCESS);
                                // Chama o callback do pai após um delay visual
                                setTimeout(() => onPaymentSuccess(result.id), 2500);
                            } else if (result.status === 'in_process') {
                                setMessage("Pagamento em análise. Você será notificado em breve.");
                                setStatus(PaymentStatus.SUCCESS);
                                setTimeout(() => onPaymentSuccess(result.id), 3000);
                            } else {
                                throw new Error(result.message || 'Pagamento recusado.');
                            }

                        } catch (error: any) {
                            console.error('Erro no pagamento:', error);
                            setStatus(PaymentStatus.ERROR);
                            setMessage(error.message || 'Falha na transação. Verifique os dados.');
                        }
                    },
                    onError: (error: any) => {
                        console.error(error);
                        setStatus(PaymentStatus.ERROR);
                        setMessage('Erro nos dados do cartão. Verifique e tente novamente.');
                    },
                },
            };
            
            const controller = await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', settings);
            setBrickController(controller);
        };

        renderCardPaymentBrick();

    } catch (e) {
        console.error("Erro SDK:", e);
        setStatus(PaymentStatus.ERROR);
        setMessage("Erro ao carregar módulo de pagamento.");
    }

    return () => {
        // Cleanup se o componente desmontar
        if (brickController) {
            // O SDK V2 não tem um método unmount simples documentado publicamente de forma consistente,
            // mas remover o nó do DOM é seguro.
        }
    };

  }, [mpPublicKey, invoice.amount, invoice.id, payerEmail, isScriptLoaded]);

  const renderContent = () => {
    if (status === PaymentStatus.PENDING) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[300px]">
                <LoadingSpinner />
                <p className="text-slate-600 dark:text-slate-300 font-medium">Processando...</p>
                <p className="text-xs text-slate-400">Validando com o banco...</p>
            </div>
        );
    }

    if (status === PaymentStatus.SUCCESS) {
      return (
        <div className="p-4 min-h-[300px] flex items-center">
            <Alert message={message} type="success" />
        </div>
      );
    }

    return (
        <div className="w-full">
            {status === PaymentStatus.ERROR && (
                <div className="mb-4">
                    <Alert message={message} type="error" />
                    <button 
                        onClick={() => { setStatus(PaymentStatus.IDLE); setMessage(''); }}
                        className="mt-2 text-sm text-indigo-600 underline"
                    >
                        Tentar novamente
                    </button>
                </div>
            )}
            {/* O container onde o Brick será injetado */}
            <div id="cardPaymentBrick_container"></div>
        </div>
    );
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in overflow-hidden">
       <div className="text-center p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cartão de Crédito</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ambiente seguro Mercado Pago
        </p>
      </div>

      <div className="p-4">
        {renderContent()}
      </div>
      
      {status !== PaymentStatus.PENDING && status !== PaymentStatus.SUCCESS && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
             <button type="button" onClick={onBack} className="w-full flex justify-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancelar
            </button>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;
