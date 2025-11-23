
import React, { useState, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { supabase } from '../services/clients';

interface LimitRequestFormProps {
    currentLimit: number;
    onClose: () => void;
    score: number;
}

const LimitRequestForm: React.FC<LimitRequestFormProps> = ({ currentLimit, onClose, score }) => {
    const [requestedAmount, setRequestedAmount] = useState('');
    const [salary, setSalary] = useState('');
    const [proofFile, setProofFile] = useState<string | null>(null);
    const [justification, setJustification] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const hasProof = !!proofFile;

    // Lógica de "Chance de Aprovação" baseada no Score e Salário
    const approvalChance = Math.min(100, Math.max(10, score / 10));
    let chanceColor = 'bg-red-500';
    let chanceText = 'Baixa';
    let chanceMessage = "Seu score precisa melhorar um pouco.";
    
    if (hasProof) {
        chanceMessage = "Comprovante anexado: Suas chances aumentaram!";
        if (approvalChance > 60) chanceColor = 'bg-emerald-500';
        else chanceColor = 'bg-amber-500';
    } else {
        chanceMessage = "Sem comprovante, o limite pode ser restrito a R$ 100.";
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProofFile(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage(null);

        const requestedValue = parseFloat(requestedAmount);
        const salaryValue = parseFloat(salary);

        if (isNaN(requestedValue) || requestedValue <= currentLimit) {
            setMessage({ text: 'O valor solicitado deve ser maior que o atual.', type: 'error' });
            setIsSubmitting(false);
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado.');

            // 1. Salva o comprovante se houver
            if (proofFile) {
                await fetch('/api/admin/upload-document', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        userId: user.id,
                        title: 'Comprovante de Renda (Solicitação Limite)',
                        type: 'Comprovante de Renda',
                        fileBase64: proofFile
                    })
                });
            }

            // 2. Atualiza o salário no perfil
            if (salaryValue > 0) {
                await supabase.from('profiles').update({ salary: salaryValue }).eq('id', user.id);
            }

            // 3. Cria a solicitação
            const { error } = await supabase.from('limit_requests').insert({
                user_id: user.id,
                requested_amount: requestedValue,
                current_limit: currentLimit,
                justification: justification + (hasProof ? ' [Comprovante Anexado]' : ' [Sem Comprovante]'),
                status: 'pending'
            });

            if (error) throw error;

            await supabase.from('profiles').update({ last_limit_request_date: new Date().toISOString() }).eq('id', user.id);

            setMessage({ text: 'Pedido enviado para análise!', type: 'success' });
            setTimeout(onClose, 3000);
            
        } catch (error: any) {
            setMessage({ text: 'Erro ao enviar solicitação.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (message?.type === 'success') {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 h-full animate-fade-in">
                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                    <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Pedido Enviado!</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs text-sm">Nossa equipe analisará seu perfil e responderemos em até 3 dias úteis.</p>
                <button onClick={onClose} className="px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Voltar</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 px-4 pt-safe pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <button onClick={onClose} className="p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium transition-colors">
                    Cancelar
                </button>
                <h2 className="font-bold text-slate-900 dark:text-white">Ajuste de Limite</h2>
                <div className="w-16"></div> 
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                <div className="text-center pt-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Limite Atual</p>
                    <p className="text-4xl font-black text-slate-900 dark:text-white">
                        <span className="text-xl text-slate-400 font-bold mr-1">R$</span>
                        {currentLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                {/* Smart Analysis Card */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${chanceColor}`}></div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Probabilidade</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${chanceColor}`}>{chanceText}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-white mb-3">
                        {chanceMessage}
                    </p>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ease-out ${chanceColor}`} style={{ width: `${approvalChance}%` }}></div>
                    </div>
                </div>
                
                {message && <Alert message={message.text} type={message.type} />}

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Quanto você gostaria?</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">R$</span>
                            <input
                                type="number"
                                value={requestedAmount}
                                onChange={(e) => setRequestedAmount(e.target.value)}
                                placeholder="0,00"
                                required
                                min={currentLimit + 1}
                                className="w-full pl-12 pr-4 py-4 text-2xl font-bold bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-300"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-200 mb-3">Comprovação de Renda (Obrigatório)</label>
                        
                        <div className="mb-3">
                            <label className="block text-xs text-indigo-600 dark:text-indigo-300 mb-1">Renda Mensal (R$)</label>
                            <input
                                type="number"
                                value={salary}
                                onChange={(e) => setSalary(e.target.value)}
                                placeholder="Ex: 2500.00"
                                required
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors border ${proofFile ? 'bg-green-100 border-green-200 text-green-700' : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}
                        >
                            {proofFile ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Arquivo Anexado
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Enviar Holerite/Extrato
                                </>
                            )}
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                        
                        {!proofFile && (
                            <p className="text-[10px] text-red-500 mt-2">
                                * Sem comprovante, seu limite máximo será de R$ 100,00.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                            Motivo <span className="font-normal text-slate-400 ml-1">(Opcional)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white resize-none text-sm"
                            placeholder="Ex: Quero comprar um iPhone 15..."
                        />
                    </div>
                </div>
            </form>

            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-safe">
                 <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {isSubmitting ? <LoadingSpinner /> : 'Enviar Pedido de Análise'}
                </button>
            </div>
        </div>
    );
};

export default LimitRequestForm;
