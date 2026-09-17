import React, { useState, useEffect, useContext, createContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import { isVIPAccount } from "../lib/constants";
import { POINTS, BADGES } from "../data/community";
import { recalc, emptyLog, todayKey, calcTargets } from "../utils/calculations";
import { syncFoodLog, syncSleepLog, syncExerciseLog, syncWaterLog, syncWeightLog } from "../services/sync";

const Ctx = createContext(null);
const PaywallCtx = createContext({ subStatus: "active", trialDays: 0, openPaywall: () => {}, unreadCoachMessages: 0, clearCoachUnread: () => {}, activeRoute: "Home" });
const DarkCtx = createContext({ isDark: false, theme: null, toggleDarkMode: () => {} });

function getTheme(_isDark) {
  return {
    bg:          "#070B14",
    bgSecondary: "#111827",
    card:        "#111827",
    cardLight:   "#1E2837",
    input:       "#1E2837",
    text:        "#FFFFFF",
    textSub:     "rgba(255,255,255,0.55)",
    textLight:   "rgba(255,255,255,0.3)",
    border:      "rgba(255,255,255,0.06)",
    navBg:       "#111827",
    navBorder:   "rgba(255,255,255,0.08)",
    navActive:   "#FF6B35",
    navInactive: "rgba(255,255,255,0.35)",
    primary:     "#FF6B35",
    primaryLight:"rgba(255,107,53,0.12)",
    success:     "#10B981",
    warning:     "#F59E0B",
    error:       "#EF4444",
  };
}

function useTheme() {
  return useContext(DarkCtx);
}

function GoFitProvider({ children, clientId, clientEmail }) {
  const pfx = clientId ? `_${clientId}` : "";
  const KEY_PROFILE  = `gf_profile${pfx}`;
  const KEY_LOG      = (date) => `gf_log${pfx}_${date}`;
  const KEY_WEIGHTS  = `gf_weights${pfx}`;
  const KEY_ONBOARD  = `gf_onboarded${pfx}`;
  const KEY_CHAT     = `gf_chat${pfx}`;
  const KEY_SLEEP    = `gf_sleep_history${pfx}`;
  const KEY_MEALPLAN = `gofit_mealplan${pfx}`;
  const KEY_POINTS   = `gofit_points${pfx}`;
  const KEY_BADGES   = `gofit_badges${pfx}`;
  const KEY_DARKMODE = "gofit_dark_mode";

  const [profile,      setProfile]      = useState(null);
  const [dayLog,       setDayLog]       = useState(emptyLog(todayKey()));
  const [weights,      setWeights]      = useState([]);
  const [onboarded,    setOnboarded]    = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [chatMsgs,     setChatMsgs]     = useState([]);
  const [sleepHistory, setSleepHistory] = useState([]);
  const [isOnline,     setIsOnline]     = useState(true);
  const [mealPlan,     setMealPlan]     = useState(null);
  const [userPoints,   setUserPoints]   = useState(0);
  const [unlockedBadges, setUnlockedBadges] = useState([]);
  const [pointsToast,  setPointsToast] = useState(null);
  const [isDark,       setIsDark]       = useState(false);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const [p, log, w, ob, chat, sh, mp, pts, bdg, dm] = await Promise.all([
          AsyncStorage.getItem(KEY_PROFILE),
          AsyncStorage.getItem(KEY_LOG(todayKey())),
          AsyncStorage.getItem(KEY_WEIGHTS),
          AsyncStorage.getItem(KEY_ONBOARD),
          AsyncStorage.getItem(KEY_CHAT),
          AsyncStorage.getItem(KEY_SLEEP),
          AsyncStorage.getItem(KEY_MEALPLAN),
          AsyncStorage.getItem(KEY_POINTS),
          AsyncStorage.getItem(KEY_BADGES),
          AsyncStorage.getItem(KEY_DARKMODE),
        ]);
        if (p) {
          const parsed = JSON.parse(p);
          setProfile({ ...parsed, email: parsed?.email || clientEmail || "" });
        }
        if (log)  setDayLog(JSON.parse(log));
        if (w)    setWeights(JSON.parse(w));
        if (ob)   setOnboarded(true);
        if (chat) setChatMsgs(JSON.parse(chat));
        if (sh)   setSleepHistory(JSON.parse(sh));
        if (mp)   setMealPlan(JSON.parse(mp));
        if (pts)  setUserPoints(JSON.parse(pts));
        if (bdg)  setUnlockedBadges(JSON.parse(bdg));
        if (dm === "true") setIsDark(true);
      } catch (_e) {}
      setLoading(false);
      try { await AsyncStorage.removeItem("gofit_mock_workouts_seeded" + (clientId ? `_${clientId}` : "")); } catch (_e) {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function persistLog(updated) {
    const final = recalc(updated);
    await AsyncStorage.setItem(KEY_LOG(final.date), JSON.stringify(final));
    setDayLog(final);
    return final;
  }
  async function saveProfile(p) {
    const withEmail = { ...p, email: p?.email || clientEmail || "" };
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(withEmail));
    setProfile(withEmail);
  }

  async function deleteAccount() {
    const userId = profile?.id;
    if (userId) {
      try { await supabase.from("profiles").delete().eq("id", userId); } catch (_e) {}
      try {
        const { data: { session: sess } } = await supabase.auth.getSession();
        const token = sess?.access_token;
        if (token) {
          await fetch(SUPABASE_URL + "/rest/v1/rpc/delete_user", {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + token },
            body: JSON.stringify({}),
          });
        }
      } catch (_e) {}
    }
    try { await supabase.auth.signOut(); } catch (_e) {}
    try {
      const keys = await AsyncStorage.getAllKeys();
      const goFitKeys = keys.filter(k => k.startsWith("gofit_"));
      if (goFitKeys.length) await AsyncStorage.multiRemove(goFitKeys);
    } catch (_e) {}
    setProfile(null);
    setDayLog(emptyLog(todayKey()));
    setOnboarded(false);
  }

  async function completeOnboarding(p) {
    await saveProfile({ ...p, email: p?.email || clientEmail || "" });
    await AsyncStorage.setItem(KEY_ONBOARD, "true");
    setOnboarded(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (user?.id) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("update_profile", {
          p_id:          user.id,
          p_name:        p.name                             || "",
          p_age:         p.age                              || null,
          p_gender:      p.gender                           || "",
          p_height_cm:   p.height_cm    || p.height         || null,
          p_weight_kg:   p.weight_kg    || p.weight         || null,
          p_goal_weight: p.goal_weight  || p.goal_weight_kg || null,
          p_activity:    p.activity_level || p.activity     || "light",
          p_goal:        p.goal                             || "maintain",
          p_calories:    p.dailyCalorieTarget || p.calories || 1800,
          p_protein:     p.proteinTarget  || p.protein      || 135,
          p_carbs:       p.carbTarget     || p.carbs        || 180,
          p_fat:         p.fatTarget      || p.fat          || 60,
        });
        if (rpcErr) {
          console.log("❌ RPC error:", rpcErr.message);
          try {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess?.session?.access_token;
            if (token) {
              const res = await fetch(SUPABASE_URL + "/rest/v1/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + token, "Prefer": "resolution=merge-duplicates" },
                body: JSON.stringify({
                  id: user.id, email: user.email, name: p.name || "", age: p.age || null, gender: p.gender || "",
                  height_cm: p.height_cm || p.height || null, weight_kg: p.weight_kg || p.weight || null,
                  goal_weight: p.goal_weight || p.goal_weight_kg || null, activity: p.activity_level || p.activity || "light",
                  goal: p.goal || "maintain", calories: p.dailyCalorieTarget || p.calories || 1800,
                  protein: p.proteinTarget || p.protein || 135, carbs: p.carbTarget || p.carbs || 180,
                  fat: p.fatTarget || p.fat || 60, onboarded: true,
                }),
              });
              console.log("REST fallback:", res.status);
            }
          } catch (e2) { console.log("REST fallback failed:", e2.message); }
        } else {
          console.log("✅ RPC success!", rpcData);
        }
      }
    } catch (err) { console.log("completeOnboarding sync error:", err.message); }
  }

  async function addFood(meal, food) {
    await persistLog({ ...dayLog, meals: { ...dayLog.meals, [meal]: [...(dayLog.meals[meal] || []), { ...food, id: Date.now() }] } });
    await awardPoints("log_meal", POINTS.log_meal);
    await syncFoodLog({ ...food, date: todayKey(), meal }, profile?.id);
  }
  async function removeFood(meal, idx) {
    await persistLog({ ...dayLog, meals: { ...dayLog.meals, [meal]: dayLog.meals[meal].filter((_, i) => i !== idx) } });
  }
  async function addExercise(ex, awardPointsFlag = true) {
    await persistLog({ ...dayLog, exercise: [...(dayLog.exercise || []), { ...ex, id: Date.now() }] });
    if (awardPointsFlag) await awardPoints("complete_workout", POINTS.complete_workout);
    await syncExerciseLog(ex, profile?.id);
    if (profile?.id) {
      try {
        const { data: joined } = await supabase.from("challenge_participants").select("challenge_id, progress, goal_target").eq("user_id", profile.id);
        if (joined && joined.length > 0) {
          for (const participant of joined) {
            const increment = ex.distance_km ? Math.round(ex.distance_km * 10) / 10 : 1;
            const newProgress = Math.min((participant.progress || 0) + increment, participant.goal_target || 9999);
            await supabase.from("challenge_participants").update({ progress: newProgress }).eq("challenge_id", participant.challenge_id).eq("user_id", profile.id);
          }
        }
      } catch (_) {}
    }
  }
  async function removeExercise(idx) {
    await persistLog({ ...dayLog, exercise: dayLog.exercise.filter((_, i) => i !== idx) });
  }
  async function addWater(litres) {
    const prev = dayLog.water_litres || 0;
    const next = Math.round(Math.max(0, Math.min(5, prev + litres)) * 100) / 100;
    await persistLog({ ...dayLog, water_litres: next });
    const wGoal = calcTargets(profile).waterGoal;
    if (prev < wGoal && next >= wGoal) await awardPoints("hit_water_goal", POINTS.hit_water_goal);
    await syncWaterLog(next, profile?.id);
  }
  async function logWeight(kg) {
    const entry = { date: todayKey(), weight_kg: kg };
    const updated = [...weights.filter(w => w.date !== todayKey()), entry].sort((a, b) => a.date.localeCompare(b.date));
    await AsyncStorage.setItem(KEY_WEIGHTS, JSON.stringify(updated));
    setWeights(updated);
    await syncWeightLog(entry, profile?.id);
  }
  async function saveChat(msgs) {
    await AsyncStorage.setItem(KEY_CHAT, JSON.stringify(msgs));
    setChatMsgs(msgs);
  }
  async function logSleep(sleepData) {
    const entry = { ...sleepData, date: todayKey(), loggedAt: new Date().toISOString() };
    const updatedLog = recalc({ ...dayLog, sleep: entry });
    await AsyncStorage.setItem(KEY_LOG(todayKey()), JSON.stringify(updatedLog));
    setDayLog(updatedLog);
    const filtered = sleepHistory.filter(s => s.date !== todayKey());
    const updated  = [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    await AsyncStorage.setItem(KEY_SLEEP, JSON.stringify(updated));
    setSleepHistory(updated);
    await awardPoints("log_sleep", POINTS.log_sleep);
    await syncSleepLog({ ...sleepData, date: entry.date }, profile?.id);
  }

  const todaySleep = dayLog?.sleep || null;
  const emailForVIP = clientEmail || profile?.email;
  const isPremium = isVIPAccount(emailForVIP) || (profile?.plan === "monthly") || (profile?.plan === "annual");

  async function awardPoints(action, pts) {
    const next = userPoints + pts;
    await AsyncStorage.setItem(KEY_POINTS, JSON.stringify(next));
    setUserPoints(next);
    setPointsToast(`+${pts} WeGoFit Points! 🏆`);
    setTimeout(() => setPointsToast(null), 2500);
    try {
      await supabase.from("user_points").upsert({ user_id: profile?.id, total: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    } catch (_e) {}
  }

  async function unlockBadge(badgeId) {
    if (unlockedBadges.includes(badgeId)) return false;
    const next = [...unlockedBadges, badgeId];
    await AsyncStorage.setItem(KEY_BADGES, JSON.stringify(next));
    setUnlockedBadges(next);
    const badge = BADGES.find(b => b.id === badgeId);
    if (badge) await awardPoints("badge_unlock", badge.points || 0);
    try { await supabase.from("badges_earned").insert({ user_id: profile?.id, badge_id: badgeId, earned_at: new Date().toISOString() }); } catch (_e) {}
    return true;
  }

  async function saveMealPlan(plan) {
    await AsyncStorage.setItem(KEY_MEALPLAN, JSON.stringify(plan));
    setMealPlan(plan);
    try { await supabase.from("meal_plans").upsert({ user_id: profile?.id, week_start: plan.weekStart, plan_data: plan, generated_at: new Date().toISOString() }, { onConflict: "user_id,week_start" }); } catch (_e) {}
  }

  async function toggleDarkMode() {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(KEY_DARKMODE, String(next));
  }

  const theme = getTheme(isDark);

  return (
    <Ctx.Provider value={{
      profile, dayLog, weights, onboarded, loading,
      chatMsgs, saveChat,
      sleepHistory, todaySleep, logSleep,
      saveProfile, completeOnboarding, deleteAccount,
      addFood, removeFood, addExercise, removeExercise,
      addWater, logWeight,
      isOnline, isPremium,
      mealPlan, saveMealPlan,
      userPoints, awardPoints, unlockedBadges, unlockBadge, pointsToast,
      isDark, toggleDarkMode,
      storageClientId: clientId,
    }}>
      <DarkCtx.Provider value={{ isDark, theme, toggleDarkMode }}>
        {children}
      </DarkCtx.Provider>
    </Ctx.Provider>
  );
}

export { Ctx, PaywallCtx, DarkCtx, GoFitProvider, getTheme, useTheme };
