import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';

const AdminOverviewTab: React.FC = () => {
    const [stats, setStats] = useState({
        totalClients: 0,
        totalOrders: 0,
        activeDebt: 0,
        monthlyRevenue: 0
    });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch paralelo para performance
                const [profiles, orders, invoices] = await Promise.all([
                    supabase.from('profiles').select('id', { count: 'exact' }),
                    supabase.from('orders').select('id, total, created_at, status').order('created_at', { ascending: false }).limit(5),
                    supabase.from('invoices').select('amount, status, payment_date')
                ]);

                // Cálculos
                const totalClients = profiles.count || 0;
                const totalOrders = orders.count || 0; // Aproximado se não usar select count
                
                let activeDebt = 0;
                let monthlyRevenue = 0;
                const now = new Date();
                const currentMonth = now.getMonth();

                invoices.data?.forEach(inv => {
                    if (inv.status === 'Em aberto' || inv.status === 'Boleto Gerado') {
                        activeDebt += inv.amount;
                    }
                    if (inv.status === 'Paga' && inv.payment_date) {
                        const pDate = new Date(inv.payment_date);
                        if (pDate.getMonth() === currentMonth) {
                            monthlyRevenue += inv.amount;
                        }
                    }
                });

                setStats({ totalClients, totalOrders: orders.data?.length || 0, activeDebt, monthlyRevenue });
                setRecentActivity(orders.data || []);

            } catch (e) {
                console.error("Erro dashboard", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const MetricCard = ({ title, value, icon, color, trend }: any) => (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
                {icon}
            </div>
            <div className="relative z-10">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{value}</h3>
                {trend && <p className="text-[10px] text-green-500 font-bold mt-1">+{trend}% este mês</p>}
            </div>
        </div>
    );

    if (isLoading) return <div className="p-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black tracking-tight mb-2">Visão Geral</h2>
                    <p className="text-indigo-100 text-sm font-medium">Bem-vindo ao painel de controle da Relp Cell.</p>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                <MetricCard 
                    title="Receita (Mês)" 
                    value={stats.monthlyRevenue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    color="text-green-500"
                    trend="12"
                />
                <MetricCard 
                    title="A Receber (Dívida)" 
                    value={stats.activeDebt.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                    color="text-orange-500"
                />
                <MetricCard 
                    title="Clientes Ativos" 
                    value={stats.totalClients} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                    color="text-blue-500"
                />
                <MetricCard 
                    title="Pedidos Recentes" 
                    value={stats.totalOrders} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                    color="text-purple-500"
                />
            </div>

            {/* Recent Activity Table */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden mx-2">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-slate-800 dark:text-white">Pedidos Recentes</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[10px] uppercase font-black text-slate-400 bg-white dark:bg-slate-800">
                            <tr>
                                <th className="px-6 py-3">ID</th>
                                <th className="px-6 py-3">Data</th>
                                <th className="px-6 py-3">Valor</th>
                                <th className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                            {recentActivity.map((order) => (
                                <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="px-6 py-4 font-mono text-slate-500">#{order.id.slice(0,6)}</td>
                                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{new Date(order.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">R$ {order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                            order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {recentActivity.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">Nenhum pedido recente.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminOverviewTab;