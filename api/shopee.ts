import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Parâmetro ?url= é obrigatório' });
    }

    // Limpa parâmetros extras (?sp_atk, ?xptdk, etc)
    const cleanUrl = url.split('?')[0];

    // Extrai shopid e itemid
    const match = cleanUrl.match(/i\.(\d+)\.(\d+)/);
    if (!match) {
      return res.status(400).json({ error: 'Link da Shopee inválido. Não foi possível encontrar i.<shopid>.<itemid>' });
    }

    const shopid = match[1];
    const itemid = match[2];

    // Faz requisição à API pública da Shopee
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

    const itemDetails = data.data;

    // Retorna dados principais
    const produto = {
      nome: itemDetails.name,
      preco: (itemDetails.price_min || itemDetails.price || 0) / 100000,
      descricao: itemDetails.description,
      imagens: itemDetails.images?.map(
        (id: string) => `https://down-br.img.susercontent.com/file/${id}`
      ) || [],
      estoque: itemDetails.stock,
      link_original: url,
    };

    res.status(200).json(produto);
  } catch (e: any) {
    console.error("Error in /api/shopee:", e);
    res.status(500).json({ error: e.message });
  }
}
