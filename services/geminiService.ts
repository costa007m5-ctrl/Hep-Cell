
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateSuccessMessage = async (customerName: string, amount: string): Promise<string> => {
  try {
    const prompt = `Gere uma mensagem curta, amigável e profissional de confirmação de pagamento para um cliente chamado "${customerName}". O valor pago foi de R$ ${amount}. Agradeça ao cliente por sua pontualidade e por escolher a "Relp Cell". A mensagem deve ser em português do Brasil.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Error generating success message with Gemini:", error);
    return `Obrigado, ${customerName}! Seu pagamento de R$ ${amount} foi processado com sucesso. Agradecemos por escolher a Relp Cell.`;
  }
};
