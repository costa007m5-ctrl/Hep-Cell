import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';

const PollsTab: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'polls' | 'changelog'>('polls');
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form states
    const [newPoll, setNewPoll] = useState({ question: '', options: ['', ''], expires_at: '' });
    const [newLog, setNewLog] = useState({ version: '', title: '', description: '', type: 'feature' });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setIsLoading(true);
        const table = activeTab === 'polls' ? 'polls' : 'changelogs';
        const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false });
        setItems(data || []);
        setIsLoading(false);
    };

    const handleCreatePoll = async () => {
        setIsSaving(true);
        const { error } = await supabase.from('polls').insert([{
            question: newPoll.question,
            options: newPoll.options.filter(o => o.trim() !== ''),
            expires_at: newPoll.expires_at || null,
            status: 'active'
        }]);
        if (!error) {
            setNewPoll({ question: '', options: ['', ''], expires_at: '' });
            fetchData();
        }
        setIsSaving(false);
    };

    const handleCreateLog = async () => {
        setIsSaving(true);
        const { error } = await supabase.from('changelogs').insert([newLog]);
        if (!error) {
            setNewLog({ version: '', title: '', description: '', type: 'feature' });
            fetchData();
        }
        setIsSaving(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-6">
                <button 
                    onClick={() => setActiveTab('polls')}
                    className={`pb-4 px-2 text-sm font-bold transition-all ${activeTab === 'polls' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400'}`}
                >
                    Enquetes de Feedback
                </button>
                <button 
                    onClick={() => setActiveTab('changelog')}
                    className={`pb-4 px-2 text-sm font-bold transition-all ${activeTab === 'changelog' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400'}`}
                >
                    Notas de Atualização (Changelog)
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Column */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-4">
                            {activeTab === 'polls' ? 'Nova Enquete' : 'Nova Atualização'}
                        </h3>
                        
                        {activeTab === 'polls' ? (
                            <div className="space-y-3">
                                <input 
                                    placeholder="Pergunta da enquete..." 
                                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                                    value={newPoll.question}
                                    onChange={e => setNewPoll({...newPoll, question: e.target.value})}
                                />
                                {newPoll.options.map((opt, i) => (
                                    <input 
                                        key={i}
                                        placeholder={`Opção ${i+1}`} 
                                        className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                                        value={opt}
                                        onChange={e => {
                                            const opts = [...newPoll.options];
                                            opts[i] = e.target.value;
                                            setNewPoll({...newPoll, options: opts});
                                        }}
                                    />
                                ))}
                                <button 
                                    onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})}
                                    className="text-[10px] font-bold text-indigo-600 uppercase"
                                >
                                    + Adicionar Opção
                                </button>
                                <button 
                                    onClick={handleCreatePoll}
                                    disabled={isSaving || !newPoll.question}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    Publicar Enquete
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <input placeholder="v1.0.0" className="w-1/3 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs" value={newLog.version} onChange={e => setNewLog({...newLog, version: e.target.value})} />
                                    <select className="w-2/3 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs" value={newLog.type} onChange={e => setNewLog({...newLog, type: e.target.value})}>
                                        <option value="feature">Nova Funcionalidade</option>
                                        <option value="fix">Correção de Bug</option>
                                        <option value="improvement">Melhoria</option>
                                    </select>
                                </div>
                                <input placeholder="Título" className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs" value={newLog.title} onChange={e => setNewLog({...newLog, title: e.target.value})} />
                                <textarea placeholder="Descrição das mudanças..." className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs h-24" value={newLog.description} onChange={e => setNewLog({...newLog, description: e.target.value})} />
                                <button 
                                    onClick={handleCreateLog}
                                    disabled={isSaving || !newLog.title}
                                    className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50"
                                >
                                    Registrar Update
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* List Column */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Histórico</h3>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {isLoading ? <div className="p-10 flex justify-center"><LoadingSpinner /></div> : (
                                items.map(item => (
                                    <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-slate-900 dark:text-white">{activeTab === 'polls' ? item.question : item.title}</h4>
                                            <span className="text-[10px] font-bold text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                                        </div>
                                        {activeTab === 'polls' ? (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {item.options?.map((opt: string, i: number) => (
                                                    <span key={i} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] rounded-md border border-indigo-100 dark:border-indigo-800">
                                                        {opt}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="mt-1">
                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded mr-2 ${
                                                    item.type === 'feature' ? 'bg-green-100 text-green-700' : 
                                                    item.type === 'fix' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {item.version} • {item.type}
                                                </span>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{item.description}</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                            {!isLoading && items.length === 0 && (
                                <div className="p-10 text-center text-slate-400 italic text-sm">Nenhum registro encontrado.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PollsTab;