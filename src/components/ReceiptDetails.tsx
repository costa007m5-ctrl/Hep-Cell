
import React from 'react';
import { Invoice } from '../types';

interface ReceiptDetailsProps {
    invoice: Invoice;
    onClose: () => void;
    onDownload: () => void;
}

const ReceiptDetails: React.FC<ReceiptDetailsProps> = ({ invoice, onClose, onDownload }) => {
    // Helpers para ícones e textos baseados no método (simulado via payment_method ou payment_id)
    // Na prática, você salvaria o método exato no banco. Aqui vamos inferir pelo ID simulado ou props.
    
    let methodData = {
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        label: 'Pagamento Confirmado',
        color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
        details: <></>
    };

    // Logica simples para diferenciar os exemplos
    if (invoice.payment_method === 'pix' || invoice.id.includes('pix')) {
        methodData = {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
            label: 'Pix Realizado',
            color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
            details: (
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Destinatário:</span>
                        <span className="font-medium">Relp Cell Eletrônicos</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Chave Pix:</span>
                        <span className="font-medium">43.735.304/0001-00</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">ID da Transação:</span>
                        <span className="font-mono text-xs">{invoice.payment_id}</span>
                    </div>
                </div>
            )
        };
    } else if (invoice.payment_method === 'credit_card' || invoice.id.includes('card')) {
        methodData = {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
            label: 'Cartão de Crédito',
            color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30',
            details: (
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Cartão:</span>
                        <span className="font-medium">Mastercard **** 4829</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Parcelas:</span>
                        <span className="font-medium">1x (À vista)</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Autorização:</span>
                        <span className="font-mono text-xs">{invoice.payment_id?.substring(0, 6).toUpperCase()}</span>
                    </div>
                </div>
            )
        };
    } else if (invoice.payment_method === 'boleto' || invoice.id.includes('bol')) {
        methodData = {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
            label: 'Boleto Compensado',
            color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
            details: (
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Banco:</span>
                        <span className="font-medium">237 - Bradesco</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Vencimento Original:</span>
                        <span className="font-medium">{new Date(invoice.due_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Linha Digitável:</span>
                        <span className="font-mono text-[10px] truncate max-w-[150px]">34191.79001 01043.510047...</span>
                    </div>
                </div>
            )
        };
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header Visual do Recibo */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 text-center border-b border-dashed border-slate-300 dark:border-slate-600 relative">
                {/* Efeito de "serrilhado" do papel */}
                <div className="absolute -bottom-2 left-0 w-full h-4 bg-slate-50 dark:bg-slate-900 [mask-image:linear-gradient(45deg,transparent_50%,black_50%),linear-gradient(-45deg,transparent_50%,black_50%)] [mask-size:20px_20px] [mask-repeat:repeat-x]"></div>
                
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${methodData.color}`}>
                    {methodData.icon}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{methodData.label}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {new Date(invoice.payment_date!).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    <br/>
                    às {new Date(invoice.payment_date!).toLocaleTimeString('pt-BR')}
                </p>
            </div>

            {/* Corpo do Recibo */}
            <div className="p-6 space-y-6 flex-1 bg-white dark:bg-slate-900">
                
                <div className="text-center">
                    <p className="text-sm text-slate-500 uppercase tracking-wide">Valor Total</p>
                    <p className="text-4xl font-bold text-slate-900 dark:text-white">
                        {invoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Detalhes da Transação</h3>
                    {methodData.details}
                    <div className="flex justify-between mt-2">
                        <span className="text-sm text-slate-500">Referência:</span>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{invoice.month}</span>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-xs text-slate-500">Autenticação Digital</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-1 break-all">
                        {invoice.id}-{Math.random().toString(36).substring(7)}
                    </p>
                </div>
            </div>

            {/* Ações */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 bg-white dark:bg-slate-900">
                <button onClick={onClose} className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    Fechar
                </button>
                <button onClick={onDownload} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Baixar PDF
                </button>
            </div>
        </div>
    );
};

export default ReceiptDetails;
