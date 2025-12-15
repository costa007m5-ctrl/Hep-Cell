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

// --- Views Implementadas ---

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

    const handleDownloadPDF = (contract: Contract) => {
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(contract.title || "CONTRATO", 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        const splitText = doc.splitTextToSize(contract.items || "", 180);
        doc.text(splitText, 15, 40);
        
        let yPos = 40 + (splitText.length * 5) + 20;

        doc.text(`Data de Criação: ${new Date(contract.created_at).toLocaleDateString('pt-BR')}`, 15, yPos);
        yPos += 10;
        doc.text(`Valor Total: R$ ${contract.total_value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 15, yPos);
        yPos += 10;
        doc.text(`Status: ${contract.status.toUpperCase()}`, 15, yPos);
        
        // Tenta exibir assinatura se estiver disponível
        if ((contract.status === 'Ativo' || contract.status === 'Assinado') && contract.signature_data) {
            yPos += 20;
            doc.text("Assinatura Digital:", 15, yPos);
            if (contract.signature_data.startsWith('data:image')) {
                doc.addImage(contract.signature_data, 'PNG', 15, yPos + 5, 60, 30);
            }
        }

        doc.save(`Contrato_${contract.id.slice(0,8)}.pdf`);
        addToast("Download iniciado!", "success");
    };

    const handleSignSubmit = async () => {
        if (!signingContract || !signature) return;
        setIsSubmitting(true);
        try {
            // Usa 'Assinado' para consistência
            const { error } = await supabase
                .from('contracts')
                .update({ 
                    status: 'Assinado', 
                    signature_data: signature, 
                    terms_accepted: true 
                })
                .eq('id', signingContract.id);

            if (error) throw error;

            // Ativa faturas relacionadas
            await supabase
                .from('invoices')
                .update({ status: 'Em aberto' })
                .eq('user_id', profile.id)
                .eq('status', 'Aguardando Assinatura');

            addToast("Contrato assinado com sucesso!", "success");
            setSigningContract(null);
            setSignature(null);
            fetchContracts(); // Atualiza lista
        } catch (e) {
            console.error(e);
            addToast("Erro ao assinar contrato.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><LoadingSpinner /></div>;

    // Filter Logic: 'pending_signature' vs everything else
    const pendingContracts = contracts.filter(c => c.status === 'pending_signature');
    // History contains everything NOT pending (Active, Signed, Cancelled, etc.)
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
                                        Baixar Cópia
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

const SettingsView: React.FC<{ toggleTheme?: () => void; isDarkMode?: boolean; userId: string }> = ({ toggleTheme, isDarkMode, userId }) => {
    const [notifs, setNotifs] = useState({ push: true, email: true, whatsapp: false });
    const [biometrics, setBiometrics] = useState(false);
    const [privacyCredit, setPrivacyCredit] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [legalModalContent, setLegalModalContent] = useState<'terms' | 'privacy' | null>(null);
    const [showChangeDateModal, setShowChangeDateModal] = useState(false);
    
    const [newDueDay, setNewDueDay] = useState(10);
    const [reason, setReason] = useState('');
    const [isSubmittingDate, setIsSubmittingDate] = useState(false);

    const { addToast } = useToast();

    useEffect(() => {
        // Check saved preferences
        const bio = localStorage.getItem('relp_biometrics') === 'true';
        setBiometrics(bio);
    }, []);

    const handleBiometricToggle = (value: boolean) => {
        if (value) {
            if (window.PublicKeyCredential) {
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
        setTimeout(() => {
            localStorage.clear(); 
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

    const handleChangeDateRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            addToast('Por favor, informe o motivo.', 'error');
            return;
        }
        setIsSubmittingDate(true);
        try {
            const { error } = await supabase.from('due_date_requests').insert({
                user_id: userId,
                current_day: 10, // Default or fetch from profile
                requested_day: newDueDay,
                reason: reason,
                status: 'pending'
            });

            if (error) throw error;
            addToast('Solicitação enviada! Aguarde aprovação.', 'success');
            setShowChangeDateModal(false);
            setReason('');
        } catch (err) {
            addToast('Erro ao enviar solicitação.', 'error');
        } finally {
            setIsSubmittingDate(false);
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
                
                {/* Novo Botão para Alterar Data de Vencimento */}
                <button 
                    onClick={() => setShowChangeDateModal(true)}
                    className="w-full text-left py-3 text-sm text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors flex justify-between items-center border-b border-slate-100 dark:border-slate-700 last:border-0 mt-2"
                >
                    <div>
                        <span className="block font-medium">Alterar Data de Vencimento</span>
                        <span className="text-xs text-slate-500">Mude o dia de pagamento das faturas</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
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

            {/* Legal & Sobre */}
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

            {/* Modal Alteração de Data */}
            <Modal isOpen={showChangeDateModal} onClose={() => setShowChangeDateModal(false)}>
                <div className="text-slate-900 dark:text-white space-y-4">
                    <h3 className="text-xl font-bold">Alterar Data de Vencimento</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Escolha o melhor dia para o vencimento das suas faturas. A mudança será analisada e aplicada nas faturas em aberto com possível reajuste proporcional de juros.
                    </p>
                    
                    <form onSubmit={handleChangeDateRequest}>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {[5, 15, 25].map(day => (
                                <button 
                                    key={day}
                                    type="button"
                                    onClick={() => setNewDueDay(day)}
                                    className={`py-3 rounded-lg text-sm font-bold border transition-colors ${newDueDay === day ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}
                                >
                                    Dia {day}
                                </button>
                            ))}
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-bold mb-2">Motivo da alteração:</label>
                            <textarea 
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Ex: Recebo meu salário dia 05..."
                                rows={3}
                                required
                            ></textarea>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSubmittingDate}
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center"
                        >
                            {isSubmittingDate ? <LoadingSpinner /> : 'Solicitar Alteração'}
                        </button>
                    </form>
                </div>
            </Modal>
        </div>
    );
};

