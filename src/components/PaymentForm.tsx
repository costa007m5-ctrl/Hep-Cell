
import React, { useState, useEffect, useRef } from 'react';
import { PaymentStatus, Invoice } from '../types';
import { generateSuccessMessage } from '../services/geminiService';
import { supabase } from '../services/clients';
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
  const [payerEmail, setPayerEmail] = useState<string>('');
  
  const paymentBrickRef = useRef<HTMLDivElement>(null);
  const brickInstance = useRef<any>(null);

  // Busca email do usuário logado
  useEffect(() => {
    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
            setPayerEmail(user.email);
        } else {
            // Fallback para evitar erro se o email demorar a carregar
            setPayerEmail('cliente@relpcell.com');
        }
        setIsLoading(false); // Libera o carregamento inicial após obter o email
    };
    fetchUser();
  }, []);

  // Inicializa o Payment Brick DIRETAMENTE (Sem Create Preference)
  useEffect(() => {
    if (!isLoading && payerEmail && mpPublicKey && paymentBrickRef.current) {
      // Limpa instância anterior se houver
      if (brickInstance.current) {
          brickInstance.current.unmount();
      }

      const mp = new window.MercadoPago(mpPublicKey, { locale: 'pt-BR' });
      const bricks = mp.bricks();

      const settings = {
        initialization: {
          amount: invoice.amount, // Valor direto
          payer: {
            email: payerEmail,
          },
          externalReference: invoice.id,
        },
        customization: {
          visual: {
            style: {
              theme: 'default',
            },
            hidePaymentButton: false, 
          },
          paymentMethods: {
            ticket: [],         // Oculta Boleto (usamos componente separado)
            bankTransfer: [],   // Oculta Pix (usamos componente separado)
            atm: [],           
            creditCard: 'all',
            debitCard: 'all',
            mercadoPago: 'all',
            maxInstallments: 12,
          },
        },
        callbacks: {
          onReady: () => {
            // Brick carregado
          },
          onSubmit: (cardFormData: any) => {
            // RETORNAR UMA PROMISE É OBRIGATÓRIO PARA O BRICK NÃO TRAVAR
            return new Promise<void>(async (resolve, reject) => {
                setStatus(PaymentStatus.PENDING);
                setMessage('');
                
                // Mapeia os dados do Brick (camelCase) para o formato esperado pela API (snake_case)
                const payload = {
                    token: cardFormData.token,
                    issuer_id: cardFormData.issuerId,
                    payment_method_id: cardFormData.paymentMethodId,
                    transaction_amount: invoice.amount, // Usa valor da fatura por segurança
                    installments: cardFormData.installments,
                    description: `Fatura ${invoice.month}`,
                    payer: cardFormData.payer,
                    external_reference: invoice.id
                };

                try {
                  const response = await fetch('/api/mercadopago/process-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  });
                  
                  const paymentResult = await response.json();

                  if (!response.ok) {
                     // Se der erro 400/500, lançamos erro para cair no catch
                     throw new Error(paymentResult.message || 'O pagamento foi recusado.');
                  }

                  if (paymentResult.status === 'approved') {
                    // Pagamento Aprovado
                    const successMsg = await generateSuccessMessage('Cliente', String(invoice.amount));
                    setMessage(successMsg);
                    setStatus(PaymentStatus.SUCCESS);
                    setTimeout(() => {
                      onPaymentSuccess(paymentResult.id);
                    }, 4000);
                    resolve();
                  } else if (paymentResult.status === 'in_process') {
                     // Pagamento em Análise
                     setMessage("Seu pagamento está em análise. Você será notificado em breve.");
                     setStatus(PaymentStatus.SUCCESS);
                     setTimeout(() => {
                        onPaymentSuccess(paymentResult.id);
                     }, 4000);
                     resolve();
                  } else {
                     // Recusado pelo banco (mas API retornou 200)
                     throw new Error(paymentResult.message || 'Pagamento não aprovado.');
                  }
                } catch (error: any) {
                  console.error('Erro no processamento:', error);
                  setStatus(PaymentStatus.ERROR);
                  setMessage(error.message || 'Erro ao processar pagamento. Verifique os dados do cartão.');
                  // IMPORTANTE: Rejeitar a promise avisa o Brick que houve erro
                  reject();
                }
            });
          },
          onError: (error: any) => {
            console.error('Payment Brick Error:', error);
            setStatus(PaymentStatus.ERROR);
            setMessage('Ocorreu um erro técnico na conexão com o Mercado Pago.');
          },
        },
      };

      bricks.create('payment', paymentBrickRef.current.id, settings)
        .then((brick: any) => {
          brickInstance.current = brick;
        })
        .catch((err: any) => {
            console.error("Erro ao criar Brick:", err);
            setStatus(PaymentStatus.ERROR);
            setMessage("Erro ao carregar o formulário de pagamento. Verifique sua conexão.");
        });
    }

    return () => {
        if (brickInstance.current) {
          brickInstance.current.unmount();
        }
    };
  }, [isLoading, payerEmail, mpPublicKey, invoice.amount, invoice.id, onPaymentSuccess]);

  const renderContent = () => {
    if (status === PaymentStatus.PENDING) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[300px]">
                <LoadingSpinner />
                <p className="text-slate-600 dark:text-slate-300 font-medium">Processando pagamento...</p>
                <p className="text-xs text-slate-400">Aguarde a confirmação do banco.</p>
            </div>
        )
    }

    if (status === PaymentStatus.SUCCESS) {
      return (
        <div className="p-4 min-h-[300px] flex items-center">
            <Alert message={message} type="success" />
        </div>
      );
    }

    return (
        <div className="relative w-full">
            {isLoading && (
                <div className="absolute inset-0 bg-white dark:bg-slate-800 flex flex-col items-center justify-center p-8 z-20 rounded-lg">
                    <LoadingSpinner />
                    <p className="text-slate-500 dark:text-slate-400 mt-4">Carregando...</p>
                </div>
            )}
            
            {status === PaymentStatus.ERROR && (
                <div className="mb-4 animate-fade-in">
                    <Alert message={message} type="error" />
                </div>
            )}

            <div id="paymentBrick_container" ref={paymentBrickRef} className="w-full min-h-[450px]"></div>
        </div>
    );
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in overflow-hidden">
       <div className="text-center p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pagamento via Cartão</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fatura de {invoice.month} - <span className="font-bold text-indigo-600 dark:text-indigo-400">R$ {invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </p>
      </div>

      <div className="p-2 sm:p-4">
        {renderContent()}
      </div>
      
      {status !== PaymentStatus.PENDING && status !== PaymentStatus.SUCCESS && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
             <button type="button" onClick={onBack} className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200">
                Cancelar
            </button>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;
