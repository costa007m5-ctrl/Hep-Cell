
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Parâmetro ?url= é obrigatório' });
    }

    // Extrai itemid e shopid do link da Shopee
    const match = url.match(/i\.(\d+)\.(\d+)/);
    if (!match) {
      return res.status(400).json({ error: 'Link da Shopee inválido ou não contém os IDs necessários (i.shopid.itemid).' });
    }

    const shopid = match[1];
    const itemid = match[2];

    // Faz requisição à API pública da Shopee
    const response = await fetch(
      `https://shopee.com.br/api/v4/item/get?itemid=${itemid}&shopid=${shopid}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
          'Accept': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!data || data.error || !data.data) {
      console.error("Shopee API Error:", data?.error_msg || data);
      return res.status(404).json({ error: 'Produto não encontrado na Shopee. Verifique o link.' });
    }

    // Retorna informações principais do produto
    const produto = {
      nome: data.data.name,
      // O preço pode ser um range (price_min, price_max) ou um valor fixo (price). Usamos price como prioridade.
      preco: (data.data.price || data.data.price_min) / 100000,
      imagens: data.data.images.map(
        (id: string) => `https://down-br.img.susercontent.com/file/${id}`
      ),
      estoque: data.data.stock,
      link_original: url,
    };

    res.status(200).json(produto);
  } catch (e: any) {
    console.error("Internal server error in /api/shopee:", e);
    res.status(500).json({ error: e.message });
  }
}
