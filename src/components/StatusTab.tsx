import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

type Status = 'idle' | 'testing' | 'success' | 'error';

interface ServiceStatusCardProps {
  title: string;
  description: string;
  endpoint: string;
}

const ServiceStatusCard: React.FC<ServiceStatusCardProps> = ({ title, description, endpoint }) => {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');

  const handleTest = async () => {
    setStatus('testing');
    setMessage('');
    try {
      const response = await fetch(endpoint, { method: 'POST' });
      const data = await response.json();
      setMessage(data.message);
      if (response.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage('Falha na comunicação com o servidor da aplicação. Verifique o console.');
    }
  };

  const getStatusIndicator = () => {
    switch (status) {
      case 'success':
        return <div className="w-3 h-3 rounded-full bg-green-500" title="Sucesso"></div>;
      case 'error':
        return <div className="w-3 h-3 rounded-full bg-red-500" title="Erro"></div>;
      case 'testing':
        return <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" title="Testando..."></div>;
      default:
        return <div className="w-3 h-3 rounded-full bg-slate-400" title="Aguardando teste"></div>;
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          {getStatusIndicator()}
          <h3 className="font-bold text-slate-800 dark:text-slate-200">{title}</h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 pl-6">{description}</p>
        {message && (
          <div className={`mt-2 pl-6 text-sm font-medium ${status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {message}
          </div>
        )}
      </div>
      <button
        onClick={handleTest}
        disabled={status === 'testing'}
        className="flex-shrink-0 w-full sm:w-auto flex justify-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50"
      >
        {status === 'testing' ? <LoadingSpinner /> : 'Testar Conexão'}
      </button>
    </div>
  );
};

const StatusTab: React.FC = () => {
  return (
    <div className="p-4 space-y-8">
      <section>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Verificação de Integrações</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Use os testes abaixo para confirmar que suas variáveis de ambiente na Vercel estão configuradas corretamente e que os serviços externos estão acessíveis.
        </p>
        <div className="space-y-4">
          <ServiceStatusCard
            title="Conexão com o Banco de Dados (Supabase)"
            description="Testa se o servidor consegue se conectar ao Supabase usando as chaves de serviço e se a função de setup foi criada."
            endpoint="/api/admin/test-supabase"
          />
          <ServiceStatusCard
            title="API de Inteligência Artificial (Gemini)"
            description="Verifica se a chave da API do Gemini é válida fazendo uma pequena requisição de teste."
            endpoint="/api/admin/test-gemini"
          />
          <ServiceStatusCard
            title="API de Pagamentos (Mercado Pago)"
            description="Confirma se o Access Token do Mercado Pago é válido e consegue autenticar com a API."
            endpoint="/api/admin/test-mercadopago"
          />
          <ServiceStatusCard
            title="API de Produtos (Mercado Livre)"
            description="Verifica se as credenciais (ML_CLIENT_ID, ML_CLIENT_SECRET) são válidas para autenticar com a API do Mercado Livre."
            endpoint="/api/admin/test-mercadolivre"
          />
        </div>
      </section>
    </div>
  );
};

export default StatusTab;
