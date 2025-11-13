import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';

interface LimitRequestFormProps {
    currentLimit: number;
    onClose: () => void;
}

const LimitRequestForm: React.FC<LimitRequestFormProps> = ({ currentLimit, onClose }) => {
    const [requestedAmount, setRequestedAmount] = useState('');
    const [justification, setJustification] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage(null);

        // Simulação de chamada de API
        await new Promise(resolve => setTimeout(resolve, 1500));

        const requestedValue = parseFloat(requestedAmount);
        if (isNaN(requestedValue) || requestedValue <= currentLimit) {
            setMessage({ text: 'Por favor, insira um valor maior que o seu limite atual.', type: 'error' });
            setIsSubmitting(false);
            return;
        }

        // Simulação de sucesso
        setMessage({ text: 'Sua solicitação foi enviada com sucesso! Você receberá uma resposta em até 3 dias úteis.', type: 'success' });
        
        // Limpa o formulário e fecha o modal após um tempo
        setTimeout(() => {
            onClose();
        }, 4000);
    };

    if (message?.type === 'success') {
        return <Alert message={message.text} type="success" />;
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Solicitar Aumento</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Seu pedido passará por uma análise de crédito.
                </p>
            </div>
            
            {message && <Alert message={message.text} type={message.type} />}

            <InputField
                label="Novo Limite Desejado (R$)"
                type="number"
                name="requestedAmount"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                placeholder={String(currentLimit + 500)}
                required
                min={currentLimit + 1}
            />

            <div>
                <label htmlFor="justification" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Por que você precisa de um limite maior? (Opcional)
                </label>
                <textarea
                    id="justification"
                    name="justification"
                    rows={3}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Ex: Compra de um novo aparelho, despesas inesperadas..."
                />
            </div>

            <div className="pt-2">
                 <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isSubmitting ? <LoadingSpinner /> : 'Enviar Solicitação'}
                </button>
            </div>
        </form>
    );
};

export default LimitRequestForm;