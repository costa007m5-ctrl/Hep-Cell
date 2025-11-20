
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface Banner {
    id: string;
    image_url: string;
    prompt: string;
    active: boolean;
    created_at: string;
}

const AdvertisingTab: React.FC = () => {
    // Generation State
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [generateError, setGenerateError] = useState<string | null>(null);

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
            const res = await fetch('/api/admin/banners');
            if (res.ok) {
                setBanners(await res.json());
            }
        } catch (error) {
            console.error("Erro ao buscar banners", error);
        } finally {
            setIsLoadingBanners(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!selectedImage) {
            setGenerateError("Por favor, selecione uma imagem do produto.");
            return;
        }
        setIsGenerating(true);
        setGenerateError(null);
        setGeneratedImage(null);

        try {
            const response = await fetch('/api/admin/generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    imageBase64: selectedImage,
                    prompt: prompt 
                })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || "Erro ao gerar banner.");
            }

            setGeneratedImage(data.image);
        } catch (error: any) {
            setGenerateError(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveBanner = async () => {
        if (!generatedImage) return;
        setIsSaving(true);
        setSaveMessage(null);

        try {
            const response = await fetch('/api/admin/banners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    image_base64: generatedImage,
                    prompt: prompt || 'Banner Gerado por IA'
                })
            });
            
            if (!response.ok) throw new Error("Erro ao salvar banner.");
            
            setSaveMessage({ text: "Banner salvo e ativado na loja!", type: 'success' });
            fetchBanners(); // Atualiza lista
            
            // Reset form parcial
            setGeneratedImage(null);
            setSelectedImage(null);
            setPrompt('');

        } catch (error: any) {
            setSaveMessage({ text: error.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBanner = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover este banner?")) return;
        try {
             await fetch('/api/admin/banners', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            setBanners(prev => prev.filter(b => b.id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Coluna Esquerda: Gerador */}
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Criar Banner com IA</h2>
                
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    {/* Upload Imagem */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">1. Foto do Produto</label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative overflow-hidden">
                                {selectedImage ? (
                                    <img src={selectedImage} className="absolute inset-0 w-full h-full object-contain p-2" alt="Preview" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                        <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Clique para enviar</span> ou arraste</p>
                                        <p className="text-xs text-slate-500">PNG, JPG (Celular, Fone, etc)</p>
                                    </div>
                                )}
                                <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                            </label>
                        </div>
                    </div>

                    {/* Prompt */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">2. Texto ou Oferta (Opcional)</label>
                        <textarea 
                            rows={3} 
                            className="block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="Ex: Oferta de Black Friday, 50% OFF, Frete Grátis..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        ></textarea>
                    </div>

                    <button 
                        onClick={handleGenerate} 
                        disabled={isGenerating || !selectedImage}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isGenerating ? <LoadingSpinner /> : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                Gerar Banner Mágico
                            </>
                        )}
                    </button>
                    
                    {generateError && <div className="mt-4"><Alert message={generateError} type="error" /></div>}
                </div>

                {/* Preview Resultado */}
                {generatedImage && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border-2 border-indigo-500 animate-fade-in">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Resultado:</h3>
                        <img src={generatedImage} className="w-full rounded-lg shadow-md mb-4" alt="Banner Gerado" />
                        <button 
                            onClick={handleSaveBanner}
                            disabled={isSaving}
                            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                             {isSaving ? <LoadingSpinner /> : 'Salvar e Ativar na Loja'}
                        </button>
                        {saveMessage && <div className="mt-4"><Alert message={saveMessage.text} type={saveMessage.type} /></div>}
                    </div>
                )}
            </div>

            {/* Coluna Direita: Banners Ativos */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Banners Ativos na Loja</h2>
                
                {isLoadingBanners ? <div className="flex justify-center"><LoadingSpinner /></div> : (
                    <div className="space-y-4">
                        {banners.length === 0 ? (
                            <p className="text-slate-500 dark:text-slate-400">Nenhum banner personalizado criado ainda.</p>
                        ) : (
                            banners.map(banner => (
                                <div key={banner.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative group">
                                    <img src={banner.image_url} className="w-full h-32 object-cover rounded-lg mb-2" alt="Banner" />
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{banner.prompt}</p>
                                        <button 
                                            onClick={() => handleDeleteBanner(banner.id)}
                                            className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                            Remover
                                        </button>
                                    </div>
                                    <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">Ativo</div>
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
