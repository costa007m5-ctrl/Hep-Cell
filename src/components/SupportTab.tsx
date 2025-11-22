
import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface Ticket {
    id: string;
    user_id: string;
    profiles: { first_name: string; last_name: string; email: string };
    subject: string;
    status: 'open' | 'closed';
    updated_at: string;
}

interface Message {
    id: string;
    sender_type: 'user' | 'admin';
    message: string;
    created_at: string;
}

const SupportTab: React.FC = () => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [input, setInput] = useState('');
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
        
        const interval = setInterval(fetchTickets, 10000); // Polling
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
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [selectedTicket]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !selectedTicket) return;

        const msg = input;
        setInput('');
        
        // Optimistic UI
        const tempId = Date.now().toString();
        setMessages(prev => [...prev, { id: tempId, sender_type: 'admin', message: msg, created_at: new Date().toISOString() }]);

        try {
            await fetch('/api/admin/support-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId: selectedTicket.id, sender: 'admin', message: msg })
            });
        } catch (error) {
            console.error("Erro ao enviar", error);
        }
    };

    return (
        <div className="flex h-[calc(100vh-120px)] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Sidebar Lista de Tickets */}
            <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-slate-800 dark:text-white">Chamados ({tickets.filter(t => t.status === 'open').length})</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 flex justify-center"><LoadingSpinner /></div>
                    ) : tickets.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">Nenhum chamado aberto.</div>
                    ) : (
                        tickets.map(ticket => (
                            <button
                                key={ticket.id}
                                onClick={() => setSelectedTicket(ticket)}
                                className={`w-full text-left p-4 border-b border-slate-100 dark:border-slate-700 transition-colors ${selectedTicket?.id === ticket.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{ticket.profiles?.first_name || 'Usuário'}</span>
                                    <span className="text-xs text-slate-400">{new Date(ticket.updated_at).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{ticket.subject}</p>
                                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded mt-1 inline-block ${ticket.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {ticket.status === 'open' ? 'Aberto' : 'Fechado'}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Área de Chat */}
            <div className="w-2/3 flex flex-col">
                {selectedTicket ? (
                    <>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">{selectedTicket.subject}</h3>
                                <p className="text-xs text-slate-500">Cliente: {selectedTicket.profiles?.email}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-slate-900/20">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] p-3 rounded-xl text-sm ${msg.sender_type === 'admin' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm'}`}>
                                        {msg.message}
                                        <p className={`text-[10px] mt-1 text-right ${msg.sender_type === 'admin' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-2">
                            <input 
                                type="text" 
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Digite sua resposta..."
                                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button type="submit" disabled={!input.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                                Enviar
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                        Selecione um chamado para visualizar.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SupportTab;
