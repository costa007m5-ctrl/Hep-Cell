import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { customerName, amount } = req.body;

  if (!customerName || !amount) {
    return res.status(400).json({ error: 'Faltam os parâmetros customerName e amount.' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error('Gemini API Key (API_KEY) não configurada.');
    return res.status(500).json({ error: 'O serviço de IA não está configurado.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Gere uma mensagem curta, amigável e profissional de confirmação de pagamento para um cliente chamado "${customerName}". O valor pago foi de R$ ${amount}. Agradeça ao cliente por sua pontualidade e por escolher a "Relp Cell". A mensagem deve ser em português do Brasil.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.status(200).json({ message: response.text });
  } catch (error) {
    console.error("Error generating message with Gemini:", error);
    res.status(500).json({ error: 'Falha ao gerar a mensagem de confirmação.' });
  }
}
