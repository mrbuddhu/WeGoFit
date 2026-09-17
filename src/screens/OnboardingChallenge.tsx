import { useState } from 'react';
import GoFitLogo from '../components/GoFitLogo';
import { ProgressDots } from './OnboardingGoal';

const challenges = [
  { id: 'belly',        icon: '🔥', label: 'Belly Fat Reduction',   desc: 'I want to slim my waist and reduce stubborn belly fat' },
  { id: 'consistency',  icon: '📅', label: 'Staying Consistent',    desc: "I keep trying but struggle to stay on track" },
  { id: 'eating',       icon: '🍕', label: 'Controlling My Eating', desc: 'Cravings, overeating, or unhealthy food choices' },
  { id: 'motivation',   icon: '😴', label: 'Lack of Motivation',    desc: 'Hard to get started and keep going' },
  { id: 'time',         icon: '⏰', label: 'Busy Schedule',         desc: "I don't have enough time for fitness" },
  { id: 'plan',         icon: '🧭', label: 'Need a Clear Plan',     desc: 'Not sure what works for me' },
];

interface Props {
  onNext: (challenge: string) => void;
  onBack: () => void;
  initialChallenge?: string;
}

const STEP = 2;
const TOTAL = 6;

export default function OnboardingChallenge({ onNext, onBack, initialChallenge }: Props) {
  const [selected, setSelected] = useState<string | null>(initialChallenge ?? null);
  const [error, setError] = useState(false);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0D0D1A',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 20px 40px',
        overflowY: 'auto',
        position: 'relative',
      }}
    >
      {/* Back button — top left, outside content column */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: 16,
          left: 20,
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.9rem',
          cursor: 'pointer',
          padding: '16px 20px',
          lineHeight: 1,
          zIndex: 10,
        }}
      >
        ← Back
      </button>

      <div style={{ maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <GoFitLogo size="md" />
        </div>

        <ProgressDots current={STEP} total={TOTAL} />

        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              color: '#fff',
              fontSize: 'clamp(22px, 2vw, 28px)' as React.CSSProperties['fontSize'],
              fontWeight: 800,
              margin: '0 0 6px 0',
              letterSpacing: -0.4,
              lineHeight: 1.2,
            }}
          >
            What's your biggest challenge?
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(13px, 1.2vw, 15px)' as React.CSSProperties['fontSize'], margin: 0 }}>
            We'll tailor your coaching around this
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {challenges.map((c) => {
            const isSelected = selected === c.id;
            return (
              <button
                key={c.id}
                onClick={() => { setSelected(c.id); setError(false); }}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  backgroundColor: isSelected ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.04)',
                  borderRadius: 14,
                  border: 'none',
                  borderLeft: `4px solid ${isSelected ? '#F97316' : 'transparent'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: 'pointer',
                  outline: isSelected ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{c.icon}</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: isSelected ? '#F97316' : '#fff',
                      fontWeight: 700,
                      fontSize: 14,
                      marginBottom: 2,
                    }}
                  >
                    {c.label}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.4 }}>{c.desc}</div>
                </div>
                {isSelected && (
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: '#F97316',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <p style={{ color: '#FF6B6B', fontSize: 13, textAlign: 'center', margin: '12px 0 0 0' }}>
            Please select your biggest challenge to continue
          </p>
        )}

        <button
          onClick={() => { if (!selected) { setError(true); return; } onNext(selected); }}
          style={{
            width: '100%',
            height: 54,
            backgroundColor: '#F97316',
            borderRadius: 14,
            border: 'none',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            marginTop: 24,
            letterSpacing: 0.2,
            boxShadow: '0 4px 18px rgba(249,115,22,0.35)',
            transition: 'all 0.2s ease',
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
