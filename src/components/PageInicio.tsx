import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getProfile } from '../services/profileService';
import { supabase } from '../services/clients';
import { CardSkeleton } from './Skeleton'; 
import ScoreHistoryView from './ScoreHistoryView';
import LimitInfoView from './LimitInfoView';
import Modal from './Modal';
import { Profile, Invoice, Tab, Contract } from '../types';
import SignaturePad from './SignaturePad';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from './Toast';
import { OffersPage, SecurityPage, NewsPage, TipsPage } from './StoryPages';
import UserPollsView from './UserPollsView';

interface PageInicioProps {
    setActiveTab: (tab: Tab) => void;
}

// --- WIDGET DE STATUS DE ENTREGA ---
const DeliveryTrackingWidget: React.FC<{ order: any, onClick: () => void }> = ({ order, onClick }) => {
    const steps = [
        { id: 'processing', label: 'Aprovado' },
        { id: 'preparing', label: 'Preparando' },
        { id: 'shipped', label: 'Enviado' },
        { id: 'out_for_delivery', label: 'Saiu p/ Entrega' },
        { id: 'delivered', label: 'Entregue' }
    ];
    const currentStepIndex = steps.findIndex(s => s.id === order.status);
    const progress = Math.max(5, (currentStepIndex / (steps.length - 1)) * 100);
    return (
        <div onClick={onClick} className="mx-2 mt-4 bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-lg border border-indigo-100 dark:border-slate-700 relative overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform">
            <div className="flex justify-between items-center mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl text-white shadow-md ${order.status === 'delivered' ? 'bg-green-500' : 'bg-indigo-600'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{order.status === 'delivered' ? 'Pedido Entregue!' : 'Acompanhar Entrega'}</h3>
                        <p className="text-xs text-slate-500">Toque para ver detalhes</p>
                    </div>
                </div>
                <div className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-600'}`}>{steps[currentStepIndex]?.label || 'Processando'}</div>
            </div>
            <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full mb-3 overflow-hidden"><div className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div></div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 flex items-start gap-2"><span className="text-sm">ℹ️</span><p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-tight">{order.tracking_notes || "Aguardando atualização..."}</p></div>
        </div>
    );
};

