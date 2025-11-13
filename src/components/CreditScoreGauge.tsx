import React from 'react';

interface CreditScoreGaugeProps {
  score: number;
}

const CreditScoreGauge: React.FC<CreditScoreGaugeProps> = ({ score }) => {
    const normalizedScore = Math.max(0, Math.min(1000, score));
    const size = 140;
    const strokeWidth = 12;
    const center = size / 2;
    const radius = center - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    
    // Configura o arco para ter um gap na parte inferior (80% do círculo)
    const progressArc = circumference * 0.8;
    const offset = progressArc - (normalizedScore / 1000) * progressArc;

    const getScoreColor = () => {
        if (normalizedScore < 400) return 'text-red-500';
        if (normalizedScore < 700) return 'text-yellow-500';
        return 'text-green-500';
    };

    return (
        <div className="relative flex items-center justify-center mb-4" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                {/* Gradient Definition */}
                <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                         <stop offset="0%" stopColor="#ef4444" /> {/* red-500 */}
                         <stop offset="40%" stopColor="#f59e0b" /> {/* amber-500 */}
                         <stop offset="100%" stopColor="#22c55e" /> {/* green-500 */}
                    </linearGradient>
                </defs>
                
                {/* Background Track */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    className="stroke-slate-200 dark:stroke-slate-700"
                    strokeDasharray={progressArc}
                    strokeDashoffset={0}
                    // Rotaciona para o gap ficar embaixo
                    transform={`rotate(126 ${center} ${center})`} 
                />

                {/* Progress Arc */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="url(#scoreGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={progressArc}
                    strokeDashoffset={offset}
                    transform={`rotate(126 ${center} ${center})`}
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold ${getScoreColor()}`}>{normalizedScore}</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-widest">SCORE</span>
            </div>
        </div>
    );
};

export default CreditScoreGauge;