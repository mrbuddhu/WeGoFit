import { useState, useEffect } from 'react';
import { Plus, Trash2, X, ChevronDown, MapPin } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { storage } from '../utils/storage';
import { EXERCISE_TEMPLATES, calcCaloriesBurned } from '../data/exercises';
import { ExerciseLogEntry, UserProfile } from '../types';

interface Props {
  profile: UserProfile;
  onOpenTracker?: () => void;
}

export default function ExerciseLog({ profile, onOpenTracker }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [entries, setEntries] = useState<ExerciseLogEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(EXERCISE_TEMPLATES[0]);
  const [duration, setDuration] = useState('30');

  const refresh = () => setEntries(storage.getExerciseLog());

  useEffect(refresh, []);

  const todayEntries = entries.filter(e => e.date === today);
  const totalBurned = todayEntries.reduce((s, e) => s + e.caloriesBurned, 0);

  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    const label = format(subDays(new Date(), 6 - i), 'EEE');
    const burned = entries.filter(e => e.date === d).reduce((s, e) => s + e.caloriesBurned, 0);
    return { label, burned, isToday: d === today };
  });

  const handleAdd = () => {
    const mins = parseInt(duration) || 30;
    const cal = calcCaloriesBurned(selectedExercise.metValue, profile.currentWeightKg, mins);
    const entry: ExerciseLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      date: today,
      exerciseId: selectedExercise.id,
      exerciseName: selectedExercise.name,
      type: selectedExercise.type,
      durationMin: mins,
      caloriesBurned: cal,
    };
    storage.addExerciseEntry(entry);
    refresh();
    setShowModal(false);
    setDuration('30');
  };

  const typeColors: Record<string, string> = {
    cardio: 'text-blue-400 bg-blue-400/10',
    strength: 'text-orange-400 bg-orange-400/10',
    other: 'text-purple-400 bg-purple-400/10',
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-xs">
          <p className="text-white/60">{label}</p>
          <p className="text-green-400 font-bold">{payload[0].value} cal</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy-900 pb-24">
      <div className="px-5 pt-8 pb-4">
        <h1 className="font-heading text-2xl font-bold text-white">Exercise</h1>
      </div>

      {/* GPS Workout banner */}
      <div className="px-5 mb-1">
        <button
          onClick={onOpenTracker}
          className="w-full rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-98"
          style={{ background: 'linear-gradient(135deg, rgba(0,255,135,0.12) 0%, rgba(0,180,100,0.08) 100%)', border: '1px solid rgba(0,255,135,0.25)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <MapPin size={18} className="text-green-500" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-green-400 font-bold text-sm">GPS Workout Tracker</div>
            <div className="text-white/40 text-xs mt-0.5">Track distance · speed · elevation in real time</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8M6 2l4 4-4 4" stroke="#0D1B2A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      </div>

      <div className="px-5 space-y-4">
        {/* Today summary */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/50 text-sm">Today's burn</p>
              <p className="font-heading text-3xl font-bold text-green-500">{totalBurned} <span className="text-lg text-white/50 font-sans">cal</span></p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center gap-2 py-2.5 px-4 text-sm"
            >
              <Plus size={16} /> Log Exercise
            </button>
          </div>

          {todayEntries.length === 0 && (
            <div className="text-center py-6 text-white/30 text-sm">
              No exercise logged today.<br />Get moving! 💪
            </div>
          )}

          {todayEntries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between py-3 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className={`px-2 py-1 rounded-lg text-xs font-medium ${typeColors[entry.type]}`}>
                  {entry.type}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{entry.exerciseName}</div>
                  <div className="text-white/40 text-xs">{entry.durationMin} min</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-400 font-semibold text-sm">{entry.caloriesBurned} cal</span>
                <button
                  onClick={() => { storage.removeExerciseEntry(entry.id); refresh(); }}
                  className="p-1 text-white/30 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Weekly chart */}
        <div className="glass-card p-5">
          <h3 className="font-heading text-lg font-bold text-white mb-4">Weekly Calories Burned</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="burned" radius={[4, 4, 0, 0]}>
                {weeklyData.map((entry, index) => (
                  <Cell key={index} fill={entry.isToday ? '#00FF87' : 'rgba(255,255,255,0.15)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Exercise list */}
        <div className="glass-card p-5">
          <h3 className="font-heading text-base font-bold text-white mb-3">Exercise Library</h3>
          <div className="space-y-2">
            {EXERCISE_TEMPLATES.map(ex => (
              <button
                key={ex.id}
                onClick={() => { setSelectedExercise(ex); setShowModal(true); }}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[ex.type]}`}>{ex.type}</span>
                  <span className="text-white text-sm">{ex.name}</span>
                </div>
                <span className="text-white/40 text-xs">MET {ex.metValue}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add Exercise Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="rounded-t-3xl p-5 border border-white/10"
               style={{ background: 'linear-gradient(180deg, #142233 0%, #0D1B2A 100%)' }}>
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold text-white">Log Exercise</h2>
              <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="text-white/60 text-sm mb-1.5 block">Exercise</label>
                <div className="relative">
                  <select
                    className="input-field appearance-none pr-10"
                    value={selectedExercise.id}
                    onChange={e => setSelectedExercise(EXERCISE_TEMPLATES.find(ex => ex.id === e.target.value)!)}
                  >
                    {EXERCISE_TEMPLATES.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-white/60 text-sm mb-1.5 block">Duration (minutes)</label>
                <input
                  className="input-field"
                  type="number"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  min="1" max="300"
                />
              </div>

              <div className="glass-card p-3 flex items-center justify-between">
                <span className="text-white/60 text-sm">Estimated calories burned</span>
                <span className="text-orange-400 font-bold">
                  {calcCaloriesBurned(selectedExercise.metValue, profile.currentWeightKg, parseInt(duration) || 0)} cal
                </span>
              </div>
            </div>

            <button onClick={handleAdd} className="btn-primary w-full py-4 text-base font-bold">
              Add to Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
