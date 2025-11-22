
import React, { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import { Profile, Address, Invoice } from '../types';
import LoadingSpinner from './LoadingSpinner';
import InputField from './InputField';
import { useToast } from './Toast';
import jsPDF from 'jspdf';
import Modal from './Modal'; 
import ReceiptDetails from './ReceiptDetails';

interface PagePerfilProps {
    session: Session;
}

const COMPANY_DATA = {
    razaoSocial: "RELP CELL ELETRONICOS",
    cnpj: "43.735.304/0001-00",
    endereco: "Endereço Comercial, Estado do Amapá",
    cidadeUF: "Macapá - AP",
    telefone: "(96) 99171-8167"
};

// --- Componentes Auxiliares ---

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

const ToggleSwitch: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
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

// --- Help View Atualizada (Enterprise Support) ---
const HelpView: React.FC<{ userId: string }> = ({ userId }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'tickets'>('dashboard');
    const [tickets, setTickets] = useState<any[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);

    useEffect(() => {
        if (activeTab === 'tickets') {
            setLoadingTickets(true);
            const fetchTickets = async () => {
                const { data } = await supabase.from('support_tickets').select('*').eq('user_id', userId).order('created_at', {ascending: false});
                setTickets(data || []);
                setLoadingTickets(false);
            };
            fetchTickets();
        }
    }, [activeTab, userId]);

    const faqs = [
        { q: "Como aumento meu limite?", a: "O limite é analisado automaticamente todo mês com base nos seus pagamentos em dia." },
        { q: "Quais as formas de pagamento?", a: "Aceitamos Cartão de Crédito, Pix e Boleto Bancário parcelado." },
    ];

    if (activeTab === 'tickets') {
        return (
            <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                    <button onClick={() => setActiveTab('dashboard')} className="text-sm text-indigo-600 font-bold">&larr; Voltar</button>
                    <h3 className="font-bold text-slate-900 dark:text-white">Meus Chamados</h3>
                </div>
                {loadingTickets ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : tickets.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">Nenhum chamado aberto.</div>
                ) : (
                    tickets.map(ticket => (
                        <div key={ticket.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">{ticket.subject}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${ticket.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {ticket.status === 'open' ? 'Aberto' : 'Fechado'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">Criado em {new Date(ticket.created_at).toLocaleDateString()}</p>
                            {ticket.status === 'open' && <p className="text-xs text-indigo-600 mt-2 font-medium">Em atendimento no Chat</p>}
                        </div>
                    ))
                )}
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            {/* Hero Section da Central */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white text-center relative overflow-hidden shadow-lg">
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
                 <h3 className="text-xl font-bold relative z-10">Central de Atendimento</h3>
                 <p className="text-indigo-100 text-sm mt-1 relative z-10 mb-4">Como podemos te ajudar hoje?</p>
                 
                 <div className="grid grid-cols-2 gap-3 relative z-10">
                    <button 
                        onClick={() => window.dispatchEvent(new Event('open-support-chat'))}
                        className="bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/30 hover:bg-white/30 transition-colors flex flex-col items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        <span className="text-xs font-bold">Chat Online</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('tickets')}
                        className="bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/30 hover:bg-white/30 transition-colors flex flex-col items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        <span className="text-xs font-bold">Meus Chamados</span>
                    </button>
                 </div>
            </div>

            {/* FAQ Rápido */}
            <div className="space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white px-2">Perguntas Frequentes</h4>
                {faqs.map((faq, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-2">{faq.q}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{faq.a}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Views existentes mantidas ---
const ContractsView: React.FC<{ profile: Profile }> = ({ profile }) => {
    return (
        <div className="space-y-4 animate-fade-in text-center py-10 text-slate-500">
            <p>Contratos disponíveis para download em breve.</p>
        </div>
    );
};

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

const OrdersView = ({ userId }: { userId: string }) => (
    <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
        <p>Histórico de pedidos será carregado aqui.</p>
    </div>
);
const WalletView = ({ userId }: { userId: string }) => (
    <div className="space-y-4 animate-fade-in">
         <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
            <p className="text-sm opacity-90">Saldo Disponível</p>
            <h2 className="text-4xl font-bold mt-1">R$ 0,00</h2>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
            <h3 className="font-bold mb-3 text-slate-800 dark:text-white">Histórico</h3>
            <p className="text-sm text-slate-500 text-center py-4">Nenhuma movimentação recente.</p>
        </div>
    </div>
);
const AddressView = ({ userId }: { userId: string }) => (
     <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
        <p>Gestão de endereços.</p>
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
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <p className="text-xs text-indigo-800 dark:text-indigo-200 text-center">
                    Mantenha seus dados atualizados para facilitar a aprovação de crédito e entregas.
                </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Nome" name="first_name" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
                    <InputField label="Sobrenome" name="last_name" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
                </div>
                <InputField label="Email" name="email" value={profile.email || ''} disabled className="opacity-60" />
                <InputField label="CPF" name="cpf" value={profile.identification_number || ''} disabled className="opacity-60" />
                <InputField label="Telefone" name="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                
                <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all disabled:opacity-70">
                    {loading ? <LoadingSpinner /> : 'Salvar Alterações'}
                </button>
            </form>
        </div>
    );
};

const SettingsView: React.FC = () => {
    const [notifs, setNotifs] = useState({ push: true, email: true, whatsapp: false });
    const { addToast } = useToast();

    const handlePasswordReset = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
            await supabase.auth.resetPasswordForEmail(user.email);
            addToast('Email de redefinição enviado!', 'success');
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Notificações</h3>
                <ToggleSwitch label="Notificações Push" checked={notifs.push} onChange={v => setNotifs({...notifs, push: v})} />
                <ToggleSwitch label="Emails Promocionais" checked={notifs.email} onChange={v => setNotifs({...notifs, email: v})} />
                <ToggleSwitch label="Avisos via WhatsApp" checked={notifs.whatsapp} onChange={v => setNotifs({...notifs, whatsapp: v})} />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Segurança</h3>
                <button onClick={handlePasswordReset} className="w-full text-left py-3 text-sm text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors flex justify-between items-center">
                    Alterar Senha de Acesso
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
            
            <div className="text-center pt-4">
                <p className="text-xs text-slate-400">Versão do App: 1.2.0 (Build 450)</p>
            </div>
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
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

const PagePerfil: React.FC<PagePerfilProps> = ({ session }) => {
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
                    <div className="w-20 h-20 rounded-full border-4 border-white/20 overflow-hidden shadow-md">
                         {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-700 flex items-center justify-center text-2xl font-bold">{profile?.first_name?.[0] || 'U'}</div>}
                    </div>
                    <div className="absolute bottom-0 right-0 bg-indigo-500 p-1.5 rounded-full border-2 border-slate-900 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*"/>
                </div>
                
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-bold truncate">{profile?.first_name} {profile?.last_name}</h2>
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-[10px] font-bold rounded border border-yellow-500/50">OURO</span>
                    </div>
                    <p className="text-slate-400 text-xs mb-3">{session.user.email}</p>
                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-full text-[10px] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        Membro desde 2024
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
                        <StatBadge label="Pedidos" value="3" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>} />
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

                        <h3 className="font-bold text-slate-900 dark:text-white mb-3 mt-6 px-1">Preferências</h3>

                        <MenuItem 
                            label="Meus Dados" 
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                            onClick={() => setActiveView('data')}
                            colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                        />
                        
                        <MenuItem 
                            label="Configurações" 
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                            onClick={() => setActiveView('settings')}
                            colorClass="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                        />
                        
                         <MenuItem 
                            label="Indique e Ganhe" 
                            description="Ganhe R$ 20 por amigo"
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>}
                            onClick={() => setActiveView('referral')}
                            colorClass="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
                        />

                         <MenuItem 
                            label="Central de Atendimento" 
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                            onClick={() => setActiveView('help')}
                            colorClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
                        />
                    </div>

                    <button onClick={handleLogout} className="w-full py-4 mt-4 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors">
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
                    {activeView === 'addresses' && <AddressView userId={session.user.id} />}
                    {activeView === 'contracts' && profile && <ContractsView profile={profile} />}
                    {activeView === 'fiscal_notes' && profile && <FiscalNotesView profile={profile} />}
                    {activeView === 'receipts' && profile && <PaymentReceiptsView userId={session.user.id} profile={profile} />}
                    {activeView === 'data' && profile && <PersonalDataView profile={profile} onUpdate={(updated) => setProfile(updated)} />}
                    {activeView === 'settings' && <SettingsView />}
                    {activeView === 'referral' && profile && <ReferralView profile={profile} />}
                    {activeView === 'help' && <HelpView userId={session.user.id} />}
                </div>
            )}
        </div>
    );
};

export default PagePerfil;
