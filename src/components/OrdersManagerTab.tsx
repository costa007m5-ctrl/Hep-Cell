
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Modal from './Modal';

interface Order {
    id: string;
    user_id: string;
    status: string;
    total: number;
    created_at: string;
    tracking_notes?: string;
    items_snapshot: any[];
    address_snapshot: any;
    profiles?: {
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
    };
}

const OrdersManagerTab: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [notes, setNotes] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin?action=get-orders');
            const data = await res.json();
            if (res.ok) {
                setOrders(data);
            } else {
                throw new Error("Falha ao buscar pedidos");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, []);

    const handleUpdateStatus = async (newStatus: string) => {
        if (!selectedOrder) return;
        setIsUpdating(true);
        setMessage(null);
        
        try {
            const res = await fetch('/api/admin?action=update-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    orderId: selectedOrder.id, 
                    status: newStatus, 
                    notes: notes || selectedOrder.tracking_notes 
                })
            });
            
            if (res.ok) {
                setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: newStatus, tracking_notes: notes || o.tracking_notes } : o));
                setSelectedOrder(prev => prev ? { ...prev, status: newStatus, tracking_notes: notes || prev.tracking_notes } : null);
                setMessage({ text: `Status alterado para: ${getStatusLabel(newStatus)}`, type: 'success' });
                setNotes('');
            } else {
                throw new Error("Falha ao atualizar");
            }
        } catch (e) {
            setMessage({ text: "Erro ao atualizar status", type: 'error' });
        } finally {
            setIsUpdating(false);
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'processing': 'Aprovado',
            'preparing': 'Em Preparação',
            'shipped': 'Enviado',
            'out_for_delivery': 'Saiu para Entrega',
            'delivered': 'Entregue',
            'cancelled': 'Cancelado'
        };
        return labels[status] || status;
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            'processing': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
            'preparing': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
            'shipped': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
            'out_for_delivery': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
            'delivered': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
            'cancelled': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        };
        return colors[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    };

    if (isLoading) return <div className="p-10 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Gestão de Pedidos</h2>
                <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full">
                    {orders.length} Total
                </span>
            </div>
            
            {/* VIEW MOBILE: CARDS (Visible < md) */}
            <div className="md:hidden space-y-4">
                {orders.map(order => (
                    <div key={order.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{order.id.slice(0,6).toUpperCase()}</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                    {order.profiles ? `${order.profiles.first_name} ${order.profiles.last_name}` : 'Usuário ' + order.user_id.slice(0,4)}
                                </p>
                                <p className="text-[10px] text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                            </span>
                        </div>
                        
                        <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-slate-700/50">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase">Total</p>
                                <p className="text-base font-black text-indigo-600 dark:text-indigo-400">
                                    R$ {order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </p>
                            </div>
                            <button 
                                onClick={() => { setSelectedOrder(order); setNotes(''); setMessage(null); }}
                                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                Gerenciar
                            </button>
                        </div>
                    </div>
                ))}
                {orders.length === 0 && <p className="text-center text-slate-400 text-sm py-10">Nenhum pedido encontrado.</p>}
            </div>

            {/* VIEW DESKTOP: TABLE (Visible >= md) */}
            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedido</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalhes</th>
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
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {order.profiles ? `${order.profiles.first_name} ${order.profiles.last_name}` : 'Usuário ' + order.user_id.slice(0,4)}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                            R$ {order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusColor(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => { setSelectedOrder(order); setNotes(''); setMessage(null); }}
                                            className="px-4 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            Gerenciar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedOrder && (
                <Modal isOpen={true} onClose={() => setSelectedOrder(null)} maxWidth="max-w-2xl">
                    <div className="space-y-6">
                        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Detalhes do Pedido #{selectedOrder.id.slice(0,6).toUpperCase()}</h3>
                                <p className="text-sm text-slate-500">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(selectedOrder.status)}`}>
                                {getStatusLabel(selectedOrder.status)}
                            </span>
                        </div>

                        {message && <Alert message={message.text} type={message.type} />}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Dados do Cliente e Entrega */}
                            <div className="space-y-4">
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs font-black uppercase text-slate-400 mb-2">Cliente</h4>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        {selectedOrder.profiles?.first_name} {selectedOrder.profiles?.last_name}
                                    </p>
                                    <p className="text-xs text-slate-500">{selectedOrder.profiles?.email}</p>
                                    <p className="text-xs text-slate-500">{selectedOrder.profiles?.phone}</p>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs font-black uppercase text-slate-400 mb-2">Endereço de Entrega</h4>
                                    {selectedOrder.address_snapshot ? (
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                            {selectedOrder.address_snapshot.street_name}, {selectedOrder.address_snapshot.street_number}
                                            <br />
                                            {selectedOrder.address_snapshot.neighborhood}
                                            <br />
                                            {selectedOrder.address_snapshot.city} - {selectedOrder.address_snapshot.federal_unit}
                                            <br />
                                            CEP: {selectedOrder.address_snapshot.zip_code}
                                        </p>
                                    ) : (
                                        <p className="text-sm italic text-slate-400">Endereço não registrado.</p>
                                    )}
                                </div>
                            </div>

                            {/* Itens e Controle */}
                            <div className="space-y-4">
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs font-black uppercase text-slate-400 mb-2">Itens do Pedido</h4>
                                    <ul className="space-y-2">
                                        {selectedOrder.items_snapshot && selectedOrder.items_snapshot.length > 0 ? (
                                            selectedOrder.items_snapshot.map((item: any, idx: number) => (
                                                <li key={idx} className="flex justify-between text-sm">
                                                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{item.name}</span>
                                                    <span className="font-bold">R$ {item.price}</span>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="text-sm text-slate-400 italic">Lista de itens indisponível.</li>
                                        )}
                                        <li className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-700 font-black">
                                            <span>TOTAL</span>
                                            <span className="text-indigo-600">R$ {selectedOrder.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase text-slate-400">Atualizar Status</h4>
                                    
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Adicionar nota de rastreio (Ex: Entregador saiu)..."
                                        className="w-full p-3 text-sm border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        rows={2}
                                    />
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedOrder.status === 'processing' && (
                                            <button onClick={() => handleUpdateStatus('preparing')} disabled={isUpdating} className="py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors disabled:opacity-50">
                                                {isUpdating ? '...' : 'Iniciar Preparação'}
                                            </button>
                                        )}
                                        {selectedOrder.status === 'preparing' && (
                                            <button onClick={() => handleUpdateStatus('shipped')} disabled={isUpdating} className="py-2.5 bg-purple-600 text-white rounded-xl font-bold text-xs hover:bg-purple-700 transition-colors disabled:opacity-50">
                                                {isUpdating ? '...' : 'Marcar Enviado'}
                                            </button>
                                        )}
                                        {selectedOrder.status === 'shipped' && (
                                            <button onClick={() => handleUpdateStatus('out_for_delivery')} disabled={isUpdating} className="py-2.5 bg-orange-500 text-white rounded-xl font-bold text-xs hover:bg-orange-600 transition-colors disabled:opacity-50">
                                                {isUpdating ? '...' : 'Saiu para Entrega'}
                                            </button>
                                        )}
                                        {selectedOrder.status === 'out_for_delivery' && (
                                            <button onClick={() => handleUpdateStatus('delivered')} disabled={isUpdating} className="py-2.5 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 transition-colors disabled:opacity-50">
                                                {isUpdating ? '...' : 'Confirmar Entrega'}
                                            </button>
                                        )}
                                        {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                                            <button onClick={() => { if(confirm('Cancelar pedido?')) handleUpdateStatus('cancelled'); }} disabled={isUpdating} className="py-2.5 bg-red-100 text-red-600 rounded-xl font-bold text-xs hover:bg-red-200 transition-colors disabled:opacity-50">
                                                Cancelar Pedido
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 text-center">A atualização notificará o cliente automaticamente.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default OrdersManagerTab;
