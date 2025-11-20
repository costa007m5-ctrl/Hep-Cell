
import React, { useState, useEffect, useRef } from 'react';
import DeveloperTab from './DeveloperTab';
import FinancialDashboard from './FinancialDashboard';
import ProductsTab from './ProductsTab';
import ClientsTab from './ClientsTab';
import NewSaleTab from './NewSaleTab';
import ActionLogTab from './ActionLogTab';
import StatusTab from './StatusTab';
import AiConfigTab from './AiConfigTab'; 
import AdvertisingTab from './AdvertisingTab'; // Importa a nova aba
import { supabase } from '../services/clients';

interface AdminDashboardProps {
  onLogout: () => void;
}

// --- Simple CSS Chart Component with Real Data ---
const SalesChart = ({ data }: { data: number[] }) => {
    const max = Math.max(...data, 1); // Avoid division by zero
    const days = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const today = new Date().getDay();
    // Rotate days array so today is last
    const rotatedDays = [...days.slice(today + 1), ...days.slice(0, today + 1)];

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm mb-6">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Vendas (Últimos 7 dias)</h3>
            <div className="flex items-end justify-between h-40 gap-2">
                {data.map((val, i) => (
                    <div key={i} className="w-full bg-indigo-50 dark:bg-indigo-900/10 rounded-t-md relative group flex flex-col justify-end">
                        <div 
                            className="w-full bg-indigo-600 rounded-t-md transition-all duration-1000 ease-out hover:bg-indigo-500 min-h-[4px]"
                            style={{ height: `${(val/max)*100}%` }}
                        ></div>
                         <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            R$ {val}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-2">
                {rotatedDays.map((d, i) => <span key={i}>{d}</span>)}
            </div>
        </div>
    );
};

// --- Kanban Board Component (Mock for now, but structure ready for real data) ---
const DefaultersList = () => {
    const [defaulters, setDefaulters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDefaulters = async () => {
            // Busca faturas em aberto com data de vencimento anterior a hoje
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('invoices')
                .select('amount, due_date, profiles(first_name, last_name, email)')
                .eq('status', 'Em aberto')
                .lt('due_date', today)
                .limit(5);
            
            if (!error && data) setDefaulters(data);
            setLoading(false);
        };
        fetchDefaulters();
    }, []);

    return (
        <div className="overflow-hidden">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 text-red-600 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                Inadimplentes Recentes
            </h3>
            {loading ? <p className="text-sm text-slate-500">Carregando...</p> : 
             defaulters.length === 0 ? <p className="text-sm text-slate-500">Nenhum cliente inadimplente.</p> : (
                <div className="space-y-3">
                    {defaulters.map((d, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{d.profiles?.first_name} {d.profiles?.last_name}</p>
                                <p className="text-xs text-red-500">Venceu: {new Date(d.due_date).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <span className="font-bold text-red-700 dark:text-red-400">R$ {d.amount}</span>
                        </div>
                    ))}
                </div>
            )}
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
    Dev: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    Ai: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Ads: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
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
  const [stats, setStats] = useState({ today: 0, orders: 0, ticket: 0, last7Days: [0,0,0,0,0,0,0] });
  
  // Lógica de Notificação para o Admin (para fins de teste na aba Status)
  const lastNotificationIdRef = useRef<string | null>(null);
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    const checkNotifications = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (data && data.length > 0) {
                const latest = data[0];
                // Se a notificação é nova e não foi lida
                if (latest.id !== lastNotificationIdRef.current) {
                    if (lastNotificationIdRef.current !== null && !latest.read) {
                         if (Notification.permission === 'granted') {
                            if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.ready.then(registration => {
                                    registration.showNotification(latest.title, {
                                        body: latest.message,
                                        icon: 'https://placehold.co/192x192/4f46e5/ffffff.png?text=Relp',
                                        badge: 'https://placehold.co/96x96/4f46e5/ffffff.png?text=R',
                                        vibrate: [200, 100, 200],
                                        tag: latest.id
                                    } as any);
                                });
                            } else {
                                new Notification(latest.title, { body: latest.message });
                            }
                        }
                    }
                    lastNotificationIdRef.current = latest.id;
                }
            } else if (lastNotificationIdRef.current === null) {
                lastNotificationIdRef.current = '';
            }
        }
    };

    // Polling a cada 10 segundos enquanto estiver no painel
    const interval = setInterval(checkNotifications, 10000);
    checkNotifications(); // Check imediato
    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
      const fetchStats = async () => {
          // Mock de dados reais seria complexo de implementar em uma query só sem backend functions avançadas
          // Aqui faremos queries simples para dar vida ao dashboard
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          
          // Faturamento Hoje
          const { data: todaySales } = await supabase.from('invoices').select('amount').eq('status', 'Paga').gte('payment_date', todayStr);
          const totalToday = todaySales?.reduce((acc, curr) => acc + curr.amount, 0) || 0;

          // Pedidos Novos (Orders)
          const { count: ordersCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', todayStr);

          // Últimos 7 dias (Gráfico)
          const last7Days = [];
          for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              const dStr = d.toISOString().split('T')[0];
              const { data } = await supabase.from('invoices').select('amount').eq('status', 'Paga').gte('payment_date', dStr + 'T00:00:00').lte('payment_date', dStr + 'T23:59:59');
              last7Days.push(data?.reduce((acc, c) => acc + c.amount, 0) || 0);
          }

          setStats({
              today: totalToday,
              orders: ordersCount || 0,
              ticket: 150, // Mock médio para não pesar queries
              last7Days
          });
      };
      fetchStats();
  }, []);
  
  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: Icons.Dashboard, color: 'bg-slate-500' },
    { id: 'clients', label: 'Clientes', icon: Icons.Clients, color: 'bg-blue-500' },
    { id: 'new_sale', label: 'Nova Venda', icon: Icons.NewSale, color: 'bg-indigo-500' },
    { id: 'products', label: 'Produtos', icon: Icons.Products, color: 'bg-orange-500' },
    { id: 'ads', label: 'Publicidade', icon: Icons.Ads, color: 'bg-rose-500' }, // Nova Aba
    { id: 'financials', label: 'Finanças', icon: Icons.Financials, color: 'bg-green-500' },
    { id: 'history', label: 'Histórico', icon: Icons.History, color: 'bg-purple-500' },
    { id: 'ai_config', label: 'IA & Chat', icon: Icons.Ai, color: 'bg-pink-500' },
    { id: 'status', label: 'Status', icon: Icons.Status, color: 'bg-teal-500' },
    { id: 'dev', label: 'Dev Tools', icon: Icons.Dev, color: 'bg-gray-700' },
  ];

  const renderDashboardHome = () => (
      <div className="space-y-8 animate-fade-in">
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-l-4 border-green-500">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Faturamento Hoje</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.today.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-l-4 border-blue-500">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pedidos Novos</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.orders}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-l-4 border-purple-500">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Ticket Médio (Est.)</p>
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
              <SalesChart data={stats.last7Days} />
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
                   <DefaultersList />
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
          case 'ads': return <AdvertisingTab />;
          case 'new_sale': return <NewSaleTab />;
          case 'history': return <ActionLogTab />;
          case 'ai_config': return <AiConfigTab />; 
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
