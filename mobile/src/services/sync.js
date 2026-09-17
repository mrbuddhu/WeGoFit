import { supabase } from "../lib/supabase";
import { isVIPAccount } from "../lib/constants";
import { todayKey } from "../utils/calculations";

async function upsertProfileToSupabase(userId, email, profileData) {
  try {
    const { error } = await supabase.from("profiles").upsert({
      id:           userId,
      email:        email,
      name:         profileData.name         || "",
      age:          profileData.age          || null,
      gender:       profileData.gender       || "",
      height_cm:    profileData.height_cm    || null,
      weight_kg:    profileData.weight_kg    || null,
      goal_weight:  profileData.goal_weight  || null,
      activity:     profileData.activity_level || "light",
      goal:         profileData.goal         || "maintain",
      calories:     profileData.dailyCalorieTarget || 1800,
      protein:      profileData.proteinTarget || 135,
      carbs:        profileData.carbTarget   || 180,
      fat:          profileData.fatTarget    || 60,
      subscription: isVIPAccount(email) ? "annual" : "free",
      is_vip:       isVIPAccount(email),
      onboarded:    profileData.onboarded    || false,
    }, { onConflict: "id" });
    if (error) console.log("Upsert error:", error.message);
  } catch (_e) {}
}

async function syncFoodLog(food, userId) {
  if (!userId) return;
  try {
    const { error } = await supabase.rpc("insert_food_log", {
      p_user_id:   userId,
      p_date:      food.date      || todayKey(),
      p_meal:      food.meal      || "snacks",
      p_food_name: food.foodName  || food.name || "",
      p_calories:  food.calories  || 0,
      p_protein:   food.protein   || 0,
      p_carbs:     food.carbs     || 0,
      p_fat:       food.fat       || 0,
      p_quantity:  food.qty       || 1,
      p_unit:      food.unit      || "g",
    });
    if (error) console.log("Food sync error:", error.message);
    else console.log("✅ Food synced");
  } catch (_e) {}
}

async function syncSleepLog(sleepData, userId) {
  if (!userId) return;
  try {
    const { error } = await supabase.rpc("insert_sleep_log", {
      p_user_id:   userId,
      p_date:      sleepData.date      || todayKey(),
      p_bed_time:  sleepData.bedTime   || sleepData.bed_time  || "",
      p_wake_time: sleepData.wakeTime  || sleepData.wake_time || "",
      p_duration:  sleepData.duration  || 0,
      p_quality:   sleepData.quality   || "",
      p_notes:     sleepData.notes     || "",
    });
    if (error) console.log("Sleep sync error:", error.message);
    else console.log("✅ Sleep synced");
  } catch (_e) {}
}

async function syncExerciseLog(exercise, userId) {
  if (!userId) return;
  try {
    const { error } = await supabase.rpc("insert_exercise_log", {
      p_user_id:         userId,
      p_date:            exercise.date           || todayKey(),
      p_name:            exercise.name           || "",
      p_duration_min:    exercise.duration_min   || Math.round((exercise.duration_sec || 0) / 60),
      p_calories_burned: exercise.caloriesBurned || 0,
      p_distance_km:     exercise.distance_km    || 0,
      p_avg_speed:       exercise.avgSpeed       || 0,
      p_step_count:      exercise.stepCount      || 0,
      p_integrity_score: exercise.integrityScore || 0,
      p_verified:        exercise.verified       || false,
      p_source:          exercise.source         || "MANUAL",
    });
    if (error) console.log("Exercise sync error:", error.message);
    else console.log("✅ Exercise synced");
  } catch (_e) {}
}

async function syncWaterLog(litres, userId) {
  if (!userId) return;
  try {
    const { error } = await supabase.rpc("upsert_water_log", {
      p_user_id: userId,
      p_date:    todayKey(),
      p_litres:  litres || 0,
    });
    if (error) console.log("Water sync error:", error.message);
    else console.log("✅ Water synced");
  } catch (_e) {}
}

async function syncWeightLog(weight, userId) {
  if (!userId) return;
  try {
    const { error } = await supabase.rpc("insert_weight_log", {
      p_user_id:   userId,
      p_date:      weight.date      || todayKey(),
      p_weight_kg: weight.weight_kg || weight.weight || 0,
    });
    if (error) console.log("Weight sync error:", error.message);
    else console.log("✅ Weight synced");
  } catch (_e) {}
}

function getAuthErrorMessage(error) {
  const msg = error?.message || "";
  if (msg.includes("Invalid login") || msg.includes("invalid_credentials"))
    return "Incorrect email or password.";
  if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("Email address is already"))
    return "Email already registered. Please log in instead.";
  if (msg.includes("Password should"))
    return "Password must meet the required complexity (uppercase, lowercase, number).";
  if (msg.includes("network") || msg.includes("fetch"))
    return "No internet connection. Please try again.";
  return msg || "Something went wrong. Please try again.";
}

export {
  upsertProfileToSupabase,
  syncFoodLog, syncSleepLog, syncExerciseLog, syncWaterLog, syncWeightLog,
  getAuthErrorMessage,
};
