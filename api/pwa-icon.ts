
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { type } = req.query;

    if (!type || typeof type !== 'string') {
        return res.status(400).send('Missing type parameter');
    }

    try {
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', type)
            .single();

        if (!data || !data.value) {
            return res.status(404).send('Icon not found');
        }

        // O valor salvo deve ser "data:image/png;base64,..."
        // Removemos o prefixo para pegar o buffer real
        const matches = data.value.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (!matches || matches.length !== 3) {
            return res.status(500).send('Invalid image data');
        }
        
        const imgBuffer = Buffer.from(matches[2], 'base64');

        res.setHeader('Content-Type', 'image/png');
        // Cache longo (1 dia) pois a URL muda se o manifesto mudar, ou o SW gerencia
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
        res.send(imgBuffer);

    } catch (e: any) {
        console.error(e);
        res.status(500).send('Internal Server Error');
    }
}
