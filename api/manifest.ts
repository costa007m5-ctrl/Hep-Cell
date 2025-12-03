import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(_req: VercelRequest, res: VercelResponse) {
    try {
        // Tenta buscar ícones personalizados
        const { data: settings } = await supabase
            .from('system_settings')
            .select('*')
            .in('key', ['pwa_icon_192', 'pwa_icon_512', 'pwa_icon_192_maskable', 'pwa_icon_512_maskable']);

        const config = settings?.reduce((acc: any, item: any) => {
            acc[item.key] = item.value; // Base64 está salvo aqui
            return acc;
        }, {}) || {};

        // Helper para gerar URL
        const getIconUrl = (key: string, fallback: string) => {
            // Se existir configuração no banco, usa a API de ícone. Senão, usa o fallback local.
            return config[key] ? `/api/pwa-icon?type=${key}` : fallback;
        };

        const manifest = {
            "name": "Relp Cell Pagamentos",
            "short_name": "Relp Cell",
            "start_url": "/",
            "description": "Gerencie suas faturas, compras e pagamentos na Relp Cell com facilidade e segurança.",
            "id": "relp-cell-pagamentos-v1",
            "display": "standalone",
            "display_override": ["window-controls-overlay", "minimal-ui"],
            "background_color": "#f8fafc",
            "theme_color": "#4f46e5",
            "orientation": "portrait-primary",
            "scope": "/",
            "lang": "pt-BR",
            "dir": "ltr",
            "categories": ["finance", "shopping", "productivity"],
            "icons": [
                {
                    "src": getIconUrl('pwa_icon_192', '/icons/icon-192.png'),
                    "sizes": "192x192",
                    "type": "image/png",
                    "purpose": "any"
                },
                {
                    "src": getIconUrl('pwa_icon_512', '/icons/icon-512.png'),
                    "sizes": "512x512",
                    "type": "image/png",
                    "purpose": "any"
                },
                {
                    "src": getIconUrl('pwa_icon_192_maskable', '/icons/icon-192-maskable.png'),
                    "sizes": "192x192",
                    "type": "image/png",
                    "purpose": "maskable"
                },
                {
                    "src": getIconUrl('pwa_icon_512_maskable', '/icons/icon-512-maskable.png'),
                    "sizes": "512x512",
                    "type": "image/png",
                    "purpose": "maskable"
                }
            ],
            "screenshots": [
                {
                  "src": "https://placehold.co/750x1334/4f46e5/ffffff.png?text=Inicio+Relp+Cell",
                  "sizes": "750x1334",
                  "type": "image/png",
                  "form_factor": "narrow",
                  "label": "Tela Inicial e Limites"
                },
                {
                  "src": "https://placehold.co/1280x800/4f46e5/ffffff.png?text=Relp+Cell+Desktop",
                  "sizes": "1280x800",
                  "type": "image/png",
                  "form_factor": "wide",
                  "label": "Versão Desktop"
                }
            ],
            "shortcuts": [
                {
                  "name": "Minhas Faturas",
                  "short_name": "Faturas",
                  "description": "Visualize e pague suas faturas pendentes",
                  "url": "/?tab=faturas",
                  "icons": [
                    {
                      "src": getIconUrl('pwa_icon_192', '/icons/icon-192.png'),
                      "sizes": "192x192",
                      "type": "image/png"
                    }
                  ]
                }
            ]
        };

        res.setHeader('Content-Type', 'application/json');
        // Cache curto para permitir atualizações rápidas se o admin mudar o ícone
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
        res.status(200).json(manifest);

    } catch (e: any) {
        console.error("Erro ao gerar manifesto:", e);
        res.status(500).json({ error: e.message });
    }
}