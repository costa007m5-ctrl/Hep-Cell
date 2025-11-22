
import React, { useEffect, useState } from 'react';

interface CreditScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  animate?: boolean;
}

const CreditScoreGauge: React.FC<CreditScoreGaugeProps> = ({ 
    score, 
    size = 260, 
    strokeWidth = 20,
    showText = true,
    animate = true
}) => {
    const [displayScore, setDisplayScore] = useState(0);

    useEffect(() => {
        if (animate) {
            let start = 0;
            const end = score;
            const duration = 1500;
            const increment = end > start ? 10 : -10;
            const stepTime = Math.abs(Math.floor(duration / ((end - start) / 10)));
            
            const timer = setInterval(() => {
                start += increment;
                if ((increment > 0 && start >= end) || (increment < 0 && start <= end)) {
                    setDisplayScore(end);
                    clearInterval(timer);
                } else {
                    setDisplayScore(start);
                }
            }, Math.max(stepTime, 10));
            
            return () => clearInterval(timer);
        } else {
            setDisplayScore(score);
        }
    }, [score, animate]);

    const normalizedScore = Math.max(0, Math.min(1000, displayScore));
    const center = size / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;
    
    const angleRange = 260;
    const startAngle = 140; 
    const progressArc = (angleRange / 360) * circumference;
    
    const rotation = 90 + (360 - angleRange) / 2; 

    const getScoreColor = (val: number) => {
        if (val < 300) return '#ef4444'; 
        if (val < 500) return '#f97316'; 
        if (val < 700) return '#eab308'; 
        if (val < 850) return '#22c55e'; 
        return '#3b82f6'; 
    };

    const getStatusText = (val: number) => {
        if (val < 300) return 'Risco Alto';
        if (val < 500) return 'Regular';
        if (val < 700) return 'Bom';
        if (val < 850) return 'Muito Bom';
        return 'Excelente';
    }

    const currentColor = getScoreColor(normalizedScore);

    // Lógica da Agulha (Pointer) - AGORA MAIS CURTA E FOCADA NA BORDA
    const needleAngle = startAngle + (normalizedScore / 1000) * angleRange;
    const needleRad = (needleAngle * Math.PI) / 180;
    
    // Definindo o raio interno e externo da agulha para que ela fique apenas na "pista", sem cruzar o centro
    // radius é o centro da linha grossa (track).
    const innerNeedleRadius = radius - (strokeWidth / 2) - 2; // Começa logo após o fim interno do track
    const outerNeedleRadius = radius + (strokeWidth / 2) + 8; // Termina um pouco fora do track

    const x1 = center + innerNeedleRadius * Math.cos(needleRad);
    const y1 = center + innerNeedleRadius * Math.sin(needleRad);
    const x2 = center + outerNeedleRadius * Math.cos(needleRad);
    const y2 = center + outerNeedleRadius * Math.sin(needleRad);

    return (
        <div className="relative flex items-center justify-center drop-shadow-2xl select-none" style={{ width: size, height: size }}>
            {/* Glow Effect Background */}
            <div 
                className="absolute inset-0 rounded-full blur-3xl opacity-15 pointer-events-none transition-colors duration-700"
                style={{ backgroundColor: currentColor }}
            ></div>

            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform transition-all duration-700 ease-out relative z-10">
                <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                         <stop offset="0%" stopColor="#ef4444" />
                         <stop offset="30%" stopColor="#f97316" />
                         <stop offset="60%" stopColor="#eab308" />
                         <stop offset="85%" stopColor="#22c55e" />
                         <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                </defs>
                
                {/* Track de Fundo (Cinza) */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    className="stroke-slate-200 dark:stroke-slate-800/50"
                    strokeDasharray={`${progressArc} ${circumference}`}
                    strokeDashoffset={0}
                    strokeLinecap="round"
                    transform={`rotate(${rotation} ${center} ${center})`}
                />

                {/* Arco de Progresso Colorido */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="url(#scoreGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${progressArc} ${circumference}`}
                    strokeDashoffset={circumference - ((normalizedScore / 1000) * progressArc)}
                    transform={`rotate(${rotation} ${center} ${center})`}
                    style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                />

                {/* Marcas de Escala (Ticks) */}
                {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick, i) => {
                    const tickAngle = (startAngle + (tick * angleRange)) * (Math.PI / 180);
                    const innerR = radius - strokeWidth / 2 - 8; 
                    const outerR = radius + strokeWidth / 2 + 2;
                    const tx1 = center + innerR * Math.cos(tickAngle);
                    const ty1 = center + innerR * Math.sin(tickAngle);
                    const tx2 = center + outerR * Math.cos(tickAngle);
                    const ty2 = center + outerR * Math.sin(tickAngle);
                    return (
                        <line 
                            key={i} 
                            x1={tx1} y1={ty1} x2={tx2} y2={ty2} 
                            stroke={normalizedScore / 1000 >= tick ? currentColor : "#94a3b8"} 
                            strokeWidth={i === 0 || i === 5 ? 3 : 1.5}
                            className="transition-colors duration-500"
                        />
                    );
                })}

                {/* Ponteiro Moderno (Curto, na borda) */}
                <line 
                    x1={x1} y1={y1} x2={x2} y2={y2} 
                    stroke={currentColor} 
                    strokeWidth={6} 
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out drop-shadow-md"
                />
                
            </svg>
            
            {/* Texto Central - Agora totalmente livre de obstrução */}
            {showText && (
                <div className="absolute flex flex-col items-center justify-center text-center z-20 pt-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Score Relp</span>
                    <span 
                        className="text-6xl font-black tracking-tighter transition-colors duration-500 tabular-nums drop-shadow-sm"
                        style={{ color: currentColor }}
                    >
                        {Math.round(normalizedScore)}
                    </span>
                    <div className={`mt-3 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border backdrop-blur-md shadow-sm transition-colors duration-500`}
                         style={{ 
                             borderColor: `${currentColor}40`, 
                             backgroundColor: `${currentColor}10`,
                             color: currentColor
                         }}
                    >
                        {getStatusText(normalizedScore)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreditScoreGauge;
