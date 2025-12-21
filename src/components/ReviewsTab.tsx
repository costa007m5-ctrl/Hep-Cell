
import React, { useState, useEffect } from 'react';
import { ProductReview } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { supabase } from '../services/clients';

const ReviewsTab: React.FC = () => {
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
    const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
    const [replyText, setReplyText] = useState('');

    const fetchReviews = async () => {
        setIsLoading(true);
        const { data } = await supabase
            .from('product_reviews')
            .select('*, products(name, image_url)')
            .order('created_at', { ascending: false });
        setReviews(data || []);
        setIsLoading(false);
    };

    useEffect(() => { fetchReviews(); }, []);

    const handleAction = async (id: string, status: 'approved' | 'rejected', reply?: string) => {
        const { error } = await supabase
            .from('product_reviews')
            .update({ status, reply: reply || '' })
            .eq('id', id);
        
        if (!error) {
            setReviews(prev => prev.map(r => r.id === id ? { ...r, status, reply: reply || '' } : r));
            setEditingReview(null);
            setReplyText('');
        }
    };

    const filtered = reviews.filter(r => r.status === filter);

    return (
        <div className="p-4 space-y-6">
            <h2 className="text-2xl font-bold">Moderação de Avaliações</h2>
            
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                {['pending', 'approved', 'rejected'].map(s => (
                    <button 
                        key={s} onClick={() => setFilter(s as any)}
                        className={`px-6 py-2 rounded-lg text-sm font-bold capitalize ${filter === s ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}
                    >
                        {s === 'pending' ? 'Pendentes' : s === 'approved' ? 'Aprovadas' : 'Recusadas'}
                    </button>
                ))}
            </div>

            {isLoading ? <LoadingSpinner /> : (
                <div className="grid gap-4">
                    {filtered.length === 0 ? <p className="text-slate-500 italic py-10 text-center">Nenhum item nesta categoria.</p> : filtered.map(rev => (
                        <div key={rev.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex gap-4 mb-4">
                                <img src={rev.products?.image_url} className="w-16 h-16 rounded-lg object-contain bg-slate-50" />
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{rev.products?.name}</p>
                                    <p className="text-xs text-slate-500">Cliente: {rev.user_name}</p>
                                </div>
                            </div>
                            
                            <div className="flex gap-1 mb-3">
                                {Array.from({length: 5}).map((_,i) => <span key={i} className={i < rev.rating ? 'text-yellow-400' : 'text-slate-200'}>★</span>)}
                            </div>
                            <p className="text-sm italic text-slate-700 dark:text-slate-300 mb-6 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">"{rev.comment}"</p>
                            
                            <div className="flex gap-3">
                                {rev.status === 'pending' && (
                                    <>
                                        <button onClick={() => handleAction(rev.id, 'approved')} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold text-sm">Aprovar</button>
                                        <button onClick={() => handleAction(rev.id, 'rejected')} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-sm">Recusar</button>
                                    </>
                                )}
                                <button onClick={() => { setEditingReview(rev); setReplyText(rev.reply || ''); }} className="px-6 py-2 border border-indigo-200 text-indigo-600 rounded-lg font-bold text-sm">Responder</button>
                            </div>

                            {editingReview?.id === rev.id && (
                                <div className="mt-6 space-y-4 animate-fade-in-up">
                                    <textarea 
                                        value={replyText} onChange={e => setReplyText(e.target.value)}
                                        className="w-full p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 text-sm outline-none"
                                        placeholder="Sua resposta pública ao cliente..." rows={3}
                                    />
                                    <button onClick={() => handleAction(rev.id, 'approved', replyText)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Publicar Resposta</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReviewsTab;
