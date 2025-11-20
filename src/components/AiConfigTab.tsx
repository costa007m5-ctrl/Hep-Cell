import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface Message {
    role: 'user' | 'model';
    text: string;
}

const AiConfigTab: React.FC = () => {
    // Config States
    const [currentModel, setCurrentModel] = useState('gemini-2.5-flash');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);

    // Chat Test States
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const availableModels = [
        { 
            id: 'gemini-2.5-flash', 
            name: 'Gemini 2.5 Flash (Recomendado)', 
            desc: 'Equilíbrio ideal entre velocidade e inteligência. Melhor para atendimento ao cliente.' 
        },
        { 
            id: 'gemini-flash-lite-latest', 
            name: 'Gemini 2.5 Flash Lite', 
            desc: 'Ultra rápido e leve. Bom para respostas curtas e diretas.' 
        },
        { 
            id: 'gemini-3-pro-preview', 
            name: 'Gemini 3 Pro Preview', 
            desc: 'Mais inteligente e capaz de raciocínio complexo. Pode ser um pouco mais lento.' 
        }
    ];

    // Carregar configuração atual
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                if (res.ok) {
                    const data = await res.json();
                    if (data.chat_model) {
                        setCurrentModel(data.chat_model);
                    }
                }
            } catch (error) {
                console.error("Erro ao carregar config da IA:", error);
            } finally {
                setIsLoadingConfig(false);
            }
        };
        fetchSettings();
    }, []);

    // Scroll to bottom do chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSaveConfig = async () => {
        setIsSaving(true);
        setSaveMessage(null);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'chat_model', value: currentModel })
            });

            if (!res.ok) throw new Error('Falha ao salvar configuração.');
            
            setSaveMessage({ text: 'Modelo de IA atualizado com sucesso!', type: 'success' });
            
            // Limpa mensagem de sucesso após 3s
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            setSaveMessage({ text: 'Erro ao salvar. Tente novamente.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setIsChatting(true);

        try {
            // Envia para a API de chat (que agora lê a config do banco)
            // Enviamos um contexto de teste
            const response = await fetch('/api/admin/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: userMsg,
                    context: "Contexto de TESTE DO ADMIN: O usuário é o administrador do sistema testando a funcionalidade."
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || "Erro na resposta da IA");
            }

            setMessages(prev => [...prev, { role: 'model', text: data.reply }]);

        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'model', text: `Erro: ${error.message}. Verifique se a API Key está correta.` }]);
        } finally {
            setIsChatting(false);
        }
    };

    if (isLoadingConfig) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;

    return (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-100px)]">
            {/* Coluna da Esquerda: Configuração */}
            <div className="space-y-6">
                <section>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Configuração da IA</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                        Escolha qual "cérebro" a IA deve usar para conversar com seus clientes. 
                        Se o chat estiver travando, tente trocar para uma versão "Flash" ou "Lite".
                    </p>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            Modelo Ativo
                        </label>
                        
                        <div className="space-y-3">
                            {availableModels.map(model => (
                                <div 
                                    key={model.id}
                                    onClick={() => setCurrentModel(model.id)}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                        currentModel === model.id 
                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
                                        : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-500'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`font-bold ${currentModel === model.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {model.name}
                                        </span>
                                        {currentModel === model.id && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{model.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <button 
                                onClick={handleSaveConfig}
                                disabled={isSaving}
                                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center"
                            >
                                {isSaving ? <LoadingSpinner /> : 'Salvar Configuração'}
                            </button>
                            {saveMessage && <div className="mt-4"><Alert message={saveMessage.text} type={saveMessage.type} /></div>}
                        </div>
                    </div>
                </section>
            </div>

            {/* Coluna da Direita: Teste */}
            <div className="flex flex-col bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        Teste em Tempo Real
                    </h3>
                    <p className="text-xs text-slate-500">Este chat usa o modelo configurado ao lado.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100 dark:bg-slate-900/20">
                    {messages.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-sm">
                            Envie uma mensagem para testar a IA.
                        </div>
                    )}
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isChatting && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-700 p-3 rounded-xl rounded-bl-none shadow-sm">
                                <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleTestChat} className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Digite uma mensagem de teste..."
                        className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-full bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                    <button 
                        type="submit" 
                        disabled={isChatting || !input.trim()}
                        className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AiConfigTab;