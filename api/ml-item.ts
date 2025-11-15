import type { VercelRequest, VercelResponse } from '@vercel/node';

// This function fetches an access token from Mercado Livre API.
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


export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

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

    try {
        const accessToken = await getAccessToken(clientId, clientSecret);

        // Fetch item details, description, and category in parallel
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
        
        // Helper function to extract attribute value
        const getAttribute = (attrId: string) => {
            const attribute = itemData.attributes?.find((attr: any) => attr.id === attrId);
            return attribute?.value_name || null;
        }

        const finalData = {
            title: itemData.title,
            description: description,
            price: itemData.price,
            available_quantity: itemData.available_quantity,
            pictures: itemData.pictures, // Return all pictures
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
}