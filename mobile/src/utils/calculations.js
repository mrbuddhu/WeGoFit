function calcBMR(gender, weight_kg, height_cm, age) {
  const base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age);
  return gender === "male" ? base + 5 : base - 161;
}
function calcTDEE(bmr, activityLevel) {
  const multipliers = { sedentary: 1.2, light: 1.375, active: 1.55, very: 1.725 };
  return Math.round(bmr * (multipliers[activityLevel] || 1.375));
}
function calcDailyTarget(tdee, goal) {
  if (goal === "lose")  return Math.round(tdee * 0.80);
  if (goal === "gain")  return Math.round(tdee * 1.10);
  return tdee;
}
function calcMacroTargets(dailyCalories, weight_kg, goal, challenge) {
  const proteinPerKg =
    goal === "gain"                                           ? 2.2 :
    goal === "lose" && challenge === "Belly Fat Reduction"    ? 2.2 :
    goal === "lose"                                           ? 2.0 :
    goal === "fitness"                                        ? 1.8 :
    goal === "maintain"                                       ? 1.6 :
                                                                1.6;
  const protein = Math.max(50, Math.round(weight_kg * proteinPerKg));

  const FAT_MIN  = 40;
  const CARB_MIN = 50;

  const proteinCal = protein * 4;
  const rawFat = Math.round(((dailyCalories - proteinCal) * 0.30) / 9);
  const fat    = Math.max(FAT_MIN, rawFat);

  let carbCal  = dailyCalories - proteinCal - fat * 9;
  let carbs    = Math.round(carbCal / 4);

  if (carbs < CARB_MIN) {
    carbs    = CARB_MIN;
    carbCal  = CARB_MIN * 4;
  }

  return { protein, carbs, fat };
}
function calcBMI(weight_kg, height_cm) {
  const heightM = height_cm / 100;
  const bmi = weight_kg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}
