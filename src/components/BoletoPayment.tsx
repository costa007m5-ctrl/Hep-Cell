import React, { useState, useEffect, useRef } from 'react';
import { Invoice } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';

interface BoletoPaymentProps {
  invoice: Invoice;
  onBack: () => void;
  onPaymentConfirmed: () => void;
}


// Componente para o formulário de dados do boleto
const BoletoForm: React.FC<{ onSubmit: (data: any) => void; isSubmitting: boolean }> = ({ onSubmit, isSubmitting }) => {
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
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const streetNumberRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target;

    // Limpa o erro de CEP ao digitar
    if (name === 'zipCode') {
        setCepError(null);
        value = value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
    } else if (name === 'identificationNumber') {
        value = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Efeito para buscar o endereço quando o CEP for preenchido
  useEffect(() => {
    const cep = formData.zipCode.replace(/\D/g, '');
    if (cep.length !== 8) {
        return;
    }

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const selectClasses = "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 animate-fade-in w-full">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Dados para o Boleto</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
            Para gerar o boleto, precisamos de algumas informações suas.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Nome" name="firstName" value={formData.firstName} onChange={handleChange} required />
            <InputField label="Sobrenome" name="lastName" value={formData.lastName} onChange={handleChange} required />
        </div>
        <div>
            <label htmlFor="identificationType" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de Documento</label>
            <select name="identificationType" value={formData.identificationType} onChange={handleChange} className={selectClasses}>
                <option value="CPF">CPF</option>
            </select>
        </div>
        <InputField label="Número do Documento" name="identificationNumber" value={formData.identificationNumber} onChange={handleChange} required placeholder="000.000.000-00" maxLength={14}/>
        <InputField label="CEP" name="zipCode" value={formData.zipCode} onChange={handleChange} required placeholder="00000-000" maxLength={9} isLoading={isFetchingCep} error={cepError} />
        <InputField label="Rua / Avenida" name="streetName" value={formData.streetName} onChange={handleChange} required />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField label="Número" name="streetNumber" value={formData.streetNumber} onChange={handleChange} required ref={streetNumberRef} />
            <InputField label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={handleChange} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Cidade" name="city" value={formData.city} onChange={handleChange} required />
            <InputField label="Estado (UF)" name="federalUnit" value={formData.federalUnit} onChange={handleChange} required maxLength={2} placeholder="SP" />
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full mt-4 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
            {isSubmitting ? <LoadingSpinner /> : 'Gerar Boleto'}
        </button>
    </form>
  );
};


const BoletoPayment: React.FC<BoletoPaymentProps> = ({ invoice, onBack, onPaymentConfirmed }) => {
  const [step, setStep] = useState<'form' | 'loading' | 'display' | 'error'>('form');
  const [error, setError] = useState<string | null>(null);
  const [boletoData, setBoletoData] = useState<{ boletoUrl: string; barCode: string } | null>(null);
  const [copyButtonText, setCopyButtonText] = useState('Copiar Código');
  
  const handleFormSubmit = async (formData: any) => {
    setStep('loading');
    setError(null);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) {
            throw new Error('Sessão expirada. Por favor, recarregue a página.');
        }

        const payload = {
            amount: invoice.amount,
            description: `Fatura Relp Cell - ${invoice.month}`,
            payer: {
                ...formData,
                email: user.email,
            }
        };

        const response = await fetch('/api/mercadopago/create-boleto-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Falha ao gerar o boleto.');
        }
        setBoletoData(data);
        setStep('display');
    } catch (err: any) {
        setError(err.message);
        setStep('error');
    }
  };

  const handleCopy = () => {
    if (boletoData?.barCode) {
      navigator.clipboard.writeText(boletoData.barCode);
      setCopyButtonText('Copiado!');
      setTimeout(() => setCopyButtonText('Copiar Código'), 2000);
    }
  };

  const renderContent = () => {
    switch(step) {
        case 'form':
            return <BoletoForm onSubmit={handleFormSubmit} isSubmitting={false} />;
        case 'loading':
            return (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <LoadingSpinner />
                    <p className="text-slate-500 dark:text-slate-400">Gerando seu boleto...</p>
                </div>
            );
        case 'error':
            return (
                <div className="p-4 w-full text-center">
                    <Alert message={error!} type="error" />
                     <button onClick={() => setStep('form')} className="mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        Tentar novamente
                    </button>
                </div>
            );
        case 'display':
            if (boletoData) {
                return (
                    <div className="flex flex-col items-center text-center p-6 space-y-6 animate-fade-in">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Boleto Gerado com Sucesso!</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Clique no botão abaixo para visualizar e imprimir. O pagamento pode levar até 2 dias úteis para ser confirmado.
                        </p>
                        <a
                            href={boletoData.boletoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Visualizar Boleto
                        </a>
                        <div className="w-full">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Ou copie o código de barras:</p>
                            <div className="relative p-3 bg-slate-100 dark:bg-slate-700 rounded-md">
                                <p className="text-xs text-left break-all text-slate-600 dark:text-slate-300 font-mono">
                                    {boletoData.barCode}
                                </p>
                            </div>
                            <button onClick={handleCopy} className="mt-2 w-full flex justify-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">
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
        default:
            return null;
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all">
      <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento via Boleto</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Fatura de {invoice.month} - R$ {invoice.amount.toFixed(2).replace('.', ',')}</p>
      </div>
      
      <div className="min-h-[250px] flex items-start justify-center">
        {renderContent()}
      </div>

      <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-700">
        <button type="button" onClick={step === 'display' ? onPaymentConfirmed : onBack} className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
          {step === 'display' ? 'Voltar para Faturas' : 'Voltar'}
        </button>
      </div>
    </div>
  );
};

export default BoletoPayment;
