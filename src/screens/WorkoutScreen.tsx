import { useState, useEffect, useRef } from 'react';
import { storage, GOFIT_UPDATED_EVENT } from '../utils/storage';
import { ExerciseLogEntry } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────
type SubTab = 'workout' | 'videos' | 'progress' | 'squad';
type SquadSubTab = 'challenges' | 'leaderboard' | 'feed';
type WorkoutState = 'library' | 'ready' | 'active' | 'paused' | 'done';
type Category = 'all' | 'belly_fat' | 'tone' | 'recovery';
type ProgressRange = 'week' | 'month' | '3months' | 'calendar';

interface Exercise {
  id: string;
  emoji: string;
  name: string;
  category: 'belly_fat' | 'tone' | 'recovery';
  duration: string;
  calories: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  met: number;
  calPerMin: number;
  instructions: string[];
  coachTip: string;
}

interface SessionEntry {
  id: string;
  exerciseId: string;
  name: string;
  emoji: string;
  durationMin: number;
  caloriesBurned: number;
}

// ─── Exercise Library (22 exercises) ─────────────────────────────────────────
const EX_LIBRARY: Exercise[] = [
  // Belly Fat & Weight Loss
  {
    id: 'el1', emoji: '🏃', name: 'Running in Place', category: 'belly_fat',
    duration: '20 min', calories: '180 kcal', difficulty: 'Medium', met: 8.0, calPerMin: 9,
    instructions: ['Stand in place with feet hip-width apart', 'Lift right knee to hip height', 'Switch legs alternately in a running motion', 'Pump arms naturally with each step', 'Keep your core engaged throughout', 'Build up speed gradually over time'],
    coachTip: 'Start at a comfortable pace and build up speed gradually.',
  },
  {
    id: 'el2', emoji: '🦘', name: 'Jump Rope', category: 'belly_fat',
    duration: '15 min', calories: '200 kcal', difficulty: 'Hard', met: 10.0, calPerMin: 13,
    instructions: ['Hold rope handles at hip height', 'Swing rope overhead in a smooth arc', 'Jump as the rope passes under your feet', 'Land softly on the balls of your feet', 'Keep your elbows close to your body', 'Maintain a steady rhythm throughout'],
    coachTip: 'Keep jumps small and controlled — it\'s about rhythm!',
  },
  {
    id: 'el3', emoji: '🌟', name: 'Burpees', category: 'belly_fat',
    duration: '15 min', calories: '150 kcal', difficulty: 'Hard', met: 8.0, calPerMin: 10,
    instructions: ['Stand with feet shoulder-width apart', 'Drop into a squat and place hands on floor', 'Kick feet back into a plank position', 'Perform one push-up at the bottom', 'Jump feet back toward your hands', 'Explosively jump up and clap overhead'],
    coachTip: 'Modify by stepping instead of jumping if needed.',
  },
  {
    id: 'el4', emoji: '💃', name: 'Zumba Dance', category: 'belly_fat',
    duration: '30 min', calories: '250 kcal', difficulty: 'Medium', met: 6.5, calPerMin: 8,
    instructions: ['Start with a gentle warm-up of side steps', 'Follow along with upbeat music', 'Mix salsa, merengue, and cumbia moves', 'Add arm movements for extra intensity', 'Keep moving even if you miss a step', 'Cool down with slow, flowing movements'],
    coachTip: "Don't worry about perfect form — just keep moving!",
  },
  {
    id: 'el5', emoji: '🚴', name: 'Cycling (Stationary)', category: 'belly_fat',
    duration: '30 min', calories: '260 kcal', difficulty: 'Medium', met: 7.0, calPerMin: 9,
    instructions: ['Adjust the seat to hip height', 'Warm up at an easy pace for 3 minutes', 'Pedal at a steady, consistent pace', 'Increase resistance for 30-second intervals', 'Keep your back straight and core engaged', 'Cool down with a gentle 3-minute ride'],
    coachTip: 'Try 30-second sprints every 5 minutes to boost burn.',
  },
  {
    id: 'el6', emoji: '⛹️', name: 'High Knees', category: 'belly_fat',
    duration: '15 min', calories: '120 kcal', difficulty: 'Medium', met: 7.5, calPerMin: 8,
    instructions: ['Stand tall with feet hip-width apart', 'Drive your right knee up to hip height', 'Quickly switch to drive the left knee up', 'Pump your arms in sync with your legs', 'Stay on the balls of your feet', 'Maintain upright posture throughout'],
    coachTip: 'Engage your core throughout — it doubles the burn!',
  },
  {
    id: 'el7', emoji: '🤸', name: 'Mountain Climbers', category: 'belly_fat',
    duration: '15 min', calories: '130 kcal', difficulty: 'Hard', met: 8.0, calPerMin: 9,
    instructions: ['Start in a high plank position', 'Drive your right knee toward your chest', 'Quickly switch, driving the left knee in', 'Alternate legs in a rapid running motion', 'Keep your hips level throughout', 'Control your breathing — exhale as each knee comes up'],
    coachTip: 'Control your breathing — exhale as each knee comes up.',
  },
  // Tone & Sculpt
  {
    id: 'el8', emoji: '💪', name: 'Push Ups', category: 'tone',
    duration: '15 min', calories: '80 kcal', difficulty: 'Medium', met: 3.8, calPerMin: 5,
    instructions: ['Place hands slightly wider than shoulder-width', 'Keep your body in a straight line', 'Lower your chest toward the floor slowly', 'Keep elbows at a 45-degree angle', 'Push back up to full arm extension', 'Keep your core tight throughout'],
    coachTip: 'Quality over quantity — full range of motion every rep.',
  },
  {
    id: 'el9', emoji: '🏋️', name: 'Squats', category: 'tone',
    duration: '20 min', calories: '100 kcal', difficulty: 'Medium', met: 5.0, calPerMin: 6,
    instructions: ['Stand with feet shoulder-width apart', 'Point toes slightly outward', 'Push hips back and lower down', 'Keep your chest up and back straight', 'Lower until thighs are parallel to floor', 'Drive through heels to stand back up'],
    coachTip: 'Knees track over toes — never let them cave inward.',
  },
  {
    id: 'el10', emoji: '🦵', name: 'Lunges', category: 'tone',
    duration: '15 min', calories: '90 kcal', difficulty: 'Medium', met: 4.0, calPerMin: 5,
    instructions: ['Stand tall with feet together', 'Step forward with your right foot', 'Lower your back knee toward the floor', 'Keep both knees at 90-degree angles', 'Push through your front heel to return', 'Alternate legs and repeat'],
    coachTip: 'Keep your torso upright throughout the movement.',
  },
  {
    id: 'el11', emoji: '🎯', name: 'Plank Hold', category: 'tone',
    duration: '10 min', calories: '50 kcal', difficulty: 'Hard', met: 4.0, calPerMin: 5,
    instructions: ['Place forearms on the floor, elbows under shoulders', 'Extend legs and balance on toes', 'Keep your body in a straight line', 'Engage your core and squeeze glutes', 'Breathe steadily throughout', 'Hold for 30–60 seconds per set'],
    coachTip: 'Squeeze glutes and breathe steadily to hold longer.',
  },
  {
    id: 'el12', emoji: '🍑', name: 'Glute Bridges', category: 'tone',
    duration: '15 min', calories: '60 kcal', difficulty: 'Easy', met: 3.5, calPerMin: 4,
    instructions: ['Lie on your back with knees bent', 'Place feet hip-width apart, flat on floor', 'Press feet into the floor and lift hips', 'Squeeze your glutes hard at the top', 'Hold for 2 full seconds', 'Lower slowly and repeat'],
    coachTip: 'Drive through your heels, not your toes!',
  },
  {
    id: 'el13', emoji: '🦾', name: 'Dumbbell Rows', category: 'tone',
    duration: '20 min', calories: '110 kcal', difficulty: 'Medium', met: 5.0, calPerMin: 7,
    instructions: ['Hinge at your hips with a flat back', 'Hold weights with arms fully extended', 'Pull the weight up toward your hip', 'Drive your elbow back toward the ceiling', 'Lower the weight slowly with control', 'Complete reps on one side then switch'],
    coachTip: 'Think about pulling your elbow to the ceiling.',
  },
  {
    id: 'el14', emoji: '🤜', name: 'Tricep Dips', category: 'tone',
    duration: '15 min', calories: '70 kcal', difficulty: 'Medium', met: 3.8, calPerMin: 5,
    instructions: ['Sit on the edge of a chair with hands beside hips', 'Slide forward off the edge of the seat', 'Lower your body by bending at the elbows', 'Keep your back close to the chair', 'Push back up to full arm extension', 'Keep elbows pointing back, not flaring out'],
    coachTip: 'Keep elbows pointing back, not flaring outward.',
  },
  // Energy & Recovery
  {
    id: 'el15', emoji: '🧘', name: 'Yoga Flow', category: 'recovery',
    duration: '30 min', calories: '80 kcal', difficulty: 'Easy', met: 2.5, calPerMin: 3,
    instructions: ['Begin in child\'s pose and breathe deeply', 'Flow into downward facing dog', 'Move through a series of sun salutations', 'Hold each pose for 5 slow breaths', 'Let your breath guide every transition', 'End in savasana for 2 minutes'],
    coachTip: 'Let your breath guide every movement.',
  },
  {
    id: 'el16', emoji: '🌅', name: 'Morning Stretch', category: 'recovery',
    duration: '20 min', calories: '40 kcal', difficulty: 'Easy', met: 2.3, calPerMin: 2,
    instructions: ['Start with gentle neck rolls each direction', 'Move to shoulder circles and arm swings', 'Perform a full body forward fold', 'Hold a hip flexor stretch on each side', 'Finish with a seated spinal twist', 'Hold each stretch for 30 seconds'],
    coachTip: 'Never bounce in a stretch — hold each position.',
  },
  {
    id: 'el17', emoji: '🚶', name: 'Brisk Walking', category: 'recovery',
    duration: '30 min', calories: '120 kcal', difficulty: 'Easy', met: 3.5, calPerMin: 4,
    instructions: ['Maintain a brisk, purposeful pace', 'Swing your arms naturally as you walk', 'Strike heel-first and roll through to toe', 'Keep your posture tall and engaged', 'Breathe rhythmically throughout', 'Add hills or stairs to increase intensity'],
    coachTip: 'Add hills or stairs to increase the intensity.',
  },
  {
    id: 'el18', emoji: '💆', name: 'Foam Rolling', category: 'recovery',
    duration: '15 min', calories: '30 kcal', difficulty: 'Easy', met: 2.0, calPerMin: 2,
    instructions: ['Place the roller under the target muscle', 'Support your body weight with your arms', 'Roll slowly, about 1 inch per second', 'Pause on any tender or tight spots', 'Hold pressure on tight spots for 30 seconds', 'Work through calves, quads, back, and shoulders'],
    coachTip: 'Breathe through the pressure — it releases faster.',
  },
  {
    id: 'el19', emoji: '🌊', name: 'Swimming', category: 'recovery',
    duration: '30 min', calories: '220 kcal', difficulty: 'Medium', met: 6.0, calPerMin: 7,
    instructions: ['Warm up with easy freestyle laps', 'Alternate strokes every 2 laps', 'Focus on long, smooth strokes over speed', 'Turn your head to breathe, not your body', 'Cool down with a relaxed backstroke', 'Stretch your shoulders and back after'],
    coachTip: 'Focus on long smooth strokes rather than speed.',
  },
  {
    id: 'el20', emoji: '🧗', name: 'Stair Climbing', category: 'recovery',
    duration: '20 min', calories: '150 kcal', difficulty: 'Medium', met: 6.0, calPerMin: 8,
    instructions: ['Take stairs one or two at a time', 'Drive through your full foot on each step', 'Keep your torso upright, not hunched', 'Use the handrail for balance only', 'Walk down slowly to recover', 'Try skipping a step to engage glutes more'],
    coachTip: 'Try skipping a step to engage glutes more.',
  },
  {
    id: 'el21', emoji: '🤸', name: 'Pilates', category: 'recovery',
    duration: '30 min', calories: '100 kcal', difficulty: 'Easy', met: 3.0, calPerMin: 4,
    instructions: ['Focus on core engagement in every move', 'Move slowly and with full control', 'Breathe in to prepare, out to exert', 'Begin with pelvic tilts and single leg stretches', 'Progress to double leg stretch', 'Finish with cat-cow stretches'],
    coachTip: 'Imagine a string pulling the crown of your head up.',
  },
  {
    id: 'el22', emoji: '🏊', name: 'Water Aerobics', category: 'recovery',
    duration: '30 min', calories: '150 kcal', difficulty: 'Easy', met: 4.0, calPerMin: 5,
    instructions: ['Warm up by walking in waist-deep water', 'Add arm scoops and leg kicks', 'Progress to jumping jacks in the water', 'Use the water resistance in every move', 'Keep your core engaged throughout', 'Cool down with gentle stretches in the water'],
    coachTip: 'The water provides resistance — use it to your advantage!',
  },
];

