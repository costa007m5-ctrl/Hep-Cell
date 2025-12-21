
import React, { useState, useEffect, useRef } from 'react';
import DeveloperTab from './DeveloperTab';
import FinancialDashboard from './FinancialDashboard';
import ProductsTab from './ProductsTab';
import ClientsTab from './ClientsTab';
import NewSaleTab from './NewSaleTab';
import ActionLogTab from './ActionLogTab';
import StatusTab from './StatusTab';
import AiConfigTab from './AiConfigTab'; 
import AdvertisingTab from './AdvertisingTab'; 
import SupportTab from './SupportTab';
import PwaTab from './PwaTab';
import CreditAnalysisTab from './CreditAnalysisTab'; 
import PollsTab from './PollsTab';
import ReviewsTab from './ReviewsTab'; // Nova Importação
import { supabase } from '../services/clients';

interface AdminDashboardProps {
  onLogout: () => void;
}

const Icons = {
    Dashboard: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    Clients: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Credit: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, 
    NewSale: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Products: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    Financials: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    History: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Status: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Dev: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    Ai: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Ads: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
    Support: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Pwa: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    Polls: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    Reviews: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg> // Novo ícone
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [stats, setStats] = useState({ today: 0, orders: 0, ticket: 0, last7Days: [0,0,0,0,0,0,0] });
  
  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: Icons.Dashboard, color: 'bg-slate-500' },
    { id: 'credit', label: 'Central de Crédito', icon: Icons.Credit, color: 'bg-yellow-500' },
    { id: 'reviews', label: 'Avaliações', icon: Icons.Reviews, color: 'bg-emerald-500' }, // Novo
    { id: 'clients', label: 'Clientes', icon: Icons.Clients, color: 'bg-blue-500' },
    { id: 'new_sale', label: 'Nova Venda', icon: Icons.NewSale, color: 'bg-indigo-500' },
    { id: 'products', label: 'Produtos', icon: Icons.Products, color: 'bg-orange-500' },
    { id: 'ads', label: 'Publicidade', icon: Icons.Ads, color: 'bg-rose-500' },
    { id: 'polls', label: 'Enquetes', icon: Icons.Polls, color: 'bg-fuchsia-500' },
    { id: 'support', label: 'Suporte', icon: Icons.Support, color: 'bg-cyan-500' },
    { id: 'financials', label: 'Finanças', icon: Icons.Financials, color: 'bg-green-500' },
    { id: 'ai_config', label: 'IA & Chat', icon: Icons.Ai, color: 'bg-pink-500' },
    { id: 'dev', label: 'Dev Tools', icon: Icons.Dev, color: 'bg-gray-700' },
  ];

  const renderContent = () => {
      switch(currentView) {
          case 'dashboard': return <div className="space-y-8 animate-fade-in"><div className="grid grid-cols-3 gap-4"><div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-500"><p className="text-sm text-slate-500">Hoje</p><p className="text-3xl font-bold">R$ {stats.today.toFixed(2)}</p></div></div><p className="text-slate-500">Selecione uma opção no menu ao lado.</p></div>;
          case 'credit': return <CreditAnalysisTab />;
          case 'clients': return <ClientsTab allInvoices={[]} isLoading={false} errorInfo={null} />; 
          case 'financials': return <FinancialDashboard invoices={[]} isLoading={false} />;
          case 'products': return <ProductsTab />;
          case 'ads': return <AdvertisingTab />;
          case 'polls': return <PollsTab />;
          case 'reviews': return <ReviewsTab />; // Novo
          case 'support': return <SupportTab />;
          case 'new_sale': return <NewSaleTab />;
          case 'ai_config': return <AiConfigTab />;
          case 'dev': return <DeveloperTab />;
          default: return <div>Dashboard</div>;
      }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col lg:flex-row">
        <aside className="hidden lg:flex w-64 flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 fixed h-full z-30">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 font-bold text-xl">Admin Relp</div>
            <nav className="flex-1 overflow-y-auto py-6">
                <ul className="space-y-1 px-3">
                    {menuItems.map(item => (
                        <li key={item.id}>
                            <button 
                                onClick={() => setCurrentView(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                    currentView === item.id 
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' 
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                                }`}
                            >
                                {item.icon} {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <button onClick={onLogout} className="w-full py-3 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl">Sair</button>
            </div>
        </aside>
        <div className="flex-1 lg:ml-64 p-4 lg:p-8 overflow-y-auto">{renderContent()}</div>
    </div>
  );
};

export default AdminDashboard;
