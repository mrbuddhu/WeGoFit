import { useState, useEffect, useRef } from 'react';
import { storage } from '../utils/storage';

// ── Coach Welcome Screen ───────────────────────────────────────────────────────
function CoachWelcomeScreen({ onBegin }: { onBegin: () => void }) {
  const profile = storage.getUserProfile();
  const firstName = profile?.name?.split(' ')[0] || 'there';

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      overflow: 'hidden',
      backgroundColor: '#070B14',
    }}>
      {/* Full screen background image */}
      <img
        src="/coach-welcome.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
        }}
      />

      {/* Dark gradient overlay from bottom */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, rgba(7,11,20,0.0) 0%, rgba(7,11,20,0.0) 25%, rgba(7,11,20,0.7) 50%, rgba(7,11,20,0.92) 75%, rgba(7,11,20,1.0) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content anchored to bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        padding: '0 28px 52px',
      }}>
        {/* Coach badge */}
        <div style={{
          display: 'inline-flex',
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 20,
          backgroundColor: 'rgba(255,107,53,0.15)',
          borderRadius: 30,
          padding: '8px 14px',
          border: '1px solid rgba(255,107,53,0.35)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: '#FF6B35',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginRight: 8, flexShrink: 0,
          }}>
            <span style={{ color: '#FFF', fontSize: 12, fontWeight: 800, lineHeight: 1 }}>TB</span>
          </div>
          <span style={{ color: '#FF6B35', fontSize: 13, fontWeight: 700 }}>
            Coach TinaBarks · WeGoFit
          </span>
        </div>

        {/* Personalized greeting */}
        <p style={{
          color: '#FFFFFF',
          fontSize: 28,
          fontWeight: 800,
          lineHeight: '36px',
          marginBottom: 16,
          letterSpacing: -0.5,
          margin: '0 0 16px',
        }}>
          Hi {firstName} 👋
        </p>

        {/* Coach message */}
        <p style={{
          color: 'rgba(255,255,255,0.80)',
          fontSize: 15,
          lineHeight: '26px',
          marginBottom: 32,
          whiteSpace: 'pre-line',
          margin: '0 0 32px',
        }}>
          {"I'm Coach TinaBarks, and I'll guide you through your fitness journey step by step.\n\nWhether your goal is weight loss, belly fat reduction, strength, or healthy habits — WeGoFit is built to help you stay consistent and see real progress.\n\nLet's build a stronger, healthier you together 💪"}
        </p>

        {/* CTA button */}
        <button
          onClick={onBegin}
          style={{
            width: '100%',
            height: 58,
            borderRadius: 16,
            backgroundColor: '#FF6B35',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: 0.3,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(255,107,53,0.5)',
            marginBottom: 16,
            transition: 'transform 0.1s',
          }}
          onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
          onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        >
          ✅ Let's Begin
        </button>

        {/* Reassurance line */}
        <p style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: 12,
          textAlign: 'center',
          margin: 0,
        }}>
          Takes less than 2 minutes · Personalised just for you
        </p>
      </div>
    </div>
  );
}

interface Props {
  onComplete: () => void;
}

const GOAL_OPTIONS = [
  { emoji: '🔥', title: 'Lose belly fat & weight', subtitle: 'Burn fat and see real results' },
  { emoji: '💪', title: 'Tone and sculpt my body', subtitle: 'Build lean muscle and curves' },
  { emoji: '😴', title: 'More energy & better sleep', subtitle: 'Feel amazing every single day' },
  { emoji: '🏃', title: 'General fitness & health', subtitle: 'Build lasting healthy habits' },
];

const CHALLENGE_OPTIONS = [
  { emoji: '😤', text: "Can't stay consistent" },
  { emoji: '🍽️', text: 'Confused about food' },
  { emoji: '💸', text: 'Gym too expensive' },
  { emoji: '😴', text: 'Too tired after work' },
  { emoji: '👤', text: 'No accountability' },
  { emoji: '📉', text: 'Tried everything' },
];

function getCommitmentText(days: number): string {
  if (days <= 2) return 'Perfect start!\nSmall steps = big results 🌱';
  if (days === 3) return 'Great commitment!\nThis is where transformation happens 🔥';
  return 'You are SERIOUS!\nCoach TinaBarks loves this energy! 💪';
}

// Animated progress dots
function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 pb-6">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === current ? 'white' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      ))}
    </div>
  );
}

// Circular progress SVG for screen 4
function CircleProgress({ progress }: { progress: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke="#FF6B35"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 2s ease-out' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 32 }}>{progress}%</span>
        <span style={{ color: '#FF6B35', fontSize: 14, fontWeight: 600 }}>Ready!</span>
      </div>
    </div>
  );
}

