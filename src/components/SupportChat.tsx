
import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';

type ChatMode = 'bot' | 'human';

const SupportChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{role: 'user' | 'model' | 'admin', text: string, timestamp?: string}[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<ChatMode>('bot');
    const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages, isOpen]);

    // Listen for global open event
    useEffect(() => {
        const handleOpenChat = () => setIsOpen(true);
        window.addEventListener('open-support-chat', handleOpenChat);
        return () => window.removeEventListener('open-support-chat', handleOpenChat);
    }, []);

    // Polling for new messages when in human mode
    useEffect(() => {
        let interval: any;
        if (mode === 'human' && activeTicketId && isOpen) {
            const fetchMessages = async () => {
                const { data } = await supabase
                    .from('support_messages')
                    .select('*')
                    .eq('ticket_id', activeTicketId)
                    .order('created_at', { ascending: true });
                
                if (data) {
                    const mapped = data.map(m => ({
                        role: m.sender_type === 'admin' ? 'admin' : 'user',
                        text: m.message,
                        timestamp: m.created_at
                    }));
                    // Simple compare to avoid re-render if length same (naive check)
                    setMessages(prev => {
                        if (prev.length !== mapped.length) return mapped;
                        return prev;
                    });
                }
            };
            
            fetchMessages();
            interval = setInterval(fetchMessages, 3000); // Faster polling
        }
        return () => clearInterval(interval);
    }, [mode, activeTicketId, isOpen]);

    const createTicket = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Faça login para falar com atendente.");

            // Check for existing open ticket
            const { data: existing } = await supabase.from('support_tickets').select('id').eq('user_id', user.id).eq('status', 'open').single();
            
            if (existing) {
                setActiveTicketId(existing.id);
            } else {
                const { data: newTicket, error } = await supabase.from('support_tickets').insert({
                    user_id: user.id,
                    subject: 'Solicitação de Atendimento via Chat',
                    status: 'open'
                }).select().single();
                
                if (error) throw error;
                setActiveTicketId(newTicket.id);
            }
            setMode('human');
            // Keep AI history if user wants? For now, clear to focus on ticket
            setMessages([]); 
        } catch (error: any) {
            console.error(error);
            alert("Erro ao iniciar atendimento: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;
        const userMsg = inputText;
        setInputText('');

        if (mode === 'human') {
            if (!activeTicketId) return;
            
            // Optimistic UI
            setMessages(prev => [...prev, { role: 'user', text: userMsg, timestamp: new Date().toISOString() }]);
            
            await supabase.from('support_messages').insert({
                ticket_id: activeTicketId,
                sender_type: 'user',
                message: userMsg
            });
            return;
        }
        
        // BOT MODE logic
        setMessages(prev => [...prev, { role: 'user', text: userMsg, timestamp: new Date().toISOString() }]);
        setLoading(true);

        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
             const { data: { user } } = await supabase.auth.getUser();
             let context = "";
             if (user) {
                 const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                 context += `Nome do usuário: ${profile?.first_name || 'Cliente'}.`;
             }

             const response = await fetch('/api/admin/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, context }),
                signal: controller.signal
            });

            if (!response.ok) throw new Error('Erro na IA');
            const data = await response.json();
            setMessages(prev => [...prev, { role: 'model', text: data.reply, timestamp: new Date().toISOString() }]);

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                setMessages(prev => [...prev, { role: 'model', text: "Desculpe, tive um erro de conexão. Tente novamente.", timestamp: new Date().toISOString() }]);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAttachMock = () => {
        alert("Funcionalidade de anexo em desenvolvimento. Por favor, envie o link do arquivo.");
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-gradient-to-tr from-indigo-600 to-purple-600 hover:scale-105 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-transform active:scale-95"
                aria-label="Ajuda"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            </button>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
                <div className="flex flex-col h-[550px] max-h-[85vh]">
                    
                    {/* Chat Header */}
                    <div className="flex-shrink-0 pb-3 border-b border-slate-100 dark:border-slate-700 mb-2">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${mode === 'bot' ? 'bg-blue-500' : 'bg-green-500'} animate-pulse`}></div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {mode === 'bot' ? 'Assistente Virtual' : 'Atendimento Humano'}
                                </h3>
                            </div>
                            
                            {/* Toggle Mode Switch */}
                            <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex text-[10px] font-bold">
                                <button 
                                    onClick={() => setMode('bot')}
                                    className={`px-3 py-1 rounded-md transition-all ${mode === 'bot' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                                >
                                    IA
                                </button>
                                <button 
                                    onClick={createTicket}
                                    className={`px-3 py-1 rounded-md transition-all ${mode === 'human' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                                >
                                    Humano
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 pl-4">
                            {mode === 'bot' ? 'Respostas instantâneas 24h.' : 'Fale com nossa equipe especializada.'}
                        </p>
                    </div>

                    {/* Chat Body */}
                    <div className="flex-1 overflow-y-auto space-y-4 p-2 custom-scrollbar bg-slate-50 dark:bg-slate-900/30 rounded-xl">
                        {messages.length === 0 && (
                             <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center space-y-4 opacity-70">
                                 <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                 </div>
                                 <p className="text-sm font-medium">Olá! Como posso ajudar hoje?</p>
                                 
                                 {mode === 'bot' && (
                                     <div className="grid grid-cols-1 gap-2 w-full px-8">
                                         <button onClick={() => setInputText("Como pagar minha fatura?")} className="text-xs bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600 hover:text-indigo-600 transition-colors">Como pagar fatura?</button>
                                         <button onClick={() => setInputText("Quero aumentar meu limite")} className="text-xs bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600 hover:text-indigo-600 transition-colors">Aumentar limite</button>
                                     </div>
                                 )}
                             </div>
                        )}
                        
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div 
                                    className={`max-w-[85%] p-3 rounded-2xl text-sm relative shadow-sm ${
                                        msg.role === 'user' 
                                        ? 'bg-indigo-600 text-white rounded-br-none' 
                                        : msg.role === 'admin' 
                                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-l-4 border-green-500 rounded-bl-none'
                                            : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                                    }`}
                                >
                                    {msg.role === 'admin' && <span className="block text-[10px] font-bold text-green-600 dark:text-green-400 mb-1">Suporte</span>}
                                    {msg.text}
                                </div>
                                {msg.timestamp && (
                                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                    </span>
                                )}
                            </div>
                        ))}
                        
                        {loading && (
                             <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-700 p-3 rounded-xl rounded-bl-none shadow-sm">
                                    <div className="flex space-x-1">
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="flex-shrink-0 pt-3 border-t border-slate-100 dark:border-slate-700 mt-2">
                        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-end gap-2">
                            <button type="button" onClick={handleAttachMock} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            </button>
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={mode === 'human' ? "Escreva para o suporte..." : "Pergunte algo..."}
                                className="flex-1 px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                            <button type="submit" disabled={!inputText.trim() || loading} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-md transition-transform active:scale-95">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </form>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default SupportChat;
