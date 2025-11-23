
import React, { useState, useEffect } from 'react';
import { Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface LimitRequest {
    id: string;
    user_id: string;
    requested_amount: number;
    current_limit: number;
    justification: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    profiles: Profile & { salary: number }; // Join
}

interface AIAnalysisResult {
    suggestedLimit: number;
    suggestedScore: number;
    reason: string;
}

const CreditAnalysisTab: React.FC = () => {
    const [requests, setRequests] = useState<LimitRequest[]>([]);
    const [selectedReq, setSelectedReq] = useState<LimitRequest | null>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
    
    // Form States
    const [approvedLimit, setApprovedLimit] = useState<string>('');
    const [approvedScore, setApprovedScore] = useState<string>('');
    const [adminReason, setAdminReason] = useState<string>('');
    const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/limit-requests');
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (error) {
            console.error("Erro ao buscar solicitações", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDocuments = async (userId: string) => {
        try {
            const res = await fetch(`/api/admin/client-documents?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                // Combina uploads e contratos, priorizando uploads recentes
                setDocuments([...data.uploads, ...data.contracts]);
            }
        } catch (error) {
            console.error("Erro ao buscar documentos", error);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleSelectRequest = (req: LimitRequest) => {
        setSelectedReq(req);
        setApprovedLimit(String(req.requested_amount)); // Sugere o que pediu inicialmente
        setApprovedScore(String(req.profiles.credit_score || 600));
        setAdminReason('');
        setAiResult(null);
        setDocuments([]);
        fetchDocuments(req.user_id);
    };

    const handleRunAI = async () => {
        if (!selectedReq) return;
        setIsProcessing(true);
        try {
            const res = await fetch('/api/admin/manage-limit-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: selectedReq.id,
                    action: 'calculate_auto'
                })
            });
            const data = await res.json();
            if (res.ok) {
                setAiResult(data);
                setApprovedLimit(String(data.suggestedLimit));
                setApprovedScore(String(data.suggestedScore));
                setAdminReason(data.reason); // Preenche o motivo com a sugestão da IA
            }
        } catch (error) {
            alert("Erro ao consultar IA");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSubmitDecision = async (action: 'approve_manual' | 'reject') => {
        if (!selectedReq) return;
        setIsProcessing(true);
        setFeedbackMessage(null);

        try {
            const payload = {
                requestId: selectedReq.id,
                action,
                manualLimit: parseFloat(approvedLimit),
                manualScore: parseInt(approvedScore),
                responseReason: adminReason
            };

            const res = await fetch('/api/admin/manage-limit-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setFeedbackMessage({ type: 'success', text: `Solicitação ${action === 'reject' ? 'rejeitada' : 'aprovada'} com sucesso!` });
                
                // Remove da lista local
                setRequests(prev => prev.filter(r => r.id !== selectedReq.id));
                setSelectedReq(null);
            } else {
                throw new Error("Falha na operação");
            }
        } catch (error) {
            setFeedbackMessage({ type: 'error', text: "Erro ao processar decisão." });
        } finally {
            setIsProcessing(false);
        }
    };

    const incomeProof = documents.find(d => d.document_type === 'Comprovante de Renda' || d.title?.toLowerCase().includes('renda') || d.title?.toLowerCase().includes('holerite'));

    return (
        <div className="flex h-[calc(100vh-100px)] bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            
            {/* Sidebar: Lista de Solicitações */}
            <div className="w-1/3 min-w-[300px] border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" /></svg>
                        Fila de Análise ({requests.length})
                    </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {isLoading ? (
                        <div className="flex justify-center p-8"><LoadingSpinner /></div>
                    ) : requests.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 text-sm">Nenhuma solicitação pendente.</div>
                    ) : (
                        requests.map(req => (
                            <div 
                                key={req.id} 
                                onClick={() => handleSelectRequest(req)}
                                className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${selectedReq?.id === req.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-slate-800 dark:text-white text-sm">{req.profiles.first_name} {req.profiles.last_name}</span>
                                    <span className="text-xs text-slate-400">{new Date(req.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase">Solicitado</p>
                                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">R$ {req.requested_amount.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 uppercase">Renda</p>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">R$ {req.profiles.salary?.toLocaleString() || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Área Principal: Detalhes e Ação */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-900 overflow-y-auto p-6">
                {selectedReq ? (
                    <div className="max-w-3xl mx-auto space-y-6">
                        {feedbackMessage && <Alert message={feedbackMessage.text} type={feedbackMessage.type} />}

                        {/* Cabeçalho do Cliente */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                    {selectedReq.profiles.first_name[0]}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedReq.profiles.first_name} {selectedReq.profiles.last_name}</h2>
                                    <p className="text-sm text-slate-500">CPF: {selectedReq.profiles.identification_number || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="inline-flex flex-col items-end">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Score Atual</span>
                                    <span className={`text-2xl font-black ${selectedReq.profiles.credit_score > 700 ? 'text-green-500' : selectedReq.profiles.credit_score < 400 ? 'text-red-500' : 'text-yellow-500'}`}>
                                        {selectedReq.profiles.credit_score || 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Comparativo Financeiro */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-500 uppercase font-bold">Limite Atual</p>
                                <p className="text-xl font-bold text-slate-700 dark:text-slate-300">R$ {selectedReq.current_limit.toLocaleString()}</p>
                            </div>
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-200 dark:bg-indigo-800 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>
                                <p className="text-xs text-indigo-800 dark:text-indigo-300 uppercase font-bold">Solicitado</p>
                                <p className="text-xl font-black text-indigo-700 dark:text-indigo-200">R$ {selectedReq.requested_amount.toLocaleString()}</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                                <p className="text-xs text-green-800 dark:text-green-300 uppercase font-bold">Renda Declarada</p>
                                <p className="text-xl font-bold text-green-700 dark:text-green-200">R$ {selectedReq.profiles.salary?.toLocaleString() || '0'}</p>
                            </div>
                        </div>

                        {/* Justificativa e Comprovante */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Justificativa do Cliente</h4>
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm italic text-slate-600 dark:text-slate-400 min-h-[100px]">
                                    "{selectedReq.justification}"
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Comprovante de Renda</h4>
                                {incomeProof ? (
                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center min-h-[100px] gap-2">
                                        <p className="text-xs font-medium truncate w-full text-center">{incomeProof.title}</p>
                                        <a 
                                            href={incomeProof.file_url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white text-xs font-bold rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            Visualizar Documento
                                        </a>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800 flex items-center justify-center min-h-[100px] text-red-500 text-sm font-medium">
                                        Nenhum comprovante anexado.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Área de Decisão */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 relative">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Área de Decisão</h3>
                                <button 
                                    onClick={handleRunAI}
                                    disabled={isProcessing}
                                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-full shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isProcessing ? <LoadingSpinner /> : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                            Analisar com IA
                                        </>
                                    )}
                                </button>
                            </div>

                            {aiResult && (
                                <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg animate-fade-in">
                                    <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase mb-1">Sugestão da IA</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{aiResult.reason}</p>
                                    <div className="mt-2 flex gap-4">
                                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">Sugerido: R$ {aiResult.suggestedLimit.toLocaleString()}</span>
                                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">Score: {aiResult.suggestedScore}</span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Limite Aprovado</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold">R$</span>
                                        <input 
                                            type="number" 
                                            value={approvedLimit}
                                            onChange={e => setApprovedLimit(e.target.value)}
                                            className="w-full pl-8 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Atualizar Score</label>
                                    <input 
                                        type="number" 
                                        value={approvedScore}
                                        onChange={e => setApprovedScore(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Motivo / Feedback ao Cliente</label>
                                <textarea 
                                    rows={3}
                                    value={adminReason}
                                    onChange={e => setAdminReason(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                    placeholder="Ex: Aprovado parcialmente devido ao tempo de histórico..."
                                ></textarea>
                            </div>

                            <div className="flex gap-4">
                                <button 
                                    onClick={() => handleSubmitDecision('reject')}
                                    disabled={isProcessing}
                                    className="flex-1 py-3 bg-red-50 text-red-600 border border-red-200 font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                    Rejeitar
                                </button>
                                <button 
                                    onClick={() => handleSubmitDecision('approve_manual')}
                                    disabled={isProcessing}
                                    className="flex-[2] py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-lg shadow-green-500/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    Aprovar Limite
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="text-lg font-medium">Selecione uma solicitação para analisar</p>
                        <p className="text-sm opacity-60">Os detalhes aparecerão aqui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreditAnalysisTab;
