import GoFitLogo from '../components/GoFitLogo';
import { ProgressDots } from './OnboardingGoal';
import { Goal } from '../types';

interface Props {
  goal: Goal;
  dailyCalories: number;
  goalWeightKg: number;
  onNext: () => void;
}

const STEP = 4;
const TOTAL = 6;

const goalLabels: Record<Goal, string> = {
  lose:     'Lose Weight',
  muscle:   'Build Muscle',
  maintain: 'Maintain Weight',
  fitness:  'Improve Fitness',
};

const coachFocus: Record<Goal, string[]> = {
  lose:     ['Calorie awareness & smart food choices', 'Targeted fat-burning workouts', 'Building sustainable daily habits'],
  muscle:   ['Progressive overload & strength tracking', 'Protein targets & muscle nutrition', 'Maximizing strength gains safely'],
  maintain: ['Balance & long-term consistency', 'Healthy lifestyle habits', 'Staying energized & feeling great'],
  fitness:  ['Building endurance & energy', 'Active lifestyle routines', 'Improving stamina week by week'],
};

const whatYouGet = [
  'Personalised fitness coaching',
  'Smart nutrition guidance',
  'Daily accountability from Coach TinaBarks',
  'Belly fat & weight loss programs',
  'Meal plans featuring local and international foods',
];

export default function PlanPreview({ goal, dailyCalories, goalWeightKg, onNext }: Props) {
  const focus = coachFocus[goal] ?? coachFocus['lose'];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0D0D1A',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 20px 40px',
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <GoFitLogo size="md" />
        </div>

        <ProgressDots current={STEP} total={TOTAL} />

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#fff', fontSize: 'clamp(22px, 2vw, 28px)' as React.CSSProperties['fontSize'], fontWeight: 800, margin: '0 0 6px 0', letterSpacing: -0.4 }}>
            Your Plan Is Ready 🎯
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(13px, 1.2vw, 15px)' as React.CSSProperties['fontSize'], margin: 0 }}>
            Based on your goal, here is what Coach TinaBarks has prepared for you
          </p>
        </div>

        {/* Summary card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #F97316 0%, #ea580c 100%)',
            borderRadius: 18,
            padding: '20px 20px',
            marginBottom: 20,
            boxShadow: '0 6px 24px rgba(249,115,22,0.35)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Daily Calorie Target</div>
              <div style={{ color: '#fff', fontSize: 28, fontWeight: 900 }}>{dailyCalories} <span style={{ fontSize: 14, fontWeight: 500 }}>kcal</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Target Weight</div>
              <div style={{ color: '#fff', fontSize: 28, fontWeight: 900 }}>{goalWeightKg} <span style={{ fontSize: 14, fontWeight: 500 }}>kg</span></div>
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Goal: </span>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>{goalLabels[goal]}</span>
          </div>
        </div>

        {/* Coach focus */}
        <div
          style={{
            backgroundColor: '#111827',
            borderRadius: 16,
            padding: '16px 18px',
            marginBottom: 16,
            border: '1px solid rgba(249,115,22,0.2)',
          }}
        >
          <div style={{ color: '#F97316', fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
            YOUR COACH FOCUS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {focus.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', backgroundColor: 'rgba(249,115,22,0.15)',
                  border: '1px solid rgba(249,115,22,0.4)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, marginTop: 1,
                }}>
                  <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.45 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* What you get */}
        <div
          style={{
            backgroundColor: '#111827',
            borderRadius: 16,
            padding: '16px 18px',
            marginBottom: 28,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
            WHAT YOU GET
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {whatYouGet.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>✅</span>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.45 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onNext}
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
            letterSpacing: 0.2,
            boxShadow: '0 4px 18px rgba(249,115,22,0.35)',
          }}
        >
          Create My Account →
        </button>
      </div>
    </div>
  );
}
