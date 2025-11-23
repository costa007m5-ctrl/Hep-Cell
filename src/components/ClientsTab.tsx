
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Invoice, Profile, Contract } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Modal from './Modal';
import InputField from './InputField';

// Tipos Estendidos
interface EnhancedProfile extends Profile {
    ltv: number;
    totalDebt: number;
    lastPurchaseDate: string | null;
    invoiceCount: number;
    riskLevel: 'Baixo' | 'Médio' | 'Alto';
    utilizationRate: number;
    isBlocked: boolean;
    ticketAverage: number;
    riskFactors: string[];
    tags?: string[];
    internalNotes?: string;
}

interface DocumentItem extends Contract {
    isManual?: boolean;
}

// --- Componentes de UI ---

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; count?: number }> = ({ active, onClick, children, count }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            active 
            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20' 
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
    >
        {children}
        {count !== undefined && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                {count}
            </span>
        )}
    </button>
);

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; colorClass?: string; disabled?: boolean }> = ({ icon, label, onClick, colorClass = "bg-slate-100 text-slate-600", disabled }) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-col items-center justify-center p-3 rounded-xl gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md ${colorClass}`}
    >
        <div className="text-xl">{icon}</div>
        <span className="text-xs font-bold">{label}</span>
    </button>
);

// --- Modal de Negociação Avançada ---
const NegotiationModal: React.FC<{ 
    invoices: Invoice[]; 
    onClose: () => void; 
    onConfirm: (config: any) => void; 
    isLoading: boolean;
}> = ({ invoices, onClose, onConfirm, isLoading }) => {
    const [installments, setInstallments] = useState(1);
    const [interestRate, setInterestRate] = useState(5); // Default 5%
    const [preview, setPreview] = useState<any[]>([]);

    const totalOriginal = invoices.reduce((acc, i) => acc + i.amount, 0);
    
    // Cálculo simples de juros compostos para renegociação
    const totalWithInterest = useMemo(() => {
        if (installments === 1) return totalOriginal;
        const rate = interestRate / 100;
        return totalOriginal * Math.pow(1 + rate, 1); // Juros simples sobre o total para simplificar UX, ou composto por mês
        // Vamos usar juros simples sobre o montante total para a negociação padrão
        return totalOriginal * (1 + (interestRate / 100)); 
    }, [totalOriginal, interestRate, installments]);

    const installmentValue = totalWithInterest / installments;

    useEffect(() => {
        const sched = [];
        const date = new Date();
        for(let i=1; i<=installments; i++) {
            date.setMonth(date.getMonth() + 1);
            sched.push({
                num: i,
                date: date.toLocaleDateString(),
                val: installmentValue
            });
        }
        setPreview(sched);
    }, [installments, installmentValue]);

    return (
        <div className="space-y-5">
            <div className="text-center border-b border-slate-100 dark:border-slate-700 pb-4">
                <h3 className="font-bold text-xl text-slate-900 dark:text-white">Nova Negociação</h3>
                <p className="text-sm text-slate-500">{invoices.length} faturas selecionadas</p>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">Dívida Original</p>
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-300">R$ {totalOriginal.toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">Novo Total</p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">R$ {totalWithInterest.toFixed(2)}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Parcelas</label>
                    <select 
                        value={installments} 
                        onChange={e => setInstallments(Number(e.target.value))}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600 text-sm"
                    >
                        {[1,2,3,4,5,6,10,12].map(n => <option key={n} value={n}>{n}x</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Juros (%)</label>
                    <input 
                        type="number" 
                        value={interestRate} 
                        onChange={e => setInterestRate(Number(e.target.value))}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600 text-sm"
                    />
                </div>
            </div>

            <div className="max-h-32 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-lg p-2 text-xs">
                <p className="font-bold mb-2 sticky top-0 bg-white dark:bg-slate-800 pb-1">Previsão de Parcelas:</p>
                {preview.map(p => (
                    <div key={p.num} className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                        <span>{p.num}ª - {p.date}</span>
                        <span className="font-mono font-bold">R$ {p.val.toFixed(2)}</span>
                    </div>
                ))}
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Atenção:</strong> Ao confirmar, será gerado um contrato jurídico. O cliente receberá um alerta no app e deverá assinar digitalmente para validar o acordo.
            </div>

            <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 text-sm">Cancelar</button>
                <button 
                    onClick={() => onConfirm({ totalAmount: totalWithInterest, installments, interestRate })}
                    disabled={isLoading}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700"
                >
                    {isLoading ? 'Processando...' : 'Gerar Proposta'}
                </button>
            </div>
        </div>
    );
};

const RiskFactorsModal: React.FC<{ factors: string[]; score: number; level: string; onClose: () => void }> = ({ factors, score, level, onClose }) => (
    <div className="space-y-4">
        <div className={`p-4 rounded-xl border-l-4 ${level === 'Alto' ? 'bg-red-50 border-red-500 text-red-800' : level === 'Médio' ? 'bg-amber-50 border-amber-500 text-amber-800' : 'bg-emerald-50 border-emerald-500 text-emerald-800'}`}>
            <h3 className="font-bold text-lg">Risco {level} (Score: {score})</h3>
            <p className="text-sm opacity-90">Análise baseada no comportamento de pagamento e perfil.</p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <h4 className="px-4 py-2 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">Fatores Identificados</h4>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {factors.length > 0 ? factors.map((factor, i) => (
                    <li key={i} className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">⚠️</span>
                        {factor}
                    </li>
                )) : (
                    <li className="px-4 py-3 text-sm text-slate-500 italic">Nenhum fator de risco crítico identificado.</li>
                )}
            </ul>
        </div>
        
        <button onClick={onClose} className="w-full py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold">Fechar</button>
    </div>
);

// --- Drawer Tabs Content ---

const OverviewContent: React.FC<{ client: EnhancedProfile }> = ({ client }) => (
    <div className="space-y-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Ticket Médio</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">R$ {client.ticketAverage.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 uppercase font-bold">LTV (Total Gasto)</p>
                <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">R$ {client.ltv.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 uppercase font-bold">Limite Disponível</p>
                <p className="text-xl font-black text-green-600 dark:text-green-400">
                    R$ {Math.max(0, (client.credit_limit || 0) - client.totalDebt).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 uppercase font-bold">Dívida Atual</p>
                <p className="text-xl font-black text-red-600 dark:text-red-400">R$ {client.totalDebt.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
        </div>

        {/* Tags */}
        <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Tags do Cliente</h4>
            <div className="flex flex-wrap gap-2">
                {client.tags && client.tags.length > 0 ? client.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                        {tag}
                    </span>
                )) : (
                    <span className="text-xs text-slate-400">Nenhuma tag atribuída.</span>
                )}
                <button className="px-2 py-1 rounded-md border border-dashed border-slate-300 text-slate-400 text-xs hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                    + Adicionar
                </button>
            </div>
        </div>
    </div>
);

const DocumentsContent: React.FC<{ userId: string; documents: DocumentItem[]; onUpload: () => void }> = ({ userId, documents, onUpload }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploading(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64 = reader.result as string;
                    await fetch('/api/admin/upload-document', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, title: file.name, base64 })
                    });
                    onUpload(); // Refresh parent
                } catch (err) {
                    alert("Erro no upload");
                } finally {
                    setUploading(false);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900 dark:text-white">Arquivos do Cliente</h3>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                >
                    {uploading ? <LoadingSpinner /> : (
                        <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Upload Manual
                        </>
                    )}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,.pdf" />
            </div>

            {documents.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <p className="text-slate-400 text-sm">Nenhum documento encontrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-2">
                    {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${doc.status === 'Assinado' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{doc.title}</p>
                                    <p className="text-xs text-slate-500">{new Date(doc.created_at).toLocaleDateString()} • {doc.status}</p>
                                </div>
                            </div>
                            <button className="text-indigo-600 text-xs font-bold hover:underline">Ver</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ToolsContent: React.FC<{ client: EnhancedProfile; onUpdate: () => void }> = ({ client, onUpdate }) => {
    const [notes, setNotes] = useState(client.internalNotes || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveNotes = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/admin/manage-profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: client.id, internal_notes: notes })
            });
            onUpdate();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleBlockToggle = async () => {
        if (!confirm(`Deseja ${client.isBlocked ? 'desbloquear' : 'bloquear'} este cliente?`)) return;
        try {
            await fetch('/api/admin/manage-profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: client.id, credit_status: client.isBlocked ? 'Ativo' : 'Bloqueado' })
            });
            onUpdate();
        } catch (e) { console.error(e); }
    };

    const handleResetPassword = async () => {
        if (!confirm("Enviar email de redefinição de senha para o cliente?")) return;
        try {
            await fetch('/api/admin/manage-profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: client.id, resetPassword: true })
            });
            alert("Email enviado!");
        } catch (e) { console.error(e); }
    };

    const openWhatsapp = () => {
        const phone = client.phone?.replace(/\D/g, '');
        if (phone) window.open(`https://wa.me/55${phone}`, '_blank');
        else alert("Telefone não cadastrado.");
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Ações Rápidas Grid */}
            <div className="grid grid-cols-3 gap-3">
                <ActionButton 
                    label="WhatsApp" 
                    icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>}
                    onClick={openWhatsapp}
                    colorClass="bg-green-100 text-green-700"
                />
                <ActionButton 
                    label={client.isBlocked ? 'Desbloquear' : 'Bloquear'} 
                    icon={client.isBlocked ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                    onClick={handleBlockToggle}
                    colorClass={client.isBlocked ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
                />
                <ActionButton 
                    label="Reset Senha" 
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>}
                    onClick={handleResetPassword}
                    colorClass="bg-orange-100 text-orange-700"
                />
            </div>

            {/* Anotações Internas */}
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Anotações Internas (Privado)
                </label>
                <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={4}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Escreva observações sobre o cliente aqui..."
                />
                <div className="flex justify-end mt-2">
                    <button 
                        onClick={handleSaveNotes}
                        disabled={isSaving || notes === client.internalNotes}
                        className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-lg disabled:opacity-50"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar Nota'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- ClientsTab Principal ---

const ClientsTab: React.FC = () => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);
    
    // UI State
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [drawerTab, setDrawerTab] = useState<'overview' | 'invoices' | 'docs' | 'tools'>('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [showRiskModal, setShowRiskModal] = useState(false);
    const [invoiceActionLoading, setInvoiceActionLoading] = useState<string | null>(null);
    
    // Bulk Selection & Negotiation
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [showNegotiationModal, setShowNegotiationModal] = useState(false);
    const [isNegotiating, setIsNegotiating] = useState(false);

    // Dados para modais
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    
    // Carregamento
    const fetchData = useCallback(async () => {
        try {
            const [profRes, invRes] = await Promise.all([
                fetch('/api/admin/profiles'),
                fetch('/api/admin/invoices')
            ]);
            
            if (profRes.ok) setProfiles(await profRes.json());
            if (invRes.ok) setInvoices(await invRes.json());
        } catch (e) {
            console.error(e);
        } finally {
            setIsDataLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        // Reset selection when client changes
        setSelectedInvoiceIds(new Set());
    }, [selectedClientId]);

    // Processamento de Perfis
    const enhancedProfiles: EnhancedProfile[] = useMemo(() => {
        return profiles.map(profile => {
            const userInvoices = invoices.filter(inv => inv.user_id === profile.id);
            const paidInvoices = userInvoices.filter(i => i.status === 'Paga');
            const openInvoices = userInvoices.filter(i => i.status === 'Em aberto' || i.status === 'Boleto Gerado');
            
            const totalPaid = paidInvoices.reduce((acc, i) => acc + i.amount, 0);
            const totalDebt = openInvoices.reduce((acc, i) => acc + i.amount, 0);
            const ticketAvg = paidInvoices.length > 0 ? totalPaid / paidInvoices.length : 0;
            
            const limit = profile.credit_limit || 1;
            const utilization = (totalDebt / limit) * 100;
            
            const riskFactors = [];
            if (openInvoices.some(i => new Date(i.due_date) < new Date())) riskFactors.push("Faturas em atraso");
            if (utilization > 90) riskFactors.push("Uso de limite acima de 90%");
            if ((profile.credit_score || 0) < 400) riskFactors.push("Score de crédito baixo");
            if (profile.credit_status === 'Bloqueado') riskFactors.push("Cliente bloqueado manualmente");

            let riskLevel: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
            if (riskFactors.length >= 2 || riskFactors.includes("Faturas em atraso")) riskLevel = 'Alto';
            else if (riskFactors.length === 1) riskLevel = 'Médio';

            return {
                ...profile,
                ltv: totalPaid,
                totalDebt,
                lastPurchaseDate: null,
                invoiceCount: userInvoices.length,
                riskLevel,
                utilizationRate: utilization,
                isBlocked: profile.credit_status === 'Bloqueado',
                ticketAverage: ticketAvg,
                riskFactors
            };
        });
    }, [profiles, invoices]);

    const filtered = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return enhancedProfiles.filter(p => 
            p.first_name?.toLowerCase().includes(lower) || 
            p.email?.toLowerCase().includes(lower) ||
            p.identification_number?.includes(lower)
        );
    }, [enhancedProfiles, searchTerm]);

    const selectedClient = enhancedProfiles.find(p => p.id === selectedClientId);
    const clientInvoices = invoices.filter(i => i.user_id === selectedClientId);

    // Actions
    const handleInvoiceAction = async (id: string, action: 'pay' | 'cancel' | 'delete') => {
        if (!confirm(`Tem certeza?`)) return;
        setInvoiceActionLoading(id);
        try {
            const method = action === 'delete' ? 'DELETE' : 'PUT';
            const body = action === 'delete' ? { id } : { id, action };
            await fetch('/api/admin/manage-invoices', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            fetchData();
        } catch (e) { alert("Erro ao processar ação."); } 
        finally { setInvoiceActionLoading(null); }
    };

    const handleBulkDelete = async () => {
        if (selectedInvoiceIds.size === 0) return;
        if (!confirm(`Excluir ${selectedInvoiceIds.size} faturas permanentemente?`)) return;
        
        try {
            await fetch('/api/admin/manage-invoices', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedInvoiceIds) })
            });
            fetchData();
            setSelectedInvoiceIds(new Set());
        } catch (e) { alert("Erro ao excluir."); }
    };

    const handleNegotiation = async (config: { totalAmount: number, installments: number, interestRate: number }) => {
        setIsNegotiating(true);
        try {
            const firstInvoiceId = Array.from(selectedInvoiceIds)[0];
            const firstInvoice = clientInvoices.find(i => i.id === firstInvoiceId);
            const firstDueDate = firstInvoice?.due_date || new Date().toISOString();

            const res = await fetch('/api/admin/negotiate-debt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedClientId,
                    invoiceIds: Array.from(selectedInvoiceIds),
                    totalAmount: config.totalAmount,
                    installments: config.installments,
                    firstDueDate: firstDueDate,
                    interestRate: config.interestRate
                })
            });
            
            if (!res.ok) throw new Error("Falha na negociação");
            
            alert("Negociação criada! O contrato foi gerado e aguarda assinatura do cliente.");
            setShowNegotiationModal(false);
            setSelectedInvoiceIds(new Set());
            fetchData();
        } catch (e) {
            alert("Erro ao criar negociação.");
        } finally {
            setIsNegotiating(false);
        }
    };

    const toggleSelectInvoice = (id: string) => {
        const newSet = new Set(selectedInvoiceIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedInvoiceIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedInvoiceIds.size === clientInvoices.filter(i => i.status !== 'Paga').length) {
            setSelectedInvoiceIds(new Set());
        } else {
            const allIds = clientInvoices.filter(i => i.status !== 'Paga').map(i => i.id);
            setSelectedInvoiceIds(new Set(allIds));
        }
    };

    if (isDataLoading) return <div className="flex justify-center p-20"><LoadingSpinner /></div>;

    return (
        <div className="p-4 space-y-6 bg-slate-50 dark:bg-slate-900/50 min-h-screen">
            
            {/* Search Bar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <input 
                    type="text" 
                    placeholder="Buscar cliente por nome, CPF ou email..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>

            {/* Client List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Risco</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Dívida</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {filtered.map(client => (
                            <tr key={client.id} onClick={() => { setSelectedClientId(client.id); setDrawerTab('overview'); }} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{client.first_name} {client.last_name}</p>
                                    <p className="text-xs text-slate-500">{client.email}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${client.riskLevel === 'Alto' ? 'bg-red-100 text-red-700 border-red-200' : client.riskLevel === 'Médio' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                        {client.riskLevel}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                                    R$ {client.totalDebt.toLocaleString('pt-BR')}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-indigo-600 font-bold text-xs hover:underline">Gerenciar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Drawer */}
            {selectedClientId && selectedClient && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedClientId(null)}></div>
                    <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-right">
                        
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedClient.first_name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`w-2 h-2 rounded-full ${selectedClient.isBlocked ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                    <span className="text-xs text-slate-500">{selectedClient.isBlocked ? 'Bloqueado' : 'Ativo'} • Score: {selectedClient.credit_score}</span>
                                    <button onClick={() => setShowRiskModal(true)} className="ml-2 text-[10px] font-bold text-red-500 border border-red-200 bg-red-50 px-1.5 rounded hover:bg-red-100">
                                        Ver Risco
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => setSelectedClientId(null)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300">✕</button>
                        </div>

                        {/* Drawer Tabs */}
                        <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 overflow-x-auto">
                            <TabButton active={drawerTab === 'overview'} onClick={() => setDrawerTab('overview')}>Resumo</TabButton>
                            <TabButton active={drawerTab === 'invoices'} onClick={() => setDrawerTab('invoices')} count={clientInvoices.filter(i=>i.status==='Em aberto').length}>Faturas</TabButton>
                            <TabButton active={drawerTab === 'docs'} onClick={() => setDrawerTab('docs')}>Documentos</TabButton>
                            <TabButton active={drawerTab === 'tools'} onClick={() => setDrawerTab('tools')}>Ferramentas</TabButton>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900">
                            {drawerTab === 'overview' && <OverviewContent client={selectedClient} />}
                            
                            {drawerTab === 'invoices' && (
                                <div className="space-y-3 relative pb-20">
                                    <div className="flex justify-between items-center mb-2 px-1">
                                        <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                            <input type="checkbox" checked={selectedInvoiceIds.size > 0 && selectedInvoiceIds.size === clientInvoices.filter(i => i.status !== 'Paga').length} onChange={toggleSelectAll} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                            Selecionar Todos
                                        </label>
                                        <span className="text-xs text-slate-400">{selectedInvoiceIds.size} selecionados</span>
                                    </div>

                                    {clientInvoices.map(inv => (
                                        <div key={inv.id} className={`p-4 border rounded-xl flex flex-col gap-3 transition-colors ${selectedInvoiceIds.has(inv.id) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30'}`}>
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    {inv.status !== 'Paga' && (
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedInvoiceIds.has(inv.id)} 
                                                            onChange={() => toggleSelectInvoice(inv.id)}
                                                            className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                                                        />
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-900 dark:text-white text-sm">{inv.month}</p>
                                                        <p className="text-xs text-slate-500">Vence: {new Date(inv.due_date).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-slate-900 dark:text-white">R$ {inv.amount.toFixed(2)}</p>
                                                    <span className={`text-[10px] font-bold uppercase ${inv.status === 'Paga' ? 'text-green-600' : inv.status === 'Aguardando Assinatura' ? 'text-yellow-600' : 'text-red-600'}`}>{inv.status}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Action Buttons Row */}
                                            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 pl-7">
                                                <button onClick={() => setViewInvoice(inv)} className="flex-1 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded">
                                                    Detalhes
                                                </button>
                                                {inv.status !== 'Paga' && inv.status !== 'Aguardando Assinatura' && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleInvoiceAction(inv.id, 'pay')}
                                                            disabled={!!invoiceActionLoading}
                                                            className="flex-1 py-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 rounded"
                                                        >
                                                            Pagar
                                                        </button>
                                                        <button 
                                                            onClick={() => handleInvoiceAction(inv.id, 'delete')}
                                                            disabled={!!invoiceActionLoading}
                                                            className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded"
                                                        >
                                                            Excluir
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Action Bar Flutuante */}
                                    {selectedInvoiceIds.size > 0 && (
                                        <div className="absolute bottom-4 left-0 right-0 mx-4 bg-slate-800 text-white p-3 rounded-xl shadow-xl flex items-center justify-between animate-fade-in-up z-10">
                                            <span className="text-xs font-bold pl-2">{selectedInvoiceIds.size} Selecionados</span>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={handleBulkDelete}
                                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
                                                >
                                                    Excluir Tudo
                                                </button>
                                                <button 
                                                    onClick={() => setShowNegotiationModal(true)}
                                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
                                                >
                                                    Negociar Dívida
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {drawerTab === 'docs' && (
                                <DocumentsContent 
                                    userId={selectedClient.id} 
                                    documents={documents} 
                                    onUpload={() => fetchData()} 
                                />
                            )}

                            {drawerTab === 'tools' && (
                                <ToolsContent client={selectedClient} onUpdate={fetchData} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showRiskModal && selectedClient && (
                <Modal isOpen={true} onClose={() => setShowRiskModal(false)}>
                    <RiskFactorsModal 
                        factors={selectedClient.riskFactors} 
                        score={selectedClient.credit_score || 0} 
                        level={selectedClient.riskLevel}
                        onClose={() => setShowRiskModal(false)} 
                    />
                </Modal>
            )}

            {viewInvoice && (
                <Modal isOpen={true} onClose={() => setViewInvoice(null)}>
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg">Detalhes da Fatura</h3>
                        <p className="text-sm"><strong>Descrição:</strong> {viewInvoice.notes || viewInvoice.month}</p>
                        <p className="text-sm"><strong>ID:</strong> {viewInvoice.id}</p>
                        <p className="text-sm"><strong>Criado em:</strong> {new Date(viewInvoice.created_at).toLocaleString()}</p>
                        <button onClick={() => setViewInvoice(null)} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold">Fechar</button>
                    </div>
                </Modal>
            )}

            {showNegotiationModal && (
                <Modal isOpen={true} onClose={() => setShowNegotiationModal(false)}>
                    <NegotiationModal 
                        invoices={clientInvoices.filter(i => selectedInvoiceIds.has(i.id))} 
                        onClose={() => setShowNegotiationModal(false)}
                        onConfirm={handleNegotiation}
                        isLoading={isNegotiating}
                    />
                </Modal>
            )}
        </div>
    );
};

export default ClientsTab;
