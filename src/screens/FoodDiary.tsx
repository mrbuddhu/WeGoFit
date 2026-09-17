import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, X, Trash2, RotateCcw, Sparkles } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { storage, DayTotals, GOFIT_UPDATED_EVENT } from '../utils/storage';
import { calcTargets } from '../utils/calculations';
import { fetchNutrition, NutritionResult } from '../services/nutritionService';
import { FoodLogEntry, UserProfile } from '../types';

interface Props {
  profile: UserProfile;
}

type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
type SubTab = 'diary' | 'water' | 'mealplan' | 'targets';

const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const MEAL_ICONS: Record<Meal, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snacks: '🍎',
};

type FetchState = 'idle' | 'loading' | 'success' | 'error';

const ERROR_MESSAGES: Record<string, { text: string; canRetry: boolean }> = {
  FOOD_NOT_FOUND: {
    text: "Couldn't recognize that food. Try: '2 boiled eggs' or '100g chicken breast'",
    canRetry: false,
  },
  QUOTA_EXCEEDED: {
    text: 'AI limit reached. Switching to offline food list.',
    canRetry: false,
  },
  API_ERROR: {
    text: 'Connection issue. Check your internet and try again.',
    canRetry: true,
  },
  PARSE_ERROR: {
    text: 'Something went wrong. Please try again.',
    canRetry: true,
  },
};

const QUICK_PICKS = [
  '2 eggs', 'Chicken 100g', 'Rice 1 cup',
  'Banana', 'Chapati', 'Black tea with milk',
];

// ─── Shared style helpers ─────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.07)',
  marginBottom: 12,
};

// ─── FoodDiary sub-components ─────────────────────────────────────────────────
function MacroMiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function NutritionCard({ result }: { result: NutritionResult }) {
  return (
    <div className="glass-card p-4 mb-4" style={{ animation: 'slideUp 0.35s ease-out forwards' }}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-base">🍽️</span>
            <h3 className="font-heading text-base font-bold text-white leading-tight truncate">{result.foodName}</h3>
          </div>
          <p className="text-white/40 text-xs">{result.servingDescription}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-heading text-3xl font-bold leading-none" style={{ color: '#F97316' }}>{result.calories}</div>
          <div className="text-white/40 text-xs">kcal</div>
        </div>
      </div>
      <div className="border-t border-white/8 mt-3 pt-3">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Protein', value: result.protein,  max: 60,  color: '#F97316' },
            { label: 'Carbs',   value: result.carbs,    max: 100, color: '#3B82F6' },
            { label: 'Fat',     value: result.fat,      max: 50,  color: '#F59E0B' },
            { label: 'Fiber',   value: result.fiber,    max: 30,  color: '#8B5CF6' },
          ].map(m => (
            <div key={m.label} className="bg-white/5 rounded-xl p-2.5">
              <div className="font-bold text-sm text-white">{m.value}g</div>
              <MacroMiniBar value={m.value} max={m.max} color={m.color} />
              <div className="text-white/40 text-xs mt-1">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 text-xs text-white/40">
          <span>Sugar: <span className="text-white/60">{result.sugar}g</span></span>
          <span>·</span>
          <span>Sodium: <span className="text-white/60">{result.sodium}mg</span></span>
        </div>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="glass-card p-4 mb-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="h-4 bg-white/10 rounded-lg w-3/4 mb-2" />
          <div className="h-3 bg-white/8 rounded-lg w-1/2" />
        </div>
        <div className="h-8 w-14 rounded-lg" style={{ backgroundColor: 'rgba(249,115,22,0.2)' }} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map(i => <div key={i} className="bg-white/5 rounded-xl p-2.5 h-14" />)}
      </div>
    </div>
  );
}

