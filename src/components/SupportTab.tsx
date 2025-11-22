
import React, { useState, useEffect, useRef, useMemo } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface Ticket {
    id: string;
    user_id: string;
    profiles: { first_name: string; last_name: string; email: string };
    subject: string;
    status: 'open' | 'closed';
    category: string;
    priority: string;
    updated_at: string;
}

interface Message {
    id: string;
    sender_type: 'user' | 'admin';
    message: string;
    created_at: string;
}

const cannedResponses = [
    "Olá! Como posso ajudar você hoje?",
    "Vou verificar seu cadastro, um momento por favor.",
    "Seu pagamento foi confirmado.",
    "O boleto pode levar até 2 dias úteis para compensar.",
    "Sua solicitação de limite está em análise.",
    "Algo mais em que eu possa ajudar?",
    "Obrigado pelo contato. Tenha um ótimo dia!"
];

const SupportTab: React.FC = () => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [input, setInput] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('open');
    const [searchQuery, setSearchQuery] = useState('');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch all tickets
    useEffect(() => {
        const fetchTickets = async () => {
            try {
                const res = await fetch('/api/admin/support-tickets');
                if (res.ok) {
                    const data = await res.json();
                    setTickets(data);
                }
            } catch (error) {
                console.error("Erro ao buscar tickets", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTickets();
        
        const interval = setInterval(fetchTickets, 10000); // Polling tickets
        return () => clearInterval(interval);
    }, []);

    // Fetch messages when a ticket is selected
    useEffect(() => {
        if (!selectedTicket) return;
        
        const fetchMessages = async () => {
            try {
                const res = await fetch(`/api/admin/support-messages?ticketId=${selectedTicket.id}`);
                if (res.ok) {
                    setMessages(await res.json());
                }
            } catch (error) {
                console.error(error);
            }
        };
        
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000); // Polling chat
        return () => clearInterval(interval);
    }, [selectedTicket]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent | null, textOverride?: string) => {
        if (e) e.preventDefault();
        const msgToSend = textOverride || input;
        
        if (!msgToSend.trim() || !selectedTicket) return;

        setInput('');
        
        // Optimistic UI
        const tempId = Date.now().toString();
        setMessages(prev => [...prev, { id: tempId, sender_type: 'admin', message: msgToSend, created_at: new Date().toISOString() }]);

        try {
            await fetch('/api/admin/support-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId: selectedTicket.id, sender: 'admin', message: msgToSend })
            });
        } catch (error) {
            console.error("Erro ao enviar", error);
        }
    };

    const toggleTicketStatus = async () => {
        if (!selectedTicket) return;
        const newStatus = selectedTicket.status === 'open' ? 'closed' : 'open';
        
        try {
            const res = await fetch('/api/admin/support-tickets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedTicket.id, status: newStatus })
            });
            
            if (res.ok) {
                const updatedTicket = await res.json();
                setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
                setSelectedTicket(updatedTicket);
            }
        } catch (error) {
            console.error("Erro ao atualizar status", error);
        }
    };

    // Filter & Search Logic
    const filteredTickets = useMemo(() => {
        return tickets.filter(ticket => {
            const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = 
                ticket.subject?.toLowerCase().includes(searchLower) ||
                ticket.profiles?.first_name?.toLowerCase().includes(searchLower) ||
                ticket.profiles?.email?.toLowerCase().includes(searchLower);
            
            return matchesStatus && matchesSearch;
        });
    }, [tickets, filterStatus, searchQuery]);

    return (
        <div className="flex h-[calc(100vh-120px)] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            
            {/* Sidebar Lista de Tickets */}
            <div className="w-1/3 min-w-[300px] border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50/50 dark:bg-slate-900/20">
                {/* Header Sidebar */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                        Chamados
                    </h3>
                    
                    {/* Search */}
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Buscar cliente ou assunto..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2 text-xs">
                        <button onClick={() => setFilterStatus('open')} className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${filterStatus === 'open' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'}`}>Abertos</button>
                        <button onClick={() => setFilterStatus('closed')} className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${filterStatus === 'closed' ? 'bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'}`}>Fechados</button>
                        <button onClick={() => setFilterStatus('all')} className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${filterStatus === 'all' ? 'bg-slate-300 text-slate-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'}`}>Todos</button>
                    </div>
                </div>

                {/* Ticket List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500">Nenhum chamado encontrado.</div>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {filteredTickets.map(ticket => (
                                <li key={ticket.id}>
                                    <button
                                        onClick={() => setSelectedTicket(ticket)}
                                        className={`w-full text-left p-4 transition-all border-l-4 ${
                                            selectedTicket?.id === ticket.id 
                                            ? 'bg-white dark:bg-slate-700 border-indigo-500 shadow-md' 
                                            : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                        }`}
                                    >
                                        <div className="flex justify-between mb-1">
                                            <span className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[120px]">{ticket.profiles?.first_name || 'Usuário'}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(ticket.updated_at).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</span>
                                        </div>
                                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate mb-1">{ticket.subject}</p>
                                        <div className="flex gap-2">
                                            <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${ticket.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                                {ticket.status === 'open' ? 'Aberto' : 'Fechado'}
                                            </span>
                                            {ticket.priority === 'alta' && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-red-100 text-red-700">Alta Prioridade</span>}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Área de Chat */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 relative">
                {selectedTicket ? (
                    <>
                        {/* Header Chat */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    {selectedTicket.subject}
                                    <span className="text-xs font-normal bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">#{selectedTicket.id.slice(0,6)}</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                    {selectedTicket.profiles?.first_name} {selectedTicket.profiles?.last_name} 
                                    <span className="text-slate-300">|</span> 
                                    {selectedTicket.profiles?.email}
                                </p>
                            </div>
                            <button 
                                onClick={toggleTicketStatus}
                                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${selectedTicket.status === 'open' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                                {selectedTicket.status === 'open' ? 'Encerrar Atendimento' : 'Reabrir Chamado'}
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-100 dark:bg-slate-900/20">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] p-3 rounded-2xl text-sm shadow-sm ${msg.sender_type === 'admin' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                                        {msg.message}
                                        <p className={`text-[10px] mt-1 text-right ${msg.sender_type === 'admin' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area & Tools */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            
                            {/* Canned Responses */}
                            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 custom-scrollbar">
                                {cannedResponses.map((resp, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => handleSendMessage(null, resp)}
                                        className="whitespace-nowrap px-3 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-300 text-xs rounded-full border border-slate-200 dark:border-slate-600 transition-colors"
                                    >
                                        {resp}
                                    </button>
                                ))}
                            </div>

                            <form onSubmit={(e) => handleSendMessage(e)} className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    placeholder="Digite sua resposta..."
                                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                    disabled={selectedTicket.status === 'closed'}
                                />
                                <button 
                                    type="submit" 
                                    disabled={!input.trim() || selectedTicket.status === 'closed'} 
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium shadow-sm"
                                >
                                    Enviar
                                </button>
                            </form>
                            {selectedTicket.status === 'closed' && <p className="text-xs text-center text-red-500 mt-2">Este chamado está fechado. Reabra para enviar mensagens.</p>}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        <p>Selecione um chamado para visualizar.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SupportTab;
