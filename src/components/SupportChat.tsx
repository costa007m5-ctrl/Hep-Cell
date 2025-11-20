import React, { useState } from 'react';
import Modal from './Modal';

const SupportChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Floating Action Button */}
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
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Ajuda Inteligente</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Olá! Eu sou o assistente virtual da Relp Cell. Posso te ajudar com pagamentos, produtos e dúvidas sobre seu limite.
                    </p>
                    
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm text-left space-y-2">
                        <p className="font-medium text-slate-700 dark:text-slate-200">Dúvidas frequentes:</p>
                        <button className="block w-full text-left px-3 py-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 hover:border-indigo-500 text-slate-600 dark:text-slate-300 transition-colors">Como aumento meu limite?</button>
                        <button className="block w-full text-left px-3 py-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 hover:border-indigo-500 text-slate-600 dark:text-slate-300 transition-colors">Onde vejo minhas faturas?</button>
                        <button className="block w-full text-left px-3 py-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 hover:border-indigo-500 text-slate-600 dark:text-slate-300 transition-colors">Qual o prazo de entrega?</button>
                    </div>

                    <button 
                        onClick={() => window.open('https://wa.me/5511999999999', '_blank')} // Exemplo WhatsApp
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                        Falar no WhatsApp
                    </button>
                </div>
            </Modal>
        </>
    );
};

export default SupportChat;