import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { storage, DayTotals, GOFIT_UPDATED_EVENT } from '../utils/storage';
import { calcTargets } from '../utils/calculations';
import { UserProfile } from '../types';

// ─── Extended targets including weekly burn ────────────────────────────────────
function calcExtendedTargets(profile: UserProfile) {
  const base = calcTargets(profile);
  const weight = profile.currentWeightKg;
  const goal = profile.goal;
  const recommendedSessions = goal === 'lose' ? 4 : goal === 'muscle' ? 4 : 3;
  const ratePerKg = goal === 'lose' ? 8 : goal === 'muscle' ? 7 : 6;
  const raw = weight * ratePerKg;
  const clamped = Math.min(2500, Math.max(800, raw));
  const weeklyBurnTarget = Math.round(clamped / 50) * 50;
  const perSessionBurn = Math.round(weeklyBurnTarget / recommendedSessions / 50) * 50;
  const waterGoal = weight >= 80 ? 3.5 : weight >= 60 ? 3.0 : 2.5;
  return { ...base, weeklyBurnTarget, recommendedSessions, perSessionBurn, waterGoal };
}

// ─── Static data ──────────────────────────────────────────────────────────────
const EXERCISES = [
  { id: 'e1', emoji: '🏃', title: 'Running',        category: 'Cardio',    catColor: '#F97316' },
  { id: 'e2', emoji: '💪', title: 'Weight Training', category: 'Strength',  catColor: '#3B82F6' },
  { id: 'e3', emoji: '🔥', title: 'HIIT',            category: 'Belly Fat', catColor: '#FF6B35' },
  { id: 'e4', emoji: '🧘', title: 'Yoga',            category: 'Recovery',  catColor: '#10B981' },
];

const EA_FOODS = [
  { name: 'Ugali',       emoji: '🍚', cal: 320, country: 'Kenya',    flag: '🇰🇪' },
  { name: 'Matoke',      emoji: '🍌', cal: 210, country: 'Uganda',   flag: '🇺🇬' },
  { name: 'Nyama Choma', emoji: '🥩', cal: 280, country: 'Tanzania', flag: '🇹🇿' },
];

const MOCK_LEADERBOARD = [
  { points: 2840, isUser: false },
  { points: 1920, isUser: false },
  { points: 1640, isUser: false },
  { points: 0,    isUser: true  },
];

// ─── Sleep helpers ────────────────────────────────────────────────────────────
interface SleepEntry { duration: number; quality: 'great' | 'good' | 'fair' | 'poor' }

function sleepQualityEmoji(q: string) {
  return q === 'great' ? '😴' : q === 'good' ? '🙂' : q === 'fair' ? '😐' : '😩';
}
function fmtSleepDur(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}
function sleepBarColor(h: number) {
  return h >= 7 ? '#10B981' : h >= 6 ? '#F59E0B' : '#EF4444';
}

// ─── CalRing ──────────────────────────────────────────────────────────────────
function CalRing({ eaten, goal }: { eaten: number; goal: number }) {
  const size = 150;
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(eaten / Math.max(goal, 1), 1);
  const cx = size / 2;
  const cy = size / 2;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F97316" strokeWidth="8"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease-out' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#FFF', fontWeight: 800, fontSize: 22, lineHeight: '1.1' }}>{eaten}</span>
        <span style={{ color: '#F97316', fontSize: 11, fontWeight: 600 }}>{Math.max(goal - eaten, 0)} left</span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>kcal</span>
      </div>
    </div>
  );
}

// ─── MacroBar ─────────────────────────────────────────────────────────────────
function MacroBar({ label, icon, eaten, goal, color }: { label: string; icon: string; eaten: number; goal: number; color: string }) {
  const pct = Math.min(eaten / Math.max(goal, 1), 1);
  const pctInt = Math.round(pct * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>{icon}</span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500 }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{eaten}g / {goal}g</span>
          <span style={{ color, fontSize: 12, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>{pctInt}%</span>
        </div>
      </div>
      <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, backgroundColor: color, width: `${pctInt}%`, transition: 'width 0.8s ease-out' }} />
      </div>
    </div>
  );
}

