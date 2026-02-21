import React, { useState, useEffect } from 'react';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';

const UserPollsView: React.FC<{ userId: string }> = ({ userId }) => {
    const [poll, setPoll] = useState<any>(null);
    const [voted, setVoted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isVoting, setIsVoting] = useState(false);

    useEffect(() => {
        const fetchPoll = async () => {
            try {
                // 1. Busca enquete ativa
                const { data: activePoll } = await supabase.from('polls').select('*').eq('active', true).limit(1).single();
                
                if (activePoll) {
                    const [optsRes, voteRes] = await Promise.all([
                        supabase.from('poll_options').select('*').eq('poll_id', activePoll.id),
                        supabase.from('poll_votes').select('id').eq('poll_id', activePoll.id).eq('user_id', userId).single()
                    ]);
                    
                    setPoll({ ...activePoll, options: optsRes.data || [] });
                    setVoted(!!voteRes.data);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchPoll();
    }, [userId]);

    const handleVote = async (optionId: string) => {
        if (voted || isVoting) return;
        setIsVoting(true);
        try {
            // 1. Registra voto
            await supabase.from('poll_votes').insert({ poll_id: poll.id, option_id: optionId, user_id: userId });
            // 2. Incrementa contador (Simulado via RPC ou update simples)
            await supabase.rpc('increment_poll_vote', { option_id_input: optionId });
            
            setVoted(true);
            // Refresh options
            const { data } = await supabase.from('poll_options').select('*').eq('poll_id', poll.id);
            setPoll({ ...poll, options: data || [] });
        } catch (e) { console.error(e); }
        finally { setIsVoting(false); }
    };

    if (loading || !poll) return null;

    const totalVotes = poll.options.reduce((acc: number, curr: any) => acc + curr.votes, 0);

    return (
        <div className="mx-2 bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-indigo-50 dark:border-slate-700 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🗳️</span>
                <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight">Sua opinião importa!</h3>
                    <p className="text-xs text-slate-500">Ajude a construir o futuro da Relp Cell.</p>
                </div>
            </div>

            <p className="font-bold text-slate-800 dark:text-slate-200 mb-4 text-sm">{poll.question}</p>

            <div className="space-y-3">
                {poll.options.map((opt: any) => {
                    const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                    return (
                        <button 
                            key={opt.id} 
                            onClick={() => handleVote(opt.id)}
                            disabled={voted || isVoting}
                            className={`w-full relative h-12 rounded-xl border overflow-hidden transition-all group ${voted ? 'border-slate-100 dark:border-slate-700' : 'border-indigo-100 hover:border-indigo-500 active:scale-[0.98]'}`}
                        >
                            {voted && (
                                <div className="absolute inset-y-0 left-0 bg-indigo-600/10 transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                            )}
                            <div className="absolute inset-0 px-4 flex justify-between items-center">
                                <span className={`text-xs font-bold ${voted ? 'text-slate-700 dark:text-slate-300' : 'text-indigo-600'}`}>{opt.text}</span>
                                {voted && <span className="text-[10px] font-black text-indigo-600">{percent}%</span>}
                            </div>
                        </button>
                    );
                })}
            </div>
            
            {voted && (
                <p className="text-center text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-widest">Obrigado pelo seu voto!</p>
            )}
        </div>
    );
};

export default UserPollsView;