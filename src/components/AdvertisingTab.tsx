
import React, { useState, useEffect, useRef } from 'react';
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
    const [imageUrlInput, setImageUrlInput] = useState(''); // Novo estado para URL
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
    
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                setImageUrlInput(''); // Limpa input de URL se usar arquivo
            } catch (error) {
                setError("Erro ao processar imagem.");
            } finally {
                setIsProcessingImage(false);
            }
        }
    };

    const handleUrlUse = () => {
        if (imageUrlInput.trim()) {
            setSelectedImage(imageUrlInput);
            if (fileInputRef.current) fileInputRef.current.value = ''; // Limpa input file
        }
    };

    const handleSave = async () => {
        if (!selectedImage || !title) {
            setError("Imagem e Título são obrigatórios.");
            return;
        }
        setIsSaving(true);
        setError(null);
        setSaveMessage(null);

        try {
            const payload = {
                id: editingId,
                image_base64: selectedImage, // API trata isso como URL ou Base64
                prompt: title,
                subtitle,
                link: targetLink,
                position,
                active: isActive
            };

            const res = await fetch('/api/admin?action=banners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setSaveMessage("Banner salvo com sucesso!");
                fetchBanners();
                resetForm();
            } else {
                throw new Error("Falha ao salvar banner.");
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir este banner?")) return;
        try {
            await fetch('/api/admin?action=banners', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            fetchBanners();
        } catch (e) {
            alert("Erro ao excluir.");
        }
    };

    const handleEdit = (banner: Banner) => {
        setEditingId(banner.id);
        setSelectedImage(banner.image_url);
        setImageUrlInput(banner.image_url.startsWith('http') ? banner.image_url : '');
        setTitle(banner.prompt);
        setSubtitle(banner.subtitle || '');
        setTargetLink(banner.link || '');
        setPosition(banner.position || 'hero');
        setIsActive(banner.active);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditingId(null);
        setSelectedImage(null);
        setImageUrlInput('');
        setTitle('');
        setSubtitle('');
        setTargetLink('');
        setPosition('hero');
        setIsActive(true);
        setError(null);
        setSaveMessage(null);
    };

    const handleGenerateAI = async (mode: 'text' | 'image') => {
        if (!aiPrompt) return;
        setIsAiLoading(mode);
        setError(null);
        try {
            const res = await fetch('/api/admin?action=generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt, mode: mode === 'text' ? 'text_metadata' : 'image_creation' })
            });
            const data = await res.json();
            
            if (res.ok) {
                if (mode === 'text') {
                    setTitle(data.title);
                    setSubtitle(data.subtitle);
                    setTargetLink(data.link);
                } else {
                    setSelectedImage(data.image);
                    setImageUrlInput('');
                }
            } else {
                throw new Error(data.error);
            }
        } catch (e: any) {
            setError("Erro IA: " + e.message);
        } finally {
            setIsAiLoading(null);
        }
    };

    const inputClass = "w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm";

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <header>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Publicidade</h2>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Gestão de Banners e Campanhas</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* FORMULÁRIO */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 dark:text-white">{editingId ? 'Editar Banner' : 'Novo Banner'}</h3>
                        {editingId && <button onClick={resetForm} className="text-xs text-red-500 font-bold hover:underline">Cancelar Edição</button>}
                    </div>

                    <div className="space-y-5">
                        {/* Imagem Preview / Upload / URL */}
                        <div className="space-y-3">
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className={`aspect-[2/1] rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden relative group transition-all ${selectedImage ? 'border-transparent' : 'border-slate-300 hover:border-indigo-500 bg-slate-50 dark:bg-slate-900'}`}
                            >
                                {isProcessingImage ? <LoadingSpinner /> : selectedImage ? (
                                    <>
                                        <img src={selectedImage} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition-opacity">Alterar Imagem</div>
                                    </>
                                ) : (
                                    <div className="text-center p-4">
                                        <span className="text-3xl block mb-2">🖼️</span>
                                        <span className="text-xs font-bold text-slate-400 uppercase">Clique para Upload</span>
                                    </div>
                                )}
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            
                            {/* URL Input */}
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={imageUrlInput} 
                                    onChange={(e) => setImageUrlInput(e.target.value)} 
                                    placeholder="Ou cole o link da imagem (https://...)"
                                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                                <button 
                                    type="button"
                                    onClick={handleUrlUse}
                                    disabled={!imageUrlInput}
                                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                                >
                                    Usar Link
                                </button>
                            </div>
                        </div>

                        {/* Campos de Texto */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Título Principal</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} placeholder="Ex: Oferta de Natal" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Subtítulo (Opcional)</label>
                                <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} className={inputClass} placeholder="Ex: Até 50% OFF" />
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Link Destino</label>
                                    <input type="text" value={targetLink} onChange={e => setTargetLink(e.target.value)} className={inputClass} placeholder="category:Celulares" />
                                </div>
                                <div className="w-1/3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Posição</label>
                                    <select value={position} onChange={e => setPosition(e.target.value as any)} className={inputClass}>
                                        <option value="hero">Hero (Topo)</option>
                                        <option value="slim">Slim (Meio)</option>
                                        <option value="grid">Grid (Fim)</option>
                                    </select>
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer p-2">
                                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Ativo no App</span>
                            </label>
                        </div>

                        {/* Ações */}
                        <div className="pt-2">
                            <button onClick={handleSave} disabled={isSaving} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 active:scale-95 transition-all disabled:opacity-50">
                                {isSaving ? <LoadingSpinner /> : (editingId ? 'ATUALIZAR BANNER' : 'CRIAR BANNER')}
                            </button>
                            {error && <div className="mt-4"><Alert message={error} type="error" /></div>}
                            {saveMessage && <div className="mt-4"><Alert message={saveMessage} type="success" /></div>}
                        </div>
                    </div>
                </div>

                {/* FERRAMENTAS IA & LISTA */}
                <div className="space-y-8">
                    {/* IA Generator */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                            <span className="text-2xl">✨</span> Criador Inteligente
                        </h3>
                        <p className="text-xs text-indigo-100 mb-4 opacity-90">Descreva sua campanha e a IA gera a imagem ou os textos para você.</p>
                        
                        <div className="space-y-3">
                            <input 
                                type="text" 
                                value={aiPrompt} 
                                onChange={e => setAiPrompt(e.target.value)} 
                                placeholder="Ex: Promoção de iPhones futurista..."
                                className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-indigo-200 text-sm focus:bg-white/20 outline-none transition-all"
                            />
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => handleGenerateAI('image')} 
                                    disabled={!!isAiLoading || !aiPrompt}
                                    className="flex-1 py-2 bg-white text-indigo-600 rounded-lg text-xs font-black uppercase hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                                >
                                    {isAiLoading === 'image' ? 'Criando...' : 'Gerar Imagem'}
                                </button>
                                <button 
                                    onClick={() => handleGenerateAI('text')} 
                                    disabled={!!isAiLoading || !aiPrompt}
                                    className="flex-1 py-2 bg-indigo-800 text-white rounded-lg text-xs font-black uppercase hover:bg-indigo-900 disabled:opacity-50 transition-colors"
                                >
                                    {isAiLoading === 'text' ? 'Escrevendo...' : 'Gerar Textos'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Lista de Banners */}
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wide">Banners Ativos</h3>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {isLoadingBanners ? <div className="p-10 flex justify-center"><LoadingSpinner /></div> : banners.length === 0 ? (
                                <p className="text-center py-8 text-slate-400 text-xs">Nenhum banner criado.</p>
                            ) : (
                                banners.map(banner => (
                                    <div key={banner.id} className="flex gap-3 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 group hover:border-indigo-300 transition-colors">
                                        <img src={banner.image_url} className="w-16 h-10 object-cover rounded-lg bg-slate-200" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-xs text-slate-800 dark:text-white truncate">{banner.prompt}</p>
                                            <p className="text-[10px] text-slate-500 uppercase">{banner.position} • {banner.active ? 'Ativo' : 'Inativo'}</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(banner)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg></button>
                                            <button onClick={() => handleDelete(banner.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvertisingTab;