// ─── WaterWidget ──────────────────────────────────────────────────────────────
function WaterWidget({ waterL, waterGoal, onAdjust }: { waterL: number; waterGoal: number; onAdjust: (d: number) => void }) {
  const goalCups = Math.round(waterGoal / 0.25);
  const cups = Math.round(waterL / 0.25);
  const pct = Math.min(cups / Math.max(goalCups, 1), 1);
  const done = cups >= goalCups;
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={CARD_TITLE}>💧 Water</span>
        <button style={{ color: '#F97316', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
          Edit Goal ›
        </button>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
        {/* Ring */}
        <div style={{ width: 80, height: 80, position: 'relative', flexShrink: 0 }}>
          <svg width={80} height={80} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
            <circle cx={40} cy={40} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={7} fill="none" />
            <circle cx={40} cy={40} r={R} stroke="#F97316" strokeWidth={7} fill="none"
              strokeDasharray={`${pct * C} ${C}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s ease-out' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#FFF', fontSize: 20, fontWeight: 800, lineHeight: '1.1' }}>{cups}</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textAlign: 'center' }}>of {goalCups} cups</span>
          </div>
        </div>
        {/* Drop icons */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {Array.from({ length: Math.min(goalCups, 12) }).map((_, i) => (
              <button key={i} onClick={() => onAdjust(0.25)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 18, opacity: i < cups ? 1 : 0.18 }}>
                💧
              </button>
            ))}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: 0 }}>
            {done ? 'Goal reached! Keep sipping 💪' : "Keep sipping! You've got this."}
          </p>
        </div>
      </div>
      {/* Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {([{ l: '-¼L', v: -0.25 }, { l: '+¼L', v: 0.25 }, { l: '+½L', v: 0.5 }, { l: '+1L', v: 1.0 }] as const).map(b => (
          <button key={b.l} onClick={() => onAdjust(b.v)} style={{
            padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            backgroundColor: b.v < 0 ? 'rgba(255,255,255,0.06)' : 'rgba(249,115,22,0.12)',
            border: `1px solid ${b.v < 0 ? 'rgba(255,255,255,0.08)' : 'rgba(249,115,22,0.3)'}`,
            color: b.v < 0 ? 'rgba(255,255,255,0.45)' : '#F97316',
          }}>{b.l}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Shared style constants ───────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.07)',
  marginBottom: 12,
};
const CARD_TITLE: React.CSSProperties = {
  color: '#FFFFFF',
  fontWeight: 700,
  fontSize: 15,
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
interface Props {
  profile: UserProfile;
  onNavigate: (tab: string) => void;
  onOpenDiary: () => void;
}

export default function Dashboard({ profile, onNavigate, onOpenDiary }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const targets = calcExtendedTargets(profile);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const [totals, setTotals] = useState<DayTotals>(() => storage.getDayTotals(today));
  const [waterL, setWaterL] = useState(() => storage.getTodayWaterLitres(today));
  const todaySleep: SleepEntry | null = null as SleepEntry | null;
  const weeklyBurned = 0;
  const userPoints = 0;
  const badgesEarned = 0;
  const confettiFiredRef = useRef(storage.hasWaterConfettiFired(today));

  const [mealItems, setMealItems] = useState(() => buildMealItems(today));

  function buildMealItems(date: string) {
    const log = storage.getFoodLog().filter(e => e.date === date);
    return (['breakfast', 'lunch', 'dinner', 'snacks'] as const).map(m => ({
      meal: m,
      items: log.filter(e => e.meal === m),
      total: log.filter(e => e.meal === m).reduce((s, e) => s + e.calories, 0),
    }));
  }

  useEffect(() => {
    setTotals(storage.getDayTotals(today));
    setWaterL(storage.getTodayWaterLitres(today));
    const handler = (e: Event) => {
      const { date } = (e as CustomEvent).detail as { date: string };
      if (date !== today) return;
      setTotals(storage.getDayTotals(today));
      setMealItems(buildMealItems(today));
    };
    window.addEventListener(GOFIT_UPDATED_EVENT, handler);
    return () => window.removeEventListener(GOFIT_UPDATED_EVENT, handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const adjustWater = (delta: number) => {
    const newVal = Math.max(0, Math.round((waterL + delta) * 100) / 100);
    setWaterL(newVal);
    storage.setTodayWaterLitres(today, newVal);
    if (newVal >= targets.waterGoal && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      storage.markWaterConfettiFired(today);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ['#F97316', '#ea580c', '#ffffff'] });
    }
  };

  const myRank = MOCK_LEADERBOARD.filter(u => u.points > userPoints).length + 1;

  const MEALS = [
    { meal: 'breakfast' as const, label: 'Breakfast', emoji: '🌅' },
    { meal: 'lunch'     as const, label: 'Lunch',     emoji: '☀️' },
    { meal: 'dinner'    as const, label: 'Dinner',    emoji: '🌙' },
    { meal: 'snacks'    as const, label: 'Snacks',    emoji: '🍎' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D0D1A', paddingBottom: 100 }}>
      <div style={{ padding: '0 16px' }}>

        {/* 1. HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 28, paddingBottom: 20 }}>
          <div>
            <img src="/Enhanced_Logo.PNG" alt="WeGoFit" style={{ width: 130, height: 50, objectFit: 'contain', display: 'block' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '6px 0 2px' }}>{greeting},</p>
            <h2 style={{ color: '#FFFFFF', fontWeight: 800, fontSize: 22, margin: 0 }}>
              {profile.name || 'Athlete'} 👋
            </h2>
          </div>
          <img
            src="/coach-welcome.png"
            alt="Coach TinaBarks"
            style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #F97316', objectFit: 'cover', flexShrink: 0, marginTop: 4 }}
          />
        </div>

        {/* 2. COACH TINABARKS BANNER */}
        <button onClick={() => onNavigate('coach')} style={{
          width: '100%', backgroundColor: '#F97316', borderRadius: 16,
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 12, border: 'none', cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ fontSize: 28, flexShrink: 0 }}>💪</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#FFF', fontWeight: 700, fontSize: 13, margin: '0 0 2px' }}>Coach TinaBarks</p>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, margin: '0 0 1px' }}>
              Coach TinaBarks is tracking your progress!
            </p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, margin: 0 }}>Stay consistent. Results follow.</p>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 22 }}>›</span>
        </button>

        {/* 3. CALORIE CARD */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 16 }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalRing eaten={totals.caloriesEaten} goal={targets.calories} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#FFF', fontWeight: 700, fontSize: 20, margin: 0, lineHeight: '1.2' }}>Ready to</p>
              <p style={{ color: '#F97316', fontWeight: 700, fontSize: 20, margin: '0 0 6px', lineHeight: '1.2' }}>crush today?</p>
              <div style={{ width: 28, height: 2, backgroundColor: '#F97316', borderRadius: 1, marginBottom: 8 }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '0 0 12px' }}>
                {targets.calories.toLocaleString()} kcal daily goal
              </p>
              <button onClick={() => onNavigate('train')} style={{
                backgroundColor: '#F97316', border: 'none', borderRadius: 12,
                padding: '9px 14px', color: '#FFF', fontWeight: 800, fontSize: 13,
                cursor: 'pointer', alignSelf: 'flex-start',
              }}>
                ⚡ Let's Go!
              </button>
            </div>
          </div>
          {/* Stats row */}
          <div style={{ display: 'flex', marginTop: 14, paddingTop: 14, borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ color: '#FFF', fontWeight: 700, fontSize: 16, margin: '0 0 2px' }}>🔥 {totals.caloriesBurned}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: 0 }}>burned</p>
            </div>
            <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ color: totals.netCalories > targets.calories ? '#EF4444' : '#F59E0B', fontWeight: 700, fontSize: 16, margin: '0 0 2px' }}>
                {totals.netCalories}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: 0 }}>net calories</p>
            </div>
          </div>
        </div>

        {/* 4. WEEKLY BURN GOAL */}
        <div style={CARD}>
          <p style={{ ...CARD_TITLE, margin: '0 0 10px' }}>🔥 Your Weekly Burn Goal</p>
          <p style={{ color: '#FFF', fontWeight: 700, fontSize: 18, margin: '0 0 2px' }}>
            {targets.weeklyBurnTarget.toLocaleString()} kcal this week
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '0 0 12px' }}>
            {targets.recommendedSessions} sessions · ~{targets.perSessionBurn.toLocaleString()} kcal per session
          </p>
          <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: 8, borderRadius: 4, backgroundColor: '#F97316', transition: 'width 1s ease-out',
              width: `${Math.min(100, Math.round((weeklyBurned / Math.max(targets.weeklyBurnTarget, 1)) * 100))}%`,
            }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
            {weeklyBurned.toLocaleString()} of {targets.weeklyBurnTarget.toLocaleString()} kcal burned
          </p>
        </div>

        {/* 5. MACROS */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={CARD_TITLE}>Macros</span>
            <button onClick={onOpenDiary} style={{ color: '#F97316', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
              View details ›
            </button>
          </div>
          <MacroBar label="Protein" icon="💪" eaten={Math.round(totals.proteinG)} goal={targets.proteinG} color="#F97316" />
          <MacroBar label="Carbs"   icon="🌾" eaten={Math.round(totals.carbsG)}   goal={targets.carbsG}   color="#F59E0B" />
          <MacroBar label="Fat"     icon="🥑" eaten={Math.round(totals.fatG)}     goal={targets.fatG}     color="#60A5FA" />
        </div>

        {/* 6. WATER WIDGET */}
        <WaterWidget waterL={waterL} waterGoal={targets.waterGoal} onAdjust={adjustWater} />

        {/* 7. SLEEP TRACKER */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: todaySleep ? 10 : 0 }}>
            <span style={CARD_TITLE}>🌙 Sleep Tracker</span>
            {todaySleep && (
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                {sleepQualityEmoji(todaySleep.quality)} {todaySleep.quality.charAt(0).toUpperCase() + todaySleep.quality.slice(1)}
              </span>
            )}
          </div>
          {todaySleep ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 8px' }}>
                <span style={{ color: '#F97316', fontWeight: 800, fontSize: 26 }}>{fmtSleepDur(todaySleep.duration)}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>last night</span>
              </div>
              <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 12 }}>
                <div style={{ height: 6, borderRadius: 3, width: `${Math.min(todaySleep.duration / 9 * 100, 100)}%`, backgroundColor: sleepBarColor(todaySleep.duration) }} />
              </div>
              <button style={{ width: '100%', backgroundColor: '#F97316', border: 'none', borderRadius: 10, padding: '10px 0', color: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Update Sleep
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '6px 0 14px' }}>
                How did you sleep last night?
              </p>
              <button style={{ width: '100%', backgroundColor: '#F97316', border: 'none', borderRadius: 10, padding: '10px 0', color: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                + Log Last Night's Sleep
              </button>
            </>
          )}
        </div>

        {/* 8. QUICK ACCESS */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ ...CARD_TITLE, margin: '0 0 10px' }}>Quick Access</p>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {[
              { emoji: '📖', label: 'Diary',     fn: () => onNavigate('nutrition') },
              { emoji: '🗓️', label: 'Meal Plan', fn: () => onNavigate('nutrition') },
              { emoji: '🌙', label: 'Sleep',      fn: () => {} },
              { emoji: '🎬', label: 'Videos',     fn: () => onNavigate('train') },
              { emoji: '🏆', label: 'Squad',      fn: () => onNavigate('train') },
            ].map(s => (
              <button key={s.label} onClick={s.fn} style={{
                minWidth: 76, padding: 14, backgroundColor: '#111827', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0,
              }}>
                <span style={{ fontSize: 26 }}>{s.emoji}</span>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600 }}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 9. TODAY'S MEALS */}
        <p style={{ ...CARD_TITLE, margin: '4px 0 10px' }}>Today's Meals</p>
        {MEALS.map(m => {
          const data = mealItems.find(x => x.meal === m.meal)!;
          const count = data?.items.length ?? 0;
          const total = data?.total ?? 0;
          return (
            <div key={m.meal} onClick={onOpenDiary} style={{
              ...CARD, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>{m.emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#FFF', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>{m.label}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
                  {count > 0 ? `${count} item${count > 1 ? 's' : ''} · ${total} cal` : `Tap to log ${m.label.toLowerCase()}`}
                </p>
              </div>
              <button onClick={e => { e.stopPropagation(); onOpenDiary(); }} style={{
                width: 30, height: 30, borderRadius: 15, backgroundColor: '#F97316',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ color: '#FFF', fontSize: 20, fontWeight: 800, lineHeight: '1' }}>+</span>
              </button>
            </div>
          );
        })}

        {/* 10. TRAIN SHORTCUT */}
        <div onClick={() => onNavigate('train')} style={{
          ...CARD, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginTop: 4,
        }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🔥</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#FFF', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>Train</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0 }}>
              {totals.caloriesBurned} cal burned today
            </p>
          </div>
          <span style={{ color: '#F97316', fontSize: 20 }}>›</span>
        </div>

        {/* 11. COACH BANNER CARD */}
        <div onClick={() => onNavigate('coach')} style={{
          ...CARD, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginTop: 8,
          backgroundColor: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.25)',
        }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>💬</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#FFF', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>Message Coach TinaBarks</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0 }}>Available 24/7 · WeGoFit Premium</p>
          </div>
          <span style={{ color: '#F97316', fontSize: 20 }}>›</span>
        </div>

        {/* 12. MY SQUAD RANK */}
        <div onClick={() => onNavigate('train')} style={{ ...CARD, cursor: 'pointer', marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ ...CARD_TITLE, fontSize: 14 }}>🏆 My Squad Rank</span>
            <span style={{ color: '#F97316', fontSize: 12, fontWeight: 600 }}>View →</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ textAlign: 'center', backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 12, padding: 10 }}>
              <p style={{ color: '#F97316', fontWeight: 800, fontSize: 20, margin: '0 0 2px' }}>{userPoints}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0 }}>WeGoFit Points</p>
            </div>
            <div style={{ textAlign: 'center', backgroundColor: '#1E2837', borderRadius: 12, padding: 10 }}>
              <p style={{ color: '#FFF', fontWeight: 800, fontSize: 20, margin: '0 0 2px' }}>{badgesEarned}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0 }}>Badges Earned</p>
            </div>
            <div style={{ textAlign: 'center', backgroundColor: '#1E2837', borderRadius: 12, padding: 10 }}>
              <p style={{ color: '#F59E0B', fontWeight: 800, fontSize: 20, margin: '0 0 2px' }}>#{myRank}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0 }}>This Week</p>
            </div>
          </div>
        </div>

        {/* 13. EXERCISE LIBRARY */}
        <div style={{ marginTop: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <p style={{ ...CARD_TITLE, margin: 0 }}>Exercise Library</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '2px 0 0' }}>Form & technique guides</p>
            </div>
            <button onClick={() => onNavigate('train')} style={{ color: '#F97316', fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
              See all →
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {EXERCISES.map(ex => (
              <button key={ex.id} onClick={() => onNavigate('train')} style={{
                minWidth: 145, height: 115, backgroundColor: '#111827', borderRadius: 14,
                padding: 14, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 30, marginBottom: 6 }}>{ex.emoji}</span>
                <p style={{ color: '#FFF', fontSize: 13, fontWeight: 700, margin: '0 0 6px', textAlign: 'center' }}>{ex.title}</p>
                <span style={{ backgroundColor: ex.catColor, borderRadius: 10, padding: '3px 8px', color: '#FFF', fontSize: 11, fontWeight: 700 }}>
                  {ex.category}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 14. EAST AFRICAN FOODS */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <p style={{ ...CARD_TITLE, margin: 0 }}>East African Foods</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '2px 0 0' }}>50 local foods tracked</p>
            </div>
            <button onClick={onOpenDiary} style={{ color: '#F97316', fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
              Browse all →
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {EA_FOODS.map(food => (
              <button key={food.name} onClick={onOpenDiary} style={{
                minWidth: 125, backgroundColor: '#111827', borderRadius: 14, padding: 12,
                border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                flexShrink: 0, textAlign: 'left',
              }}>
                <span style={{ fontSize: 28, marginBottom: 6 }}>{food.emoji}</span>
                <p style={{ color: '#FFF', fontSize: 13, fontWeight: 700, margin: '0 0 2px', lineHeight: 1.3 }}>{food.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: '0 0 4px' }}>{food.cal} cal</p>
                <p style={{ color: '#F97316', fontSize: 11, fontWeight: 600, margin: 0 }}>{food.flag} {food.country}</p>
              </button>
            ))}
            <button onClick={onOpenDiary} style={{
              minWidth: 95, backgroundColor: 'rgba(249,115,22,0.10)', borderRadius: 14, padding: 12,
              border: '1px solid rgba(249,115,22,0.25)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ color: '#F97316', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>+</span>
              <span style={{ color: '#F97316', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>See all 50 foods</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
