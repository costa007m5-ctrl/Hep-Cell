
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

// --- HANDLERS ---

async function handleChat(req: VercelRequest, res: VercelResponse) {
    const { message, context } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const systemInstruction = context || "Você é o assistente virtual da Relp Cell. Responda de forma curta, útil e amigável.";
        
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: message,
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 300,
            }
        });

        return res.json({ reply: response.text || "Desculpe, não entendi." });
    } catch (error: any) {
        console.error("Chat Error:", error);
        return res.status(500).json({ error: "Erro no processamento da IA." });
    }
}

async function handleUpdateOrderStatus(req: VercelRequest, res: VercelResponse) {
    const { orderId, status } = req.body;
    const supabase = getSupabaseAdmin();

    try {
        const { error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId);

        if (error) throw error;

        // Notificar usuário (opcional, mas recomendado)
        // Logica de notificação aqui...

        return res.json({ success: true });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const { 
        userId, productName, totalAmount, installments, signature, 
        saleType, paymentMethod, downPayment, dueDay, address, 
        coinsUsed, discountValue 
    } = req.body;

    try {
        // 1. Processar Uso de Coins (Desconto)
        if (coinsUsed > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            if (!profile || profile.coins_balance < coinsUsed) {
                throw new Error("Saldo de Relp Coins insuficiente.");
            }
            // Deduzir coins
            await supabase.from('profiles').update({ 
                coins_balance: profile.coins_balance - coinsUsed 
            }).eq('id', userId);
        }

        // 2. Criar Contrato (Se houver assinatura - Crediário)
        let contractId = null;
        if (signature) {
            // Gerar texto do contrato robusto para armazenamento
            const contractText = `CONTRATO DE COMPRA E VENDA - RELP CELL\n\n` +
                `CLIENTE: ${userId}\nPRODUTO: ${productName}\n` +
                `VALOR TOTAL: R$ ${totalAmount}\n` +
                `FORMA DE PAGAMENTO: ${saleType === 'crediario' ? 'CREDIÁRIO PRÓPRIO' : 'À VISTA'}\n` +
                `PARCELAS: ${installments}x\n` +
                `ENTREGA EM: ${address.street}, ${address.number} - ${address.neighborhood}\n\n` +
                `Declaro estar ciente das taxas de juros e multas por atraso descritas nos Termos de Uso.`;

            const { data: contract, error: contractError } = await supabase.from('contracts').insert({
                user_id: userId,
                title: `Contrato - ${productName}`,
                items: contractText,
                total_value: totalAmount,
                status: 'Assinado',
                signature_data: signature,
                terms_accepted: true
            }).select('id').single();

            if (contractError) throw contractError;
            contractId = contract.id;
        }

        // 3. Gerar Faturas
        const invoices = [];
        const today = new Date();

        // Fatura de Entrada
        if (downPayment > 0) {
            invoices.push({
                user_id: userId,
                month: `Entrada - ${productName}`,
                due_date: today.toISOString().split('T')[0],
                amount: downPayment,
                status: 'Em aberto',
                notes: `ENTRADA|${contractId || 'Direta'}|${totalAmount - downPayment}|${installments}|${dueDay}` 
            });
        }

        // Parcelas ou Valor Integral
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

        // 4. Registrar Pedido (Status inicial: Em Preparação)
        await supabase.from('orders').insert({
            user_id: userId,
            status: 'processing', // 'processing' -> 'preparing' -> 'shipped' -> 'delivered'
            total: totalAmount,
            payment_method: saleType === 'direct' ? paymentMethod : 'crediario',
            address_snapshot: address,
            items_snapshot: [{ name: productName, price: totalAmount }] // Simplificado
        });

        // 5. Acumular Relp Coins (1% do valor da compra)
        // Regra: Ganha 1% sobre o valor total da compra imediatamente (ou pode ser após pagamento)
        // Aqui aplicamos imediatamente para incentivar
        const coinsEarned = Math.floor(totalAmount * 0.01 * 100); // 1% em centavos/pontos (100 pts = R$ 1)
        if (coinsEarned > 0) {
            const { data: profile } = await supabase.from('profiles').select('coins_balance').eq('id', userId).single();
            const currentBalance = profile?.coins_balance || 0;
            
            // Re-lê o saldo pois pode ter mudado no passo 1 (race condition mitigation simples)
            await supabase.from('profiles').update({ 
                coins_balance: currentBalance + coinsEarned 
            }).eq('id', userId);
        }

        return res.json({ success: true, paymentData: { type: saleType, invoicesCreated: invoices.length, coinsEarned } });

    } catch (error: any) {
        console.error("Erro ao criar venda:", error);
        return res.status(500).json({ error: error.message || "Erro ao processar venda." });
    }
}

async function handleAutoFillProduct(req: VercelRequest, res: VercelResponse) {
    // ... (Mantido igual) ...
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

// ... (handleSetupDatabase mantido igual) ...
async function handleSetupDatabase(res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    const sql = `
        CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, price NUMERIC, created_at TIMESTAMPTZ DEFAULT now());
        CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, status TEXT, total NUMERIC, payment_method TEXT, address_snapshot JSONB, items_snapshot JSONB, created_at TIMESTAMPTZ DEFAULT now());
        CREATE TABLE IF NOT EXISTS invoices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, month TEXT, due_date DATE, amount NUMERIC, status TEXT, notes TEXT, payment_date TIMESTAMPTZ, payment_id TEXT, boleto_url TEXT, boleto_barcode TEXT, created_at TIMESTAMPTZ DEFAULT now());
        CREATE TABLE IF NOT EXISTS contracts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, items TEXT, total_value NUMERIC, status TEXT, signature_data TEXT, terms_accepted BOOLEAN, created_at TIMESTAMPTZ DEFAULT now());
        -- Garantir colunas
        ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
        -- Adicionar colunas faltantes em orders se necessário
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_snapshot JSONB;
    `;
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) throw error;
        return res.json({ success: true, message: "Banco de dados sincronizado!" });
    } catch (e: any) { 
        return res.status(500).json({ error: e.message }); 
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const path = req.url || '';
    const supabase = getSupabaseAdmin();
    
    const action = req.query.action || '';
    const isRoute = (route: string) => path.includes(route) || action === route.replace('/', '');

    try {
        if (isRoute('/test-supabase')) {
            const { error } = await supabase.from('profiles').select('id').limit(1);
            return res.json({ success: !error, message: error ? error.message : "Conectado" });
        }
        if (isRoute('/chat')) return await handleChat(req, res); // Novo Endpoint Chat
        if (isRoute('/setup-database')) return await handleSetupDatabase(res);
        if (isRoute('/auto-fill-product')) return await handleAutoFillProduct(req, res);
        if (isRoute('/create-sale')) return await handleCreateSale(req, res);
        if (isRoute('/update-order')) return await handleUpdateOrderStatus(req, res); // Novo Endpoint Admin Order

        // ... (GET/POST products mantidos) ...
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

        // Fallback para admin fetchs genéricos (usado em alguns componentes)
        if (isRoute('/profiles')) {
             const { data } = await supabase.from('profiles').select('*');
             return res.json(data);
        }
        if (isRoute('/invoices')) {
             const { data } = await supabase.from('invoices').select('*');
             return res.json(data);
        }

        return res.status(404).json({ error: 'Endpoint não encontrado', path, action });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
