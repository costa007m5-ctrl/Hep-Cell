
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface Banner {
    id: string;
    image_url: string;
    prompt: string;
    subtitle?: string;
    link?: string;
    active: boolean;
    position?: 'hero' | 'slim' | 'grid';
    created_at: string;
}

const AdvertisingTab: React.FC = () => {
    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [targetLink, setTargetLink] = useState('');
    const [position, setPosition] = useState<'hero' | 'slim' | 'grid'>('hero');
    const [isActive, setIsActive] = useState(true);

    // AI States
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState<'text' | 'image' | null>(null);

    // UX States
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);

    // List State
    const [banners, setBanners] = useState<Banner[]>([]);
    const [isLoadingBanners, setIsLoadingBanners] = useState(true);

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        setIsLoadingBanners(true);
        try {
            const res = await fetch('/api/admin?action=banners');
            if (res.ok) {
                setBanners(await res.json());
            }
        } catch (error) {
            console.error("Erro ao buscar banners", error);
        } finally {
            setIsLoadingBanners(false);
        }
    };

    const processImageFile = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
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
                    if (ctx) {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', 0.9));
                    } else reject(new Error("Erro no canvas"));
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsProcessingImage(true);
            try {
                const processedBase64 = await processImageFile(file);
                setSelectedImage(processedBase64);
            } catch (error) {
                setError("Erro ao processar imagem.");
            } finally {
                setIsProcessingImage(false);
            }
        }
    };

    // --- AI HANDLERS ---

    const handleGenerateText = async () => {
        if (!aiPrompt.trim()) { setError("Digite um tema para a IA."); return; }
        setIsAiLoading('text');
        setError(null);
        try {
            const response = await fetch('/api/admin?action=generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt, mode: 'text_metadata' })
            });
            const data = await response.json();
            if (response.ok) {
                if (data.title) setTitle(data.title);
                if (data.subtitle) setSubtitle(data.subtitle);
                if (data.link) setTargetLink(data.link);
                setSaveMessage("Textos preenchidos pela IA!");
            } else throw new Error(data.error);
        } catch (error: any) {
            setError(error.message);
        } finally {
            setIsAiLoading(null);
        }
    };

    const handleGenerateImage = async () => {
        if (!aiPrompt.trim()) { setError("Digite uma descrição para a imagem."); return; }
        setIsAiLoading('image');
        setError(null);
        try {
            const response = await fetch('/api/admin?action=generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt, mode: 'image_creation' })
            });
            const data = await response.json();
            if (response.ok && data.image) {
                setSelectedImage(data.image);
                setSaveMessage("Imagem criada pela IA!");
            } else throw new Error(data.error || "Falha ao gerar imagem.");
        } catch (error: any) {
            setError(error.message);
        } finally {
            setIsAiLoading(null);
        }
    };

    // --- END AI HANDLERS ---

    const resetForm = () => {
        setEditingId(null);
        setSelectedImage(null);
        setTitle('');
        setSubtitle('');
        setTargetLink('');
        setPosition('hero');
        setIsActive(true);
        setError(null);
        setSaveMessage(null);
        setAiPrompt('');
    };

    const handleEdit = (banner: Banner) => {
        setEditingId(banner.id);
        setSelectedImage(banner.image_url);
        setTitle(banner.prompt || '');
        setSubtitle(banner.subtitle || '');
        setTargetLink(banner.link || '');
        setPosition(banner.position || 'hero');
        setIsActive(banner.active);
        
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveBanner = async () => {
        if (!selectedImage && !editingId) {
            setError("Selecione ou gere uma imagem para o banner.");
            return;
        }
        setIsSaving(true);
        setError(null);
        setSaveMessage(null);

        try {
            const response = await fetch('/api/admin?action=banners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: editingId,
                    image_base64: selectedImage,
                    prompt: title,
                    subtitle,
                    link: targetLink,
                    position,
                    active: isActive
                })
            });
            
            if (!response.ok) throw new Error("Erro ao salvar banner.");
            
            setSaveMessage(editingId ? "Banner atualizado!" : "Banner criado!");
            fetchBanners();
            if (!editingId) resetForm();
        } catch (error: any) {
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBanner = async (id: string) => {
        if (!confirm("Remover este banner permanentemente?")) return;
        try {
             await fetch('/api/admin?action=banners', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            setBanners(prev => prev.filter(b => b.id !== id));
        } catch (error) { console.error(error); }
    };

    const getPositionLabel = (pos?: string) => {
        switch(pos) {
            case 'hero': return 'Topo (Principal)';
            case 'slim': return 'Meio (Faixa)';
            case 'grid': return 'Fim (Quadrado)';
            default: return 'Geral';
        }
    };

    return (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-8 h-full overflow-y-auto">
            {/* EDITOR (4 COLUNAS) */}
            <div className="lg:col-span-5 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {editingId ? 'Editar Banner' : 'Novo Banner'}
                        </h2>
                        <p className="text-xs text-slate-500">Configure imagem e link de destino.</p>
                    </div>
                    {editingId && (
                        <button onClick={resetForm} className="text-xs text-red-500 font-bold hover:underline bg-red-50 px-3 py-1 rounded-lg">Cancelar</button>
                    )}
                </div>
                
                {/* Ferramentas de IA */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-5 rounded-2xl shadow-lg text-white">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">✨</span>
                        <h3 className="font-bold text-sm uppercase tracking-wide">Criação com IA</h3>
                    </div>
                    <div className="space-y-3">
                        <input 
                            type="text" 
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Ex: Oferta de Carnaval para iPhones..."
                            className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                        />
                        <div className="flex gap-2">
                            <button 
                                onClick={handleGenerateText}
                                disabled={!!isAiLoading}
                                className="flex-1 py-2 bg-white text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                            >
                                {isAiLoading === 'text' ? <LoadingSpinner /> : 'Preencher Textos'}
                            </button>
                            <button 
                                onClick={handleGenerateImage}
                                disabled={!!isAiLoading}
                                className="flex-1 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                            >
                                {isAiLoading === 'image' ? <LoadingSpinner /> : 'Gerar Imagem'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
                    {/* Visualizador de Imagem */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Imagem do Banner</label>
                        <label className={`flex flex-col items-center justify-center w-full aspect-[2/1] border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:bg-slate-100 transition-all relative overflow-hidden group ${isProcessingImage ? 'opacity-50' : ''}`}>
                            {selectedImage ? (
                                <>
                                    <img src={selectedImage} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition-opacity">Trocar Imagem</div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <p className="text-xs text-slate-500">Clique para enviar</p>
                                </div>
                            )}
                            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" disabled={isProcessingImage} />
                        </label>
                    </div>

                    {/* Campos de Texto */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Título Principal</label>
                            <input 
                                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Ex: Oferta Relâmpago"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Subtítulo (Opcional)</label>
                            <input 
                                type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                                className="w-full px-3 py-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Ex: Até 50% OFF"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Link de Redirecionamento</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" value={targetLink} onChange={(e) => setTargetLink(e.target.value)}
                                    className="flex-1 px-3 py-2.5 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="Ex: category:Celulares"
                                />
                            </div>
                            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 text-[10px]">
                                <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded cursor-pointer hover:bg-indigo-100" onClick={() => setTargetLink('category:Celulares')}>category:Nome</span>
                                <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded cursor-pointer hover:bg-indigo-100" onClick={() => setTargetLink('collection:Ofertas')}>collection:Nome</span>
                                <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded cursor-pointer hover:bg-indigo-100" onClick={() => setTargetLink('brand:Apple')}>brand:Nome</span>
                            </div>
                        </div>
                    </div>

                    {/* Configurações */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Posição na Loja</label>
                            <select 
                                value={position} 
                                onChange={(e) => setPosition(e.target.value as any)}
                                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="hero">Topo (Hero)</option>
                                <option value="slim">Meio (Slim)</option>
                                <option value="grid">Fim (Grid)</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center space-x-3 cursor-pointer p-2 border rounded-lg w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 hover:bg-slate-100 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={isActive} 
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <span className={`text-sm font-bold ${isActive ? 'text-green-600' : 'text-slate-400'}`}>
                                    {isActive ? 'Ativo' : 'Inativo'}
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Botão Salvar */}
                    <button 
                        onClick={handleSaveBanner}
                        disabled={isSaving}
                        className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-[0.98] mt-2"
                    >
                         {isSaving ? <LoadingSpinner /> : (editingId ? 'Salvar Alterações' : 'Criar Banner')}
                    </button>
                    
                    {error && <Alert message={error} type="error" />}
                    {saveMessage && <Alert message={saveMessage} type="success" />}
                </div>
            </div>

            {/* LISTA (8 COLUNAS) */}
            <div className="lg:col-span-7">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Banners Ativos</h2>
                    <button onClick={fetchBanners} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" /></svg>
                    </button>
                </div>
                
                {isLoadingBanners ? <div className="flex justify-center p-10"><LoadingSpinner /></div> : (
                    <div className="space-y-4">
                        {banners.length === 0 ? (
                            <div className="text-center py-12 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                <p className="text-slate-500">Nenhum banner encontrado.</p>
                            </div>
                        ) : (
                            banners.map(banner => (
                                <div 
                                    key={banner.id} 
                                    className={`relative bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm flex gap-4 transition-all group ${!banner.active ? 'opacity-60 grayscale border-slate-200' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                >
                                    <div className={`w-32 h-20 rounded-lg overflow-hidden shrink-0 bg-slate-100 relative ${banner.position === 'grid' ? 'aspect-square w-20' : 'aspect-[2/1]'}`}>
                                        <img src={banner.image_url} className="w-full h-full object-cover" alt="Banner" />
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 text-center uppercase">
                                            {getPositionLabel(banner.position)}
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-slate-900 dark:text-white truncate pr-2">{banner.prompt || 'Sem Título'}</h4>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${banner.active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                                    {banner.active ? 'Ativo' : 'Off'}
                                                </span>
                                            </div>
                                            {banner.subtitle && <p className="text-xs text-slate-500 truncate">{banner.subtitle}</p>}
                                            {banner.link && <p className="text-[10px] text-indigo-500 font-mono truncate mt-1 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded w-fit">{banner.link}</p>}
                                        </div>
                                        
                                        <div className="flex justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleEdit(banner)}
                                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                                            >
                                                Editar
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteBanner(banner.id)}
                                                className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                                            >
                                                Excluir
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdvertisingTab;
