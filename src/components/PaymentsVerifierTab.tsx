
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface AuditInvoice {
    id: string;
    month: string;
    amount: number;
    status: string;
    due_date: string;
    payment_id?: string;
    boleto_barcode?: string;
    profiles?: {
        first_name: string;
        last_name: string;
        email: string;
        identification_number: string;
    };
}

const PaymentsVerifierTab: React.FC = () => {
    const [invoices, setInvoices] = useState<AuditInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin?action=audit-invoices');
            const data = await res.json();
            if (res.ok) {
                setInvoices(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleApprove = async (invoiceId: string) => {
        if (!confirm("Tem certeza que deseja marcar esta fatura como PAGA manualmente?")) return;
        setIsProcessing(invoiceId);
        setMessage(null);

        try {
            const res = await fetch('/api/admin?action=approve-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId })
            });
            const data = await res.json();

            if (res.ok) {
                setMessage({ text: 'Pagamento aprovado com sucesso!', type: 'success' });
                // Remove da lista
                setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
            } else {
                throw new Error(data.error);
            }
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally {
            setIsProcessing(null);
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        const term = searchTerm.toLowerCase();
        const clientName = `${inv.profiles?.first_name || ''} ${inv.profiles?.last_name || ''}`.toLowerCase();
        const cpf = inv.profiles?.identification_number || '';
        return clientName.includes(term) || cpf.includes(term) || inv.id.includes(term);
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Auditoria de Pagamentos</h2>
                <button onClick={fetchInvoices} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" /></svg>
                </button>
            </div>

            {message && <Alert message={message.text} type={message.type} />}

            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Buscar por cliente, CPF ou ID da fatura..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            {isLoading ? <LoadingSpinner /> : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Fatura</th>
                                    <th className="px-6 py-4">Valor</th>
                                    <th className="px-6 py-4">Vencimento</th>
                                    <th className="px-6 py-4">Status MP</th>
                                    <th className="px-6 py-4 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                                {filteredInvoices.length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">Nenhuma fatura pendente encontrada.</td></tr>
                                ) : filteredInvoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-900 dark:text-white">{inv.profiles?.first_name} {inv.profiles?.last_name}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">{inv.profiles?.identification_number}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-slate-700 dark:text-slate-300 font-medium">{inv.month}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">#{inv.id.slice(0,8)}</p>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                            R$ {inv.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                            {new Date(inv.due_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {inv.payment_id ? (
                                                <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-1 rounded font-bold uppercase">Iniciado</span>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded font-bold uppercase">Pendente</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleApprove(inv.id)}
                                                disabled={isProcessing === inv.id}
                                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase shadow-lg shadow-green-500/20 active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {isProcessing === inv.id ? <LoadingSpinner /> : 'Baixar Manualmente'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentsVerifierTab;