// --- REFERRAL HUB PREMIUM ---
const ReferralView: React.FC<{ userId: string }> = ({ userId }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showConfetti, setShowConfetti] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/get-referral-data?userId=${userId}`, { method: 'GET' });
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                    if (result.totalEarnings > 0 && Math.random() > 0.7) setShowConfetti(true);
                } else {
                    setData({ totalEarnings: 0, pendingEarnings: 0, referralCode: '---', referrals: [] });
                }
            } catch (e) {
                console.error(e);
                setData({ totalEarnings: 0, pendingEarnings: 0, referralCode: '---', referrals: [] });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userId]);

    const handleCopy = () => {
        if (data?.referralCode) {
            navigator.clipboard.writeText(data.referralCode);
            addToast('Código copiado! Compartilhe com amigos.', 'success');
            if (navigator.vibrate) navigator.vibrate([50]);
        }
    };

    const handleShare = async () => {
        if (navigator.share && data) {
            try {
                await navigator.share({
                    title: 'Ganhe R$ 20 na Relp Cell!',
                    text: `Use meu código ${data.referralCode} e ganhe R$ 20 de desconto na primeira compra!`,
                    url: data.referralLink
                });
            } catch (err) {}
        } else {
            handleCopy();
        }
    };

    if (loading) return <div className="flex justify-center p-10"><LoadingSpinner /></div>;
    if (!data) return <div className="p-10 text-center text-slate-500">Erro ao carregar dados.</div>;

    // Níveis de Embaixador
    const totalInvites = data.referrals?.length || 0;
    const level = totalInvites < 5 ? 'Bronze' : totalInvites < 15 ? 'Prata' : totalInvites < 30 ? 'Ouro' : 'Diamante';
    const nextLevel = totalInvites < 5 ? 5 : totalInvites < 15 ? 15 : totalInvites < 30 ? 30 : 100;
    const progress = Math.min(100, (totalInvites / nextLevel) * 100);
    const levelColor = level === 'Bronze' ? 'from-orange-700 to-amber-600' : level === 'Prata' ? 'from-slate-400 to-zinc-500' : level === 'Ouro' ? 'from-yellow-400 to-yellow-600' : 'from-cyan-400 to-blue-600';

    return (
        <div className="animate-fade-in pb-6">
            {showConfetti && <Confetti />}
            
            {/* Hero Card: Golden Ticket Style */}
            <div className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl bg-gradient-to-br ${levelColor} mb-6 mx-2 transform transition-transform hover:scale-[1.01]`}>
                {/* Holographic overlay effect */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <div className="relative z-10 text-center">
                    <div className="inline-block px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest mb-2 border border-white/20">
                        Embaixador {level}
                    </div>
                    
                    <p className="text-xs text-white/80 font-medium uppercase tracking-wide mb-1">Saldo de Indicações</p>
                    <h2 className="text-4xl font-black tracking-tighter drop-shadow-md">
                        R$ {(data.totalEarnings || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </h2>
                    
                    {(data.pendingEarnings || 0) > 0 && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg border border-white/10 backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                            <span className="text-xs font-medium text-white/90">R$ {data.pendingEarnings.toLocaleString('pt-BR', {minimumFractionDigits: 2})} pendentes</span>
                        </div>
                    )}
                </div>

                {/* Code Section */}
                <div className="mt-6 bg-black/20 backdrop-blur-lg rounded-xl p-4 border border-white/10 flex items-center justify-between relative overflow-hidden group" onClick={handleCopy}>
                    <div className="flex flex-col text-left">
                        <span className="text-[9px] uppercase text-white/60 font-bold">Seu Código Único</span>
                        <span className="font-mono text-xl font-bold tracking-widest text-white group-active:scale-95 transition-transform">{data.referralCode}</span>
                    </div>
                    <button className="p-2 bg-white text-slate-900 rounded-lg shadow-lg hover:bg-slate-100 active:scale-90 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                    </button>
                </div>
            </div>

            {/* Level Progress */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mx-2 mb-6">
                <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                    <span>Progresso Nível {level}</span>
                    <span>{totalInvites} / {nextLevel} convites</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${levelColor}`} style={{width: `${progress}%`}}></div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-center">
                    Convide mais {nextLevel - totalInvites} amigos para subir de nível e desbloquear bônus extras!
                </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 px-2 mb-6">
                <button 
                    onClick={handleShare}
                    className="py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                    WhatsApp
                </button>
                <button 
                    onClick={handleCopy}
                    className="py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95"
                >
                    Copiar Link
                </button>
            </div>

            {/* Referrals List */}
            <div className="px-2">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 pl-2">Histórico de Amigos</h3>
                
                {!data.referrals || data.referrals.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <div className="text-4xl mb-2">😢</div>
                        <p className="text-slate-500 font-medium">Nenhuma indicação ainda.</p>
                        <p className="text-xs text-slate-400">Compartilhe seu código para começar a ganhar!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {data.referrals.map((ref: any) => (
                            <div key={ref.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                                        ref.status === 'paid' || ref.status === 'purchased' ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                                    }`}>
                                        {ref.profiles?.first_name?.[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{ref.profiles?.first_name}</p>
                                        <p className="text-[10px] text-slate-500">{new Date(ref.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${
                                        ref.status === 'paid' ? 'bg-green-100 text-green-700' : 
                                        ref.status === 'purchased' ? 'bg-blue-100 text-blue-700' : 
                                        'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {ref.status === 'registered' ? 'Cadastrou' : ref.status === 'purchased' ? 'Comprou' : 'Pago'}
                                    </span>
                                    {ref.status !== 'registered' && (
                                        <p className="text-[10px] font-bold text-green-600 mt-1">+ R$ {ref.reward_amount}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const FiscalNotesView: React.FC<{ userId: string }> = ({ userId }) => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInvoices = async () => {
            setLoading(true);
            try {
                // Busca faturas pagas
                const { data, error } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('status', 'Paga')
                    .order('payment_date', { ascending: false });
                
                if (!error && data) setInvoices(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchInvoices();
    }, [userId]);

    const handleDownloadNFe = async (invoice: Invoice) => {
        const doc = new jsPDF();
        
        // Cabeçalho da DANFE
        doc.setFontSize(10);
        doc.text("DANFE - Documento Auxiliar da Nota Fiscal Eletrônica", 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("RELP CELL ELETRÔNICOS LTDA", 20, 30);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text("Avenida Principal, 123 - Centro, Macapá - AP", 20, 35);
        doc.text("CNPJ: 43.735.304/0001-00  |  IE: Isento", 20, 40);
        
        // Chave de Acesso (Simulada)
        const accessKey = `1624${invoice.id.replace(/-/g, '').substring(0, 36)}55001000001234100001234`; 
        doc.rect(120, 25, 80, 20); 
        doc.setFontSize(8);
        doc.text("Chave de Acesso", 122, 29);
        doc.setFontSize(7);
        doc.text(accessKey, 122, 35);
        
        // Código de Barras (Simulado)
        doc.setLineWidth(0.5);
        for(let i=0; i<40; i++) {
            const w = Math.random() * 1.5 + 0.5;
            doc.rect(125 + (i*1.8), 38, w, 5, 'F');
        }

        // Destinatário
        doc.rect(10, 50, 190, 25);
        doc.setFontSize(8);
        doc.text("DESTINATÁRIO / REMETENTE", 12, 54);
        doc.text(`Nome/Razão Social: CONSUMIDOR FINAL`, 15, 60);
        doc.text(`Endereço: -`, 15, 65);
        doc.text(`Data Emissão: ${new Date(invoice.payment_date || new Date()).toLocaleDateString('pt-BR')}`, 150, 60);

        // Dados do Produto
        doc.rect(10, 80, 190, 60);
        doc.text("DADOS DO PRODUTO / SERVIÇO", 12, 84);
        
        // Tabela
        let y = 95;
        doc.setFont('helvetica', 'bold');
        doc.text("Descrição", 15, 90);
        doc.text("Qtd", 120, 90);
        doc.text("V. Unit", 140, 90);
        doc.text("V. Total", 170, 90);
        doc.line(10, 92, 200, 92);
        
        doc.setFont('helvetica', 'normal');
        // Item
        const desc = invoice.month || invoice.notes || "Produto Diversos";
        const valor = invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        doc.text(desc.substring(0, 50), 15, y);
        doc.text("1", 120, y);
        doc.text(valor, 140, y);
        doc.text(valor, 170, y);

        // Totais
        doc.rect(10, 145, 190, 15);
        doc.text("CÁLCULO DO IMPOSTO", 12, 149);
        doc.text(`Valor Total dos Produtos: R$ ${valor}`, 15, 155);
        doc.text(`Valor Total da Nota: R$ ${valor}`, 120, 155);

        doc.save(`NFe_${invoice.id}.pdf`);
    };

    if (loading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

    if (invoices.length === 0) {
        return (
            <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p>Nenhuma nota fiscal disponível.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 animate-fade-in">
            {invoices.map(invoice => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">NFe #{invoice.id.substring(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-slate-500">Emissão: {new Date(invoice.payment_date!).toLocaleDateString('pt-BR')}</p>
                        <p className="text-xs text-slate-500 mt-1 truncate w-48">{invoice.month}</p>
                    </div>
                    <button 
                        onClick={() => handleDownloadNFe(invoice)}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
                        title="Baixar DANFE (PDF)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </button>
                </div>
            ))}
        </div>
    );
};

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

const HelpView: React.FC<{ userId: string }> = ({ userId }) => {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewTicket, setShowNewTicket] = useState(false);
    const [newTicket, setNewTicket] = useState({ subject: '', message: '', category: 'Geral' });
    const [submitting, setSubmitting] = useState(false);
    const { addToast } = useToast();

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/support-tickets?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                setTickets(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [userId]);

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/support-tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    subject: newTicket.subject,
                    message: newTicket.message,
                    category: newTicket.category,
                    priority: 'Normal'
                })
            });
            
            if (res.ok) {
                addToast('Chamado aberto com sucesso!', 'success');
                setShowNewTicket(false);
                setNewTicket({ subject: '', message: '', category: 'Geral' });
                fetchTickets();
            } else {
                throw new Error('Erro ao criar chamado');
            }
        } catch (error) {
            addToast('Erro ao criar chamado.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-indigo-900 dark:text-white">Meus Chamados</h3>
                    <button 
                        onClick={() => setShowNewTicket(!showNewTicket)}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        {showNewTicket ? 'Cancelar' : 'Novo Chamado'}
                    </button>
                </div>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    Acompanhe o status das suas solicitações de suporte.
                </p>
            </div>

            {showNewTicket && (
                <form onSubmit={handleCreateTicket} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 mb-4">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Abrir Novo Chamado</h4>
                    
                    <InputField 
                        label="Assunto" 
                        name="subject" 
                        value={newTicket.subject} 
                        onChange={e => setNewTicket({...newTicket, subject: e.target.value})} 
                        required 
                    />
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                        <select 
                            value={newTicket.category} 
                            onChange={e => setNewTicket({...newTicket, category: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                            <option value="Geral">Geral</option>
                            <option value="Financeiro">Financeiro</option>
                            <option value="Técnico">Técnico</option>
                            <option value="Vendas">Vendas</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mensagem</label>
                        <textarea 
                            rows={3} 
                            value={newTicket.message} 
                            onChange={e => setNewTicket({...newTicket, message: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                            required
                        ></textarea>
                    </div>

                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex justify-center"
                    >
                        {submitting ? <LoadingSpinner /> : 'Enviar Solicitação'}
                    </button>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-10"><LoadingSpinner /></div>
            ) : tickets.length === 0 ? (
                <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    <p>Nenhum chamado encontrado.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {tickets.map(ticket => (
                        <div key={ticket.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">{ticket.subject}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${ticket.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {ticket.status === 'open' ? 'Aberto' : 'Fechado'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-500">
                                <span>{ticket.category}</span>
                                <span>{new Date(ticket.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
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
                        <StatBadge label="Docs" value="0" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
                    </div>

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
                            description="Preferências do app"
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
                    {activeView === 'settings' && <SettingsView toggleTheme={toggleTheme} isDarkMode={isDarkMode} userId={session.user.id} />}
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