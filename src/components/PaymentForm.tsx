
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
  const [payerEmail, setPayerEmail] = useState<string>('');
  const [paymentMethodIcon, setPaymentMethodIcon] = useState<string | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isFormMounted, setIsFormMounted] = useState(false);
  
  // Busca email do usuário logado
  useEffect(() => {
    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
            setPayerEmail(user.email);
        } else {
            setPayerEmail('cliente@relpcell.com');
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

  useEffect(() => {
    if (!payerEmail || !mpPublicKey || !isScriptLoaded) return;

    // Evita remontagem se já estiver montado ou processando
    if (isFormMounted || status !== PaymentStatus.IDLE) return;

    const cardContainer = document.getElementById('form-checkout__cardNumber');
    if (!cardContainer) return; // Elemento ainda não renderizado

    let cardForm: any;

    try {
        const mp = new window.MercadoPago(mpPublicKey, { locale: 'pt-BR' });
        
        cardForm = mp.cardForm({
          amount: String(invoice.amount),
          iframe: true,
          form: {
            id: "form-checkout",
            cardNumber: { id: "form-checkout__cardNumber", placeholder: "Número do cartão" },
            expirationDate: { id: "form-checkout__expirationDate", placeholder: "MM/YY" },
            securityCode: { id: "form-checkout__securityCode", placeholder: "CVC" },
            cardholderName: { id: "form-checkout__cardholderName", placeholder: "Titular do cartão" },
            issuer: { id: "form-checkout__issuer", placeholder: "Banco emissor" },
            installments: { id: "form-checkout__installments", placeholder: "Parcelas" },
            identificationType: { id: "form-checkout__identificationType", placeholder: "Tipo de documento" },
            identificationNumber: { id: "form-checkout__identificationNumber", placeholder: "Número do documento" },
            cardholderEmail: { id: "form-checkout__cardholderEmail", placeholder: "E-mail" },
          },
          callbacks: {
            onFormMounted: (error: any) => {
              if (error) return console.warn("Erro ao montar formulário:", error);
              setIsFormMounted(true);
            },
            onPaymentMethodChange: (data: any) => {
                // Atualiza o ícone da bandeira (Visa, Master, etc)
                if (data && (data.secure_thumbnail || data.thumbnail)) {
                    setPaymentMethodIcon(data.secure_thumbnail || data.thumbnail);
                } else {
                    setPaymentMethodIcon(null);
                }
            },
            onSubmit: (event: any) => {
              event.preventDefault();
              
              // Limpa mensagens anteriores
              setMessage('');
              
              const formData = cardForm.getCardFormData();
              
              if (!formData.token) {
                  setMessage('Dados do cartão inválidos ou incompletos. Verifique o número e o CVC.');
                  return;
              }

              if (formData.paymentMethodId === 'debit_card') {
                  setMessage('Somente cartão de crédito é aceito nesta modalidade.');
                  return;
              }

              setStatus(PaymentStatus.PENDING);

              const payload = {
                token: formData.token,
                issuer_id: formData.issuerId,
                payment_method_id: formData.paymentMethodId,
                transaction_amount: Number(formData.amount),
                installments: Number(formData.installments),
                description: `Fatura ${invoice.month}`,
                payer: {
                  email: formData.cardholderEmail || payerEmail,
                  identification: { 
                      type: formData.identificationType, 
                      number: formData.identificationNumber 
                  }
                },
                external_reference: invoice.id
              };

              fetch('/api/mercadopago/process-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              })
              .then(async (response) => {
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.message || result.error || 'Erro ao processar pagamento.');
                  
                  if (result.status === 'approved') {
                      const successMsg = await generateSuccessMessage('Cliente', String(invoice.amount));
                      setMessage(successMsg);
                      setStatus(PaymentStatus.SUCCESS);
                      setTimeout(() => onPaymentSuccess(result.id), 4000);
                  } else if (result.status === 'in_process') {
                      setMessage("Seu pagamento está em análise.");
                      setStatus(PaymentStatus.SUCCESS);
                      setTimeout(() => onPaymentSuccess(result.id), 4000);
                  } else {
                      throw new Error(result.message || 'Pagamento recusado.');
                  }
              })
              .catch((error: any) => {
                  console.error('Erro:', error);
                  setStatus(PaymentStatus.ERROR);
                  setMessage(error.message || 'Erro ao processar. Verifique os dados.');
              });
            },
          }
        });
    } catch (e) {
        console.error("Erro ao inicializar MP:", e);
        setMessage("Erro ao carregar sistema de pagamento. Tente recarregar a página.");
        setStatus(PaymentStatus.ERROR);
    }

    return () => {
        // Cleanup básico se o componente desmontar
        if (cardForm) {
            try { cardForm.unmount(); } catch(e) {}
        }
    };
  }, [mpPublicKey, invoice.amount, invoice.id, payerEmail, onPaymentSuccess, isScriptLoaded, isFormMounted]);

  const inputStyle = "w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-900 dark:text-white transition-all";
  const containerStyle = "h-10 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 flex items-center overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all";

  const renderContent = () => {
    if (status === PaymentStatus.PENDING) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[300px]">
                <LoadingSpinner />
                <p className="text-slate-600 dark:text-slate-300 font-medium">Processando pagamento...</p>
                <p className="text-xs text-slate-400">Não feche esta janela.</p>
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
        <form id="form-checkout" className="space-y-4">
            {status === PaymentStatus.ERROR && <Alert message={message} type="error" />}
            
            <div className="relative">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Número do Cartão (Crédito)</label>
                <div id="form-checkout__cardNumber" className={containerStyle}></div>
                {paymentMethodIcon && (
                    <div className="absolute top-7 right-3 pointer-events-none bg-white dark:bg-slate-700 pl-2 z-10">
                        <img src={paymentMethodIcon} alt="Bandeira" className="h-5 w-auto" />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Validade</label>
                    <div id="form-checkout__expirationDate" className={containerStyle}></div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">CVV</label>
                    <div id="form-checkout__securityCode" className={containerStyle}></div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Titular do Cartão</label>
                <input type="text" id="form-checkout__cardholderName" className={inputStyle} placeholder="Nome como no cartão" />
            </div>

            {/* Campos ocultos/visíveis conforme necessidade do SDK, mas o usuário precisa preencher se o SDK exigir */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Banco</label>
                    <select id="form-checkout__issuer" className={inputStyle}></select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tipo Doc.</label>
                    <select id="form-checkout__identificationType" className={inputStyle}></select>
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Número do Documento</label>
                <input type="text" id="form-checkout__identificationNumber" className={inputStyle} placeholder="CPF do titular" />
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Parcelamento</label>
                <select id="form-checkout__installments" className={inputStyle}></select>
            </div>

            <input type="email" id="form-checkout__cardholderEmail" value={payerEmail} readOnly className="hidden" />

            <div className="pt-4">
                <button type="submit" id="form-checkout__submit" className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg transition-colors active:scale-95">
                    Pagar R$ {invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </button>
            </div>
        </form>
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

      <div className="p-6">
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
