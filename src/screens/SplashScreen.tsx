import { useEffect, useState } from 'react';

interface Props {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<'pulse' | 'tagline' | 'fade'>('pulse');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('tagline'), 900);
    const t2 = setTimeout(() => setPhase('fade'), 2200);
    const t3 = setTimeout(onDone, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center z-50 transition-opacity duration-600 ${
        phase === 'fade' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#1A1A2E' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-80 h-80 rounded-full blur-3xl transition-all duration-1000"
          style={{
            backgroundColor: 'rgba(255,107,53,0.12)',
            transform: phase !== 'pulse' ? 'scale(1.4)' : 'scale(1)',
            opacity: phase !== 'pulse' ? 0.6 : 0.3,
          }}
        />
      </div>

      {/* Logo */}
      <div
        className="flex flex-col items-center gap-6 relative z-10 transition-all duration-700"
        style={{
          transform: phase === 'pulse' ? 'scale(0.85)' : 'scale(1)',
          opacity: phase === 'pulse' ? 0.7 : 1,
        }}
      >
        <div
          style={{
            animation: phase === 'pulse' ? 'pulse 1.5s ease-in-out infinite' : undefined,
            filter: phase !== 'pulse' ? 'drop-shadow(0 0 24px rgba(255,107,53,0.5))' : 'none',
            transition: 'filter 0.7s ease',
          }}
        >
          <img
            src="/wegofit-logo.png"
            alt="WeGoFit"
            style={{ width: 220, height: 220, objectFit: 'contain', display: 'block' }}
          />
        </div>

        <div
          className="text-center transition-all duration-500"
          style={{
            opacity: phase === 'tagline' || phase === 'fade' ? 1 : 0,
            transform: phase === 'tagline' || phase === 'fade' ? 'translateY(0)' : 'translateY(10px)',
          }}
        >
          <p className="font-sans text-base tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
            BETTER HABITS. BETTER YOU.
          </p>
        </div>
      </div>
    </div>
  );
}
