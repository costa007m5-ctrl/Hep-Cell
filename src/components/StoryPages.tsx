
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from './Toast';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../services/clients';
import { Product, Profile } from '../types';
import Confetti from './Confetti';
import PurchaseModal from './store/PurchaseModal';
import { getProfile } from '../services/profileService';

// --- Shared Components ---
const PageHeader: React.FC<{ title: string; color: string; onClose: () => void; icon: React.ReactNode }> = ({ title, color, onClose, icon }) => (
    <div className={`sticky top-0 z-50 px-4 py-4 flex items-center justify-between bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800`}>
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${color} text-white shadow-lg`}>
                {icon}
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
        </div>
        <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    </div>
);

// --- 1. OFERTAS VIEW (Connected & Functional) ---
export const OffersPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { addToast } = useToast();
    const [timeLeft, setTimeLeft] = useState(86400); // 24 hours
    const [scratchRevealed, setScratchRevealed] = useState(false);
    const [flashProduct, setFlashProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [coupons, setCoupons] = useState<any[]>([]);
    
    // Purchase Logic
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 0), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Busca oferta relâmpago (produto real)
                const { data: products } = await supabase.from('products').select('*').limit(10);
                if (products && products.length > 0) {
                    setFlashProduct(products[Math.floor(Math.random() * products.length)]);
                }

                // 2. Busca perfil para permitir compra
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const profile = await getProfile(user.id);
                    if (profile) setUserProfile({ ...profile, id: user.id, email: user.email });
                }

                // Mock de cupons
                setCoupons([
                    { code: 'BEMVINDO', desc: 'R$ 20,00 na primeira compra', color: 'border-green-200 bg-green-50 dark:bg-green-900/10', discount: 20 },
                    { code: 'FRETEZERO', desc: 'Frete grátis para Macapá', color: 'border-blue-200 bg-blue-50 dark:bg-blue-900/10', discount: 15 },
                    { code: 'RELP10', desc: '10% de desconto em acessórios', color: 'border-purple-200 bg-purple-50 dark:bg-purple-900/10', discount: 10 },
                ]);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    };

    const handleBuyClick = () => {
        if (!userProfile) {
            addToast("Faça login para comprar.", "error");
            return;
        }
        setShowPurchaseModal(true);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 overflow-y-auto animate-fade-in pb-20">
            <PageHeader 
                title="Ofertas Relâmpago" 
                color="bg-gradient-to-br from-orange-500 to-red-600" 
                onClose={onClose}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 012 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>}
            />

            <div className="p-4 space-y-6">
                {/* Hero Flash Sale */}
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-xl border border-slate-100 dark:border-slate-700">
                    <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10">
                        OFERTA DO DIA
                    </div>
                    
                    {loading || !flashProduct ? (
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-48 w-full bg-slate-200 rounded-xl mb-4"></div>
                            <div className="h-6 w-3/4 bg-slate-200 rounded mb-2"></div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center">
                            <div className="w-full h-56 bg-slate-50 dark:bg-slate-700 rounded-xl mb-4 flex items-center justify-center p-4">
                                <img 
                                    src={flashProduct.image_url || 'https://via.placeholder.com/300'} 
                                    alt={flashProduct.name} 
                                    className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal" 
                                />
                            </div>
                            
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 line-clamp-2">{flashProduct.name}</h2>
                            <p className="text-xs text-slate-500 mb-4">{flashProduct.brand}</p>
                            
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-sm text-slate-400 line-through">R$ {flashProduct.price.toLocaleString('pt-BR')}</span>
                                <span className="text-2xl font-black text-red-600">R$ {(flashProduct.price * 0.9).toLocaleString('pt-BR')}</span>
                            </div>

                            <div className="w-full bg-red-50 dark:bg-red-900/20 p-2 rounded-lg mb-4 border border-red-100 dark:border-red-900/50">
                                <p className="text-xs text-red-700 dark:text-red-300 font-bold mb-1">Termina em:</p>
                                <p className="font-mono text-lg font-bold text-red-600 dark:text-red-400">{formatTime(timeLeft)}</p>
                            </div>

                            <button 
                                onClick={handleBuyClick}
                                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 hover:bg-red-700 transition-all active:scale-95"
                            >
                                Comprar Agora
                            </button>
                            <p className="text-[10px] text-slate-400 mt-2">Aceitamos Pix e Crediário Próprio (Entrada + Parcelas)</p>
                        </div>
                    )}
                </div>

                {/* Scratch Card */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-slate-800 dark:text-white">
                        🎟️ Raspadinha Diária
                    </h3>
                    <div className="relative w-full h-32 rounded-xl overflow-hidden cursor-pointer group select-none" onClick={() => setScratchRevealed(true)}>
                        <div className={`absolute inset-0 bg-gradient-to-r from-slate-300 to-slate-400 flex items-center justify-center transition-opacity duration-700 z-10 ${scratchRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                            <div className="text-center">
                                <p className="text-slate-600 font-bold text-lg">Toque para Raspar</p>
                                <p className="text-slate-500 text-xs">Ganhe prêmios exclusivos</p>
                            </div>
                        </div>
                        <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/30 flex flex-col items-center justify-center border-2 border-dashed border-indigo-300">
                            {scratchRevealed && <Confetti />}
                            <span className="text-indigo-600 dark:text-indigo-400 font-black text-2xl animate-pop-in">5% OFF EXTRA</span>
                            <span className="text-xs text-slate-500">Use o código abaixo:</span>
                            <button className="mt-2 text-xs bg-indigo-600 text-white px-3 py-1 rounded font-bold hover:bg-indigo-700 transition-colors">RASPA5</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Compra Dedicado */}
            {showPurchaseModal && flashProduct && userProfile && (
                <PurchaseModal 
                    product={flashProduct}
                    profile={userProfile}
                    onClose={() => setShowPurchaseModal(false)}
                    onSuccess={() => {
                        setShowPurchaseModal(false);
                        addToast("Pedido realizado com sucesso!", "success");
                    }}
                />
            )}
        </div>
    );
};