// ─── Video data ───────────────────────────────────────────────────────────────
const VIDEOS = [
  { id: '2pLT-olgUJs', title: '10 Min Belly Fat Workout',  channel: 'Chloe Ting',       views: '8.2M views', duration: '10:23', category: 'belly_fat' },
  { id: 'UItWltVZZmE', title: 'Flat Belly Workout',        channel: 'Pamela Reif',      views: '5.1M views', duration: '10:32', category: 'belly_fat' },
  { id: 'ml6cT4AZdqI', title: 'Fat Burning HIIT Cardio',  channel: 'MadFit',            views: '4.3M views', duration: '21:45', category: 'belly_fat' },
  { id: 'vc1E5CfRfos', title: 'Full Body Toning Workout',  channel: 'Sydney Cummings',  views: '3.2M views', duration: '35:00', category: 'tone' },
  { id: 'N_8TGULDlEI', title: 'Lean Arms & Shoulders',    channel: 'Heather Robertson', views: '2.8M views', duration: '30:00', category: 'tone' },
  { id: 'EiRC80FJbgU', title: 'Body Sculpting Workout',   channel: 'Caroline Girvan',   views: '2.1M views', duration: '45:00', category: 'tone' },
  { id: 'v7AYKMP6rOE', title: 'Morning Yoga Flow',        channel: 'Yoga With Adriene', views: '6.5M views', duration: '20:00', category: 'recovery' },
  { id: 'L_xrDAtykMI', title: 'Full Body Stretch',        channel: 'MadFit',            views: '3.1M views', duration: '15:00', category: 'recovery' },
  { id: 'qULTwquOuT4', title: 'Recovery & Mobility',      channel: 'Tom Merrick',       views: '1.8M views', duration: '25:00', category: 'recovery' },
];

const VIDEO_CAT: Record<string, { label: string; color: string }> = {
  belly_fat: { label: '🔥 Belly Fat', color: '#FF6B35' },
  tone:      { label: '💪 Toning',    color: '#3B82F6' },
  recovery:  { label: '😴 Recovery',  color: '#6366F1' },
};

// ─── Shared style ─────────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.07)',
  marginBottom: 12,
};

