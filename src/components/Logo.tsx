import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  slogan?: boolean;
  variant?: 'default' | 'light' | 'dark';
}

const Logo: React.FC<LogoProps> = ({ className = "h-12 w-12", showText = false, slogan = false, variant = 'default' }) => {
  const textColor = variant === 'light' ? 'text-white' : 'text-slate-900 dark:text-white';
  const sloganColor = variant === 'light' ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400';

  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative">
        <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="relpGradient" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#4f46e5" /> {/* Indigo 600 */}
                    <stop offset="100%" stopColor="#7c3aed" /> {/* Violet 600 */}
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <style>
                    {`
                        @keyframes signal-pulse {
                            0% { stroke-opacity: 0.2; stroke-width: 6; }
                            50% { stroke-opacity: 1; stroke-width: 8; }
                            100% { stroke-opacity: 0.2; stroke-width: 6; }
                        }
                        .signal-wave-1 {
                            animation: signal-pulse 1.5s infinite ease-in-out;
                        }
                        .signal-wave-2 {
                            animation: signal-pulse 1.5s infinite ease-in-out 0.4s; /* Delay para efeito de propagação */
                        }
                    `}
                </style>
            </defs>
            
            {/* Corpo do Celular */}
            <rect x="40" y="20" width="120" height="160" rx="25" fill="url(#relpGradient)" filter="url(#glow)" />
            
            {/* Tela/Chip */}
            <rect x="55" y="45" width="90" height="70" rx="8" fill="white" fillOpacity="0.15" />
            
            {/* Letra R Estilizada (Circuito) */}
            <path d="M75 135 V 65 H 105 C 125 65, 125 85, 105 85 H 75 M 105 85 L 125 135" 
                stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                
            {/* Ondas de Sinal (Conexão) com Animação */}
            <path className="signal-wave-1" d="M135 40 A 20 20 0 0 1 155 60" stroke="#4ade80" strokeWidth="6" strokeLinecap="round" />
            <path className="signal-wave-2" d="M145 30 A 35 35 0 0 1 170 65" stroke="#4ade80" strokeWidth="6" strokeLinecap="round" />
            
            {/* Botão Home (Digital) */}
            <circle cx="100" cy="155" r="6" fill="white" fillOpacity="0.8" />
        </svg>
      </div>
      
      {showText && (
        <div className="flex flex-col justify-center">
          <h1 className={`font-black tracking-tight leading-none ${textColor}`} style={{ fontSize: '1.75rem' }}>
            Relp Cell
          </h1>
          {slogan && (
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${sloganColor} mt-1`}>
              Conectando você ao seu crédito
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;