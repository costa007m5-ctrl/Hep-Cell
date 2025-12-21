
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";
import { URL } from 'url';

function getSupabaseAdminClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Handler para configurar o banco de dados (Migrations)
async function handleSetupDatabase(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    try {
        const sql_commands = `
            ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_manufacturer INTEGER DEFAULT 12;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_store INTEGER DEFAULT 3;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS package_content TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
        `;

        // Tenta executar via RPC customizada no Supabase
        const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql_commands });

        return res.json({ 
            success: true, 
            message: "Comando de sincronização enviado!",
            details: rpcError ? "Verifique as colunas manualmente se o erro persistir: " + rpcError.message : "Estrutura atualizada."
        });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro ao processar setup: " + e.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    // Roteamento de comandos especiais
    if (path.includes('/setup-database')) return await handleSetupDatabase(req, res);

    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
        if (path.includes('/profiles')) {
            const { data } = await supabase.from('profiles').select('*').order('first_name');
            return res.json(data || []);
        }
        if (path.includes('/invoices')) {
            const { data } = await supabase.from('invoices').select('*').order('due_date', { ascending: false });
            return res.json(data || []);
        }
        if (path.includes('/products')) {
            const { data } = await supabase.from('products').select('*').order('name');
            return res.json(data || []);
        }
        if (path.includes('/settings')) {
            const { data } = await supabase.from('system_settings').select('*');
            const settings = data?.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});
            return res.json(settings || {});
        }
    }

    if (req.method === 'POST') {
        if (path.includes('/products')) {
            const product = req.body;
            const { id, created_at, ...data } = product;
            
            // Sanitização de dados numéricos
            const sanitizedData = {
                ...data,
                price: Number(data.price) || 0,
                cost_price: Number(data.cost_price) || 0,
                stock: Number(data.stock) || 0,
                weight: Number(data.weight) || 0,
                height: Number(data.height) || 0,
                width: Number(data.width) || 0,
                length: Number(data.length) || 0
            };

            let query;
            if (id && id !== "" && id !== "null") {
                query = supabase.from('products').update(sanitizedData).eq('id', id);
            } else {
                query = supabase.from('products').insert(sanitizedData);
            }

            const { error, data: resultData } = await query.select();
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, data: resultData });
        }
    }

    return res.status(404).json({ error: 'Endpoint não encontrado: ' + path });
}
