
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

const DeveloperTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    
    const SETUP_SQL = `
-- Tabela de Avaliações de Produtos
CREATE TABLE IF NOT EXISTS "public"."product_reviews" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "product_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_name" "text" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text" NOT NULL,
    "reply" "text",
    "status" "text" DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE
);
ALTER TABLE "public"."product_reviews" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view approved reviews" ON "public"."product_reviews";
CREATE POLICY "Public view approved reviews" ON "public"."product_reviews" FOR SELECT USING (status = 'approved');
DROP POLICY IF EXISTS "Users create reviews" ON "public"."product_reviews";
CREATE POLICY "Users create reviews" ON "public"."product_reviews" FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Restante do SQL omitido para brevidade no diff, mas deve ser mantido no código real.
    `.trim();

    const handleSetupDatabase = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const response = await fetch('/api/admin/setup-database', { method: 'POST' });
            if (!response.ok) throw new Error('Falha no setup.');
            setMessage({ text: 'Banco atualizado! Verifique as tabelas de reviews.', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' });
        } finally { setIsLoading(false); }
    };

    return (
        <div className="p-4 space-y-6">
            <h2 className="text-2xl font-bold">Developer Tools</h2>
            <button onClick={handleSetupDatabase} disabled={isLoading} className="py-3 px-6 bg-indigo-600 text-white rounded-lg font-bold">
                {isLoading ? <LoadingSpinner /> : 'Atualizar Tabelas (SQL)'}
            </button>
            {message && <Alert message={message.text} type={message.type} />}
            <div className="mt-8 p-4 bg-slate-900 text-white rounded-xl overflow-x-auto text-xs font-mono">
                <pre>{SETUP_SQL}</pre>
            </div>
        </div>
    );
};

export default DeveloperTab;
