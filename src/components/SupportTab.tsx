import React, { useState, useEffect, useRef, useMemo } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface Ticket {
    id: string;
    user_id: string;
    profiles: { 
        first_name: string; 
        last_name: string; 
        email: string;
        credit_score: number;
        credit_limit: number;
        credit_status: string;
    };
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
    is_internal?: boolean; // Nova feature
    created_at: string;
}

const cannedResponses = [
    "Olá! Sou da equipe de suporte da Relp Cell. Como posso ajudar?",
    "Verifiquei seu cadastro e está tudo correto.",
    "Seu limite foi atualizado com sucesso.",
    "O pagamento via boleto compensa em até 48h úteis.",
    "Vou transferir seu caso para o setor financeiro.",
    "Agradecemos o contato. Tenha um ótimo dia!"
];

const SupportTab: React.FC = () => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [input, setInput] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('open');
    const [searchQuery, setSearchQuery] = useState('');
    const [isInternalNote, setIsInternalNote] = useState(false);
    const [showMacros, setShowMacros] = useState(false);
    const [isGeneratingReply, setIsGeneratingReply] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch tickets
    useEffect(() => {
        const fetchTickets = async () => {
            try {
                const res = await fetch('/api/admin/support-tickets');
                if (res.ok) {
                    const data = await res.json();
                    setTickets(data);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTickets();
        const interval = setInterval(fetchTickets, 8000);
        return () => clearInterval(interval);
    }, []);

    // Fetch messages
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
        const interval = setInterval(fetchMessages, 3000);
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
        setShowMacros(false);
        
        const tempId = Date.now().toString();
        setMessages(prev => [...prev, { 
            id: tempId, 
            sender_type: 'admin', 
            message: msgToSend, 
            is_internal: isInternalNote,
            created_at: new Date().toISOString() 
        }]);

        try {
            await fetch('/api/admin/support-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ticketId: selectedTicket.id, 
                    sender: 'admin', 
                    message: msgToSend,
                    isInternal: isInternalNote 
                })
            });
        } catch (error) {
            console.error("Erro ao enviar", error);
        }
    };

    const handleGenerateAiReply = async () => {
        if (!selectedTicket || isGeneratingReply) return;
        setIsGeneratingReply(true);
        
        // Construct context from last 5 messages
        const context = messages.slice(-5).map(m => `${m.sender_type === 'user' ? 'Cliente' : 'Atendente'}: ${m.message}`).join('\n');
        const fullContext = `Ticket Subject: ${selectedTicket.subject}\nConversation:\n${context}\n\nGerar uma resposta educada e útil para o cliente.`;

        try {
            const res = await fetch('/api/admin/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: "Gere uma sugestão de resposta", 
                    context: fullContext 
                })
            });
            const data = await res.json();
            if(data.reply) setInput(data.reply);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingReply(false);
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
                // Atualiza a lista local e o selecionado mantendo os dados do profile (que não vem no PUT return as vezes)
                setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: newStatus } : t));
                setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
            }
        } catch (error) {
            console.error("Erro status", error);
        }
    };

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
        <div className="flex h-[calc(100vh-100px)] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg">
            
            {/* COLUNA 1: LISTA (25%) */}
            <div className="w-1/4 min-w-[280px] border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-900/50">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1">
                        {['open', 'closed', 'all'].map(status => (
                            <button 
                                key={status}
                                onClick={() => setFilterStatus(status as any)} 
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${filterStatus === status ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                {status === 'all' ? 'Todos' : status === 'open' ? 'Abertos' : 'Fechados'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoading ? <div className="p-8 flex justify-center"><LoadingSpinner /></div> : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {filteredTickets.map(ticket => (
                                <li key={ticket.id}>
                                    <button
                                        onClick={() => setSelectedTicket(ticket)}
                                        className={`w-full text-left p-4 transition-all hover:bg-white dark:hover:bg-slate-800 border-l-4 ${selectedTicket?.id === ticket.id ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-sm' : 'border-transparent'}`}
                                    >
                                        <div className="flex justify-between mb-1">
                                            <span className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[120px]">{ticket.profiles?.first_name}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(ticket.updated_at).toLocaleDateString(undefined, {day:'2-digit', month:'2-digit'})}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1">{ticket.subject}</p>
                                        <div className="flex gap-2 mt-2">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${ticket.priority === 'Alta' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600'}`}>
                                                {ticket.priority}
                                            </span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 uppercase font-bold">
                                                {ticket.category}
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* COLUNA 2: CHAT (50%) */}
            <div className="w-1/2 flex flex-col bg-white dark:bg-slate-800 relative border-r border-slate-200 dark:border-slate-700">
                {selectedTicket ? (
                    <>
                        {/* Header Chat */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30 backdrop-blur">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    {selectedTicket.subject}
                                    <span className={`w-2 h-2 rounded-full ${selectedTicket.status === 'open' ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Ticket #{selectedTicket.id.slice(0,8)}</p>
                            </div>
                            <button 
                                onClick={toggleTicketStatus}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${selectedTicket.status === 'open' ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'}`}
                            >
                                {selectedTicket.status === 'open' ? 'Fechar Ticket' : 'Reabrir Ticket'}
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-100/50 dark:bg-slate-900/20">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex flex-col ${msg.sender_type === 'admin' ? 'items-end' : 'items-start'}`}>
                                    {msg.is_internal && (
                                        <div className="flex items-center gap-1 mb-1 text-[10px] text-yellow-600 font-bold uppercase tracking-wide">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                            Nota Interna (Invisível para o cliente)
                                        </div>
                                    )}
                                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap break-words ${
                                        msg.is_internal 
                                        ? 'bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-br-none' 
                                        : msg.sender_type === 'admin' 
                                            ? 'bg-indigo-600 text-white rounded-br-none' 
                                            : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-slate-600'
                                    }`}>
                                        {msg.message}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                                        {new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 relative">
                            {/* Macros Popover */}
                            {showMacros && (
                                <div className="absolute bottom-full left-4 mb-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-10 animate-fade-in-up">
                                    <div className="p-2 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-500 uppercase">Respostas Rápidas</div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {cannedResponses.map((resp, i) => (
                                            <button key={i} onClick={() => handleSendMessage(null, resp)} className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                                {resp}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Toolbar */}
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center cursor-pointer">
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only" checked={isInternalNote} onChange={e => setIsInternalNote(e.target.checked)} />
                                            <div className={`w-8 h-4 rounded-full shadow-inner transition-colors ${isInternalNote ? 'bg-yellow-400' : 'bg-slate-300'}`}></div>
                                            <div className={`absolute w-2.5 h-2.5 bg-white rounded-full shadow top-0.5 left-0.5 transition-transform ${isInternalNote ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                        <span className={`ml-2 text-xs font-bold ${isInternalNote ? 'text-yellow-600' : 'text-slate-500'}`}>Nota Interna</span>
                                    </label>
                                </div>
                                <button onClick={() => setShowMacros(!showMacros)} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                    Macros
                                </button>
                                <button 
                                    onClick={handleGenerateAiReply} 
                                    disabled={isGeneratingReply}
                                    className="text-xs font-bold text-purple-600 hover:bg-purple-50 px-2 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                    {isGeneratingReply ? <LoadingSpinner /> : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" /></svg>
                                            IA Sugerir
                                        </>
                                    )}
                                </button>
                            </div>

                            <form onSubmit={(e) => handleSendMessage(e)} className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    placeholder={isInternalNote ? "Escreva uma nota interna..." : "Digite sua resposta..."}
                                    className={`flex-1 px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 transition-all ${isInternalNote ? 'bg-yellow-50 border-yellow-300 focus:ring-yellow-400 placeholder-yellow-700/50' : 'bg-slate-50 border-slate-300 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white'}`}
                                    disabled={selectedTicket.status === 'closed'}
                                />
                                <button 
                                    type="submit" 
                                    disabled={!input.trim() || selectedTicket.status === 'closed'} 
                                    className={`px-4 py-2 rounded-xl text-white font-bold shadow-md disabled:opacity-50 transition-transform active:scale-95 ${isInternalNote ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        </div>
                        <p className="font-medium">Selecione um ticket para iniciar o atendimento</p>
                    </div>
                )}
            </div>

            {/* COLUNA 3: INFO CLIENTE (25%) */}
            <div className="w-1/4 min-w-[250px] bg-slate-50 dark:bg-slate-900/80 p-6 overflow-y-auto border-l border-slate-200 dark:border-slate-700">
                {selectedTicket ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-3">
                                {selectedTicket.profiles?.first_name?.[0] || 'U'}
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg">{selectedTicket.profiles?.first_name} {selectedTicket.profiles?.last_name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{selectedTicket.profiles?.email}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                                <p className="text-xs text-slate-500 uppercase font-bold">Score</p>
                                <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{selectedTicket.profiles?.credit_score || 0}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                                <p className="text-xs text-slate-500 uppercase font-bold">Limite</p>
                                <p className="text-sm font-bold text-green-600 dark:text-green-400">R$ {selectedTicket.profiles?.credit_limit || 0}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detalhes do Chamado</h4>
                            
                            <div className="flex justify-between text-sm py-2 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500">Categoria</span>
                                <span className="font-medium text-slate-800 dark:text-white capitalize">{selectedTicket.category}</span>
                            </div>
                            <div className="flex justify-between text-sm py-2 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500">Prioridade</span>
                                <span className={`font-bold uppercase text-xs px-2 py-0.5 rounded ${selectedTicket.priority === 'Alta' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600'}`}>{selectedTicket.priority}</span>
                            </div>
                            <div className="flex justify-between text-sm py-2 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500">Aberto em</span>
                                <span className="font-medium text-slate-800 dark:text-white">{new Date(selectedTicket.updated_at).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                            <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                Dica do Sistema
                            </h4>
                            <p className="text-xs text-blue-700 dark:text-blue-200 leading-relaxed">
                                Verifique se há faturas em atraso antes de conceder aumento de limite. O score deste cliente é considerado {selectedTicket.profiles?.credit_score > 700 ? 'bom' : 'regular'}.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6 opacity-50">
                        <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-lg mb-4"></div>
                        <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                        <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SupportTab;