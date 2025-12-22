
// ... (Imports e Interfaces mantidos iguais ao arquivo original, apenas alterando OrdersView) ...
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import { Profile, Invoice, Contract } from '../types';
import LoadingSpinner from './LoadingSpinner';
import InputField from './InputField';
import { useToast } from './Toast';
import ReceiptDetails from './ReceiptDetails';
import Modal from './Modal';
import jsPDF from 'jspdf';
import SignaturePad from './SignaturePad'; 
import Confetti from './Confetti';

// ... (TERMS_TEXT, PRIVACY_TEXT, MenuItem, ToggleSwitch, StatBadge, OrderTrackingView, ContractsView mantidos iguais) ...
// ... (Para economizar espaço, vou replicar apenas o OrdersView modificado e o componente principal PagePerfil) ...

// --- INÍCIO CÓDIGO REPLICADO PARA CONTEXTO ---
interface PagePerfilProps {
    session: Session;
    toggleTheme?: () => void;
    isDarkMode?: boolean;
    onGoToAdmin?: () => void;
}

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; description?: string; onClick: () => void; colorClass?: string }> = ({ icon, label, description, onClick, colorClass = "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" }) => (
    <button onClick={onClick} className="w-full flex items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all active:scale-[0.98] group mb-3">
        <div className={`p-3 rounded-xl ${colorClass} group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
        <div className="ml-4 flex-1 text-left">
            <span className="block font-bold text-slate-800 dark:text-white text-sm">{label}</span>
            {description && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
    </button>
);

const StatBadge: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 w-full">
        <div className="text-indigo-500 mb-1">{icon}</div>
        <span className="font-bold text-slate-900 dark:text-white text-lg">{value}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{label}</span>
    </div>
);

const OrderTrackingView: React.FC<{ orderId: string; onBack: () => void }> = ({ orderId, onBack }) => {
    const [order, setOrder] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchOrder = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
                if (error) throw error;
                setOrder(data);
            } catch (e) {
                console.error(e);
                addToast("Erro ao carregar pedido.", "error");
                onBack();
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrder();
    }, [orderId]);

    if (isLoading) return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white dark:bg-slate-900"><LoadingSpinner /></div>;
    if (!order) return null;

    const steps = [
        { id: 'processing', label: 'Aprovado', icon: '📝', date: order.created_at },
        { id: 'preparing', label: 'Em Preparação', icon: '📦' },
        { id: 'shipped', label: 'Enviado', icon: '🚚' },
        { id: 'out_for_delivery', label: 'Saiu para Entrega', icon: '🛵' },
        { id: 'delivered', label: 'Entregue', icon: '🏠' }
    ];

    const currentStepIndex = steps.findIndex(s => s.id === order.status) !== -1 ? steps.findIndex(s => s.id === order.status) : 0;
    const isCompleted = order.status === 'delivered';
    const address = order.address_snapshot || {};
    const items = order.items_snapshot || [];

    return (
        <div className="fixed inset-0 z-[150] bg-slate-100 dark:bg-slate-950 flex justify-center animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full overflow-y-auto relative shadow-2xl flex flex-col">
                <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 p-4 flex items-center gap-3">
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-none">Rastreamento</h2>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">#{order.id.slice(0,8).toUpperCase()}</p>
                    </div>
                </div>
                <div className="p-6 space-y-8 pb-24">
                    <div className={`p-6 rounded-3xl text-white shadow-xl relative overflow-hidden ${isCompleted ? 'bg-green-600' : 'bg-indigo-600'}`}>
                        <div className="relative z-10">
                            <p className="text-xs font-bold uppercase opacity-80 mb-1">Status Atual</p>
                            <h3 className="text-2xl font-black">{steps[currentStepIndex]?.label || 'Em Processamento'}</h3>
                            <p className="text-sm mt-2 font-medium opacity-90">{order.tracking_notes || "Aguardando atualização..."}</p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 text-9xl opacity-20 transform rotate-12">{isCompleted ? '🏠' : '🚚'}</div>
                    </div>
                    <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-8 relative">
                        {steps.map((step, index) => {
                            const isActive = index <= currentStepIndex;
                            const isCurrent = index === currentStepIndex;
                            return (
                                <div key={step.id} className={`relative pl-6 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                    <div className={`absolute -left-[21px] top-0 w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center text-lg shadow-sm transition-all duration-500 ${isActive ? (isCompleted && index === steps.length - 1 ? 'bg-green-500 text-white' : 'bg-indigo-100 text-indigo-600') : 'bg-slate-100 text-slate-400'}`}>
                                        {step.icon}
                                    </div>
                                    <div className="pt-2">
                                        <h4 className={`font-bold text-sm ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{step.label}</h4>
                                        {index === 0 && <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString('pt-BR')} às {new Date(order.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>}
                                        {isCurrent && !isCompleted && (
                                            <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md animate-pulse">Em andamento</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="grid gap-4">
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="p-2 bg-orange-100 text-orange-600 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></span>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Endereço de Entrega</h4>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                {address.street || address.street_name}, {address.number || address.street_number}<br/>
                                {address.neighborhood}, {address.city} - {address.uf || address.federal_unit}<br/>
                                <span className="text-xs text-slate-400">CEP: {address.zip_code}</span>
                            </p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="p-2 bg-blue-100 text-blue-600 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg></span>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Itens do Pedido</h4>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {items.map((item: any, i: number) => (
                                    <div key={i} className="py-2 flex justify-between items-center text-sm">
                                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[70%]">{item.name}</span>
                                        <span className="text-slate-900 dark:text-white font-bold">R$ {item.price.toLocaleString('pt-BR')}</span>
                                    </div>
                                ))}
                                <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between font-bold">
                                    <span className="text-slate-900 dark:text-white">Total</span>
                                    <span className="text-indigo-600 dark:text-indigo-400">R$ {order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ContractsView: React.FC<{ profile: Profile }> = ({ profile }) => {
    // ... Mantido igual ao original ...
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [signingContract, setSigningContract] = useState<Contract | null>(null);
    const [signature, setSignature] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchContracts = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase.from('contracts').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
                if (error) throw error;
                setContracts(data || []);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchContracts();
    }, [profile.id]);

    const handleDownloadPDF = (contract: Contract) => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(contract.title || "CONTRATO", 105, 20, { align: 'center' });
        doc.setFontSize(10);
        const textToPrint = contract.items || "Conteúdo do contrato indisponível.";
        const splitText = doc.splitTextToSize(textToPrint, 180);
        doc.text(splitText, 15, 40);
        if (contract.signature_data) {
            const yPos = 40 + doc.getTextDimensions(splitText).h + 10;
            doc.addImage(contract.signature_data, 'PNG', 15, yPos, 60, 30);
            doc.text("Assinatura do Cliente", 15, yPos + 35);
        }
        doc.save(`Contrato_${contract.id.slice(0,8)}.pdf`);
    };

    const handleSignSubmit = async () => {
        if (!signingContract || !signature) return;
        setIsSubmitting(true);
        try {
            await supabase.from('contracts').update({ status: 'Assinado', signature_data: signature, terms_accepted: true }).eq('id', signingContract.id);
            await supabase.from('invoices').update({ status: 'Em aberto' }).eq('user_id', profile.id).eq('status', 'Aguardando Assinatura');
            addToast("Contrato assinado!", "success");
            setSigningContract(null);
        } catch (e) { addToast("Erro ao assinar.", "error"); } finally { setIsSubmitting(false); }
    };

    if (loading) return <div className="p-10 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            {contracts.map(contract => (
                <div key={contract.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{contract.title}</h4>
                            <p className="text-xs text-slate-500">{new Date(contract.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${contract.status === 'Assinado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{contract.status}</span>
                    </div>
                    {contract.status === 'pending_signature' ? (
                        <button onClick={() => setSigningContract(contract)} className="w-full py-2 bg-yellow-600 text-white rounded-lg text-xs font-bold">Assinar Agora</button>
                    ) : (
                        <button onClick={() => handleDownloadPDF(contract)} className="text-indigo-600 text-xs font-bold text-left">Baixar PDF</button>
                    )}
                </div>
            ))}
            <Modal isOpen={!!signingContract} onClose={() => setSigningContract(null)}>
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Assinar Contrato</h3>
                    <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-600 whitespace-pre-wrap">{signingContract?.items}</div>
                    <label className="block text-sm font-medium mb-2">Sua Assinatura:</label>
                    <SignaturePad onEnd={setSignature} />
                    <button onClick={handleSignSubmit} disabled={!signature || isSubmitting} className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-bold">{isSubmitting ? <LoadingSpinner /> : 'Confirmar'}</button>
                </div>
            </Modal>
        </div>
    );
};
// --- FIM CONTEXTO ---

// --- ORDERS VIEW ATUALIZADA ---
const OrdersView: React.FC<{ userId: string; onViewTracking: (id: string) => void }> = ({ userId, onViewTracking }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'active' | 'history'>('active');

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                // Busca TODOS os pedidos para garantir que o cliente veja o histórico completo
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                
                if (!error && data) setOrders(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [userId]);

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'delivered': return <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">✅ Entregue</span>;
            case 'shipped': return <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">🚚 Enviado</span>;
            case 'out_for_delivery': return <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">🛵 Saiu p/ Entrega</span>;
            case 'preparing': return <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">📦 Preparando</span>;
            case 'processing': return <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">⚙️ Processando</span>;
            case 'pending': return <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">⏳ Pendente</span>;
            case 'cancelled': return <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">❌ Cancelado</span>;
            default: return <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Status: {status}</span>;
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><LoadingSpinner /></div>;

    // Filtros ABRANGENTES para garantir que o pedido apareça
    const activeOrders = orders.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status));
    const historyOrders = orders.filter(o => ['delivered', 'cancelled', 'rejected'].includes(o.status));
    
    const displayOrders = filter === 'active' ? activeOrders : historyOrders;

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-4">
                <button 
                    onClick={() => setFilter('active')} 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'active' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                    Em Andamento ({activeOrders.length})
                </button>
                <button 
                    onClick={() => setFilter('history')} 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'history' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                    Histórico ({historyOrders.length})
                </button>
            </div>

            {displayOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum pedido aqui</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{filter === 'active' ? 'Você não tem pedidos em andamento.' : 'Nenhum pedido finalizado.'}</p>
                </div>
            ) : (
                displayOrders.map(order => {
                    const items = order.items_snapshot || [];
                    // Permite rastrear qualquer pedido ativo que não esteja pendente de pagamento apenas
                    const canTrack = order.status !== 'pending' && order.status !== 'cancelled';
                    
                    return (
                        <div key={order.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                            {/* Status Bar Indicator */}
                            <div className={`absolute top-0 left-0 w-1 h-full ${order.status === 'processing' ? 'bg-blue-500' : order.status === 'pending' ? 'bg-yellow-500' : 'bg-indigo-500'}`}></div>
                            
                            <div className="flex justify-between items-start mb-4 pl-2">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Pedido #{order.id.slice(0,6).toUpperCase()}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{new Date(order.created_at).toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'})}</p>
                                </div>
                                {getStatusBadge(order.status)}
                            </div>
                            
                            <div className="space-y-3 py-3 border-t border-b border-slate-50 dark:border-slate-700/50 pl-2">
                                {items.length > 0 ? items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm items-center">
                                        <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[200px]">{item.name || 'Produto'}</span>
                                        <span className="text-slate-500 dark:text-slate-400">R$ {item.price}</span>
                                    </div>
                                )) : <p className="text-sm text-slate-500 italic">Detalhes indisponíveis</p>}
                            </div>
                            
                            <div className="flex justify-between items-center mt-4 pl-2">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total</p>
                                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                        {order.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                                {canTrack && (
                                    <button 
                                        onClick={() => onViewTracking(order.id)}
                                        className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                        Rastrear
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })
            )}
        </div>
    );
};

// ... (PersonalDataView e outros componentes mantidos iguais) ...
const PersonalDataView: React.FC<{ profile: Profile; onUpdate: (p: Profile) => void }> = ({ profile, onUpdate }) => {
    const [formData, setFormData] = useState(profile);
    const [isSaving, setIsSaving] = useState(false);
    const { addToast } = useToast();

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateProfile(formData);
            onUpdate(formData);
            addToast("Dados atualizados com sucesso!", "success");
        } catch (e) {
            addToast("Erro ao atualizar dados.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 p-4">
            <h3 className="font-bold text-lg dark:text-white">Meus Dados</h3>
            <div className="space-y-4">
                <InputField label="Nome" name="first_name" value={formData.first_name || ''} onChange={e => setFormData({...formData, first_name: e.target.value})} />
                <InputField label="Sobrenome" name="last_name" value={formData.last_name || ''} onChange={e => setFormData({...formData, last_name: e.target.value})} />
                <InputField label="CPF" name="cpf" value={formData.identification_number || ''} onChange={e => setFormData({...formData, identification_number: e.target.value})} />
                <InputField label="Telefone" name="phone" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                
                <div className="pt-4 border-t dark:border-slate-700">
                    <h4 className="font-bold mb-3 dark:text-white">Endereço de Entrega</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <InputField label="CEP" name="zip_code" value={formData.zip_code || ''} onChange={e => setFormData({...formData, zip_code: e.target.value})} />
                        <InputField label="Número" name="number" value={formData.street_number || ''} onChange={e => setFormData({...formData, street_number: e.target.value})} />
                    </div>
                    <InputField label="Rua" name="street" value={formData.street_name || ''} onChange={e => setFormData({...formData, street_name: e.target.value})} />
                    <InputField label="Bairro" name="neighborhood" value={formData.neighborhood || ''} onChange={e => setFormData({...formData, neighborhood: e.target.value})} />
                    <div className="grid grid-cols-2 gap-3">
                        <InputField label="Cidade" name="city" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} />
                        <InputField label="Estado" name="uf" value={formData.federal_unit || ''} onChange={e => setFormData({...formData, federal_unit: e.target.value})} />
                    </div>
                </div>

                <button onClick={handleSave} disabled={isSaving} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold mt-4">
                    {isSaving ? <LoadingSpinner /> : 'Salvar Alterações'}
                </button>
            </div>
        </div>
    );
};

const SecurityView: React.FC = () => {
    const { addToast } = useToast();
    
    const handleResetPassword = async () => {
        const email = prompt("Confirme seu email para receber o link:");
        if (email) {
            await supabase.auth.resetPasswordForEmail(email);
            addToast("Email de redefinição enviado!", "success");
        }
    };

    return (
        <div className="space-y-6 p-4">
            <h3 className="font-bold text-lg dark:text-white">Segurança</h3>
            <div className="space-y-4">
                <button onClick={handleResetPassword} className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Trocar Senha</span>
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <button onClick={() => addToast("Função em desenvolvimento", "info")} className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Autenticação em 2 Fatores</span>
                    <span className="text-xs bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded">Em Breve</span>
                </button>
                <button onClick={() => addToast("Desconectado de outros dispositivos", "success")} className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-red-600 font-medium">Sair de todos os dispositivos</span>
                </button>
            </div>
        </div>
    );
};

const HelpView: React.FC = () => {
    return (
        <div className="space-y-6 p-4">
            <h3 className="font-bold text-lg dark:text-white">Central de Ajuda</h3>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => window.open('https://wa.me/5596991000000', '_blank')} className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl flex flex-col items-center gap-2">
                    <span className="text-2xl">💬</span>
                    <span className="font-bold text-green-700 dark:text-green-300">WhatsApp</span>
                </button>
                <button onClick={() => window.location.href = 'mailto:suporte@relpcell.com'} className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 rounded-xl flex flex-col items-center gap-2">
                    <span className="text-2xl">📧</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-300">Email</span>
                </button>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700">
                <h4 className="font-bold mb-2 dark:text-white">Perguntas Frequentes</h4>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <details className="cursor-pointer"><summary>Como aumentar meu limite?</summary><p className="mt-1 pl-4">Pague suas faturas em dia e use o app frequentemente.</p></details>
                    <details className="cursor-pointer"><summary>Onde vejo meus contratos?</summary><p className="mt-1 pl-4">Na aba 'Meus Contratos' dentro do perfil.</p></details>
                </div>
            </div>
        </div>
    );
};

const WalletView: React.FC<{ userId: string }> = ({ userId }) => <div className="p-4 text-center">Carteira em desenvolvimento.</div>;
const SettingsView: React.FC<{ toggleTheme?: () => void; isDarkMode?: boolean; userId: string }> = ({ toggleTheme }) => <div className="p-4 text-center">Configurações em desenvolvimento.</div>;
const ReferralView: React.FC<{ userId: string }> = ({ userId }) => <div className="p-4 text-center">Indicações em desenvolvimento.</div>;
const FiscalNotesView: React.FC<{ userId: string }> = ({ userId }) => <div className="p-4 text-center">Notas em desenvolvimento.</div>;

const PagePerfil: React.FC<PagePerfilProps> = ({ session, toggleTheme, isDarkMode, onGoToAdmin }) => {
    const [activeView, setActiveView] = useState<'main' | 'data' | 'orders' | 'tracking' | 'wallet' | 'addresses' | 'settings' | 'referral' | 'help' | 'contracts' | 'fiscal_notes' | 'security'>('main');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    // ID do Administrador
    const ADMIN_ID = '1da77e27-f1df-4e35-bcec-51dc2c5a9062';
    const isAdmin = session.user.id === ADMIN_ID;

    useEffect(() => {
        const load = async () => {
            try {
                const p = await getProfile(session.user.id);
                if(p) setProfile({...p, id: session.user.id, email: session.user.email});
                
                // Verifica se há pedido de rastreamento pendente da Home
                const trackId = sessionStorage.getItem('relp_open_tracking_id');
                if (trackId) {
                    setTrackingOrderId(trackId);
                    setActiveView('tracking');
                    sessionStorage.removeItem('relp_open_tracking_id');
                } else {
                    // Verifica sections normais
                    const section = sessionStorage.getItem('relp_profile_section');
                    if (section) {
                        setActiveView(section as any); 
                        sessionStorage.removeItem('relp_profile_section'); 
                    }
                }

            } catch(e) { console.error(e); } 
            finally { setIsLoading(false); }
        };
        load();
    }, [session]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                setProfile(prev => prev ? { ...prev, avatar_url: base64 } : null);
                if(profile) await updateProfile({ ...profile, id: session.user.id, avatar_url: base64 });
                addToast('Foto atualizada!', 'success');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('relp_cart');
        localStorage.removeItem('isAdminLoggedIn');
        window.location.reload();
    }

    if (isLoading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;

    // Se estiver no modo de rastreamento e tiver ID, renderiza direto (tela cheia)
    if (activeView === 'tracking' && trackingOrderId) {
        return <OrderTrackingView orderId={trackingOrderId} onBack={() => { setActiveView('orders'); setTrackingOrderId(null); }} />;
    }

    const renderHeader = () => (
        <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 text-white p-8 shadow-2xl mb-8">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full opacity-20 blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-600 rounded-full opacity-20 blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

             <div className="relative z-10 flex items-center gap-6">
                <div className="relative group" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden shadow-2xl bg-slate-800 transition-transform active:scale-95">
                         {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white">{profile?.first_name?.[0] || 'U'}</div>}
                    </div>
                    <div className="absolute bottom-1 right-1 bg-indigo-500 p-2 rounded-full border-2 border-slate-900 cursor-pointer shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*"/>
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-2xl font-black truncate">{profile?.first_name} {profile?.last_name}</h2>
                    </div>
                    <p className="text-slate-400 text-sm mb-4 truncate opacity-80">{session.user.email}</p>
                    <div className="flex gap-2">
                         <span className="px-3 py-1 bg-yellow-500 text-yellow-900 text-[10px] font-black rounded-full shadow-sm">CLIENTE RELP</span>
                         {isAdmin && <span className="px-3 py-1 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm">ROOT ADMIN</span>}
                    </div>
                </div>
             </div>
        </div>
    );

    return (
        <div className="w-full max-w-md p-4 mx-auto pb-24 font-sans">
            {activeView === 'main' ? (
                <div className="animate-fade-in">
                    {renderHeader()}

                    <div className="grid grid-cols-3 gap-3 mb-8">
                        <StatBadge label="Score" value={profile?.credit_score || 0} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
                        <StatBadge label="Coins" value={profile?.coins_balance || 0} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2" /></svg>} />
                        <StatBadge label="Docs" value="OK" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-black text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] mb-2 px-1">Minha Conta</h3>
                        
                        {isAdmin && onGoToAdmin && (
                            <button 
                                onClick={onGoToAdmin}
                                className="w-full flex items-center p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 hover:shadow-lg transition-all active:scale-[0.98] group mb-6"
                            >
                                <div className="p-3 rounded-xl bg-red-600 text-white shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                </div>
                                <div className="ml-4 text-left">
                                    <span className="block font-black text-red-600 dark:text-red-400 text-sm uppercase">Painel de Controle</span>
                                    <span className="block text-[10px] text-red-400 mt-0.5">Acesso Restrito ao Administrador</span>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-300 ml-auto" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                            </button>
                        )}

                        <MenuItem label="Meus Pedidos" description="Acompanhe suas compras" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>} onClick={() => setActiveView('orders')} />
                        <MenuItem label="Meus Dados" description="Nome, CPF e Endereço" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>} onClick={() => setActiveView('data')} />
                        <MenuItem label="Meus Contratos" description="Documentos assinados" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} onClick={() => setActiveView('contracts')} />
                        
                        <h3 className="font-black text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] mb-2 mt-8 px-1">Segurança e App</h3>
                        <MenuItem label="Segurança" description="Senha e Acesso" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>} onClick={() => setActiveView('security')} />
                        <MenuItem label="Ajuda e Suporte" description="Fale Conosco" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} onClick={() => setActiveView('help')} />
                        
                        <button onClick={handleLogout} className="w-full mt-6 py-4 border border-red-200 dark:border-red-900/30 text-red-600 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors">
                            Sair da Conta
                        </button>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <button onClick={() => setActiveView('main')} className="flex items-center text-slate-500 mb-6 font-bold hover:text-indigo-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Voltar
                    </button>
                    {activeView === 'data' && profile && <PersonalDataView profile={profile} onUpdate={(p) => setProfile(p)} />}
                    {activeView === 'orders' && <OrdersView userId={session.user.id} onViewTracking={(id) => { setTrackingOrderId(id); setActiveView('tracking'); }} />}
                    {activeView === 'wallet' && <WalletView userId={session.user.id} />}
                    {activeView === 'security' && <SecurityView />}
                    {activeView === 'settings' && <SettingsView toggleTheme={toggleTheme} isDarkMode={isDarkMode} userId={session.user.id} />}
                    {activeView === 'referral' && <ReferralView userId={session.user.id} />}
                    {activeView === 'help' && <HelpView />}
                    {activeView === 'contracts' && profile && <ContractsView profile={profile} />}
                    {activeView === 'fiscal_notes' && <FiscalNotesView userId={session.user.id} />}
                </div>
            )}
        </div>
    );
};

export default PagePerfil;
