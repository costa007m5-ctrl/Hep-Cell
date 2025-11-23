import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface Banner {
    id: string;
    image_url: string;
    title: string;
    subtitle: string;
    cta_text: string;
    link: string;
    segment: string;
    location: 'store' | 'home';
    active: boolean;
    start_date: string;
    end_date: string;
    clicks: number;
    views: number;
    prompt?: string;
}

// --- Componentes de UI ---

const StatCard: React.FC<{ title: string; value: string; subtext: string; trend: 'up' | 'down' | 'neutral' }> = ({ title, value, subtext, trend }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        <div className="flex items-end justify-between mt-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{value}</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trend === 'up' ? 'bg-green-100 text-green-700' : trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '−'} {subtext}
            </span>
        </div>
    </div>
);

const PhonePreview: React.FC<{ banner: Partial<Banner>; backgroundImage: string | null }> = ({ banner, backgroundImage }) => {
    const isHome = banner.location === 'home';

    return (
        <div className="relative w-[300px] h-[600px] bg-black rounded-[3rem] border-[8px] border-slate-800 shadow-2xl overflow-hidden mx-auto transform scale-90 lg:scale-100 transition-transform">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-800 rounded-b-xl z-20"></div>
            
            {/* Screen Content */}
            <div className="w-full h-full bg-slate-50 dark:bg-slate-900 flex flex-col pt-10 relative">
                {/* Fake App Header */}
                <div className="px-4 py-2 flex justify-between items-center">
                    <div className="w-8 h-8 bg-indigo-600 rounded-full"></div>
                    <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                </div>

                {/* The Banner Preview */}
                <div className={`mt-4 mx-4 relative rounded-2xl overflow-hidden shadow-lg group cursor-pointer ${isHome ? 'aspect-[3/2]' : 'aspect-[4/5]'}`}>
                    {backgroundImage ? (
                        <img src={backgroundImage} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                        <div className="w-full h-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                            Sem Imagem
                        </div>
                    )}
                    
                    {/* Overlay Text */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-5 text-left">
                        {banner.subtitle && (
                            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider mb-1 bg-black/30 w-fit px-1 rounded backdrop-blur-sm">{banner.subtitle}</span>
                        )}
                        <h2 className="text-xl font-black text-white leading-none mb-2 drop-shadow-md line-clamp-2">
                            {banner.title || 'Título do Banner'}
                        </h2>
                        {!isHome && (
                            <button className="mt-2 w-fit bg-white text-black text-xs font-bold px-4 py-2 rounded-full shadow-lg hover:bg-slate-100 transition-colors">
                                {banner.cta_text || 'Ver Oferta'}
                            </button>
                        )}
                    </div>
                </div>
                
                {isHome && (
                    <div className="px-4 mt-2 text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Exibição: Tela Inicial</p>
                    </div>
                )}

                {/* Fake App Content Below */}
                <div className="mt-6 px-4 space-y-3 opacity-30">
                    <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                        <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AdvertisingTab: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'studio' | 'campaigns'>('dashboard');
    const [banners, setBanners] = useState<Banner[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Studio State
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingText, setIsGeneratingText] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [studioForm, setStudioForm] = useState({
        title: '',
        subtitle: '',
        cta: 'Ver Agora',
        link: 'category:Ofertas',
        segment: 'all',
        location: 'store' as 'store' | 'home',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        sendNotification: false
    });
    
    // Mock Metrics (Real data would come from DB agg)
    const metrics = {
        impressions: banners.reduce((acc, b) => acc + (b.views || 0), 0) + 12500,
        clicks: banners.reduce((acc, b) => acc + (b.clicks || 0), 0) + 480,
        ctr: '3.8%',
        cost: 'R$ 0,00'
    };

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        try {
            const res = await fetch('/api/admin/banners');
            if (res.ok) setBanners(await res.json());
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setGeneratedImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleGenerateAI = async () => {
        if (!prompt) return alert("Digite um tema para gerar!");
        setIsGenerating(true);
        try {
            const res = await fetch('/api/admin/generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type: 'image' })
            });
            const data = await res.json();
            if (data.image) {
                setGeneratedImage(data.image);
                if (data.suggestedLink) setStudioForm(prev => ({ ...prev, link: data.suggestedLink }));
            } else {
                throw new Error("Falha na geração");
            }
        } catch (e) {
            alert("Erro ao gerar imagem. Tente novamente.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateText = async () => {
        if (!prompt) return alert("Digite um tema para a IA escrever!");
        setIsGeneratingText(true);
        try {
            const res = await fetch('/api/admin/generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type: 'text' })
            });
            const data = await res.json();
            if (data.title) {
                setStudioForm(prev => ({ 
                    ...prev, 
                    title: data.title,
                    subtitle: data.subtitle,
                    cta: data.cta_text,
                    segment: data.suggested_segment || 'all'
                }));
            }
        } catch (e) {
            alert("Erro ao gerar textos.");
        } finally {
            setIsGeneratingText(false);
        }
    };

    const handlePublish = async () => {
        if (!generatedImage) return alert("Imagem obrigatória. Faça upload ou gere com IA.");
        if (!studioForm.title) return alert("Título obrigatório.");

        try {
            const res = await fetch('/api/admin/banners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_base64: generatedImage,
                    title: studioForm.title,
                    subtitle: studioForm.subtitle,
                    cta_text: studioForm.cta,
                    link: studioForm.link,
                    segment: studioForm.segment,
                    location: studioForm.location,
                    start_date: studioForm.startDate,
                    end_date: studioForm.endDate,
                    prompt: prompt,
                    sendNotification: studioForm.sendNotification
                })
            });
            if (res.ok) {
                alert("Campanha Publicada com Sucesso!");
                if (studioForm.sendNotification) alert("Notificações enviadas para a fila.");
                fetchBanners();
                setActiveTab('campaigns');
                // Reset form
                setStudioForm({ title: '', subtitle: '', cta: 'Ver Agora', link: 'category:Ofertas', segment: 'all', location: 'store', startDate: new Date().toISOString().split('T')[0], endDate: '', sendNotification: false });
                setGeneratedImage(null);
                setPrompt('');
            } else {
                throw new Error("Falha na API");
            }
        } catch (e) { alert("Erro ao publicar campanha."); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir campanha permanentemente?")) return;
        await fetch('/api/admin/banners', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        fetchBanners();
    };

    const toggleActive = async (id: string, currentState: boolean) => {
        await fetch('/api/admin/banners', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active: !currentState }) });
        fetchBanners();
    };

    if (isLoading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            {/* Tabs Header */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-2 gap-6 sticky top-0 z-10">
                <button onClick={() => setActiveTab('dashboard')} className={`py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Dashboard</button>
                <button onClick={() => setActiveTab('studio')} className={`py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'studio' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Creative Studio</button>
                <button onClick={() => setActiveTab('campaigns')} className={`py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'campaigns' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Minhas Campanhas</button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-4 sm:p-6">
                
                {/* --- DASHBOARD --- */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard title="Visualizações" value={metrics.impressions.toLocaleString()} subtext="Total" trend="up" />
                            <StatCard title="Cliques" value={metrics.clicks.toLocaleString()} subtext="Total" trend="neutral" />
                            <StatCard title="CTR Médio" value={metrics.ctr} subtext="Conversão" trend="up" />
                            <StatCard title="Ativas" value={banners.filter(b => b.active).length.toString()} subtext="Campanhas" trend="neutral" />
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Melhor Desempenho</h3>
                            {banners.length > 0 ? (
                                <div className="flex gap-6 overflow-x-auto pb-4">
                                    {banners.slice(0, 3).map((banner) => (
                                        <div key={banner.id} className="min-w-[200px] relative rounded-xl overflow-hidden group border border-slate-200 dark:border-slate-700">
                                            <img src={banner.image_url} className="w-full h-32 object-cover" />
                                            <div className="p-3 bg-white dark:bg-slate-900">
                                                <p className="text-sm font-bold truncate text-slate-900 dark:text-white">{banner.title}</p>
                                                <div className="flex justify-between mt-2 text-xs text-slate-500">
                                                    <span>👁️ {banner.views || 0}</span>
                                                    <span className="text-green-600 font-bold">🖱️ {banner.clicks || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-slate-400 text-center py-10">Sem dados suficientes. Crie sua primeira campanha!</div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- CREATIVE STUDIO --- */}
                {activeTab === 'studio' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                        {/* Controls */}
                        <div className="lg:col-span-7 space-y-6 overflow-y-auto pr-2 pb-20">
                            
                            {/* Seção 1: Criativo */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">1. Criativo Visual & Texto</h3>
                                    <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-1 rounded-lg">Gemini AI</span>
                                </div>
                                
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Tema / Prompt</label>
                                    <textarea 
                                        value={prompt}
                                        onChange={e => setPrompt(e.target.value)}
                                        className="w-full p-3 text-sm border rounded-xl bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                                        rows={3}
                                        placeholder="Ex: Promoção de dia dos namorados com iPhones em oferta, fundo vermelho vibrante..."
                                    />
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={handleGenerateAI} 
                                            disabled={isGenerating}
                                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex justify-center gap-2 items-center shadow-lg shadow-indigo-500/20"
                                        >
                                            {isGenerating ? <LoadingSpinner /> : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    Gerar Imagem
                                                </>
                                            )}
                                        </button>
                                        <button 
                                            onClick={handleGenerateText} 
                                            disabled={isGeneratingText}
                                            className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50 flex justify-center gap-2 items-center shadow-lg shadow-purple-500/20"
                                        >
                                            {isGeneratingText ? <LoadingSpinner /> : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    Escrever Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                                        </div>
                                        <div className="relative flex justify-center text-xs">
                                            <span className="px-2 bg-white dark:bg-slate-800 text-slate-500">ou upload manual</span>
                                        </div>
                                    </div>
                                    <input type="file" onChange={handleImageUpload} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-700 dark:file:text-slate-300"/>
                                </div>
                            </div>

                            {/* Seção 2: Conteúdo e Destino */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">2. Conteúdo & Destino</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Título</label>
                                            <input type="text" value={studioForm.title} onChange={e => setStudioForm({...studioForm, title: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Oferta..." />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Subtítulo / Badge</label>
                                            <input type="text" value={studioForm.subtitle} onChange={e => setStudioForm({...studioForm, subtitle: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: -50%" />
                                        </div>
                                    </div>
                                    
                                    {/* Local de Exibição Selector */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Local de Exibição</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setStudioForm({ ...studioForm, location: 'store' })}
                                                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${studioForm.location === 'store' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}
                                            >
                                                🏪 Loja (Carrossel)
                                            </button>
                                            <button
                                                onClick={() => setStudioForm({ ...studioForm, location: 'home' })}
                                                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${studioForm.location === 'home' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}
                                            >
                                                🏠 Início (Destaque)
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Botão (CTA)</label>
                                            <input type="text" value={studioForm.cta} onChange={e => setStudioForm({...studioForm, cta: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Link Interno</label>
                                            <input type="text" value={studioForm.link} onChange={e => setStudioForm({...studioForm, link: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Seção 3: Audiência e Disparo */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">3. Audiência & Disparo</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Segmento</label>
                                            <select value={studioForm.segment} onChange={e => setStudioForm({...studioForm, segment: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                                <option value="all">Todos os Usuários</option>
                                                <option value="vip">Clientes VIP</option>
                                                <option value="new">Novos Cadastros</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Início</label>
                                            <input type="date" value={studioForm.startDate} onChange={e => setStudioForm({...studioForm, startDate: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    </div>
                                    
                                    <label className="flex items-center p-3 border border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl cursor-pointer transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                                        <input type="checkbox" checked={studioForm.sendNotification} onChange={e => setStudioForm({...studioForm, sendNotification: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                        <span className="ml-3 text-sm font-bold text-indigo-900 dark:text-indigo-100">
                                            Enviar Notificação Push para todos os usuários
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <button 
                                onClick={handlePublish}
                                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg shadow-green-500/30 transition-all active:scale-[0.98]"
                            >
                                Publicar Campanha
                            </button>
                        </div>

                        {/* Preview Stick */}
                        <div className="lg:col-span-5 flex items-start justify-center pt-6 pb-20 bg-slate-100 dark:bg-slate-900/30 rounded-3xl border border-slate-200 dark:border-slate-800 h-fit sticky top-0">
                            <PhonePreview banner={studioForm} backgroundImage={generatedImage} />
                        </div>
                    </div>
                )}

                {/* --- CAMPAIGNS LIST --- */}
                {activeTab === 'campaigns' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gerenciador de Campanhas</h2>
                            <button onClick={() => setActiveTab('studio')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm">+ Nova Campanha</button>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Banner</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Detalhes</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Local</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Métricas</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {banners.map((banner) => (
                                        <tr key={banner.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <img src={banner.image_url} className="h-16 w-24 object-cover rounded-lg shadow-sm border border-slate-200 dark:border-slate-600" alt="" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white mb-1">{banner.title}</p>
                                                <p className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded w-fit font-mono">{banner.link}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${banner.location === 'home' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {banner.location === 'home' ? 'Início' : 'Loja'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-4 text-xs">
                                                    <div>
                                                        <span className="block font-bold text-slate-700 dark:text-slate-300">{banner.views}</span>
                                                        <span className="text-slate-400">Views</span>
                                                    </div>
                                                    <div>
                                                        <span className="block font-bold text-green-600">{banner.clicks}</span>
                                                        <span className="text-slate-400">Clicks</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => toggleActive(banner.id, banner.active)}
                                                    className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase border transition-all ${banner.active ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                                >
                                                    {banner.active ? 'Ativo' : 'Pausado'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleDelete(banner.id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {banners.length === 0 && (
                                <div className="p-10 text-center flex flex-col items-center text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <p>Nenhuma campanha encontrada.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdvertisingTab;