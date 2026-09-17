import { useState, useEffect, useRef, useCallback } from 'react';
import workoutTracker, { WorkoutType, WorkoutUpdate, WorkoutSummary } from '../services/workoutTracker';

export type WorkoutStatus = 'idle' | 'requesting' | 'active' | 'paused' | 'finished';

const EMPTY_STATS: WorkoutUpdate = {
  currentSpeed: 0, averageSpeed: 0, maxSpeed: 0,
  totalDistance: 0, elevationGain: 0,
  duration: 0, calories: 0, positions: [],
};

export function useWorkoutTracker() {
  const [status, setStatus] = useState<WorkoutStatus>('idle');
  const [stats, setStats] = useState<WorkoutUpdate>(EMPTY_STATS);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Duration heartbeat — GPS updates can be infrequent; keep clock ticking each second
  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => {
        setStats(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const startWorkout = useCallback((workoutType: WorkoutType) => {
    setStatus('requesting');
    setError(null);
    setSummary(null);
    setStats(EMPTY_STATS);

    workoutTracker.on('update', (data) => {
      setStats(data);
      setStatus('active');
    });
    workoutTracker.on('error', (err) => {
      setError(err);
      setStatus('idle');
    });

    try {
      workoutTracker.start(workoutType);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GPS_UNKNOWN_ERROR');
      setStatus('idle');
    }
  }, []);

  const pauseWorkout = useCallback(() => {
    workoutTracker.pause();
    setStatus('paused');
  }, []);

  const resumeWorkout = useCallback(() => {
    workoutTracker.resume();
    setStatus('active');
  }, []);

  const stopWorkout = useCallback(() => {
    const result = workoutTracker.stop();
    setSummary(result);
    setStatus('finished');
    return result;
  }, []);

  const resetWorkout = useCallback(() => {
    setStatus('idle');
    setSummary(null);
    setError(null);
    setStats(EMPTY_STATS);
  }, []);

  return { status, stats, summary, error, startWorkout, pauseWorkout, resumeWorkout, stopWorkout, resetWorkout };
}
