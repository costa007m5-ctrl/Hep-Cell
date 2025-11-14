import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/clients';
import { Invoice } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import DeveloperTab from './DeveloperTab';
import StatusTab from './StatusTab';
import ActionLogTab from './ActionLogTab';
import FinancialDashboard from './FinancialDashboard';
import ProductsTab from './ProductsTab';
import ClientsTab from './ClientsTab'; // Nova aba de Clientes
import NewSaleTab from './NewSaleTab'; // Nova aba de Vendas
import { diagnoseDatabaseError } from '../services/geminiService';

interface AdminDashboardProps {
  onLogout: () => void;
}

interface ErrorInfo {
    message: string;
    diagnosis?: string;
    isDiagnosing: boolean;
}

type AdminView = 'clients' | 'new_sale' | 'products' | 'financials' | 'dev' | 'status' | 'logs';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [adminView, setAdminView] = useState<AdminView>('clients');
  const [setupNeeded, setSetupNeeded] = useState(false);
  
    // Check for setup on initial load
    useEffect(() => {
        const checkDbSetup = async () => {
            // Check if 'action_logs' table exists by trying a simple query.
            // PostgreSQL error code for "undefined_table" is 42P01.
            const { error } = await supabase.from('action_logs').select('id', { count: 'exact', head: true });
            if (error && error.code === '42P01') {
                setSetupNeeded(true);
                setIsLoading(false); // Stop main loading if setup is needed
            }
        };
        checkDbSetup();
    }, []);

  const fetchData = useCallback(async () => {
      if (setupNeeded) return; // Don't fetch if setup is not complete
      setIsLoading(true);
      setErrorInfo(null);
      try {
        const { data, error: invoicesError } = await supabase
            .from('invoices')
            .select('*')
            .order('due_date', { ascending: false });
        if (invoicesError) throw invoicesError;
        setInvoices(data || []);
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
    }, [setupNeeded]);

  useEffect(() => {
    // Carrega dados de faturas apenas se a visão for financeira ou de clientes
    if (adminView === 'financials' || adminView === 'clients') {
        fetchData();
    }
  }, [adminView, fetchData]);
  
  const renderContent = () => {
    switch(adminView) {
        case 'clients':
            return <ClientsTab allInvoices={invoices} isLoading={isLoading} errorInfo={errorInfo} />;
        case 'new_sale':
            return <NewSaleTab />;
        case 'products':
            return <ProductsTab />;
        case 'financials':
            return <FinancialDashboard invoices={invoices} isLoading={isLoading} />;
        case 'dev':
            return <DeveloperTab />;
        case 'status':
            return <StatusTab />;
        case 'logs':
            return <ActionLogTab />;
        default:
             return <ClientsTab allInvoices={invoices} isLoading={isLoading} errorInfo={errorInfo} />;
    }
  }

  if (setupNeeded && adminView !== 'dev') {
    return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 text-center animate-fade-in">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Configuração Necessária</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-300">
                    Parece que o banco de dados ainda não foi configurado. As tabelas necessárias para o aplicativo não existem.
                </p>
                <p className="mt-4 text-slate-600 dark:text-slate-300">
                    Por favor, vá para a aba <strong>Desenvolvedor</strong> e execute o setup para criar as tabelas e políticas de segurança.
                </p>
                <div className="mt-6 flex justify-center gap-4">
                    <button onClick={() => setAdminView('dev')} className="py-2 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm">
                        Ir para a aba Desenvolvedor
                    </button>
                    <button onClick={onLogout} className="py-2 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm">
                        Sair
                    </button>
                </div>
            </div>
        </div>
    )
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

        <nav className="flex space-x-2 sm:space-x-4 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
            <TabButton label="Clientes" view="clients" currentView={adminView} setView={setAdminView} />
            <TabButton label="Nova Venda" view="new_sale" currentView={adminView} setView={setAdminView} />
            <TabButton label="Produtos" view="products" currentView={adminView} setView={setAdminView} />
            <TabButton label="Finanças" view="financials" currentView={adminView} setView={setAdminView} />
            <TabButton label="Desenvolvedor" view="dev" currentView={adminView} setView={setAdminView} />
            <TabButton label="Status & Verificação" view="status" currentView={adminView} setView={setAdminView} />
            <TabButton label="Histórico" view="logs" currentView={adminView} setView={setAdminView} />
        </nav>

        <main className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-1 sm:p-6">
            {renderContent()}
        </main>
      </div>
    </div>
  );
};

interface TabButtonProps {
    label: string;
    view: AdminView;
    currentView: AdminView;
    setView: (view: AdminView) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, view, currentView, setView }) => (
     <button onClick={() => setView(view)} className={`py-2 px-4 rounded-t-md text-sm font-medium transition-colors flex-shrink-0 ${currentView === view ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
        {label}
    </button>
);


export default AdminDashboard;
