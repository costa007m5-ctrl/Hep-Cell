import React, { useEffect, useState } from 'react';
import Logo from './Logo';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Timeline da animação
    const timers = [
      setTimeout(() => setStep(1), 300),  // Logo Pop
      setTimeout(() => setStep(2), 1000), // Text Slide Up
      setTimeout(() => setStep(3), 1800), // Slogan Reveal
      setTimeout(() => setExiting(true), 3500), // Start Exit
      setTimeout(() => onFinish(), 4000)  // Finish
    ];

    return () => timers.forEach(clearTimeout);
  }, [onFinish]);

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0f172a] transition-opacity duration-700 ${exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      
      {/* Elementos de Fundo Sutis */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo Animada */}
        <div className={`transition-all duration-1000 transform ${step >= 1 ? 'opacity-100 scale-100 animate-pop-in' : 'opacity-0 scale-50'}`}>
          <div className="relative">
            {/* Glow Effect atrás da logo */}
            <div className="absolute inset-0 bg-indigo-500/30 blur-2xl rounded-full scale-150 animate-pulse"></div>
            <Logo className="h-32 w-32 drop-shadow-2xl" />
          </div>
        </div>

        {/* Nome do App */}
        <div className={`mt-8 overflow-hidden transition-all duration-700 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h1 className="text-4xl font-black text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 drop-shadow-sm">
            Relp Cell
          </h1>
        </div>

        {/* Slogan e Barra de Carregamento */}
        <div className={`mt-4 flex flex-col items-center transition-all duration-700 ${step >= 3 ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-sm font-medium text-indigo-300 tracking-[0.2em] uppercase mb-4 animate-pulse">
            Conectando você ao seu crédito
          </p>
          
          {/* Barra de Progresso Estilizada */}
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-600 animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
          </div>
        </div>
      </div>

      {/* Copyright Footer */}
      <div className="absolute bottom-8 text-slate-600 text-[10px] font-medium tracking-wider uppercase opacity-50">
        © {new Date().getFullYear()} Relp Technology
      </div>
    </div>
  );
};

export default SplashScreen;