import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ success: false, message: 'API Key do Gemini não fornecida.' });
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });
    
    // Tenta uma operação simples para validar a chave.
    // Usar um prompt curto e um modelo rápido minimiza o custo.
    const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Olá',
    });

    // Se a chamada for bem-sucedida, a chave é válida.
    if (response.text) {
        res.status(200).json({ success: true, message: 'Chave da API do Gemini válida e conectada com sucesso!' });
    } else {
        throw new Error('A resposta da API do Gemini foi vazia, a chave pode ser inválida.');
    }

  } catch (error: any) {
    console.error('Erro ao testar a chave do Gemini:', error);
    // Extrai uma mensagem de erro mais útil, se disponível
    const errorMessage = error.message || 'Ocorreu um erro desconhecido.';
    res.status(400).json({
      success: false,
      message: `Falha na validação: ${errorMessage}`
    });
  }
}
