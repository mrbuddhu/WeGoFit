import { useState, useRef, useEffect } from 'react';
import GoFitLogo from '../components/GoFitLogo';
import { ActivityLevel, Gender } from '../types';
import { ProgressDots } from './OnboardingGoal';

interface Props {
  onNext: (heightCm: number, weightKg: number, goalWeightKg: number, activity: ActivityLevel, gender: Gender, age: number) => void;
  onBack: () => void;
  initialHeightCm?: number;
  initialWeightKg?: number;
  initialGoalWeightKg?: number;
  initialActivity?: ActivityLevel;
  initialGender?: Gender;
  initialAge?: number;
}

const STEP = 3;
const TOTAL = 6;

// ── Drum wheel ────────────────────────────────────────────────────────────────
interface WheelProps {
  items: (string | number)[];
  selectedIndex: number;
  onChange: (index: number) => void;
  itemHeight?: number;
  label?: string;
}

function DrumWheel({ items, selectedIndex, onChange, itemHeight = 44, label }: WheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScroll = useRef(0);
  const VISIBLE = 5;
  const containerH = VISIBLE * itemHeight;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = selectedIndex * itemHeight;
  }, []);

  function snapToIndex(idx: number) {
    const el = containerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    el.scrollTo({ top: clamped * itemHeight, behavior: 'smooth' });
    onChange(clamped);
  }

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / itemHeight);
    onChange(Math.max(0, Math.min(items.length - 1, idx)));
  }

  function handleScrollEnd() {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / itemHeight);
    snapToIndex(idx);
  }

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    startY.current = e.pageY;
    startScroll.current = containerRef.current?.scrollTop ?? 0;
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !containerRef.current) return;
    containerRef.current.scrollTop = startScroll.current - (e.pageY - startY.current);
  }
  function onMouseUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    handleScrollEnd();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
      {label && (
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
          {label}
        </div>
      )}
      <div style={{ position: 'relative', height: containerH, width: 80 }}>
        {/* Selection highlight */}
        <div
          style={{
            position: 'absolute',
            top: Math.floor(VISIBLE / 2) * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
            backgroundColor: 'rgba(249,115,22,0.12)',
            borderTop: '1px solid rgba(249,115,22,0.4)',
            borderBottom: '1px solid rgba(249,115,22,0.4)',
            borderRadius: 6,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
        {/* Top fade */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: itemHeight * 1.5,
          background: 'linear-gradient(to bottom, #111827, transparent)',
          pointerEvents: 'none', zIndex: 3,
        }} />
        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: itemHeight * 1.5,
          background: 'linear-gradient(to top, #111827, transparent)',
          pointerEvents: 'none', zIndex: 3,
        }} />
        <div
          ref={containerRef}
          style={{
            height: '100%',
            overflowY: 'scroll',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            cursor: 'grab',
          }}
          onScroll={handleScroll}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Top spacer */}
          <div style={{ height: Math.floor(VISIBLE / 2) * itemHeight }} />
          {items.map((item, i) => {
            const dist = Math.abs(i - selectedIndex);
            const isCenter = dist === 0;
            return (
              <div
                key={i}
                onClick={() => snapToIndex(i)}
                style={{
                  height: itemHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isCenter ? 20 : 15,
                  fontWeight: isCenter ? 800 : 500,
                  color: isCenter ? '#F97316' : '#fff',
                  opacity: isCenter ? 1 : dist === 1 ? 0.5 : 0.25,
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                  userSelect: 'none',
                }}
              >
                {item}
              </div>
            );
          })}
          {/* Bottom spacer */}
          <div style={{ height: Math.floor(VISIBLE / 2) * itemHeight }} />
        </div>
      </div>
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const AGES = Array.from({ length: 65 }, (_, i) => i + 16);
const FT_VALUES = [4, 5, 6, 7];
const IN_VALUES = Array.from({ length: 12 }, (_, i) => i);
const KG_VALUES = Array.from({ length: 151 }, (_, i) => i + 30);
const LBS_VALUES = Array.from({ length: 331 }, (_, i) => i + 66);

const activityOptions: { id: ActivityLevel; icon: string; label: string; desc: string }[] = [
  { id: 'sedentary',  icon: '🪑', label: 'Sedentary',      desc: 'Little or no exercise' },
  { id: 'light',      icon: '🚶', label: 'Lightly Active', desc: '1–3 workouts per week' },
  { id: 'active',     icon: '🏃', label: 'Active',         desc: '3–5 workouts per week' },
  { id: 'very_active',icon: '💪', label: 'Very Active',    desc: 'Training most days' },
];