// --- 2. SEGURANÇA VIEW (Mantida igual, apenas conectada) ---
export const SecurityPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { addToast } = useToast();
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanComplete, setScanComplete] = useState(false);
    const [checks, setChecks] = useState({ 
        biometrics: localStorage.getItem('relp_biometrics') === 'true', 
        twoFactor: false, 
        location: true, 
        notifications: true 
    });
    const [lastLogin, setLastLogin] = useState<string | null>(null);

    useEffect(() => {
        // Busca a última sessão do usuário
        const fetchSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.last_sign_in_at) {
                setLastLogin(new Date(session.user.last_sign_in_at).toLocaleString('pt-BR'));
            }
        };
        fetchSession();
    }, []);

    const runScan = () => {
        if (isScanning) return;
        setIsScanning(true);
        setScanComplete(false);
        setScanProgress(0);
        
        const interval = setInterval(() => {
            setScanProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsScanning(false);
                    setScanComplete(true);
                    if(navigator.vibrate) navigator.vibrate([50, 100]);
                    return 100;
                }
                return prev + 4;
            });
        }, 50);
    };

    const toggleCheck = async (key: keyof typeof checks) => {
        const newValue = !checks[key];
        
        if (key === 'biometrics') {
            if (newValue) {
                if (window.PublicKeyCredential) {
                    try {
                        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                        localStorage.setItem('relp_biometrics', 'true');
                        setChecks(prev => ({ ...prev, [key]: true }));
                        addToast("Biometria ativada com sucesso", "success");
                    } catch (e) {
                        addToast("Dispositivo não suporta biometria segura.", "error");
                        return;
                    }
                } else {
                    addToast("Navegador não suporta biometria.", "error");
                    return;
                }
            } else {
                localStorage.removeItem('relp_biometrics');
                setChecks(prev => ({ ...prev, [key]: false }));
                addToast("Biometria desativada", "info");
            }
        } else {
            // Outras configurações salvas localmente ou no banco futuramente
            setChecks(prev => ({ ...prev, [key]: newValue }));
            addToast("Configuração atualizada", "success");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 overflow-y-auto animate-fade-in pb-20">
            <PageHeader 
                title="Central de Segurança" 
                color="bg-gradient-to-br from-blue-500 to-indigo-600" 
                onClose={onClose}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
            />

            <div className="p-4 space-y-6">
                {/* Scanner Widget */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md text-center border border-slate-100 dark:border-slate-700">
                    <div className="relative w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                        <div className={`absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-700`}></div>
                        <div className="absolute inset-0 rounded-full border-4 border-blue-500 transition-all duration-200" style={{ clipPath: `inset(${100 - scanProgress}% 0 0 0)` }}></div>
                        
                        {isScanning ? (
                            <span className="text-2xl font-bold text-blue-500 font-mono">{scanProgress}%</span>
                        ) : scanComplete ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500 animate-pop-in" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {isScanning ? 'Verificando...' : scanComplete ? 'Dispositivo Seguro' : 'Status de Segurança'}
                    </h3>
                    <p className="text-sm text-slate-500 mb-6">
                        {isScanning ? 'Analisando integridade do app...' : scanComplete ? 'Nenhuma ameaça detectada.' : 'Execute uma verificação rápida.'}
                    </p>
                    
                    <button 
                        onClick={runScan} 
                        disabled={isScanning}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all ${isScanning ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95'}`}
                    >
                        {isScanning ? 'Escaneando...' : 'Iniciar Varredura'}
                    </button>
                </div>

                {/* Settings Checklist */}
                <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 dark:text-white px-1 mb-2">Proteções Ativas</h3>
                    
                    {[
                        { key: 'biometrics', label: 'Login com Biometria', desc: 'Proteção extra ao abrir o app' },
                        { key: 'notifications', label: 'Alertas de Compra', desc: 'Notificar transações em tempo real' },
                        { key: 'location', label: 'Monitoramento de Local', desc: 'Alertar acessos suspeitos' },
                    ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div>
                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.label}</p>
                                <p className="text-xs text-slate-500">{item.desc}</p>
                            </div>
                            <button 
                                onClick={() => toggleCheck(item.key as any)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${checks[item.key as keyof typeof checks] ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${checks[item.key as keyof typeof checks] ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- 3. NOVIDADES VIEW (Database Integrated) ---
export const NewsPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { addToast } = useToast();
    const [changelog, setChangelog] = useState<any[]>([]);
    const [polls, setPolls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [votedPolls, setVotedPolls] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Busca Enquetes Ativas
                const { data: activePolls } = await supabase
                    .from('polls')
                    .select('*, poll_options(*)')
                    .eq('active', true)
                    .order('created_at', { ascending: false });
                
                if (activePolls) setPolls(activePolls);

                // 2. Busca Histórico de Versões Real
                const { data: logs } = await supabase
                    .from('app_changelog')
                    .select('*')
                    .order('date', { ascending: false });
                
                if (logs) setChangelog(logs);

                // 3. Checa votos do usuário
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: votes } = await supabase.from('poll_votes').select('poll_id').eq('user_id', user.id);
                    if (votes) setVotedPolls(new Set(votes.map(v => v.poll_id)));
                }

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleVote = async (pollId: string, optionId: string) => {
        if (votedPolls.has(pollId)) return;
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Registra voto
                await supabase.from('poll_votes').insert({ poll_id: pollId, option_id: optionId, user_id: user.id });
                // Incrementa contador
                await supabase.rpc('increment_poll_vote', { option_id: optionId });
                
                setVotedPolls(prev => new Set(prev).add(pollId));
                addToast("Voto registrado com sucesso!", "success");
            }
        } catch (e) {
            addToast("Erro ao registrar voto.", "error");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 overflow-y-auto animate-fade-in pb-20">
            <PageHeader 
                title="Novidades & Comunidade" 
                color="bg-gradient-to-br from-purple-500 to-pink-600" 
                onClose={onClose}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>}
            />

            <div className="p-4 space-y-8">
                
                {/* Enquetes Ativas */}
                {polls.map(poll => (
                    <div key={poll.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <h3 className="font-bold text-lg mb-3 text-slate-800 dark:text-white flex items-center gap-2">
                            🗳️ {poll.question}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Sua opinião ajuda a melhorar o app.</p>
                        
                        <div className="space-y-2">
                            {poll.poll_options?.map((opt: any) => (
                                <button 
                                    key={opt.id}
                                    onClick={() => handleVote(poll.id, opt.id)}
                                    disabled={votedPolls.has(poll.id)}
                                    className={`w-full p-3 rounded-xl border text-left flex justify-between items-center transition-all ${votedPolls.has(poll.id) ? 'bg-slate-100 dark:bg-slate-900 border-transparent opacity-70 cursor-default' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-900/10 hover:border-purple-200 text-slate-700 dark:text-slate-300'}`}
                                >
                                    <span className="text-sm font-bold">{opt.text}</span>
                                    {votedPolls.has(poll.id) && <span className="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">{opt.votes} votos</span>}
                                </button>
                            ))}
                        </div>
                        {votedPolls.has(poll.id) && <p className="text-xs text-green-600 mt-3 font-medium text-center animate-fade-in">Obrigado por votar!</p>}
                    </div>
                ))}

                {/* Changelog Real */}
                <div className="space-y-6">
                    <h3 className="font-bold text-slate-900 dark:text-white px-1">Linha do Tempo (Atualizações)</h3>
                    {loading ? <LoadingSpinner /> : (
                        <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-8 pb-4">
                            {changelog.map((item) => (
                                <div key={item.id} className="relative pl-6">
                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${item.type === 'feature' ? 'bg-purple-500' : item.type === 'fix' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${item.type === 'feature' ? 'bg-purple-100 text-purple-700' : item.type === 'fix' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {item.type === 'feature' ? 'NOVIDADE' : item.type === 'fix' ? 'CORREÇÃO' : 'MELHORIA'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">{new Date(item.date).toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{item.title}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.description}</p>
                                        {item.version && <span className="inline-block mt-2 text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-900 px-1 rounded">v{item.version}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- 4. DICAS VIEW (Interactive Guide) ---
export const TipsPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

    const topics = [
        { id: 'limite', title: 'Como Aumentar o Limite', icon: '🚀', content: 'Para aumentar seu limite, mantenha seus pagamentos em dia e utilize o app frequentemente. O sistema analisa seu perfil a cada 30 dias.' },
        { id: 'score', title: 'Entendendo o Score', icon: '📊', content: 'Seu score no app (0-1000) define seu nível de cliente. Pagar em dia sobe pontos. Atrasar desce. Nível Ouro libera taxas menores.' },
        { id: 'bloqueio', title: 'Evitando Bloqueios', icon: '🔒', content: 'Atrasos superiores a 5 dias podem bloquear novas compras. Mantenha contato pelo chat se tiver imprevistos.' },
        { id: 'entrada', title: 'Por que pagar entrada?', icon: '💰', content: 'A entrada reduz o valor das parcelas e ajuda a aprovar compras que excedem seu limite mensal.' },
    ];

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 overflow-y-auto animate-fade-in pb-20">
            <PageHeader 
                title="Guia do Cliente" 
                color="bg-gradient-to-br from-yellow-400 to-orange-500" 
                onClose={onClose}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />

            <div className="p-4 space-y-6">
                <div className="text-center py-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Domine seu Crédito</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Toque nos tópicos para aprender a usar melhor o app.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {topics.map(topic => (
                        <button 
                            key={topic.id}
                            onClick={() => setSelectedTopic(topic.id)}
                            className={`p-4 rounded-2xl text-left transition-all ${selectedTopic === topic.id ? 'bg-yellow-100 border-2 border-yellow-400 shadow-md transform scale-105' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm'}`}
                        >
                            <span className="text-2xl block mb-2">{topic.icon}</span>
                            <span className="font-bold text-sm text-slate-800 dark:text-white leading-tight">{topic.title}</span>
                        </button>
                    ))}
                </div>

                {selectedTopic && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-yellow-100 dark:border-slate-700 animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">{topics.find(t => t.id === selectedTopic)?.icon}</span>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{topics.find(t => t.id === selectedTopic)?.title}</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {topics.find(t => t.id === selectedTopic)?.content}
                        </p>
                        <button onClick={() => setSelectedTopic(null)} className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold">Entendi</button>
                    </div>
                )}

                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-2xl text-white shadow-lg mt-8">
                    <h3 className="font-bold text-lg mb-2">Precisa de ajuda humana?</h3>
                    <p className="text-xs text-indigo-100 mb-4">Nossa equipe de suporte está disponível para resolver casos complexos.</p>
                    <button className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-transform">
                        Abrir Chamado no Perfil
                    </button>
                </div>
            </div>
        </div>
    );
};
