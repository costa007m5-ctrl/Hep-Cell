import React, { useState, useEffect } from 'react';
import { supabase } from '../services/clients';
import { Invoice } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllInvoices = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data, error: invoicesError } = await supabase
          .from('invoices')
          .select('*')
          .order('due_date', { ascending: false });

        if (invoicesError) throw invoicesError;
        
        setInvoices(data || []);

      } catch (err: any) {
        console.error("Error fetching admin data. Full error object:", err);
        const message = (err && err.message) ? err.message : 'Ocorreu um erro, verifique o console para detalhes.';
        setError(`Falha ao carregar os dados do painel: ${message}. Verifique se as Políticas de Segurança (RLS) estão configuradas corretamente para o administrador.`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllInvoices();
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 p-8">
          <LoadingSpinner />
          <p className="text-slate-500 dark:text-slate-400">Carregando dados do painel...</p>
        </div>
      );
    }

    if (error) {
      return <div className="p-4"><Alert message={error} type="error" /></div>;
    }

    if (invoices.length === 0) {
        return <p className="text-center text-slate-500 dark:text-slate-400 p-8">Nenhuma fatura encontrada no sistema.</p>
    }

    return (
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
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    invoice.status === 'Paga' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400'
                                }`}>
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
    )
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Painel do Administrador
          </h1>
          <button
            onClick={onLogout}
            className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair
          </button>
        </header>

        <main className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              Visão Geral das Faturas
            </h2>
            {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;