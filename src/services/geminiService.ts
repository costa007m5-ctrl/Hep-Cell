export const generateSuccessMessage = async (
  customerName: string, 
  amount: string
): Promise<string> => {
  try {
    const response = await fetch('/api/generate-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerName, amount }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Evita erro se o corpo não for JSON
        console.error("API error response:", errorData);
        throw new Error(errorData.error || 'Falha na API ao gerar mensagem.');
    }

    const data = await response.json();
    return data.message;

  } catch (error) {
    console.error("Error generating success message via API:", error);
    // Mensagem de fallback em caso de erro
    return `Obrigado, ${customerName}! Seu pagamento de R$ ${amount} foi processado com sucesso. Agradecemos por escolher a Relp Cell.`;
  }
};
