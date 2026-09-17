import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { format, subDays } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { storage } from '../utils/storage';
import { calcTargets } from '../utils/calculations';
import { UserProfile, WeightEntry } from '../types';

interface Props {
  profile: UserProfile;
}

const BADGE_DEFS = [
  { id: 'streak7', icon: '🔥', label: '7-Day WeGoFit Streak', desc: 'Log food 7 days in a row' },
  { id: 'hydro', icon: '💧', label: 'Hydration Hero', desc: '8 glasses in a day' },
  { id: 'clean', icon: '🥗', label: 'Clean Eater', desc: 'Hit protein goal 3 days' },
  { id: 'streak14', icon: '⚡', label: '14-Day WeGoFit Streak', desc: 'Log food 14 days in a row' },
  { id: 'workout5', icon: '💪', label: 'Workout Warrior', desc: 'Log 5 exercise sessions' },
];

function checkBadge(id: string): boolean {
  const streak = storage.getStreak();
  const exerciseLog = storage.getExerciseLog();
  const waterLog = storage.getWaterLog();
  const foodLog = storage.getFoodLog();
  switch (id) {
    case 'streak7': return streak >= 7;
    case 'streak14': return streak >= 14;
    case 'hydro': return waterLog.some(w => w.glasses >= 8);
    case 'workout5': return exerciseLog.length >= 5;
    case 'clean': {
      const dates = [...new Set(foodLog.map(e => e.date))];
      return dates.length >= 3;
    }
    default: return false;
  }
}

type TooltipPayloadItem = { name: string; value: number; color: string };
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-xs">
        <p className="text-white/60">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }} className="font-bold">{p.value} {p.name}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Progress({ profile }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const targets = calcTargets(profile);
  const [weightInput, setWeightInput] = useState(profile.currentWeightKg.toString());
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);

  useEffect(() => {
    setWeightLog(storage.getWeightLog());
  }, []);

  const logWeight = () => {
    const w = parseFloat(weightInput);
    if (!w) return;
    const entry: WeightEntry = {
      id: `${Date.now()}`,
      date: today,
      weightKg: w,
    };
    storage.addWeightEntry(entry);
    setWeightLog(storage.getWeightLog());
  };

  const last30Weight = (() => {
    const map = new Map(weightLog.map(e => [e.date, e.weightKg]));
    return Array.from({ length: 30 }, (_, i) => {
      const d = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
      const label = format(subDays(new Date(), 29 - i), 'MMM d');
      return { label, weight: map.get(d) ?? null };
    }).filter(d => d.weight !== null);
  })();

  const last7Calories = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    const label = format(subDays(new Date(), 6 - i), 'EEE');
    const foodLog = storage.getFoodLog().filter(e => e.date === d);
    const consumed = foodLog.reduce((s, e) => s + e.calories, 0);
    return { label, consumed, goal: targets.calories };
  });

  const weeklyMacros = (() => {
    const log = storage.getFoodLog().filter(e => {
      const d = new Date(e.date);
      const diff = (new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    });
    const protein = log.reduce((s, e) => s + e.proteinG * 4, 0);
    const carbs = log.reduce((s, e) => s + e.carbsG * 4, 0);
    const fat = log.reduce((s, e) => s + e.fatG * 9, 0);
    const total = protein + carbs + fat || 1;
    return [
      { name: 'Protein', value: Math.round((protein / total) * 100), fill: '#00FF87' },
      { name: 'Carbs', value: Math.round((carbs / total) * 100), fill: '#3B82F6' },
      { name: 'Fat', value: Math.round((fat / total) * 100), fill: '#F59E0B' },
    ];
  })();

  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [hips, setHips] = useState('');

  return (
    <div className="flex flex-col min-h-screen bg-navy-900 pb-24">
      <div className="px-5 pt-8 pb-4">
        <h1 className="font-heading text-2xl font-bold text-white">Progress</h1>
      </div>

      <div className="px-5 space-y-4">
        {/* Weight tracker */}
        <div className="glass-card p-5">
          <h3 className="font-heading text-lg font-bold text-white mb-4">Weight Tracking</h3>
          <div className="flex gap-2 mb-4">
            <input
              className="input-field flex-1"
              type="number"
              placeholder={`e.g. ${profile.currentWeightKg}`}
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              step="0.1"
            />
            <button onClick={logWeight} className="btn-primary px-4 py-2.5 text-sm flex items-center gap-1">
              <Plus size={15} /> Log
            </button>
          </div>

          {last30Weight.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={last30Weight} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.ceil(last30Weight.length / 5)} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone" dataKey="weight"
                  stroke="#00FF87" strokeWidth={2}
                  dot={{ fill: '#00FF87', r: 3 }} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-24 flex items-center justify-center text-white/30 text-sm">
              Log your weight to see trends
            </div>
          )}
        </div>

        {/* Calorie trend */}
        <div className="glass-card p-5">
          <h3 className="font-heading text-lg font-bold text-white mb-4">7-Day Calorie Trend</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={last7Calories} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="consumed" name="cal" radius={[4, 4, 0, 0]}>
                {last7Calories.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.consumed > entry.goal ? '#F59E0B' : '#00FF87'}
                    fillOpacity={entry.consumed > 0 ? 1 : 0.2}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Under goal
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> Over goal
            </div>
          </div>
        </div>

        {/* Macro pie */}
        <div className="glass-card p-5">
          <h3 className="font-heading text-lg font-bold text-white mb-4">Weekly Macro Split</h3>
          {weeklyMacros.some(m => m.value > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={weeklyMacros}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {weeklyMacros.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{value}</span>}
                />
                <Tooltip formatter={(val) => [`${val}%`, '']} contentStyle={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-24 flex items-center justify-center text-white/30 text-sm">
              Log food to see macro breakdown
            </div>
          )}
        </div>

        {/* Body measurements */}
        <div className="glass-card p-5">
          <h3 className="font-heading text-lg font-bold text-white mb-4">Body Measurements (cm)</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Waist', value: waist, setter: setWaist },
              { label: 'Chest', value: chest, setter: setChest },
              { label: 'Hips', value: hips, setter: setHips },
            ].map(m => (
              <div key={m.label}>
                <label className="text-white/50 text-xs mb-1.5 block">{m.label}</label>
                <input
                  className="input-field text-center"
                  type="number"
                  placeholder="—"
                  value={m.value}
                  onChange={e => m.setter(e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Achievement badges */}
        <div className="glass-card p-5">
          <h3 className="font-heading text-lg font-bold text-white mb-4">Achievements</h3>
          <div className="space-y-3">
            {BADGE_DEFS.map(badge => {
              const unlocked = checkBadge(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    unlocked ? 'bg-green-500/10 border border-green-500/30' : 'bg-white/5 opacity-50'
                  }`}
                >
                  <span className="text-2xl">{badge.icon}</span>
                  <div className="flex-1">
                    <div className={`font-semibold text-sm ${unlocked ? 'text-white' : 'text-white/50'}`}>
                      {badge.label}
                    </div>
                    <div className="text-white/40 text-xs">{badge.desc}</div>
                  </div>
                  {unlocked && (
                    <span className="text-green-500 text-xs font-bold">EARNED</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
