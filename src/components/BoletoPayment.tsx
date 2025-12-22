
import React, { useState, useEffect, useRef } from 'react';
import { Invoice } from '../types';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';

interface BoletoPaymentProps {
  invoice: Invoice;
  onBack: () => void;
  onBoletoGenerated: (updatedInvoice: Invoice) => void;
}

// --- Validação CPF ---
const isValidCPF = (cpf: string) => {
    if (typeof cpf !== 'string') return false;
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    let sum = 0;
    let remainder;
    for (let i = 1; i <= 9; i++) 
        sum = sum + parseInt(cpf.substring(i-1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder == 10) || (remainder == 11))  remainder = 0;
    if (remainder != parseInt(cpf.substring(9, 10)) ) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) 
        sum = sum + parseInt(cpf.substring(i-1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder == 10) || (remainder == 11))  remainder = 0;
    if (remainder != parseInt(cpf.substring(10, 11) ) ) return false;
    return true;
};

// Componente para o formulário de dados do boleto
const BoletoForm: React.FC<{ onSubmit: (data: any, saveData: boolean) => void; isSubmitting: boolean }> = ({ onSubmit, isSubmitting }) => {
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
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [saveData, setSaveData] = useState(true); // Checkbox para salvar dados
  const streetNumberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchAndSetProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const profile = await getProfile(user.id);
            if (profile) {
                setFormData(prev => ({
                    ...prev,
                    firstName: profile.first_name || '',
                    lastName: profile.last_name || '',
                    identificationNumber: profile.identification_number || '',
                    zipCode: profile.zip_code || '',
                    streetName: profile.street_name || '',
                    streetNumber: profile.street_number || '',
                    neighborhood: profile.neighborhood || '',
                    city: profile.city || '',
                    federalUnit: profile.federal_unit || '',
                }));
            }
        } catch (error) {
            console.error("Falha ao buscar perfil do usuário:", error);
        }
    };
    fetchAndSetProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target;

    // Limpa o erro de CEP ao digitar
    if (name === 'zipCode') {
        setCepError(null);
        value = value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
    } else if (name === 'identificationNumber') {
        setCpfError(null);
        value = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
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
    
    if (!isValidCPF(formData.identificationNumber)) {
        setCpfError("CPF inválido. Verifique os dígitos.");
        return;
    }

    onSubmit(formData, saveData);
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
        <InputField label="Número do Documento" name="identificationNumber" value={formData.identificationNumber} onChange={handleChange} required placeholder="000.000.000-00" maxLength={14} error={cpfError}/>
        <InputField label="CEP" name="zipCode" value={formData.zipCode} onChange={handleChange} required placeholder="00000-000" maxLength={9} isLoading={isFetchingCep} error={cepError} />
        <InputField label="Rua / Avenida" name="streetName" value={formData.streetName} onChange={handleChange} required />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField label="Número" name="streetNumber" value={formData.streetNumber} onChange={handleChange} required ref={streetNumberRef} />
            <div className="col-span-2">
                 <InputField label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={handleChange} required />
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Cidade" name="city" value={formData.city} onChange={handleChange} required />
            <InputField label="Estado (UF)" name="federalUnit" value={formData.federalUnit} onChange={handleChange} required maxLength={2} placeholder="SP" />
        </div>
        
         <div className="flex items-center pt-2">
            <input
                id="save-data-boleto"
                name="save-data-boleto"
                type="checkbox"
                checked={saveData}
                onChange={(e) => setSaveData(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
            />
            <label htmlFor="save-data-boleto" className="ml-2 block text-sm text-slate-900 dark:text-slate-300">
                Salvar meus dados para pagamentos futuros
            </label>
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full mt-4 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
            {isSubmitting ? <LoadingSpinner /> : 'Gerar Boleto'}
        </button>
    </form>
  );
};


const BoletoPayment: React.FC<BoletoPaymentProps> = ({ invoice, onBack, onBoletoGenerated }) => {
  const [step, setStep] = useState<'form' | 'loading' | 'error'>('form');
  const [error, setError] = useState<string | null>(null);
  
  // VERIFICA SE JÁ EXISTE BOLETO AO CARREGAR
  useEffect(() => {
      if (invoice.boleto_url && (invoice.status === 'Boleto Gerado' || invoice.status === 'Em aberto')) {
          // Se já tem url, chama o callback para ir para a tela de detalhes direto
          onBoletoGenerated(invoice);
      }
  }, [invoice]);

  const handleFormSubmit = async (formData: any, saveData: boolean) => {
    setStep('loading');
    setError(null);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) {
            throw new Error('Sessão expirada. Por favor, recarregue a página.');
        }

        const cleanZip = formData.zipCode.replace(/\D/g, '');

        const payload = {
            invoiceId: invoice.id,
            amount: invoice.amount,
            description: `Fatura Relp Cell - ${invoice.month}`,
            payer: {
                ...formData,
                zipCode: cleanZip,
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

        if (saveData) {
            await updateProfile({
                id: user.id,
                first_name: formData.firstName,
                last_name: formData.lastName,
                identification_number: formData.identificationNumber,
                zip_code: formData.zipCode,
                street_name: formData.streetName,
                street_number: formData.streetNumber,
                neighborhood: formData.neighborhood,
                city: formData.city,
                federal_unit: formData.federalUnit,
            });
        }
        
        const updatedInvoice: Invoice = {
            ...invoice,
            status: 'Boleto Gerado',
            boleto_url: data.boletoUrl,
            boleto_barcode: data.boletoBarcode,
            payment_id: String(data.paymentId),
        };
        
        onBoletoGenerated(updatedInvoice);

    } catch (err: any) {
        setError(err.message);
        setStep('error');
    }
  };

  const renderContent = () => {
    switch(step) {
        case 'loading':
            return (
                <div className="flex flex-col items-center justify-center p-8 space-y-4 h-full">
                    <LoadingSpinner />
                    <p className="text-slate-500 dark:text-slate-400">Gerando e salvando seu boleto...</p>
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
        case 'form':
        default:
            return <BoletoForm onSubmit={handleFormSubmit} isSubmitting={false} />;
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all">
      <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento via Boleto</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Fatura de {invoice.month} - R$ {invoice.amount.toFixed(2).replace('.', ',')}</p>
      </div>
      
      <div className="min-h-[500px] flex items-start justify-center">
        {renderContent()}
      </div>

      <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-700">
        <button type="button" onClick={onBack} disabled={step === 'loading'} className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50">
          Voltar
        </button>
      </div>
    </div>
  );
};

export default BoletoPayment;
