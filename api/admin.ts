
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
                // A nota guarda info para gerar o resto automaticamente se for via webhook
            });
        }

        // Parcelas do Crediário (Geradas imediatamente se não tiver entrada ou se já for contrato assinado)
        // Se for venda direta (à vista), gera uma única fatura cheia se não tiver entrada
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
                    // Ajusta para o dia de vencimento escolhido, ou dia atual se inválido
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
    // SQL Completo para garantir que TODAS as colunas existam
    const sql = `
        CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, price NUMERIC, created_at TIMESTAMPTZ DEFAULT now());
        
        -- Colunas de Identificação
        ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS model TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'novo';
        
        -- Descrição e Mídia
        ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS description_short TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS highlights TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS secondary_images TEXT[];
        ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT;
        
        -- Especificações Técnicas
        ALTER TABLE products ADD COLUMN IF NOT EXISTS processor TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS ram TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS storage TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS display TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS os TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS camera TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS battery TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS connectivity TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS ports TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS voltage TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;
        
        -- Financeiro e Estoque
        ALTER TABLE products ADD COLUMN IF NOT EXISTS promotional_price NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS max_installments INTEGER DEFAULT 12;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS pix_discount_percent NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 2;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'pronta_entrega';
        
        -- Logística
        ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS product_class TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_lead_time INTEGER;
        
        -- Garantia e Legal
        ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_manufacturer INTEGER DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_store INTEGER DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS certifications TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS package_content TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS legal_info TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS exchange_policy TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS internal_notes TEXT;
        
        -- Visibilidade
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_highlight BOOLEAN DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN DEFAULT FALSE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT TRUE;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_reviews BOOLEAN DEFAULT TRUE;
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados sincronizado com sucesso!" });
    } catch (e: any) { 
        return res.status(500).json({ error: e.message }); 
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();

    try {
        if (path.includes('/test-supabase')) {
            const { error } = await supabase.from('profiles').select('id').limit(1);
            return res.json({ success: !error, message: error ? error.message : "Conectado" });
        }
        if (path.includes('/test-gemini')) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'ping' });
            return res.json({ success: true, message: "IA Ativa" });
        }
        if (path.includes('/setup-database')) return await handleSetupDatabase(res);
        if (path.includes('/auto-fill-product')) return await handleAutoFillProduct(req, res);
        if (path.includes('/create-sale')) return await handleCreateSale(req, res);

        if (req.method === 'GET' && path.includes('/products')) {
            const { data } = await supabase.from('products').select('*').order('name');
            return res.json(data || []);
        }

        if (req.method === 'POST' && path.includes('/products')) {
            const { id, created_at, ...payload } = req.body;
            
            // Força tipos corretos para o banco
            const sanitized = {
                ...payload,
                price: Number(payload.price || 0),
                promotional_price: Number(payload.promotional_price || 0),
                cost_price: Number(payload.cost_price || 0),
                stock: Number(payload.stock || 0),
                min_stock_alert: Number(payload.min_stock_alert || 0),
                weight: Number(payload.weight || 0),
                height: Number(payload.height || 0),
                width: Number(payload.width || 0),
                length: Number(payload.length || 0),
                warranty_manufacturer: Number(payload.warranty_manufacturer || 0),
                warranty_store: Number(payload.warranty_store || 0),
                max_installments: Number(payload.max_installments || 12),
                pix_discount_percent: Number(payload.pix_discount_percent || 0)
            };

            const query = (id && id !== "null") 
                ? supabase.from('products').update(sanitized).eq('id', id)
                : supabase.from('products').insert(sanitized);

            const { error } = await query;
            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(404).json({ error: 'Endpoint não encontrado' });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
