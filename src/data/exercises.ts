import { ExerciseTemplate } from '../types';

export const EXERCISE_TEMPLATES: ExerciseTemplate[] = [
  { id: 'e1', name: 'Running', type: 'cardio', metValue: 9.8 },
  { id: 'e2', name: 'Cycling', type: 'cardio', metValue: 7.5 },
  { id: 'e3', name: 'Swimming', type: 'cardio', metValue: 8.0 },
  { id: 'e4', name: 'Weight Training', type: 'strength', metValue: 5.0 },
  { id: 'e5', name: 'Yoga', type: 'other', metValue: 3.0 },
  { id: 'e6', name: 'HIIT', type: 'cardio', metValue: 12.0 },
  { id: 'e7', name: 'Walking', type: 'cardio', metValue: 3.8 },
];

export function calcCaloriesBurned(
  metValue: number,
  weightKg: number,
  durationMin: number
): number {
  return Math.round((metValue * weightKg * (durationMin / 60)));
}
