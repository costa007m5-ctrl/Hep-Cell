
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Helper para extração segura de JSON da IA
function extractJson(text: string) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return null;
    }
}

async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "Texto base é obrigatório." });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Você é o mestre de inventário da Relp Cell. Analise: "${rawText}".
            Extraia o máximo de informações técnicas possíveis em JSON conforme a estrutura do banco.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        model: { type: Type.STRING },
                        category: { type: Type.STRING },
                        sku: { type: Type.STRING },
                        condition: { type: Type.STRING },
                        description: { type: Type.STRING },
                        processor: { type: Type.STRING },
                        ram: { type: Type.STRING },
                        storage: { type: Type.STRING },
                        display: { type: Type.STRING },
                        battery: { type: Type.STRING },
                        camera: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        weight: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        length: { type: Type.NUMBER },
                        package_content: { type: Type.STRING }
                    }
                }
            }
        });

        const data = extractJson(response.text || '{}');
        return res.json(data || { error: "IA não gerou JSON válido" });
    } catch (e: any) {
        return res.status(500).json({ error: "Erro na IA: " + e.message });
    }
}

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { userId, productName, totalAmount, installments, signature, saleType, paymentMethod, downPayment, dueDay, address } = req.body;

    try {
        // 1. Criar Contrato (Se houver assinatura)
        let contractId = null;
        if (signature) {
            const { data: contract, error: contractError } = await supabase.from('contracts').insert({
                user_id: userId,
                title: `Contrato de Compra - ${productName}`,
                items: `Aquisição de ${productName}.\nValor Total: R$ ${totalAmount}\nModalidade: ${saleType}\nEndereço de Entrega: ${address.street}, ${address.number} - ${address.neighborhood}`,
                total_value: totalAmount,
                status: 'Assinado',
                signature_data: signature,
                terms_accepted: true
            }).select('id').single();

            if (contractError) throw contractError;
            contractId = contract.id;
        }

        // 2. Gerar Faturas
        const invoices = [];
        const today = new Date();

        // Fatura de Entrada (se houver)
        if (downPayment > 0) {
            invoices.push({
                user_id: userId,
                month: `Entrada - ${productName}`,
                due_date: today.toISOString().split('T')[0], // Vence hoje
                amount: downPayment,
                status: 'Em aberto',
                notes: `ENTRADA|${contractId || 'Direta'}|${totalAmount - downPayment}|${installments}|${dueDay}` 
            });
        }

        // Parcelas do Crediário
        if (saleType === 'direct' && downPayment <= 0) {
             invoices.push({
                user_id: userId,
                month: `Compra Avulsa - ${productName}`,
                due_date: today.toISOString().split('T')[0],
                amount: totalAmount,
                status: 'Em aberto',
                notes: 'VENDA_AVISTA'
            });
        } else if (saleType === 'crediario') {
            const financedAmount = totalAmount - downPayment;
            if (financedAmount > 0) {
                const installmentValue = financedAmount / installments;
                for (let i = 1; i <= installments; i++) {
                    const dueDate = new Date();
                    dueDate.setMonth(today.getMonth() + i);
                    dueDate.setDate(dueDay || today.getDate()); 
                    
                    invoices.push({
                        user_id: userId,
                        month: `Parcela ${i}/${installments} - ${productName}`,
                        due_date: dueDate.toISOString().split('T')[0],
                        amount: installmentValue,
                        status: 'Em aberto',
                        notes: `Contrato ${contractId}`
                    });
                }
            }
        }

        const { error: invoicesError } = await supabase.from('invoices').insert(invoices);
        if (invoicesError) throw invoicesError;

        // 3. Registrar Pedido
        await supabase.from('orders').insert({
            user_id: userId,
            status: 'processing',
            total: totalAmount,
            payment_method: saleType === 'direct' ? paymentMethod : 'crediario',
            address_snapshot: address
        });

        return res.json({ success: true, paymentData: { type: saleType, invoicesCreated: invoices.length } });

    } catch (error: any) {
        console.error("Erro ao criar venda:", error);
        return res.status(500).json({ error: error.message || "Erro ao processar venda." });
    }
}

async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    // SQL Completo para garantir que TODAS as colunas e tabelas existam
    const sql = `
        CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, price NUMERIC, created_at TIMESTAMPTZ DEFAULT now());
        CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, status TEXT, total NUMERIC, payment_method TEXT, address_snapshot JSONB, created_at TIMESTAMPTZ DEFAULT now());
        CREATE TABLE IF NOT EXISTS invoices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, month TEXT, due_date DATE, amount NUMERIC, status TEXT, notes TEXT, payment_date TIMESTAMPTZ, payment_id TEXT, boleto_url TEXT, boleto_barcode TEXT, created_at TIMESTAMPTZ DEFAULT now());
        CREATE TABLE IF NOT EXISTS contracts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, items TEXT, total_value NUMERIC, status TEXT, signature_data TEXT, terms_accepted BOOLEAN, created_at TIMESTAMPTZ DEFAULT now());

        -- Colunas de Produtos (Garantia de integridade)
        ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS model TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS description_short TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS processor TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS ram TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS storage TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS promotional_price NUMERIC DEFAULT 0;
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados sincronizado (Tabelas Criadas)!" });
    } catch (e: any) { 
        return res.status(500).json({ error: e.message }); 
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();
    
    // Normaliza a ação vindo da Query ou do Path
    // Isso garante que /api/admin?action=create-sale funcione igual a /api/admin/create-sale
    const action = req.query.action || '';
    const isRoute = (route: string) => path.includes(route) || action === route.replace('/', '');

    try {
        if (isRoute('/test-supabase')) {
            const { error } = await supabase.from('profiles').select('id').limit(1);
            return res.json({ success: !error, message: error ? error.message : "Conectado" });
        }
        if (isRoute('/setup-database')) return await handleSetupDatabase(res);
        if (isRoute('/auto-fill-product')) return await handleAutoFillProduct(req, res);
        
        // Rota de criação de venda (checkout da loja)
        if (isRoute('/create-sale')) return await handleCreateSale(req, res);

        if (req.method === 'GET' && isRoute('/products')) {
            const { data } = await supabase.from('products').select('*').order('name');
            return res.json(data || []);
        }

        if (req.method === 'POST' && isRoute('/products')) {
            const { id, ...payload } = req.body;
            const query = (id && id !== "null") 
                ? supabase.from('products').update(payload).eq('id', id)
                : supabase.from('products').insert(payload);
            const { error } = await query;
            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(404).json({ error: 'Endpoint não encontrado', path, action });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
