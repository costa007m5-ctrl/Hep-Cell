import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';
import Alert from './Alert';

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

const PushNotificationTester: React.FC = () => {
    const [title, setTitle] = useState('Teste de Notificação');
    const [message, setMessage] = useState('Se você está vendo isso, o sistema de notificações está funcionando!');
    const [isSending, setIsSending] = useState(false);
    const [feedback, setFeedback] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const handleSendTest = async () => {
        setIsSending(true);
        setFeedback(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não identificado.');

            const response = await fetch('/api/admin/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    title: title,
                    message: message,
                    type: 'info'
                })
            });

            if (!response.ok) throw new Error('Falha na API de envio.');
            
            setFeedback({ text: 'Notificação enviada! Verifique a barra de notificações do seu dispositivo.', type: 'success' });
        } catch (error: any) {
            setFeedback({ text: error.message, type: 'error' });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mt-8">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Testar Notificações Push</h3>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Envie uma notificação real para o seu dispositivo atual para verificar se a integração com o navegador/Android está funcionando. 
                <strong>Nota:</strong> Você precisa permitir as notificações no navegador quando solicitado.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Título</label>
                    <input 
                        type="text" 
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Mensagem</label>
                    <input 
                        type="text" 
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                </div>
            </div>

            {feedback && <div className="mb-4"><Alert message={feedback.text} type={feedback.type} /></div>}

            <button 
                onClick={handleSendTest}
                disabled={isSending}
                className="w-full sm:w-auto flex justify-center items-center py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md transition-colors disabled:opacity-50"
            >
                {isSending ? <LoadingSpinner /> : 'Enviar para Mim (Admin)'}
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

        <PushNotificationTester />
      </section>
    </div>
  );
};

export default StatusTab;