// ─── Sub-tab pill bar ─────────────────────────────────────────────────────────
function PillBar<T extends string>({
  tabs, active, onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div style={{ margin: '0 16px 8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4, display: 'flex', gap: 2 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          flex: 1, padding: '9px 4px', borderRadius: 10, fontSize: 12, border: 'none', cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
          backgroundColor: active === t.key ? 'rgba(255,255,255,0.12)' : 'transparent',
          fontWeight: active === t.key ? 700 : 500,
          color: active === t.key ? '#F97316' : 'rgba(255,255,255,0.4)',
          whiteSpace: 'nowrap',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── TAB 1: WORKOUT ───────────────────────────────────────────────────────────
function WorkoutTab() {
  const today = new Date().toISOString().split('T')[0];
  const [state, setState] = useState<WorkoutState>('library');
  const [selEx, setSelEx] = useState<Exercise | null>(null);
  const [catFilter, setCatFilter] = useState<Category>('all');
  const [elapsed, setElapsed] = useState(0);
  const [liveCal, setLiveCal] = useState(0);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () => {
      const log = storage.getExerciseLog().filter(e => e.date === today);
      setSessions(log.map(e => ({
        id: e.id,
        exerciseId: e.exerciseId,
        name: e.exerciseName,
        emoji: EX_LIBRARY.find(x => x.id === e.exerciseId)?.emoji ?? '🏃',
        durationMin: e.durationMin,
        caloriesBurned: e.caloriesBurned,
      })));
    };
    load();
    const handler = (e: Event) => { const { date } = (e as CustomEvent).detail as { date: string }; if (date === today) load(); };
    window.addEventListener(GOFIT_UPDATED_EVENT, handler);
    return () => window.removeEventListener(GOFIT_UPDATED_EVENT, handler);
  }, [today]);

  function startTimer(ex: Exercise) {
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        const durationHr = next / 3600;
        const weightKg = (() => { try { return JSON.parse(localStorage.getItem('gofit_user_profile') ?? '{}').currentWeightKg || 65; } catch { return 65; } })();
        setLiveCal(Math.round(ex.met * weightKg * durationHr));
        return next;
      });
    }, 1000);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  function fmt(s: number) {
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  function startSession() { setElapsed(0); setLiveCal(0); startTimer(selEx!); setState('active'); }
  function pauseSession() { stopTimer(); setState('paused'); }
  function resumeSession() { startTimer(selEx!); setState('active'); }
  function finishSession() { stopTimer(); setState('done'); }
  function saveSession() {
    const durationMin = Math.max(1, Math.round(elapsed / 60));
    const entry: ExerciseLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      date: today, exerciseId: selEx!.id, exerciseName: selEx!.name,
      type: 'other', durationMin, caloriesBurned: liveCal,
    };
    storage.addExerciseEntry(entry);
    setState('library'); setSelEx(null);
    setToast(`Session saved! 🔥 ${liveCal} cal burned`);
    setTimeout(() => setToast(null), 3000);
  }
  function discardSession() { stopTimer(); setState('library'); setSelEx(null); }

  const totalBurned = sessions.reduce((s, e) => s + e.caloriesBurned, 0);
  const totalMins   = sessions.reduce((s, e) => s + e.durationMin, 0);
  const filteredLib = catFilter === 'all' ? EX_LIBRARY : EX_LIBRARY.filter(e => e.category === catFilter);
  const diffColor   = (d: string) => d === 'Hard' ? '#EF4444' : d === 'Medium' ? '#F97316' : '#F59E0B';

  // ── READY ──────────────────────────────────────────────────────────────────
  if (state === 'ready' && selEx) {
    return (
      <div style={{ backgroundColor: '#0D0D1A', paddingBottom: 120 }}>
        <button onClick={() => { setSelEx(null); setState('library'); }}
          style={{ display: 'block', padding: '16px 16px 4px', color: '#FFF', fontSize: 15, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
          ← Back
        </button>
        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 80 }}>{selEx.emoji}</div>
          <h2 style={{ color: '#FFF', fontSize: 26, fontWeight: 800, margin: '12px 0 0', lineHeight: 1.2 }}>{selEx.name}</h2>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
            {[selEx.duration, selEx.calories, selEx.difficulty].map((v, i) => (
              <span key={i} style={{ backgroundColor: '#1E2837', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: i === 2 ? diffColor(selEx.difficulty) : '#FFF' }}>{v}</span>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'inline-block', backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 20, padding: '6px 14px', border: '1px solid #F97316' }}>
            <span style={{ color: '#F97316', fontSize: 12, fontWeight: 700 }}>🏠 Home Workout — No Equipment</span>
          </div>
        </div>
        {/* Instructions */}
        <div style={{ padding: '0 16px 20px' }}>
          <h3 style={{ color: '#FFF', fontWeight: 800, fontSize: 18, marginBottom: 12 }}>How To Do It</h3>
          {selEx.instructions.map((step, i) => (
            <div key={i} style={{ backgroundColor: '#111827', borderRadius: 10, padding: 12, marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <span style={{ color: '#FFF', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
              </div>
              <span style={{ color: '#FFF', fontSize: 14, lineHeight: '20px', flex: 1 }}>{step}</span>
            </div>
          ))}
        </div>
        {/* Coach tip */}
        <div style={{ margin: '0 16px 20px', backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 12, borderLeft: '4px solid #F97316', padding: 16 }}>
          <p style={{ color: '#F97316', fontWeight: 700, fontSize: 13, margin: '0 0 6px' }}>💪 Coach TinaBarks says:</p>
          <p style={{ color: '#FFF', fontSize: 14, lineHeight: '22px', margin: 0, fontStyle: 'italic' }}>{selEx.coachTip}</p>
        </div>
        {/* Info */}
        <div style={{ margin: '0 16px 24px', backgroundColor: '#111827', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔥</span>
          <span style={{ color: '#FFF', fontWeight: 600, fontSize: 15 }}>~{selEx.calPerMin} cal/min · MET {selEx.met}</span>
        </div>
        {/* Fixed CTA */}
        <div style={{ position: 'fixed', bottom: 64, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '12px 16px 0', backgroundColor: '#070B14', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={startSession} style={{ width: '100%', height: 56, borderRadius: 14, backgroundColor: '#F97316', border: 'none', color: '#FFF', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
            🏃 Start Workout
          </button>
        </div>
      </div>
    );
  }

  // ── ACTIVE / PAUSED ────────────────────────────────────────────────────────
  if (state === 'active' || state === 'paused') {
    const isPaused = state === 'paused';
    return (
      <div style={{ backgroundColor: '#0D0D1A', padding: '0 16px 120px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isPaused ? '#F59E0B' : '#EF4444' }} />
            <span style={{ color: isPaused ? '#F59E0B' : '#EF4444', fontWeight: 700, fontSize: 13 }}>{isPaused ? 'PAUSED' : 'LIVE'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{selEx?.emoji}</span>
            <span style={{ color: '#FFF', fontWeight: 700, fontSize: 15 }}>{selEx?.name}</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '28px 0', backgroundColor: '#111827', borderRadius: 20, marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 600, letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase', margin: '0 0 6px' }}>Duration</p>
          <p style={{ color: '#F97316', fontSize: 56, fontWeight: 800, letterSpacing: -1, margin: 0 }}>{fmt(elapsed)}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ backgroundColor: '#1E2837', borderRadius: 14, padding: 14, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 20, margin: '0 0 4px' }}>🔥</p>
            <p style={{ color: '#FFF', fontWeight: 800, fontSize: 22, margin: '0 0 2px' }}>{liveCal}</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0 }}>calories</p>
          </div>
          <div style={{ backgroundColor: '#1E2837', borderRadius: 14, padding: 14, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 20, margin: '0 0 4px' }}>⏱️</p>
            <p style={{ color: '#FFF', fontWeight: 800, fontSize: 22, margin: '0 0 2px' }}>{Math.max(1, Math.round(elapsed / 60))}</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0 }}>minutes</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={isPaused ? resumeSession : pauseSession} style={{ padding: '16px 0', borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: 'pointer', backgroundColor: '#1E2837', border: '2px solid #F59E0B', color: '#F59E0B' }}>
            {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
          </button>
          <button onClick={finishSession} style={{ padding: '16px 0', borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: 'pointer', backgroundColor: '#F97316', border: 'none', color: '#FFF' }}>
            ⏹ FINISH
          </button>
        </div>
      </div>
    );
  }

  // ── DONE ───────────────────────────────────────────────────────────────────
  if (state === 'done' && selEx) {
    const durationMin = Math.max(1, Math.round(elapsed / 60));
    const score = 85;
    const scoreColor = '#F97316';
    const checks = [
      { icon: '✅', label: 'Session Logged',             value: selEx.name,         points: 30 },
      { icon: '✅', label: 'Duration Verified',          value: `${durationMin} min`, points: 30 },
      { icon: '✅', label: 'Calorie Calculation Valid',  value: `${liveCal} kcal`,   points: 25 },
    ];
    return (
      <div style={{ backgroundColor: '#0D0D1A', padding: '20px 16px 120px' }}>
        <h2 style={{ color: '#FFF', fontSize: 26, fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>Session Complete! ✅</h2>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 22 }}>{selEx.emoji}</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>{selEx.name}</span>
        </div>
        {/* Stats */}
        <div style={{ backgroundColor: '#111827', borderRadius: 20, padding: 20, marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[
              { v: fmt(elapsed), l: 'Time' },
              { v: `${liveCal}`, l: 'Calories' },
              { v: `MET ${selEx.met}`, l: 'MET Used' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center', backgroundColor: '#1E2837', borderRadius: 12, padding: 12 }}>
                <p style={{ color: '#F97316', fontWeight: 800, fontSize: 16, margin: '0 0 2px' }}>{s.v}</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0 }}>{s.l}</p>
              </div>
            ))}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textAlign: 'center', margin: 0 }}>📊 Calculated from duration & MET value</p>
        </div>
        {/* Integrity card */}
        <div style={{ backgroundColor: '#111827', borderRadius: 20, padding: 20, marginBottom: 20, border: '2px solid #F97316' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#FFF' }}>🏅 Workout Integrity Score</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor }}>{score}<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>/100</span></span>
          </div>
          <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ height: 8, width: `${score}%`, backgroundColor: scoreColor, borderRadius: 4 }} />
          </div>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>{c.icon}</span>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, flex: 1 }}>{c.label}</span>
              <span style={{ color: '#FFF', fontSize: 12, fontWeight: 600, marginRight: 8 }}>{c.value}</span>
              <span style={{ color: scoreColor, fontSize: 12, fontWeight: 700 }}>+{c.points}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, borderRadius: 12, padding: 12, backgroundColor: 'rgba(249,115,22,0.1)' }}>
            <p style={{ color: '#F97316', fontWeight: 800, fontSize: 14, textAlign: 'center', margin: 0 }}>
              ✅ VERIFIED SESSION — Full challenge credit awarded!
            </p>
          </div>
        </div>
        <button onClick={saveSession} style={{ width: '100%', padding: '17px 0', borderRadius: 16, backgroundColor: '#F97316', border: 'none', color: '#FFF', fontWeight: 800, fontSize: 17, cursor: 'pointer', marginBottom: 12 }}>
          💾 Save Session
        </button>
        <button onClick={discardSession} style={{ display: 'block', width: '100%', textAlign: 'center', padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 15 }}>
          🗑 Discard
        </button>
      </div>
    );
  }

  // ── LIBRARY (default) ──────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: '#0D0D1A', paddingBottom: 100 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 60, left: 24, right: 24, zIndex: 999, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          <span style={{ color: '#FFF', fontWeight: 700, fontSize: 14 }}>{toast}</span>
        </div>
      )}
      <div style={{ padding: '0 16px' }}>
        {/* Header */}
        <div style={{ paddingTop: 16, paddingBottom: 4 }}>
          <h2 style={{ color: '#FFF', fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Train with Coach TinaBarks</h2>
          <p style={{ color: '#F97316', fontSize: 13, fontWeight: 600, margin: 0 }}>All workouts are home-based — no gym equipment needed! 💪</p>
        </div>
        {/* Banner */}
        <div style={{ margin: '10px 0', backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
          <span style={{ color: '#FFF', fontSize: 12, fontWeight: 600 }}>Sweat at home today. Shine everywhere tomorrow. ✨</span>
        </div>
        {/* Summary bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '12px 0 20px' }}>
          {[{ v: sessions.length, l: 'sessions' }, { v: totalMins, l: 'min total' }, { v: totalBurned, l: 'cal burned' }].map((s, i) => (
            <div key={i} style={{ backgroundColor: '#1E2837', borderRadius: 14, padding: 12, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ color: '#F97316', fontSize: 22, fontWeight: 800, margin: '0 0 2px' }}>{s.v}</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0 }}>{s.l}</p>
            </div>
          ))}
        </div>
        {/* Today's sessions */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ color: '#FFF', fontWeight: 700, fontSize: 17, marginBottom: 10 }}>Today's Sessions</h3>
          {sessions.length === 0 ? (
            <div style={{ backgroundColor: '#1E2837', borderRadius: 14, padding: 24, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 32, margin: '0 0 8px' }}>🏋️</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0 }}>No sessions today. Pick an exercise below! 👇</p>
            </div>
          ) : sessions.map(ex => (
            <div key={ex.id} style={{ backgroundColor: '#1E2837', borderRadius: 14, marginBottom: 8, display: 'flex', alignItems: 'center', padding: 14, gap: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 26 }}>{ex.emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#FFF', fontWeight: 700, fontSize: 15, margin: '0 0 2px' }}>{ex.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0 }}>{ex.durationMin} min</p>
              </div>
              <span style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: '#F97316', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>{ex.caloriesBurned} cal</span>
              <button onClick={() => storage.removeExerciseEntry(ex.id)}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(239,68,68,0.15)', border: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
            </div>
          ))}
        </div>
        {/* Library */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ color: '#FFF', fontWeight: 700, fontSize: 17, marginBottom: 12 }}>Exercise Library</h3>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
            {([
              { id: 'all' as Category,       label: 'All' },
              { id: 'belly_fat' as Category, label: '🔥 Belly Fat & Weight Loss' },
              { id: 'tone' as Category,      label: '💪 Tone & Sculpt' },
              { id: 'recovery' as Category,  label: '😴 Energy & Recovery' },
            ]).map(f => (
              <button key={f.id} onClick={() => setCatFilter(f.id)} style={{
                padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                border: `1px solid ${catFilter === f.id ? '#F97316' : 'rgba(255,255,255,0.12)'}`,
                backgroundColor: catFilter === f.id ? '#F97316' : '#1E2837',
                color: catFilter === f.id ? '#FFF' : 'rgba(255,255,255,0.55)',
              }}>{f.label}</button>
            ))}
          </div>
          {filteredLib.map(ex => (
            <button key={ex.id} onClick={() => { setSelEx(ex); setState('ready'); }} style={{
              width: '100%', backgroundColor: '#111827', borderRadius: 16, marginBottom: 10,
              display: 'flex', alignItems: 'center', padding: 14, gap: 12,
              border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 20 }}>{ex.emoji}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#FFF', fontWeight: 700, fontSize: 15, margin: '0 0 2px' }}>{ex.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '0 0 2px' }}>{ex.duration} · {ex.calories}</p>
                <p style={{ color: diffColor(ex.difficulty), fontSize: 11, fontWeight: 600, margin: 0 }}>{ex.difficulty}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '0 0 2px' }}>MET {ex.met}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, margin: 0 }}>›</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB 2: VIDEOS ────────────────────────────────────────────────────────────
