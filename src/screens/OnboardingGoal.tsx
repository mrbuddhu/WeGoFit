import { useState } from 'react';
import GoFitLogo from '../components/GoFitLogo';
import { Goal } from '../types';

interface Props {
  onNext: (goal: Goal) => void;
  initialGoal?: Goal | null;
}

const goals: { id: Goal; icon: string; label: string; desc: string }[] = [
  { id: 'lose',     icon: '🔥', label: 'Lose Weight',      desc: 'Burn fat & slim down' },
  { id: 'muscle',   icon: '💪', label: 'Build Muscle',     desc: 'Get stronger & bigger' },
  { id: 'maintain', icon: '⚖️', label: 'Maintain Weight',  desc: 'Stay at your best' },
  { id: 'fitness',  icon: '🏃', label: 'Improve Fitness',  desc: 'Endurance & health' },
];

const STEP = 1;
const TOTAL = 6;

export default function OnboardingGoal({ onNext, initialGoal }: Props) {
  const [selected, setSelected] = useState<Goal | null>(initialGoal ?? null);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0D0D1A',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 20px 40px',
      }}
    >
      <div style={{ maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <GoFitLogo size="md" />
        </div>

        <ProgressDots current={STEP} total={TOTAL} />

        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              color: '#fff',
              fontSize: 'clamp(22px, 2vw, 28px)' as React.CSSProperties['fontSize'],
              fontWeight: 800,
              margin: '0 0 6px 0',
              letterSpacing: -0.4,
            }}
          >
            What's your goal?
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(13px, 1.2vw, 15px)' as React.CSSProperties['fontSize'], margin: 0 }}>
            We'll customize your plan
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {goals.map((g) => {
            const isSelected = selected === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setSelected(g.id)}
                style={{
                  width: '100%',
                  padding: '16px 18px',
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
                <span style={{ fontSize: 26, flexShrink: 0 }}>{g.icon}</span>
                <div>
                  <div
                    style={{
                      color: isSelected ? '#F97316' : '#fff',
                      fontWeight: 700,
                      fontSize: 15,
                      marginBottom: 2,
                    }}
                  >
                    {g.label}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{g.desc}</div>
                </div>
                {isSelected && (
                  <div
                    style={{
                      marginLeft: 'auto',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      backgroundColor: '#F97316',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => selected && onNext(selected)}
          disabled={!selected}
          style={{
            width: '100%',
            height: 54,
            backgroundColor: selected ? '#F97316' : 'rgba(249,115,22,0.3)',
            borderRadius: 14,
            border: 'none',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: selected ? 'pointer' : 'not-allowed',
            marginTop: 28,
            letterSpacing: 0.2,
            boxShadow: selected ? '0 4px 18px rgba(249,115,22,0.35)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 24,
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current - 1 ? 20 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i < current ? '#F97316' : 'rgba(255,255,255,0.15)',
            transition: 'width 0.3s ease, background-color 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}