// Confetti particles for screen 5
function Confetti() {
  const particles = useRef(
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 6 + Math.random() * 8,
      color: ['#FF6B35', '#FFD700', '#FF4081', '#00E5FF', '#69FF47', '#FF6B35'][Math.floor(Math.random() * 6)],
      delay: Math.random() * 1.5,
      duration: 2.5 + Math.random() * 2,
    }))
  );
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.current.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: -20,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: p.color,
            animation: `confettiFall ${p.duration}s ease-in ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingWelcome({ onComplete }: Props) {
  const [showWelcome, setShowWelcome] = useState(!storage.isOnboardingComplete());
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<number | null>(null);
  const [selectedChallenges, setSelectedChallenges] = useState<number[]>([]);
  const [commitDays, setCommitDays] = useState<number>(3);
  const [circleProgress, setCircleProgress] = useState(0);
  const [bounceKey, setBounceKey] = useState(0);

  // Fade in on mount and step change
  useEffect(() => {
    setVisible(false);
    setBounceKey(k => k + 1);
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, [step]);

  // Animate circle on step 3
  useEffect(() => {
    if (step === 3) {
      setCircleProgress(0);
      const t = setTimeout(() => setCircleProgress(100), 100);
      return () => clearTimeout(t);
    }
  }, [step]);

  const goTo = (s: number) => setStep(s);

  const skipToFinal = () => goTo(4);

  const handleGoalSelect = (idx: number) => {
    setSelectedGoal(idx);
    storage.setClientGoal(GOAL_OPTIONS[idx].title);
  };

  const toggleChallenge = (idx: number) => {
    setSelectedChallenges(prev => {
      const next = prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx];
      storage.setClientChallenges(next.map(i => CHALLENGE_OPTIONS[i].text));
      return next;
    });
  };

  const handleCommitDays = (d: number) => {
    setCommitDays(d);
    storage.setClientCommitmentDays(d);
  };

  const handleFinish = () => {
    storage.setWelcomeOnboardingComplete(true);
    onComplete();
  };

  const profile = storage.getUserProfile();
  const firstName = profile?.name?.split(' ')[0] || 'Champion';

  if (showWelcome) {
    return <CoachWelcomeScreen onBegin={() => setShowWelcome(false)} />;
  }
  const goalLabel = selectedGoal !== null ? GOAL_OPTIONS[selectedGoal].title : '—';

  const screenStyle = (gradient: string): React.CSSProperties => ({
    position: 'relative',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: gradient,
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.4s ease',
    overflowX: 'hidden',
    overflowY: 'auto',
  });

  const skipBtn = (
    <button
      onClick={skipToFinal}
      style={{
        position: 'absolute', top: 52, right: 20, zIndex: 10,
        color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 500,
        background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px',
      }}
    >
      Skip
    </button>
  );

  const nextBtn = (label: string, onPress: () => void, disabled = false) => (
    <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 32, marginTop: 'auto' }}>
      <button
        onClick={onPress}
        disabled={disabled}
        style={{
          width: '85%', height: 56, borderRadius: 28,
          backgroundColor: disabled ? 'rgba(255,107,53,0.35)' : '#FF6B35',
          color: 'white', fontSize: 17, fontWeight: 700,
          border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'transform 0.1s, background-color 0.2s',
          boxShadow: disabled ? 'none' : '0 4px 20px rgba(255,107,53,0.45)',
        }}
        onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        {label}
      </button>
    </div>
  );

  // ── SCREEN 1: Welcome ──────────────────────────────────────────
  if (step === 0) return (
    <div style={{
      position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column',
      opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease',
      overflowX: 'hidden', overflowY: 'auto', backgroundColor: '#0F0F19',
    }}>
      {/* Full-screen background photo */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/coach-welcome.png)',
        backgroundSize: 'cover', backgroundPosition: 'center top',
      }} />
      {/* Dark overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
      }} />

      {skipBtn}

      {/* Top spacer — Coach TinaBarks visible here (40%) */}
      <div style={{ flex: '0 0 40%', minHeight: '40vh' }} />

      {/* Bottom sheet (60%) */}
      <div style={{
        flex: '1 1 60%',
        position: 'relative', zIndex: 2,
        backgroundColor: 'rgba(15,15,25,0.92)',
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        padding: '32px 32px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* WeGoFit logo */}
        <img
          src="/wegofit-logo.png"
          alt="WeGoFit"
          style={{ height: 45, width: 'auto', objectFit: 'contain', marginBottom: 16 }}
        />

        <h1 style={{
          color: 'white', fontWeight: 800, fontSize: 28,
          textAlign: 'center', marginBottom: 0, lineHeight: 1.2,
        }}>
          Welcome to WeGoFit! 🧡
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center',
          lineHeight: '24px', marginTop: 12, marginBottom: 28, maxWidth: 320,
        }}>
          I'm Coach TinaBarks and I will personally watch your transformation.
          You are not alone anymore. 💪
        </p>

        {/* CTA button */}
        <button
          onClick={() => goTo(1)}
          style={{
            width: '100%', height: 54, borderRadius: 27,
            backgroundColor: '#FF6B35', color: 'white',
            fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(255,107,53,0.45)',
            transition: 'transform 0.1s',
          }}
          onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
          onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        >
          Let's Begin! →
        </button>

        <p style={{
          color: 'rgba(255,255,255,0.4)', fontSize: 12,
          textAlign: 'center', marginTop: 10,
        }}>
          7-day free trial · No credit card needed
        </p>

        <div style={{ marginTop: 16 }}>
          <ProgressDots current={0} />
        </div>
      </div>

      <style>{`
        @keyframes emojiPop {
          0% { transform: scale(0.4) rotate(-10deg); opacity: 0; }
          70% { transform: scale(1.2) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80% { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );

  // ── SCREEN 2: Goal Selection ───────────────────────────────────
  if (step === 1) return (
    <div style={screenStyle('linear-gradient(145deg, #0F0F19 0%, #1A0F00 50%, #0F0F19 100%)')}>
      {skipBtn}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px', flex: 1 }}>
        <span
          key={bounceKey}
          style={{ fontSize: 60, marginTop: 60, animation: 'emojiPop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
        >🎯</span>
        <h1 style={{
          color: 'white', fontWeight: 800, fontSize: 30,
          textAlign: 'center', marginTop: 16, marginBottom: 8,
        }}>
          What's your #1 goal?
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center',
          lineHeight: '22px', marginBottom: 32, maxWidth: 300,
        }}>
          Be honest — this helps Coach TinaBarks build your perfect plan 💪
        </p>

        <div style={{ width: '100%' }}>
          {GOAL_OPTIONS.map((opt, i) => {
            const sel = selectedGoal === i;
            return (
              <button
                key={i}
                onClick={() => handleGoalSelect(i)}
                style={{
                  width: '100%', height: 72, borderRadius: 16,
                  marginBottom: 12, display: 'flex', alignItems: 'center',
                  paddingLeft: 20, paddingRight: 20, cursor: 'pointer',
                  backgroundColor: sel ? 'rgba(255,107,53,0.2)' : '#111827',
                  border: sel ? '2px solid #FF6B35' : '1.5px solid rgba(255,255,255,0.1)',
                  transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                  transform: sel ? 'scale(1.02)' : 'scale(1)',
                  textAlign: 'left',
                }}
              >
                {/* Emoji circle */}
                <div style={{
                  width: 44, height: 44, borderRadius: 22, flexShrink: 0,
                  backgroundColor: 'rgba(255,107,53,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>
                  {opt.emoji}
                </div>
                {/* Text */}
                <div style={{ flex: 1, marginLeft: 14 }}>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{opt.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>{opt.subtitle}</div>
                </div>
                {/* Checkmark */}
                {sel && (
                  <div style={{
                    width: 26, height: 26, borderRadius: 13, flexShrink: 0,
                    backgroundColor: '#FF6B35',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: 'white', fontWeight: 700,
                  }}>✓</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ProgressDots current={1} />
      {nextBtn('This is my goal! →', () => goTo(2), selectedGoal === null)}
    </div>
  );

  // ── SCREEN 3: Biggest Challenge ────────────────────────────────
  if (step === 2) return (
    <div style={screenStyle('linear-gradient(145deg, #0F0F19 0%, #0D1A0D 50%, #0F0F19 100%)')}>
      {skipBtn}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px', flex: 1 }}>
        <span
          key={bounceKey}
          style={{ fontSize: 60, marginTop: 60, animation: 'emojiPop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
        >💬</span>
        <h1 style={{
          color: 'white', fontWeight: 800, fontSize: 28,
          textAlign: 'center', marginTop: 16, marginBottom: 8,
        }}>
          What has stopped you before?
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center',
          lineHeight: '22px', marginBottom: 28, maxWidth: 300,
        }}>
          No judgment here — just honesty 🙏{'\n'}
          Your answer helps Coach TinaBarks understand your real challenge
        </p>

        {/* 2-column grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 12, width: '100%',
        }}>
          {CHALLENGE_OPTIONS.map((opt, i) => {
            const sel = selectedChallenges.includes(i);
            return (
              <button
                key={i}
                onClick={() => toggleChallenge(i)}
                style={{
                  height: 90, borderRadius: 16, padding: 16,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  backgroundColor: sel ? 'rgba(255,107,53,0.15)' : '#111827',
                  border: sel ? '1.5px solid #FF6B35' : '1.5px solid rgba(255,255,255,0.1)',
                  transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                  transform: sel ? 'scale(1.04)' : 'scale(1)',
                }}
              >
                <span style={{ fontSize: 28, marginBottom: 6 }}>{opt.emoji}</span>
                <span style={{
                  color: sel ? 'white' : 'rgba(255,255,255,0.7)',
                  fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: '16px',
                }}>
                  {opt.text}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ProgressDots current={2} />
      {nextBtn('Coach TinaBarks will help! →', () => goTo(3), selectedChallenges.length === 0)}
    </div>
  );

  // ── SCREEN 4: Commitment ───────────────────────────────────────
  if (step === 3) return (
    <div style={screenStyle('linear-gradient(145deg, #0F0F19 0%, #1A0A1A 50%, #0F0F19 100%)')}>
      {skipBtn}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px', flex: 1 }}>
        <div style={{ marginTop: 48 }}>
          <CircleProgress progress={circleProgress} />
        </div>

        <h1 style={{
          color: 'white', fontWeight: 800, fontSize: 26,
          textAlign: 'center', marginTop: 28, marginBottom: 12, lineHeight: 1.3,
        }}>
          How many days per week{'\n'}can you commit?
        </h1>

        {/* Day selector */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {[1, 2, 3, 4, 5].map(d => {
            const sel = commitDays === d;
            return (
              <button
                key={d}
                onClick={() => handleCommitDays(d)}
                style={{
                  width: 52, height: 52, borderRadius: 26,
                  backgroundColor: sel ? '#FF6B35' : '#111827',
                  border: sel ? '1.5px solid #FF6B35' : '1.5px solid rgba(255,255,255,0.1)',
                  color: 'white', fontSize: 18, fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  transform: sel ? 'scale(1.12)' : 'scale(1)',
                  boxShadow: sel ? '0 4px 16px rgba(255,107,53,0.5)' : 'none',
                }}
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* Motivational text */}
        <p style={{
          color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center',
          lineHeight: '24px', marginTop: 24, maxWidth: 280, whiteSpace: 'pre-line',
        }}>
          {getCommitmentText(commitDays)}
        </p>
      </div>

      <ProgressDots current={3} />
      {nextBtn("I'm committed! →", () => goTo(4))}
    </div>
  );

  // ── SCREEN 5: All Set ──────────────────────────────────────────
  return (
    <div style={screenStyle('linear-gradient(145deg, #FF6B35 0%, #e05520 40%, #1A1A2E 100%)')}>
      <Confetti />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px', flex: 1, position: 'relative', zIndex: 1 }}>
        <span
          key={bounceKey}
          style={{ fontSize: 80, marginTop: 60, textAlign: 'center', animation: 'emojiPop 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
        >🎉</span>

        <h1 style={{
          color: 'white', fontWeight: 800, fontSize: 32,
          textAlign: 'center', marginTop: 20, marginBottom: 8,
        }}>
          You're all set, {firstName}!
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.9)', fontSize: 16, textAlign: 'center',
          lineHeight: '24px', marginBottom: 32,
        }}>
          Your personal WeGoFit plan is ready and waiting for you! 🔥
        </p>

        {/* Summary card */}
        <div style={{
          width: '100%', backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 20, padding: 20,
        }}>
          {[
            `🎯 Goal: ${goalLabel}`,
            `📅 Commitment: ${commitDays} day${commitDays > 1 ? 's' : ''}/week`,
            '👑 Your Coach: TinaBarks',
            '⏰ Trial: 7 days FREE',
          ].map(line => (
            <p key={line} style={{ color: 'white', fontSize: 14, lineHeight: '28px', margin: 0 }}>{line}</p>
          ))}
        </div>

        {/* Coach message card */}
        <div style={{
          width: '100%', backgroundColor: 'rgba(0,0,0,0.2)',
          borderRadius: 16, padding: 16, marginTop: 16,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <img
            src="/Coach_TinaBarks.PNG"
            alt="Coach TinaBarks"
            style={{
              width: 44, height: 44, borderRadius: 22,
              objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)',
              flexShrink: 0,
            }}
          />
          <p style={{
            color: 'white', fontSize: 13, fontStyle: 'italic',
            lineHeight: '20px', margin: 0,
          }}>
            "I've been notified about your goals. I'll personally check in on you this week. Let's do this! 💪{'\n'}— Coach TinaBarks"
          </p>
        </div>
      </div>

      <ProgressDots current={4} />

      {/* Custom white button */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 32, marginTop: 'auto', position: 'relative', zIndex: 1 }}>
        <button
          onClick={handleFinish}
          style={{
            width: '85%', height: 56, borderRadius: 28,
            backgroundColor: 'white', color: '#FF6B35',
            fontSize: 17, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            transition: 'transform 0.1s',
          }}
          onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
          onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        >
          Start My Free Trial! 🚀
        </button>
      </div>
    </div>
  );
}
