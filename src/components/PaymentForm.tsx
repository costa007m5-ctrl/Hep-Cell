import React, { useState, useEffect, useRef } from 'react';
import { PaymentStatus, Invoice } from '../types';
import { generateSuccessMessage } from '../services/geminiService';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';


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
  
  // States do formulário
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    identificationType: 'CPF',
    identificationNumber: '',
    zipCode: '',
    streetName: '',
    streetNumber: '',
    neighborhood: '',
    city: '',
    federalUnit: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  
  // States do Mercado Pago
  const [installments, setInstallments] = useState<any[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [isSDKReady, setIsSDKReady] = useState(false);

  const cardFormRef = useRef<any>(null);
  const streetNumberRef = useRef<HTMLInputElement>(null);
  const onPaymentSuccessRef = useRef(onPaymentSuccess);
  useEffect(() => {
    onPaymentSuccessRef.current = onPaymentSuccess;
  }, [onPaymentSuccess]);

  // Efeito para inicializar o Card Form do Mercado Pago
  useEffect(() => {
    if (!mpPublicKey) return;

    try {
        const mp = new window.MercadoPago(mpPublicKey);
        const cardForm = mp.cardForm({
            amount: String(invoice.amount),
            iframe: true,
            form: {
                id: 'form-checkout',
                cardNumber: { id: 'form-checkout-cardNumber' },
                securityCode: { id: 'form-checkout-securityCode' },
                expirationDate: { id: 'form-checkout-expirationDate' },
            },
            callbacks: {
                onReady: () => setIsSDKReady(true),
                onPaymentMethodsReceived: (error: any, paymentMethods: any) => {
                    if (error) return console.error('onPaymentMethodsReceived: ', error);
                    setPaymentMethodId(paymentMethods[0].id);
                },
                onInstallmentsReceived: (error: any, installmentsResponse: any) => {
                    if (error) return console.error('onInstallmentsReceived: ', error);
                    if (installmentsResponse && installmentsResponse.length > 0 && installmentsResponse[0].payer_costs) {
                        setInstallments(installmentsResponse[0].payer_costs);
                        if (installmentsResponse[0].payer_costs.length > 0) {
                            setSelectedInstallment(installmentsResponse[0].payer_costs[0].recommended_message);
                        }
                    }
                },
                onError: (error: any) => {
                    console.error("CardForm Error:", error);
                    setStatus(PaymentStatus.ERROR);
                    setMessage(error[0]?.message || 'Verifique os dados do cartão.');
                }
            },
        });
        cardFormRef.current = cardForm;
    } catch (e: any) {
        console.error("Falha ao inicializar o formulário do Mercado Pago:", e);
        setStatus(PaymentStatus.ERROR);
        setMessage("Não foi possível carregar o formulário de pagamento seguro. Por favor, tente novamente.");
    }

  }, [mpPublicKey, invoice.amount]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target;

    if (name === 'zipCode') {
        setCepError(null);
        value = value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
    } else if (name === 'identificationNumber') {
        value = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Efeito para buscar o endereço via CEP
  useEffect(() => {
    const cep = formData.zipCode.replace(/\D/g, '');
    if (cep.length !== 8) return;

    const fetchAddress = async () => {
        setIsFetchingCep(true);
        setCepError(null);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (!res.ok) throw new Error('API do ViaCEP falhou');
            const data = await res.json();
            if (data.erro) {
                setCepError('CEP não encontrado. Por favor, verifique o número.');
            } else {
                setFormData(prev => ({
                    ...prev,
                    streetName: data.logradouro,
                    neighborhood: data.bairro,
                    city: data.localidade,
                    federalUnit: data.uf,
                }));
                streetNumberRef.current?.focus();
            }
        } catch (error) {
            console.error('Erro ao buscar CEP', error);
            setCepError('Não foi possível buscar o CEP. Tente novamente.');
        } finally {
            setIsFetchingCep(false);
        }
    };
    fetchAddress();
  }, [formData.zipCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(PaymentStatus.PENDING);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) throw new Error('Sessão expirada. Faça login novamente.');

        const cardToken = await cardFormRef.current.createCardToken();
        
        const paymentPayload = {
            token: cardToken,
            issuer_id: cardFormRef.current.getIssuerId(),
            payment_method_id: paymentMethodId,
            transaction_amount: invoice.amount,
            installments: parseInt(selectedInstallment.split('x')[0]) || 1,
            description: `Fatura Relp Cell - ${invoice.month}`,
            payer: {
                email: user.email,
                first_name: formData.firstName,
                last_name: formData.lastName,
                identification: {
                    type: formData.identificationType,
                    number: formData.identificationNumber,
                },
                address: {
                    zip_code: formData.zipCode,
                    street_name: formData.streetName,
                    street_number: formData.streetNumber,
                    neighborhood: formData.neighborhood,
                    city: formData.city,
                    federal_unit: formData.federalUnit,
                }
            }
        };

        const response = await fetch('/api/mercadopago/process-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentPayload),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'O pagamento foi recusado.');
        }

        const successMsg = await generateSuccessMessage(formData.firstName, String(invoice.amount));
        setMessage(successMsg);
        setStatus(PaymentStatus.SUCCESS);
        setTimeout(() => {
            onPaymentSuccessRef.current();
        }, 4000);

    } catch (err: any) {
        setStatus(PaymentStatus.ERROR);
        setMessage(err.message || "Erro ao processar pagamento.");
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (status === PaymentStatus.SUCCESS || status === PaymentStatus.ERROR) {
    return (
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 animate-fade-in">
             <Alert message={message} type={status === PaymentStatus.SUCCESS ? 'success' : 'error'} />
        </div>
    )
  }
  
  if (status === PaymentStatus.PENDING) {
    return (
        <div className="w-full max-w-md flex flex-col items-center justify-center p-8 space-y-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
            <LoadingSpinner />
            <p className="text-slate-500 dark:text-slate-400">Processando seu pagamento...</p>
            <p className="text-sm text-slate-400">Por favor, não feche ou atualize a página.</p>
        </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in">
      <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento com Cartão</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Fatura de {invoice.month} - R$ {invoice.amount.toFixed(2).replace('.', ',')}</p>
      </div>

      <form id="form-checkout" onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
        {!isSDKReady && status !== PaymentStatus.ERROR && (
             <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <LoadingSpinner />
                <p className="text-slate-500 dark:text-slate-400">Carregando formulário seguro...</p>
            </div>
        )}
        <div className={isSDKReady ? 'space-y-4' : 'hidden'}>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Detalhes do Titular</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Nome" name="firstName" value={formData.firstName} onChange={handleFormChange} required />
                <InputField label="Sobrenome" name="lastName" value={formData.lastName} onChange={handleFormChange} required />
            </div>
            <InputField label="CPF" name="identificationNumber" value={formData.identificationNumber} onChange={handleFormChange} required placeholder="000.000.000-00" maxLength={14}/>

            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 pt-2">Endereço da Fatura</h3>
            <InputField label="CEP" name="zipCode" value={formData.zipCode} onChange={handleFormChange} required placeholder="00000-000" maxLength={9} isLoading={isFetchingCep} error={cepError} />
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                    <InputField label="Rua / Avenida" name="streetName" value={formData.streetName} onChange={handleFormChange} required />
                </div>
                <InputField label="Número" name="streetNumber" value={formData.streetNumber} onChange={handleFormChange} required ref={streetNumberRef} />
            </div>
            <InputField label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={handleFormChange} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Cidade" name="city" value={formData.city} onChange={handleFormChange} required />
                <InputField label="Estado (UF)" name="federalUnit" value={formData.federalUnit} onChange={handleFormChange} required maxLength={2} placeholder="SP" />
            </div>

            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 pt-2">Dados do Cartão</h3>
            <div>
                 <label htmlFor="form-checkout-cardNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Número do Cartão</label>
                <div id="form-checkout-cardNumber" className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 focus-within:ring-2 focus-within:ring-indigo-500"></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="form-checkout-expirationDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Vencimento</label>
                    <div id="form-checkout-expirationDate" className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 focus-within:ring-2 focus-within:ring-indigo-500"></div>
                </div>
                <div>
                     <label htmlFor="form-checkout-securityCode" className="block text-sm font-medium text-slate-700 dark:text-slate-300">CVV</label>
                    <div id="form-checkout-securityCode" className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 focus-within:ring-2 focus-within:ring-indigo-500"></div>
                </div>
            </div>
            {installments.length > 0 && (
                 <div>
                    <label htmlFor="installments" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Parcelas</label>
                    <select id="installments" name="installments" value={selectedInstallment} onChange={(e) => setSelectedInstallment(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {installments.map(inst => <option key={inst.installments} value={inst.recommended_message}>{inst.recommended_message}</option>)}
                    </select>
                </div>
            )}
            <button type="submit" disabled={isSubmitting || !isSDKReady} className="w-full mt-4 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {isSubmitting ? <LoadingSpinner /> : `Pagar ${invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
            </button>
        </div>
      </form>
      
      <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-700">
        <button type="button" onClick={onBack} className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
            Voltar
        </button>
      </div>
    </div>
  );
};

export default PaymentForm;