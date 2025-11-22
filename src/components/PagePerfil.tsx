
import React, { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import { Profile, Address } from '../types';
import LoadingSpinner from './LoadingSpinner';
import InputField from './InputField';
import { useToast } from './Toast';
import jsPDF from 'jspdf';

interface PagePerfilProps {
    session: Session;
}

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

// --- Sub-Views ---

const ContractsView: React.FC = () => {
    const contracts = [
        { id: 1, title: 'Termo de Adesão - Crediário', date: '10/01/2024', status: 'Ativo' },
        { id: 2, title: 'Contrato de Compra e Venda', date: '15/05/2024', status: 'Finalizado' },
    ];

    const generateContractPDF = (contract: any) => {
        const doc = new jsPDF();
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("RELP CELL - CONTRATO DIGITAL", 105, 20, { align: "center" });
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Documento: ${contract.title}`, 20, 40);
        doc.text(`Data de Assinatura: ${contract.date}`, 20, 50);
        doc.text(`Status: ${contract.status}`, 20, 60);
        
        doc.setFont("helvetica", "bold");
        doc.text("CLÁUSULA 1 - DO OBJETO", 20, 80);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const text = "O presente contrato tem por objeto estabelecer as condições gerais de uso do crediário da Relp Cell, incluindo limites de crédito, vencimentos e taxas de juros aplicáveis.";
        const splitText = doc.splitTextToSize(text, 170);
        doc.text(splitText, 20, 90);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("CLÁUSULA 2 - DO PAGAMENTO", 20, 120);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const text2 = "O cliente compromete-se a efetuar os pagamentos das faturas até a data de vencimento. O não pagamento acarretará em multas e juros conforme legislação vigente.";
        const splitText2 = doc.splitTextToSize(text2, 170);
        doc.text(splitText2, 20, 130);

        doc.setTextColor(150);
        doc.text("Assinado Digitalmente via App Relp Cell", 105, 280, { align: "center" });
        
        doc.save(`contrato_relp_${contract.id}.pdf`);
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <div>
                    <h4 className="font-bold text-indigo-900 dark:text-indigo-100 text-sm">Documentos Digitais</h4>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">Aqui ficam armazenados todos os contratos aceitos digitalmente por você.</p>
                </div>
            </div>

            {contracts.map(contract => (
                <div key={contract.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white text-sm">{contract.title}</p>
                        <p className="text-xs text-slate-500 mt-1">Assinado em {contract.date}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${contract.status === 'Ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                            {contract.status}
                        </span>
                        <button 
                            onClick={() => generateContractPDF(contract)}
                            className="text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:underline flex items-center gap-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Baixar PDF
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const FiscalNotesView: React.FC = () => {
    const notes = [
        { id: 'NFE-4592', items: 'iPhone 13 Pro 128GB', value: 'R$ 4.500,00', date: '15/05/2024', key: '3524 0512 3456 7890 1234 5500 1000 0045 9210 0000 0000' },
    ];

    const generateFiscalNotePDF = (note: any) => {
        const doc = new jsPDF();
        
        // Header DANFE Simulado
        doc.setLineWidth(0.5);
        doc.rect(10, 10, 190, 30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("DANFE", 20, 20);
        doc.setFontSize(10);
        doc.text("Documento Auxiliar da Nota Fiscal Eletrônica", 20, 25);
        doc.text("0 - Entrada", 150, 20);
        doc.text("1 - Saída", 150, 25);
        doc.setFontSize(12);
        doc.text(`Nº ${note.id}`, 150, 35);

        // Emitente
        doc.rect(10, 45, 190, 20);
        doc.setFontSize(10);
        doc.text("EMITENTE: RELP CELL ELETRONICOS LTDA", 15, 55);
        doc.text("CNPJ: 00.000.000/0001-91", 15, 60);

        // Destinatário
        doc.rect(10, 70, 190, 20);
        doc.text("DESTINATÁRIO: CLIENTE CONSUMIDOR", 15, 80);
        doc.text(`DATA EMISSÃO: ${note.date}`, 150, 80);

        // Produtos
        doc.rect(10, 95, 190, 50);
        doc.setFont("helvetica", "bold");
        doc.text("DADOS DO PRODUTO/SERVIÇO", 15, 105);
        doc.setFont("helvetica", "normal");
        doc.text(`DESCRIÇÃO: ${note.items}`, 15, 115);
        doc.text("QTD: 1", 130, 115);
        doc.text(`VALOR TOTAL: ${note.value}`, 160, 115);

        // Chave de Acesso
        doc.rect(10, 150, 190, 15);
        doc.setFontSize(8);
        doc.text("CHAVE DE ACESSO", 15, 155);
        doc.setFont("courier", "bold");
        doc.setFontSize(10);
        doc.text(note.key, 15, 162);

        doc.save(`nfe_${note.id}.pdf`);
    };

    return (
        <div className="space-y-4 animate-fade-in">
             {notes.length > 0 ? (
                notes.map((note, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 dark:bg-orange-900/10 rounded-bl-full -mr-4 -mt-4"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-slate-800 dark:text-white">{note.id}</h4>
                                <span className="text-xs text-slate-500">{note.date}</span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{note.items}</p>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-slate-700">
                                <span className="font-bold text-slate-900 dark:text-white">{note.value}</span>
                                <button 
                                    onClick={() => generateFiscalNotePDF(note)}
                                    className="flex items-center gap-1 text-orange-600 dark:text-orange-400 text-xs font-bold hover:bg-orange-50 dark:hover:bg-orange-900/20 px-2 py-1 rounded transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Baixar DANFE
                                </button>
                            </div>
                        </div>
                    </div>
                ))
             ) : (
                <div className="text-center py-10">
                    <p className="text-slate-500 dark:text-slate-400">Nenhuma nota fiscal encontrada.</p>
                </div>
             )}
        </div>
    );
};

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

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Ganhe R$ 20 na Relp Cell',
                    text: `Use meu código ${code} e ganhe R$ 20 de desconto na sua primeira compra!`,
                    url: 'https://relpcell.com'
                });
            } catch (e) {}
        } else {
            handleCopy();
        }
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

            <button onClick={handleShare} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Compartilhar Link
            </button>
        </div>
    );
};

const HelpView: React.FC = () => {
    const faqs = [
        { q: "Como aumento meu limite?", a: "O limite é analisado automaticamente todo mês com base nos seus pagamentos em dia." },
        { q: "Quais as formas de pagamento?", a: "Aceitamos Cartão de Crédito, Pix e Boleto Bancário parcelado." },
        { q: "Onde vejo minhas faturas?", a: "Na aba 'Faturas' você encontra todo seu histórico e pagamentos pendentes." },
        { q: "Como funciona a entrega?", a: "Entregamos em todo Brasil. O prazo é calculado no momento da compra." }
    ];

    return (
        <div className="animate-fade-in space-y-6">
            <div className="bg-indigo-600 rounded-xl p-6 text-white text-center relative overflow-hidden shadow-lg">
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                 <h3 className="text-xl font-bold relative z-10">Precisa de ajuda?</h3>
                 <p className="text-indigo-100 text-sm mt-1 relative z-10">Nossa equipe está pronta para te atender.</p>
                 <button 
                    onClick={() => window.dispatchEvent(new Event('open-support-chat'))}
                    className="mt-4 px-6 py-2 bg-white text-indigo-600 rounded-full font-bold text-sm hover:bg-indigo-50 transition-colors relative z-10"
                >
                    Abrir Chat IA
                 </button>
            </div>

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

// --- Views existentes (Reutilizadas com pequenos ajustes de estilo) ---
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


const PagePerfil: React.FC<PagePerfilProps> = ({ session }) => {
    const [activeView, setActiveView] = useState<'main' | 'data' | 'orders' | 'wallet' | 'addresses' | 'settings' | 'referral' | 'help' | 'contracts' | 'fiscal_notes'>('main');
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
             {/* Background Effects */}
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
                        {/* Nível do Cliente Mockado */}
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
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
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
                            label="Central de Ajuda" 
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
                            {activeView === 'settings' && 'Configurações'}
                            {activeView === 'referral' && 'Indique e Ganhe'}
                            {activeView === 'help' && 'Central de Ajuda'}
                        </h2>
                    </div>

                    {activeView === 'orders' && <OrdersView userId={session.user.id} />}
                    {activeView === 'wallet' && <WalletView userId={session.user.id} />}
                    {activeView === 'addresses' && <AddressView userId={session.user.id} />}
                    {activeView === 'contracts' && <ContractsView />}
                    {activeView === 'fiscal_notes' && <FiscalNotesView />}
                    {activeView === 'data' && profile && <PersonalDataView profile={profile} onUpdate={(updated) => setProfile(updated)} />}
                    {activeView === 'settings' && <SettingsView />}
                    {activeView === 'referral' && profile && <ReferralView profile={profile} />}
                    {activeView === 'help' && <HelpView />}
                </div>
            )}
        </div>
    );
};

export default PagePerfil;
