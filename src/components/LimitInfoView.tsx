import React, { useState, useMemo } from 'react';
import { Profile } from '../types';
import LimitRequestForm from './LimitRequestForm';

interface LimitInfoViewProps {
  profile: Profile;
  onClose: () => void;
}

const LimitInfoView: React.FC<LimitInfoViewProps> = ({ profile, onClose }) => {
    const [showRequestForm, setShowRequestForm] = useState(false);

    const eligibility = useMemo(() => {
        // Se não houver data, é elegível imediatamente
        const lastRequestDateStr = profile.last_limit_request_date;
        if (!lastRequestDateStr) {
            return { eligible: true, daysRemaining: 0 };
        }

        const lastRequestDate = new Date(lastRequestDateStr);
        const threeMonthsLater = new Date(lastRequestDate);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

        const now = new Date();
        // Verifica se já passou 3 meses
        const isEligible = now >= threeMonthsLater;
        
        if (isEligible) {
            return { eligible: true, daysRemaining: 0 };
        }

        const diffTime = threeMonthsLater.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return { eligible: false, daysRemaining: diffDays };
    }, [profile.last_limit_request_date]);

    if (showRequestForm) {
        return <LimitRequestForm currentLimit={profile.credit_limit ?? 0} onClose={onClose} />;
    }

    return (
        <div className="space-y-4 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Seu Limite de Crédito</h2>
            <div className="py-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Limite disponível para compras</p>
                <p className="text-5xl font-bold text-indigo-600 dark:text-indigo-400 my-2">
                    {(profile.credit_limit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                    Mantenha um bom score e pague suas faturas em dia para ter mais chances de aumento.
                </p>
            </div>
            
            <div className="pt-4">
                 <button
                    onClick={() => setShowRequestForm(true)}
                    disabled={!eligibility.eligible}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                >
                    Solicitar Aumento de Limite
                </button>
                {!eligibility.eligible && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Você poderá solicitar um novo aumento em {eligibility.daysRemaining} dias.
                    </p>
                )}
            </div>
        </div>
    );
};

export default LimitInfoView;