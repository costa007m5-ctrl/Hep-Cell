
import React, { useState, useRef, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface Message {
    role: 'user' | 'model';
    text: string;
    timestamp: string;
}

const SUGGESTIONS = [
    "Como pagar minha fatura?",
    "Qual meu limite atual?",
    "Como funciona o cashback?",
    "Quero renegociar dívida"
];

const SupportChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
        if (isOpen) {
            setHasUnread(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [messages, isOpen]);

    // Mensagem de boas-vindas automática
    useEffect(() => {
        if (messages.length === 0) {
            setTimeout(() => {
                setMessages([{
                    role: 'model',
                    text: 'Olá! Sou o RelpBot, seu assistente virtual 🤖. Posso tirar dúvidas sobre faturas, limites e compras. Como posso ajudar?',
                    timestamp: new Date().toISOString()
                }]);
                setHasUnread(true);
            }, 1000);
        }
    }, []);

    const handleSendMessage = async (textOverride?: string) => {
        const text = textOverride || inputText;
        if (!text.trim()) return;

        // User Message
        const userMsg: Message = { role: 'user', text: text, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);
        setIsTyping(true);

        try {
            // Simula tempo de "pensar" da IA para parecer mais natural
            await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 1000));

            const response = await fetch('/api/admin/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: text, 
                    context: "Você é o RelpBot, um assistente virtual da Relp Cell. Responda de forma amigável, curta e direta. Se não souber a resposta ou se o usuário pedir para falar com humano, sugira gentilmente que ele acesse a 'Central de Atendimento' no menu Perfil para abrir um chamado com nossa equipe." 
                })
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || "Erro na IA");

            const aiMsg: Message = { role: 'model', text: data.reply, timestamp: new Date().toISOString() };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            setMessages(prev => [...prev, { 
                role: 'model', 
                text: "Ops, tive um probleminha de conexão. Tente novamente ou abra um chamado na Central de Atendimento.", 
                timestamp: new Date().toISOString() 
            }]);
        } finally {
            setLoading(false);
            setIsTyping(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-24 right-4 z-50 flex items-center justify-center transition-all duration-500 shadow-2xl shadow-indigo-500/40 ${isOpen ? 'w-12 h-12 rounded-full bg-slate-800 text-white rotate-90' : 'w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white hover:scale-110 animate-bounce-slow'}`}
                aria-label="Chat IA"
            >
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                    <div className="relative flex items-center justify-center w-full h-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        {hasUnread && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                    </div>
                )}
            </button>

            {/* Chat Window */}
            <div 
                className={`fixed bottom-44 right-4 z-40 w-[90vw] max-w-[360px] h-[550px] max-h-[70vh] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/20 dark:border-slate-700 transform transition-all duration-300 origin-bottom-right flex flex-col overflow-hidden ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-10 pointer-events-none'}`}
            >
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md shadow-inner">
                            <span className="text-xl">🤖</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg leading-tight tracking-wide">RelpBot</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                <span className="text-xs text-indigo-100 font-medium">IA Online</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-hide">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                            <div 
                                className={`max-w-[85%] p-3.5 text-sm leading-relaxed shadow-sm relative whitespace-pre-wrap break-words ${
                                    msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm' 
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl rounded-bl-sm border border-slate-100 dark:border-slate-700'
                                }`}
                            >
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    
                    {isTyping && (
                        <div className="flex justify-start animate-fade-in">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none shadow-sm border border-slate-100 dark:border-slate-700 flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestions & Input */}
                <div className="bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0 pb-safe">
                    {/* Quick Chips */}
                    <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide bg-slate-50 dark:bg-slate-900/50">
                        {SUGGESTIONS.map((s, i) => (
                            <button 
                                key={i}
                                onClick={() => handleSendMessage(s)}
                                disabled={loading}
                                className="whitespace-nowrap px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 transition-colors shadow-sm active:scale-95"
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                        className="p-3 flex items-center gap-2"
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Digite sua dúvida..."
                            className="flex-1 bg-slate-100 dark:bg-slate-900 border-0 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder-slate-400 transition-all"
                            disabled={loading}
                        />
                        <button 
                            type="submit" 
                            disabled={!inputText.trim() || loading}
                            className="p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
};

export default SupportChat;
