import React, { useState, useEffect } from 'react';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from './Toast';

const ReferralView: React.FC<{ userId: string; firstName: string }> = ({ userId, firstName }) => {
    const [referralCode, setReferralCode] = useState('');
    const [referrals, setReferrals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        const loadReferralData = async () => {
            setLoading(true);
            try {
                // 1. Busca código do usuário
                const { data: profile } = await supabase.from('profiles').select('referral_code').eq('id', userId).single();
                
                if (profile?.referral_code) {
                    setReferralCode(profile.referral_code);
                } else {
                    // Gera um código se não existir
                    const newCode = `RELP-${firstName.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
                    await supabase.from('profiles').update({ referral_code: newCode }).eq('id', userId);
                    setReferralCode(newCode);
                }

                // 2. Busca quem ele indicou
                const { data: invited } = await supabase
                    .from('profiles')
                    .select('first_name, created_at')
                    .eq('referred_by', userId);
                
                setReferrals(invited || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadReferralData();
    }, [userId, firstName]);

    const shareLink = `${window.location.origin}/?ref=${referralCode}`;

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Relp Cell - Ganhe Crédito',
                    text: `Use meu código ${referralCode} para ganhar limite na Relp Cell!`,
                    url: shareLink
                });
            } catch (e) {}
        } else {
            navigator.clipboard.writeText(shareLink);
            addToast("Link de indicação copiado!", "success");
        }
    };

    return (
        <div className="space-y-8 animate-fade-in p-1">
            {/* Hero Indicação */}
            <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto text-5xl shadow-inner">
                    🎁
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Indique e Ganhe</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Convide amigos para a Relp Cell. Quando eles fizerem a primeira compra, você ganha <span className="font-bold text-indigo-600">500 Coins (R$ 5,00)</span>.
                </p>
            </div>

            {/* Código Box */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-lg text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Seu Código Único</p>
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 mb-6">
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-widest">{referralCode || 'GERANDO...'}</span>
                </div>
                <button 
                    onClick={handleShare}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    COMPARTILHAR LINK
                </button>
            </div>

            {/* Lista de Amigos */}
            <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Amigos que entraram ({referrals.length})</h3>
                {loading ? <LoadingSpinner /> : referrals.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-xs italic">Ninguém usou seu código ainda. Comece a indicar!</p>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {referrals.map((ref, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-indigo-600">{ref.first_name?.[0]}</div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white">{ref.first_name}</p>
                                        <p className="text-[10px] text-slate-400">Entrou em {new Date(ref.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg uppercase">Ativo</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReferralView;