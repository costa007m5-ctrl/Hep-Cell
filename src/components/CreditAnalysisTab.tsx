
import React, { useState, useEffect, useMemo } from 'react';
import { Profile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Modal from './Modal';

interface LimitRequest {
    id: string;
    user_id: string;
    requested_amount: number;
    current_limit: number;
    justification: string;
    status: 'pending' | 'approved' | 'rejected';
    admin_response_reason?: string;
    created_at: string;
    profiles?: Profile & { salary?: number }; // Salary é opcional
}

interface AIAnalysisResult {
    suggestedLimit: number;
    suggestedScore: number;
    reason: string;
    documentAnalysis?: string;
}

const CreditAnalysisTab: React.FC = () => {
    const [requests, setRequests] = useState<LimitRequest[]>([]);
    const [selectedReq, setSelectedReq] = useState<LimitRequest | null>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');
    const [error, setError] = useState<string | null>(null);
    const [isRepairing, setIsRepairing] = useState(false);
    
    // Form States
    const [approvedLimit, setApprovedLimit] = useState<string>('');
    const [approvedScore, setApprovedScore] = useState<string>('');
    const [adminReason, setAdminReason] = useState<string>('');
    const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    // Document Viewer State
    const [docPreview, setDocPreview] = useState<string | null>(null);

    const fetchRequests = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/limit-requests');
            const data = await res.json();
            
            if (res.ok) {
                setRequests(data);
            } else {
                // Captura erro específico (ex: tabela não existe)
                const msg = data.error || 'Erro desconhecido ao buscar solicitações.';
                setError(msg);
                console.error("Erro API:", msg);
            }
        } catch (error: any) {
            setError(error.message || "Falha de conexão.");
            console.error("Erro de conexão:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Função para tentar reparar o banco de dados automaticamente
    const handleRepairDatabase = async () => {
        setIsRepairing(true);
        try {
            const res = await fetch('/api/admin/setup-database', { method: 'POST' });
            if (res.ok) {
                await fetchRequests(); // Tenta buscar novamente
                setError(null);
                setFeedbackMessage({ type: 'success', text: 'Banco de dados atualizado! Tente novamente.' });
            } else {
                const data = await res.json();
                setFeedbackMessage({ type: 'error', text: `Falha ao reparar: ${data.error}` });
            }
        } catch (e) {
            setFeedbackMessage({ type: 'error', text: "Erro de conexão ao tentar reparar." });
        } finally {
            setIsRepairing(false);
        }
    };

    // Função para buscar documentos do usuário selecionado
    const fetchDocuments = async (userId: string) => {
        try {
            const res = await fetch(`/api/admin/client-documents?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                setDocuments([...(data.uploads || []), ...(data.contracts || [])]);
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
        // Define valores iniciais do formulário
        setApprovedLimit(String(req.requested_amount));
        setApprovedScore(String(req.profiles?.credit_score || 600));
        setAdminReason('');
        setAiResult(null);
        setDocuments([]); // Limpa docs anteriores
        setFeedbackMessage(null);
        
        // Busca documentos para este usuário
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
                // Aqui preenchemos o campo de texto do motivo automaticamente
                setAdminReason(data.reason); 
            }
        } catch (error) {
            setFeedbackMessage({ type: 'error', text: "Erro ao consultar IA" });
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
                
                // Atualiza a lista localmente para refletir a mudança sem recarregar tudo
                setRequests(prev => prev.map(r => r.id === selectedReq.id ? { ...r, status: action === 'approve_manual' ? 'approved' : 'rejected', admin_response_reason: adminReason } : r));
                
                setTimeout(() => {
                    setSelectedReq(null);
                }, 2000);
            } else {
                throw new Error("Falha na operação");
            }
        } catch (error) {
            setFeedbackMessage({ type: 'error', text: "Erro ao processar decisão." });
        } finally {
            setIsProcessing(false);
        }
    };

    // Filtra o comprovante de renda mais recente
    const incomeProof = useMemo(() => {
        return documents
            .filter(d => d.document_type === 'Comprovante de Renda')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    }, [documents]);

    const filteredRequests = useMemo(() => {
        if (filterStatus === 'all') return requests;
        return requests.filter(r => r.status === 'pending');
    }, [requests, filterStatus]);

    return (
        <div className="flex h-[calc(100vh-100px)] bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            
            {/* Sidebar: Lista de Solicitações */}
            <div className="w-1/3 min-w-[320px] border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" /></svg>
                            Solicitações ({filteredRequests.length})
                        </h3>
                        <button onClick={fetchRequests} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="Atualizar">
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" /></svg>
                        </button>
                    </div>
                    <div className="flex gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button onClick={() => setFilterStatus('pending')} className={`flex-1 py-1.5 text-xs font-bold rounded ${filterStatus === 'pending' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Pendentes</button>
                        <button onClick={() => setFilterStatus('all')} className={`flex-1 py-1.5 text-xs font-bold rounded ${filterStatus === 'all' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Todos</button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {isLoading ? (
                        <div className="flex justify-center p-8"><LoadingSpinner /></div>
                    ) : error ? (
                        <div className="p-4 text-center">
                            <p className="text-xs text-red-500 mb-3">{error}</p>
                            <button 
                                onClick={handleRepairDatabase} 
                                disabled={isRepairing}
                                className="w-full py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors flex justify-center gap-2"
                            >
                                {isRepairing ? <LoadingSpinner /> : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        Inicializar Banco de Dados
                                    </>
                                )}
                            </button>
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 text-sm">Nenhuma solicitação.</div>
                    ) : (
                        filteredRequests.map(req => (
                            <div 
                                key={req.id} 
                                onClick={() => handleSelectRequest(req)}
                                className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${selectedReq?.id === req.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 hover:border-indigo-300'} ${req.status !== 'pending' ? 'opacity-60' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-slate-800 dark:text-white text-sm truncate max-w-[150px]">{req.profiles?.first_name || 'Cliente'} {req.profiles?.last_name || ''}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{req.status === 'pending' ? 'Pendente' : req.status === 'approved' ? 'Aprovado' : 'Recusado'}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase">Solicitado</p>
                                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">R$ {req.requested_amount?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 uppercase">Data</p>
                                        <p className="text-xs text-slate-400">{new Date(req.created_at).toLocaleDateString()}</p>
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
                    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                        {feedbackMessage && <Alert message={feedbackMessage.text} type={feedbackMessage.type} />}

                        {/* Cabeçalho do Cliente */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                    {selectedReq.profiles?.first_name?.[0] || '?'}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedReq.profiles?.first_name || 'Nome'} {selectedReq.profiles?.last_name || 'Indisponível'}</h2>
                                    <p className="text-sm text-slate-500">{selectedReq.profiles?.email || 'Email não disponível'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="inline-flex flex-col items-end">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Score Atual</span>
                                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                        {selectedReq.profiles?.credit_score || 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Dados da Solicitação */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Detalhes da Solicitação</h4>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <div className="mb-4">
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Valor Solicitado</p>
                                        <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">R$ {selectedReq.requested_amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                    </div>
                                    <div className="mb-4">
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Limite Atual</p>
                                        <p className="text-lg font-bold text-slate-700 dark:text-slate-300">R$ {selectedReq.current_limit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Renda Declarada</p>
                                        <p className="text-lg font-bold text-green-600 dark:text-green-400">R$ {selectedReq.profiles?.salary?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Justificativa do Cliente</p>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-sm italic text-slate-600 dark:text-slate-300">
                                            "{selectedReq.justification}"
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-2">Comprovante de Renda</p>
                                        {incomeProof ? (
                                            <button 
                                                onClick={() => setDocPreview(incomeProof.file_url)}
                                                className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                Visualizar Documento
                                            </button>
                                        ) : (
                                            <div className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg text-xs font-medium text-center border border-slate-200 dark:border-slate-700">
                                                Nenhum comprovante anexado
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Área de Decisão */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 relative">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Decisão do Analista</h3>
                                {selectedReq.status === 'pending' && (
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
                                )}
                            </div>

                            {aiResult && (
                                <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg animate-fade-in">
                                    <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase mb-1">Sugestão da IA</p>
                                    {aiResult.documentAnalysis && (
                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-2 border-b border-indigo-200 pb-2">
                                            <strong>Análise do Documento:</strong> {aiResult.documentAnalysis}
                                        </p>
                                    )}
                                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{aiResult.reason}</p>
                                    <div className="mt-2 flex gap-4">
                                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">Limite: R$ {aiResult.suggestedLimit.toLocaleString()}</span>
                                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">Score: {aiResult.suggestedScore}</span>
                                    </div>
                                </div>
                            )}

                            {selectedReq.status === 'pending' ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Limite Aprovado (R$)</label>
                                            <input 
                                                type="number" 
                                                value={approvedLimit}
                                                onChange={e => setApprovedLimit(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Novo Score</label>
                                            <input 
                                                type="number" 
                                                value={approvedScore}
                                                onChange={e => setApprovedScore(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Motivo / Feedback (Visível ao Cliente)</label>
                                        <textarea 
                                            rows={3}
                                            value={adminReason}
                                            onChange={e => setAdminReason(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                            placeholder="Ex: Aprovado com base no histórico e comprovante."
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
                                </>
                            ) : (
                                <div className={`p-4 rounded-lg text-center font-bold border ${selectedReq.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    Solicitação {selectedReq.status === 'approved' ? 'Aprovada' : 'Recusada'}
                                    {selectedReq.admin_response_reason && (
                                        <p className="text-xs font-normal mt-1 italic text-slate-600">"{selectedReq.admin_response_reason}"</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="text-lg font-medium">Selecione uma solicitação para analisar</p>
                        <p className="text-sm opacity-60">Os detalhes e documentos aparecerão aqui.</p>
                    </div>
                )}
            </div>

            {/* Modal de Visualização de Documento */}
            {docPreview && (
                <Modal isOpen={true} onClose={() => setDocPreview(null)} maxWidth="max-w-3xl">
                    <div className="flex flex-col h-[80vh]">
                        <div className="flex justify-between items-center mb-4 px-1">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Documento Anexado</h3>
                            <a href={docPreview} download="documento_comprovante" className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded font-bold hover:bg-indigo-200 transition-colors">
                                Baixar Arquivo
                            </a>
                        </div>
                        <div className="flex-1 bg-slate-200 dark:bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-300 dark:border-slate-700 shadow-inner p-2">
                            {docPreview.startsWith('data:application/pdf') ? (
                                <object data={docPreview} type="application/pdf" className="w-full h-full rounded">
                                    <p className="text-center text-slate-500 p-4">
                                        Não foi possível visualizar o PDF aqui.<br/>
                                        <a href={docPreview} download="documento.pdf" className="underline font-bold">Clique para baixar</a>.
                                    </p>
                                </object>
                            ) : (
                                <img src={docPreview} alt="Documento" className="max-w-full max-h-full object-contain shadow-lg" />
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default CreditAnalysisTab;
