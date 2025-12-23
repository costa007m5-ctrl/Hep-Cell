
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface Banner {
    id: string;
    image_url: string;
    prompt: string;
    link?: string;
    active: boolean;
    created_at: string;
}

const AdvertisingTab: React.FC = () => {
    // Generation State
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [targetLink, setTargetLink] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);

    // Saving State
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

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
                setGenerateError("Erro ao processar imagem.");
            } finally {
                setIsProcessingImage(false);
            }
        }
    };

    const handleGenerate = async () => {
        if (!selectedImage) return;
        setIsGenerating(true);
        try {
            const response = await fetch('/api/admin?action=generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: selectedImage, prompt: prompt || 'Banner promocional' })
            });
            const data = await response.json();
            if (response.ok) {
                // Atualiza a imagem com a versão processada pela IA (se houver) ou mantém a original
                if (data.image) setSelectedImage(data.image);
                if (data.suggestedLink) setTargetLink(data.suggestedLink);
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            setGenerateError(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveBanner = async () => {
        if (!selectedImage) return;
        setIsSaving(true);
        setSaveMessage(null);

        try {
            const response = await fetch('/api/admin?action=banners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    image_base64: selectedImage,
                    prompt: prompt || 'Banner da Loja',
                    link: targetLink 
                })
            });
            
            if (!response.ok) throw new Error("Erro ao salvar banner.");
            
            setSaveMessage({ text: "Banner ativado na loja!", type: 'success' });
            fetchBanners();
            setSelectedImage(null);
            setPrompt('');
            setTargetLink('');
        } catch (error: any) {
            setSaveMessage({ text: error.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBanner = async (id: string) => {
        if (!confirm("Remover este banner?")) return;
        try {
             await fetch('/api/admin?action=banners', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            setBanners(prev => prev.filter(b => b.id !== id));
        } catch (error) { console.error(error); }
    };

    return (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-8 h-full overflow-y-auto">
            {/* Editor */}
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Criar Novo Banner</h2>
                
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    {/* Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">1. Imagem (Formatos Wide funcionam melhor)</label>
                        <div className="flex items-center justify-center w-full">
                            <label className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:bg-slate-100 transition-colors relative overflow-hidden ${isProcessingImage ? 'opacity-50' : ''}`}>
                                {selectedImage ? (
                                    <img src={selectedImage} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <p className="text-sm text-slate-500 font-medium">Clique para enviar imagem</p>
                                    </div>
                                )}
                                <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" disabled={isProcessingImage} />
                            </label>
                        </div>
                    </div>

                    {/* Dados */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Link de Destino (Opcional)</label>
                            <input 
                                type="text" 
                                value={targetLink}
                                onChange={(e) => setTargetLink(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500"
                                placeholder="Ex: category:Celulares ou https://..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Título / Descrição (Opcional)</label>
                            <input 
                                type="text" 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500"
                                placeholder="Título do banner para referência"
                            />
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="mt-6 flex flex-col gap-3">
                        <button 
                            onClick={handleGenerate} 
                            disabled={isGenerating || !selectedImage}
                            className="w-full py-3 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isGenerating ? <LoadingSpinner /> : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    Melhorar com IA (Opcional)
                                </>
                            )}
                        </button>
                        
                        <button 
                            onClick={handleSaveBanner}
                            disabled={isSaving || !selectedImage}
                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                             {isSaving ? <LoadingSpinner /> : 'Salvar Banner na Loja'}
                        </button>
                    </div>
                    
                    {generateError && <div className="mt-4"><Alert message={generateError} type="error" /></div>}
                    {saveMessage && <div className="mt-4"><Alert message={saveMessage.text} type={saveMessage.type} /></div>}
                </div>
            </div>

            {/* Lista de Banners */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Banners Ativos ({banners.length})</h2>
                
                {isLoadingBanners ? <div className="flex justify-center"><LoadingSpinner /></div> : (
                    <div className="grid gap-4">
                        {banners.length === 0 ? (
                            <div className="text-center py-10 bg-slate-100 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                <p className="text-slate-500">Nenhum banner ativo. Adicione um ao lado.</p>
                            </div>
                        ) : (
                            banners.map(banner => (
                                <div key={banner.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex gap-4 group">
                                    <img src={banner.image_url} className="w-32 h-20 object-cover rounded-lg bg-slate-100" alt="Banner" />
                                    <div className="flex-1 flex flex-col justify-between py-1">
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{banner.prompt}</p>
                                            {banner.link && <p className="text-xs text-indigo-600 truncate bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded w-fit mt-1">{banner.link}</p>}
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] text-slate-400">{new Date(banner.created_at).toLocaleDateString()}</span>
                                            <button 
                                                onClick={() => handleDeleteBanner(banner.id)}
                                                className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                title="Excluir Banner"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
