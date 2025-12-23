
import React from 'react';
import { Product } from '../../types';

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    cart: Product[];
    onRemoveItem: (index: number) => void;
    onCheckout: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, cart, onRemoveItem, onCheckout }) => {
    if (!isOpen) return null;

    const total = cart.reduce((acc, item) => acc + (item.promotional_price || item.price), 0);

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        Meu Carrinho
                        <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full">
                            {cart.length}
                        </span>
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {cart.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            </div>
                            <p className="text-lg font-bold text-slate-700 dark:text-slate-200">Carrinho Vazio</p>
                            <p className="text-sm opacity-75 mt-1">Adicione produtos para começar.</p>
                            <button onClick={onClose} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm">Explorar Loja</button>
                        </div>
                    ) : (
                        cart.map((item, index) => (
                            <div key={`${item.id}-${index}`} className="flex gap-3 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative group">
                                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center p-2">
                                    <img src={item.image_url!} className="max-h-full max-w-full object-contain" />
                                </div>
                                <div className="flex-1 flex flex-col justify-center">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{item.name}</h4>
                                    <p className="text-xs text-slate-500">{item.brand}</p>
                                    <p className="text-sm font-black text-indigo-600 mt-1">R$ {(item.promotional_price || item.price).toLocaleString('pt-BR')}</p>
                                </div>
                                <button 
                                    onClick={() => onRemoveItem(index)}
                                    className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                        <div className="flex justify-between items-end mb-4">
                            <span className="text-slate-500 font-bold uppercase text-xs">Total Estimado</span>
                            <span className="text-2xl font-black text-slate-900 dark:text-white">R$ {total.toLocaleString('pt-BR')}</span>
                        </div>
                        <button 
                            onClick={onCheckout}
                            className="w-full py-4 bg-indigo-600 text-white text-sm font-black rounded-2xl hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/30 flex justify-center items-center gap-2"
                        >
                            FECHAR PEDIDO <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CartDrawer;
