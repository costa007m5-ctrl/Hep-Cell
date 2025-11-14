import React, { useState, useEffect, useRef } from 'react';
import { PaymentStatus, Invoice, PaymentMethod, PayerInfo } from '../types';
import { generateSuccessMessage } from '../services/geminiService';
import { genAI, supabase } from '../services/clients';
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
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isLoadingPreference, setIsLoadingPreference] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeBase64: string; paymentId: number } | null>(null);
  const [boletoData, setBoletoData] = useState<{ boletoUrl: string; boletoBarcode: string; paymentId: number } | null>(null);
  const [payerInfo, setPayerInfo] = useState<PayerInfo>({
    email: '',
    firstName: '',
    lastName: '',
    identificationType: 'CPF',
    identificationNumber: '',
  });
  const [showPayerForm, setShowPayerForm] = useState(false);
  const brickContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name, identification_number')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            setPayerInfo({
              email: profile.email || user.email || '',
              firstName: profile.first_name || '',
              lastName: profile.last_name || '',
              identificationType: 'CPF',
              identificationNumber: profile.identification_number || '',
            });
          } else {
            setPayerInfo(prev => ({ ...prev, email: user.email || '' }));
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  useEffect(() => {
    if (selectedMethod === PaymentMethod.CARD && preferenceId && mpPublicKey && brickContainerRef.current) {
      if (brickContainerRef.current.innerHTML.trim() !== '') {
        return;
      }

      const mp = new window.MercadoPago(mpPublicKey, {
        locale: 'pt-BR',
      });

      const bricks = mp.bricks();

      const renderCardPaymentBrick = async () => {
          await bricks.create('cardPayment', brickContainerRef.current!.id, {
              initialization: {
                  amount: invoice.amount,
                  preferenceId: preferenceId,
              },
              customization: {
                paymentMethods: {
                    maxInstallments: 3,
                }
              },
              callbacks: {
                  onSubmit: async (cardFormData: any) => {
                      setStatus(PaymentStatus.PENDING);
                      try {
                          await new Promise(resolve => setTimeout(resolve, 2500));

                          const successMsg = await generateSuccessMessage(cardFormData.payer.firstName || 'Cliente', String(invoice.amount), genAI);
                          setMessage(successMsg);
                          setStatus(PaymentStatus.SUCCESS);
                          setTimeout(() => {
                              onPaymentSuccess();
                          }, 4000);
                      } catch (error) {
                          console.error(error);
                          setStatus(PaymentStatus.ERROR);
                          setMessage('Erro ao finalizar pagamento.');
                      }
                  },
                  onError: (error: any) => {
                      setStatus(PaymentStatus.ERROR);
                      setMessage('Dados do cartão inválidos. Verifique e tente novamente.');
                  },
              },
          });
      };
      
      renderCardPaymentBrick();
    }
    
    return () => {
        if (brickContainerRef.current) {
            brickContainerRef.current.innerHTML = '';
        }
    };
  }, [selectedMethod, preferenceId, mpPublicKey, onPaymentSuccess, invoice.amount]);

  const handleMethodSelect = async (method: PaymentMethod) => {
    setSelectedMethod(method);
    setStatus(PaymentStatus.IDLE);
    setMessage('');

    if (method === PaymentMethod.CARD) {
      setIsLoadingPreference(true);
      try {
        const response = await fetch('/api/mercadopago/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: invoice.id,
            description: `Fatura Relp Cell - ${invoice.month}`,
            amount: invoice.amount,
            payerEmail: payerInfo.email,
          }),
        });

        if (!response.ok) throw new Error('Falha ao criar preferência');
        const data = await response.json();
        setPreferenceId(data.id);
      } catch (error) {
        console.error(error);
        setStatus(PaymentStatus.ERROR);
        setMessage('Não foi possível iniciar o pagamento com cartão.');
      } finally {
        setIsLoadingPreference(false);
      }
    } else if (method === PaymentMethod.PIX || method === PaymentMethod.BOLETO) {
      if (!payerInfo.firstName || !payerInfo.lastName || !payerInfo.identificationNumber) {
        setShowPayerForm(true);
      } else {
        if (method === PaymentMethod.PIX) {
          await handlePixPayment();
        } else {
          setShowPayerForm(true);
        }
      }
    }
  };

  const handlePixPayment = async () => {
    setStatus(PaymentStatus.PENDING);
    setMessage('Gerando código PIX...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const response = await fetch('/api/mercadopago/create-pix-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: invoice.amount,
          description: `Fatura Relp Cell - ${invoice.month}`,
          payerEmail: payerInfo.email,
          userId: user?.id,
          firstName: payerInfo.firstName,
          lastName: payerInfo.lastName,
          identificationNumber: payerInfo.identificationNumber,
          invoiceId: invoice.id,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.code === 'INCOMPLETE_PROFILE') {
          setShowPayerForm(true);
          setStatus(PaymentStatus.IDLE);
          setMessage('');
          return;
        }
        throw new Error(data.message || 'Falha ao gerar PIX');
      }

      setPixData({
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        paymentId: data.paymentId,
      });
      setStatus(PaymentStatus.IDLE);
      setMessage('');
    } catch (error: any) {
      console.error(error);
      setStatus(PaymentStatus.ERROR);
      setMessage(error.message || 'Erro ao gerar código PIX.');
    }
  };

  const handleBoletoPayment = async () => {
    if (!payerInfo.zipCode || !payerInfo.streetName || !payerInfo.streetNumber || 
        !payerInfo.neighborhood || !payerInfo.city || !payerInfo.federalUnit) {
      setStatus(PaymentStatus.ERROR);
      setMessage('Por favor, preencha todos os dados do endereço para gerar o boleto.');
      return;
    }

    setStatus(PaymentStatus.PENDING);
    setMessage('Gerando boleto...');
    
    try {
      const requestBody = {
        amount: invoice.amount,
        description: `Fatura Relp Cell - ${invoice.month}`,
        payer: {
          email: payerInfo.email,
          firstName: payerInfo.firstName,
          lastName: payerInfo.lastName,
          identificationType: payerInfo.identificationType,
          identificationNumber: payerInfo.identificationNumber,
          zipCode: payerInfo.zipCode,
          streetName: payerInfo.streetName,
          streetNumber: payerInfo.streetNumber,
          neighborhood: payerInfo.neighborhood,
          city: payerInfo.city,
          federalUnit: payerInfo.federalUnit,
        },
        invoiceId: invoice.id,
      };

      console.log('Enviando dados do boleto:', requestBody);

      const response = await fetch('/api/mercadopago/create-boleto-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      console.log('Resposta do servidor:', data);
      
      if (!response.ok) {
        console.error('Erro na resposta:', data);
        throw new Error(data.message || data.error || 'Falha ao gerar boleto');
      }

      // Verificar se temos os dados necessários
      if (!data.paymentId) {
        console.error('Resposta sem paymentId:', data);
        throw new Error('Boleto gerado mas ID não retornado');
      }

      // Aceitar resposta mesmo sem URL (pode estar processando)
      if (data.boletoUrl || data.note) {
        setBoletoData({
          boletoUrl: data.boletoUrl || '',
          boletoBarcode: data.boletoBarcode || 'Processando...',
          paymentId: data.paymentId,
        });
        setStatus(PaymentStatus.IDLE);
        setMessage(data.note || '');
        setShowPayerForm(false);
      } else {
        console.warn('Boleto gerado mas dados incompletos:', data);
        setBoletoData({
          boletoUrl: '',
          boletoBarcode: 'Aguardando processamento...',
          paymentId: data.paymentId,
        });
        setStatus(PaymentStatus.IDLE);
        setMessage('Boleto gerado! Verifique seu email ou acesse o Mercado Pago.');
        setShowPayerForm(false);
      }
    } catch (error: any) {
      console.error('Erro ao processar boleto:', error);
      setStatus(PaymentStatus.ERROR);
      setMessage(error.message || 'Erro ao gerar boleto. Verifique os logs do console.');
    }
  };

  const handlePayerFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMethod === PaymentMethod.PIX) {
      handlePixPayment();
    } else if (selectedMethod === PaymentMethod.BOLETO) {
      handleBoletoPayment();
    }
    setShowPayerForm(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage('Código copiado!');
    setTimeout(() => setMessage(''), 2000);
  };


  const renderPayerForm = () => (
    <form onSubmit={handlePayerFormSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
          <input
            type="text"
            required
            value={payerInfo.firstName}
            onChange={(e) => setPayerInfo({ ...payerInfo, firstName: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sobrenome</label>
          <input
            type="text"
            required
            value={payerInfo.lastName}
            onChange={(e) => setPayerInfo({ ...payerInfo, lastName: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CPF</label>
          <input
            type="text"
            required
            value={payerInfo.identificationNumber}
            onChange={(e) => setPayerInfo({ ...payerInfo, identificationNumber: e.target.value })}
            placeholder="000.000.000-00"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>
        {selectedMethod === PaymentMethod.BOLETO && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CEP</label>
              <input
                type="text"
                required
                value={payerInfo.zipCode || ''}
                onChange={(e) => setPayerInfo({ ...payerInfo, zipCode: e.target.value })}
                placeholder="00000-000"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rua</label>
              <input
                type="text"
                required
                value={payerInfo.streetName || ''}
                onChange={(e) => setPayerInfo({ ...payerInfo, streetName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número</label>
              <input
                type="text"
                required
                value={payerInfo.streetNumber || ''}
                onChange={(e) => setPayerInfo({ ...payerInfo, streetNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bairro</label>
              <input
                type="text"
                required
                value={payerInfo.neighborhood || ''}
                onChange={(e) => setPayerInfo({ ...payerInfo, neighborhood: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cidade</label>
              <input
                type="text"
                required
                value={payerInfo.city || ''}
                onChange={(e) => setPayerInfo({ ...payerInfo, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estado</label>
              <input
                type="text"
                required
                maxLength={2}
                value={payerInfo.federalUnit || ''}
                onChange={(e) => setPayerInfo({ ...payerInfo, federalUnit: e.target.value.toUpperCase() })}
                placeholder="SP"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </>
        )}
      </div>
      <button
        type="submit"
        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
      >
        Continuar
      </button>
    </form>
  );

  const renderContent = () => {
    if (status === PaymentStatus.ERROR && message) {
      return <div className="p-4"><Alert message={message} type="error" /></div>;
    }

    if (status === PaymentStatus.SUCCESS) {
      return <div className="p-4"><Alert message={message} type="success" /></div>;
    }
    
    if (status === PaymentStatus.PENDING) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <LoadingSpinner />
          <p className="text-slate-500 dark:text-slate-400">{message || 'Processando...'}</p>
          <p className="text-sm text-slate-400">Por favor, não feche ou atualize a página.</p>
        </div>
      );
    }

    if (showPayerForm) {
      return renderPayerForm();
    }

    if (pixData) {
      return (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Pague com PIX</h3>
            <div className="bg-white p-4 rounded-lg inline-block">
              <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" className="w-64 h-64" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center">Ou copie o código PIX:</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={pixData.qrCode}
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
              />
              <button
                onClick={() => copyToClipboard(pixData.qrCode)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Copiar
              </button>
            </div>
          </div>
          <Alert message="O pagamento será confirmado automaticamente após a aprovação." type="success" />
        </div>
      );
    }

    if (boletoData) {
      const hasUrl = boletoData.boletoUrl && boletoData.boletoUrl !== '';
      const hasBarcode = boletoData.boletoBarcode && 
                         boletoData.boletoBarcode !== 'Processando...' && 
                         boletoData.boletoBarcode !== 'Aguardando processamento...' &&
                         boletoData.boletoBarcode !== 'Código não disponível';
      
      return (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              ✅ Boleto Gerado com Sucesso!
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ID do Pagamento: {boletoData.paymentId}
            </p>
          </div>
          
          {hasBarcode && (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Código de barras:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={boletoData.boletoBarcode}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(boletoData.boletoBarcode)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  Copiar
                </button>
              </div>
            </div>
          )}
          
          {!hasBarcode && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⏳ O código de barras estará disponível em alguns instantes.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            {hasUrl ? (
              <a
                href={boletoData.boletoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-center transition-colors"
              >
                📄 Visualizar Boleto
              </a>
            ) : (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 text-center">
                  📧 O link do boleto foi enviado para seu email
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-300 text-center mt-2">
                  Você também pode acessar pelo app do Mercado Pago
                </p>
              </div>
            )}
            
            <button
              onClick={() => window.open('https://www.mercadopago.com.br/activities', '_blank')}
              className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-center transition-colors"
            >
              🏦 Abrir Mercado Pago
            </button>
          </div>
          
          <Alert 
            message="O pagamento será confirmado automaticamente após o processamento bancário (1-3 dias úteis)." 
            type="success" 
          />
          
          {message && (
            <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>
            </div>
          )}
        </div>
      );
    }

    if (!selectedMethod) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white text-center mb-4">
            Escolha a forma de pagamento
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => handleMethodSelect(PaymentMethod.PIX)}
              className="w-full p-4 border-2 border-slate-300 dark:border-slate-600 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/40 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">PIX</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pagamento instantâneo</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleMethodSelect(PaymentMethod.BOLETO)}
              className="w-full p-4 border-2 border-slate-300 dark:border-slate-600 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Boleto</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Vencimento em 3 dias</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleMethodSelect(PaymentMethod.CARD)}
              className="w-full p-4 border-2 border-slate-300 dark:border-slate-600 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Cartão de Crédito</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Parcelamento em até 3x</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      );
    }

    if (selectedMethod === PaymentMethod.CARD) {
      if (isLoadingPreference) {
        return (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <LoadingSpinner />
            <p className="text-slate-500 dark:text-slate-400">Preparando pagamento seguro...</p>
          </div>
        );
      }
      return <div id="cardPaymentBrick_container" ref={brickContainerRef}></div>;
    }

    return null;
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg transform transition-all animate-fade-in">
      <div className="text-center p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento Seguro</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Fatura de {invoice.month} - R$ {invoice.amount.toFixed(2).replace('.', ',')}
        </p>
      </div>

      <div className="p-6 sm:p-8">
        {renderContent()}
      </div>
      
      {status !== PaymentStatus.PENDING && status !== PaymentStatus.SUCCESS && !pixData && !boletoData && (
        <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-700">
          <button 
            type="button" 
            onClick={() => {
              if (selectedMethod && !showPayerForm) {
                setSelectedMethod(null);
                setPreferenceId(null);
              } else {
                onBack();
              }
            }}
            className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            {selectedMethod && !showPayerForm ? 'Escolher outro método' : 'Voltar'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;