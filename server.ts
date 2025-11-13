import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, Preference, Payment, MerchantOrder } from 'mercadopago';
import { Buffer } from 'buffer';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function getSupabaseAdminClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase environment variables are not set.');
    }
    return createClient(supabaseUrl, supabaseServiceKey);
}

function getSupabaseAnonClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase environment variables (URL and Anon Key) are not set.');
    }
    return createClient(supabaseUrl, supabaseAnonKey);
}

function getGeminiClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error('Gemini API key (API_KEY) is not set.');
    }
    return new GoogleGenAI({ apiKey });
}

function getMercadoPagoClient() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('Mercado Pago Access Token is not set.');
    }
    return new MercadoPagoConfig({ accessToken });
}

app.get('/api/config', (req: Request, res: Response) => {
    res.json({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        mercadoPagoPublicKey: process.env.MERCADO_PAGO_PUBLIC_KEY || '',
    });
});

app.get('/api/products', async (req: Request, res: Response) => {
    try {
        const supabase = getSupabaseAnonClient();
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar produtos:', error);
            if (error.message.includes('permission denied')) {
                return res.status(500).json({ error: 'Acesso negado. Verifique as políticas de segurança (RLS) da tabela de produtos.' });
            }
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json(data);
    } catch (error: any) {
        console.error('Erro inesperado no endpoint de produtos:', error);
        return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

app.get('/api/ml-item', async (req: Request, res: Response) => {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Product ID is required.' });
    }

    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error("Mercado Livre environment variables not set.");
        return res.status(500).json({ error: "Server configuration error for Mercado Livre API." });
    }

    async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
        const response = await fetch("https://api.mercadolibre.com/oauth/token", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Error fetching ML token:", errorData);
            throw new Error("Failed to authenticate with Mercado Livre.");
        }

        const data = await response.json();
        return data.access_token;
    }

    try {
        const accessToken = await getAccessToken(clientId, clientSecret);

        const [itemResponse, descriptionResponse] = await Promise.all([
            fetch(`https://api.mercadolibre.com/items/${id}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            }),
            fetch(`https://api.mercadolibre.com/items/${id}/description`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            })
        ]);

        if (!itemResponse.ok) {
            if (itemResponse.status === 404) {
                return res.status(404).json({ error: `Product with ID ${id} not found.` });
            }
            const errorData = await itemResponse.json();
            throw new Error(errorData.message || 'Failed to fetch item data from Mercado Livre.');
        }

        const itemData = await itemResponse.json();
        let description = '';
        let categoryName = 'Não informado';

        if (descriptionResponse.ok) {
            const descriptionData = await descriptionResponse.json();
            description = descriptionData.plain_text || '';
        } else {
            console.warn(`Could not fetch description for item ${id}. Status: ${descriptionResponse.status}`);
        }

        if (itemData.category_id) {
            const categoryResponse = await fetch(`https://api.mercadolibre.com/categories/${itemData.category_id}`);
            if (categoryResponse.ok) {
                const categoryData = await categoryResponse.json();
                categoryName = categoryData.name || 'Não informado';
            }
        }
        
        const getAttribute = (attrId: string) => {
            const attribute = itemData.attributes?.find((attr: any) => attr.id === attrId);
            return attribute?.value_name || null;
        }

        const finalData = {
            title: itemData.title,
            description: description,
            price: itemData.price,
            available_quantity: itemData.available_quantity,
            pictures: itemData.pictures,
            category: categoryName,
            brand: getAttribute('BRAND'),
            model: getAttribute('MODEL'),
            color: getAttribute('COLOR'),
        };

        res.status(200).json(finalData);

    } catch (error: any) {
        console.error(`Error processing request for ML item ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/shopee', async (req: Request, res: Response) => {
    try {
        const { url } = req.query;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Parâmetro ?url= é obrigatório' });
        }

        const cleanUrl = url.split('?')[0];
        const match = cleanUrl.match(/i\.(\d+)\.(\d+)/);
        if (!match) {
            return res.status(400).json({ error: 'Link da Shopee inválido. Não foi possível encontrar i.<shopid>.<itemid>' });
        }

        const shopid = match[1];
        const itemid = match[2];

        const response = await fetch(
            `https://shopee.com.br/api/v4/item/get?itemid=${itemid}&shopid=${shopid}`,
            {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            }
        );

        const data = await response.json();

        if (!data || !data.data) {
            return res.status(404).json({ error: 'Produto não encontrado na Shopee. Verifique o link.' });
        }

        const produto = {
            nome: data.data.name,
            preco: data.data.price_min / 100000,
            descricao: data.data.description,
            imagens: data.data.images?.map(
                (id: string) => `https://down-br.img.susercontent.com/file/${id}`
            ) || [],
            estoque: data.data.stock,
            link_original: url,
        };

        res.status(200).json(produto);
    } catch (e: any) {
        console.error("Error in /api/shopee:", e);
        res.status(500).json({ error: e.message });
    }
});

async function loadAdminHandlers() {
    const module = await import('./api/admin.ts');
    return module;
}

async function loadMercadoPagoHandlers() {
    const module = await import('./api/mercadopago.ts');
    return module;
}

app.use('/api/admin', async (req: Request, res: Response) => {
    try {
        const adminModule = await loadAdminHandlers();
        const fullUrl = req.originalUrl || req.url;
        const vercelReq = {
            ...req,
            url: fullUrl,
            method: req.method,
            headers: req.headers,
            body: req.body,
            query: req.query,
        } as any;
        
        const vercelRes = {
            status: (code: number) => {
                res.status(code);
                return vercelRes;
            },
            json: (data: any) => res.json(data),
            send: (data: any) => res.send(data),
            end: (data?: any) => res.end(data),
            setHeader: (name: string, value: string | string[]) => {
                res.setHeader(name, value);
                return vercelRes;
            },
        } as any;
        
        await adminModule.default(vercelReq, vercelRes);
    } catch (error: any) {
        console.error('Error in admin handler:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

app.use('/api/mercadopago', async (req: Request, res: Response) => {
    try {
        const mpModule = await loadMercadoPagoHandlers();
        const fullUrl = req.originalUrl || req.url;
        const vercelReq = {
            ...req,
            url: fullUrl,
            method: req.method,
            headers: req.headers,
            body: req.body,
            query: req.query,
        } as any;
        
        const vercelRes = {
            status: (code: number) => {
                res.status(code);
                return vercelRes;
            },
            json: (data: any) => res.json(data),
            send: (data: any) => res.send(data),
            end: (data?: any) => res.end(data),
            setHeader: (name: string, value: string | string[]) => {
                res.setHeader(name, value);
                return vercelRes;
            },
        } as any;
        
        await mpModule.default(vercelReq, vercelRes);
    } catch (error: any) {
        console.error('Error in mercadopago handler:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Express server running on http://localhost:${PORT}`);
});
