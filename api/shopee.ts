import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Parâmetro ?url= é obrigatório' });
    }

    let shopid: string | undefined;
    let itemid: string | undefined;

    const mainUrlPart = url.split('?')[0];

    const matchLongFormat = mainUrlPart.match(/i\.(\d+)\.(\d+)/);
    if (matchLongFormat) {
      shopid = matchLongFormat[1];
      itemid = matchLongFormat[2];
    } else {
      const matchShortFormat = mainUrlPart.match(/product\/(\d+)\/(\d+)/);
      if (matchShortFormat) {
        shopid = matchShortFormat[1];
        itemid = matchShortFormat[2];
      }
    }

    if (!shopid || !itemid) {
      return res.status(400).json({ error: 'Link da Shopee inválido ou formato não reconhecido. Use o link completo do produto que contenha os IDs (ex: ...i.shopid.itemid).' });
    }

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

    const itemDetails = data.data;

    const getAttribute = (name: string) => {
        const attribute = itemDetails.attributes?.find((attr: any) => attr.name === name);
        return attribute?.value || null;
    }
    
    const getCategory = () => {
        if (itemDetails.categories && itemDetails.categories.length > 0) {
            // Pega a categoria mais específica (a última da lista)
            return itemDetails.categories[itemDetails.categories.length - 1].display_name;
        }
        return null;
    }

    const produto = {
      nome: itemDetails.name,
      preco: (itemDetails.price || itemDetails.price_min) / 100000,
      imagens: itemDetails.images.map(
        (id: string) => `https://down-br.img.susercontent.com/file/${id}`
      ),
      estoque: itemDetails.stock,
      link_original: url,
      brand: getAttribute('Marca'),
      model: getAttribute('Modelo'),
      color: getAttribute('Cor'),
      category: getCategory()
    };

    res.status(200).json(produto);
  } catch (e: any) {
    console.error("Internal server error in /api/shopee:", e);
    res.status(500).json({ error: e.message });
  }
}