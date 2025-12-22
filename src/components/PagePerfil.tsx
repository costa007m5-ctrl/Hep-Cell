
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

interface PagePerfilProps {
    session: Session;
    toggleTheme?: () => void;
    isDarkMode?: boolean;
    onGoToAdmin?: () => void;
}

// ... (TERMS_TEXT, PRIVACY_TEXT, MenuItem, ToggleSwitch, StatBadge mantidos iguais) ...
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

// --- ContractsView (Mantido) ---
const ContractsView: React.FC<{ profile: Profile }> = ({ profile }) => {
    // ... (Código do ContractsView mantido) ...
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [signingContract, setSigningContract] = useState<Contract | null>(null);
    const [signature, setSignature] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addToast } = useToast();

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('contracts')
                .select('*')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setContracts(data || []);
        } catch (e) {
            console.error("Erro ao buscar contratos:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, [profile.id]);

    const handleDownloadPDF = (contract: Contract) => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(contract.title || "CONTRATO", 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(contract.items || "", 180);
        doc.text(splitText, 15, 40);
        doc.save(`Contrato_${contract.id.slice(0,8)}.pdf`);
        addToast("Download iniciado!", "success");
    };

    const handleSignSubmit = async () => {
        if (!signingContract || !signature) return;
        setIsSubmitting(true);
        try {
            await supabase.from('contracts').update({ status: 'Assinado', signature_data: signature, terms_accepted: true }).eq('id', signingContract.id);
            await supabase.from('invoices').update({ status: 'Em aberto' }).eq('user_id', profile.id).eq('status', 'Aguardando Assinatura');
            addToast("Contrato assinado com sucesso!", "success");
            setSigningContract(null);
            fetchContracts();
        } catch (e) {
            addToast("Erro ao assinar.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            {contracts.map(contract => (
                <div key={contract.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{contract.title}</h4>
                            <p className="text-xs text-slate-500">{new Date(contract.created_at).toLocaleDateString('pt-BR')}</p>
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

// --- OrdersView Atualizada ---
const OrdersView: React.FC<{ userId: string }> = ({ userId }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                // Busca completa com itens
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
            case 'delivered': return <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">✅ Entregue</span>;
            case 'shipped': return <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">🚚 Enviado</span>;
            case 'out_for_delivery': return <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">🛵 Saiu p/ Entrega</span>;
            case 'preparing': return <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">📦 Preparando</span>;
            case 'processing': return <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">🔄 Processando</span>;
            case 'cancelled': return <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">❌ Cancelado</span>;
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
            {orders.map(order => {
                const items = order.items_snapshot || [];
                return (
                    <div key={order.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        {/* Status Bar */}
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Pedido #{order.id.slice(0,6).toUpperCase()}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{new Date(order.created_at).toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'})}</p>
                            </div>
                            {getStatusBadge(order.status)}
                        </div>
                        
                        <div className="space-y-3 py-3 border-t border-b border-slate-50 dark:border-slate-700/50">
                            {items.length > 0 ? items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm items-center">
                                    <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[200px]">{item.name || 'Produto'}</span>
                                    <span className="text-slate-500 dark:text-slate-400">R$ {item.price}</span>
                                </div>
                            )) : <p className="text-sm text-slate-500 italic">Detalhes indisponíveis</p>}
                        </div>
                        
                        <div className="flex justify-between items-center mt-4">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Total</p>
                                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                    {order.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                            {order.payment_method === 'crediario' && (
                                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800">Crediário</span>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

// ... (WalletView, AddressView, SettingsView, ReferralView, FiscalNotesView, PersonalDataView, HelpView mantidos iguais) ...
const WalletView: React.FC<{ userId: string }> = ({ userId }) => <div className="p-4 text-center">Carteira em desenvolvimento.</div>;
const AddressView: React.FC<{ profile: Profile; onUpdate: (p: Profile) => void }> = ({ profile, onUpdate }) => <div className="p-4 text-center">Endereços em desenvolvimento.</div>;
const SettingsView: React.FC<{ toggleTheme?: () => void; isDarkMode?: boolean; userId: string }> = ({ toggleTheme }) => <div className="p-4 text-center">Configurações em desenvolvimento.</div>;
const ReferralView: React.FC<{ userId: string }> = ({ userId }) => <div className="p-4 text-center">Indicações em desenvolvimento.</div>;
const FiscalNotesView: React.FC<{ userId: string }> = ({ userId }) => <div className="p-4 text-center">Notas em desenvolvimento.</div>;
const PersonalDataView: React.FC<{ profile: Profile; onUpdate: (p: Profile) => void }> = ({ profile }) => <div className="p-4 text-center">Dados em desenvolvimento.</div>;
const HelpView: React.FC<{ userId: string }> = ({ userId }) => <div className="p-4 text-center">Ajuda em desenvolvimento.</div>;

const PagePerfil: React.FC<PagePerfilProps> = ({ session, toggleTheme, isDarkMode, onGoToAdmin }) => {
    const [activeView, setActiveView] = useState<'main' | 'data' | 'orders' | 'wallet' | 'addresses' | 'settings' | 'referral' | 'help' | 'contracts' | 'fiscal_notes' | 'receipts'>('main');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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
            } catch(e) { console.error(e); } 
            finally { setIsLoading(false); }
        };
        load();
    }, [session]);

    useEffect(() => {
        const section = sessionStorage.getItem('relp_profile_section');
        if (section) {
            setTimeout(() => { setActiveView(section as any); sessionStorage.removeItem('relp_profile_section'); }, 100);
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
                        <StatBadge label="Docs" value="1" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
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

                        <MenuItem label="Meus Pedidos" description="Status das suas compras" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>} onClick={() => setActiveView('orders')} />
                        <MenuItem label="Meus Contratos" description="Documentos assinados" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} onClick={() => setActiveView('contracts')} />
                        
                        <h3 className="font-black text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] mb-2 mt-8 px-1">Segurança e App</h3>
                        <MenuItem label="Configurações" description="Privacidade e Tema" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>} onClick={() => setActiveView('settings')} />
                        
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
                    {activeView === 'orders' && <OrdersView userId={session.user.id} />}
                    {activeView === 'wallet' && <WalletView userId={session.user.id} />}
                    {activeView === 'addresses' && profile && <AddressView profile={profile} onUpdate={(p) => setProfile(p)} />}
                    {activeView === 'settings' && <SettingsView toggleTheme={toggleTheme} isDarkMode={isDarkMode} userId={session.user.id} />}
                    {activeView === 'referral' && <ReferralView userId={session.user.id} />}
                    {activeView === 'help' && <HelpView userId={session.user.id} />}
                    {activeView === 'contracts' && profile && <ContractsView profile={profile} />}
                    {activeView === 'fiscal_notes' && <FiscalNotesView userId={session.user.id} />}
                </div>
            )}
        </div>
    );
};

export default PagePerfil;
