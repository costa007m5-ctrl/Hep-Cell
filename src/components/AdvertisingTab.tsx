import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';

const AdvertisingTab: React.FC = () => {
    const [banners, setBanners] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [newBanner, setNewBanner] = useState({
        title: '',
        subtitle: '',
        image_url: '',
        link_url: '',
        priority: 1,
        active: true
    });

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('banners').select('*').order('priority', { ascending: false });
        setBanners(data || []);
        setIsLoading(false);
    };

    const handleAiSuggest = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/admin/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: "Gere um título e subtítulo curto e impactante para um banner de promoção de 'Aumento de Limite de Crédito' na Relp Cell.",
                    context: "O objetivo é converter usuários a usarem mais o app."
                })
            });
            const data = await res.json();
            // Simulação de parsing simples da resposta da IA
            const lines = data.reply.split('\n').filter((l: string) => l.length > 5);
            if (lines.length >= 2) {
                setNewBanner({ ...newBanner, title: lines[0].replace(/["*]/g, ''), subtitle: lines[1].replace(/["*]/g, '') });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        const { error } = await supabase.from('banners').insert([newBanner]);
        if (!error) {
            setNewBanner({ title: '', subtitle: '', image_url: '', link_url: '', priority: 1, active: true });
            fetchBanners();
        }
    };

    const toggleStatus = async (id: string, current: boolean) => {
        await supabase.from('banners').update({ active: !current }).eq('id', id);
        fetchBanners();
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Publicidade & Banners</h2>
                    <p className="text-sm text-slate-500">Gerencie os destaques que aparecem na Home do cliente.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Editor */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm h-fit">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 dark:text-white">Novo Banner</h3>
                        <button 
                            onClick={handleAiSuggest}
                            disabled={isGenerating}
                            className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-purple-200 transition-colors"
                        >
                            {isGenerating ? <LoadingSpinner /> : '✨ IA SUGERIR TEXTO'}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Título Principal</label>
                            <input 
                                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                                value={newBanner.title}
                                onChange={e => setNewBanner({...newBanner, title: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Subtítulo / Chamada</label>
                            <textarea 
                                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm h-20"
                                value={newBanner.subtitle}
                                onChange={e => setNewBanner({...newBanner, subtitle: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">URL da Imagem</label>
                            <input 
                                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                                placeholder="https://..."
                                value={newBanner.image_url}
                                onChange={e => setNewBanner({...newBanner, image_url: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Prioridade</label>
                                <input 
                                    type="number"
                                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                                    value={newBanner.priority}
                                    onChange={e => setNewBanner({...newBanner, priority: parseInt(e.target.value)})}
                                />
                            </div>
                            <div className="flex items-end pb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={newBanner.active} onChange={e => setNewBanner({...newBanner, active: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Ativo</span>
                                </label>
                            </div>
                        </div>
                        <button 
                            onClick={handleSave}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95"
                        >
                            CRIAR BANNER
                        </button>
                    </div>
                </div>

                {/* Preview & List */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Banners Ativos</h3>
                    
                    {isLoading ? <LoadingSpinner /> : (
                        <div className="grid grid-cols-1 gap-4">
                            {banners.map(banner => (
                                <div key={banner.id} className="group relative bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col sm:flex-row shadow-sm hover:shadow-md transition-all">
                                    <div className="w-full sm:w-48 h-32 bg-slate-200 dark:bg-slate-900 shrink-0 overflow-hidden">
                                        {banner.image_url ? (
                                            <img src={banner.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col justify-center">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-black text-slate-900 dark:text-white leading-tight">{banner.title}</h4>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${banner.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {banner.active ? 'ATIVO' : 'INATIVO'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{banner.subtitle}</p>
                                        <div className="mt-4 flex gap-3">
                                            <button onClick={() => toggleStatus(banner.id, banner.active)} className="text-[10px] font-bold text-indigo-600 hover:underline">
                                                {banner.active ? 'Desativar' : 'Ativar'}
                                            </button>
                                            <button className="text-[10px] font-bold text-red-500 hover:underline">Excluir</button>
                                        </div>
                                    </div>
                                    <div className="absolute top-2 right-2 bg-white/90 dark:bg-slate-800/90 px-2 py-1 rounded-lg text-[10px] font-black shadow-sm border border-slate-100 dark:border-slate-700">
                                        Prio: {banner.priority}
                                    </div>
                                </div>
                            ))}
                            {banners.length === 0 && (
                                <div className="p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-400">
                                    Nenhum banner configurado.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdvertisingTab;