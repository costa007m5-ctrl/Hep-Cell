import React from 'react';

interface CreditScoreGaugeProps {
  score: number;
}

const CreditScoreGauge: React.FC<CreditScoreGaugeProps> = ({ score }) => {
  const normalizedScore = Math.max(0, Math.min(1000, score));
  const rotation = (normalizedScore / 1000) * 180 - 90; // Rotação de -90 (score 0) a 90 (score 1000)

  const getScoreColor = () => {
    if (normalizedScore < 400) return 'text-red-500';
    if (normalizedScore < 700) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getNeedleColor = () => {
    if (normalizedScore < 400) return 'fill-red-500';
    if (normalizedScore < 700) return 'fill-yellow-500';
    return 'fill-green-500';
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-48 h-24 mx-auto mt-4 mb-8">
      <svg width="192" height="96" viewBox="0 0 192 96" className="absolute top-0 left-0">
        {/* Gauge background arcs */}
        <path d="M10 86 A 86 86 0 0 1 182 86" fill="none" strokeWidth="20" stroke="url(#gradient)" />
      </svg>
      {/* Gradient definition for the gauge background */}
      <svg width="0" height="0">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" /> {/* red-500 */}
            <stop offset="40%" stopColor="#f59e0b" /> {/* yellow-500 */}
            <stop offset="100%" stopColor="#22c55e" /> {/* green-500 */}
          </linearGradient>
        </defs>
      </svg>
      {/* Needle */}
      <div
        className="absolute bottom-0 w-1 h-20 origin-bottom transition-transform duration-1000 ease-out"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div className={`w-full h-full ${getNeedleColor()} rounded-t-full`} />
      </div>
      {/* Center circle */}
      <div className="absolute w-6 h-6 bg-white dark:bg-slate-700 border-4 border-slate-300 dark:border-slate-600 rounded-full bottom-[-12px]" />
      {/* Score Text */}
      <div className="absolute bottom-0">
        <span className={`text-3xl font-bold ${getScoreColor()}`}>{normalizedScore}</span>
      </div>
    </div>
  );
};

export default CreditScoreGauge;