const PageInicio: React.FC<PageInicioProps> = ({ setActiveTab }) => {
  const [profileData, setProfileData] = useState<Profile & { coins_balance?: number } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null); 
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'score' | 'limit' | 'sign_contract' | null>(null);
  const [activeStory, setActiveStory] = useState<'ofertas' | 'seguranca' | 'novidades' | 'dicas' | null>(null); 
  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const { addToast } = useToast();

  const stories = [
      { id: 'ofertas', img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=150&h=150&fit=crop', label: 'Ofertas' },
      { id: 'seguranca', img: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?w=150&h=150&fit=crop', label: 'Segurança' },
      { id: 'novidades', img: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=150&h=150&fit=crop', label: 'Novidades' },
      { id: 'dicas', img: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=150&h=150&fit=crop', label: 'Dicas' },
  ];

  const fetchHomeData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [profile, invoicesData, contractsData, ordersData] = await Promise.all([
          getProfile(user.id),
          supabase.from('invoices').select('*').eq('user_id', user.id),
          supabase.from('contracts').select('*').eq('user_id', user.id).eq('status', 'pending_signature').limit(1),
          supabase.from('orders').select('*').eq('user_id', user.id).neq('status', 'cancelled').order('created_at', {ascending: false}).limit(1)
        ]);
        setProfileData({ id: user.id, email: user.email, ...profile });
        setInvoices(invoicesData.data || []);
        if (ordersData.data && ordersData.data.length > 0) setActiveOrder(ordersData.data[0]);
        if (contractsData.data && contractsData.data.length > 0) setPendingContract(contractsData.data[0]);
      }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchHomeData(); }, [fetchHomeData]);
  
  const handleSignContract = async () => {
      if (!signature || !pendingContract) return;
      setIsSigning(true);
      try {
          await supabase.from('contracts').update({ status: 'Assinado', signature_data: signature, terms_accepted: true }).eq('id', pendingContract.id);
          await supabase.from('invoices').update({ status: 'Em aberto' }).eq('user_id', pendingContract.user_id).eq('status', 'Aguardando Assinatura');
          addToast("Contrato assinado!", "success");
          setPendingContract(null); setIsModalOpen(false); fetchHomeData();
      } catch (e) { addToast("Erro ao assinar.", "error"); } finally { setIsSigning(false); }
  };

  const { maxMonthlyCommitment } = useMemo(() => {
      const monthlyCommitments: Record<string, number> = {};
      invoices.filter(i => i.status === 'Em aberto' || i.status === 'Boleto Gerado').forEach(inv => {
          const dueMonth = inv.due_date.substring(0, 7); 
          monthlyCommitments[dueMonth] = (monthlyCommitments[dueMonth] || 0) + inv.amount;
      });
      return { maxMonthlyCommitment: Math.max(0, ...Object.values(monthlyCommitments)) };
  }, [invoices]);

  const creditLimit = profileData?.credit_limit || 0;
  const availableLimit = Math.max(0, creditLimit - maxMonthlyCommitment);
  const limitUsedPercent = creditLimit > 0 ? ((creditLimit - availableLimit) / creditLimit) * 100 : 0;
  const overdueCount = invoices.filter(i => i.status === 'Em aberto' && new Date(i.due_date) < new Date()).length;

  if (isLoading) return <div className="w-full max-w-md space-y-6 p-4 pt-10"><CardSkeleton /></div>;

  return (
    <>
      <div className="w-full max-w-md space-y-6 animate-fade-in pb-6 relative">
        <div className="flex justify-between items-center px-2 pt-4">
            <div className="flex items-center gap-3">
                <div onClick={() => setActiveTab(Tab.PERFIL)} className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-indigo-500 to-purple-500 cursor-pointer">
                    {profileData?.avatar_url ? <img src={profileData.avatar_url} className="w-full h-full object-cover rounded-full" /> : <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-50 dark:border-slate-900"><span className="text-indigo-600 font-bold text-lg">{profileData?.first_name?.[0] || 'U'}</span></div>}
                </div>
                <div>
                    <p className="text-sm text-slate-500 font-medium leading-none mb-1">Olá, {profileData?.first_name || 'Cliente'}</p>
                    <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 mt-1 rounded-full w-fit"><span className="w-4 h-4 rounded-full bg-yellow-400 text-yellow-900 flex items-center justify-center text-[8px] font-bold">RC</span><span className="text-xs font-bold text-yellow-800 dark:text-yellow-200">{profileData?.coins_balance || 0} Coins</span></div>
                </div>
            </div>
            <button onClick={() => setShowValues(!showValues)} className="p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700">{showValues ? '👁️' : '🙈'}</button>
        </div>

        {activeOrder && <DeliveryTrackingWidget order={activeOrder} onClick={() => setActiveTab(Tab.PERFIL)} />}
        
        {overdueCount > 0 && (
            <div className="mx-4 p-4 bg-red-100 dark:bg-red-900/40 border-l-4 border-red-600 rounded-r-xl shadow-md flex flex-col gap-2">
                <h3 className="font-bold text-red-900 dark:text-white">Faturas em Atraso</h3>
                <button onClick={() => setActiveTab(Tab.FATURAS)} className="w-full py-2 bg-red-600 text-white font-bold rounded-lg text-sm">Pagar Agora</button>
            </div>
        )}

        <div className="flex gap-3 overflow-x-auto px-2 pb-2 scrollbar-hide">
            {stories.map(story => (
                <button key={story.id} onClick={() => setActiveStory(story.id as any)} className="flex flex-col items-center space-y-1 min-w-[72px] group">
                    <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600"><div className="p-[2px] bg-slate-50 dark:bg-slate-900 rounded-full"><img src={story.img} className="w-14 h-14 rounded-full object-cover" /></div></div>
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">{story.label}</span>
                </button>
            ))}
        </div>
        
        <div className="relative mx-2 h-52 bg-slate-900 rounded-3xl p-6 text-white shadow-xl overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full opacity-20 blur-3xl -mr-20 -mt-20"></div>
             <div className="relative z-10 flex flex-col h-full justify-between">
                <div><p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Margem Disponível</p><h3 className="text-3xl font-bold tracking-tight">{showValues ? availableLimit.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : 'R$ ••••'}</h3></div>
                <div className="space-y-3">
                     <div className="flex justify-between text-sm"><span className="text-slate-300">Limite de Parcela</span><span className="font-semibold">{showValues ? creditLimit.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : 'R$ ••••'}</span></div>
                     <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${limitUsedPercent > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${limitUsedPercent}%` }}></div></div>
                </div>
             </div>
        </div>

        {/* WIDGET DE ENQUETE */}
        {profileData && <UserPollsView userId={profileData.id} />}

        <div className="grid grid-cols-2 gap-3 px-2">
             <button onClick={() => setActiveTab(Tab.FATURAS)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-indigo-600 text-white shadow-lg w-full active:scale-95 transition-all"><span className="text-xs font-bold">Pagar Fatura</span></button>
             <button onClick={() => setActiveTab(Tab.LOJA)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 shadow-sm w-full active:scale-95 transition-all"><span className="text-xs font-bold">Ir para Loja</span></button>
        </div>

      </div>

      {activeStory === 'ofertas' && <OffersPage onClose={() => setActiveStory(null)} />}
      {activeStory === 'seguranca' && <SecurityPage onClose={() => setActiveStory(null)} />}
      {activeStory === 'novidades' && <NewsPage onClose={() => setActiveStory(null)} />}
      {activeStory === 'dicas' && <TipsPage onClose={() => setActiveStory(null)} />}
      
      {modalView === 'sign_contract' && isModalOpen && pendingContract && (
          <Modal isOpen={true} onClose={() => setIsModalOpen(false)}>
              <div className="space-y-4">
                  <h3 className="text-xl font-bold">Assinatura Digital</h3>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs max-h-60 overflow-y-auto border whitespace-pre-wrap font-mono">{pendingContract.items}</div>
                  <SignaturePad onEnd={setSignature} />
                  <button onClick={handleSignContract} disabled={!signature || isSigning} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">{isSigning ? <LoadingSpinner /> : 'Confirmar Assinatura'}</button>
              </div>
          </Modal>
      )}
      
      {modalView === 'score' && isModalOpen && <ScoreHistoryView currentScore={profileData?.credit_score ?? 0} onClose={() => setIsModalOpen(false)} onNavigate={(tab: Tab) => { setIsModalOpen(false); setActiveTab(tab); }} />}
      {modalView === 'limit' && isModalOpen && profileData && <LimitInfoView profile={profileData} onClose={() => setIsModalOpen(false)} />}
    </>
  );
};

export default PageInicio;