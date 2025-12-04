
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
}

// ... Textos Legais (TERMS_TEXT, PRIVACY_TEXT) mantidos ...
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

// --- Componentes Auxiliares (MenuItem, ToggleSwitch, StatBadge) mantidos ---
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

// --- Sub-Componentes de Visualização (Views) ---

const PersonalDataView: React.FC<{ profile: Profile; onUpdate: (p: Profile) => void }> = ({ profile, onUpdate }) => {
    const [formData, setFormData] = useState(profile);
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await updateProfile(formData);
            onUpdate(formData);
            addToast('Dados atualizados!', 'success');
        } catch (error) {
            addToast('Erro ao atualizar.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Meus Dados</h3>
            <InputField label="Nome" name="first_name" value={formData.first_name || ''} onChange={e => setFormData({...formData, first_name: e.target.value})} />
            <InputField label="Sobrenome" name="last_name" value={formData.last_name || ''} onChange={e => setFormData({...formData, last_name: e.target.value})} />
            <InputField label="Telefone" name="phone" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
            <InputField label="CPF" name="identification_number" value={formData.identification_number || ''} onChange={e => setFormData({...formData, identification_number: e.target.value})} disabled />
            <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">
                {isLoading ? <LoadingSpinner /> : 'Salvar Alterações'}
            </button>
        </form>
    );
};

const OrdersView: React.FC<{ userId: string }> = ({ userId }) => {
    const [orders, setOrders] = useState<any[]>([]);
    useEffect(() => {
        supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(({ data }) => setOrders(data || []));
    }, [userId]);

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Meus Pedidos</h3>
            {orders.length === 0 ? <p className="text-slate-500">Nenhum pedido recente.</p> : orders.map(o => (
                <div key={o.id} className="p-4 border rounded-xl dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="flex justify-between">
                        <p className="font-bold text-sm dark:text-white">Pedido #{o.id.slice(0,8)}</p>
                        <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <p className="text-sm dark:text-slate-300">Total: R$ {o.total.toFixed(2)}</p>
                    <p className="text-xs font-bold text-indigo-600 uppercase mt-1">{o.status}</p>
                </div>
            ))}
        </div>
    );
};

const WalletView: React.FC<{ userId: string }> = () => (
    <div className="text-center p-8 bg-slate-50 dark:bg-slate-800 rounded-xl">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Minha Carteira</h3>
        <p className="text-slate-500 text-sm mt-2">Funcionalidade de carteira e chaves Pix em breve.</p>
    </div>
);

