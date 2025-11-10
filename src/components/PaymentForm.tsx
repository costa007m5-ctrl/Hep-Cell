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
  // Usamos uma ref para o controller do Brick para poder destruí-lo ao desmontar o componente
  const brickControllerRef = useRef<any>(null);
  
  // Usamos uma ref para a função de callback para evitar problemas de "stale closure"
  const onPaymentSuccessRef = useRef(onPaymentSuccess);
  useEffect(() => {
    onPaymentSuccessRef.current = onPaymentSuccess;
  }, [onPaymentSuccess]);

  useEffect(() => {
    let isComponentMounted = true;
    
    // Função para desmontar o brick de forma segura e limpar o container
    const unmountBrick = () => {
      if (brickControllerRef.current) {
        brickControllerRef.current.unmount();
        brickControllerRef.current = null;
      }
      if (paymentBrickContainerRef.current) {
        paymentBrickContainerRef.current.innerHTML = '';
      }
    };

    const initializePayment = async () => {
      // Garante que a chave e o container estão prontos antes de continuar
      if (!mpPublicKey || !paymentBrickContainerRef.current) {
        console.error("PaymentForm: Chave pública ou container do Brick não estão prontos.");
        if (isComponentMounted) {
            setStatus(PaymentStatus.ERROR);
            setMessage("Erro ao carregar o formulário de pagamento. Tente novamente.");
            setIsLoading(false);
        }
        return;
      }
      
      // Limpa qualquer instância anterior do brick para evitar renderizações duplicadas
      unmountBrick();
      setStatus(PaymentStatus.IDLE);
      setMessage('');
      setIsLoading(true);

      try {
        // 1. Criar a preferência de pagamento no backend
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
          const errorData = await prefResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Falha ao preparar o pagamento no servidor.');
        }

        const preference = await prefResponse.json();
        
        if (!isComponentMounted) return;

        // 2. Inicializar o SDK do Mercado Pago e o Brick
        const mp = new window.MercadoPago(mpPublicKey, { locale: 'pt-BR' });
        const bricks = mp.bricks();

        const settings = {
          initialization: {
            // A preferência é usada para todos os métodos de pagamento dentro do Brick
            preferenceId: preference.id,
          },
          customization: {
            visual: {
              style: {
                theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default',
              }
            }
          },
          callbacks: {
            onReady: () => {
              // O formulário está pronto para ser usado
              if (isComponentMounted) {
                setIsLoading(false);
              }
            },
            onSubmit: async (formData: any) => {
              // 3. Enviar os dados do pagamento para o backend para processamento seguro
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
                  throw new Error(result.message || 'O pagamento foi recusado pela operadora.');
                }
                
                // 4. Gerar mensagem de sucesso com IA e atualizar a UI
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
                setMessage('Dados inválidos. Verifique as informações e tente novamente.');
              }
            },
          },
        };
        
        // Cria e renderiza o componente Brick no container
        const brickInstance = await bricks.create('payment', paymentBrickContainerRef.current!.id, settings);
        brickControllerRef.current = brickInstance;

      } catch (error: any) {
        console.error("Falha ao inicializar pagamento:", error);
        if (isComponentMounted) {
          setStatus(PaymentStatus.ERROR);
          setMessage(error.message || 'Não foi possível iniciar o pagamento. Verifique sua conexão e tente novamente.');
          setIsLoading(false);
        }
      }
    };

    initializePayment();

    // Função de limpeza: será executada quando o componente for desmontado
    return () => {
      isComponentMounted = false;
      unmountBrick();
    };
  }, [invoice, mpPublicKey]); // O useEffect será re-executado se a fatura ou a chave mudarem


  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in">
       <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento Seguro</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Fatura de {invoice.month} - R$ {invoice.amount.toFixed(2).replace('.', ',')}</p>
      </div>

      <div className="p-6 sm:p-8 min-h-[250px] flex items-center justify-center">
        {/* O container do Brick só é visível quando não está carregando e o status é o inicial */}
        <div id="paymentBrick_container" ref={paymentBrickContainerRef} className={isLoading || status !== PaymentStatus.IDLE ? 'hidden' : 'w-full'}></div>

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
        
        {status === PaymentStatus.PENDING && (
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
