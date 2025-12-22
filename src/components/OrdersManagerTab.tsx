
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface Order {
    id: string;
    user_id: string;
    status: string;
    total: number;
    created_at: string;
    items_snapshot: any[];
    address_snapshot: any;
}

const OrdersManagerTab: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setOrders(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, []);

    const updateStatus = async (orderId: string, newStatus: string) => {
        setUpdatingId(orderId);
        setMessage(null);
        try {
            const res = await fetch('/api/admin?action=update-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status: newStatus })
            });
            
            if (res.ok) {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
                setMessage({ text: "Status atualizado!", type: 'success' });
            } else {
                throw new Error("Falha ao atualizar");
            }
        } catch (e) {
            setMessage({ text: "Erro na atualização", type: 'error' });
        } finally {
            setUpdatingId(null);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const getStatusLabel = (status: string) => {
        switch(status) {
            case 'processing': return 'Aprovado';
            case 'preparing': return 'Preparando';
            case 'shipped': return 'Enviado';
            case 'out_for_delivery': return 'Em Rota';
            case 'delivered': return 'Entregue';
            case 'cancelled': return 'Cancelado';
            default: return status;
        }
    };

    if (isLoading) return <div className="p-10 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Gestão de Pedidos</h2>
            {message && <Alert message={message.text} type={message.type} />}
            
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedido</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Atual</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {orders.map(order => (
                            <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-slate-900 dark:text-white">#{order.id.slice(0,6).toUpperCase()}</p>
                                    <p className="text-[10px] text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{order.user_id.slice(0,8)}...</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                        order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    {updatingId === order.id ? <LoadingSpinner /> : (
                                        <>
                                            {order.status === 'processing' && <button onClick={() => updateStatus(order.id, 'preparing')} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-xs font-bold">Preparar</button>}
                                            {order.status === 'preparing' && <button onClick={() => updateStatus(order.id, 'shipped')} className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-bold">Enviar</button>}
                                            {order.status === 'shipped' && <button onClick={() => updateStatus(order.id, 'out_for_delivery')} className="px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-xs font-bold">Rota</button>}
                                            {order.status === 'out_for_delivery' && <button onClick={() => updateStatus(order.id, 'delivered')} className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs font-bold">Entregar</button>}
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OrdersManagerTab;
