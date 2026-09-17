export type Goal = 'lose' | 'muscle' | 'maintain' | 'fitness';
export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very_active';
export type SubscriptionStatus = 'free' | 'monthly' | 'annual';

export interface UserProfile {
  name: string;
  age: number;
  gender: Gender;
  heightCm: number;
  currentWeightKg: number;
  goalWeightKg: number;
  goal: Goal;
  activityLevel: ActivityLevel;
  memberSince: string;
}

export interface MacroTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodItem {
  id: string;
  name: string;
  serving: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodLogEntry {
  id: string;
  date: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  foodId: string;
  foodName: string;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  type: 'cardio' | 'strength' | 'other';
  metValue: number;
}

export interface ExerciseLogEntry {
  id: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  type: 'cardio' | 'strength' | 'other';
  durationMin: number;
  caloriesBurned: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
}

export interface WaterLog {
  date: string;
  glasses: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  timestamp: string;
}

export type AppScreen =
  | 'splash'
  | 'sign-in'
  | 'coach-welcome'
  | 'onboarding-goal'
  | 'onboarding-challenge'
  | 'onboarding-measurements'
  | 'onboarding-plan-preview'
  | 'onboarding-create-account'
  | 'onboarding-pricing'
  | 'home'
  | 'diary'
  | 'exercise'
  | 'coach'
  | 'profile'
  | 'pricing';

export type NavTab = 'home' | 'nutrition' | 'train' | 'coach' | 'profile';
