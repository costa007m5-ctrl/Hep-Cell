
import React, { useState, useRef, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { supabase } from '../services/clients';

interface LimitRequestFormProps {
    currentLimit: number;
    onClose: () => void;
    score: number;
    lastRequestDate?: string | null;
}

const LimitRequestForm: React.FC<LimitRequestFormProps> = ({ currentLimit, onClose, score, lastRequestDate }) => {
    const [requestedAmount, setRequestedAmount] = useState('');
    const [salary, setSalary] = useState('');
    const [proofFile, setProofFile] = useState<string | null>(null);
    const [justification, setJustification] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // --- Validação de 90 Dias ---
    const checkEligibility = () => {
        if (!lastRequestDate) return { eligible: true, date: null };
        
        const last = new Date(lastRequestDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - last.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const waitPeriod = 90;

        if (diffDays < waitPeriod) {
            const nextDate = new Date(last);
            nextDate.setDate(last.getDate() + waitPeriod);
            return { eligible: false, date: nextDate.toLocaleDateString('pt-BR') };
        }
        return { eligible: true, date: null };
    };

    const eligibility = checkEligibility();
    const hasProof = !!proofFile;

    // Lógica visual de chance
    const approvalChance = Math.min(100, Math.max(10, score / 10));
    let chanceColor = 'bg-red-500';
    let chanceText = 'Baixa';
    let chanceMessage = "Seu score precisa melhorar um pouco.";
    
    if (hasProof) {
        chanceMessage = "Comprovante anexado: Suas chances aumentaram!";
        if (approvalChance > 60) chanceColor = 'bg-emerald-500';
        else chanceColor = 'bg-amber-500';
    } else {
        chanceMessage = "Anexe um comprovante para aumentar suas chances.";
    }

    // Função para converter qualquer imagem para JPEG
    const convertImageToJpeg = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // Limita tamanho máximo para 1200px para economizar tokens da IA e largura de banda
                    const maxDimension = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height *= maxDimension / width;
                            width = maxDimension;
                        } else {
                            width *= maxDimension / height;
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if(ctx) {
                        // Fundo branco para lidar com PNGs transparentes
                        ctx.fillStyle = '#FFFFFF'; 
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', 0.8));
                    } else {
                        reject(new Error("Falha ao criar contexto do canvas"));
                    }
                };
                img.onerror = reject;
                img.src = event.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsProcessingImage(true);
            setMessage(null);
            try {
                // Se for imagem, converte. Se for PDF, usa como está.
                if (file.type.startsWith('image/')) {
                    const processed = await convertImageToJpeg(file);
                    setProofFile(processed);
                } else if (file.type === 'application/pdf') {
                    // PDFs são suportados como upload, mas não para análise visual direta da IA atualmente
                    // A IA usará apenas o texto do prompt nesse caso
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        setProofFile(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                } else {
                    throw new Error("Formato não suportado. Use Imagem ou PDF.");
                }
            } catch (error: any) {
                console.error("Erro ao processar arquivo", error);
                setMessage({ text: error.message || "Erro ao processar o arquivo.", type: 'error' });
            } finally {
                setIsProcessingImage(false);
            }
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

            // 1. Salva o comprovante se houver (Via API Admin para garantir permissões e armazenamento)
            if (proofFile) {
                try {
                    await fetch('/api/admin/upload-document', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            userId: user.id,
                            title: 'Comprovante de Renda',
                            type: 'Comprovante de Renda', 
                            fileBase64: proofFile
                        })
                    });
                } catch (uploadError) {
                    console.warn("Erro ao enviar imagem (não crítico):", uploadError);
                }
            }

            // 2. Atualiza o salário no perfil (se possível)
            if (salaryValue > 0) {
                try {
                    await supabase.from('profiles').update({ salary: salaryValue }).eq('id', user.id);
                } catch (e) {
                    console.warn("Erro ao salvar salário no perfil:", e);
                }
            }

            // 3. Cria a solicitação na tabela limit_requests
            const { error } = await supabase.from('limit_requests').insert({
                user_id: user.id,
                requested_amount: requestedValue,
                current_limit: currentLimit,
                justification: justification, 
                status: 'pending',
                admin_response_reason: null
            });

            if (error) {
                // Tratamento específico para tabela inexistente
                if (error.code === '42P01' || error.message.includes('relation "limit_requests" does not exist')) {
                    throw new Error("Sistema de crédito temporariamente indisponível. Contate o suporte.");
                }
                throw error;
            }

            // 4. Atualiza data da última solicitação
            await supabase.from('profiles').update({ last_limit_request_date: new Date().toISOString() }).eq('id', user.id);

            setMessage({ text: 'Solicitação enviada com sucesso! Nossa equipe analisará em breve.', type: 'success' });
            setTimeout(onClose, 3000);
            
        } catch (error: any) {
            console.error("Erro envio solicitação:", error);
            setMessage({ text: error.message || 'Erro ao enviar solicitação. Tente novamente.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Renderização de Bloqueio (90 dias)
    if (!eligibility.eligible) {
        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 p-6 text-center justify-center animate-fade-in">
                <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Aguarde um pouco</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
                    Para garantir uma análise justa, permitimos uma nova solicitação a cada 90 dias.
                </p>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-8">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Próxima solicitação disponível em</p>
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{eligibility.date}</p>
                </div>
                <button onClick={onClose} className="w-full py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold">
                    Entendi, vou aguardar
                </button>
            </div>
        );
    }

    if (message?.type === 'success') {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 h-full animate-fade-in">
                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                    <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Pedido Enviado!</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs text-sm">Nossa equipe analisará seu perfil e responderemos em breve.</p>
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
                        <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-200 mb-3">Comprovação de Renda</label>
                        
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
                            disabled={isProcessingImage}
                            className={`w-full py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors border ${proofFile ? 'bg-green-100 border-green-200 text-green-700' : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}
                        >
                            {isProcessingImage ? (
                                <>
                                    <LoadingSpinner /> Processando...
                                </>
                            ) : proofFile ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Comprovante Anexado
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Enviar Holerite/Extrato
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-indigo-400 mt-2 text-center">Formatos aceitos: JPG, PNG, PDF.</p>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
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
                    disabled={isSubmitting || isProcessingImage}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {isSubmitting ? <LoadingSpinner /> : 'Enviar Pedido de Análise'}
                </button>
            </div>
        </div>
    );
};

export default LimitRequestForm;