function getBMICategory(bmi) {
  if (bmi < 18.5) return {
    label:  "Underweight",
    color:  "#3B82F6",
    emoji:  "💙",
    advice: "Let's build you up! Focus on nutritious meals and strength training — your transformation starts now!",
  };
  if (bmi < 25.0) return {
    label:  "Healthy Weight",
    color:  "#10B981",
    emoji:  "🌟",
    advice: "You're in the healthy zone — amazing work! Let's maintain this and build even more strength and energy!",
  };
  if (bmi < 30.0) return {
    label:  "Overweight",
    color:  "#F59E0B",
    emoji:  "💪",
    advice: "Great news — you're closer to your goal than you think! Let's put in the work and watch those numbers drop! 🔥",
  };
  if (bmi < 35.0) return {
    label:  "High BMI",
    color:  "#FB923C",
    emoji:  "🏃",
    advice: "Every journey starts with one step — and you've already taken it by joining WeGoFit! Let's crush this together! 💪",
  };
  return {
    label:  "Very High BMI",
    color:  "#F43F8E",
    emoji:  "🌸",
    advice: "Coach TinaBarks is in your corner every step of the way! Consistency beats perfection — let's build great habits one day at a time! 🌸",
  };
}
function getMinimumCalories(gender) {
  return gender === "male" ? 1600 : 1400;
}
function getSafeCalorieTarget(calculated, gender) {
  return Math.min(Math.max(calculated, getMinimumCalories(gender)), 2800);
}
function calcWaterGoal(weight_kg, activity_level, goal, challenge) {
  const base = weight_kg * 0.033;
  const activityAdj =
    activity_level === "sedentary" ? 0.0 :
    activity_level === "light"     ? 0.3 :
    activity_level === "active"    ? 0.5 :
    activity_level === "very"      ? 0.7 : 0.0;
  const goalAdj =
    goal === "lose"    ? 0.3 :
    goal === "gain"    ? 0.3 :
    goal === "fitness" ? 0.2 : 0.0;
  const challengeAdj = challenge === "Belly Fat Reduction" ? 0.2 : 0.0;
  const climate = 0.3;
  const raw = base + activityAdj + goalAdj + challengeAdj + climate;
  const clamped = Math.min(3.0, Math.max(2.0, raw));
  return Math.round(clamped * 2) / 2;
}
function calcWeeklyBurn(weight_kg, goal, challenge) {
  const ratePerKg =
    goal === "lose" && challenge === "Belly Fat Reduction" ? 25 :
    goal === "lose"                                        ? 20 :
    goal === "gain"                                        ? 12 :
    goal === "maintain"                                    ? 15 :
    goal === "fitness"                                     ? 18 :
                                                             15;
  const recommendedSessions =
    goal === "lose" && challenge === "Belly Fat Reduction" ? 5 :
    goal === "lose"                                        ? 4 :
    goal === "gain"                                        ? 3 :
    goal === "maintain"                                    ? 3 :
    goal === "fitness"                                     ? 4 :
                                                             3;
  const raw             = weight_kg * ratePerKg;
  const clamped         = Math.min(2500, Math.max(800, raw));
  const weeklyBurnTarget = Math.round(clamped / 50) * 50;
  const perSessionBurn   = Math.round(weeklyBurnTarget / recommendedSessions / 50) * 50;
  return { weeklyBurnTarget, recommendedSessions, perSessionBurn };
}
function calcTargets(profile) {
  if (!profile) return { calories: 2000, protein: 150, carbs: 200, fat: 67, weeklyBurnTarget: 1500, recommendedSessions: 3, perSessionBurn: 500, waterGoal: 2.0 };
  const bmr  = calcBMR(profile.gender, profile.weight_kg, profile.height_cm, profile.age);
  const tdee = calcTDEE(bmr, profile.activity_level);
  const raw  = calcDailyTarget(tdee, profile.goal);
  const cal  = getSafeCalorieTarget(raw, profile.gender);
  const macros      = calcMacroTargets(cal, profile.weight_kg, profile.goal, profile.challenge);
  const burnTargets = calcWeeklyBurn(profile.weight_kg, profile.goal, profile.challenge);
  const waterGoal   = calcWaterGoal(profile.weight_kg, profile.activity_level, profile.goal, profile.challenge);
  return { calories: cal, ...macros, ...burnTargets, waterGoal };
}
function recalc(log) {
  const all = [
    ...(log.meals?.breakfast || []),
    ...(log.meals?.lunch     || []),
    ...(log.meals?.dinner    || []),
    ...(log.meals?.snacks    || []),
  ];
  const caloriesEaten  = Math.round(all.reduce((s, f) => s + (f.cal || 0), 0));
  const protein_g      = Math.round(all.reduce((s, f) => s + (f.p   || 0), 0));
  const carbs_g        = Math.round(all.reduce((s, f) => s + (f.c   || 0), 0));
  const fat_g          = Math.round(all.reduce((s, f) => s + (f.f   || 0), 0));
  const caloriesBurned = Math.round((log.exercise || []).reduce((s, e) => s + (e.caloriesBurned || 0), 0));
  return {
    ...log,
    totals: {
      caloriesEaten, protein_g, carbs_g, fat_g,
      caloriesBurned,
      netCalories: caloriesEaten - caloriesBurned,
      water_litres: log.water_litres || 0,
    },
  };
}
function emptyLog(date) {
  return {
    date,
    meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    exercise: [],
    water_litres: 0,
    totals: { caloriesEaten: 0, protein_g: 0, carbs_g: 0, fat_g: 0, caloriesBurned: 0, netCalories: 0, water_litres: 0 },
  };
}
function todayKey() { return new Date().toISOString().split("T")[0]; }
function fmtDur(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
    : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function fmtPace(kmh) {
  if (!kmh || kmh <= 0) return "--:--";
  const mpk = 60 / kmh, mi = Math.floor(mpk), si = Math.round((mpk - mi) * 60);
  return `${mi}:${String(si).padStart(2,"0")}`;
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = Math.PI / 180;
  const φ1 = lat1 * toR, φ2 = lat2 * toR;
  const Δφ = (lat2 - lat1) * toR, Δλ = (lon2 - lon1) * toR;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getReferenceRange(gender, goal, activity) {
  const isActive = activity === "active" || activity === "very";
  if (gender === "female") {
    if (goal === "lose")     return isActive ? "Active women: 1,600–2,200 kcal"     : "Women losing weight: 1,200–1,800 kcal";
    if (goal === "gain")     return "Women building muscle: 1,800–2,400 kcal";
    return isActive          ? "Active women: 1,600–2,200 kcal"                     : "Women maintaining: 1,400–1,900 kcal";
  } else {
    if (goal === "lose")     return isActive ? "Active men: 1,800–2,500 kcal"       : "Men losing weight: 1,500–2,000 kcal";
    if (goal === "gain")     return "Men building muscle: 2,000–2,800 kcal";
    return isActive          ? "Active men: 1,800–2,500 kcal"                       : "Men maintaining: 1,600–2,200 kcal";
  }
}

function getCalorieRangeNote(target, gender, goal, activityLevel) {
  const minSafe = gender === "male" ? 1500 : 1200;
  const maxSafe = gender === "male" ? 2800 : 2200;

  if (target < minSafe) {
    return {
      type:    "low",
      color:   "#F59E0B",
      bgColor: "#FFFBEB",
      icon:    "💪",
      text:    gender === "female"
        ? "Your target is on the low side — let's make sure you're fuelling your body enough to see real results!"
        : "Your target is on the low side — fuel up properly and your body will reward you with better results!",
    };
  }
  if (target > maxSafe) {
    return {
      type:    "high",
      color:   "#F59E0B",
      bgColor: "#FFFBEB",
      icon:    "🏃",
      text:    gender === "female"
        ? "Great energy target! Pair this with your workouts and you'll see amazing results — let's go!"
        : "Big energy target! Make sure your training matches — you've got this!",
    };
  }
  return {
    type:    "perfect",
    color:   "#10B981",
    bgColor: "#ECFDF5",
    icon:    "✅",
    text:    "Perfect! Your calorie target is spot on for your goal. Stay consistent and results are coming! 🔥",
  };
}

function getCalorieStatus(eaten, target) {
  const diff    = eaten - target;
  const absDiff = Math.abs(diff);

  if (eaten === 0) return {
    status:    "not_started",
    color:     "#F43F8E",
    bgColor:   "#FFF5F7",
    emoji:     "🌅",
    label:     "Let's Go!",
    message:   "Log your first meal to get started today! 🍽️",
    ringColor: "#F43F8E",
  };
  if (absDiff <= 150) return {
    status:    "perfect",
    color:     "#10B981",
    bgColor:   "#ECFDF5",
    emoji:     "🎯",
    label:     "On Target!",
    message:   "You're nailing it today — keep this energy going! 💪",
    ringColor: "#10B981",
  };
  if (diff > 150 && diff <= 300) return {
    status:    "slightly_over",
    color:     "#F59E0B",
    bgColor:   "#FFFBEB",
    emoji:     "🟡",
    label:     "Almost There",
    message:   "Just a little over — a short walk after dinner will balance this out! 🚶",
    ringColor: "#F59E0B",
  };
  if (diff < -150 && diff >= -300) return {
    status:    "slightly_under",
    color:     "#F59E0B",
    bgColor:   "#FFFBEB",
    emoji:     "🟡",
    label:     "Top Up!",
    message:   "A little under — grab a healthy snack like fruit or groundnuts! 🍎🥜",
    ringColor: "#F59E0B",
  };
  if (diff > 300) return {
    status:    "over",
    color:     "#FB923C",
    bgColor:   "#FFF7ED",
    emoji:     "🏃",
    label:     "Burn It Off!",
    message:   "Over your goal today — let's get moving! A workout will sort this! 🔥",
    ringColor: "#FB923C",
  };
  if (diff < -300) return {
    status:    "under",
    color:     "#3B82F6",
    bgColor:   "#EFF6FF",
    emoji:     "🍽️",
    label:     "Fuel Up!",
    message:   "You need more fuel! Eating too little slows your metabolism — eat up! 💙",
    ringColor: "#3B82F6",
  };
  return {
    status:    "tracking",
    color:     "#F43F8E",
    bgColor:   "#FFF5F7",
    emoji:     "📊",
    label:     "Tracking",
    message:   "Keep logging to see your progress! 📈",
    ringColor: "#F43F8E",
  };
}

export {
  calcBMR, calcTDEE, calcDailyTarget, calcMacroTargets,
  calcBMI, getBMICategory, getMinimumCalories, getSafeCalorieTarget,
  calcWaterGoal, calcWeeklyBurn, calcTargets, recalc, emptyLog,
  todayKey, fmtDur, fmtPace, haversine,
  getReferenceRange, getCalorieRangeNote, getCalorieStatus,
};
