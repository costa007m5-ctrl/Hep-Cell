
import React, { useState, useEffect, useRef } from 'react';
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
    return (
        <div className="relative w-[300px] h-[600px] bg-black rounded-[3rem] border-[8px] border-slate-800 shadow-2xl overflow-hidden mx-auto">
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
                <div className="mt-4 mx-4 relative aspect-[4/5] rounded-2xl overflow-hidden shadow-lg group cursor-pointer">
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
                            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider mb-1">{banner.subtitle}</span>
                        )}
                        <h2 className="text-2xl font-black text-white leading-none mb-2" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                            {banner.title || 'Título do Banner'}
                        </h2>
                        <button className="mt-2 w-fit bg-white text-black text-xs font-bold px-4 py-2 rounded-full shadow-lg">
                            {banner.cta_text || 'Ver Oferta'}
                        </button>
                    </div>
                </div>

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
    const [prompt, setPrompt] = useState('');
    const [studioForm, setStudioForm] = useState({
        title: '',
        subtitle: '',
        cta: 'Ver Agora',
        link: 'category:Ofertas',
        segment: 'all',
        startDate: new Date().toISOString().split('T')[0],
        endDate: ''
    });
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    // Mock Metrics
    const metrics = {
        impressions: banners.reduce((acc, b) => acc + b.views, 0) + 12500,
        clicks: banners.reduce((acc, b) => acc + b.clicks, 0) + 480,
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
            setUploadFile(file);
            const reader = new FileReader();
            reader.onload = () => setGeneratedImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleGenerateAI = async () => {
        if (!prompt) return alert("Digite um prompt!");
        setIsGenerating(true);
        try {
            const res = await fetch('/api/admin/generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();
            if (data.image) {
                setGeneratedImage(data.image);
                if (data.suggestedLink) setStudioForm(prev => ({ ...prev, link: data.suggestedLink }));
            }
        } catch (e) {
            alert("Erro na geração.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePublish = async () => {
        if (!generatedImage) return alert("Imagem obrigatória");
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
                    start_date: studioForm.startDate,
                    end_date: studioForm.endDate,
                    prompt: prompt
                })
            });
            if (res.ok) {
                alert("Campanha Publicada!");
                fetchBanners();
                setActiveTab('campaigns');
            }
        } catch (e) { alert("Erro ao publicar"); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir campanha?")) return;
        await fetch('/api/admin/banners', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        fetchBanners();
    };

    if (isLoading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            {/* Tabs Header */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-2 gap-6">
                <button onClick={() => setActiveTab('dashboard')} className={`py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Dashboard</button>
                <button onClick={() => setActiveTab('studio')} className={`py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'studio' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Creative Studio</button>
                <button onClick={() => setActiveTab('campaigns')} className={`py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'campaigns' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Campanhas</button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-6">
                
                {/* --- DASHBOARD --- */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <StatCard title="Impressões Totais" value={metrics.impressions.toLocaleString()} subtext="vs mês anterior" trend="up" />
                            <StatCard title="Cliques" value={metrics.clicks.toLocaleString()} subtext="Taxa estável" trend="neutral" />
                            <StatCard title="CTR Médio" value={metrics.ctr} subtext="Acima da média" trend="up" />
                            <StatCard title="Campanhas Ativas" value={banners.filter(b => b.active).length.toString()} subtext="Em rodízio" trend="neutral" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Desempenho Recente</h3>
                                <div className="h-64 flex items-end justify-between gap-2 px-2">
                                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
                                        <div key={i} className="w-full bg-indigo-100 dark:bg-indigo-900/30 rounded-t-lg relative group">
                                            <div className="absolute bottom-0 w-full bg-indigo-600 rounded-t-lg transition-all duration-1000" style={{ height: `${h}%` }}></div>
                                            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded pointer-events-none transition-opacity">{h * 10} views</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Melhor Performance</h3>
                                {banners.length > 0 ? (
                                    <div className="relative rounded-xl overflow-hidden group">
                                        <img src={banners[0].image_url} className="w-full h-48 object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex flex-col justify-end">
                                            <p className="text-white font-bold">{banners[0].title}</p>
                                            <p className="text-xs text-slate-300">{banners[0].clicks} cliques</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-slate-400 text-center py-10">Sem dados suficientes</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CREATIVE STUDIO --- */}
                {activeTab === 'studio' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                        {/* Controls */}
                        <div className="lg:col-span-7 space-y-6 overflow-y-auto pr-2">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    1. Visual
                                    <span className="text-xs font-normal bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">IA Powered</span>
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative">
                                        <input type="file" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Upload Imagem</span>
                                        <span className="text-xs text-slate-400">JPG, PNG, WebP</span>
                                    </div>
                                    
                                    <div className="border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-4">
                                        <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2 block">Gerar com IA (Gemini)</label>
                                        <textarea 
                                            value={prompt}
                                            onChange={e => setPrompt(e.target.value)}
                                            className="w-full p-2 text-sm border rounded-lg mb-2 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white resize-none"
                                            rows={3}
                                            placeholder="Ex: Banner futurista para promoção de iPhone 15 com fundo neon..."
                                        />
                                        <button 
                                            onClick={handleGenerateAI} 
                                            disabled={isGenerating}
                                            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex justify-center"
                                        >
                                            {isGenerating ? <LoadingSpinner /> : '✨ Gerar Imagem'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">2. Conteúdo e Ação</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Título Principal</label>
                                            <input type="text" value={studioForm.title} onChange={e => setStudioForm({...studioForm, title: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white" placeholder="Ex: Super Oferta" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Subtítulo / Badge</label>
                                            <input type="text" value={studioForm.subtitle} onChange={e => setStudioForm({...studioForm, subtitle: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white" placeholder="Ex: Só hoje" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Texto Botão</label>
                                            <input type="text" value={studioForm.cta} onChange={e => setStudioForm({...studioForm, cta: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Link de Destino</label>
                                            <input type="text" value={studioForm.link} onChange={e => setStudioForm({...studioForm, link: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white font-mono text-xs" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">3. Segmentação e Agendamento</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Público Alvo</label>
                                        <select value={studioForm.segment} onChange={e => setStudioForm({...studioForm, segment: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                            <option value="all">Todos os Usuários</option>
                                            <option value="vip">Clientes VIP (Ouro/Black)</option>
                                            <option value="churn">Risco de Churn</option>
                                            <option value="new">Novos Cadastros</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Data Início</label>
                                        <input type="date" value={studioForm.startDate} onChange={e => setStudioForm({...studioForm, startDate: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handlePublish}
                                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg shadow-green-500/20 transition-all active:scale-[0.98]"
                            >
                                Publicar Campanha
                            </button>
                        </div>

                        {/* Preview */}
                        <div className="lg:col-span-5 flex items-center justify-center bg-slate-200 dark:bg-slate-900/50 rounded-3xl border border-slate-300 dark:border-slate-800 p-8 sticky top-0">
                            <PhonePreview banner={studioForm} backgroundImage={generatedImage} />
                        </div>
                    </div>
                )}

                {/* --- CAMPAIGNS LIST --- */}
                {activeTab === 'campaigns' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Campanhas Ativas</h2>
                            <button onClick={() => setActiveTab('studio')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">+ Nova Campanha</button>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Banner</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Detalhes</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Performance</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {banners.map((banner) => (
                                        <tr key={banner.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                            <td className="px-6 py-4">
                                                <img src={banner.image_url} className="h-16 w-24 object-cover rounded-lg shadow-sm border border-slate-200 dark:border-slate-600" alt="" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">{banner.title}</p>
                                                <p className="text-xs text-slate-500">{banner.link}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs font-medium">👁️ {banner.views} imp.</p>
                                                <p className="text-xs font-medium text-green-600">🖱️ {banner.clicks} clicks</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${banner.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {banner.active ? 'Ativo' : 'Pausado'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleDelete(banner.id)} className="text-red-600 hover:text-red-800 text-xs font-bold border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                                                    Excluir
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {banners.length === 0 && (
                                <div className="p-10 text-center text-slate-500">Nenhuma campanha encontrada.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdvertisingTab;