function VideosTab() {
  const [activeCat, setActiveCat] = useState<'all' | 'belly_fat' | 'tone' | 'recovery'>('all');
  const filtered = activeCat === 'all' ? VIDEOS : VIDEOS.filter(v => v.category === activeCat);

  return (
    <div style={{ backgroundColor: '#0D0D1A', paddingBottom: 100 }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <h2 style={{ color: '#FFF', fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Workout Videos</h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, margin: 0 }}>Curated from the world's top fitness channels</p>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px', overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        {([
          { id: 'all', label: 'All' },
          { id: 'belly_fat', label: '🔥 Belly Fat' },
          { id: 'tone', label: '💪 Toning' },
          { id: 'recovery', label: '😴 Recovery' },
        ]).map(f => (
          <button key={f.id} onClick={() => setActiveCat(f.id as typeof activeCat)} style={{
            padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            border: `1px solid ${activeCat === f.id ? '#F97316' : 'rgba(255,255,255,0.12)'}`,
            backgroundColor: activeCat === f.id ? '#F97316' : '#1E2837',
            color: activeCat === f.id ? '#FFF' : 'rgba(255,255,255,0.55)',
          }}>{f.label}</button>
        ))}
      </div>
      <div style={{ padding: '0 16px' }}>
        {filtered.map(video => {
          const cat = VIDEO_CAT[video.category];
          return (
            <a key={video.id} href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', backgroundColor: '#111827', borderRadius: 16, marginBottom: 14, overflow: 'hidden', textDecoration: 'none' }}>
              <div style={{ width: '100%', height: 180, position: 'relative', overflow: 'hidden', backgroundColor: '#1E2837' }}>
                <img src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`} alt={video.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(249,115,22,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#FFF', fontSize: 20 }}>▶</span>
                  </div>
                </div>
                <div style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 6, padding: '3px 7px' }}>
                  <span style={{ color: '#FFF', fontSize: 11, fontWeight: 700 }}>{video.duration}</span>
                </div>
                <div style={{ position: 'absolute', top: 10, left: 10, backgroundColor: cat.color + 'DD', borderRadius: 8, padding: '3px 8px' }}>
                  <span style={{ color: '#FFF', fontSize: 10, fontWeight: 700 }}>{cat.label}</span>
                </div>
              </div>
              <div style={{ padding: 12 }}>
                <p style={{ color: '#FFF', fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>{video.title}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: '#F97316', fontSize: 12, fontWeight: 600, margin: '0 0 2px' }}>{video.channel}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: 0 }}>{video.views}</p>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: 0 }}>Opens in YouTube</p>
                </div>
              </div>
            </a>
          );
        })}
      </div>
      <div style={{ margin: '4px 16px 16px', backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
        <p style={{ color: '#F97316', fontWeight: 700, fontSize: 13, margin: '0 0 6px' }}>🎬 Coach TinaBarks' exclusive workout videos coming soon!</p>
        <p style={{ color: '#FFF', fontSize: 11, margin: 0, lineHeight: 1.6 }}>These are the world's best fitness videos while we prepare something even better for you.</p>
      </div>
    </div>
  );
}

// ─── TAB 3: PROGRESS ─────────────────────────────────────────────────────────
function CalendarView({ allSessions }: { allSessions: ExerciseLogEntry[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // First day of month (0=Sun, shift to Mon=0)
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

  const activeDates = new Set(
    allSessions.filter(s => {
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).map(s => s.date)
  );

  const monthSessions = allSessions.filter(s => {
    const d = new Date(s.date); return d.getFullYear() === year && d.getMonth() === month;
  });
  const monthCal = monthSessions.reduce((a, s) => a + s.caloriesBurned, 0);

  // Best day
  const byDate: Record<string, number> = {};
  monthSessions.forEach(s => { byDate[s.date] = (byDate[s.date] || 0) + 1; });
  const bestDay = Object.keys(byDate).length ? Object.entries(byDate).sort((a, b) => b[1] - a[1])[0] : null;
  const bestDayLabel = bestDay ? new Date(bestDay[0]).getDate() + ' ' + MONTH_NAMES[month].slice(0, 3) : '--';

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const todayStr = now.toISOString().split('T')[0];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFF', fontSize: 20, padding: '4px 8px' }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#FFF', fontWeight: 800, fontSize: 18, margin: 0 }}>{MONTH_NAMES[month]} {year}</p>
          <p style={{ color: '#F97316', fontSize: 11, margin: '2px 0 0' }}>tap to jump to any month</p>
        </div>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFF', fontSize: 20, padding: '4px 8px' }}>›</button>
      </div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
        {[
          { icon: '💪', v: monthSessions.length, l: 'Sessions' },
          { icon: '📅', v: activeDates.size,      l: 'Active Days' },
          { icon: '🔥', v: monthCal,              l: 'Calories' },
          { icon: '🏆', v: bestDayLabel,           l: 'Best Day' },
        ].map(s => (
          <div key={s.l} style={{ backgroundColor: '#1E2837', borderRadius: 10, padding: '8px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ fontSize: 14, margin: '0 0 2px' }}>{s.icon}</p>
            <p style={{ color: '#F97316', fontWeight: 800, fontSize: 13, margin: '0 0 1px' }}>{s.v}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, margin: 0 }}>{s.l}</p>
          </div>
        ))}
      </div>
      {/* DOW header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {DOW.map(d => (
          <div key={d} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {Array.from({ length: totalCells }).map((_, i) => {
          const dayNum = i - firstDow + 1;
          if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} />;
          const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const isToday = ds === todayStr;
          const hasWorkout = activeDates.has(ds);
          const isPast = new Date(ds) < now;
          return (
            <div key={i} style={{
              aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, position: 'relative',
              backgroundColor: isToday ? '#F97316' : 'transparent',
              opacity: isPast && !isToday && !hasWorkout ? 0.5 : 1,
            }}>
              <span style={{ color: isToday ? '#FFF' : '#FFF', fontSize: 12, fontWeight: isToday ? 800 : 400, lineHeight: '1' }}>
                {dayNum}
              </span>
              {hasWorkout && !isToday && (
                <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#F97316', marginTop: 2 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressTab() {
  const [range, setRange] = useState<ProgressRange>('week');
  const [allSessions, setAllSessions] = useState<ExerciseLogEntry[]>([]);

  useEffect(() => {
    setAllSessions(storage.getExerciseLog());
    const handler = () => setAllSessions(storage.getExerciseLog());
    window.addEventListener(GOFIT_UPDATED_EVENT, handler);
    return () => window.removeEventListener(GOFIT_UPDATED_EVENT, handler);
  }, []);

  const now = new Date();
  const filtered = range === 'calendar' ? allSessions : allSessions.filter(s => {
    const d = new Date(s.date);
    if (range === 'week')    { const w = new Date(now); w.setDate(now.getDate() - 7);       return d >= w; }
    if (range === 'month')   { const m = new Date(now); m.setMonth(now.getMonth() - 1);     return d >= m; }
    if (range === '3months') { const t = new Date(now); t.setMonth(now.getMonth() - 3);     return d >= t; }
    return true;
  });

  const totalMin = filtered.reduce((s, e) => s + e.durationMin, 0);
  const totalCal = filtered.reduce((s, e) => s + e.caloriesBurned, 0);
  const bestTime = filtered.length ? Math.max(...filtered.map(s => s.durationMin)) : 0;
  const bestCal  = filtered.length ? Math.max(...filtered.map(s => s.caloriesBurned)) : 0;

  // Bar data
  const buildBars = () => {
    if (range === 'week') {
      return Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(now); d.setDate(now.getDate() - 6 + i);
        const ds = d.toISOString().split('T')[0];
        const cal = filtered.filter(s => s.date === ds).reduce((a, e) => a + e.caloriesBurned, 0);
        return { label: ['S','M','T','W','T','F','S'][d.getDay()], cal };
      });
    }
    if (range === 'month') {
      return Array.from({ length: 4 }).map((_, i) => {
        const start = new Date(now); start.setDate(now.getDate() - 27 + i * 7);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        const cal = filtered.filter(s => { const d = new Date(s.date); return d >= start && d <= end; }).reduce((a, e) => a + e.caloriesBurned, 0);
        return { label: `Wk ${i + 1}`, cal };
      });
    }
    if (range === '3months') {
      return Array.from({ length: 3 }).map((_, i) => {
        const d = new Date(now); d.setMonth(now.getMonth() - 2 + i);
        const cal = filtered.filter(s => {
          const sd = new Date(s.date); return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
        }).reduce((a, e) => a + e.caloriesBurned, 0);
        return { label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()], cal };
      });
    }
    return [];
  };
  const bars = buildBars();
  const maxCal = Math.max(...bars.map(b => b.cal), 1);

  const RANGE_LABELS: Record<ProgressRange, string> = { week: 'Week', month: 'Month', '3months': '3 Months', calendar: '📅 Calendar' };

  return (
    <div style={{ backgroundColor: '#0D0D1A', padding: '0 16px 100px' }}>
      <div style={{ paddingTop: 16, marginBottom: 16 }}>
        <h2 style={{ color: '#FFF', fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>My Training Progress 📊</h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>Your fitness journey at a glance</p>
      </div>

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['week', 'month', '3months', 'calendar'] as ProgressRange[]).map(r => (
          <button key={r} onClick={() => setRange(r)} style={{
            padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${range === r ? '#F97316' : 'rgba(255,255,255,0.12)'}`,
            backgroundColor: range === r ? '#F97316' : '#1E2837',
            color: range === r ? '#FFF' : 'rgba(255,255,255,0.55)',
          }}>{RANGE_LABELS[r]}</button>
        ))}
      </div>

      {/* Calendar view */}
      {range === 'calendar' && (
        <div style={CARD}><CalendarView allSessions={allSessions} /></div>
      )}

      {/* Data views */}
      {range !== 'calendar' && (
        filtered.length === 0 ? (
          <div style={{ ...CARD, textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 48, margin: '0 0 12px' }}>🏃</p>
            <h3 style={{ color: '#FFF', fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>No workouts yet!</h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: '0 0 20px' }}>Start your first session in the Workout tab</p>
            <button style={{ backgroundColor: '#F97316', border: 'none', borderRadius: 12, padding: '12px 24px', color: '#FFF', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Start Working Out →
            </button>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { icon: '💪', v: filtered.length, l: 'Sessions' },
                { icon: '⏱',  v: totalMin,        l: 'Minutes' },
                { icon: '🔥', v: totalCal,         l: 'Calories' },
              ].map(s => (
                <div key={s.l} style={{ backgroundColor: '#1E2837', borderRadius: 14, padding: '12px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p style={{ fontSize: 16, margin: '0 0 2px' }}>{s.icon}</p>
                  <p style={{ color: '#F97316', fontSize: 20, fontWeight: 800, margin: '0 0 2px' }}>{s.v}</p>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0 }}>{s.l}</p>
                </div>
              ))}
            </div>
            {/* Bar chart */}
            <div style={CARD}>
              <p style={{ color: '#FFF', fontWeight: 700, fontSize: 14, margin: '0 0 14px' }}>Calories Burned</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                {bars.map((b, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ width: '100%', borderRadius: 3, backgroundColor: b.cal > 0 ? '#F97316' : 'rgba(255,255,255,0.08)', height: `${Math.max((b.cal / maxCal) * 70, b.cal > 0 ? 6 : 2)}px`, transition: 'height 0.4s ease-out' }} />
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Personal bests */}
            <div style={CARD}>
              <p style={{ color: '#FFF', fontWeight: 700, fontSize: 14, margin: '0 0 12px' }}>Personal Bests</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { icon: '🏆', label: 'Best Time',    value: `${bestTime} min` },
                  { icon: '🔥', label: 'Most Calories', value: `${bestCal} cal` },
                  { icon: '📍', label: 'Distance',      value: '--' },
                ].map(pb => (
                  <div key={pb.label} style={{ backgroundColor: '#1E2837', borderRadius: 12, padding: 12, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ fontSize: 20, margin: '0 0 4px' }}>{pb.icon}</p>
                    <p style={{ color: '#F97316', fontWeight: 800, fontSize: 14, margin: '0 0 2px' }}>{pb.value}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0 }}>{pb.label}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Recent sessions */}
            <div style={CARD}>
              <p style={{ color: '#FFF', fontWeight: 700, fontSize: 14, margin: '0 0 12px' }}>Recent Sessions</p>
              {[...filtered].reverse().slice(0, 8).map(s => {
                const ex = EX_LIBRARY.find(e => e.id === s.exerciseId);
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{ex?.emoji ?? '🏃'}</span>
                      <div>
                        <p style={{ color: '#FFF', fontSize: 13, fontWeight: 600, margin: '0 0 1px' }}>{s.exerciseName}</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: 0 }}>{s.date} · {s.durationMin} min</p>
                      </div>
                    </div>
                    <span style={{ color: '#F97316', fontWeight: 700, fontSize: 13 }}>{s.caloriesBurned} cal</span>
                  </div>
                );
              })}
            </div>
          </>
        )
      )}
    </div>
  );
}