function FoodModal({ meal, onClose, onAdd }: {
  meal: Meal;
  onClose: () => void;
  onAdd: (entry: Omit<FoodLogEntry, 'id' | 'date' | 'meal'>) => void;
}) {
  const [query, setQuery] = useState('');
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [nutrition, setNutrition] = useState<NutritionResult | null>(null);
  const [errorCode, setErrorCode] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runFetch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setFetchState('loading');
    setNutrition(null);
    setErrorCode('');
    try {
      const result = await fetchNutrition(trimmed);
      setNutrition(result);
      setFetchState('success');
    } catch (err) {
      setErrorCode(err instanceof Error ? err.message : 'UNKNOWN');
      setFetchState('error');
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setFetchState('idle');
    setNutrition(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => runFetch(val), 800);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runFetch(query);
    }
  };

  const handleQuickPick = (pick: string) => {
    setQuery(pick);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runFetch(pick);
  };

  const handleAdd = () => {
    if (!nutrition) return;
    onAdd({
      foodId: `ai-${Date.now()}`,
      foodName: nutrition.foodName,
      servings: 1,
      calories: nutrition.calories,
      proteinG: nutrition.protein,
      carbsG: nutrition.carbs,
      fatG: nutrition.fat,
    });
    onClose();
  };

  const errorInfo = ERROR_MESSAGES[errorCode] ?? { text: 'Unknown error. Please try again.', canRetry: true };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col justify-end">
      <div className="border border-white/10 rounded-t-3xl flex flex-col max-h-[92vh]"
        style={{ background: 'linear-gradient(180deg, #142233 0%, #0D1B2A 100%)' }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-5 pt-2 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading text-xl font-bold text-white">
                Add Food to {meal.charAt(0).toUpperCase() + meal.slice(1)}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Sparkles size={11} style={{ color: '#F97316' }} />
                <span className="text-xs" style={{ color: 'rgba(249,115,22,0.8)' }}>AI-powered nutrition analysis</span>
              </div>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white p-1.5 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <input
              ref={inputRef}
              className="input-field pl-9 pr-10"
              placeholder='Describe what you ate... e.g. "2 eggs"'
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {query.length > 0 && (
              <button
                onClick={() => { setQuery(''); setFetchState('idle'); setNutrition(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <p className="text-white/30 text-xs mt-1.5 pl-1">
            e.g. "2 eggs" · "bowl of ugali with beef" · "500ml mango juice"
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {fetchState === 'idle' && !nutrition && (
            <div className="mb-4">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">Quick Picks</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PICKS.map(pick => (
                  <button key={pick} onClick={() => handleQuickPick(pick)}
                    className="px-3 py-1.5 rounded-full bg-white/8 border border-white/15 text-white/70 text-xs transition-all active:scale-95"
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(249,115,22,0.15)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(249,115,22,0.4)';
                      (e.currentTarget as HTMLButtonElement).style.color = '#F97316';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '';
                      (e.currentTarget as HTMLButtonElement).style.color = '';
                    }}
                  >
                    {pick}
                  </button>
                ))}
              </div>
            </div>
          )}

          {fetchState === 'loading' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#F97316' }} />
                <span className="text-xs font-medium" style={{ color: 'rgba(249,115,22,0.8)' }}>Analyzing with AI...</span>
              </div>
              <SkeletonLoader />
            </div>
          )}

          {fetchState === 'success' && nutrition && (
            <>
              <NutritionCard result={nutrition} />
              <button onClick={handleAdd} className="btn-primary w-full py-4 text-base font-bold glow-green">
                Add to {meal.charAt(0).toUpperCase() + meal.slice(1)}
              </button>
              <button
                onClick={() => { setQuery(''); setFetchState('idle'); setNutrition(null); }}
                className="w-full py-2.5 text-white/40 text-sm hover:text-white/60 transition-colors mt-1"
              >
                Search for a different food
              </button>
            </>
          )}

          {fetchState === 'error' && (
            <div className="glass-card p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">
                  {errorCode === 'FOOD_NOT_FOUND' ? '🤔' : errorCode === 'QUOTA_EXCEEDED' ? '⚠️' : '📡'}
                </div>
                <div className="flex-1">
                  <p className="text-white/80 text-sm leading-relaxed">{errorInfo.text}</p>
                  {errorInfo.canRetry && (
                    <button onClick={() => runFetch(query)}
                      className="flex items-center gap-1.5 mt-3 text-sm hover:opacity-80 transition-colors"
                      style={{ color: '#F97316' }}>
                      <RotateCcw size={13} /> Try again
                    </button>
                  )}
                  {!errorInfo.canRetry && (
                    <button
                      onClick={() => { setQuery(''); setFetchState('idle'); setNutrition(null); }}
                      className="flex items-center gap-1.5 mt-3 text-white/50 text-sm hover:text-white/70 transition-colors"
                    >
                      <ChevronLeft size={13} /> Try a different description
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Water tab ────────────────────────────────────────────────────────────────
function WaterTab({ profile }: { profile: UserProfile }) {
  const today = new Date().toISOString().split('T')[0];
  const weight = profile.currentWeightKg;
  const waterGoal = weight >= 80 ? 3.5 : weight >= 60 ? 3.0 : 2.5;
  const goalCups = Math.round(waterGoal / 0.25);

  const [waterL, setWaterL] = useState(() => storage.getTodayWaterLitres(today));
  const confettiFiredRef = useRef(storage.hasWaterConfettiFired(today));

  const cups = Math.round(waterL / 0.25);
  const pct = Math.min(cups / Math.max(goalCups, 1), 1);
  const done = cups >= goalCups;
  const R = 34;
  const C = 2 * Math.PI * R;

  const adjust = (delta: number) => {
    const newVal = Math.max(0, Math.round((waterL + delta) * 100) / 100);
    setWaterL(newVal);
    storage.setTodayWaterLitres(today, newVal);
    if (newVal >= waterGoal && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      storage.markWaterConfettiFired(today);
    }
  };

  return (
    <div style={{ padding: '0 16px 32px' }}>
      <div style={CARD}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ color: '#FFF', fontWeight: 700, fontSize: 16 }}>💧 Water</span>
          <button style={{ color: '#F97316', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
            Edit Goal ›
          </button>
        </div>

        {/* Ring + drops row */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          {/* SVG ring */}
          <div style={{ width: 88, height: 88, position: 'relative', flexShrink: 0 }}>
            <svg width={88} height={88} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
              <circle cx={44} cy={44} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={8} fill="none" />
              <circle cx={44} cy={44} r={R} stroke="#F97316" strokeWidth={8} fill="none"
                strokeDasharray={`${pct * C} ${C}`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.5s ease-out' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#FFF', fontSize: 22, fontWeight: 800, lineHeight: '1.1' }}>{cups}</span>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textAlign: 'center' }}>of {goalCups} cups</span>
            </div>
          </div>

          {/* Drop icons */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {Array.from({ length: Math.min(goalCups, 16) }).map((_, i) => (
                <button key={i} onClick={() => adjust(0.25)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 20, opacity: i < cups ? 1 : 0.18 }}>
                  💧
                </button>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
              {done ? 'Goal reached! Keep sipping 💪' : "Keep sipping! You've got this."}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{
            height: '100%', borderRadius: 3, backgroundColor: '#F97316',
            width: `${Math.min(pct * 100, 100)}%`, transition: 'width 0.5s ease-out',
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            {waterL.toFixed(2)}L / {waterGoal.toFixed(1)}L today
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {([
            { l: '-¼L', v: -0.25 },
            { l: '+¼L', v: 0.25 },
            { l: '+½L', v: 0.5 },
            { l: '+1L', v: 1.0 },
          ] as const).map(b => (
            <button key={b.l} onClick={() => adjust(b.v)} style={{
              padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              backgroundColor: b.v < 0 ? 'rgba(255,255,255,0.06)' : 'rgba(249,115,22,0.12)',
              border: `1px solid ${b.v < 0 ? 'rgba(255,255,255,0.08)' : 'rgba(249,115,22,0.3)'}`,
              color: b.v < 0 ? 'rgba(255,255,255,0.45)' : '#F97316',
            }}>
              {b.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Meal Plan tab ────────────────────────────────────────────────────────────
function MealPlanTab() {
  return (
    <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32 }}>
      <div style={{ ...CARD, width: '100%', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗓️</div>
        <h3 style={{ color: '#FFF', fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>
          Your Weekly Meal Plan
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
          Personalised by Coach TinaBarks based on your goals and lifestyle
        </p>
        <button style={{
          width: '100%', backgroundColor: '#F97316', border: 'none', borderRadius: 12,
          padding: '14px 0', color: '#FFF', fontWeight: 700, fontSize: 15, cursor: 'pointer',
        }}>
          Generate My Plan →
        </button>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '12px 0 0', textAlign: 'center' }}>
          Coach TinaBarks personally reviews every meal plan 🌸
        </p>
      </div>
    </div>
  );
}

// ─── Targets tab ─────────────────────────────────────────────────────────────
function TargetsTab({ profile }: { profile: UserProfile }) {
  const targets = calcTargets(profile);
  const weight = profile.currentWeightKg;
  const waterGoal = weight >= 80 ? 3.5 : weight >= 60 ? 3.0 : 2.5;

  const rows = [
    { icon: '🔥', label: 'Daily Calories', value: `${targets.calories.toLocaleString()} kcal` },
    { icon: '🥩', label: 'Protein Target',  value: `${targets.proteinG}g` },
    { icon: '🍞', label: 'Carbs Target',    value: `${targets.carbsG}g` },
    { icon: '🥑', label: 'Fat Target',      value: `${targets.fatG}g` },
    { icon: '💧', label: 'Water Goal',      value: `${waterGoal.toFixed(1)}L daily` },
  ];

  return (
    <div style={{ padding: '0 16px 32px' }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: '#FFF', fontWeight: 700, fontSize: 18, margin: '0 0 4px' }}>
          Your Nutrition Targets
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
          Calculated using Mifflin-St Jeor formula
        </p>
      </div>

      {rows.map(row => (
        <div key={row.label} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
          padding: 16, marginBottom: 10, border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            {row.icon}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 500, flex: 1 }}>
            {row.label}
          </span>
          <span style={{ color: '#F97316', fontSize: 15, fontWeight: 700 }}>
            {row.value}
          </span>
        </div>
      ))}

      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        Targets update automatically when you update your profile.
      </p>
    </div>
  );
}

// ─── Main FoodDiary component ─────────────────────────────────────────────────
export default function FoodDiary({ profile }: Props) {
  const [activeTab, setActiveTab] = useState<SubTab>('diary');

  // Diary state
  const [date, setDate] = useState(new Date());
  const dateStr = format(date, 'yyyy-MM-dd');
  const targets = calcTargets(profile);

  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [totals, setTotals] = useState<DayTotals>(() => storage.getDayTotals(dateStr));
  const [addingMeal, setAddingMeal] = useState<Meal | null>(null);

  const refreshEntries = (ds: string) => {
    setEntries(storage.getFoodLog().filter(e => e.date === ds));
    setTotals(storage.getDayTotals(ds));
  };

  useEffect(() => { refreshEntries(dateStr); }, [dateStr]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { date: string };
      if (detail.date === dateStr) {
        setEntries(storage.getFoodLog().filter(e => e.date === dateStr));
        setTotals(storage.getDayTotals(dateStr));
      }
    };
    window.addEventListener(GOFIT_UPDATED_EVENT, handler);
    return () => window.removeEventListener(GOFIT_UPDATED_EVENT, handler);
  }, [dateStr]);

  const handleAdd = (meal: Meal) => (entryData: Omit<FoodLogEntry, 'id' | 'date' | 'meal'>) => {
    const entry: FoodLogEntry = {
      ...entryData,
      id: `${Date.now()}-${Math.random()}`,
      date: dateStr,
      meal,
    };
    storage.addFoodEntry(entry);
    setAddingMeal(null);
  };

  const handleRemove = (id: string) => { storage.removeFoodEntry(id); };
  const isToday = dateStr === new Date().toISOString().split('T')[0];

  const SUB_TABS: { key: SubTab; label: string }[] = [
    { key: 'diary',    label: '🍽️ Diary' },
    { key: 'water',    label: '💧 Water' },
    { key: 'mealplan', label: '🗓️ Meal Plan' },
    { key: 'targets',  label: '🎯 Targets' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D0D1A', paddingBottom: 100 }}>

      {/* Page title */}
      <div style={{ padding: '28px 16px 12px' }}>
        <h1 style={{ color: '#FFF', fontWeight: 800, fontSize: 22, margin: 0 }}>Nutrition</h1>
      </div>

      {/* Sub-tab pill selector */}
      <div style={{ margin: '0 16px 16px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4, display: 'flex', gap: 2 }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 11,
              fontWeight: activeTab === tab.key ? 700 : 500, border: 'none', cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: activeTab === tab.key ? '#F97316' : 'rgba(255,255,255,0.4)',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: DIARY ── */}
      {activeTab === 'diary' && (
        <div>
          {/* Date nav */}
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', marginBottom: 0 }}>
              <button onClick={() => setDate(subDays(date, 1))} className="text-white/60 hover:text-white p-1 transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#FFF', fontWeight: 600 }}>{isToday ? 'Today' : format(date, 'EEE, MMM d')}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{format(date, 'MMMM d, yyyy')}</div>
              </div>
              <button onClick={() => setDate(addDays(date, 1))} className="text-white/60 hover:text-white p-1 transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div style={{ padding: '0 16px' }}>
            {/* Meal sections */}
            {MEAL_ORDER.map(meal => {
              const mealEntries = entries.filter(e => e.meal === meal);
              const mealCal = mealEntries.reduce((s, e) => s + e.calories, 0);
              return (
                <div key={meal} style={CARD}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{MEAL_ICONS[meal]}</span>
                      <div>
                        <span style={{ color: '#FFF', fontWeight: 600, fontSize: 15, textTransform: 'capitalize' }}>{meal}</span>
                        {mealCal > 0 && (
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400, fontSize: 14 }}> — {mealCal} cal</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setAddingMeal(meal)}
                      style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.2)', border: 'none', cursor: 'pointer' }}>
                      <Plus size={16} style={{ color: '#F97316' }} />
                    </button>
                  </div>

                  {mealEntries.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {mealEntries.map(entry => (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#FFF', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.foodName}</div>
                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                              {entry.servings} serving{entry.servings !== 1 ? 's' : ''} · P{entry.proteinG}g C{entry.carbsG}g F{entry.fatG}g
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                            <span style={{ color: '#FFF', fontWeight: 600, fontSize: 14 }}>{entry.calories}</span>
                            <button onClick={() => handleRemove(entry.id)} className="p-1 text-white/30 hover:text-red-400 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {mealEntries.length === 0 && (
                    <button onClick={() => setAddingMeal(meal)}
                      style={{ width: '100%', padding: '12px 0', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 12, color: 'rgba(255,255,255,0.3)', fontSize: 14, backgroundColor: 'transparent', cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)'; }}
                    >
                      + Add food
                    </button>
                  )}
                </div>
              );
            })}

            {/* Daily totals */}
            <div style={CARD}>
              <h3 style={{ color: '#FFF', fontWeight: 700, fontSize: 15, margin: '0 0 12px' }}>Daily Totals</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Calories', val: totals.caloriesEaten,           target: targets.calories, unit: '' },
                  { label: 'Protein',  val: Math.round(totals.proteinG),    target: targets.proteinG, unit: 'g' },
                  { label: 'Carbs',    val: Math.round(totals.carbsG),      target: targets.carbsG,   unit: 'g' },
                  { label: 'Fat',      val: Math.round(totals.fatG),        target: targets.fatG,     unit: 'g' },
                ].map(m => (
                  <div key={m.label} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
                    <div style={{ color: '#FFF', fontSize: 14, fontWeight: 700 }}>{m.val}{m.unit}</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>/ {m.target}{m.unit}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="fixed bottom-16 left-0 right-0 z-20 max-w-lg mx-auto"
            style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <div style={{ margin: '0 12px 4px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(13,13,26,0.9)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: '#F97316', fontWeight: 700, fontSize: 14 }}>{totals.caloriesEaten}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Eaten</div>
              </div>
              <div style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: 14 }}>{totals.caloriesBurned}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Burned</div>
              </div>
              <div style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: totals.netCalories > targets.calories ? '#EF4444' : '#FFF', fontWeight: 700, fontSize: 14 }}>{totals.netCalories}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Net</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: WATER ── */}
      {activeTab === 'water' && <WaterTab profile={profile} />}

      {/* ── TAB 3: MEAL PLAN ── */}
      {activeTab === 'mealplan' && <MealPlanTab />}

      {/* ── TAB 4: TARGETS ── */}
      {activeTab === 'targets' && <TargetsTab profile={profile} />}

      {/* Food add modal */}
      {addingMeal && (
        <FoodModal
          meal={addingMeal}
          onClose={() => setAddingMeal(null)}
          onAdd={handleAdd(addingMeal)}
        />
      )}
    </div>
  );
}
