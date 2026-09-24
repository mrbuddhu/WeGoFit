import React, { useState, useEffect, useRef, useContext, createContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, subscribeTable } from "../lib/supabase";
import { isVIPAccount } from "../lib/constants";
import { POINTS, BADGES } from "../data/community";
import { recalc, emptyLog, todayKey, calcTargets } from "../utils/calculations";
import {
  syncFoodLog, syncSleepLog, syncExerciseLog, syncWaterLog, syncWeightLog,
  loadProfileFromSupabase,
  loadFoodsFromSupabase,
  loadExercisesFromSupabase,
  loadWaterFromSupabase,
  loadWeightHistoryFromSupabase,
  loadSleepHistoryFromSupabase,
  loadSleepFromSupabase,
  loadSquadFeedFromSupabase,
  loadSquadCommentsFromSupabase,
  loadMyChallengesFromSupabase,
  loadSubscriptionsFromSupabase,
} from "../services/sync";

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
  // ── Realtime-only additive state (no UI breaks; expose via provider value) ──
  const [squadFeed,    setSquadFeed]    = useState([]);
  const [squadComments, setSquadComments] = useState([]);
  const [myChallenges, setMyChallenges] = useState([]);
  const [userSubscription, setUserSubscription] = useState(null);
  const [leaderboard,    setLeaderboard]    = useState([]);
  const realtimeChannels = useRef([]);

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
      // ── Realtime hydration + subscriptions (additive, best-effort) ──
      hydrateAndSubscribeFromSupabase();
    })();
    return () => stopRealtime();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // ── Real time helpers (additive only — existing flow untouched) ─────────────
  function dedupeById(list) {
    const seen = new Set();
    const out = [];
    for (const item of list || []) {
      const key = item?.id || item?.date;
      if (!key) { out.push(item); continue; }
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }
  function mergeListWithId(list, incoming, mode = "upsert") {
    if (!incoming) return list || [];
    const idKey = incoming.id ? "id" : (incoming.date ? "date" : null);
    if (!idKey) {
      if (mode === "insert") return [...(list || []), incoming];
      return list || [];
    }
    if (mode === "delete") {
      return (list || []).filter(x => x[idKey] !== incoming[idKey]);
    }
    const exists = (list || []).some(x => x[idKey] === incoming[idKey]);
    if (exists) {
      return (list || []).map(x => x[idKey] === incoming[idKey] ? { ...x, ...incoming } : x);
    }
    return [...(list || []), incoming];
  }
  async function persistDayLogAndRecompute(updated) {
    const final = recalc(updated);
    try { await AsyncStorage.setItem(KEY_LOG(final.date), JSON.stringify(final)); } catch (_e) {}
    setDayLog(final);
    return final;
  }
  function mapDbFoodToLocal(row) {
    return {
      id: row.id || Date.now() + Math.random(),
      date: row.date ? String(row.date) : todayKey(),
      meal: row.meal || "snacks",
      foodId: row.food_id,
      foodName: row.food_name || row.name || "",
      name: row.food_name || row.name || "",
      qty: Number(row.servings || row.quantity || 1),
      quantity: Number(row.servings || row.quantity || 1),
      unit: row.unit || "g",
      cal: Number(row.calories || 0),
      calories: Number(row.calories || 0),
      p: Number(row.protein_g || 0),
      protein: Number(row.protein_g || 0),
      c: Number(row.carbs_g || 0),
      carbs: Number(row.carbs_g || 0),
      f: Number(row.fat_g || 0),
      fat: Number(row.fat_g || 0),
    };
  }
  function mapDbExerciseToLocal(row) {
    return {
      id: row.id || Date.now() + Math.random(),
      date: row.date ? String(row.date) : todayKey(),
      name: row.name || row.exercise_name || "",
      duration_sec: Math.round(Number(row.duration_min || 0) * 60),
      duration_min: Number(row.duration_min || 0),
      caloriesBurned: Number(row.calories_burned || 0),
      distance_km: Number(row.distance_km || 0),
      avgSpeed: Number(row.avg_speed || 0),
      stepCount: Number(row.step_count || 0),
      integrityScore: Number(row.integrity_score || 0),
      verified: !!row.verified,
      source: row.source || "MANUAL",
      type: row.type || "cardio",
    };
  }

  async function hydrateAndSubscribeFromSupabase() {
    let uid = null;
    try {
      const { data: sess } = await supabase.auth.getSession();
      uid = sess?.session?.user?.id || null;
    } catch (_e) { uid = null; }
    if (!uid && clientId) uid = clientId;

    // ── Step A: Hydrate from Supabase (merge with local) ────────────────────
    if (uid) {
      try {
        const [
          serverProfile,
          serverFoods,
          serverExercises,
          serverWater,
          serverWeights,
          serverSleepHistory,
          serverSleepToday,
          serverSquad,
          serverChallenges,
          serverSubscription,
        ] = await Promise.all([
          loadProfileFromSupabase(uid),
          loadFoodsFromSupabase(uid),
          loadExercisesFromSupabase(uid),
          loadWaterFromSupabase(uid),
          loadWeightHistoryFromSupabase(uid),
          loadSleepHistoryFromSupabase(uid),
          loadSleepFromSupabase(uid),
          loadSquadFeedFromSupabase(50),
          loadMyChallengesFromSupabase(uid),
          loadSubscriptionsFromSupabase(uid),
        ]);

        if (serverProfile) {
          const mergedP = {
            ...(profile || {}),
            ...serverProfile,
            id: serverProfile.id || uid,
            email: serverProfile.email || profile?.email || clientEmail || "",
            weight_kg: serverProfile.weight_kg ?? serverProfile.current_weight_kg ?? profile?.weight_kg,
            current_weight_kg: serverProfile.current_weight_kg ?? serverProfile.weight_kg ?? profile?.current_weight_kg,
            goal_weight_kg: serverProfile.goal_weight ?? serverProfile.goal_weight_kg ?? profile?.goal_weight_kg,
            goal_weight: serverProfile.goal_weight ?? serverProfile.goal_weight_kg ?? profile?.goal_weight,
            activity_level: serverProfile.activity_level || serverProfile.activity || profile?.activity_level,
            activity: serverProfile.activity || serverProfile.activity_level || profile?.activity,
            subscription_status: serverProfile.subscription || serverProfile.subscription_status || profile?.subscription_status,
            subscription: serverProfile.subscription || serverProfile.subscription_status || profile?.subscription,
            plan: serverProfile.subscription || serverProfile.subscription_status || profile?.plan,
            dailyCalorieTarget: serverProfile.calories || profile?.dailyCalorieTarget,
            calories: serverProfile.calories || profile?.calories,
            proteinTarget: serverProfile.protein ?? profile?.proteinTarget,
            protein: serverProfile.protein ?? profile?.protein,
            carbTarget: serverProfile.carbs ?? profile?.carbTarget,
            carbs: serverProfile.carbs ?? profile?.carbTarget,
            fatTarget: serverProfile.fat ?? profile?.fatTarget,
            fat: serverProfile.fat ?? profile?.fatTarget,
            onboarded: !!serverProfile.onboarded || !!profile?.onboarded,
          };
          try { await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(mergedP)); } catch (_e) {}
          setProfile(mergedP);
          if (mergedP.onboarded) { setOnboarded(true); try { await AsyncStorage.setItem(KEY_ONBOARD, "true"); } catch (_e) {} }
        }

        // Today food + exercises into dayLog
        const existingDay = { ...dayLog };
        const localMeals = existingDay.meals || { breakfast: [], lunch: [], dinner: [], snacks: [] };
        const mealKeys = ["breakfast", "lunch", "dinner", "snacks"];
        const byMeal = { breakfast: [...(localMeals.breakfast || [])], lunch: [...(localMeals.lunch || [])], dinner: [...(localMeals.dinner || [])], snacks: [...(localMeals.snacks || [])] };
        for (const f of serverFoods) {
          const meal = mealKeys.includes(f.meal) ? f.meal : "snacks";
          byMeal[meal] = dedupeById([...byMeal[meal], mapDbFoodToLocal(f)]);
        }
        const existingExercise = existingDay.exercise || [];
        const mergedExercises = dedupeById([...existingExercise, ...serverExercises.map(mapDbExerciseToLocal)]);
        const mergedWater = serverWater > (existingDay.water_litres || 0) ? serverWater : (existingDay.water_litres || 0);

        // Today sleep into dayLog.sleep
        let mergedSleep = existingDay.sleep || null;
        if (serverSleepToday && !mergedSleep) mergedSleep = { ...serverSleepToday };

        const hydratedDay = {
          ...existingDay,
          date: todayKey(),
          meals: byMeal,
          exercise: mergedExercises,
          water_litres: Number(mergedWater) || 0,
          sleep: mergedSleep,
        };
        const recomputed = recalc(hydratedDay);
        try { await AsyncStorage.setItem(KEY_LOG(recomputed.date), JSON.stringify(recomputed)); } catch (_e) {}
        setDayLog(recomputed);

        // Weight history (dedup by date, server wins if date collides)
        if (serverWeights.length) {
          const mapDate = new Map();
          for (const w of weights || []) mapDate.set(String(w.date), w);
          for (const w of serverWeights)     mapDate.set(String(w.date), w);
          const mergedW = Array.from(mapDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
          try { await AsyncStorage.setItem(KEY_WEIGHTS, JSON.stringify(mergedW)); } catch (_e) {}
          setWeights(mergedW);
        }

        // Sleep history (dedup by date)
        if (serverSleepHistory.length) {
          const mapDate = new Map();
          for (const s of sleepHistory || [])  mapDate.set(String(s.date), s);
          for (const s of serverSleepHistory) mapDate.set(String(s.date), s);
          const mergedS = Array.from(mapDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-14);
          try { await AsyncStorage.setItem(KEY_SLEEP, JSON.stringify(mergedS)); } catch (_e) {}
          setSleepHistory(mergedS);
        }

        if (serverSquad) setSquadFeed(serverSquad);
        if (serverChallenges) setMyChallenges(serverChallenges);
        if (serverSubscription) setUserSubscription(serverSubscription);
      } catch (_e) {
        // Fail open. Realtime hydration is additive only.
      }

      // ── Step B: Start live channels ────────────────────────────────────────
      stopRealtime();

      // 1. Profile
      realtimeChannels.current.push(subscribeTable("profiles", { eq: `id=eq.${uid}` }, (evt, rec) => {
        if (evt === "DELETE") return;
        setProfile(p => {
          const merged = { ...(p || {}), ...(rec || {}), id: uid, email: rec?.email || p?.email || clientEmail || "" };
          try { AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(merged)).catch(() => {}); } catch (_e) {}
          return merged;
        });
      }));

      // 2. Food logs
      realtimeChannels.current.push(subscribeTable("food_logs", { uid }, (evt, rec) => {
        if (!rec) return;
        setDayLog(prev => {
          const meals = prev.meals || { breakfast: [], lunch: [], dinner: [], snacks: [] };
          const mealKeys = ["breakfast", "lunch", "dinner", "snacks"];
          const meal = mealKeys.includes(rec.meal) ? rec.meal : "snacks";
          const updatedMeal = evt === "DELETE"
            ? (meals[meal] || []).filter(x => x.id !== rec.id && String(x.id || "") !== String(rec.id || ""))
            : mergeListWithId(meals[meal], mapDbFoodToLocal(rec), evt === "INSERT" ? "insert" : "upsert");
          const updated = recalc({ ...prev, meals: { ...meals, [meal]: updatedMeal } });
          try { AsyncStorage.setItem(KEY_LOG(updated.date), JSON.stringify(updated)).catch(() => {}); } catch (_e) {}
          return updated;
        });
      }));

      // 3. Exercise logs
      realtimeChannels.current.push(subscribeTable("exercise_logs", { uid }, (evt, rec) => {
        if (!rec) return;
        setDayLog(prev => {
          const next = evt === "DELETE"
            ? (prev.exercise || []).filter(x => String(x.id || "") !== String(rec.id || ""))
            : mergeListWithId(prev.exercise, mapDbExerciseToLocal(rec), evt === "INSERT" ? "insert" : "upsert");
          const updated = recalc({ ...prev, exercise: next });
          try { AsyncStorage.setItem(KEY_LOG(updated.date), JSON.stringify(updated)).catch(() => {}); } catch (_e) {}
          return updated;
        });
      }));

      // 4. Water logs (unique per date, set not append)
      realtimeChannels.current.push(subscribeTable("water_logs", { uid }, (evt, rec) => {
        if (evt === "DELETE") return;
        if (!rec || String(rec.date || "") !== todayKey()) return;
        setDayLog(prev => {
          const l = Number(prev.water_litres || 0);
          const s = Number(rec.litres || 0);
          if (Math.abs(l - s) < 0.01) return prev;
          const updated = recalc({ ...prev, water_litres: s });
          try { AsyncStorage.setItem(KEY_LOG(updated.date), JSON.stringify(updated)).catch(() => {}); } catch (_e) {}
          return updated;
        });
      }));

      // 5. Weight logs
      realtimeChannels.current.push(subscribeTable("weight_logs", { uid }, (evt, rec) => {
        if (!rec || !rec.date) return;
        setWeights(prev => {
          const entry = { date: String(rec.date), weight_kg: Number(rec.weight_kg || 0) };
          let list;
          if (evt === "DELETE") list = (prev || []).filter(x => String(x.date) !== String(rec.date));
          else                   list = mergeListWithId(prev || [], entry, "upsert");
          const sorted = dedupeById(list).sort((a, b) => String(a.date).localeCompare(String(b.date)));
          try { AsyncStorage.setItem(KEY_WEIGHTS, JSON.stringify(sorted)).catch(() => {}); } catch (_e) {}
          return sorted;
        });
      }));

      // 6. Sleep logs
      realtimeChannels.current.push(subscribeTable("sleep_logs", { uid }, (evt, rec) => {
        if (!rec || !rec.date) return;
        const entry = {
          date: String(rec.date),
          bedTime: rec.bed_time || "",
          wakeTime: rec.wake_time || "",
          duration: Number(rec.duration || 0),
          quality: rec.quality || "",
          notes: rec.notes || "",
          loggedAt: new Date().toISOString(),
        };
        setDayLog(prev => {
          if (String(entry.date) !== todayKey()) return prev;
          if (evt === "DELETE") return recalc({ ...prev, sleep: null });
          const updated = recalc({ ...prev, sleep: entry });
          try { AsyncStorage.setItem(KEY_LOG(updated.date), JSON.stringify(updated)).catch(() => {}); } catch (_e) {}
          return updated;
        });
        setSleepHistory(prev => {
          let next;
          if (evt === "DELETE") next = (prev || []).filter(x => String(x.date) !== String(entry.date));
          else                   next = mergeListWithId(prev || [], entry, "upsert");
          const sorted = dedupeById(next).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-14);
          try { AsyncStorage.setItem(KEY_SLEEP, JSON.stringify(sorted)).catch(() => {}); } catch (_e) {}
          return sorted;
        });
      }));

      // 7. Squad feed
      realtimeChannels.current.push(subscribeTable("squad_feed", undefined, (evt, rec) => {
        if (!rec) return;
        setSquadFeed(prev => {
          let next;
          if (evt === "DELETE") next = (prev || []).filter(x => x.id !== rec.id);
          else                   next = mergeListWithId(prev || [], rec, "upsert");
          return dedupeById(next).sort((a, b) => {
            const pa = !!a.is_pinned, pb = !!b.is_pinned;
            if (pa !== pb) return pb - pa;
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
          });
        });
      }));

      // 8. Squad comments
      realtimeChannels.current.push(subscribeTable("squad_comments", undefined, (evt, rec) => {
        if (!rec) return;
        setSquadComments(prev => {
          let next;
          if (evt === "DELETE") next = (prev || []).filter(x => x.id !== rec.id);
          else                   next = mergeListWithId(prev || [], rec, "upsert");
          return dedupeById(next).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        });
      }));

      // 9. Challenge participants (user only)
      realtimeChannels.current.push(subscribeTable("challenge_participants", { uid }, (evt, rec) => {
        if (!rec) return;
        setMyChallenges(prev => {
          let next;
          if (evt === "DELETE") next = (prev || []).filter(x => x.challenge_id !== rec.challenge_id);
          else                   next = mergeListWithId(prev || [], rec, "upsert");
          return dedupeById(next);
        });
      }));

      // 10. Subscriptions
      realtimeChannels.current.push(subscribeTable("subscriptions", { eq: `user_id=eq.${uid}` }, (evt, rec) => {
        if (evt === "DELETE") { setUserSubscription(null); return; }
        if (rec) setUserSubscription(rec);
      }));

      // 11. Leaderboard (real aggregate via get_leaderboard RPC)
      fetchLeaderboard(uid);
    }
  }

  function stopRealtime() {
    const list = realtimeChannels.current || [];
    for (const ch of list) try { ch.unsubscribe(); } catch (_e) {}
    realtimeChannels.current = [];
  }

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
    stopRealtime();
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
    setSquadFeed([]); setSquadComments([]); setMyChallenges([]); setUserSubscription(null);
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
      await fetchLeaderboard();
    } catch (_e) {}
  }

  async function fetchLeaderboard(uidOverride) {
    const LB_COLORS = ["#F43F8E", "#6366F1", "#10B981", "#F59E0B", "#7C3AED", "#FB923C", "#3B82F6", "#EC4899", "#14B8A6", "#8B5CF6"];
    try {
      const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: 50 });
      if (error) throw error;
      const me = uidOverride || profile?.id || clientId || null;
      const rows = (data || []).map((r, i) => {
        const nm = r.name || "WeGoFit Member";
        const initials = nm.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("") || "W";
        const seed = r.user_id || String(i);
        let h = 0;
        for (let c = 0; c < seed.length; c++) h = (h * 31 + seed.charCodeAt(c)) >>> 0;
        return {
          rank: Number(r.rank) || (i + 1),
          user_id: r.user_id,
          name: nm,
          initials,
          points: Number(r.points) || 0,
          streak: Number(r.streak) || 0,
          plan: r.plan || "free",
          color: LB_COLORS[h % LB_COLORS.length],
          isUser: !!me && r.user_id === me,
        };
      });
      setLeaderboard(rows);
    } catch (_e) { /* keep previous / empty — UI shows an empty state */ }
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
      leaderboard, fetchLeaderboard,
      isDark, toggleDarkMode,
      storageClientId: clientId,
      // ── Realtime additive extras (existing screens work without them) ──
      squadFeed, squadComments, myChallenges, userSubscription,
      hydrateAndSubscribeFromSupabase, stopRealtime,
    }}>
      <DarkCtx.Provider value={{ isDark, theme, toggleDarkMode }}>
        {children}
      </DarkCtx.Provider>
    </Ctx.Provider>
  );
}

export { Ctx, PaywallCtx, DarkCtx, GoFitProvider, getTheme, useTheme };