const genderOptions: { id: Gender; label: string }[] = [
  { id: 'male',   label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other',  label: 'Other' },
];

export default function OnboardingAboutB({ onNext, onBack, initialHeightCm, initialWeightKg, initialGoalWeightKg, initialActivity, initialGender, initialAge }: Props) {
  const initAgeIdx = initialAge != null ? Math.max(0, AGES.indexOf(initialAge)) : 9;
  const initFtIdx  = (() => {
    if (initialHeightCm == null) return 1;
    const totalIn = initialHeightCm / 2.54;
    const ft = Math.floor(totalIn / 12);
    return Math.max(0, FT_VALUES.indexOf(ft));
  })();
  const initInIdx  = (() => {
    if (initialHeightCm == null) return 7;
    const totalIn = Math.round(initialHeightCm / 2.54);
    const ins = totalIn % 12;
    return Math.max(0, IN_VALUES.indexOf(ins));
  })();
  const initCwIdx  = initialWeightKg != null ? Math.max(0, KG_VALUES.indexOf(initialWeightKg)) : 40;
  const initGwIdx  = initialGoalWeightKg != null ? Math.max(0, KG_VALUES.indexOf(initialGoalWeightKg)) : 35;

  const [ageIdx, setAgeIdx] = useState(initAgeIdx !== -1 ? initAgeIdx : 9);
  const [ftIdx,  setFtIdx]  = useState(initFtIdx  !== -1 ? initFtIdx  : 1);
  const [inIdx,  setInIdx]  = useState(initInIdx  !== -1 ? initInIdx  : 7);
  const [useKg,  setUseKg]  = useState(true);
  const [cwIdx,  setCwIdx]  = useState(initCwIdx  !== -1 ? initCwIdx  : 40);
  const [gwIdx,  setGwIdx]  = useState(initGwIdx  !== -1 ? initGwIdx  : 35);
  const [activity, setActivity] = useState<ActivityLevel>(initialActivity ?? 'light');
  const [gender,   setGender]   = useState<Gender>(initialGender ?? 'male');

  const heightCm = Math.round((FT_VALUES[ftIdx] * 12 + IN_VALUES[inIdx]) * 2.54);
  const currentKg = useKg ? KG_VALUES[cwIdx] : Math.round(LBS_VALUES[cwIdx] / 2.205);
  const goalKg    = useKg ? KG_VALUES[gwIdx] : Math.round(LBS_VALUES[gwIdx] / 2.205);
  const age = AGES[ageIdx];

  const weightItems = useKg ? KG_VALUES.map(v => `${v} kg`) : LBS_VALUES.map(v => `${v} lbs`);

  const handleNext = () => {
    onNext(heightCm, currentKg, goalKg, activity, gender, age);
  };

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

      {/* Content column — wider (640px) to accommodate side-by-side drum wheels */}
      <div style={{ maxWidth: 640, marginLeft: 'auto', marginRight: 'auto', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <GoFitLogo size="md" />
        </div>

        <ProgressDots current={STEP} total={TOTAL} />

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#fff', fontSize: 'clamp(22px, 2vw, 28px)' as React.CSSProperties['fontSize'], fontWeight: 800, margin: '0 0 6px 0', letterSpacing: -0.4, lineHeight: 1.2 }}>
            Build Your Personalized<br />WeGoFit Plan
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(13px, 1.2vw, 15px)' as React.CSSProperties['fontSize'], margin: 0 }}>
            This helps us calculate your perfect targets
          </p>
        </div>

        {/* ── Age + Height: side-by-side on desktop ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 0 }}>
          {/* ── Age ── */}
          <Section title="🧑 Age">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DrumWheel items={AGES} selectedIndex={ageIdx} onChange={setAgeIdx} label="years" />
            </div>
          </Section>

          {/* ── Height ── */}
          <Section title="📏 Height">
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'flex-end' }}>
              <DrumWheel items={FT_VALUES} selectedIndex={ftIdx} onChange={setFtIdx} label="ft" />
              <DrumWheel items={IN_VALUES} selectedIndex={inIdx} onChange={setInIdx} label="in" />
              <div style={{ paddingBottom: 8, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                + {heightCm} cm
              </div>
            </div>
          </Section>
        </div>

        {/* ── Weight unit toggle ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, marginTop: 16 }}>
          <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 3, gap: 2 }}>
            {['kg', 'lbs'].map(u => (
              <button
                key={u}
                onClick={() => setUseKg(u === 'kg')}
                style={{
                  padding: '4px 14px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: (u === 'kg') === useKg ? '#F97316' : 'transparent',
                  color: (u === 'kg') === useKg ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* ── Current Weight ── */}
        <Section title="⚖️ Current Weight">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <DrumWheel items={weightItems} selectedIndex={cwIdx} onChange={setCwIdx} />
          </div>
        </Section>

        {/* ── Goal Weight ── */}
        <Section title="🎯 Goal Weight">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <DrumWheel items={weightItems} selectedIndex={gwIdx} onChange={setGwIdx} />
          </div>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 6 }}>
            matches {useKg ? 'kg' : 'lbs'} above
          </p>
        </Section>

        {/* ── Gender ── */}
        <Section title="Gender">
          <div style={{ display: 'flex', gap: 10 }}>
            {genderOptions.map(g => {
              const sel = gender === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setGender(g.id)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    border: `2px solid ${sel ? '#F97316' : 'rgba(255,255,255,0.12)'}`,
                    backgroundColor: sel ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                    color: sel ? '#F97316' : 'rgba(255,255,255,0.6)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                  }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Activity Level ── */}
        <Section title="Activity Level">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activityOptions.map(opt => {
              const sel = activity === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setActivity(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: `1px solid ${sel ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    backgroundColor: sel ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: sel ? '#F97316' : '#fff', fontWeight: 700, fontSize: 14 }}>{opt.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{opt.desc}</div>
                  </div>
                  {sel && (
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', backgroundColor: '#F97316',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        <button
          onClick={handleNext}
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
            transition: 'all 0.2s ease',
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: '#111827',
        borderRadius: 16,
        padding: '16px 16px 20px',
        marginBottom: 16,
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700, marginBottom: 14, margin: '0 0 14px 0' }}>
        {title}
      </p>
      {children}
    </div>
  );
}
