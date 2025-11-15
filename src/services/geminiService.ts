export const generateSuccessMessage = async (
  customerName: string, 
  amount: string
): Promise<string> => {
  try {
    const response = await fetch('/api/mercadopago/generate-message', {
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

export const diagnoseDatabaseError = async (errorMessage: string): Promise<string> => {
  try {
    const response = await fetch('/api/admin/diagnose-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errorMessage }),
    });

    if (!response.ok) {
      // Retorna uma mensagem de fallback em vez de lançar um erro, para que a UI possa lidar com isso.
      return "Não foi possível contatar o assistente de IA para diagnosticar o problema. Verifique o console do servidor.";
    }
    const data = await response.json();
    return data.diagnosis;
  } catch (error) {
    console.error("Error calling diagnosis API:", error);
    return "Falha na comunicação com o servidor para diagnosticar o erro.";
  }
};