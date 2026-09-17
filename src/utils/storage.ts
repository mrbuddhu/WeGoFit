import {
  UserProfile,
  FoodLogEntry,
  ExerciseLogEntry,
  WeightEntry,
  WaterLog,
  SubscriptionStatus,
  ChatMessage,
} from '../types';

export interface DayTotals {
  date: string;
  caloriesEaten: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  caloriesBurned: number;
  netCalories: number;
}

const KEYS = {
  userProfile: 'gofit_user_profile',
  onboardingComplete: 'gofit_onboarding_complete',
  welcomeOnboardingComplete: 'gofit_welcome_onboarding_complete',
  clientGoal: 'gofit_client_goal',
  clientChallenges: 'gofit_client_challenges',
  clientCommitmentDays: 'gofit_client_commitment_days',
  subscriptionStatus: 'gofit_subscription_status',
  foodLog: 'gofit_food_log',
  exerciseLog: 'gofit_exercise_log',
  weightLog: 'gofit_weight_log',
  waterLog: 'gofit_water_log',
  waterLitres: 'gofit_water_litres',
  chatMessages: 'gofit_chat_messages',
  steps: 'gofit_steps',
  dayTotals: 'gofit_day_totals',
  confettiWater: 'gofit_confetti_water',
};

export const GOFIT_UPDATED_EVENT = 'gofit-updated';

function get<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
}

