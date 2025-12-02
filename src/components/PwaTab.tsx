
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface Manifest {
    name: string;
    icons: any[];
}

const PwaTab: React.FC = () => {
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);

    useEffect(() => {
        const fetchManifest = async () => {
            try {
                // Busca da API dinâmica agora
                const response = await fetch('/api/manifest');
                if (!response.ok) throw new Error('Erro ao carregar manifesto.');
                setManifest(await response.json());
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchManifest();
    }, []);

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(type);
        
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            try {
                const res = await fetch('/api/admin/upload-pwa-icon', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, imageBase64: base64 })
                });
                
                if (!res.ok) throw new Error('Erro no upload');
                
                alert("Ícone atualizado com sucesso! O manifesto será regenerado.");
                window.location.reload();
            } catch (err) {
                alert("Falha ao enviar ícone.");
            } finally {
                setUploading(null);
            }
        };
        reader.readAsDataURL(file);
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="p-6 space-y-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gerenciamento de PWA</h2>
            <p className="text-slate-500">Configure os ícones do aplicativo para instalação em dispositivos móveis.</p>

            {error && <Alert message={error} type="error" />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-bold text-lg mb-4">Ícones Padrão (Any)</h3>
                    <p className="text-xs text-slate-400 mb-4">Ícones transparentes usados na maioria dos lugares.</p>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400">192</div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">Ícone 192x192 (PNG)</label>
                                <input 
                                    type="file" 
                                    accept="image/png"
                                    onChange={(e) => handleIconUpload(e, 'pwa_icon_192')}
                                    disabled={!!uploading}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400">512</div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">Ícone 512x512 (PNG)</label>
                                <input 
                                    type="file" 
                                    accept="image/png"
                                    onChange={(e) => handleIconUpload(e, 'pwa_icon_512')}
                                    disabled={!!uploading}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-bold text-lg mb-4">Ícones Adaptáveis (Maskable)</h3>
                    <p className="text-xs text-slate-400 mb-4">Ícones com margem para Android (círculo/quadrado).</p>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xs text-slate-400">192</div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">Maskable 192x192 (PNG)</label>
                                <input 
                                    type="file" 
                                    accept="image/png"
                                    onChange={(e) => handleIconUpload(e, 'pwa_icon_192_maskable')}
                                    disabled={!!uploading}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xs text-slate-400">512</div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">Maskable 512x512 (PNG)</label>
                                <input 
                                    type="file" 
                                    accept="image/png"
                                    onChange={(e) => handleIconUpload(e, 'pwa_icon_512_maskable')}
                                    disabled={!!uploading}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {uploading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded-lg flex items-center gap-3">
                        <LoadingSpinner />
                        <span>Enviando ícone {uploading}...</span>
                    </div>
                </div>
            )}

            <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-900 rounded-lg">
                <h4 className="font-bold mb-2">Manifesto Atual (Visualização)</h4>
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                    {JSON.stringify(manifest, null, 2)}
                </pre>
            </div>
        </div>
    );
};

export default PwaTab;
