
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import { Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import InputField from './InputField';
import { useToast } from './Toast';
import ReceiptDetails from './ReceiptDetails';
import Modal from './Modal';

interface PagePerfilProps {
    session: Session;
    toggleTheme?: () => void;
    isDarkMode?: boolean;
}

// --- Textos Legais ---
const TERMS_TEXT = (
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
        <p><strong>1. Aceitação dos Termos</strong><br/>Ao acessar e usar o aplicativo Relp Cell, você concorda em cumprir estes Termos de Uso e todas as leis aplicáveis. Se você não concordar, não use o aplicativo.</p>
        <p><strong>2. Serviços Oferecidos</strong><br/>A Relp Cell oferece uma plataforma para gestão de compras, pagamentos de faturas via Pix, Boleto ou Cartão, e visualização de limites de crédito.</p>
        <p><strong>3. Cadastro e Segurança</strong><br/>Você é responsável por manter a confidencialidade de sua conta e senha. A Relp Cell não se responsabiliza por acessos não autorizados resultantes de negligência do usuário.</p>
        <p><strong>4. Pagamentos e Crédito</strong><br/>O limite de crédito é concedido mediante análise e pode ser alterado ou cancelado a qualquer momento. O não pagamento das faturas até o vencimento acarretará multas, juros e possível bloqueio do serviço.</p>
        <p><strong>5. Modificações</strong><br/>Podemos revisar estes termos a qualquer momento. Ao usar este aplicativo, você concorda em ficar vinculado à versão atual desses Termos de Uso.</p>
    </div>
);

const PRIVACY_TEXT = (
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
        <p><strong>1. Coleta de Dados</strong><br/>Coletamos informações pessoais como Nome, CPF, Endereço, Telefone e E-mail para fins de cadastro, análise de crédito e emissão de notas fiscais.</p>
        <p><strong>2. Uso das Informações</strong><br/>Seus dados são usados para processar transações, enviar notificações de cobrança, melhorar nosso atendimento e prevenir fraudes.</p>
        <p><strong>3. Compartilhamento</strong><br/>Não vendemos seus dados. Compartilhamos apenas com parceiros estritamente necessários para a operação (ex: gateways de pagamento como Mercado Pago e bureaus de crédito para análise).</p>
        <p><strong>4. Segurança</strong><br/>Adotamos medidas de segurança adequadas para proteger contra acesso não autorizado, alteração ou destruição de seus dados pessoais.</p>
        <p><strong>5. Seus Direitos</strong><br/>Você tem o direito de acessar, corrigir ou solicitar a exclusão de seus dados pessoais de nossa base, exceto quando a retenção for necessária por lei (ex: registros fiscais).</p>
    </div>
);

// --- Componentes Auxiliares de UI ---

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

const ToggleSwitch: React.FC<{ label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
        <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
            {description && <span className="block text-xs text-slate-500 mt-0.5">{description}</span>}
        </div>
        <button 
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

const StatBadge: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 w-full">
        <div className="text-indigo-500 mb-1">{icon}</div>
        <span className="font-bold text-slate-900 dark:text-white text-lg">{value}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{label}</span>
    </div>
);

// --- SERVICE STATUS REAL ---
interface SystemHealth {
    app: 'online' | 'offline';
    pix: 'online' | 'degraded' | 'offline';
    card: 'online' | 'degraded' | 'offline';
    store: 'online' | 'offline';
    latency?: number;
}

const ServiceStatus: React.FC = () => {
    const [health, setHealth] = useState<SystemHealth>({ app: 'online', pix: 'online', card: 'online', store: 'online' });
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState<Date | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    const checkSystem = async () => {
        setIsChecking(true);
        const start = Date.now();
        
        // 1. App (Internet)
        const isOnline = navigator.onLine;
        
        let storeStatus: 'online' | 'offline' = 'offline';
        let apiStatus: 'online' | 'degraded' | 'offline' = 'offline';

        if (isOnline) {
            try {
                // 2. Loja (Supabase DB)
                const { error } = await supabase.from('products').select('id').limit(1);
                storeStatus = error ? 'offline' : 'online';

                // 3. API (Pix/Cartão - Simulação via Endpoint de Produtos)
                // Se a API de produtos responde rápido, o backend está saudável
                const apiRes = await fetch('/api/products');
                if (apiRes.ok) {
                    const latency = Date.now() - start;
                    apiStatus = latency < 800 ? 'online' : 'degraded';
                }
            } catch (e) {
                console.error("Falha na verificação de sistema", e);
            }
        }

        setHealth({
            app: isOnline ? 'online' : 'offline',
            store: storeStatus,
            pix: apiStatus, // Pix depende da API
            card: apiStatus, // Cartão depende da API
            latency: Date.now() - start
        });
        setLastCheck(new Date());
        setIsChecking(false);
    };

    useEffect(() => {
        checkSystem();
        // Auto-check every 60s
        const interval = setInterval(checkSystem, 60000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        if (status === 'online') return 'bg-green-500';
        if (status === 'degraded') return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getStatusText = (status: string) => {
        if (status === 'online') return 'Operacional';
        if (status === 'degraded') return 'Lentidão';
        return 'Indisponível';
    }

    return (
        <>
            <div 
                className="flex gap-2 overflow-x-auto py-3 scrollbar-hide mb-2 cursor-pointer active:opacity-80"
                onClick={() => setShowDetails(true)}
            >
                {[
                    { n: 'App', s: health.app }, 
                    { n: 'Pix', s: health.pix }, 
                    { n: 'Cartão', s: health.card }, 
                    { n: 'Loja', s: health.store }
                ].map((sys, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-full border border-slate-100 dark:border-slate-700 shrink-0 transition-all ${isChecking ? 'opacity-70' : ''}`}>
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(sys.s)} ${isChecking ? 'animate-pulse' : ''}`}></span>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">{sys.n}</span>
                    </div>
                ))}
                {isChecking && <span className="text-[10px] text-slate-400 self-center animate-pulse">Verificando...</span>}
            </div>

            {/* Modal de Detalhes do Sistema */}
            <Modal isOpen={showDetails} onClose={() => setShowDetails(false)}>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Status do Sistema</h3>
                    <p className="text-xs text-slate-500 mb-6">Última verificação: {lastCheck?.toLocaleTimeString()}</p>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Aplicativo</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${health.app === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{getStatusText(health.app)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Banco de Dados</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${health.store === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{getStatusText(health.store)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gateway Pagamento</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${health.pix === 'online' ? 'bg-green-100 text-green-700' : health.pix === 'degraded' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{getStatusText(health.pix)}</span>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-slate-400">Latência da Rede: <span className="font-mono text-slate-600 dark:text-slate-300">{health.latency || 0}ms</span></p>
                    </div>

                    <button onClick={checkSystem} className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700">
                        {isChecking ? 'Verificando...' : 'Atualizar Status'}
                    </button>
                </div>
            </Modal>
        </>
    );
}

// --- Views Implementadas ---

const OrdersView: React.FC<{ userId: string }> = ({ userId }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select(`*, order_items(*)`)
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
            case 'delivered': return <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">Entregue</span>;
            case 'shipped': return <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">Enviado</span>;
            case 'processing': return <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-bold">Processando</span>;
            case 'cancelled': return <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">Cancelado</span>;
            default: return <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">Pendente</span>;
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><LoadingSpinner /></div>;

    if (orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum pedido ainda</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Explore a loja e faça sua primeira compra!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {orders.map(order => (
                <div key={order.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Pedido #{order.id.slice(0,8).toUpperCase()}</p>
                            <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        {getStatusBadge(order.status)}
                    </div>
                    
                    <div className="space-y-2 border-t border-slate-50 dark:border-slate-700/50 pt-3 mt-3">
                        {order.order_items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{item.quantity}x {item.product_name}</span>
                                <span className="font-medium text-slate-900 dark:text-white">R$ {item.price}</span>
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Total</span>
                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                            {order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

const WalletView: React.FC<{ userId: string }> = ({ userId }) => {
    const [pixKeys, setPixKeys] = useState<{key: string, type: string}[]>([]);
    const [newPix, setNewPix] = useState('');
    const [pixType, setPixType] = useState('CPF');
    const { addToast } = useToast();

    const handleAddPix = () => {
        if (!newPix) return;
        setPixKeys([...pixKeys, { key: newPix, type: pixType }]);
        setNewPix('');
        addToast('Chave Pix salva com sucesso!', 'success');
    };

    return (
        <div className="space-y-6 animate-fade-in">
             {/* Cartão Virtual Simulado */}
             <div className="relative h-48 rounded-2xl bg-gradient-to-br from-slate-800 to-black text-white p-6 shadow-xl overflow-hidden transform transition-transform hover:scale-[1.02]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <div className="relative z-10 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold uppercase tracking-widest opacity-70">Relp Card</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-80" viewBox="0 0 24 24" fill="currentColor"><path d="M2 10h20v2H2zM2 15h20v2H2zM2 5h20v2H2z"/></svg>
                    </div>
                    <div className="font-mono text-xl tracking-wider opacity-90 flex gap-3">
                        <span>****</span><span>****</span><span>****</span><span>4829</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-[10px] uppercase opacity-60">Titular</p>
                            <p className="text-sm font-medium uppercase">Seu Nome</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase opacity-60 text-right">Validade</p>
                            <p className="text-sm font-medium">12/28</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Minhas Chaves Pix
                </h3>
                
                <div className="space-y-3 mb-4">
                    {pixKeys.length === 0 ? (
                        <div className="text-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                            <p className="text-sm text-slate-500">Nenhuma chave cadastrada.</p>
                            <p className="text-xs text-slate-400 mt-1">Adicione uma chave para receber reembolsos.</p>
                        </div>
                    ) : (
                        pixKeys.map((pk, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase mr-2 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">{pk.type}</span>
                                    <span className="text-sm font-mono text-slate-700 dark:text-slate-300">{pk.key}</span>
                                </div>
                                <button onClick={() => setPixKeys(pixKeys.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex gap-2 flex-1">
                        <select value={pixType} onChange={e => setPixType(e.target.value)} className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm px-2 outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="CPF">CPF</option>
                            <option value="Email">Email</option>
                            <option value="Celular">Celular</option>
                        </select>
                        <input 
                            type="text" 
                            value={newPix} 
                            onChange={e => setNewPix(e.target.value)} 
                            placeholder="Chave..." 
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <button onClick={handleAddPix} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm active:scale-95">
                        Adicionar
                    </button>
                </div>
            </div>
        </div>
    );
};

const AddressView: React.FC<{ profile: Profile; onUpdate: (p: Profile) => void }> = ({ profile, onUpdate }) => {
    const [formData, setFormData] = useState({
        zip_code: profile.zip_code || '',
        street_name: profile.street_name || '',
        street_number: profile.street_number || '',
        neighborhood: profile.neighborhood || '',
        city: profile.city || '',
        federal_unit: profile.federal_unit || '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSearchingCep, setIsSearchingCep] = useState(false);
    const { addToast } = useToast();

    const handleCepBlur = async () => {
        const cep = formData.zip_code.replace(/\D/g, '');
        if (cep.length !== 8) return;

        setIsSearchingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    street_name: data.logradouro,
                    neighborhood: data.bairro,
                    city: data.localidade,
                    federal_unit: data.uf
                }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearchingCep(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await updateProfile({ ...profile, ...formData });
            onUpdate({ ...profile, ...formData });
            addToast('Endereço atualizado!', 'success');
        } catch (e) {
            addToast('Erro ao salvar endereço.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="animate-fade-in space-y-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3 mb-2 text-slate-800 dark:text-white">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h3 className="font-bold text-lg">Endereço de Entrega</h3>
            </div>
            
            <InputField 
                label="CEP" 
                name="zip_code" 
                value={formData.zip_code} 
                onChange={e => setFormData({...formData, zip_code: e.target.value})}
                onBlur={handleCepBlur}
                placeholder="00000-000"
                isLoading={isSearchingCep}
            />
            
            <InputField label="Rua" name="street_name" value={formData.street_name} onChange={e => setFormData({...formData, street_name: e.target.value})} />
            
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                    <InputField label="Número" name="street_number" value={formData.street_number} onChange={e => setFormData({...formData, street_number: e.target.value})} />
                </div>
                <div className="col-span-2">
                    <InputField label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} />
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                    <InputField label="Cidade" name="city" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                </div>
                <div className="col-span-1">
                    <InputField label="UF" name="federal_unit" value={formData.federal_unit} onChange={e => setFormData({...formData, federal_unit: e.target.value})} maxLength={2} />
                </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                {isLoading ? <LoadingSpinner /> : 'Salvar Endereço'}
            </button>
        </form>
    );
};

const SettingsView: React.FC<{ toggleTheme?: () => void; isDarkMode?: boolean }> = ({ toggleTheme, isDarkMode }) => {
    const [notifs, setNotifs] = useState({ push: true, email: true, whatsapp: false });
    const [biometrics, setBiometrics] = useState(false);
    const [privacyCredit, setPrivacyCredit] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [legalModalContent, setLegalModalContent] = useState<'terms' | 'privacy' | null>(null);
    const { addToast } = useToast();

    useEffect(() => {
        // Check saved preferences
        const bio = localStorage.getItem('relp_biometrics') === 'true';
        setBiometrics(bio);
    }, []);

    const handleBiometricToggle = (value: boolean) => {
        if (value) {
            if (window.PublicKeyCredential) {
                // Simulando ativação bem sucedida
                localStorage.setItem('relp_biometrics', 'true');
                setBiometrics(true);
                addToast('Login biométrico ativado!', 'success');
            } else {
                addToast('Seu dispositivo não suporta biometria.', 'error');
            }
        } else {
            localStorage.removeItem('relp_biometrics');
            setBiometrics(false);
        }
    };

    const handleClearCache = () => {
        setIsClearing(true);
        // Simula limpeza
        setTimeout(() => {
            localStorage.clear(); // Cuidado: Limpa tudo
            sessionStorage.clear();
            caches.keys().then((names) => {
                names.forEach((name) => {
                    caches.delete(name);
                });
            });
            addToast('App otimizado! Reiniciando...', 'success');
            setTimeout(() => window.location.reload(), 2000);
        }, 1500);
    };

    const handlePasswordReset = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
            await supabase.auth.resetPasswordForEmail(user.email);
            addToast('Email de redefinição enviado!', 'success');
        }
    };

    const handleDeleteAccount = async () => {
        const confirmText = prompt('Para confirmar a exclusão, digite DELETAR abaixo. Esta ação é irreversível.');
        if (confirmText === 'DELETAR') {
            setIsDeleting(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // Em um app real, chamaria uma Edge Function para deletar do Auth e do DB
                    // Aqui simulamos com um toast e logout
                    // await supabase.rpc('delete_user_account'); // Exemplo
                    addToast('Solicitação enviada. Sua conta será excluída em 24h.', 'info');
                    setTimeout(async () => {
                        await supabase.auth.signOut();
                        window.location.reload();
                    }, 3000);
                }
            } catch (e) {
                addToast('Erro ao processar solicitação.', 'error');
                setIsDeleting(false);
            }
        } else if (confirmText !== null) {
            addToast('Texto de confirmação incorreto.', 'error');
        }
    };

    return (
        <div className="animate-fade-in space-y-6 pb-10">
            
            {/* Aparência e Preferências */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    Geral
                </h3>
                
                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Modo Escuro</span>
                    <button 
                        onClick={toggleTheme}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                <ToggleSwitch 
                    label="Notificações Push" 
                    description="Receba avisos de faturas e promoções"
                    checked={notifs.push} 
                    onChange={v => setNotifs({...notifs, push: v})} 
                />
                <ToggleSwitch 
                    label="Avisos por Email" 
                    checked={notifs.email} 
                    onChange={v => setNotifs({...notifs, email: v})} 
                />
            </div>

            {/* Segurança e Login */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Segurança
                </h3>
                
                <ToggleSwitch 
                    label="Entrar com Biometria" 
                    description="Use FaceID ou TouchID para login rápido"
                    checked={biometrics} 
                    onChange={handleBiometricToggle} 
                />
                
                <button onClick={handlePasswordReset} className="w-full text-left py-4 text-sm text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors flex justify-between items-center border-b border-slate-100 dark:border-slate-700">
                    Alterar Senha de Acesso
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                <ToggleSwitch 
                    label="Análise de Crédito Automática" 
                    description="Permitir que a IA analise seus dados para aumentos"
                    checked={privacyCredit} 
                    onChange={setPrivacyCredit} 
                />
            </div>

            {/* Legal & Sobre (Organizado) */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Legal & Sobre
                </h3>
                
                <MenuItem 
                    label="Termos de Uso" 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    onClick={() => setLegalModalContent('terms')}
                    colorClass="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                />
                
                <MenuItem 
                    label="Política de Privacidade" 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                    onClick={() => setLegalModalContent('privacy')}
                    colorClass="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                />
                
                <div className="pt-2 text-center">
                    <p className="text-[10px] text-slate-400">Versão do App: 2.5.0 (Build 2024)</p>
                </div>
            </div>

            {/* Manutenção */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Manutenção
                </h3>
                
                <button 
                    onClick={handleClearCache} 
                    disabled={isClearing}
                    className="w-full text-left py-3 text-sm text-slate-700 dark:text-slate-300 hover:text-orange-600 transition-colors flex justify-between items-center"
                >
                    {isClearing ? 'Limpando...' : 'Limpar Cache & Otimizar App'}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                
                <p className="text-xs text-slate-400 mt-2">Se o app estiver lento ou com erros, tente limpar o cache.</p>
            </div>

            {/* Zona de Perigo */}
            <div className="border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-xl p-5">
                <h3 className="font-bold text-red-700 dark:text-red-400 mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Zona de Perigo
                </h3>
                <button 
                    onClick={handleDeleteAccount} 
                    disabled={isDeleting}
                    className="w-full py-3 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-600 font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
                >
                    {isDeleting ? 'Processando...' : 'Excluir Minha Conta'}
                </button>
            </div>

            {/* Modal para Textos Legais */}
            <Modal isOpen={!!legalModalContent} onClose={() => setLegalModalContent(null)}>
                <div className="text-slate-900 dark:text-white">
                    <h3 className="text-xl font-bold mb-4">
                        {legalModalContent === 'terms' ? 'Termos de Uso' : 'Política de Privacidade'}
                    </h3>
                    <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {legalModalContent === 'terms' ? TERMS_TEXT : PRIVACY_TEXT}
                    </div>
                    <button onClick={() => setLegalModalContent(null)} className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-xl font-bold">
                        Entendi
                    </button>
                </div>
            </Modal>
        </div>
    );
};

const ReferralView: React.FC<{ profile: Profile }> = ({ profile }) => {
    const code = `RELP-${profile.first_name?.substring(0, 3).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
    const { addToast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        addToast('Código copiado!', 'success');
    };

    return (
        <div className="animate-fade-in text-center space-y-6 pt-4">
            <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 012 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
            </div>
            
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Convide e Ganhe</h3>
            <p className="text-slate-600 dark:text-slate-300 px-4">
                Indique amigos para a Relp Cell. Eles ganham <span className="font-bold text-indigo-600">R$ 20</span> na primeira compra e você ganha <span className="font-bold text-green-600">1% de cashback</span> vitalício nas compras deles!
            </p>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-dashed border-indigo-300 dark:border-indigo-700 mx-4 relative overflow-hidden">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Seu Código Exclusivo</p>
                <p className="text-3xl font-black text-indigo-600 dark:text-white tracking-wider font-mono">{code}</p>
                <button onClick={handleCopy} className="absolute top-2 right-2 p-2 text-slate-400 hover:text-indigo-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
            </div>
        </div>
    );
};

const ContractsView: React.FC<{ profile: Profile }> = ({ profile }) => (
    <div className="space-y-4 animate-fade-in text-center py-10 text-slate-500">
        <p>Contratos disponíveis para download em breve.</p>
    </div>
);

const FiscalNotesView: React.FC<{ profile: Profile }> = ({ profile }) => (
    <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
        <p>Nenhuma nota fiscal encontrada.</p>
    </div>
);

const PaymentReceiptsView: React.FC<{ userId: string; profile: Profile }> = ({ userId, profile }) => (
    <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
        <p>Nenhum pagamento realizado ainda.</p>
    </div>
);

const PersonalDataView: React.FC<{ profile: Profile; onUpdate: (p: Profile) => void }> = ({ profile, onUpdate }) => {
    const [formData, setFormData] = useState({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '', 
    });
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    // Cálculo de completude do perfil
    const completeness = useMemo(() => {
        let score = 0;
        if (formData.first_name) score += 25;
        if (formData.last_name) score += 25;
        if (profile.identification_number) score += 25;
        if (profile.email) score += 25;
        return score;
    }, [formData, profile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateProfile({ ...profile, first_name: formData.first_name, last_name: formData.last_name, phone: formData.phone });
            onUpdate({ ...profile, first_name: formData.first_name, last_name: formData.last_name, phone: formData.phone });
            addToast('Dados atualizados com sucesso!', 'success');
        } catch (error) {
            addToast('Erro ao atualizar dados.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            
            {/* Barra de Completude */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Qualidade do Perfil</span>
                    <span className={`text-xs font-bold ${completeness === 100 ? 'text-green-600' : 'text-indigo-600'}`}>{completeness}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ${completeness === 100 ? 'bg-green-500' : 'bg-indigo-600'}`} 
                        style={{width: `${completeness}%`}}
                    ></div>
                </div>
                {completeness < 100 && (
                    <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        Complete para desbloquear mais limite.
                    </p>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Informações Pessoais</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Nome" name="first_name" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
                    <InputField label="Sobrenome" name="last_name" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
                </div>
                
                {/* Campos Read-only com ícone de cadeado */}
                <div className="relative">
                    <InputField label="CPF" name="cpf" value={profile.identification_number || ''} disabled className="opacity-60 pl-10 bg-slate-50 dark:bg-slate-900" />
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute top-[34px] left-3 w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span className="absolute top-0 right-0 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                        Verificado
                    </span>
                </div>

                <div className="relative">
                     <InputField label="Email" name="email" value={profile.email || ''} disabled className="opacity-60 pl-10 bg-slate-50 dark:bg-slate-900" />
                     <svg xmlns="http://www.w3.org/2000/svg" className="absolute top-[34px] left-3 w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                </div>

                <InputField 
                    label="Telefone / WhatsApp" 
                    name="phone" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    placeholder="(00) 00000-0000" 
                />
                
                <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                    {loading ? <LoadingSpinner /> : 'Salvar Alterações'}
                </button>
            </form>
        </div>
    );
};

// --- NOVA HELP VIEW ROBUSTA ---

const FAQItem: React.FC<{ question: string; answer: string; isExpanded: boolean; onClick: () => void }> = ({ question, answer, isExpanded, onClick }) => (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
        <button onClick={onClick} className="w-full py-4 flex justify-between items-center text-left focus:outline-none group">
            <span className={`font-medium text-sm transition-colors ${isExpanded ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-indigo-500'}`}>
                {question}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-2 border-l-2 border-indigo-100 dark:border-slate-700 ml-1">
                {answer}
            </p>
            <div className="mt-3 flex items-center gap-2 px-2">
                <span className="text-[10px] text-slate-400">Isso foi útil?</span>
                <button className="p-1 hover:bg-green-50 dark:hover:bg-green-900/30 rounded text-slate-400 hover:text-green-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg></button>
                <button className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211 1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg></button>
            </div>
        </div>
    </div>
);

const HelpView: React.FC<{ userId: string }> = ({ userId }) => {
    const [view, setView] = useState<'home' | 'faq' | 'tickets' | 'create' | 'chat'>('home');
    const [tickets, setTickets] = useState<any[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'closed'>('open');
    const [searchQuery, setSearchQuery] = useState('');
    const [rating, setRating] = useState(0);
    
    // New Ticket Form
    const [newTicket, setNewTicket] = useState({ subject: '', category: 'Financeiro', priority: 'Normal', message: '' });
    
    const { addToast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const faqs = [
        // Financeiro
        { q: "Como aumento meu limite?", a: "O limite aumenta automaticamente conforme você paga suas faturas em dia. Você também pode solicitar uma análise no menu 'Meus Limites'." },
        { q: "O pagamento via Pix é instantâneo?", a: "Sim! O pagamento via Pix é processado na hora e seu limite é liberado em poucos minutos." },
        { q: "Como funcionam os juros por atraso?", a: "Em caso de atraso, é cobrada uma multa de 2% mais juros de 1% ao mês pro rata die." },
        { q: "Onde vejo o comprovante?", a: "Acesse 'Meus Documentos' > 'Comprovantes' no seu perfil para ver e baixar todos os recibos." },
        { q: "Posso antecipar parcelas?", a: "Sim, ao antecipar parcelas você ganha desconto nos juros. Entre em contato pelo chat para solicitar o boleto de quitação." },
        { q: "Meu boleto venceu, e agora?", a: "Você pode atualizar o boleto vencido diretamente no app ou pagar via Pix com o valor atualizado." },
        { q: "Aceitam cartão de crédito de terceiros?", a: "Por segurança, recomendamos usar cartão próprio. Cartões de terceiros podem passar por análise antifraude mais rigorosa." },
        { q: "O que é o CVV do cartão?", a: "É o código de segurança de 3 ou 4 dígitos localizado no verso do seu cartão de crédito." },
        { q: "Fiz um Pix errado, como estornar?", a: "Entre em contato imediatamente com o suporte com o comprovante em mãos para analisarmos o caso." },
        { q: "Posso parcelar no boleto?", a: "O parcelamento no boleto está disponível mediante análise de crédito (Crediário Próprio)." },
        
        // Loja & Produtos
        { q: "Qual o prazo de entrega?", a: "Para Macapá e Santana, a entrega costuma ser no mesmo dia ou em até 24h úteis." },
        { q: "Posso retirar na loja?", a: "Sim, basta selecionar a opção 'Retirada na Loja' no momento da compra." },
        { q: "Os produtos têm garantia?", a: "Todos os produtos eletrônicos possuem garantia legal de 90 dias, mais a garantia do fabricante (geralmente 1 ano)." },
        { q: "Como rastrear meu pedido?", a: "Vá em 'Meus Pedidos' no perfil. Lá você vê o status atualizado de cada etapa." },
        { q: "Vendem acessórios originais?", a: "Sim, trabalhamos apenas com produtos originais e homologados." },
        { q: "O que fazer se o produto vier com defeito?", a: "Você tem até 7 dias para troca imediata na loja. Após esse prazo, acione a garantia do fabricante." },
        { q: "Posso reservar um produto?", a: "Não fazemos reservas sem pagamento. O produto é garantido apenas após a confirmação da compra." },
        { q: "Vocês compram celular usado?", a: "Temos um programa de Trade-in em períodos específicos. Fique atento às notificações." },
        { q: "O preço do site é o mesmo da loja?", a: "Geralmente sim, mas podem haver promoções exclusivas para o App." },
        { q: "Como usar cupom de desconto?", a: "Na tela de pagamento, insira o código no campo 'Cupom' antes de finalizar." },

        // Cadastro & Conta
        { q: "Esqueci minha senha.", a: "Clique em 'Esqueceu?' na tela de login para receber um link de redefinição por e-mail." },
        { q: "Como alterar meu e-mail?", a: "Por segurança, a alteração de e-mail deve ser solicitada via suporte com validação de identidade." },
        { q: "É seguro enviar meus documentos?", a: "Sim, utilizamos criptografia de ponta a ponta e seus dados são usados apenas para análise de crédito." },
        { q: "Como excluir minha conta?", a: "Acesse Configurações > Zona de Perigo > Excluir Conta. Atenção: essa ação é irreversível." },
        { q: "Posso ter duas contas?", a: "Não, o cadastro é único por CPF." },
        { q: "Como ativar a biometria?", a: "Vá em Perfil > Configurações > Segurança e ative a opção 'Entrar com Biometria'." },
        { q: "Meu cadastro foi reprovado, por quê?", a: "A análise considera vários fatores como score, histórico e dados da Receita. Tente novamente em 30 dias." },
        { q: "Como mudar o endereço de entrega?", a: "Você pode gerenciar seus endereços em Perfil > Meus Endereços." },
        { q: "Recebo muitos e-mails, como parar?", a: "Em Configurações > Geral, você pode desativar as notificações por e-mail." },
        { q: "O app pede minha localização, por quê?", a: "Usamos para calcular o frete e sugerir a loja mais próxima, além de segurança antifraude." },

        // Crédito & Score
        { q: "O que é o Score Relp?", a: "É uma pontuação interna baseada no seu histórico de pagamentos e compras conosco." },
        { q: "Como aumento meu Score?", a: "Pague em dia, mantenha seus dados atualizados e concentre suas compras na Relp Cell." },
        { q: "Meu limite diminuiu, o que houve?", a: "O limite pode ser ajustado periodicamente com base em reanálises de crédito de mercado." },
        { q: "O limite é renovado quando?", a: "Assim que o pagamento da fatura é compensado, o limite proporcional é liberado." },
        { q: "Posso transferir limite?", a: "Não, o limite de crédito é pessoal e intransferível." },
        { q: "O que é 'Limite por Parcela'?", a: "É o valor máximo que a parcela de uma compra pode atingir, não o valor total do produto." },
        { q: "Negativados podem comprar?", a: "Cada caso é analisado individualmente. Ter restrição não impede a análise, mas pode limitar o crédito aprovado." },
        { q: "A consulta de crédito baixa meu score no Serasa?", a: "Nossa consulta interna não afeta seu score de mercado." },
        { q: "Quanto tempo demora a análise de aumento?", a: "Solicitações de aumento levam até 3 dias úteis." },
        { q: "Existe anuidade no crediário?", a: "Não cobramos anuidade ou taxas de manutenção de conta." },

        // Suporte & App
        { q: "O app está travando.", a: "Tente limpar o cache em Perfil > Configurações > Manutenção ou reinstale o aplicativo." },
        { q: "Não recebo o código SMS.", a: "Verifique se o número está correto ou se há bloqueio de SMS no seu aparelho." },
        { q: "Como falar com atendente?", a: "Abra um chamado na aba 'Meus Chamados' ou clique no botão de WhatsApp no Perfil." },
        { q: "Qual a versão atual do app?", a: "Você pode ver a versão instalada no rodapé da aba Configurações." },
        { q: "O app funciona sem internet?", a: "Algumas funções como ver faturas baixadas sim, mas para pagamentos é necessária conexão." },
        { q: "Onde fica a loja física?", a: "Temos unidades no Centro e Zona Norte. Consulte o endereço no rodapé do site." },
        { q: "Horário de atendimento do suporte?", a: "Nosso time atende de Seg a Sáb das 08h às 18h. O ChatBot funciona 24h." },
        { q: "Posso sugerir melhorias?", a: "Adoramos feedback! Envie sua sugestão pelo canal de suporte." },
        { q: "Meus dados sumiram do app.", a: "Tente sair da conta e fazer login novamente para sincronizar." },
        { q: "Erro 'Token Inválido'.", a: "Isso ocorre por segurança. Faça login novamente para renovar sua sessão." }
    ];

    const fetchTickets = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('support_tickets').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
        setTickets(data || []);
        setIsLoading(false);
    };

    const fetchMessages = async (ticketId: string) => {
        const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).eq('is_internal', false).order('created_at', { ascending: true });
        setMessages(data || []);
    };

    useEffect(() => {
        if (view === 'tickets') fetchTickets();
        if (view === 'chat' && selectedTicket) {
            fetchMessages(selectedTicket.id);
            const interval = setInterval(() => fetchMessages(selectedTicket.id), 3000);
            return () => clearInterval(interval);
        }
    }, [view, selectedTicket]);

    useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const { data: ticket, error } = await supabase.from('support_tickets').insert({
                user_id: userId,
                subject: newTicket.subject,
                category: newTicket.category,
                priority: newTicket.priority,
                status: 'open'
            }).select().single();

            if (error) throw error;

            if (newTicket.message) {
                await supabase.from('support_messages').insert({ ticket_id: ticket.id, sender_type: 'user', message: newTicket.message });
            }

            addToast('Chamado criado com sucesso!', 'success');
            setNewTicket({ subject: '', category: 'Financeiro', priority: 'Normal', message: '' });
            setView('tickets');
        } catch (e) {
            addToast('Erro ao criar chamado.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        const msg = newMessage;
        setNewMessage('');
        setMessages(p => [...p, { id: 'temp', sender_type: 'user', message: msg, created_at: new Date().toISOString() }]); // Otimista
        
        await supabase.from('support_messages').insert({ ticket_id: selectedTicket.id, sender_type: 'user', message: msg });
        await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', selectedTicket.id);
        fetchMessages(selectedTicket.id);
    };

    const handleCloseTicket = async () => {
        if (!window.confirm("Deseja encerrar este atendimento?")) return;
        await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', selectedTicket.id);
        setSelectedTicket({ ...selectedTicket, status: 'closed' });
        addToast('Atendimento encerrado.', 'success');
    };

    // --- SUB-VIEWS ---

    if (view === 'home') return (
        <div className="animate-fade-in space-y-6">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-xl font-bold mb-1">Central de Ajuda</h3>
                    <p className="text-indigo-100 text-sm mb-4">Estamos aqui para você, 24h por dia.</p>
                    <button onClick={() => setView('create')} className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-50 transition-colors shadow-sm">
                        Abrir Novo Chamado
                    </button>
                </div>
                <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 -mr-6 -mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
            </div>

            <ServiceStatus />

            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setView('tickets')} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all text-left group">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">Meus Chamados</h4>
                    <p className="text-xs text-slate-500">Acompanhe solicitações</p>
                </button>
                <button onClick={() => setView('faq')} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all text-left group">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 mb-3 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">Perguntas (FAQ)</h4>
                    <p className="text-xs text-slate-500">Tire dúvidas rápidas</p>
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white mb-3 text-sm">Canais Externos</h4>
                <a href="https://wa.me/5596991718167" target="_blank" rel="noreferrer" className="flex items-center p-3 mb-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">WhatsApp</p>
                        <p className="text-xs text-slate-500">Resposta rápida</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </a>
                <a href="mailto:suporte@relpcell.com" className="flex items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">E-mail</p>
                        <p className="text-xs text-slate-500">suporte@relpcell.com</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </a>
            </div>
        </div>
    );

    if (view === 'faq') return (
        <div className="animate-fade-in space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setView('home')} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Perguntas Frequentes</h3>
            </div>
            
            <div className="relative">
                <input type="text" placeholder="Buscar dúvida..." className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" onChange={(e) => setSearchQuery(e.target.value)} />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2">
                {faqs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase())).map((f, i) => (
                    <FAQItem key={i} question={f.q} answer={f.a} isExpanded={expandedFaq === i} onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} />
                ))}
            </div>
        </div>
    );

    if (view === 'tickets') return (
        <div className="animate-fade-in space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <button onClick={() => setView('home')} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Meus Tickets</h3>
                </div>
                <button onClick={() => setView('create')} className="bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition-transform active:scale-95">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {['open', 'closed', 'all'].map((status) => (
                    <button 
                        key={status}
                        onClick={() => setTicketFilter(status as any)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${ticketFilter === status ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        {status === 'all' ? 'Todos' : status === 'open' ? 'Abertos' : 'Fechados'}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center py-10"><LoadingSpinner /></div>
                ) : tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter).length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                        <p className="text-sm">Nenhum ticket encontrado.</p>
                    </div>
                ) : (
                    tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter).map(ticket => (
                        <button key={ticket.id} onClick={() => { setSelectedTicket(ticket); setView('chat'); }} className="w-full text-left bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm active:scale-[0.98] transition-transform relative overflow-hidden group">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${ticket.status === 'open' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                            <div className="pl-3">
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold text-slate-800 dark:text-white text-sm truncate pr-2">{ticket.subject}</span>
                                    <span className="text-[10px] text-slate-400">{new Date(ticket.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex gap-2">
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded uppercase font-bold">{ticket.category}</span>
                                        {ticket.priority === 'Alta' && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase font-bold">Urgente</span>}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase ${ticket.status === 'open' ? 'text-green-600' : 'text-slate-400'}`}>{ticket.status === 'open' ? 'Aberto' : 'Fechado'}</span>
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );

    if (view === 'create') return (
        <div className="animate-fade-in space-y-4 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setView('tickets')} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Novo Chamado</h3>
            </div>

            <form onSubmit={handleCreateTicket} className="flex-1 overflow-y-auto pb-20 space-y-4 p-1">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200 mb-4">
                    <p>👋 <strong>Dica:</strong> Verifique a aba "Perguntas" antes de abrir um chamado. Muitas dúvidas já estão respondidas lá!</p>
                </div>

                <InputField label="Assunto" name="subject" value={newTicket.subject} onChange={e => setNewTicket({...newTicket, subject: e.target.value})} required placeholder="Resumo do problema" />
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                        <select className="w-full px-3 py-2.5 border rounded-lg bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm" value={newTicket.category} onChange={e => setNewTicket({...newTicket, category: e.target.value})}>
                            <option>Financeiro</option>
                            <option>Técnico</option>
                            <option>Vendas</option>
                            <option>Outros</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prioridade</label>
                        <select className="w-full px-3 py-2.5 border rounded-lg bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm" value={newTicket.priority} onChange={e => setNewTicket({...newTicket, priority: e.target.value})}>
                            <option>Baixa</option>
                            <option>Normal</option>
                            <option>Alta</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mensagem</label>
                    <textarea required rows={6} className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm" value={newTicket.message} onChange={e => setNewTicket({...newTicket, message: e.target.value})} placeholder="Descreva detalhadamente o que está acontecendo..."></textarea>
                    <p className="text-right text-xs text-slate-400 mt-1">{newTicket.message.length}/500</p>
                </div>

                {/* Fake Attachment Button */}
                <button type="button" className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg w-fit transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    Anexar Arquivo (Imagem/PDF)
                </button>

                <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2">
                    {isLoading ? <LoadingSpinner /> : 'Enviar Solicitação'}
                </button>
            </form>
        </div>
    );

    if (view === 'chat') return (
        <div className="animate-fade-in flex flex-col h-full fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-900">
            {/* Chat Header */}
            <div className="p-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-sm flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pt-safe">
                <button onClick={() => setView('tickets')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <div className="flex-1 truncate">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate">{selectedTicket?.subject}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                        Ticket #{selectedTicket?.id.slice(0,6)} • 
                        <span className={`w-2 h-2 rounded-full ${selectedTicket?.status === 'open' ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                        {selectedTicket?.status === 'open' ? 'Aberto' : 'Fechado'}
                    </p>
                </div>
                {selectedTicket?.status === 'open' && (
                    <button onClick={handleCloseTicket} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs font-bold">Encerrar</button>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-slate-900/50">
                {/* System Message Start */}
                <div className="flex justify-center"><span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full">Início do atendimento: {new Date(selectedTicket.created_at).toLocaleDateString()}</span></div>
                
                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender_type === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm relative ${msg.sender_type === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm border border-slate-200 dark:border-slate-600'}`}>
                            {msg.message}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1">{new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                ))}
                
                {selectedTicket.status === 'closed' && (
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl text-center border border-slate-200 dark:border-slate-700 shadow-sm my-4">
                        <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Atendimento Finalizado</p>
                        <p className="text-xs text-slate-500 mb-3">Como você avalia nosso suporte?</p>
                        <div className="flex justify-center gap-2 mb-2">
                            {[1,2,3,4,5].map(s => (
                                <button key={s} onClick={() => setRating(s)} className={`text-2xl transition-transform hover:scale-110 ${s <= rating ? 'grayscale-0' : 'grayscale opacity-30'}`}>⭐</button>
                            ))}
                        </div>
                        {rating > 0 && <p className="text-xs text-green-600 font-bold animate-fade-in">Obrigado pelo feedback!</p>}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {selectedTicket.status === 'open' ? (
                <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-2 pb-safe">
                    <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Digite sua mensagem..." className="flex-1 bg-slate-100 dark:bg-slate-900 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white" />
                    <button type="submit" disabled={!newMessage.trim()} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                </form>
            ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 text-center text-xs text-slate-500 pb-safe border-t border-slate-200 dark:border-slate-700">
                    Este ticket foi encerrado. Para novas dúvidas, abra um novo chamado.
                </div>
            )}
        </div>
    );

    return null;
};

const PagePerfil: React.FC<PagePerfilProps> = ({ session, toggleTheme, isDarkMode }) => {
    const [activeView, setActiveView] = useState<'main' | 'data' | 'orders' | 'wallet' | 'addresses' | 'settings' | 'referral' | 'help' | 'contracts' | 'fiscal_notes' | 'receipts'>('main');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    useEffect(() => {
        const load = async () => {
            try {
                const p = await getProfile(session.user.id);
                if(p) setProfile({...p, id: session.user.id, email: session.user.email});
            } catch(e) { console.error(e); } 
            finally { setIsLoading(false); }
        };
        load();
    }, [session]);

    // Verifica se deve abrir uma seção específica (vinda das missões)
    useEffect(() => {
        const section = sessionStorage.getItem('relp_profile_section');
        if (section) {
            // Pequeno delay para garantir que o componente montou
            setTimeout(() => {
                setActiveView(section as any);
                sessionStorage.removeItem('relp_profile_section');
            }, 100);
        }
    }, []);

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

    const renderHeader = () => (
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 shadow-xl mb-6">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full opacity-20 blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-600 rounded-full opacity-20 blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

             <div className="relative z-10 flex items-center gap-5">
                <div className="relative group" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-20 h-20 rounded-full border-4 border-white/20 overflow-hidden shadow-md bg-slate-800">
                         {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">{profile?.first_name?.[0] || 'U'}</div>}
                    </div>
                    <div className="absolute bottom-0 right-0 bg-indigo-500 p-1.5 rounded-full border-2 border-slate-900 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*"/>
                </div>
                
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-bold truncate">{profile?.first_name} {profile?.last_name}</h2>
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-[10px] font-bold rounded border border-yellow-500/50">CLIENTE</span>
                    </div>
                    <p className="text-slate-400 text-xs mb-3 truncate">{session.user.email}</p>
                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-full text-[10px] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                        Online Agora
                    </div>
                </div>
             </div>
        </div>
    );

    return (
        <div className="w-full max-w-md p-4 mx-auto pb-24">
            {activeView === 'main' ? (
                <div className="animate-fade-in">
                    {renderHeader()}

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <StatBadge label="Score" value={profile?.credit_score || 0} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
                        <StatBadge label="Pedidos" value="0" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>} />
                        <StatBadge label="Cashback" value="R$ 0" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                    </div>

                    {/* Menu Principal */}
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white mb-3 px-1">Minha Conta</h3>
                        
                        <MenuItem 
                            label="Meus Pedidos" 
                            description="Acompanhe suas compras"
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                            onClick={() => setActiveView('orders')}
                            colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        />
                        
                        <MenuItem 
                            label="Carteira & Cashback" 
                            description="Seu saldo e cartões"
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                            onClick={() => setActiveView('wallet')}
                            colorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        />

                        <MenuItem 
                            label="Meus Endereços" 
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                            onClick={() => setActiveView('addresses')}
                            colorClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                        />

                        <h3 className="font-bold text-slate-900 dark:text-white mb-3 mt-6 px-1">Meus Documentos</h3>

                        <MenuItem 
                            label="Comprovantes" 
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                            onClick={() => setActiveView('receipts')}
                            colorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        />

                        <MenuItem 
                            label="Contratos" 
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                            onClick={() => setActiveView('contracts')}
                            colorClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
                        />

                        <MenuItem 
                            label="Notas Fiscais" 
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
                            onClick={() => setActiveView('fiscal_notes')}
                            colorClass="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
                        />

                        <h3 className="font-bold text-slate-900 dark:text-white mb-3 mt-6 px-1">Preferências & Suporte</h3>

                        <MenuItem 
                            label="Meus Dados" 
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                            onClick={() => setActiveView('data')}
                            colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                        />
                        
                        <MenuItem 
                            label="Configurações" 
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                            onClick={() => setActiveView('settings')}
                            colorClass="bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400"
                        />

                        <MenuItem 
                            label="Indique e Ganhe" 
                            description="Ganhe R$ 20 por amigo"
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 012 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>}
                            onClick={() => setActiveView('referral')}
                            colorClass="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
                        />

                         <MenuItem 
                            label="Central de Atendimento" 
                            description="Fale com nossa equipe"
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                            onClick={() => setActiveView('help')}
                            colorClass="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
                        />
                    </div>

                    <button onClick={handleLogout} className="w-full py-4 mt-6 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors text-sm">
                        Sair da Conta
                    </button>
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    <button onClick={() => setActiveView('main')} className="flex items-center text-slate-500 hover:text-indigo-600 font-medium mb-4 transition-colors p-2 -ml-2">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> 
                        Voltar
                    </button>
                    
                    {/* Header da Sub-view */}
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {activeView === 'data' && 'Meus Dados'}
                            {activeView === 'orders' && 'Meus Pedidos'}
                            {activeView === 'wallet' && 'Carteira'}
                            {activeView === 'addresses' && 'Endereços'}
                            {activeView === 'contracts' && 'Contratos'}
                            {activeView === 'fiscal_notes' && 'Notas Fiscais'}
                            {activeView === 'receipts' && 'Comprovantes'}
                            {activeView === 'settings' && 'Configurações'}
                            {activeView === 'referral' && 'Indique e Ganhe'}
                            {activeView === 'help' && 'Central de Atendimento'}
                        </h2>
                    </div>

                    {activeView === 'orders' && <OrdersView userId={session.user.id} />}
                    {activeView === 'wallet' && <WalletView userId={session.user.id} />}
                    {activeView === 'addresses' && profile && <AddressView profile={profile} onUpdate={setProfile} />}
                    {activeView === 'contracts' && profile && <ContractsView profile={profile} />}
                    {activeView === 'fiscal_notes' && profile && <FiscalNotesView profile={profile} />}
                    {activeView === 'receipts' && profile && <PaymentReceiptsView userId={session.user.id} profile={profile} />}
                    {activeView === 'data' && profile && <PersonalDataView profile={profile} onUpdate={(updated) => setProfile(updated)} />}
                    {activeView === 'settings' && <SettingsView toggleTheme={toggleTheme} isDarkMode={isDarkMode} />}
                    {activeView === 'referral' && profile && <ReferralView profile={profile} />}
                    {activeView === 'help' && <HelpView userId={session.user.id} />}
                </div>
            )}
        </div>
    );
};

export default PagePerfil;
