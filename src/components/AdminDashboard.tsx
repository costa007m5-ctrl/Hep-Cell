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
import ClientsTab from './ClientsTab';
import NewSaleTab from './NewSaleTab';

interface AdminDashboardProps {
  onLogout: () => void;
}

// --- Simple CSS Chart Component ---
const SalesChart = () => {
    // Dados Mockados para demonstração visual
    const data = [30, 45, 25, 60, 80, 55, 90];
    const max = Math.max(...data);
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm mb-6">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Vendas da Semana</h3>
            <div className="flex items-end justify-between h-40 gap-2">
                {data.map((val, i) => (
                    <div key={i} className="w-full bg-indigo-100 dark:bg-indigo-900/30 rounded-t-md relative group">
                        <div 
                            className="absolute bottom-0 left-0 right-0 bg-indigo-600 rounded-t-md transition-all duration-1000 ease-out hover:bg-indigo-500"
                            style={{ height: `${(val/max)*100}%` }}
                        ></div>
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">{val}</span>
                    </div>
                ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span>
            </div>
        </div>
    );
};

// --- Kanban Board Component ---
const OrderKanban = () => {
    // Dados Mockados
    const orders = [
        { id: '102', client: 'Maria S.', status: 'pending', total: 'R$ 1.200' },
        { id: '105', client: 'João P.', status: 'shipped', total: 'R$ 450' },
        { id: '109', client: 'Ana L.', status: 'delivered', total: 'R$ 3.500' },
    ];

    const Column = ({ title, status, color }: any) => (
        <div className="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
            <h4 className={`font-bold text-sm mb-3 ${color} flex items-center gap-2`}>
                <span className={`w-2 h-2 rounded-full bg-current`}></span> {title}
            </h4>
            <div className="space-y-2">
                {orders.filter(o => o.status === status).map(o => (
                    <div key={o.id} className="bg-white dark:bg-slate-800 p-3 rounded shadow-sm border-l-4 border-indigo-500 cursor-move hover:shadow-md transition-shadow">
                        <div className="flex justify-between">
                            <span className="font-bold text-sm text-slate-800 dark:text-white">#{o.id}</span>
                            <span className="text-xs text-slate-500">{o.total}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{o.client}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="overflow-x-auto">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Fluxo de Pedidos</h3>
            <div className="flex gap-4 min-w-[800px]">
                <Column title="Pendente" status="pending" color="text-yellow-600" />
                <Column title="Enviado" status="shipped" color="text-blue-600" />
                <Column title="Entregue" status="delivered" color="text-green-600" />
            </div>
        </div>
    );
};


const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  
  // ... (Lógica de autenticação existente e tabs) ...
  
  // Renderiza Dashboard Home com as novidades
  const renderDashboardHome = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                  <p className="text-sm text-slate-500">Faturamento Hoje</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">R$ 4.520,00</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
                  <p className="text-sm text-slate-500">Pedidos Novos</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">12</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-l-4 border-purple-500">
                  <p className="text-sm text-slate-500">Ticket Médio</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">R$ 376,00</p>
              </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SalesChart />
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
                   <OrderKanban />
              </div>
          </div>
      </div>
  );

  const renderContent = () => {
      switch(currentView) {
          case 'dashboard': return renderDashboardHome();
          case 'clients': return <ClientsTab allInvoices={[]} isLoading={false} errorInfo={null} />; // Simplificado para o diff
          case 'financials': return <FinancialDashboard invoices={[]} isLoading={false} />;
          case 'products': return <ProductsTab />;
          case 'new_sale': return <NewSaleTab />;
          case 'dev': return <DeveloperTab />;
          default: return renderDashboardHome();
      }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-4">
        <div className="max-w-7xl mx-auto">
            <header className="flex justify-between items-center mb-6 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Painel</h1>
                <button onClick={onLogout} className="text-sm text-red-500 font-bold">Sair</button>
            </header>
            
            <div className="flex gap-4">
                <aside className="w-64 hidden lg:block space-y-2">
                    <button onClick={() => setCurrentView('dashboard')} className={`w-full text-left px-4 py-3 rounded-lg ${currentView==='dashboard' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50'}`}>Dashboard</button>
                    <button onClick={() => setCurrentView('clients')} className={`w-full text-left px-4 py-3 rounded-lg ${currentView==='clients' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50'}`}>Clientes</button>
                    <button onClick={() => setCurrentView('new_sale')} className={`w-full text-left px-4 py-3 rounded-lg ${currentView==='new_sale' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50'}`}>Nova Venda</button>
                    <button onClick={() => setCurrentView('products')} className={`w-full text-left px-4 py-3 rounded-lg ${currentView==='products' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50'}`}>Produtos</button>
                    <button onClick={() => setCurrentView('financials')} className={`w-full text-left px-4 py-3 rounded-lg ${currentView==='financials' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50'}`}>Finanças</button>
                    <button onClick={() => setCurrentView('dev')} className={`w-full text-left px-4 py-3 rounded-lg ${currentView==='dev' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50'}`}>Dev Tools</button>
                </aside>
                <main className="flex-1">
                    {renderContent()}
                </main>
            </div>
            
            {/* Mobile Nav */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 p-4 flex justify-between border-t dark:border-slate-700 overflow-x-auto">
                 <button onClick={() => setCurrentView('dashboard')} className="px-4 py-2 text-xs font-bold">Dash</button>
                 <button onClick={() => setCurrentView('clients')} className="px-4 py-2 text-xs font-bold">Clientes</button>
                 <button onClick={() => setCurrentView('products')} className="px-4 py-2 text-xs font-bold">Prod</button>
                 <button onClick={() => setCurrentView('financials')} className="px-4 py-2 text-xs font-bold">Fin</button>
            </div>
        </div>
    </div>
  );
};

export default AdminDashboard;
