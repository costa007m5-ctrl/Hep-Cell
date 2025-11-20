import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';

const SupportChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;
        
        const userMsg = inputText;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInputText('');
        setLoading(true);

        try {
             // Get User Context for "Smart" answers
             const { data: { user } } = await supabase.auth.getUser();
             let context = "";
             
             if (user) {
                 const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                 const { data: invoices } = await supabase.from('invoices').select('*').eq('user_id', user.id).eq('status', 'Em aberto');
                 
                 context += `Nome do usuário: ${profile?.first_name || 'Cliente'}. Faturas em aberto: ${invoices?.length || 0}.`;
             } else {
                 context = "Usuário não logado.";
             }

             const response = await fetch('/api/admin/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: userMsg,
                    context: context 
                }),
            });

            if (!response.ok) {
                 throw new Error('Falha na comunicação com a IA.');
            }

            const data = await response.json();
            const reply = data.reply || "Desculpe, não consegui processar sua resposta.";

            setMessages(prev => [...prev, { role: 'model', text: reply }]);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', text: "Estou com dificuldades de conexão no momento. Tente novamente em alguns instantes." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                aria-label="Ajuda IA"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            </button>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
                <div className="flex flex-col h-[500px] max-h-[80vh]">
                    <div className="flex-shrink-0 pb-4 border-b border-slate-100 dark:border-slate-700 mb-2">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Suporte Relp AI
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Pergunte sobre faturas, produtos ou sua conta.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 p-2 custom-scrollbar">
                        {messages.length === 0 && (
                             <div className="text-center text-sm text-slate-400 mt-10">
                                 <p>Olá! Sou a IA da Relp Cell.</p>
                                 <p>Como posso ajudar hoje?</p>
                                 <div className="mt-4 space-y-2">
                                     <button onClick={() => setInputText("Como aumento meu limite?")} className="block w-full text-xs bg-slate-100 dark:bg-slate-700 p-2 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900">Como aumento meu limite?</button>
                                     <button onClick={() => setInputText("Tenho faturas atrasadas?")} className="block w-full text-xs bg-slate-100 dark:bg-slate-700 p-2 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900">Tenho faturas atrasadas?</button>
                                 </div>
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
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                                    </div>
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
                                placeholder="Digite sua dúvida..."
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