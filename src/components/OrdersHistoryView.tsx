import React, { useState, useEffect } from 'react';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';

interface Order {
    id: string;
    status: string;
    total: number;
    created_at: string;
    tracking_notes?: string;
    items_snapshot: any[];
}

const OrdersHistoryView: React.FC<{ userId: string }> = ({ userId }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                const { data } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                setOrders(data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [userId]);

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            'delivered': 'bg-green-100 text-green-700',
            'processing': 'bg-blue-100 text-blue-700',
            'shipped': 'bg-purple-100 text-purple-700',
            'cancelled': 'bg-red-100 text-red-700',
            'preparing': 'bg-indigo-100 text-indigo-700'
        };
        const labels: Record<string, string> = {
            'delivered': 'Entregue',
            'processing': 'Em Processamento',
            'shipped': 'Em Trânsito',
            'cancelled': 'Cancelado',
            'preparing': 'Preparando'
        };
        return (
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${styles[status] || 'bg-slate-100 text-slate-500'}`}>
                {labels[status] || status}
            </span>
        );
    };

    if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight px-1">Meus Pedidos</h2>
            
            {orders.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-slate-400 text-sm">Você ainda não realizou compras.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => (
                        <div key={order.id} className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedido #{order.id.slice(0,8)}</p>
                                    <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                                </div>
                                {getStatusBadge(order.status)}
                            </div>

                            <div className="space-y-2 mb-4">
                                {order.items_snapshot?.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{item.name}</span>
                                        <span className="font-bold text-slate-900 dark:text-white">R$ {item.price.toLocaleString('pt-BR')}</span>
                                    </div>
                                ))}
                            </div>

                            {order.tracking_notes && (
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-4">
                                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase mb-1">Status de Entrega</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{order.tracking_notes}</p>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-50 dark:border-slate-700 flex justify-between items-end">
                                <span className="text-xs font-bold text-slate-400 uppercase">Total Pago</span>
                                <span className="text-xl font-black text-indigo-600">R$ {order.total.toLocaleString('pt-BR')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrdersHistoryView;