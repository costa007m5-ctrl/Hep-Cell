
import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';

type ChatMode = 'bot' | 'human';

const SupportChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<ChatMode>('bot');
    const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

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
                        role: m.sender_type === 'admin' ? 'model' : 'user',
                        text: m.message
                    }));
                    setMessages(mapped);
                }
            };
            
            fetchMessages();
            interval = setInterval(fetchMessages, 5000);
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
                    subject: 'Atendimento via Chat',
                    status: 'open'
                }).select().single();
                
                if (error) throw error;
                setActiveTicketId(newTicket.id);
            }
            setMode('human');
            setMessages([]); // Clear AI history
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
            // Send to DB
            // Optimistic UI
            setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
            
            await supabase.from('support_messages').insert({
                ticket_id: activeTicketId,
                sender_type: 'user',
                message: userMsg
            });
            return;
        }
        
        // BOT MODE logic
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
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
            setMessages(prev => [...prev, { role: 'model', text: data.reply }]);

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                setMessages(prev => [...prev, { role: 'model', text: "Erro de conexão." }]);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                aria-label="Ajuda"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            </button>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
                <div className="flex flex-col h-[500px] max-h-[80vh]">
                    <div className="flex-shrink-0 pb-2 border-b border-slate-100 dark:border-slate-700 mb-2">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Suporte Relp</h3>
                            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                                <button 
                                    onClick={() => setMode('bot')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${mode === 'bot' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                                >
                                    IA
                                </button>
                                <button 
                                    onClick={createTicket}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${mode === 'human' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                                >
                                    Humano
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {mode === 'bot' ? 'Respostas automáticas instantâneas.' : 'Fale com um de nossos atendentes.'}
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 p-2 custom-scrollbar">
                        {messages.length === 0 && (
                             <div className="text-center text-sm text-slate-400 mt-10">
                                 <p>Olá! Como posso ajudar?</p>
                                 {mode === 'bot' && (
                                     <div className="mt-4 space-y-2">
                                         <button onClick={() => setInputText("Como aumento meu limite?")} className="block w-full text-xs bg-slate-100 dark:bg-slate-700 p-2 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900">Como aumento meu limite?</button>
                                     </div>
                                 )}
                             </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                             <div className="flex justify-start">
                                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-xl rounded-bl-none">
                                    <LoadingSpinner />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="flex-shrink-0 pt-4 border-t border-slate-100 dark:border-slate-700 mt-2">
                        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={mode === 'human' ? "Digite para o atendente..." : "Pergunte à IA..."}
                                className="flex-1 px-4 py-2 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button type="submit" disabled={!inputText.trim() || loading} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50">
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