const AddressView: React.FC<{ profile: Profile; onUpdate: (p: Profile) => void }> = ({ profile, onUpdate }) => {
    const [address, setAddress] = useState({
        zip_code: profile.zip_code || '',
        street_name: profile.street_name || '',
        street_number: profile.street_number || '',
        neighborhood: profile.neighborhood || '',
        city: profile.city || '',
        federal_unit: profile.federal_unit || ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const updated = { ...profile, ...address };
            await updateProfile(updated);
            onUpdate(updated);
            addToast('Endereço atualizado!', 'success');
        } catch (error) {
            addToast('Erro ao salvar.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Endereço</h3>
            <InputField label="CEP" name="zip_code" value={address.zip_code} onChange={e => setAddress({...address, zip_code: e.target.value})} />
            <InputField label="Rua" name="street_name" value={address.street_name} onChange={e => setAddress({...address, street_name: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
                <InputField label="Número" name="street_number" value={address.street_number} onChange={e => setAddress({...address, street_number: e.target.value})} />
                <InputField label="Bairro" name="neighborhood" value={address.neighborhood} onChange={e => setAddress({...address, neighborhood: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <InputField label="Cidade" name="city" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} />
                <InputField label="UF" name="federal_unit" value={address.federal_unit} onChange={e => setAddress({...address, federal_unit: e.target.value})} />
            </div>
            <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold mt-4">
                {isLoading ? <LoadingSpinner /> : 'Salvar Endereço'}
            </button>
        </form>
    );
}

const ReferralView: React.FC<{ userId: string }> = ({ userId }) => {
    const code = `RELP-${userId.slice(0,4).toUpperCase()}`;
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        alert("Código copiado!");
    }
    return (
        <div className="text-center p-6 space-y-4 bg-indigo-50 dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-slate-700">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-2xl">🎁</div>
            <h3 className="font-bold text-lg text-indigo-900 dark:text-white">Indique e Ganhe</h3>
            <p className="text-sm text-indigo-700 dark:text-slate-300">Compartilhe seu código com amigos. Quando eles se cadastrarem, ambos ganham pontos!</p>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-indigo-200 dark:border-slate-700 cursor-pointer" onClick={handleCopy}>
                <p className="font-mono text-xl font-bold tracking-widest text-indigo-600 dark:text-indigo-400">{code}</p>
                <p className="text-[10px] text-slate-400 mt-1">Toque para copiar</p>
            </div>
        </div>
    );
};

const HelpView: React.FC<{ userId: string }> = () => (
    <div className="space-y-4">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Central de Ajuda</h3>
        <p className="text-slate-500 text-sm">Precisa de ajuda com suas faturas ou pedidos?</p>
        <button onClick={() => window.dispatchEvent(new Event('open-support-chat'))} className="w-full p-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl flex items-center gap-4 hover:shadow-md transition-shadow">
            <span className="text-3xl">💬</span>
            <div className="text-left">
                <p className="font-bold text-slate-900 dark:text-white">Chat com Suporte</p>
                <p className="text-xs text-slate-500">Falar com nosso assistente virtual ou atendente</p>
            </div>
        </button>
    </div>
);

const FiscalNotesView: React.FC<{ userId: string }> = () => (
    <div className="text-center p-10 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Notas Fiscais</h3>
        <p className="text-slate-500 text-sm mt-1">Nenhuma nota fiscal disponível para download no momento.</p>
    </div>
);

const PaymentReceiptsView: React.FC<{ userId: string; profile: Profile }> = ({ userId }) => {
    const [receipts, setReceipts] = useState<Invoice[]>([]);
    useEffect(() => {
        supabase.from('invoices').select('*').eq('user_id', userId).eq('status', 'Paga').order('payment_date', { ascending: false }).then(({ data }) => setReceipts(data || []));
    }, [userId]);

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Comprovantes de Pagamento</h3>
            {receipts.length === 0 ? <p className="text-slate-500 text-center p-8">Nenhum pagamento realizado.</p> : receipts.map(r => (
                <div key={r.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                    <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{r.month}</p>
                        <p className="text-xs text-slate-500">{new Date(r.payment_date || '').toLocaleDateString()} às {new Date(r.payment_date || '').toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                    </div>
                    <div className="text-right">
                        <span className="block font-bold text-green-600">R$ {r.amount.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Pago</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- ContractsView ---
const ContractsView: React.FC<{ profile: Profile }> = ({ profile }) => {
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

    // FUNÇÃO DE PDF OTIMIZADA PARA 1 PÁGINA
    const handleDownloadPDF = (contract: Contract) => {
        const doc = new jsPDF({
            format: 'a4',
            unit: 'mm'
        });
        
        // Configurações de Fonte
        const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
        const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);
        
        // Cabeçalho
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(contract.title || "CONTRATO DE VENDA", pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`ID: ${contract.id}`, pageWidth - margin, 10, { align: 'right' });

        // Corpo do Texto (Fonte reduzida e espaçamento compacto)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        // Quebra o texto para caber na largura
        const textLines = doc.splitTextToSize(contract.items || "", contentWidth);
        
        // Imprime o texto
        let yPos = 35;
        doc.text(textLines, margin, yPos);
        
        // Calcula onde o texto terminou
        yPos += (textLines.length * 4) + 10; // 4mm por linha aprox (leading)

        // Dados Finais
        doc.setFont('helvetica', 'bold');
        doc.text(`Data: ${new Date(contract.created_at).toLocaleDateString('pt-BR')}`, margin, yPos);
        yPos += 5;
        doc.text(`Valor Total: R$ ${contract.total_value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, yPos);
        yPos += 5;
        doc.text(`Status: ${contract.status.toUpperCase()}`, margin, yPos);
        yPos += 15;

        // Verifica se há espaço para assinatura na mesma página
        // Se yPos > 250mm, cria nova página para não cortar
        if (yPos > (pageHeight - 50)) {
            doc.addPage();
            yPos = 20;
        }
        
        // Assinatura Digital
        if ((contract.status === 'Ativo' || contract.status === 'Assinado') && contract.signature_data) {
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text("Assinado Digitalmente:", margin, yPos);
            yPos += 2;
            
            // Desenha a assinatura (imagem)
            if (contract.signature_data.startsWith('data:image')) {
                doc.addImage(contract.signature_data, 'PNG', margin, yPos, 50, 25);
                // Linha e nome abaixo
                yPos += 25;
                doc.line(margin, yPos, margin + 50, yPos); 
                yPos += 4;
                doc.text("Cliente / Comprador", margin, yPos);
            }
        }

        // Rodapé
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text("Documento gerado eletronicamente pela Relp Cell.", pageWidth / 2, pageHeight - 10, { align: 'center' });

        doc.save(`Contrato_${contract.id.slice(0,8)}.pdf`);
        addToast("PDF gerado em formato compacto!", "success");
    };

    const handleSignSubmit = async () => {
        if (!signingContract || !signature) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('contracts')
                .update({ 
                    status: 'Assinado', 
                    signature_data: signature, 
                    terms_accepted: true 
                })
                .eq('id', signingContract.id);

            if (error) throw error;

            await supabase
                .from('invoices')
                .update({ status: 'Em aberto' })
                .eq('user_id', profile.id)
                .eq('status', 'Aguardando Assinatura');

            addToast("Contrato assinado com sucesso!", "success");
            setSigningContract(null);
            setSignature(null);
            fetchContracts(); 
        } catch (e) {
            console.error(e);
            addToast("Erro ao assinar contrato.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><LoadingSpinner /></div>;

    const pendingContracts = contracts.filter(c => c.status === 'pending_signature');
    const historyContracts = contracts.filter(c => c.status !== 'pending_signature');

    return (
        <div className="space-y-6 animate-fade-in">
            
            {/* Seção de Pendentes */}
            <div>
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Aguardando Assinatura</h3>
                {pendingContracts.length === 0 ? (
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-center text-sm text-slate-400">
                        Nenhum contrato pendente.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendingContracts.map(contract => (
                            <div key={contract.id} className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-bold text-yellow-800 dark:text-yellow-100 text-sm">{contract.title}</h4>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-200 mt-1">Criado em: {new Date(contract.created_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <span className="text-[10px] bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-bold uppercase">Pendente</span>
                                </div>
                                <div className="text-xs text-yellow-800 dark:text-yellow-200 mb-3">
                                    Valor: R$ {contract.total_value?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </div>
                                <button 
                                    onClick={() => setSigningContract(contract)}
                                    className="w-full py-2.5 bg-yellow-600 text-white text-xs font-bold rounded-lg hover:bg-yellow-700 transition-colors shadow-sm"
                                >
                                    Ler e Assinar
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Seção de Histórico */}
            <div>
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Histórico de Contratos</h3>
                {historyContracts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        Você ainda não possui contratos finalizados.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {historyContracts.map(contract => (
                            <div key={contract.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{contract.title}</h4>
                                        <p className="text-xs text-slate-500">Assinado em: {new Date(contract.created_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                        contract.status === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                        {contract.status === 'Ativo' ? 'Assinado' : contract.status}
                                    </span>
                                </div>
                                
                                <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-700/50">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        R$ {contract.total_value?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                    </span>
                                    <button 
                                        onClick={() => handleDownloadPDF(contract)}
                                        className="text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:underline flex items-center gap-1"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Baixar PDF
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>

            {/* Modal de Assinatura */}
            <Modal isOpen={!!signingContract} onClose={() => setSigningContract(null)}>
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Assinar Contrato</h3>
                    <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-600 whitespace-pre-wrap">
                        {signingContract?.items}
                    </div>
                    <label className="block text-sm font-medium mb-2">Sua Assinatura:</label>
                    <SignaturePad onEnd={setSignature} />
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setSigningContract(null)} className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 text-sm font-bold">Cancelar</button>
                        <button 
                            onClick={handleSignSubmit} 
                            disabled={!signature || isSubmitting}
                            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex justify-center"
                        >
                            {isSubmitting ? <LoadingSpinner /> : 'Confirmar Assinatura'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const SettingsView: React.FC<{ toggleTheme?: () => void; isDarkMode?: boolean; userId: string; profile: Profile }> = ({ toggleTheme, isDarkMode, userId, profile }) => {
    const [notifs, setNotifs] = useState({ push: true, email: true });
    const [showChangeDateModal, setShowChangeDateModal] = useState(false);
    const [newDueDay, setNewDueDay] = useState<number | null>(null);
    const [isSubmittingDate, setIsSubmittingDate] = useState(false);
    const { addToast } = useToast();

    // Validação de 90 dias para troca de data
    const canChangeDate = useMemo(() => {
        if (!profile.last_due_date_change) return true;
        const last = new Date(profile.last_due_date_change);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - last.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 90;
    }, [profile.last_due_date_change]);

    const daysLeft = useMemo(() => {
        if (canChangeDate || !profile.last_due_date_change) return 0;
        const last = new Date(profile.last_due_date_change);
        const nextDate = new Date(last);
        nextDate.setDate(last.getDate() + 90);
        const now = new Date();
        return Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }, [canChangeDate, profile.last_due_date_change]);

    const handleChangeDateRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDueDay) {
            addToast('Escolha um dia.', 'error');
            return;
        }
        setIsSubmittingDate(true);
        try {
            const res = await fetch('/api/admin/update-due-day', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId, newDay: newDueDay })
            });
            
            if (res.ok) {
                addToast('Data de vencimento atualizada com sucesso! As faturas foram recalculadas.', 'success');
                setShowChangeDateModal(false);
                // Reload page to refresh profile data
                setTimeout(() => window.location.reload(), 2000);
            } else {
                throw new Error("Erro ao atualizar.");
            }
        } catch (err) {
            addToast('Erro ao atualizar data.', 'error');
        } finally {
            setIsSubmittingDate(false);
        }
    };

    return (
        <div className="animate-fade-in space-y-6 pb-10">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Preferências</h3>
                
                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Modo Escuro</span>
                    <button onClick={toggleTheme} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                <button 
                    onClick={() => canChangeDate ? setShowChangeDateModal(true) : addToast(`Aguarde ${daysLeft} dias para alterar novamente.`, 'error')}
                    className={`w-full text-left py-3 text-sm flex justify-between items-center border-b border-slate-100 dark:border-slate-700 last:border-0 mt-2 ${canChangeDate ? 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 cursor-pointer' : 'text-slate-400 cursor-not-allowed'}`}
                >
                    <div>
                        <span className="block font-medium">Alterar Vencimento</span>
                        <span className="text-xs text-slate-500">Dia atual: {profile.preferred_due_day || 10}</span>
                    </div>
                    {canChangeDate ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    ) : (
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">Em {daysLeft} dias</span>
                    )}
                </button>
            </div>

            {/* Modal Alteração de Data */}
            <Modal isOpen={showChangeDateModal} onClose={() => setShowChangeDateModal(false)}>
                <div className="text-slate-900 dark:text-white space-y-4">
                    <h3 className="text-xl font-bold">Novo Dia de Vencimento</h3>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            <strong>Atenção:</strong> Você só pode alterar esta data a cada 90 dias. As faturas em aberto terão seus dias ajustados para o novo vencimento no mesmo mês.
                        </p>
                    </div>
                    
                    <form onSubmit={handleChangeDateRequest}>
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {[5, 15, 25].map(day => (
                                <button 
                                    key={day}
                                    type="button"
                                    onClick={() => setNewDueDay(day)}
                                    className={`py-3 rounded-lg text-sm font-bold border transition-colors ${newDueDay === day ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-200'}`}
                                >
                                    Dia {day}
                                </button>
                            ))}
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSubmittingDate || !newDueDay}
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center"
                        >
                            {isSubmittingDate ? <LoadingSpinner /> : 'Confirmar Alteração'}
                        </button>
                    </form>
                </div>
            </Modal>
        </div>
    );
};

// Re-exportando PagePerfil com as Views integradas
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
                </div>
             </div>
        </div>
    );

    return (
        <div className="w-full max-w-md p-4 mx-auto pb-24">
            {activeView === 'main' ? (
                <div className="animate-fade-in">
                    {renderHeader()}

                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide mb-2">Minha Conta</h3>
                        <MenuItem 
                            label="Meus Dados" 
                            description="Nome, CPF, Telefone"
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                            onClick={() => setActiveView('data')} 
                        />
                        <MenuItem 
                            label="Endereços" 
                            description="Gerenciar entrega"
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                            onClick={() => setActiveView('addresses')} 
                        />
                         <MenuItem 
                            label="Meus Pedidos" 
                            description="Histórico de compras"
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                            onClick={() => setActiveView('orders')}
                        />
                         <MenuItem 
                            label="Minha Carteira" 
                            description="Chaves Pix"
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                            onClick={() => setActiveView('wallet')}
                        />

                        <MenuItem 
                            label="Contratos" 
                            description="Meus contratos"
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                            onClick={() => setActiveView('contracts')}
                        />
                         <MenuItem 
                            label="Notas Fiscais" 
                            description="Documentos fiscais"
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                            onClick={() => setActiveView('fiscal_notes')}
                        />

                        <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide mb-2 mt-6">Suporte</h3>

                         <MenuItem 
                            label="Indique e Ganhe" 
                            description="Programa de indicação"
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 012 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>}
                            onClick={() => setActiveView('referral')}
                            colorClass="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                        />

                         <MenuItem 
                            label="Central de Ajuda" 
                            description="Fale conosco"
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                            onClick={() => setActiveView('help')}
                        />

                        <MenuItem 
                            label="Configurações" 
                            description="Preferências e Vencimento"
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                            onClick={() => setActiveView('settings')}
                        />

                        <div className="pt-4">
                            <button onClick={handleLogout} className="w-full py-3 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                Sair do Aplicativo
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <button onClick={() => setActiveView('main')} className="flex items-center text-slate-500 mb-4 hover:text-indigo-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Voltar
                    </button>
                    
                    {activeView === 'data' && profile && <PersonalDataView profile={profile} onUpdate={(p) => setProfile(p)} />}
                    {activeView === 'orders' && <OrdersView userId={session.user.id} />}
                    {activeView === 'wallet' && <WalletView userId={session.user.id} />}
                    {activeView === 'addresses' && profile && <AddressView profile={profile} onUpdate={(p) => setProfile(p)} />}
                    {activeView === 'settings' && profile && <SettingsView toggleTheme={toggleTheme} isDarkMode={isDarkMode} userId={session.user.id} profile={profile} />}
                    {activeView === 'referral' && <ReferralView userId={session.user.id} />}
                    {activeView === 'help' && <HelpView userId={session.user.id} />}
                    {activeView === 'contracts' && profile && <ContractsView profile={profile} />}
                    {activeView === 'fiscal_notes' && <FiscalNotesView userId={session.user.id} />}
                    {activeView === 'receipts' && profile && <PaymentReceiptsView userId={session.user.id} profile={profile} />}
                </div>
            )}
        </div>
    );
};

export default PagePerfil;
