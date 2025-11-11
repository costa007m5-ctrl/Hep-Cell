import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/clients';
import { Invoice, Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import DeveloperTab from './DeveloperTab';
import StatusTab from './StatusTab'; // Importa a nova aba
import { diagnoseDatabaseError } from '../services/geminiService';

interface AdminDashboardProps {
  onLogout: () => void;
}

interface ErrorInfo {
    message: string;
    diagnosis?: string;
    isDiagnosing: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [adminView, setAdminView] = useState<'invoices' | 'dev' | 'status'>('invoices'); // Adiciona 'status'
  
  // States para o formulário de criação
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [formState, setFormState] = useState({
    userId: '',
    month: '',
    amount: '',
    due_date: '',
  });

  const fetchAllInvoices = useCallback(async () => {
    try {
      const { data, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .order('due_date', { ascending: false });
      if (invoicesError) throw invoicesError;
      setInvoices(data || []);
    } catch (err: any) {
      throw err;
    }
  }, []);

  const fetchData = useCallback(async () => {
      setIsLoading(true);
      setErrorInfo(null);
      try {
        await fetchAllInvoices();

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email');
        
        if (profilesError) {
          throw new Error(`Falha ao carregar usuários: ${profilesError.message}. Verifique se a tabela 'profiles' e o trigger foram criados (veja a aba Desenvolvedor).`);
        }
        setUsers(profilesData || []);

      } catch (err: any) {
        console.error("Error fetching admin data:", err);
        const errorMessage = err.message || 'Ocorreu um erro desconhecido.';
        setErrorInfo({
            message: `Falha ao carregar os dados do painel: ${errorMessage}`,
            isDiagnosing: true,
        });

        diagnoseDatabaseError(errorMessage).then(diagnosis => {
            setErrorInfo(prev => prev ? { ...prev, diagnosis, isDiagnosing: false } : null);
        });
      } finally {
        setIsLoading(false);
      }
    }, [fetchAllInvoices]);

  useEffect(() => {
    if (adminView === 'invoices') {
        fetchData();
    }
  }, [adminView, fetchData]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage(null);
    try {
      const { userId, month, amount, due_date } = formState;
      if (!userId || !month || !amount || !due_date) {
        throw new Error("Todos os campos são obrigatórios.");
      }

      const { error: insertError } = await supabase.from('invoices').insert({
        user_id: userId,
        month,
        amount: parseFloat(amount),
        due_date: due_date,
        status: 'Em aberto',
      });

      if (insertError) throw insertError;
      
      setSubmitMessage({ text: 'Fatura criada com sucesso!', type: 'success' });
      setFormState({ userId: '', month: '', amount: '', due_date: '' });
      setShowCreateForm(false);
      await fetchAllInvoices();

    } catch (err: any) {
      setSubmitMessage({ text: `Erro: ${err.message}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitMessage(null), 5000);
    }
  };
  
  const renderInvoicesView = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 p-8">
          <LoadingSpinner />
          <p className="text-slate-500 dark:text-slate-400">Carregando dados...</p>
        </div>
      );
    }

    if (errorInfo) {
      return (
        <div className="p-4 space-y-4">
            <Alert message={errorInfo.message} type="error" />
             <div className="p-4 bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
                    Análise da IA
                </h3>
                {errorInfo.isDiagnosing && (
                    <div className="flex items-center space-x-2 mt-2">
                        <LoadingSpinner />
                        <p className="text-sm text-slate-500 dark:text-slate-400">Analisando o problema...</p>
                    </div>
                )}
                {errorInfo.diagnosis && (
                    <div className="mt-2 text-slate-600 dark:text-slate-300 space-y-2 text-sm">
                        {errorInfo.diagnosis.split('\n').map((line, index) => {
                            if (line.startsWith('### ')) {
                                return <h4 key={index} className="font-bold text-base text-slate-800 dark:text-slate-100 pt-2">{line.replace('### ', '')}</h4>
                            }
                            if (line.trim() === '') return null;
                            return <p key={index}>{line}</p>
                        })}
                    </div>
                )}
            </div>
            <button onClick={fetchData} className="w-full text-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Tentar Novamente</button>
        </div>
      );
    }

    return (
      <>
        {showCreateForm ? (
          <div className="p-6 my-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg animate-fade-in">
             <h3 className="text-lg font-bold mb-4">Nova Fatura</h3>
             <form onSubmit={handleCreateInvoice} className="space-y-4">
                {submitMessage && <Alert message={submitMessage.text} type={submitMessage.type} />}
                <div>
                  <label htmlFor="userId" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
                  <select id="userId" name="userId" value={formState.userId} onChange={handleInputChange} required className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="" disabled>Selecione um cliente</option>
                    {users.map(user => <option key={user.id} value={user.id}>{user.email}</option>)}
                  </select>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div>
                    <label htmlFor="month" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Mês de Referência</label>
                    <input type="text" id="month" name="month" value={formState.month} onChange={handleInputChange} placeholder="Ex: Julho/2024" required className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 focus:ring-indigo-500 focus:border-indigo-500"/>
                  </div>
                  <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Valor (R$)</label>
                    <input type="number" id="amount" name="amount" step="0.01" value={formState.amount} onChange={handleInputChange} placeholder="150.00" required className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 focus:ring-indigo-500 focus:border-indigo-500"/>
                  </div>
                  <div>
                    <label htmlFor="due_date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Vencimento</label>
                    <input type="date" id="due_date" name="due_date" value={formState.due_date} onChange={handleInputChange} required className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 focus:ring-indigo-500 focus:border-indigo-500"/>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={() => setShowCreateForm(false)} className="py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                        {isSubmitting ? <LoadingSpinner /> : 'Salvar Fatura'}
                    </button>
                </div>
             </form>
          </div>
        ) : (
          <button onClick={() => setShowCreateForm(true)} className="my-4 py-2 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm">
            + Adicionar Fatura
          </button>
        )}
        
        {invoices.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 p-8">Nenhuma fatura encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Mês</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Valor</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">ID do Usuário</th>
                    </tr>
                </thead>
              <tbody className="bg-white dark:bg-slate-900/50 divide-y divide-slate-200 dark:divide-slate-700">
                {invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{invoice.month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ invoice.status === 'Paga' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400' }`}>
                            {invoice.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">{invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-mono" title={invoice.user_id}>{invoice.user_id.slice(0, 15)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  const renderContent = () => {
    switch(adminView) {
        case 'invoices':
            return renderInvoicesView();
        case 'dev':
            return <DeveloperTab />;
        case 'status':
            return <StatusTab />;
        default:
            return renderInvoicesView();
    }
  }
  
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Painel do Administrador</h1>
          <button onClick={onLogout} className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair
          </button>
        </header>

        <div className="flex space-x-2 sm:space-x-4 mb-6 border-b border-slate-200 dark:border-slate-700">
            <button onClick={() => setAdminView('invoices')} className={`py-2 px-4 rounded-t-md text-sm font-medium transition-colors ${adminView === 'invoices' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                Visão Geral
            </button>
            <button onClick={() => setAdminView('dev')} className={`py-2 px-4 rounded-t-md text-sm font-medium transition-colors ${adminView === 'dev' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                Desenvolvedor
            </button>
            <button onClick={() => setAdminView('status')} className={`py-2 px-4 rounded-t-md text-sm font-medium transition-colors ${adminView === 'status' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                Status & Verificação
            </button>
        </div>

        <main className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-1 sm:p-6">
            {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;