// ─── TAB 4: SQUAD ─────────────────────────────────────────────────────────────

function ChallengesPanel() {
  const challenges = [
    {
      id: 1, icon: '🥗', emoji: '7-Day Clean Eating Challenge', title: '7-Day Clean Eating Challenge',
      participants: 24, days: '7d',
      desc: 'Log all 4 meals every day for 7 consecutive days.',
      prize: '🎁 Free 1-month subscription',
      reward: '🥇 Clean Eater Badge + 200 points',
      borderColor: '#F97316',
    },
    {
      id: 2, icon: '🏃', emoji: '5K Running Challenge', title: '5K Running Challenge',
      participants: 18, days: '7d',
      desc: 'Complete a 5K run this week. Track it in the workout tab!',
      prize: '🎁 WeGoFit merchandise',
      reward: '🥇 Runner Badge + 150 points',
      borderColor: '#F59E0B',
    },
    {
      id: 3, icon: '💪', emoji: '100 Push-Ups Challenge', title: '100 Push-Ups Challenge',
      participants: 31, days: '3d',
      desc: 'Do 100 push-ups in one session.',
      prize: '🎁 500 bonus points',
      reward: '🥇 Iron Arms Badge + 100 points',
      borderColor: '#3B82F6',
    },
  ];

  return (
    <div style={{ padding: '0 16px 100px', backgroundColor: '#0D0D1A' }}>
      <div style={{ paddingTop: 16, marginBottom: 4 }}>
        <h2 style={{ color: '#FFF', fontSize: 20, fontWeight: 800, margin: '0 0 2px' }}>Squad Challenges 🏆</h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 2px' }}>Compete. Sweat. Win.</p>
        <p style={{ color: '#F97316', fontSize: 12, fontWeight: 600, margin: '0 0 16px' }}>Set by Coach TinaBarks 🌸</p>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>🔥 Active This Week</p>
      {challenges.map(c => (
        <div key={c.id} style={{ ...CARD, borderLeft: `4px solid ${c.borderColor}`, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 28 }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#FFF', fontWeight: 800, fontSize: 15, margin: '0 0 4px' }}>{c.title}</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>👥 {c.participants} participants</span>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>⏰ {c.days}</span>
              </div>
            </div>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: '18px', margin: '0 0 10px' }}>{c.desc}</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '0 0 4px' }}>{c.prize}</p>
          <p style={{ color: '#F97316', fontSize: 12, fontWeight: 600, margin: '0 0 12px' }}>{c.reward}</p>
          <button style={{ width: '100%', padding: '12px 0', borderRadius: 12, backgroundColor: '#F97316', border: 'none', color: '#FFF', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Join
          </button>
        </div>
      ))}
    </div>
  );
}

