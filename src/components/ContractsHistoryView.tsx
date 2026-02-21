import React, { useState, useEffect } from 'react';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';

interface Contract {
    id: string;
    title: string;
    items: string;
    total_value: number;
    status: string;
    created_at: string;
    signature_data?: string;
}

const ContractsHistoryView: React.FC<{ userId: string }> = ({ userId }) => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

    useEffect(() => {
        const fetchContracts = async () => {
            setLoading(true);
            try {
                const { data } = await supabase
                    .from('contracts')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                setContracts(data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchContracts();
    }, [userId]);

    if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight px-1">Meus Contratos</h2>
            
            {contracts.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-slate-400 text-sm">Nenhum contrato assinado.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {contracts.map(contract => (
                        <button 
                            key={contract.id} 
                            onClick={() => setSelectedContract(contract)}
                            className="w-full text-left p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:border-indigo-300 transition-all flex justify-between items-center"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white text-sm">{contract.title}</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Assinado em {new Date(contract.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <span className="text-[9px] font-black px-2 py-1 bg-green-100 text-green-700 rounded-lg uppercase">Válido</span>
                        </button>
                    ))}
                </div>
            )}

            {selectedContract && (
                <Modal isOpen={true} onClose={() => setSelectedContract(null)}>
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-4">
                            <h3 className="text-lg font-black uppercase tracking-tight">Termos do Contrato</h3>
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 max-h-60 overflow-y-auto text-[10px] font-mono text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                            {selectedContract.items}
                        </div>

                        {selectedContract.signature_data && (
                            <div className="pt-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Sua Assinatura Digital</p>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-center">
                                    <img src={selectedContract.signature_data} className="max-h-20 object-contain" alt="Assinatura" />
                                </div>
                            </div>
                        )}

                        <button onClick={() => setSelectedContract(null)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg">FECHAR</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ContractsHistoryView;