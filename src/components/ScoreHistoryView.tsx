import React from 'react';
import { ScoreHistory } from '../types';

interface ScoreHistoryViewProps {
  currentScore: number;
}

const mockHistory: ScoreHistory[] = [
  { id: 1, date: '2024-07-15', reason: 'Pagamento da fatura de Julho em dia', change: 20, newScore: 850 },
  { id: 2, date: '2024-06-20', reason: 'Pagamento da fatura de Junho com pequeno atraso', change: -10, newScore: 830 },
  { id: 3, date: '2024-06-15', reason: 'Pagamento da fatura de Maio em dia', change: 20, newScore: 840 },
  { id: 4, date: '2024-05-10', reason: 'Aumento de limite aprovado', change: 15, newScore: 820 },
  { id: 5, date: '2024-04-18', reason: 'Pagamento da fatura de Março com atraso', change: -50, newScore: 805 },
];

const UpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
    </svg>
);

const DownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1.293-8.707a1 1 0 00-1.414-1.414L10 10.586 8.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2z" clipRule="evenodd" />
    </svg>
);

const ScoreHistoryView: React.FC<ScoreHistoryViewProps> = ({ currentScore }) => {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Extrato de Score</h2>
        <p className="text-slate-500 dark:text-slate-400">Sua pontuação atual é {currentScore}</p>
      </div>

      <ul className="space-y-3 max-h-80 overflow-y-auto pr-2">
        {mockHistory.map((item) => (
          <li key={item.id} className="flex items-start p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
            <div className="flex-shrink-0 pt-0.5">
              {item.change > 0 ? <UpIcon /> : <DownIcon />}
            </div>
            <div className="ml-3 flex-grow">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.reason}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="ml-3 text-right">
                <p className={`text-sm font-bold ${item.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.change > 0 ? '+' : ''}{item.change}
                </p>
                <p className="text-xs text-slate-400">{item.newScore}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ScoreHistoryView;