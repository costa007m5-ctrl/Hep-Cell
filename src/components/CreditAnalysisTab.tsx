
import React, { useState, useEffect } from 'react';
import { Profile, LimitRequest } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Modal from './Modal';

const CreditAnalysisTab: React.FC = () => {
    const [requests, setRequests] = useState<LimitRequest[]>([]);
    const [selectedReq, setSelectedReq] = useState<LimitRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');
    
    const [approvedLimit, setApprovedLimit] = useState<string>('');
    const [approvedScore, setApprovedScore] = useState<string>('');
    const [adminReason, setAdminReason] = useState<string>('');
    const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/limit-requests');
            const data = await res.json();
            if (res.ok) setRequests(data);
        } catch (error) { console.error(error); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchRequests(); }, []);

    const handleSelectRequest = (req: LimitRequest) => {
        setSelectedReq(req);
        setApprovedLimit(String(req.requested_amount));
        setApprovedScore(String(req.profiles?.credit_score || 600));
        setAdminReason('');
        setFeedbackMessage(null);
    };

    const handleSubmitDecision = async (action: 'approve_manual' | 'reject') => {
        if (!selectedReq) return;
        setIsProcessing(true);
        try {
            const res = await fetch('/api/admin/manage-limit-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: selectedReq.id,
                    action,
                    manualLimit: parseFloat(approvedLimit),
                    manualScore: parseInt(approvedScore),
                    responseReason: adminReason
                })
            });
            if (res.ok) {
                setFeedbackMessage({ type: 'success', text: `Solicitação processada!` });
                fetchRequests();
                setTimeout(() => setSelectedReq(null), 1500);
            }
        } catch (error) { setFeedbackMessage({ type: 'error', text: "Erro ao processar." }); }
        finally { setIsProcessing(false); }
    };

    const filteredRequests = requests.filter(r => filterStatus === 'all' || r.status === 'pending');

    return (
        <div className="flex h-[calc(100vh-100px)] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
            {/* Sidebar */}
            <div className="w-1/3 border-r border-slate-100 dark:border-slate-800 flex flex-col">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Pedidos de Crédito</h3>
                    <div className="flex gap-2 mt-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button onClick={() => setFilterStatus('pending')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${filterStatus === 'pending' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Pendentes</button>
                        <button onClick={() => setFilterStatus('all')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${filterStatus === 'all' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Todos</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isLoading ? <LoadingSpinner /> : filteredRequests.map(req => (
                        <div key={req.id} onClick={() => handleSelectRequest(req)} className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedReq?.id === req.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                            <p className="font-bold text-sm text-slate-900">{req.profiles?.first_name} {req.profiles?.last_name}</p>
                            <p className="text-xl font-black text-indigo-600 mt-1">R$ {req.requested_amount.toLocaleString('pt-BR')}</p>
                            <p className="text-[9px] text-slate-400 mt-2 uppercase font-bold">{new Date(req.created_at).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Principal */}
            <div className="flex-1 p-8 overflow-y-auto">
                {selectedReq ? (
                    <div className="space-y-8 animate-fade-in">
                        {feedbackMessage && <Alert message={feedbackMessage.text} type={feedbackMessage.type} />}
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">{selectedReq.profiles?.first_name} {selectedReq.profiles?.last_name}</h2>
                                <p className="text-sm text-slate-500">{selectedReq.profiles?.email}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Score Atual</p>
                                <p className="text-3xl font-black text-indigo-600">{selectedReq.profiles?.credit_score || 0}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Solicitado</p>
                                <p className="text-3xl font-black text-indigo-600">R$ {selectedReq.requested_amount.toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Justificativa</p>
                                <p className="text-sm italic text-slate-600">"{selectedReq.justification}"</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-8 border-t">
                            <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Painel do Analista</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Aprovar Limite (R$)</label><input type="number" value={approvedLimit} onChange={e => setApprovedLimit(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-black text-xl" /></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Ajustar Score</label><input type="number" value={approvedScore} onChange={e => setApprovedScore(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-black text-xl" /></div>
                            </div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Motivo / Mensagem ao Cliente</label><textarea value={adminReason} onChange={e => setAdminReason(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm h-24" placeholder="Explique a decisão ao cliente..." /></div>
                            <div className="flex gap-4">
                                <button onClick={() => handleSubmitDecision('reject')} disabled={isProcessing} className="flex-1 py-4 bg-red-50 text-red-600 font-bold rounded-2xl active:scale-95 transition-all">REJEITAR</button>
                                <button onClick={() => handleSubmitDecision('approve_manual')} disabled={isProcessing} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl active:scale-[0.98] transition-all">APROVAR AUMENTO</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <svg className="w-20 h-20 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="font-bold uppercase tracking-widest text-sm">Selecione uma análise pendente</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreditAnalysisTab;
