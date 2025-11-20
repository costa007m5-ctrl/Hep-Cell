import React, { useEffect, useState } from 'react';

const Confetti: React.FC = () => {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6'];
    const newParticles = [];

    for (let i = 0; i < 50; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100, // position %
        y: -10 - Math.random() * 20, // start above screen
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 10 + 5,
        rotation: Math.random() * 360,
        delay: Math.random() * 2,
        duration: Math.random() * 2 + 2,
      });
    }
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: '1', // Run once
            animationFillMode: 'forwards'
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-fall {
          animation-name: confetti-fall;
        }
      `}</style>
    </div>
  );
};

export default Confetti;