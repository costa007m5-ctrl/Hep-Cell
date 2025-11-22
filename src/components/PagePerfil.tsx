
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/clients';
import { getProfile, updateProfile } from '../services/profileService';
import { Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import InputField from './InputField';
import { useToast } from './Toast';
import ReceiptDetails from './ReceiptDetails';

interface PagePerfilProps {
    session: Session;
}

// --- Dados da Base de Conhecimento (50+ FAQs) ---
const faqDatabase = [
    // FINANCEIRO
    { category: 'Financeiro', q: 'Quais as formas de pagamento aceitas?', a: 'Aceitamos PIX (aprovação imediata), Cartão de Crédito em até 12x e Boleto Bancário.' },
    { category: 'Financeiro', q: 'Onde vejo a linha digitável do boleto?', a: 'Na aba "Faturas", clique em "Pagar" e selecione Boleto. Após gerar, você verá a opção de copiar o código.' },
    { category: 'Financeiro', q: 'Paguei via Boleto, quando libera?', a: 'Pagamentos via boleto podem levar até 2 dias úteis (48h) para serem compensados pelo banco.' },
    { category: 'Financeiro', q: 'Paguei via PIX, mas consta pendente.', a: 'O PIX costuma ser instantâneo. Se demorar mais de 15 min, feche e abra o app. Se persistir, abra um chamado enviando o comprovante.' },
    { category: 'Financeiro', q: 'Posso pagar fatura atrasada?', a: 'Sim. Os encargos serão calculados automaticamente na próxima fatura ou no ato do pagamento.' },
    { category: 'Financeiro', q: 'Como antecipar parcelas?', a: 'Vá em "Faturas", expanda a compra desejada e selecione as parcelas futuras que deseja pagar. Você ganha desconto automático.' },
    { category: 'Financeiro', q: 'Onde vejo meu comprovante?', a: 'Na aba "Faturas", clique em "Histórico". Selecione a fatura paga e clique em "Ver Comprovante".' },
    { category: 'Financeiro', q: 'Meu cartão foi recusado, o que fazer?', a: 'Verifique se há limite disponível e se os dados estão corretos. Por segurança, o banco emissor pode bloquear compras online.' },
    { category: 'Financeiro', q: 'Cobrança duplicada na fatura.', a: 'Se identificar duplicidade, abra um chamado imediatamente na categoria "Financeiro" com o print da cobrança.' },
    { category: 'Financeiro', q: 'Como funciona o desconto à vista?', a: 'Pagamentos via PIX ou 1x no cartão possuem desconto promocional já aplicado no valor final.' },
    { category: 'Financeiro', q: 'Posso alterar a data de vencimento?', a: 'A data é definida no momento da compra/contrato. Para alterar, entre em contato com o suporte via WhatsApp.' },
    
    // CRÉDITO E LIMITES
    { category: 'Crédito', q: 'Como aumento meu limite?', a: 'O limite é analisado mensalmente. Pague em dia, mantenha seu score alto e use o app frequentemente para aumentar suas chances.' },
    { category: 'Crédito', q: 'O que é o Score Relp?', a: 'É uma pontuação interna baseada no seu histórico de pagamentos e comportamento de compra conosco.' },
    { category: 'Crédito', q: 'Por que meu pedido foi negado?', a: 'A análise de crédito considera vários fatores: renda presumida, histórico de pagamentos e score externo. Tente novamente em 30 dias.' },
    { category: 'Crédito', q: 'Como solicitar nova análise?', a: 'Na tela inicial, clique em "Meus Limites" e depois em "Solicitar Aumento". Disponível a cada 90 dias.' },
    { category: 'Crédito', q: 'Meu limite diminuiu, por que?', a: 'Atrasos constantes ou negativação no CPF podem reduzir seu limite preventivamente.' },
    { category: 'Crédito', q: 'O limite é por parcela ou total?', a: 'Nosso sistema trabalha com "Limite de Parcela". O valor da parcela da sua compra não pode exceder este limite.' },
    { category: 'Crédito', q: 'Preciso comprovar renda?', a: 'Geralmente não. Usamos inteligência artificial para analisar seu perfil. Em casos raros, podemos solicitar via chat.' },
    { category: 'Crédito', q: 'Estou negativado, posso comprar?', a: 'Cada caso é analisado individualmente. A negativação reduz o score, mas não impede a análise automática.' },
    
    // PEDIDOS E LOJA
    { category: 'Loja', q: 'Qual o prazo de entrega?', a: 'O prazo varia conforme seu CEP. Você pode simular o frete e prazo na página do produto antes da compra.' },
    { category: 'Loja', q: 'Como rastrear meu pedido?', a: 'Vá em "Perfil" > "Meus Pedidos". Lá você encontra o código de rastreio assim que o objeto for postado.' },
    { category: 'Loja', q: 'Posso cancelar uma compra?', a: 'Se o pedido não foi enviado, cancele direto no app. Se já foi, recuse a entrega ou solicite devolução em até 7 dias.' },
    { category: 'Loja', q: 'O produto tem garantia?', a: 'Sim. Todos os eletrônicos possuem garantia legal de 90 dias + garantia do fabricante (geralmente 1 ano).' },
    { category: 'Loja', q: 'Recebi o produto errado.', a: 'Pedimos desculpas. Abra um chamado na categoria "Vendas" e enviaremos o código de logística reversa.' },
    { category: 'Loja', q: 'Vocês vendem iphone usado?', a: 'Vendemos produtos Novos (Lacrados) e Seminovos (Vitrine). A condição está sempre clara no nome do produto.' },
    { category: 'Loja', q: 'Posso retirar na loja física?', a: 'No momento operamos apenas com envio via Correios/Transportadoras para todo o Brasil.' },
    { category: 'Loja', q: 'O produto vem com nota fiscal?', a: 'Sim, 100% dos nossos produtos são enviados com Nota Fiscal Eletrônica (NFe).' },
    
    // CADASTRO
    { category: 'Cadastro', q: 'Esqueci minha senha.', a: 'Na tela de login, clique em "Esqueceu?" e enviaremos um link de redefinição para seu email.' },
    { category: 'Cadastro', q: 'Como alterar meu email?', a: 'Por segurança, a alteração de email deve ser solicitada via chamado na categoria "Cadastro" com validação de identidade.' },
    { category: 'Cadastro', q: 'Como alterar meu endereço?', a: 'Vá em "Perfil" > "Meus Endereços". Você pode adicionar quantos quiser e definir o padrão.' },
    { category: 'Cadastro', q: 'Como mudar meu telefone?', a: 'Em "Perfil" > "Meus Dados", edite o campo celular e salve. Um SMS de confirmação pode ser enviado.' },
    { category: 'Cadastro', q: 'Posso ter duas contas?', a: 'Não. O cadastro é único por CPF para garantir a segurança do histórico de crédito.' },
    { category: 'Cadastro', q: 'Como excluir minha conta?', a: 'A exclusão é irreversível e cancela todo histórico. Solicite via suporte se não houver débitos pendentes.' },
    { category: 'Cadastro', q: 'Meus dados estão seguros?', a: 'Sim. Utilizamos criptografia de ponta a ponta e seguimos rigorosamente a LGPD.' },
    { category: 'Cadastro', q: 'Não recebo emails da loja.', a: 'Verifique sua caixa de Spam/Lixo Eletrônico ou se as notificações estão ativas em "Configurações".' },
    
    // TÉCNICO / APP
    { category: 'Técnico', q: 'O app está travando.', a: 'Tente limpar o cache do app nas configurações do seu celular ou reinstalar a versão mais recente.' },
    { category: 'Técnico', q: 'Não consigo assinar o contrato.', a: 'Tente fazer a assinatura com o celular na horizontal para ter mais espaço ou use uma caneta touch.' },
    { category: 'Técnico', q: 'Erro ao carregar faturas.', a: 'Verifique sua conexão com a internet. Se persistir, o sistema pode estar em manutenção momentânea.' },
    { category: 'Técnico', q: 'Onde baixo o app?', a: 'Nosso app é um PWA. Acesse pelo navegador e clique em "Adicionar à Tela de Início" para instalar.' },
    { category: 'Técnico', q: 'Suporte a modo escuro?', a: 'Sim! O app segue a configuração do seu sistema ou você pode alternar no ícone de sol/lua no topo.' },
    { category: 'Técnico', q: 'Notificações não chegam.', a: 'Verifique se você deu permissão de notificação ao navegador/app. Vá em Configurações e ative.' },
    
    // OUTROS
    { category: 'Geral', q: 'Vocês compram celular usado?', a: 'Utilizamos seu usado como parte do pagamento apenas na loja física (consulte disponibilidade na sua região).' },
    { category: 'Geral', q: 'Trabalham com atacado?', a: 'Sim, temos tabela especial para revendedores cadastrados com CNPJ. Contate o comercial.' },
    { category: 'Geral', q: 'Tem programa de afiliados?', a: 'Sim! Use o "Indique e Ganhe" no seu perfil. Você ganha cashback por cada amigo que comprar.' },
    { category: 'Geral', q: 'Onde fica a loja física?', a: 'Nossa sede administrativa fica no Amapá, mas atendemos todo o Brasil digitalmente.' },
    { category: 'Geral', q: 'Horário de atendimento?', a: 'Nosso robô atende 24h. Atendimento humano: Seg a Sex das 09h às 18h e Sáb das 09h às 13h.' },
];

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

// --- Central de Atendimento "Enterprise" (Help Portal) ---
const HelpView: React.FC<{ userId: string }> = ({ userId }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'tickets' | 'create' | 'view_ticket'>('dashboard');
    const [tickets, setTickets] = useState<any[]>([]);
    const [currentTicket, setCurrentTicket] = useState<any>(null);
    const [ticketMessages, setTicketMessages] = useState<any[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [newTicket, setNewTicket] = useState({ subject: '', category: 'Financeiro', message: '', priority: 'Normal' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [replyText, setReplyText] = useState('');
    
    // FAQ States
    const [searchFaq, setSearchFaq] = useState('');
    const [faqCategory, setFaqCategory] = useState('Todos');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    const { addToast } = useToast();

    // Carregar Tickets
    useEffect(() => {
        if (activeTab === 'tickets') {
            setLoadingTickets(true);
            const fetchTickets = async () => {
                const { data } = await supabase.from('support_tickets').select('*').eq('user_id', userId).order('updated_at', {ascending: false});
                setTickets(data || []);
                setLoadingTickets(false);
            };
            fetchTickets();
        }
    }, [activeTab, userId]);

    // Carregar Mensagens do Ticket
    useEffect(() => {
        if (activeTab === 'view_ticket' && currentTicket) {
            const fetchMessages = async () => {
                const res = await fetch(`/api/admin/support-messages?ticketId=${currentTicket.id}`);
                if(res.ok) {
                    setTicketMessages(await res.json());
                }
            };
            fetchMessages();
            const interval = setInterval(fetchMessages, 5000);
            return () => clearInterval(interval);
        }
    }, [activeTab, currentTicket]);

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/admin/support-tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...newTicket })
            });
            
            if (!response.ok) throw new Error('Erro ao criar chamado');
            
            addToast('Chamado criado com sucesso! Protocolo gerado.', 'success');
            setActiveTab('tickets'); 
            setNewTicket({ subject: '', category: 'Financeiro', message: '', priority: 'Normal' });
        } catch (error) {
            addToast('Erro ao enviar chamado.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!replyText.trim() || !currentTicket) return;
        
        try {
            const response = await fetch('/api/admin/support-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ticketId: currentTicket.id, 
                    sender: 'user', 
                    message: replyText 
                })
            });
            
            if(response.ok) {
                setTicketMessages(prev => [...prev, { 
                    id: Date.now().toString(), 
                    message: replyText, 
                    sender_type: 'user', 
                    created_at: new Date().toISOString() 
                }]);
                setReplyText('');
            }
        } catch (error) {
            console.error(error);
        }
    }

    const filteredFaqs = useMemo(() => {
        return faqDatabase.filter(f => {
            const matchesSearch = f.q.toLowerCase().includes(searchFaq.toLowerCase()) || f.a.toLowerCase().includes(searchFaq.toLowerCase());
            const matchesCategory = faqCategory === 'Todos' || f.category === faqCategory;
            return matchesSearch && matchesCategory;
        });
    }, [searchFaq, faqCategory]);

    const categories = ['Todos', 'Financeiro', 'Crédito', 'Loja', 'Cadastro', 'Técnico'];

    // --- Views da Central ---

    if (activeTab === 'create') {
        return (
            <div className="animate-fade-in space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setActiveTab('dashboard')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                    </button>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Novo Chamado</h3>
                </div>

                <form onSubmit={handleCreateTicket} className="space-y-5 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/50 flex gap-3 items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        <p className="text-xs text-indigo-800 dark:text-indigo-200 leading-relaxed">
                            Preencha os detalhes abaixo. Nossa equipe responderá em até 24 horas úteis.
                        </p>
                    </div>

                    <InputField label="Assunto" name="subject" value={newTicket.subject} onChange={e => setNewTicket({...newTicket, subject: e.target.value})} required placeholder="Ex: Fatura duplicada" />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                            <select 
                                value={newTicket.category}
                                onChange={e => setNewTicket({...newTicket, category: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="Financeiro">Financeiro</option>
                                <option value="Técnico">Suporte Técnico</option>
                                <option value="Vendas">Dúvida de Produto</option>
                                <option value="Cadastro">Dados Cadastrais</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urgência</label>
                            <select 
                                value={newTicket.priority}
                                onChange={e => setNewTicket({...newTicket, priority: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="Baixa">Baixa</option>
                                <option value="Normal">Normal</option>
                                <option value="Alta">Alta</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição Detalhada</label>
                        <textarea 
                            value={newTicket.message}
                            onChange={e => setNewTicket({...newTicket, message: e.target.value})}
                            required
                            rows={5}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            placeholder="Descreva o que aconteceu..."
                        ></textarea>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/30">
                        {isSubmitting ? <LoadingSpinner /> : 'Enviar Solicitação'}
                    </button>
                </form>
            </div>
        )
    }

    if (activeTab === 'view_ticket' && currentTicket) {
        return (
            <div className="animate-fade-in flex flex-col h-[500px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setActiveTab('tickets')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{currentTicket.subject}</h3>
                            <span className="text-xs text-slate-500">Protocolo #{currentTicket.id.slice(0,8)}</span>
                        </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${currentTicket.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                        {currentTicket.status === 'open' ? 'Aberto' : 'Fechado'}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/50 dark:bg-slate-900/50">
                    {ticketMessages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender_type === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                                msg.sender_type === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-sm' 
                                : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-bl-sm border border-slate-200 dark:border-slate-600'
                            }`}>
                                {msg.message}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 px-1">
                                {new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                    ))}
                </div>

                {currentTicket.status === 'open' && (
                    <form onSubmit={handleSendReply} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                        <input 
                            type="text" 
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Escreva uma resposta..."
                            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-900 border-0 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                        <button type="submit" disabled={!replyText.trim()} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                        </button>
                    </form>
                )}
            </div>
        );
    }

    if (activeTab === 'tickets') {
        return (
            <div className="animate-fade-in space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setActiveTab('dashboard')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                        </button>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Meus Chamados</h3>
                    </div>
                    <button onClick={() => setActiveTab('create')} className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800">
                        + Novo
                    </button>
                </div>
                
                {loadingTickets ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : tickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum chamado encontrado.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tickets.map(ticket => (
                            <div 
                                key={ticket.id} 
                                onClick={() => { setCurrentTicket(ticket); setActiveTab('view_ticket'); }}
                                className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group transition-all hover:border-indigo-200 dark:hover:border-indigo-800 cursor-pointer active:scale-[0.98]"
                            >
                                <div className={`absolute top-0 right-0 px-2 py-1 rounded-bl-lg text-[10px] font-bold uppercase tracking-wide ${ticket.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {ticket.status === 'open' ? 'Em Aberto' : 'Resolvido'}
                                </div>
                                
                                <div className="pr-16 mb-1">
                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm line-clamp-1">{ticket.subject}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">#{ticket.id.slice(0, 8).toUpperCase()}</p>
                                </div>

                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50 dark:border-slate-700">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${ticket.priority === 'Alta' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                        {ticket.priority || 'Normal'}
                                    </span>
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700">{ticket.category}</span>
                                    <span className="text-[10px] text-slate-400 ml-auto">
                                        {new Date(ticket.updated_at).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // Dashboard View
    return (
        <div className="animate-fade-in space-y-6">
            {/* Hero Header */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white relative overflow-hidden shadow-lg">
                 <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                 <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl"></div>
                 
                 <div className="relative z-10">
                     <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-2xl font-bold mb-1">Central de Ajuda</h3>
                            <p className="text-indigo-100 text-sm opacity-90">Tire dúvidas ou fale com o suporte.</p>
                        </div>
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                     </div>
                     
                     <div className="mt-6 flex gap-3">
                        <button 
                            onClick={() => setActiveTab('create')}
                            className="flex-1 bg-white text-indigo-600 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 active:scale-95"
                        >
                            <span>Abrir Chamado</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('tickets')}
                            className="flex-1 bg-indigo-800/50 backdrop-blur text-white py-3 rounded-xl font-bold text-sm border border-indigo-400/30 hover:bg-indigo-800/70 transition-colors flex items-center justify-center gap-2 active:scale-95"
                        >
                            <span>Meus Tickets</span>
                        </button>
                     </div>
                 </div>
            </div>

            {/* Search FAQ */}
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Qual a sua dúvida?" 
                    value={searchFaq}
                    onChange={e => setSearchFaq(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            {/* Categories Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {categories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setFaqCategory(cat)}
                        className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${
                            faqCategory === cat 
                            ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-md' 
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* FAQ List */}
            <div className="space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-white px-1 flex justify-between">
                    <span>Base de Conhecimento</span>
                    <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredFaqs.length} artigos</span>
                </h4>
                
                <div className="max-h-[400px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                    {filteredFaqs.length > 0 ? filteredFaqs.map((faq, i) => (
                        <div 
                            key={i} 
                            className={`bg-white dark:bg-slate-800 rounded-xl border transition-all cursor-pointer overflow-hidden ${
                                expandedFaq === i ? 'border-indigo-500 shadow-md' : 'border-slate-100 dark:border-slate-700 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800'
                            }`}
                            onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                        >
                            <div className="p-4 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        faq.category === 'Financeiro' ? 'bg-green-500' :
                                        faq.category === 'Crédito' ? 'bg-yellow-500' :
                                        faq.category === 'Loja' ? 'bg-purple-500' :
                                        faq.category === 'Cadastro' ? 'bg-blue-500' : 'bg-slate-400'
                                    }`}></span>
                                    <h5 className="font-bold text-sm text-slate-700 dark:text-slate-200">{faq.q}</h5>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${expandedFaq === i ? 'rotate-180 text-indigo-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                            
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedFaq === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="px-4 pb-4 pt-0 text-sm text-slate-500 dark:text-slate-400 leading-relaxed border-t border-dashed border-slate-100 dark:border-slate-700 mt-2 pt-3">
                                    {faq.a}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-8">
                            <p className="text-sm text-slate-500">Nenhum artigo encontrado para esta busca.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Contact Options */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-center text-xs text-slate-400 mb-4 font-medium uppercase tracking-wider">Canais de Contato</p>
                <div className="grid grid-cols-2 gap-3">
                    <a 
                        href="https://wa.me/5596991718167" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-green-500 hover:shadow-green-500/10 transition-all active:scale-95 group"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 mb-1 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zM12.05 20.21c-1.5 0-2.97-.39-4.27-1.14l-.3-.18-3.17.83.84-3.07-.2-.32a8.118 8.118 0 01-1.23-4.42c0-4.48 3.64-8.13 8.12-8.13 2.17 0 4.21.85 5.75 2.38 1.53 1.53 2.38 3.57 2.38 5.74 0 4.48-3.65 8.13-8.12 8.13zm4.46-6.09c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.87.85-.87 2.07 0 1.22.89 2.39 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.07-.11-.22-.18-.47-.3z"/></svg>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">WhatsApp</span>
                    </a>
                    
                    <button disabled className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed relative overflow-hidden">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Email</span>
                        <div className="absolute top-2 right-2 bg-slate-100 dark:bg-slate-700 text-[8px] font-bold px-1.5 py-0.5 rounded text-slate-500 uppercase">Em breve</div>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Views existentes mantidas (ContractsView, FiscalNotesView, etc.) ---
// ... (O resto do arquivo permanece igual até a definição de ContractsView, apenas o HelpView foi substituído acima)

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
                <p className="text-xs text-slate-400">Versão do App: 2.1.0 (Enterprise)</p>
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
                            label="Indique e Ganhe" 
                            description="Ganhe R$ 20 por amigo"
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>}
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