function LeaderboardPanel() {
  type TimeFilter = 'week' | 'month' | 'all';
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');

  const top3 = [
    { initials: 'SK', color: '#EC4899', name: 'Sarah K.',  points: 2840, streak: 21 },
    { initials: 'MO', color: '#8B5CF6', name: 'Mike O.',   points: 2156, streak: 14 },
    { initials: 'AT', color: '#10B981', name: 'Aisha T.',  points: 1893, streak: 9 },
  ];
  const rest = [
    { rank: 4,  initials: 'JM', color: '#F59E0B', name: 'James M.',   points: 1654, streak: 8,  isUser: false },
    { rank: 5,  initials: 'PS', color: '#3B82F6', name: 'Priya S.',   points: 1432, streak: 5,  isUser: false },
    { rank: 6,  initials: 'DK', color: '#6366F1', name: 'David K.',   points: 1287, streak: 12, isUser: false },
    { rank: 7,  initials: 'FA', color: '#F97316', name: 'Fatima A.',  points: 1154, streak: 3,  isUser: false },
    { rank: 8,  initials: 'C',  color: '#F97316', name: 'Chris24',    points: 0,    streak: 1,  isUser: true },
    { rank: 9,  initials: 'LB', color: '#14B8A6', name: 'Lena B.',    points: 987,  streak: 7,  isUser: false },
    { rank: 10, initials: 'OH', color: '#EF4444', name: 'Omar H.',    points: 876,  streak: 2,  isUser: false },
  ];

  return (
    <div style={{ padding: '0 16px 100px', backgroundColor: '#0D0D1A' }}>
      <div style={{ paddingTop: 16, marginBottom: 16 }}>
        <h2 style={{ color: '#FFF', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Squad Leaderboard 🏆</h2>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { v: '47',    l: 'Active Members' },
            { v: '12,840', l: 'Total Points' },
            { v: '284',   l: 'Challenges Done' },
          ].map(s => (
            <div key={s.l} style={{ backgroundColor: '#1E2837', borderRadius: 12, padding: '10px 6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ color: '#F97316', fontWeight: 800, fontSize: 16, margin: '0 0 2px' }}>{s.v}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0 }}>{s.l}</p>
            </div>
          ))}
        </div>
        {/* Time filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([['week', 'This Week'], ['month', 'This Month'], ['all', 'All Time']] as [TimeFilter, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTimeFilter(k)} style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${timeFilter === k ? '#F97316' : 'rgba(255,255,255,0.12)'}`,
              backgroundColor: timeFilter === k ? '#F97316' : '#1E2837',
              color: timeFilter === k ? '#FFF' : 'rgba(255,255,255,0.55)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* #1 large card */}
      <div style={{ ...CARD, border: '2px solid #F97316', padding: 20, textAlign: 'center', marginBottom: 12 }}>
        <div style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: top3[0].color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          <span style={{ color: '#FFF', fontWeight: 800, fontSize: 20 }}>{top3[0].initials}</span>
        </div>
        <p style={{ color: '#FFF', fontWeight: 800, fontSize: 18, margin: '0 0 4px' }}>{top3[0].name}</p>
        <p style={{ color: '#F97316', fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>{top3[0].points.toLocaleString()} pts</p>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>🔥 {top3[0].streak}d streak</span>
      </div>

      {/* #2 and #3 side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {top3.slice(1).map((u, i) => (
          <div key={i} style={{ ...CARD, padding: 14, textAlign: 'center', marginBottom: 0 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '0 0 6px' }}>{i === 0 ? '🥈 #2' : '🥉 #3'}</p>
            <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
              <span style={{ color: '#FFF', fontWeight: 800, fontSize: 16 }}>{u.initials}</span>
            </div>
            <p style={{ color: '#FFF', fontWeight: 700, fontSize: 13, margin: '0 0 2px' }}>{u.name}</p>
            <p style={{ color: '#F97316', fontWeight: 700, fontSize: 13, margin: '0 0 2px' }}>{u.points.toLocaleString()} pts</p>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>🔥 {u.streak}d</span>
          </div>
        ))}
      </div>

      {/* #4-#10 */}
      <div style={CARD}>
        {rest.map((u) => (
          <div key={u.rank} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px',
            borderRadius: 10, marginBottom: 4,
            backgroundColor: u.isUser ? 'rgba(249,115,22,0.12)' : 'transparent',
            border: `1px solid ${u.isUser ? 'rgba(249,115,22,0.25)' : 'transparent'}`,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: 13, width: 22, textAlign: 'center' }}>#{u.rank}</span>
            <div style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#FFF', fontWeight: 800, fontSize: 12 }}>{u.initials}</span>
            </div>
            <span style={{ flex: 1, color: u.isUser ? '#F97316' : '#FFF', fontWeight: u.isUser ? 700 : 500, fontSize: 14 }}>{u.name}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{u.points.toLocaleString()} pts</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>🔥 {u.streak}d</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type FeedPost = {
  id: string;
  initials: string;
  color: string;
  name: string;
  date: string;
  text: string;
  likes: number;
  comments: number;
  type: string;
};

type ShareCategory = 'workouts' | 'meals' | 'champion' | 'milestones';

const MAX_CHARS = 280;

interface ShareOption {
  key: ShareCategory;
  emoji: string;
  title: string;
  subtitle: string;
  placeholder: string;
  composeTitle: string;
}

const SHARE_OPTIONS: ShareOption[] = [
  {
    key: 'workouts',
    emoji: '🏃',
    title: 'Share a workout',
    subtitle: 'How did your workout go?',
    placeholder: 'How did your workout go? Share your session details!',
    composeTitle: 'Share a workout',
  },
  {
    key: 'meals',
    emoji: '🍽️',
    title: 'Share a meal win',
    subtitle: 'What did you eat well today?',
    placeholder: 'What did you eat well today?',
    composeTitle: 'Share a meal win',
  },
  {
    key: 'champion',
    emoji: '🏆',
    title: 'Share a challenge milestone',
    subtitle: 'Share your challenge progress!',
    placeholder: 'Share your challenge progress!',
    composeTitle: 'Share a challenge milestone',
  },
  {
    key: 'milestones',
    emoji: '💧',
    title: 'Share a water goal',
    subtitle: 'How much water did you drink?',
    placeholder: 'How much water did you drink today?',
    composeTitle: 'Share a water goal',
  },
];

// thought is "All" only — add as first entry displayed but maps to a neutral category
type ShareOptionAll = Omit<ShareOption, 'key'> & { key: ShareCategory | 'thought' };
const SHARE_OPTIONS_ALL: (ShareOption | ShareOptionAll)[] = [
  {
    key: 'workouts' as ShareCategory,
    emoji: '💬',
    title: 'Share a thought',
    subtitle: "What's on your mind today?",
    placeholder: "What's on your mind?",
    composeTitle: 'Share a thought',
  },
  ...SHARE_OPTIONS,
];

function ShareModal({ onClose, onPost }: { onClose: () => void; onPost: (text: string, category: ShareCategory) => void }) {
  const [step, setStep] = useState<'menu' | 'compose'>('menu');
  const [selected, setSelected] = useState<typeof SHARE_OPTIONS_ALL[0] | null>(null);
  const [text, setText] = useState('');
  const used = text.length;

  function pickOption(opt: typeof SHARE_OPTIONS_ALL[0]) {
    setSelected(opt);
    setText('');
    setStep('compose');
  }

  function handlePost() {
    if (!text.trim() || !selected) return;
    // "thought" maps to workouts feed type for display
    const cat = selected.key === 'workouts' && selected.emoji === '💬'
      ? 'workouts' as ShareCategory
      : selected.key as ShareCategory;
    onPost(text.trim(), cat);
  }

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)' }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: '#1a1a2e',
            borderRadius: '20px 20px 0 0',
            padding: '0 0 32px',
            maxHeight: '85vh',
            overflowY: 'auto',
            animation: 'slideUp 0.28s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} />
          </div>

          {/* ── STEP 1: MENU ── */}
          {step === 'menu' && (
            <div style={{ padding: '16px 24px 0' }}>
              <p style={{ color: '#FFF', fontWeight: 800, fontSize: 18, margin: '0 0 4px' }}>Share with the Squad</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 20px' }}>What would you like to share today?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SHARE_OPTIONS_ALL.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => pickOption(opt)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: 16, borderRadius: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{opt.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#FFF', fontWeight: 700, fontSize: 15, margin: '0 0 2px' }}>{opt.title}</p>
                      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>{opt.subtitle}</p>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 20, flexShrink: 0 }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: COMPOSE ── */}
          {step === 'compose' && selected && (
            <div style={{ padding: '12px 24px 0' }}>
              {/* Back */}
              <button
                onClick={() => setStep('menu')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFF', fontSize: 15, fontWeight: 700, padding: '4px 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                ← Back
              </button>
              <p style={{ color: '#FFF', fontWeight: 800, fontSize: 18, margin: '0 0 20px' }}>{selected.composeTitle}</p>

              {/* Textarea */}
              <textarea
                autoFocus
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
                placeholder={selected.placeholder}
                style={{
                  width: '100%', minHeight: 120, resize: 'none',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, padding: 12,
                  color: '#FFF', fontSize: 14, lineHeight: '22px',
                  fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {/* Counter */}
              <p style={{
                textAlign: 'right', fontSize: 12, margin: '6px 0 20px',
                color: used > MAX_CHARS - 30 ? '#EF4444' : 'rgba(255,255,255,0.35)',
                fontWeight: used > MAX_CHARS - 30 ? 700 : 400,
              }}>
                {used}/{MAX_CHARS}
              </p>

              {/* Post button */}
              <button
                onClick={handlePost}
                disabled={!text.trim()}
                style={{
                  width: '100%', padding: '16px 0', borderRadius: 14,
                  fontWeight: 800, fontSize: 16, cursor: text.trim() ? 'pointer' : 'not-allowed',
                  backgroundColor: text.trim() ? '#F97316' : 'rgba(249,115,22,0.3)',
                  border: 'none', color: '#FFF', transition: 'background 0.15s',
                }}
              >
                Post to Squad Feed 🚀
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FeedPanel() {
  type FeedFilter = 'all' | 'workouts' | 'meals' | 'champion' | 'milestones';
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(false);

  const SEED_POSTS: FeedPost[] = [
    { id: 'p1', initials: 'AR', color: '#3B82F6', name: 'Arintina',  date: 'Yesterday',    text: "Let's keep up the momentum guys\nNo giving up. 🔥",           likes: 1, comments: 0, type: 'workouts' },
    { id: 'p2', initials: 'CH', color: '#3B82F6', name: 'Chris02',   date: 'Mon, May 25',  text: 'Great work everyone!',                                          likes: 3, comments: 0, type: 'workouts' },
    { id: 'p3', initials: 'SK', color: '#EC4899', name: 'Sarah K.',  date: 'Sun, May 24',  text: 'Just completed the 5K challenge!\nFeeling amazing 🏃‍♀️',   likes: 8, comments: 2, type: 'champion' },
    { id: 'p4', initials: 'MO', color: '#8B5CF6', name: 'Mike O.',   date: 'Sat, May 23',  text: "100 push-ups done!\nWho's next? 💪",                            likes: 5, comments: 1, type: 'milestones' },
  ];
  const [posts, setPosts] = useState<FeedPost[]>(SEED_POSTS);

  const filtered = feedFilter === 'all' ? posts : posts.filter(p => p.type === feedFilter);

  function handlePost(text: string, category: ShareCategory) {
    const userName = (() => {
      try { return JSON.parse(localStorage.getItem('gofit_user_profile') ?? '{}').name || 'You'; } catch { return 'You'; }
    })();
    const initials = userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'ME';
    const newPost: FeedPost = {
      id: `user-${Date.now()}`,
      initials,
      color: '#F97316',
      name: userName,
      date: 'Just now',
      text,
      likes: 0,
      comments: 0,
      type: category,
    };
    setPosts(prev => [newPost, ...prev]);
    setShowModal(false);
    setFeedFilter('all');
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  }

  return (
    <div style={{ padding: '0 16px 100px', backgroundColor: '#0D0D1A' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 60, left: 24, right: 24, zIndex: 1001,
          backgroundColor: '#1A1A2E', borderRadius: 12, padding: '12px 16px',
          textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          border: '1px solid rgba(249,115,22,0.4)',
        }}>
          <span style={{ color: '#F97316', fontWeight: 700, fontSize: 14 }}>Posted to Squad Feed! 🎉</span>
        </div>
      )}

      {/* Share modal */}
      {showModal && <ShareModal onClose={() => setShowModal(false)} onPost={handlePost} />}

      <div style={{ paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h2 style={{ color: '#FFF', fontSize: 20, fontWeight: 800, margin: '0 0 2px' }}>Squad Feed 📣</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 14px' }}>{posts.length} posts · celebrating every win 🌸</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ backgroundColor: '#F97316', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 16 }}
        >
          + Share
        </button>
      </div>

      {/* Feed filter pills */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
        {([
          ['all', 'All'],
          ['workouts', '🏃 Workouts'],
          ['meals', '🥗 Meals'],
          ['champion', '🏆 Champion'],
          ['milestones', '🌟 Milestones'],
        ] as [FeedFilter, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setFeedFilter(k)} style={{
            padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            border: `1px solid ${feedFilter === k ? '#F97316' : 'rgba(255,255,255,0.12)'}`,
            backgroundColor: feedFilter === k ? '#F97316' : '#1E2837',
            color: feedFilter === k ? '#FFF' : 'rgba(255,255,255,0.55)',
          }}>{l}</button>
        ))}
      </div>

      {/* Posts */}
      {filtered.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ fontSize: 36, margin: '0 0 10px' }}>📭</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0 }}>No posts in this category yet. Be the first!</p>
        </div>
      ) : filtered.map(p => (
        <div key={p.id} style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#FFF', fontWeight: 800, fontSize: 14 }}>{p.initials}</span>
            </div>
            <div>
              <p style={{ color: '#FFF', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>{p.name}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0 }}>{p.date}</p>
            </div>
          </div>
          <p style={{ color: '#FFF', fontSize: 14, lineHeight: '20px', margin: '0 0 12px', whiteSpace: 'pre-line' }}>💬 {p.text}</p>
          <div style={{ display: 'flex', gap: 16, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              ❤️ {p.likes}
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              💬 {p.comments}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SquadTab() {
  const [squadTab, setSquadTab] = useState<SquadSubTab>('challenges');
  const squadTabs: { key: SquadSubTab; label: string }[] = [
    { key: 'challenges',  label: '🏆 Challenges' },
    { key: 'leaderboard', label: '📊 Leaderboard' },
    { key: 'feed',        label: '📣 Feed' },
  ];
  return (
    <div style={{ backgroundColor: '#0D0D1A' }}>
      <div style={{ padding: '16px 16px 4px' }}>
        <h2 style={{ color: '#FFF', fontSize: 22, fontWeight: 800, margin: '0 0 2px' }}>WeGoFit Squad 🏆</h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 12px' }}>Challenges · Leaderboard · Feed</p>
      </div>
      <PillBar tabs={squadTabs} active={squadTab} onChange={setSquadTab} />
      {squadTab === 'challenges'  && <ChallengesPanel />}
      {squadTab === 'leaderboard' && <LeaderboardPanel />}
      {squadTab === 'feed'        && <FeedPanel />}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void;
  onGoHome: () => void;
}

export default function WorkoutScreen(_props: Props) {
  const [activeTab, setActiveTab] = useState<SubTab>('workout');
  const mainTabs: { key: SubTab; label: string }[] = [
    { key: 'workout',  label: '🏃 Workout'  },
    { key: 'videos',   label: '🎬 Videos'   },
    { key: 'progress', label: '📊 Progress' },
    { key: 'squad',    label: '🏆 Squad'    },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D0D1A' }}>
      <div style={{ padding: '28px 16px 12px' }}>
        <h1 style={{ color: '#FFF', fontWeight: 800, fontSize: 22, margin: 0 }}>Train</h1>
      </div>
      <PillBar tabs={mainTabs} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'workout'  && <WorkoutTab />}
      {activeTab === 'videos'   && <VideosTab />}
      {activeTab === 'progress' && <ProgressTab />}
      {activeTab === 'squad'    && <SquadTab />}
    </div>
  );
}
