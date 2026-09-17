import { UserProfile, MacroTargets } from '../types';

export function calcBMR(profile: UserProfile): number {
  const { gender, currentWeightKg, heightCm, age } = profile;
  const base = 10 * currentWeightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

export function calcTDEE(bmr: number, activityLevel: UserProfile['activityLevel']): number {
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    active: 1.55,
    very_active: 1.725,
  };
  return Math.round(bmr * multipliers[activityLevel]);
}

export function calcCalorieGoal(tdee: number, goal: UserProfile['goal']): number {
  switch (goal) {
    case 'lose': return Math.round(tdee - 500);
    case 'muscle': return Math.round(tdee + 300);
    case 'maintain':
    case 'fitness':
    default: return tdee;
  }
}

export function calcMacros(calorieGoal: number): MacroTargets {
  const proteinCals = calorieGoal * 0.30;
  const carbsCals = calorieGoal * 0.40;
  const fatCals = calorieGoal * 0.30;
  return {
    calories: calorieGoal,
    proteinG: Math.round(proteinCals / 4),
    carbsG: Math.round(carbsCals / 4),
    fatG: Math.round(fatCals / 9),
  };
}

export function calcTargets(profile: UserProfile): MacroTargets {
  const bmr = calcBMR(profile);
  const tdee = calcTDEE(bmr, profile.activityLevel);
  const calories = calcCalorieGoal(tdee, profile.goal);
  return calcMacros(calories);
}
