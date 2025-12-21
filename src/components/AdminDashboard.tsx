
import React, { useState, useEffect } from 'react';
import DeveloperTab from './DeveloperTab';
import FinancialDashboard from './FinancialDashboard';
import ProductsTab from './ProductsTab';
import ClientsTab from './ClientsTab';
import NewSaleTab from './NewSaleTab';
import StatusTab from './StatusTab';
import AiConfigTab from './AiConfigTab'; 
import ReviewsTab from './ReviewsTab';

interface AdminDashboardProps {
  onLogout: () => void;
}

const Icons = {
    Dashboard: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    Clients: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    NewSale: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Products: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    Financials: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    Status: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    Tools: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const menuItems = [
    { id: 'dashboard', label: 'Resumo', icon: Icons.Dashboard },
    { id: 'status', label: 'Integrações (API)', icon: Icons.Status },
    { id: 'clients', label: 'Clientes CRM', icon: Icons.Clients },
    { id: 'new_sale', label: 'Nova Venda', icon: Icons.NewSale },
    { id: 'products', label: 'Catálogo', icon: Icons.Products },
    { id: 'financials', label: 'Financeiro', icon: Icons.Financials },
    { id: 'dev', label: 'Ferramentas Dev', icon: Icons.Tools },
  ];

  const renderContent = () => {
      switch(currentView) {
          case 'dashboard': return (
              <div className="space-y-6 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                          <p className="text-xs font-bold text-slate-400 uppercase">Vendas/Entradas Hoje</p>
                          <p className="text-2xl font-black text-indigo-600">R$ 2.450,00</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                          <p className="text-xs font-bold text-slate-400 uppercase">Novos Clientes</p>
                          <p className="text-2xl font-black text-emerald-600">+12</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                          <p className="text-xs font-bold text-slate-400 uppercase">Alertas</p>
                          <p className="text-2xl font-black text-amber-600">3 Pendentes</p>
                      </div>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-8 rounded-3xl border border-indigo-100 dark:border-indigo-800 text-center">
                       <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-200">Bem-vindo ao Painel Relp</h3>
                       <p className="text-indigo-600 dark:text-indigo-400 text-sm mt-1">Gerencie seu crediário e catálogo de forma inteligente.</p>
                  </div>
              </div>
          );
          case 'status': return <StatusTab />;
          case 'clients': return <ClientsTab allInvoices={[]} isLoading={false} errorInfo={null} />; 
          case 'financials': return <FinancialDashboard invoices={[]} isLoading={false} />;
          case 'products': return <ProductsTab />;
          case 'new_sale': return <NewSaleTab />;
          case 'dev': return <DeveloperTab />;
          default: return <div className="p-20 text-center">Selecione uma opção</div>;
      }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row font-sans overflow-hidden">
        {/* Sidebar Mobile Toggle */}
        <div className="lg:hidden p-4 bg-indigo-600 flex justify-between items-center text-white shrink-0">
            <span className="font-black tracking-tight">Admin Relp</span>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-white/10 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
        </div>

        {/* Sidebar */}
        <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-50 w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 flex flex-col shrink-0 shadow-xl lg:shadow-none`}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h1 className="text-xl font-black text-indigo-600 tracking-tighter">RELP SYSTEM</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Gestão Amapá v3.0</p>
            </div>
            
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                {menuItems.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => { setCurrentView(item.id); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                            currentView === item.id 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        {item.icon} {item.label}
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={onLogout} className="w-full py-3 text-xs font-black text-red-600 bg-red-50 dark:bg-red-900/10 rounded-xl hover:bg-red-100 transition-colors">DESLOGAR</button>
            </div>
        </aside>

        <main className="flex-1 h-full overflow-y-auto p-4 lg:p-8 relative custom-scrollbar">
             <div className="max-w-5xl mx-auto pb-20">
                {renderContent()}
             </div>
        </main>
    </div>
  );
};

export default AdminDashboard;