function set<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getUserProfile: () => get<UserProfile | null>(KEYS.userProfile, null),
  setUserProfile: (p: UserProfile) => set(KEYS.userProfile, p),

  isOnboardingComplete: () => get<boolean>(KEYS.onboardingComplete, false),
  setOnboardingComplete: (v: boolean) => set(KEYS.onboardingComplete, v),

  isWelcomeOnboardingComplete: () => get<boolean>(KEYS.welcomeOnboardingComplete, false),
  setWelcomeOnboardingComplete: (v: boolean) => set(KEYS.welcomeOnboardingComplete, v),
  getClientGoal: () => get<string>(KEYS.clientGoal, ''),
  setClientGoal: (goal: string) => set(KEYS.clientGoal, goal),
  getClientChallenges: () => get<string[]>(KEYS.clientChallenges, []),
  setClientChallenges: (challenges: string[]) => set(KEYS.clientChallenges, challenges),
  getClientCommitmentDays: () => get<number>(KEYS.clientCommitmentDays, 3),
  setClientCommitmentDays: (days: number) => set(KEYS.clientCommitmentDays, days),

  getSubscription: () => get<SubscriptionStatus>(KEYS.subscriptionStatus, 'free'),
  setSubscription: (s: SubscriptionStatus) => set(KEYS.subscriptionStatus, s),

  getFoodLog: () => get<FoodLogEntry[]>(KEYS.foodLog, []),
  setFoodLog: (log: FoodLogEntry[]) => set(KEYS.foodLog, log),
  addFoodEntry: (entry: FoodLogEntry) => {
    const log = storage.getFoodLog();
    set(KEYS.foodLog, [...log, entry]);
    storage.recalculateDayTotals(entry.date);
  },
  removeFoodEntry: (id: string) => {
    const existing = storage.getFoodLog().find(e => e.id === id);
    const log = storage.getFoodLog().filter(e => e.id !== id);
    set(KEYS.foodLog, log);
    if (existing) storage.recalculateDayTotals(existing.date);
  },

  getExerciseLog: () => get<ExerciseLogEntry[]>(KEYS.exerciseLog, []),
  setExerciseLog: (log: ExerciseLogEntry[]) => set(KEYS.exerciseLog, log),
  addExerciseEntry: (entry: ExerciseLogEntry) => {
    const log = storage.getExerciseLog();
    set(KEYS.exerciseLog, [...log, entry]);
    storage.recalculateDayTotals(entry.date);
  },
  removeExerciseEntry: (id: string) => {
    const existing = storage.getExerciseLog().find(e => e.id === id);
    const log = storage.getExerciseLog().filter(e => e.id !== id);
    set(KEYS.exerciseLog, log);
    if (existing) storage.recalculateDayTotals(existing.date);
  },

  getWeightLog: () => get<WeightEntry[]>(KEYS.weightLog, []),
  addWeightEntry: (entry: WeightEntry) => {
    const log = storage.getWeightLog();
    set(KEYS.weightLog, [...log, entry]);
  },

  getWaterLog: () => get<WaterLog[]>(KEYS.waterLog, []),
  setWaterLog: (log: WaterLog[]) => set(KEYS.waterLog, log),
  getTodayWater: (date: string): number => {
    const log = storage.getWaterLog();
    return log.find(w => w.date === date)?.glasses ?? 0;
  },
  setTodayWater: (date: string, glasses: number) => {
    const log = storage.getWaterLog().filter(w => w.date !== date);
    set(KEYS.waterLog, [...log, { date, glasses }]);
  },

  // Litres-based water tracking (decimal, e.g. 1.75)
  getTodayWaterLitres: (date: string): number => {
    const all = get<Record<string, number>>(KEYS.waterLitres, {});
    return all[date] ?? 0;
  },
  setTodayWaterLitres: (date: string, litres: number): void => {
    const rounded = Math.round(litres * 100) / 100;
    const all = get<Record<string, number>>(KEYS.waterLitres, {});
    set(KEYS.waterLitres, { ...all, [date]: rounded });
  },

  // Track whether the 3L confetti has already fired for a given date
  hasWaterConfettiFired: (date: string): boolean => {
    const all = get<Record<string, boolean>>(KEYS.confettiWater, {});
    return all[date] ?? false;
  },
  markWaterConfettiFired: (date: string): void => {
    const all = get<Record<string, boolean>>(KEYS.confettiWater, {});
    set(KEYS.confettiWater, { ...all, [date]: true });
  },

  getChatMessages: () => get<ChatMessage[]>(KEYS.chatMessages, []),
  setChatMessages: (msgs: ChatMessage[]) => set(KEYS.chatMessages, msgs),

  getSteps: (date: string): number => {
    const all = get<Record<string, number>>(KEYS.steps, {});
    return all[date] ?? 0;
  },
  setSteps: (date: string, steps: number) => {
    const all = get<Record<string, number>>(KEYS.steps, {});
    set(KEYS.steps, { ...all, [date]: steps });
  },

  getStreak: (): number => {
    const log = storage.getFoodLog();
    if (log.length === 0) return 0;
    const dates = [...new Set(log.map(e => e.date))].sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let current = today;
    for (const date of dates) {
      if (date === current) {
        streak++;
        const d = new Date(current);
        d.setDate(d.getDate() - 1);
        current = d.toISOString().split('T')[0];
      } else {
        break;
      }
    }
    return streak;
  },

  getDayTotals: (date: string): DayTotals => {
    const all = get<Record<string, DayTotals>>(KEYS.dayTotals, {});
    return all[date] ?? {
      date,
      caloriesEaten: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      caloriesBurned: 0,
      netCalories: 0,
    };
  },

  recalculateDayTotals: (date: string): DayTotals => {
    const foodLog = storage.getFoodLog().filter(e => e.date === date);
    const exerciseLog = storage.getExerciseLog().filter(e => e.date === date);

    const caloriesEaten = foodLog.reduce((s, e) => s + e.calories, 0);
    const proteinG = Math.round(foodLog.reduce((s, e) => s + e.proteinG, 0) * 10) / 10;
    const carbsG = Math.round(foodLog.reduce((s, e) => s + e.carbsG, 0) * 10) / 10;
    const fatG = Math.round(foodLog.reduce((s, e) => s + e.fatG, 0) * 10) / 10;
    const caloriesBurned = exerciseLog.reduce((s, e) => s + e.caloriesBurned, 0);
    const netCalories = caloriesEaten - caloriesBurned;

    const totals: DayTotals = { date, caloriesEaten, proteinG, carbsG, fatG, caloriesBurned, netCalories };

    const all = get<Record<string, DayTotals>>(KEYS.dayTotals, {});
    set(KEYS.dayTotals, { ...all, [date]: totals });

    window.dispatchEvent(new CustomEvent(GOFIT_UPDATED_EVENT, { detail: { date } }));

    return totals;
  },
};
