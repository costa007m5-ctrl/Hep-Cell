
import { GoogleGenAI } from "@google/genai";

export const generateSuccessMessage = async (
  customerName: string, 
  amount: string,
  genAIClient: GoogleGenAI // Recebe o cliente como parâmetro
): Promise<string> => {
  if (!genAIClient) {
    console.error("Cliente Gemini não inicializado.");
    return `Obrigado, ${customerName}! Seu pagamento de R$ ${amount} foi processado com sucesso. Agradecemos por escolher a Relp Cell.`;
  }

  try {
    const prompt = `Gere uma mensagem curta, amigável e profissional de confirmação de pagamento para um cliente chamado "${customerName}". O valor pago foi de R$ ${amount}. Agradeça ao cliente por sua pontualidade e por escolher a "Relp Cell". A mensagem deve ser em português do Brasil.`;

    // Fix: Updated to recommended model gemini-3-flash-preview
    const response = await genAIClient.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Fix: Using .text property with fallback
    return response.text || `Obrigado, ${customerName}! Seu pagamento de R$ ${amount} foi processado com sucesso. Agradecemos por escolher a Relp Cell.`;
  } catch (error) {
    console.error("Error generating success message with Gemini:", error);
    return `Obrigado, ${customerName}! Seu pagamento de R$ ${amount} foi processado com sucesso. Agradecemos por escolher a Relp Cell.`;
  }
};
