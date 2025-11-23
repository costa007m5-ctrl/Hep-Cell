
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface ManifestIcon {
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
}

interface ManifestScreenshot {
    src: string;
    sizes: string;
    type: string;
    form_factor?: string;
    label?: string;
}

interface Manifest {
    name: string;
    short_name: string;
    description: string;
    start_url: string;
    display: string;
    background_color: string;
    theme_color: string;
    icons: ManifestIcon[];
    screenshots: ManifestScreenshot[];
    shortcuts?: any[];
    categories?: string[];
}

// Ícone SVG Oficial (Atualizado com o design final)
const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="relpGradient" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#4f46e5" /><stop offset="100%" stop-color="#7c3aed" /></linearGradient><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter><style>@keyframes signal-pulse {0% { stroke-opacity: 0.2; stroke-width: 6; }50% { stroke-opacity: 1; stroke-width: 8; }100% { stroke-opacity: 0.2; stroke-width: 6; }}.signal-wave-1 {animation: signal-pulse 1.5s infinite ease-in-out;}.signal-wave-2 {animation: signal-pulse 1.5s infinite ease-in-out 0.4s;}</style></defs><rect x="40" y="20" width="120" height="160" rx="25" fill="url(#relpGradient)" filter="url(#glow)" /><rect x="55" y="45" width="90" height="70" rx="8" fill="white" fill-opacity="0.15" /><path d="M75 135 V 65 H 105 C 125 65, 125 85, 105 85 H 75 M 105 85 L 125 135" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" /><path class="signal-wave-1" d="M135 40 A 20 20 0 0 1 155 60" stroke="#4ade80" stroke-width="6" stroke-linecap="round" fill="none" /><path class="signal-wave-2" d="M145 30 A 35 35 0 0 1 170 65" stroke="#4ade80" stroke-width="6" stroke-linecap="round" fill="none" /><circle cx="100" cy="155" r="6" fill="white" fill-opacity="0.8" /></svg>`;

const PwaTab: React.FC = () => {
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [swStatus, setSwStatus] = useState<{ active: boolean; state: string }>({ active: false, state: 'unknown' });
    const [isHttps, setIsHttps] = useState(false);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);

    useEffect(() => {
        const checkPwaHealth = async () => {
            setLoading(true);
            try {
                // 1. Check HTTPS
                setIsHttps(window.location.protocol === 'https:');

                // 2. Fetch Manifest
                const response = await fetch('/manifest.json');
                if (!response.ok) throw new Error('Não foi possível carregar o manifest.json');
                const data = await response.json();
                setManifest(data);

                // 3. Check Service Worker
                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration && registration.active) {
                        setSwStatus({ active: true, state: registration.active.state });
                    } else {
                        setSwStatus({ active: false, state: 'not_found' });
                    }
                } else {
                    setSwStatus({ active: false, state: 'unsupported' });
                }

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        checkPwaHealth();
    }, []);

    // Funções de Download
    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadSVG = () => {
        const blob = new Blob([APP_ICON_SVG], { type: 'image/svg+xml;charset=utf-8' });
        downloadBlob(blob, 'logo.svg');
    };

    const handleDownloadPNG = async (size: number) => {
        setIsDownloading(`${size}px`);
        try {
            const img = new Image();
            const svgBlob = new Blob([APP_ICON_SVG], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, size, size);
                    canvas.toBlob((blob) => {
                        if (blob) downloadBlob(blob, `icon-${size}.png`);
                        URL.revokeObjectURL(url);
                        setIsDownloading(null);
                    }, 'image/png');
                }
            };
            img.src = url;
        } catch (e) {
            console.error(e);
            setIsDownloading(null);
        }
    };

    const StatusBadge: React.FC<{ label: string; success: boolean; errorText?: string }> = ({ label, success, errorText }) => (
        <div className={`flex items-center justify-between p-3 rounded-lg border ${success ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
            <div className="flex items-center gap-3">
                <div className={`p-1 rounded-full ${success ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
                    {success ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    )}
                </div>
                <div>
                    <p className={`text-sm font-bold ${success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>{label}</p>
                    {!success && errorText && <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{errorText}</p>}
                </div>
            </div>
        </div>
    );

    if (loading) return <div className="flex justify-center p-10"><LoadingSpinner /></div>;
    if (error) return <div className="p-4"><Alert message={error} type="error" /></div>;

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Auditoria PWA & Ativos</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Verifique a saúde do seu PWA e baixe os ícones oficiais atualizados.
                    </p>
                </div>
                <a 
                    href="https://www.pwabuilder.com" 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                    Testar no PWABuilder
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Coluna 1: Downloads */}
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">Downloads de Ativos</h3>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center">
                        <div className="w-32 h-32 mb-4 drop-shadow-xl" dangerouslySetInnerHTML={{ __html: APP_ICON_SVG }} />
                        <p className="text-sm font-bold text-slate-700 dark:text-white mb-4">Ícone Oficial Relp Cell</p>
                        
                        <div className="w-full space-y-2">
                            <button onClick={handleDownloadSVG} className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Baixar Vetor (logo.svg)
                            </button>
                            <button onClick={() => handleDownloadPNG(512)} disabled={!!isDownloading} className="w-full py-2 px-4 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 transition-colors flex items-center justify-center gap-2">
                                {isDownloading === '512px' ? <LoadingSpinner /> : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Baixar PNG (icon-512.png)
                                    </>
                                )}
                            </button>
                            <button onClick={() => handleDownloadPNG(192)} disabled={!!isDownloading} className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-2">
                                {isDownloading === '192px' ? <LoadingSpinner /> : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Baixar PNG (icon-192.png)
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 text-center">
                            Para corrigir erros de validação de ícones PNG no navegador, baixe os arquivos acima e substitua-os na pasta <code>public/</code> do projeto.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-3">
                        <StatusBadge 
                            label="Arquivo Manifest" 
                            success={!!manifest} 
                            errorText="O arquivo manifest.json não foi encontrado na raiz." 
                        />
                        <StatusBadge 
                            label="Service Worker" 
                            success={swStatus.active} 
                            errorText={`Estado atual: ${swStatus.state}. Necessário para funcionar offline.`}
                        />
                        <StatusBadge 
                            label="Protocolo Seguro (HTTPS)" 
                            success={isHttps} 
                            errorText="PWAs exigem certificado SSL (https://) para funcionar."
                        />
                    </div>
                </div>

                {/* Coluna 2 e 3: Visualização */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Screenshots Gallery */}
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-4">Screenshots Detectados</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {manifest?.screenshots?.map((screen, idx) => (
                                <div key={idx} className="group relative bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                    <img src={screen.src} alt={screen.label} className="w-full h-auto object-cover" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs">
                                        <p className="font-bold">{screen.form_factor || 'desktop'}</p>
                                        <p className="opacity-80">{screen.sizes}</p>
                                    </div>
                                </div>
                            ))}
                            {(!manifest?.screenshots || manifest.screenshots.length === 0) && (
                                <div className="col-span-3 text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                                    Nenhum screenshot definido no manifesto.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Raw JSON Viewer */}
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-4">Manifest JSON Raw</h3>
                        <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-700">
                            <pre className="text-xs font-mono text-green-400">
                                {JSON.stringify(manifest, null, 2)}
                            </pre>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PwaTab;
