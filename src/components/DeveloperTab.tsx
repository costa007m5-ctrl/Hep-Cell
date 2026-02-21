import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import { useToast } from './Toast';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [sqlQuery, setSqlQuery] = useState('');
    const { addToast } = useToast();
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const REPAIR_SQL = `-- ESTRUTURA COMPLETA RELP CELL
-- 1. Tabelas Base
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    status TEXT DEFAULT 'processing',
    total NUMERIC DEFAULT 0,
    payment_method TEXT,
    tracking_notes TEXT,
    items_snapshot JSONB DEFAULT '[]'::jsonb,
    address_snapshot JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Sistema de Moedas (Relp Coins)
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'credit' ou 'debit'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Atualização de Perfis (Indicações)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins_balance INTEGER DEFAULT 0;

-- 4. Configurações e Banners
CREATE TABLE IF NOT EXISTS public.system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.banners (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), image_url TEXT NOT NULL, prompt TEXT, subtitle TEXT, link TEXT, position TEXT DEFAULT 'hero', active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());

-- 5. RLS e Permissões
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coin_transactions' AND policyname = 'Users can see own transactions') THEN
        CREATE POLICY "Users can see own transactions" ON public.coin_transactions FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;
`;

    const handleAutoRepair = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/execute-sql', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: REPAIR_SQL })
            });
            if (res.ok) setMessage({ text: 'Banco de dados atualizado com sucesso!', type: 'success' });
            else throw new Error("Falha na execução automática.");
        } catch (e: any) {
            setMessage({ text: e.message, type: 'error' });
        } finally { setIsLoading(false); }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <header>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic">Engenharia Relp Cell</h2>
                <p className="text-slate-500 text-sm">Manutenção de tabelas e estrutura.</p>
            </header>

            {message && <Alert message={message.text} type={message.type} />}

            <section className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-indigo-100 shadow-xl">
                <h3 className="text-xl font-black mb-4 uppercase">Reparo de Estrutura</h3>
                <p className="text-xs text-slate-500 mb-6">Clique abaixo para criar as tabelas de Moedas e Indicações automaticamente.</p>
                <button 
                    onClick={handleAutoRepair} disabled={isLoading}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
                >
                    {isLoading ? <LoadingSpinner /> : 'EXECUTAR REPARO COMPLETO'}
                </button>
            </section>
        </div>
    );
};

export default DeveloperTab;