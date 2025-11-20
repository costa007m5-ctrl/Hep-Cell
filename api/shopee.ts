import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Parâmetro ?url= é obrigatório' });
    }

    // Limpa parâmetros extras (?sp_atk, ?xptdk, etc)
    const cleanUrl = url.split('?')[0];

    // Regex atualizado para suportar:
    // 1. shopee.com.br/product/SHOPID/ITEMID
    // 2. shopee.com.br/Nome-do-Produto-i.SHOPID.ITEMID
    let shopid, itemid;
    
    const matchI = cleanUrl.match(/i\.(\d+)\.(\d+)/); // Formato padrão i.SHOPID.ITEMID
    const matchProduct = cleanUrl.match(/product\/(\d+)\/(\d+)/); // Formato /product/SHOPID/ITEMID

    if (matchI) {
        shopid = matchI[1];
        itemid = matchI[2];
    } else if (matchProduct) {
        shopid = matchProduct[1];
        itemid = matchProduct[2];
    } else {
      return res.status(400).json({ error: 'Formato de link da Shopee não reconhecido. Tente usar o link completo do navegador.' });
    }

    // Faz requisição à API pública da Shopee com Headers simulando navegador
    const response = await fetch(
      `https://shopee.com.br/api/v4/item/get?itemid=${itemid}&shopid=${shopid}`,
      {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://shopee.com.br/',
            'Accept': 'application/json'
        },
      }
    );

    const data = await response.json();

    if (!data || !data.data) {
      return res.status(404).json({ error: 'Produto não encontrado na Shopee ou bloqueado pela API.' });
    }

    // Retorna dados principais
    const produto = {
      nome: data.data.name,
      // Preço na Shopee vem multiplicado por 100000
      preco: data.data.price_min ? data.data.price_min / 100000 : 0,
      descricao: data.data.description,
      imagens: data.data.images?.map(
        (id: string) => `https://down-br.img.susercontent.com/file/${id}`
      ) || [],
      estoque: data.data.stock,
      marca: data.data.brand,
      link_original: url,
    };

    res.status(200).json(produto);
  } catch (e: any) {
    console.error("Error in /api/shopee:", e);
    res.status(500).json({ error: 'Erro ao processar link da Shopee. Tente novamente ou preencha manualmente.' });
  }
}