import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';
import { supabase } from '../services/clients';

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

        const requestedValue = parseFloat(requestedAmount);
        if (isNaN(requestedValue) || requestedValue <= currentLimit) {
            setMessage({ text: 'Por favor, insira um valor maior que o seu limite atual.', type: 'error' });
            setIsSubmitting(false);
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado.');

            const { error } = await supabase.from('limit_requests').insert({
                user_id: user.id,
                requested_amount: requestedValue,
                current_limit: currentLimit,
                justification: justification,
                status: 'pending'
            });

            if (error) throw error;

            // Atualiza a data da última solicitação no perfil para controle de spam
            await supabase.from('profiles').update({ last_limit_request_date: new Date().toISOString() }).eq('id', user.id);

            setMessage({ text: 'Sua solicitação foi enviada com sucesso! Nossa equipe analisará em até 3 dias úteis.', type: 'success' });
            
            setTimeout(() => {
                onClose();
            }, 3000);
            
        } catch (error: any) {
            console.error("Error requesting limit:", error);
            setMessage({ text: 'Ocorreu um erro ao enviar sua solicitação. Tente novamente mais tarde.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
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
                    className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                    placeholder="Ex: Compra de um novo aparelho, despesas inesperadas..."
                />
            </div>

            <div className="pt-2">
                 <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    {isSubmitting ? <LoadingSpinner /> : 'Enviar Solicitação'}
                </button>
            </div>
        </form>
    );
};

export default LimitRequestForm;