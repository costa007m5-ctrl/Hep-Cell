import React, { useState } from 'react';
import DeveloperTab from './DeveloperTab';
import FinancialDashboard from './FinancialDashboard';
import ProductsTab from './ProductsTab';
import ClientsTab from './ClientsTab';
import NewSaleTab from './NewSaleTab';
import ActionLogTab from './ActionLogTab';
import StatusTab from './StatusTab';

interface AdminDashboardProps {
  onLogout: () => void;
}

// --- Simple CSS Chart Component ---
const SalesChart = () => {
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
        <div className="overflow-x-auto pb-2">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Fluxo de Pedidos</h3>
            <div className="flex gap-4 min-w-[600px]">
                <Column title="Pendente" status="pending" color="text-yellow-600" />
                <Column title="Enviado" status="shipped" color="text-blue-600" />
                <Column title="Entregue" status="delivered" color="text-green-600" />
            </div>
        </div>
    );
};

// --- Ícones do Menu ---
const Icons = {
    Dashboard: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    Clients: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    NewSale: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Products: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    Financials: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    History: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Status: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Dev: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
};

const QuickAccessCard: React.FC<{ title: string; icon: React.ReactNode; color: string; onClick: () => void }> = ({ title, icon, color, onClick }) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
    >
        <div className={`p-3 rounded-full ${color} text-white mb-2 shadow-md`}>
            {icon}
        </div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</span>
    </button>
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  
  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: Icons.Dashboard, color: 'bg-slate-500' },
    { id: 'clients', label: 'Clientes', icon: Icons.Clients, color: 'bg-blue-500' },
    { id: 'new_sale', label: 'Nova Venda', icon: Icons.NewSale, color: 'bg-indigo-500' },
    { id: 'products', label: 'Produtos', icon: Icons.Products, color: 'bg-orange-500' },
    { id: 'financials', label: 'Finanças', icon: Icons.Financials, color: 'bg-green-500' },
    { id: 'history', label: 'Histórico', icon: Icons.History, color: 'bg-purple-500' },
    { id: 'status', label: 'Status', icon: Icons.Status, color: 'bg-teal-500' },
    { id: 'dev', label: 'Dev Tools', icon: Icons.Dev, color: 'bg-gray-700' },
  ];

  const renderDashboardHome = () => (
      <div className="space-y-8 animate-fade-in">
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-l-4 border-green-500">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Faturamento Hoje</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">R$ 4.520,00</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-l-4 border-blue-500">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pedidos Novos</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">12</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-l-4 border-purple-500">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Ticket Médio</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">R$ 376,00</p>
              </div>
          </div>

          {/* Menu Rápido */}
          <div>
             <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 px-1">Menu Rápido</h3>
             <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
                {menuItems.filter(item => item.id !== 'dashboard').map(item => (
                    <QuickAccessCard 
                        key={item.id}
                        title={item.label}
                        icon={item.icon}
                        color={item.color}
                        onClick={() => setCurrentView(item.id)}
                    />
                ))}
             </div>
          </div>

          {/* Gráficos e Kanban */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SalesChart />
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
                   <OrderKanban />
              </div>
          </div>
      </div>
  );

  const renderContent = () => {
      switch(currentView) {
          case 'dashboard': return renderDashboardHome();
          case 'clients': return <ClientsTab allInvoices={[]} isLoading={false} errorInfo={null} />; 
          case 'financials': return <FinancialDashboard invoices={[]} isLoading={false} />;
          case 'products': return <ProductsTab />;
          case 'new_sale': return <NewSaleTab />;
          case 'history': return <ActionLogTab />;
          case 'status': return <StatusTab />;
          case 'dev': return <DeveloperTab />;
          default: return renderDashboardHome();
      }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col lg:flex-row">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 fixed h-full z-30 shadow-xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">R</div>
                <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">Admin Relp</h1>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Painel Gerencial</p>
                </div>
            </div>
            <nav className="flex-1 overflow-y-auto py-6">
                <ul className="space-y-1 px-3">
                    {menuItems.map(item => (
                        <li key={item.id}>
                            <button 
                                onClick={() => setCurrentView(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    currentView === item.id 
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <button onClick={onLogout} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sair do Painel
                </button>
            </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
            {/* Mobile Header */}
            <header className="lg:hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center sticky top-0 z-40">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Painel Admin
                </h1>
                <button onClick={onLogout} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
            </header>

            <main className="flex-1 p-4 pb-32 lg:p-8 lg:pb-8 overflow-y-auto">
                 {renderContent()}
            </main>
        </div>

        {/* Bottom Navigation - Mobile (Scrollable) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 z-50 pb-safe shadow-lg">
            <div className="flex overflow-x-auto no-scrollbar py-3 px-4 gap-4 snap-x">
                {menuItems.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[64px] snap-start transition-all ${
                            currentView === item.id 
                            ? 'text-indigo-600 dark:text-indigo-400 scale-105' 
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                    >
                        <div className={`mb-1 ${currentView === item.id ? 'bg-indigo-100 dark:bg-indigo-900/30 p-1.5 rounded-xl' : ''}`}>
                            {item.icon}
                        </div>
                        <span className={`text-[10px] font-medium whitespace-nowrap ${currentView === item.id ? 'font-bold' : ''}`}>
                            {item.label}
                        </span>
                    </button>
                ))}
                {/* Spacer to allow scrolling to the very end */}
                <div className="w-4 flex-shrink-0"></div>
            </div>
        </nav>
    </div>
  );
};

export default AdminDashboard;