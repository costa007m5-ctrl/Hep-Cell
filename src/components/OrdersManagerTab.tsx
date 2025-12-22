
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
    
    // Form States
    const [tempStatus, setTempStatus] = useState('');
    const [tempNotes, setTempNotes] = useState('');
    
    const [isUpdating, setIsUpdating] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin?action=get-orders');
            const data = await res.json();
            if (res.ok) {
                setOrders(Array.isArray(data) ? data : []);
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

    // Quando abre o modal, preenche os estados temporários
    useEffect(() => {
        if (selectedOrder) {
            setTempStatus(selectedOrder.status);
            setTempNotes(selectedOrder.tracking_notes || '');
            setMessage(null);
        }
    }, [selectedOrder]);

    const handleSaveChanges = async () => {
        if (!selectedOrder) return;
        setIsUpdating(true);
        setMessage(null);
        
        try {
            const res = await fetch('/api/admin?action=update-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    orderId: selectedOrder.id, 
                    status: tempStatus, 
                    notes: tempNotes 
                })
            });
            
            if (res.ok) {
                // Atualiza a lista localmente
                setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: tempStatus, tracking_notes: tempNotes } : o));
                // Atualiza o objeto selecionado para refletir a mudança
                setSelectedOrder(prev => prev ? { ...prev, status: tempStatus, tracking_notes: tempNotes } : null);
                
                setMessage({ text: "Pedido atualizado com sucesso!", type: 'success' });
            } else {
                throw new Error("Falha ao atualizar no servidor");
            }
        } catch (e) {
            setMessage({ text: "Erro ao salvar alterações.", type: 'error' });
        } finally {
            setIsUpdating(false);
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'processing': 'Aprovado / Processando',
            'preparing': 'Em Preparação',
            'shipped': 'Enviado (Em Trânsito)',
            'out_for_delivery': 'Saiu para Entrega',
            'delivered': 'Entregue',
            'cancelled': 'Cancelado',
            'pending': 'Pendente Pagamento'
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
            'cancelled': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
            'pending': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
        };
        return colors[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    };

    if (isLoading) return <div className="p-10 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Gestão de Pedidos</h2>
                <button onClick={fetchOrders} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" /></svg>
                </button>
            </div>
            
            {/* LISTA UNIFICADA (CARDS) */}
            <div className="grid grid-cols-1 gap-4">
                {orders.map(order => (
                    <div key={order.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden transition-all hover:border-indigo-200 dark:hover:border-slate-600">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(order.status)}`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">#{order.id.slice(0,6).toUpperCase()}</span>
                                </div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                    {order.profiles ? `${order.profiles.first_name} ${order.profiles.last_name}` : 'Usuário ' + order.user_id.slice(0,4)}
                                </p>
                                <p className="text-[11px] text-slate-500">{new Date(order.created_at).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total</p>
                                    <p className="text-base font-black text-indigo-600 dark:text-indigo-400">
                                        R$ {order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setSelectedOrder(order)}
                                    className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity shadow-lg"
                                >
                                    Gerenciar
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {orders.length === 0 && (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-slate-400 text-sm font-medium">Nenhum pedido encontrado.</p>
                    </div>
                )}
            </div>

            {/* MODAL DE EDIÇÃO */}
            {selectedOrder && (
                <Modal isOpen={true} onClose={() => setSelectedOrder(null)} maxWidth="max-w-2xl">
                    <div className="space-y-6 pb-safe">
                        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Editar Pedido</h3>
                                <p className="text-sm text-slate-500">ID: {selectedOrder.id}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>

                        {message && <Alert message={message.text} type={message.type} />}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Coluna Esquerda: Informações */}
                            <div className="space-y-4">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs font-black uppercase text-slate-400 mb-2">Cliente</h4>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        {selectedOrder.profiles?.first_name} {selectedOrder.profiles?.last_name}
                                    </p>
                                    <p className="text-xs text-slate-500">{selectedOrder.profiles?.email}</p>
                                    <p className="text-xs text-slate-500">{selectedOrder.profiles?.phone}</p>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs font-black uppercase text-slate-400 mb-2">Entrega</h4>
                                    {selectedOrder.address_snapshot ? (
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                            {selectedOrder.address_snapshot.street_name || selectedOrder.address_snapshot.street}, {selectedOrder.address_snapshot.street_number || selectedOrder.address_snapshot.number}
                                            <br />
                                            {selectedOrder.address_snapshot.neighborhood}
                                            <br />
                                            {selectedOrder.address_snapshot.city} - {selectedOrder.address_snapshot.federal_unit || selectedOrder.address_snapshot.uf}
                                            <br />
                                            CEP: {selectedOrder.address_snapshot.zip_code}
                                        </p>
                                    ) : (
                                        <p className="text-xs italic text-slate-400">Endereço não registrado.</p>
                                    )}
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs font-black uppercase text-slate-400 mb-2">Itens</h4>
                                    <ul className="space-y-2">
                                        {selectedOrder.items_snapshot && selectedOrder.items_snapshot.length > 0 ? (
                                            selectedOrder.items_snapshot.map((item: any, idx: number) => (
                                                <li key={idx} className="flex justify-between text-xs">
                                                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{item.name}</span>
                                                    <span className="font-bold">R$ {item.price}</span>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="text-xs text-slate-400 italic">Sem itens.</li>
                                        )}
                                        <li className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-700 font-black mt-2">
                                            <span>TOTAL</span>
                                            <span className="text-indigo-600">R$ {selectedOrder.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Coluna Direita: Ações */}
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 ml-1">Status Atual</label>
                                    <select 
                                        value={tempStatus} 
                                        onChange={(e) => setTempStatus(e.target.value)}
                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    >
                                        <option value="pending">Pendente (Aguardando Pagamento)</option>
                                        <option value="processing">Aprovado (Processando)</option>
                                        <option value="preparing">Em Preparação</option>
                                        <option value="shipped">Enviado / Em Trânsito</option>
                                        <option value="out_for_delivery">Saiu para Entrega</option>
                                        <option value="delivered">Entregue</option>
                                        <option value="cancelled">Cancelado</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 ml-1">Notas de Rastreio (Visível ao Cliente)</label>
                                    <textarea
                                        value={tempNotes}
                                        onChange={e => setTempNotes(e.target.value)}
                                        placeholder="Ex: Entregador João saiu para entrega. Código: BR123..."
                                        className="w-full p-3 h-32 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                    />
                                </div>

                                <button 
                                    onClick={handleSaveChanges}
                                    disabled={isUpdating}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all active:scale-[0.98]"
                                >
                                    {isUpdating ? <LoadingSpinner /> : 'SALVAR ALTERAÇÕES'}
                                </button>
                                
                                <p className="text-[10px] text-center text-slate-400">
                                    Ao salvar, o cliente receberá uma notificação no app.
                                </p>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default OrdersManagerTab;
