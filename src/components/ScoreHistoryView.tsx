import React, { useState, useEffect } from 'react';
import { ScoreHistory } from '../types';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';

interface ScoreHistoryViewProps {
  currentScore: number;
}

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
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data, error } = await supabase
                .from('score_history')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (!error && data) {
                setHistory(data);
            }
        }
      } catch (e) {
        console.error("Failed to fetch score history", e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Extrato de Score</h2>
        <p className="text-slate-500 dark:text-slate-400">Sua pontuação atual é {currentScore}</p>
      </div>

      {loading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
          <ul className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {history.length === 0 ? (
                <li className="text-center text-sm text-slate-500 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    Nenhuma alteração recente no seu score.
                </li>
            ) : (
                history.map((item) => (
                <li key={item.id} className="flex items-start p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <div className="flex-shrink-0 pt-0.5">
                    {item.change > 0 ? <UpIcon /> : <DownIcon />}
                    </div>
                    <div className="ml-3 flex-grow">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.reason || 'Atualização de crédito'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    </div>
                    <div className="ml-3 text-right">
                        <p className={`text-sm font-bold ${item.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.change > 0 ? '+' : ''}{item.change}
                        </p>
                        <p className="text-xs text-slate-400">{item.new_score}</p>
                    </div>
                </li>
                ))
            )}
          </ul>
      )}
    </div>
  );
};

export default ScoreHistoryView;