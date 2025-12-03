import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { supabase } from '../services/clients';

interface PollOption {
    id?: string;
    text: string;
    votes: number;
}

interface Poll {
    id: string;
    question: string;
    active: boolean;
    created_at: string;
    options?: PollOption[];
}

interface ChangelogItem {
    id: string;
    version: string;
    title: string;
    description: string;
    date: string;
    type: 'feature' | 'fix' | 'improvement';
    is_public: boolean;
}

const PollsTab: React.FC = () => {
    // --- Poll States ---
    const [polls, setPolls] = useState<Poll[]>([]);
    const [isLoadingPolls, setIsLoadingPolls] = useState(true);
    const [newQuestion, setNewQuestion] = useState('');
    const [newOptions, setNewOptions] = useState(['', '']);
    const [isCreatingPoll, setIsCreatingPoll] = useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // --- Changelog States ---
    const [changelog, setChangelog] = useState<ChangelogItem[]>([]);
    const [newLog, setNewLog] = useState({ version: '', title: '', description: '', type: 'feature', is_public: true });
    const [isCreatingLog, setIsCreatingLog] = useState(false);

    useEffect(() => {
        fetchPolls();
        fetchChangelog();
    }, []);

    const fetchPolls = async () => {
        setIsLoadingPolls(true);
        try {
            const { data: pollsData, error } = await supabase.from('polls').select('*').order('created_at', { ascending: false });
            if (error) throw error;

            const pollsWithOptions = await Promise.all(pollsData.map(async (p) => {
                const { data: opts } = await supabase.from('poll_options').select('*').eq('poll_id', p.id);
                return { ...p, options: opts || [] };
            }));

            setPolls(pollsWithOptions);
        } catch (e) {
            console.error("Erro ao buscar enquetes", e);
        } finally {
            setIsLoadingPolls(false);
        }
    };

    const fetchChangelog = async () => {
        try {
            const { data, error } = await supabase.from('app_changelog').select('*').order('date', { ascending: false });
            if (!error && data) setChangelog(data);
        } catch (e) { console.error(e); }
    };

    const handleAddOptionField = () => setNewOptions([...newOptions, '']);
    
    const handleOptionChange = (index: number, value: string) => {
        const updated = [...newOptions];
        updated[index] = value;
        setNewOptions(updated);
    };

    const handleGenerateAiPoll = async () => {
        setIsGeneratingAI(true);
        const topic = prompt("Sobre qual assunto você quer gerar a enquete? (Ex: Atendimento, Novos Produtos, Feedback)");
        
        try {
            const response = await fetch('/api/admin/generate-poll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic || '' }) // Envia vazio se o usuário cancelar, a IA gera genérico
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setNewQuestion(data.question);
                setNewOptions(data.options || ['', '']);
            } else {
                alert("Erro ao gerar com IA: " + (data.error || 'Desconhecido'));
            }
        } catch (e) {
            alert("Erro de conexão ao gerar com IA.");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleCreatePoll = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuestion || newOptions.some(o => !o.trim())) {
            alert("Preencha a pergunta e todas as opções.");
            return;
        }
        setIsCreatingPoll(true);
        try {
            // 1. Desativa polls anteriores
            await supabase.from('polls').update({ active: false }).neq('id', '00000000-0000-0000-0000-000000000000'); 

            // 2. Cria Poll
            const { data: poll, error } = await supabase.from('polls').insert({ question: newQuestion, active: true }).select().single();
            if (error) throw error;

            // 3. Cria Opções
            const optionsPayload = newOptions.map(text => ({ poll_id: poll.id, text, votes: 0 }));
            await supabase.from('poll_options').insert(optionsPayload);

            setNewQuestion('');
            setNewOptions(['', '']);
            fetchPolls();
            alert("Enquete criada e ativada!");
        } catch (e: any) {
            alert("Erro ao criar enquete: " + e.message);
        } finally {
            setIsCreatingPoll(false);
        }
    };

    const handleDeletePoll = async (id: string) => {
        if (!confirm("Excluir enquete?")) return;
        await supabase.from('polls').delete().eq('id', id);
        setPolls(prev => prev.filter(p => p.id !== id));
    };

    const handleCreateLog = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreatingLog(true);
        try {
            await supabase.from('app_changelog').insert(newLog);
            setNewLog({ version: '', title: '', description: '', type: 'feature', is_public: true });
            fetchChangelog();
        } catch (e) {
            alert("Erro ao salvar log.");
        } finally {
            setIsCreatingLog(false);
        }
    };

    const handleDeleteLog = async (id: string) => {
        if (!confirm("Excluir item?")) return;
        await supabase.from('app_changelog').delete().eq('id', id);
        setChangelog(prev => prev.filter(l => l.id !== id));
    };

    return (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* --- ENQUETES --- */}
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gerenciar Enquetes</h2>
                
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">Nova Enquete</h3>
                        <button 
                            type="button" 
                            onClick={handleGenerateAiPoll} 
                            disabled={isGeneratingAI}
                            className="text-xs bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isGeneratingAI ? <LoadingSpinner /> : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                    Sugestão com IA
                                </>
                            )}
                        </button>
                    </div>
                    
                    <form onSubmit={handleCreatePoll} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Pergunta</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600"
                                value={newQuestion}
                                onChange={e => setNewQuestion(e.target.value)}
                                placeholder="Qual funcionalidade você quer?"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium mb-1">Opções</label>
                            {newOptions.map((opt, idx) => (
                                <input 
                                    key={idx}
                                    type="text" 
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 text-sm"
                                    value={opt}
                                    onChange={e => handleOptionChange(idx, e.target.value)}
                                    placeholder={`Opção ${idx + 1}`}
                                />
                            ))}
                            <button type="button" onClick={handleAddOptionField} className="text-xs text-indigo-600 font-bold hover:underline">+ Adicionar Opção</button>
                        </div>
                        <button 
                            type="submit" 
                            disabled={isCreatingPoll}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {isCreatingPoll ? <LoadingSpinner /> : 'Criar e Ativar'}
                        </button>
                    </form>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 dark:text-white">Histórico</h3>
                    {isLoadingPolls ? <LoadingSpinner /> : polls.map(poll => (
                        <div key={poll.id} className={`p-4 rounded-xl border ${poll.active ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{poll.question}</p>
                                    <p className="text-xs text-slate-500">{new Date(poll.created_at).toLocaleDateString()} • {poll.active ? 'Ativa' : 'Inativa'}</p>
                                </div>
                                <button onClick={() => handleDeletePoll(poll.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                            <div className="space-y-2">
                                {poll.options?.map(opt => (
                                    <div key={opt.id} className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600 dark:text-slate-300">{opt.text}</span>
                                        <span className="font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{opt.votes} votos</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- CHANGELOG --- */}
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Implementações (Changelog)</h2>
                
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-bold mb-4 text-slate-800 dark:text-white">Nova Atualização</h3>
                    <form onSubmit={handleCreateLog} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Título</label>
                                <input type="text" required value={newLog.title} onChange={e => setNewLog({...newLog, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Versão (Opcional)</label>
                                <input type="text" value={newLog.version} onChange={e => setNewLog({...newLog, version: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600" placeholder="v1.2" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Descrição</label>
                            <textarea required rows={2} value={newLog.description} onChange={e => setNewLog({...newLog, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600"></textarea>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Tipo</label>
                                <select value={newLog.type} onChange={e => setNewLog({...newLog, type: e.target.value as any})} className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600">
                                    <option value="feature">Nova Funcionalidade</option>
                                    <option value="improvement">Melhoria</option>
                                    <option value="fix">Correção de Bug</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <label className="flex items-center space-x-2 cursor-pointer p-2 border rounded-lg w-full bg-slate-50 dark:bg-slate-900/50 dark:border-slate-600">
                                    <input 
                                        type="checkbox" 
                                        checked={newLog.is_public}
                                        onChange={e => setNewLog({...newLog, is_public: e.target.checked})}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Visível para Clientes?</span>
                                </label>
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={isCreatingLog}
                            className="w-full py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
                        >
                            {isCreatingLog ? <LoadingSpinner /> : 'Publicar Atualização'}
                        </button>
                    </form>
                </div>

                <div className="space-y-3">
                    {changelog.map(log => (
                        <div key={log.id} className="flex gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 relative">
                            {!log.is_public && (
                                <span className="absolute top-2 right-2 text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Interno</span>
                            )}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${
                                log.type === 'feature' ? 'bg-purple-500' : log.type === 'fix' ? 'bg-red-500' : 'bg-blue-500'
                            }`}>
                                {log.type === 'feature' ? '★' : log.type === 'fix' ? '🔧' : '⚡'}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-slate-900 dark:text-white">{log.title}</h4>
                                    <button onClick={() => handleDeleteLog(log.id)} className="text-slate-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.description}</p>
                                <div className="flex gap-2 mt-2 items-center">
                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${log.type === 'feature' ? 'bg-purple-100 text-purple-700' : log.type === 'fix' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {log.type === 'feature' ? 'NOVIDADE' : log.type === 'fix' ? 'CORREÇÃO' : 'MELHORIA'}
                                    </span>
                                    {log.version && <span className="text-[9px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded font-mono text-slate-500">{log.version}</span>}
                                    <span className="text-[9px] text-slate-400 ml-auto">{new Date(log.date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PollsTab;