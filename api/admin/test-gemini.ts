import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(400).json({ 
        success: false, 
        message: "A variável de ambiente 'API_KEY' do Gemini não foi encontrada. Verifique sua configuração na Vercel."
    });
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });
    
    const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Olá',
    });

    if (response.text) {
        res.status(200).json({ success: true, message: 'Sucesso! A chave da API do Gemini está válida e conectada.' });
    } else {
        throw new Error('A resposta da API do Gemini foi vazia, a chave pode ser inválida.');
    }

  } catch (error: any) {
    console.error('Erro ao testar a chave do Gemini:', error);
    const errorMessage = error.message || 'Ocorreu um erro desconhecido.';
    res.status(400).json({
      success: false,
      message: `Falha na validação: ${errorMessage}`
    });
  }
}