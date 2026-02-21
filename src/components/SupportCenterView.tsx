import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface Ticket {
    id: string;
    subject: string;
    status: 'open' | 'closed';
    category: string;
    updated_at: string;
}

const SupportCenterView: React.FC<{ userId: string }> = ({ userId }) => {
    const [view, setView] = useState<'list' | 'chat' | 'new'>('list');
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    
    // Form New Ticket
    const [newSubject, setNewSubject] = useState('');
    const [newCategory, setNewCategory] = useState('Financeiro');
    const [isCreating, setIsCreating] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTickets();
    }, []);

    useEffect(() => {
        if (selectedTicket && view === 'chat') {
            fetchMessages();
            const interval = setInterval(fetchMessages, 5000);
            return () => clearInterval(interval);
        }
    }, [selectedTicket, view]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from('support_tickets').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
            setTickets(data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchMessages = async () => {
        if (!selectedTicket) return;
        const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', selectedTicket.id).eq('is_internal', false).order('created_at', { ascending: true });
        setMessages(data || []);
    };

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const { data: ticket, error } = await supabase.from('support_tickets').insert({
                user_id: userId,
                subject: newSubject,
                category: newCategory,
                status: 'open',
                priority: 'Normal'
            }).select().single();

            if (error) throw error;

            // Mensagem inicial
            await supabase.from('support_messages').insert({
                ticket_id: ticket.id,
                sender_type: 'user',
                message: `Novo chamado aberto: ${newSubject}`
            });

            setNewSubject('');
            setView('list');
            fetchTickets();
        } catch (e) { alert("Erro ao abrir chamado."); }
        finally { setIsCreating(false); }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !selectedTicket) return;

        const msg = input;
        setInput('');
        
        try {
            await supabase.from('support_messages').insert({
                ticket_id: selectedTicket.id,
                sender_type: 'user',
                message: msg
            });
            fetchMessages();
        } catch (e) { console.error(e); }
    };

    if (loading && view === 'list') return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            {view === 'list' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Meus Chamados</h2>
                        <button onClick={() => setView('new')} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg active:scale-95 transition-all">+ Abrir Ticket</button>
                    </div>

                    {tickets.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                            <p className="text-slate-400 text-sm">Você não tem chamados abertos.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tickets.map(t => (
                                <button key={t.id} onClick={() => { setSelectedTicket(t); setView('chat'); }} className="w-full text-left p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:border-indigo-300 transition-all flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white text-sm">{t.subject}</p>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">{t.category} • {new Date(t.updated_at).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${t.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {t.status === 'open' ? 'Em Aberto' : 'Finalizado'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'new' && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-xl border border-slate-100 animate-fade-in-up">
                    <h3 className="text-lg font-black mb-6 uppercase">Novo Atendimento</h3>
                    <form onSubmit={handleCreateTicket} className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Assunto</label>
                            <input type="text" required value={newSubject} onChange={e => setNewSubject(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Dúvida sobre limite" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoria</label>
                            <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none focus:ring-2 focus:ring-indigo-500">
                                <option>Financeiro</option>
                                <option>Técnico / App</option>
                                <option>Elogio / Sugestão</option>
                                <option>Outros</option>
                            </select>
                        </div>
                        <div className="pt-4 flex gap-3">
                            <button type="button" onClick={() => setView('list')} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl">Cancelar</button>
                            <button type="submit" disabled={isCreating} className="flex-[2] py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg disabled:opacity-50">
                                {isCreating ? <LoadingSpinner /> : 'ABRIR CHAMADO'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {view === 'chat' && selectedTicket && (
                <div className="flex flex-col h-[500px] bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden animate-fade-in">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b flex justify-between items-center">
                        <button onClick={() => setView('list')} className="text-indigo-600 font-bold text-xs">← Voltar</button>
                        <h3 className="font-bold text-sm truncate max-w-[150px]">{selectedTicket.subject}</h3>
                        <div className="w-10"></div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.sender_type === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-bl-none'}`}>
                                    {m.message}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {selectedTicket.status === 'open' && (
                        <form onSubmit={handleSendMessage} className="p-3 bg-slate-50 dark:bg-slate-900 border-t flex gap-2">
                            <input type="text" value={input} onChange={e => setInput(e.target.value)} className="flex-1 p-3 rounded-xl bg-white dark:bg-slate-800 border-none outline-none text-sm" placeholder="Digite sua mensagem..." />
                            <button type="submit" disabled={!input.trim()} className="p-3 bg-indigo-600 text-white rounded-xl disabled:opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};

export default SupportCenterView;