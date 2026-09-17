// WeGoFit — Expo Snack single-file app
// Paste into snack.expo.dev and scan QR with Expo Go

// Polyfill crypto.getRandomValues for Supabase auth (signUp uses it for PKCE/nonce generation)
// Preserves any existing crypto properties (e.g. subtle) rather than clobbering the object.
// Also tests if the native implementation actually works — Hermes can expose getRandomValues
// as a function but have it throw at runtime, which a typeof check won't catch.
if (typeof global.crypto === "undefined") {
  global.crypto = {};
}
(function patchGetRandomValues() {
  function syntheticGetRandomValues(buf) {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    return buf;
  }
  if (typeof global.crypto.getRandomValues !== "function") {
    global.crypto.getRandomValues = syntheticGetRandomValues;
  } else {
    try {
      global.crypto.getRandomValues(new Uint8Array(1));
    } catch (_e) {
      global.crypto.getRandomValues = syntheticGetRandomValues;
    }
  }
}());

// Polyfill for Supabase in Expo Snack
if (typeof global.URL === "undefined") {
  global.URL = class URL {
    constructor(url, base) {
      const full = base
        ? base.replace(/\/$/, "") + "/" + url.replace(/^\//, "")
        : url;
      this.href     = full;
      this.origin   = full.split("/").slice(0, 3).join("/");
      this.pathname = "/" + full.split("/").slice(3).join("/");
      this.search   = "";
      this.hash     = "";
      this.host     = full.split("/")[2] || "";
      this.hostname = this.host.split(":")[0];
      this.protocol = full.split(":")[0] + ":";
    }
    toString() { return this.href; }
  };
}

if (typeof global.URLSearchParams === "undefined") {
  global.URLSearchParams = class {
    constructor(init) {
      this._params = {};
      if (typeof init === "string") {
        init.replace(/^\?/, "").split("&").forEach(pair => {
          const [k, v] = pair.split("=");
          if (k) this._params[decodeURIComponent(k)] = decodeURIComponent(v || "");
        });
      }
    }
    get(key)      { return this._params[key] || null; }
    set(key, val) { this._params[key] = val; }
    toString() {
      return Object.entries(this._params)
        .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
        .join("&");
    }
  };
}

import { createClient } from "@supabase/supabase-js";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import React, {
  useState, useEffect, useCallback,
  useContext, createContext, useRef,
} from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Dimensions, ActivityIndicator, Modal,
  Alert, Platform, FlatList, KeyboardAvoidingView,
  Keyboard, TouchableWithoutFeedback, Animated, Image, Linking, Switch,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
let Pedometer = null;
try { Pedometer = require("expo-sensors").Pedometer; } catch (_e) { Pedometer = null; }
let Notifications = null;
try {
  Notifications = require("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (_e) { Notifications = null; }
import Svg, { Circle, Path, G, Text as SvgText, Rect, Polyline, Line } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Asset } from 'expo-asset';
let Print = null;
try { Print = require("expo-print"); } catch (_e) { Print = null; }
let FileSystem = null;
try { FileSystem = require("expo-file-system"); } catch (_e) { FileSystem = null; }
let Sharing = null;
try { Sharing = require("expo-sharing"); } catch (_e) { Sharing = null; }

const { width: SW, height: SH } = Dimensions.get("window");

// ─── COLORS ──────────────────────────────────────────────────────────────────
const C = {
  bg:          "#070B14",
  bgSecondary: "#111827",
  card:        "#111827",
  cardLight:   "#1E2837",
  green:       "#FF6B35",
  greenDim:    "#FF8C5A",
  white:       "#FFFFFF",
  grey:        "rgba(255,255,255,0.45)",
  greyDim:     "rgba(255,255,255,0.3)",
  red:         "#EF4444",
  amber:       "#F59E0B",
  blue:        "#60A5FA",
  rose:        "#FF6B35",
  navy:        "#070B14",
  // text
  text:        "#FFFFFF",
  textSub:     "rgba(255,255,255,0.55)",
  border:      "rgba(255,255,255,0.06)",
  primary:     "#FF6B35",
};

const ROSE     = "#FF6B35";
const ROSE_DIM = "#FF8C5A";
const LOGO_URI = { uri: "/Enhanced_Logo.PNG" };

// ─── SUPABASE CLIENT ─────────────────────────────────────────────────────────
const SUPABASE_URL      = "https://yswkyjfsxsbmshliphet.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzd2t5amZzeHNibXNobGlwaGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTQxMTksImV4cCI6MjA5NDE5MDExOX0.fo_Eq_6c3jk8Ws02TJLxNWX3qHSD2otu3ZvdQBVeD1Y";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
    flowType:           "implicit",
  },
  global: {
    headers: {
      "X-Client-Info": "gofit-expo-snack",
    },
  },
});

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

// ─── WORKOUT VERIFICATION ─────────────────────────────────────────────────────
const WORKOUT_THRESHOLDS = {
  running:  { minDistance_km: 0.5,  minAvgSpeed_kmh: 4.0,  maxAvgSpeed_kmh: 25.0, minSteps: 600, minDuration_sec: 120, usesGPS: true,  usesPedometer: true  },
  cycling:  { minDistance_km: 1.0,  minAvgSpeed_kmh: 8.0,  maxAvgSpeed_kmh: 60.0, minSteps: 0,   minDuration_sec: 180, usesGPS: true,  usesPedometer: false },
  walking:  { minDistance_km: 0.3,  minAvgSpeed_kmh: 2.0,  maxAvgSpeed_kmh: 8.0,  minSteps: 400, minDuration_sec: 120, usesGPS: true,  usesPedometer: true  },
  hiking:   { minDistance_km: 0.5,  minAvgSpeed_kmh: 1.5,  maxAvgSpeed_kmh: 10.0, minSteps: 600, minDuration_sec: 300, usesGPS: true,  usesPedometer: true  },
  hiit:     { minDistance_km: 0,    minAvgSpeed_kmh: 0,    maxAvgSpeed_kmh: 999,  minSteps: 200, minDuration_sec: 300, usesGPS: false, usesPedometer: true  },
  jumprope: { minDistance_km: 0,    minAvgSpeed_kmh: 0,    maxAvgSpeed_kmh: 999,  minSteps: 300, minDuration_sec: 180, usesGPS: false, usesPedometer: true  },
  dancing:  { minDistance_km: 0,    minAvgSpeed_kmh: 0,    maxAvgSpeed_kmh: 999,  minSteps: 150, minDuration_sec: 180, usesGPS: false, usesPedometer: true  },
  squats:   { minDistance_km: 0,    minAvgSpeed_kmh: 0,    maxAvgSpeed_kmh: 999,  minSteps: 50,  minDuration_sec: 120, usesGPS: false, usesPedometer: true  },
};

function getWorkoutThreshold(workoutType) {
  return WORKOUT_THRESHOLDS[(workoutType || "").toLowerCase()] || WORKOUT_THRESHOLDS.hiit;
}

function fmtDurationSec(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function calculateIntegrityScore({ workoutType, distance_km, avgSpeed_kmh, duration_sec, stepCount }) {
  const t = getWorkoutThreshold(workoutType);
  let score = 0;
  const checks = [];

  // Level 1 — GPS distance (30 pts)
  if (t.usesGPS) {
    const passed = distance_km >= t.minDistance_km;
    if (passed) score += 30;
    checks.push({
      label:  "Distance",
      value:  passed ? `${distance_km.toFixed(2)}km` : `${distance_km.toFixed(2)}km (min ${t.minDistance_km}km)`,
      passed,
      points: passed ? 30 : 0,
    });
  } else {
    score += 30;
    checks.push({ label: "Distance", value: "Indoor ✅", passed: true, points: 30 });
  }

  // Level 2a — Speed validation (25 pts)
  if (t.usesGPS && avgSpeed_kmh > 0) {
    const tooFast = avgSpeed_kmh > t.maxAvgSpeed_kmh;
    const tooSlow = avgSpeed_kmh < t.minAvgSpeed_kmh;
    const passed  = !tooFast && !tooSlow;
    if (passed) score += 25;
    checks.push({
      label:  "Avg Speed",
      value:  tooFast ? `${avgSpeed_kmh.toFixed(1)}km/h ⚠️ Too fast` : tooSlow ? `${avgSpeed_kmh.toFixed(1)}km/h (too slow)` : `${avgSpeed_kmh.toFixed(1)}km/h`,
      passed,
      points: passed ? 25 : 0,
      flag:   tooFast ? "POSSIBLE_VEHICLE" : null,
    });
  } else if (!t.usesGPS) {
    score += 25;
    checks.push({ label: "Avg Speed", value: "Indoor — N/A ✅", passed: true, points: 25 });
  } else {
    checks.push({ label: "Avg Speed", value: "No GPS data", passed: false, points: 0 });
  }

  // Level 2b — Duration (20 pts)
  const durPassed = duration_sec >= t.minDuration_sec;
  if (durPassed) score += 20;
  checks.push({
    label:  "Duration",
    value:  durPassed ? fmtDurationSec(duration_sec) : `${fmtDurationSec(duration_sec)} (min ${Math.round(t.minDuration_sec / 60)} mins)`,
    passed: durPassed,
    points: durPassed ? 20 : 0,
  });

  // Level 3 — Pedometer (25 pts)
  if (t.usesPedometer) {
    if (stepCount >= t.minSteps) {
      score += 25;
      checks.push({ label: "Steps", value: `${stepCount.toLocaleString()} steps`, passed: true, points: 25 });
    } else if (stepCount === 0) {
      score += 12; // partial credit when sensor unavailable
      checks.push({ label: "Steps", value: "Sensor unavailable", passed: null, points: 12 });
    } else {
      checks.push({ label: "Steps", value: `${stepCount} steps (min ${t.minSteps})`, passed: false, points: 0 });
    }
  } else {
    score += 25;
    checks.push({ label: "Steps", value: "Not required ✅", passed: true, points: 25 });
  }

  const vehicleFlag = checks.some(c => c.flag === "POSSIBLE_VEHICLE");
  const isVerified  = score >= 60;
  return {
    score,
    maxScore:    100,
    isVerified,
    vehicleFlag,
    checks,
    verdict: isVerified ? "verified" : vehicleFlag ? "flagged_vehicle" : "insufficient",
  };
}

function NudgeBanner({ message, onDismiss }) {
  return (
    <View style={{
      backgroundColor: "#FFFBEB", borderLeftWidth: 4, borderLeftColor: "#F59E0B",
      margin: 16, padding: 12, borderRadius: 12, flexDirection: "row", alignItems: "center",
    }}>
      <Text style={{ flex: 1, color: "#92400E", fontSize: 13, fontWeight: "600" }}>{message}</Text>
      <TouchableOpacity onPress={onDismiss}>
        <Text style={{ color: "#F59E0B", fontSize: 18 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── VIP ACCOUNTS ─────────────────────────────────────────────────────────────
const VIP_ACCOUNTS = [
  "arintina77@gmail.com",
  "gofit.fitnessapp@gmail.com",  // TinaBarks coach account
];
function isVIPAccount(email) {
  return VIP_ACCOUNTS.includes(email?.toLowerCase().trim());
}

// ─── KEYBOARD HELPERS ────────────────────────────────────────────────────────
// Reusable wrapper: KeyboardAvoidingView + dismiss-on-tap + ScrollView
function KeyboardSafeView({ children, style, centerContent = true }) {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: centerContent ? "center" : "flex-start" }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View>{children}</View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Modal sheet wrapper with KAV so keyboard pushes content up
function ModalSheet({ visible, onClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableWithoutFeedback onPress={onClose} accessible={false}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        </TouchableWithoutFeedback>
        <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 44 : 36, paddingTop: 16,
          maxHeight: "92%" }}>
          <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2,
            alignSelf: "center", marginBottom: 16 }} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── FOOD DATABASE ────────────────────────────────────────────────────────────
const FOODS = [
  // ── GLOBAL FOODS ──
  { id:"f1",  region:"global", name:"Chicken Breast",     serving:"100g",         cal:165, p:31,  c:0,  f:3.6 },
  { id:"f2",  region:"global", name:"Brown Rice",         serving:"100g cooked",  cal:112, p:2.6, c:23, f:0.9 },
  { id:"f3",  region:"global", name:"Banana",             serving:"1 medium",     cal:89,  p:1.1, c:23, f:0.3 },
  { id:"f4",  region:"global", name:"Whole Egg",          serving:"1 large",      cal:72,  p:6,   c:0.4,f:5   },
  { id:"f5",  region:"global", name:"Greek Yogurt",       serving:"170g",         cal:100, p:17,  c:6,  f:0.7 },
  { id:"f6",  region:"global", name:"Almonds",            serving:"28g",          cal:164, p:6,   c:6,  f:14  },
  { id:"f7",  region:"global", name:"Oats",               serving:"40g dry",      cal:150, p:5,   c:27, f:3   },
  { id:"f8",  region:"global", name:"Salmon",             serving:"100g",         cal:208, p:20,  c:0,  f:13  },
  { id:"f9",  region:"global", name:"Sweet Potato",       serving:"100g",         cal:86,  p:1.6, c:20, f:0.1 },
  { id:"f10", region:"global", name:"Avocado",            serving:"100g",         cal:160, p:2,   c:9,  f:15  },
  { id:"f11", region:"global", name:"Broccoli",           serving:"100g",         cal:34,  p:2.8, c:7,  f:0.4 },
  { id:"f12", region:"global", name:"Tuna (canned)",      serving:"100g",         cal:116, p:26,  c:0,  f:1   },
  { id:"f13", region:"global", name:"White Rice",         serving:"100g cooked",  cal:130, p:2.7, c:28, f:0.3 },
  { id:"f14", region:"global", name:"Peanut Butter",      serving:"2 tbsp",       cal:190, p:8,   c:6,  f:16  },
  { id:"f15", region:"global", name:"Cottage Cheese",     serving:"100g",         cal:98,  p:11,  c:3.4,f:4.3 },
  { id:"f16", region:"global", name:"Lentils",            serving:"100g cooked",  cal:116, p:9,   c:20, f:0.4 },
  { id:"f17", region:"global", name:"Whole Milk",         serving:"240ml",        cal:149, p:8,   c:12, f:8   },
  { id:"f18", region:"global", name:"Orange",             serving:"1 medium",     cal:62,  p:1.2, c:15, f:0.2 },
  { id:"f19", region:"global", name:"Spinach",            serving:"100g",         cal:23,  p:2.9, c:3.6,f:0.4 },
  { id:"f20", region:"global", name:"Lean Ground Beef",   serving:"100g",         cal:215, p:26,  c:0,  f:12  },
  { id:"f21", region:"global", name:"Quinoa",             serving:"100g cooked",  cal:120, p:4.4, c:21, f:1.9 },
  { id:"f22", region:"global", name:"Apple",              serving:"1 medium",     cal:95,  p:0.5, c:25, f:0.3 },
  { id:"f23", region:"global", name:"Whey Protein",       serving:"1 scoop 30g",  cal:120, p:24,  c:3,  f:2   },
  { id:"f24", region:"global", name:"Olive Oil",          serving:"1 tbsp",       cal:119, p:0,   c:0,  f:14  },
  { id:"f25", region:"global", name:"Blueberries",        serving:"100g",         cal:57,  p:0.7, c:14, f:0.3 },

  // ── UGANDAN STAPLES ──
  { id:"af01", region:"african", country:"Uganda",   emoji:"🍌", name:"Matoke (steamed)",       serving:"200g",  cal:176, p:2,   c:45, f:0.4 },
  { id:"af02", region:"african", country:"Uganda",   emoji:"🌽", name:"Posho / Ugali",           serving:"150g",  cal:207, p:2,   c:46, f:0.6 },
  { id:"af03", region:"african", country:"Uganda",   emoji:"🌯", name:"Rolex (egg & chapati)",   serving:"1 piece",cal:320,p:12,  c:38, f:13  },
  { id:"af04", region:"african", country:"Uganda",   emoji:"🥜", name:"Groundnut Stew",          serving:"200g",  cal:380, p:14,  c:18, f:28  },
  { id:"af05", region:"african", country:"Uganda",   emoji:"🍲", name:"Katogo (offal stew)",     serving:"200g",  cal:290, p:22,  c:18, f:14  },
  { id:"af06", region:"african", country:"Uganda",   emoji:"🫘", name:"Matooke & beans",         serving:"300g",  cal:340, p:12,  c:65, f:2   },
  { id:"af07", region:"african", country:"Uganda",   emoji:"🦟", name:"Nswaa (fried termites)",  serving:"50g",   cal:140, p:18,  c:4,  f:7   },
  { id:"af08", region:"african", country:"Uganda",   emoji:"🌿", name:"Sim Sim (sesame) paste",  serving:"30g tbsp",cal:170,p:5,  c:6,  f:15  },
  { id:"af09", region:"african", country:"Uganda",   emoji:"🥔", name:"Cassava (boiled)",        serving:"150g",  cal:198, p:1.5, c:48, f:0.3 },
  { id:"af10", region:"african", country:"Uganda",   emoji:"🎋", name:"Malewa (bamboo shoots)",  serving:"100g",  cal:27,  p:2.6, c:5,  f:0.3 },

  // ── KENYAN STAPLES ──
  { id:"af11", region:"african", country:"Kenya",    emoji:"🌽", name:"Ugali (maize)",           serving:"150g",  cal:216, p:2.1, c:48, f:0.6 },
  { id:"af12", region:"african", country:"Kenya",    emoji:"🥬", name:"Sukuma Wiki",              serving:"100g",  cal:35,  p:3.4, c:6,  f:0.7 },
  { id:"af13", region:"african", country:"Kenya",    emoji:"🥩", name:"Nyama Choma (goat)",      serving:"100g",  cal:273, p:49,  c:3,  f:6   },
  { id:"af14", region:"african", country:"Kenya",    emoji:"🫓", name:"Chapati (1 piece)",        serving:"60g",   cal:150, p:4,   c:26, f:4   },
  { id:"af15", region:"african", country:"Kenya",    emoji:"🫘", name:"Githeri (maize+beans)",   serving:"200g",  cal:280, p:14,  c:48, f:2   },
  { id:"af16", region:"african", country:"Kenya",    emoji:"🥔", name:"Mukimo",                  serving:"200g",  cal:240, p:6,   c:48, f:2   },
  { id:"af17", region:"african", country:"Kenya",    emoji:"🌽", name:"Irio",                    serving:"200g",  cal:220, p:7,   c:42, f:2   },
  { id:"af18", region:"african", country:"Kenya",    emoji:"🐟", name:"Omena (dried fish)",      serving:"50g",   cal:116, p:20,  c:0,  f:4   },
  { id:"af19", region:"african", country:"Kenya",    emoji:"🍩", name:"Mandazi (1 piece)",       serving:"50g",   cal:160, p:3,   c:26, f:5   },
  { id:"af20", region:"african", country:"Kenya",    emoji:"🥗", name:"Kachumbari salad",        serving:"100g",  cal:25,  p:1,   c:5,  f:0.2 },
  { id:"af21", region:"african", country:"Kenya",    emoji:"🥟", name:"Samosa (1 piece)",        serving:"60g",   cal:190, p:5,   c:20, f:10  },
  { id:"af22", region:"african", country:"Kenya",    emoji:"🍚", name:"Pilau rice",              serving:"200g",  cal:320, p:8,   c:58, f:6   },
  { id:"af23", region:"african", country:"Kenya",    emoji:"🥣", name:"Uji (millet porridge)",   serving:"250ml", cal:130, p:3,   c:28, f:1   },
  { id:"af24", region:"african", country:"Kenya",    emoji:"🐟", name:"Tilapia (Lake Vic.)",     serving:"100g",  cal:128, p:26,  c:0,  f:3   },
  { id:"af25", region:"african", country:"Kenya",    emoji:"🥔", name:"Bhajia (potato snack)",   serving:"100g",  cal:220, p:4,   c:28, f:11  },

  // ── TANZANIAN DISHES ──
  { id:"af26", region:"african", country:"Tanzania", emoji:"🍚", name:"Wali wa Nazi (coconut rice)",   serving:"200g", cal:340, p:5,   c:60, f:9  },
  { id:"af27", region:"african", country:"Tanzania", emoji:"🍛", name:"Biryani (meat & rice)",          serving:"250g", cal:420, p:22,  c:52, f:12 },
  { id:"af28", region:"african", country:"Tanzania", emoji:"🌽", name:"Ugali (cassava)",                serving:"150g", cal:195, p:1.5, c:47, f:0.2},
  { id:"af29", region:"african", country:"Tanzania", emoji:"🍢", name:"Mshikaki (meat skewer)",         serving:"100g", cal:210, p:24,  c:4,  f:11 },
  { id:"af30", region:"african", country:"Tanzania", emoji:"🌮", name:"Zanzibar mix (street food)",     serving:"200g", cal:380, p:12,  c:48, f:16 },

  // ── RWANDAN / CENTRAL EAST AFRICAN ──
  { id:"af31", region:"african", country:"Rwanda",   emoji:"🌿", name:"Isombe (cassava leaves)",        serving:"150g", cal:95,  p:5,   c:14, f:3  },
  { id:"af32", region:"african", country:"Rwanda",   emoji:"🫘", name:"Igisafuliya (cowpea stew)",      serving:"200g", cal:230, p:12,  c:34, f:5  },
  { id:"af33", region:"african", country:"Rwanda",   emoji:"🍢", name:"Brochette (grilled meat)",       serving:"100g", cal:215, p:25,  c:2,  f:12 },
  { id:"af34", region:"african", country:"Rwanda",   emoji:"🍌", name:"Mizuzu (fried plantain)",        serving:"100g", cal:180, p:1.5, c:42, f:1  },

  // ── DRINKS & EXTRAS (East African) ──
  { id:"af35", region:"african", country:"EA",       emoji:"🍵", name:"Chai (spiced milk tea)",         serving:"240ml",cal:90,  p:3,   c:14, f:3  },
  { id:"af36", region:"african", country:"Kenya",    emoji:"🍹", name:"Dawa cocktail (honey+lime)",     serving:"200ml",cal:120, p:0,   c:30, f:0  },
  { id:"af37", region:"african", country:"EA",       emoji:"🥭", name:"Fresh mango juice",              serving:"300ml",cal:130, p:1,   c:33, f:0.5},
  { id:"af38", region:"african", country:"EA",       emoji:"🍊", name:"Passion fruit juice",            serving:"300ml",cal:105, p:1,   c:27, f:0.2},
  { id:"af39", region:"african", country:"Uganda",   emoji:"🍺", name:"Fermented millet (obushera)",    serving:"300ml",cal:115, p:2,   c:24, f:0.5},
  { id:"af40", region:"african", country:"EA",       emoji:"🌽", name:"Roasted maize (corn cob)",       serving:"100g", cal:130, p:3.5, c:27, f:2  },
  { id:"af41", region:"african", country:"EA",       emoji:"🍠", name:"Sweet potato (boiled)",          serving:"150g", cal:129, p:2.4, c:30, f:0.2},
  { id:"af42", region:"african", country:"EA",       emoji:"🎃", name:"Pumpkin (boiled)",               serving:"100g", cal:26,  p:1,   c:6,  f:0.1},
  { id:"af43", region:"african", country:"EA",       emoji:"🫘", name:"Ndengu (green grams)",           serving:"150g", cal:180, p:13,  c:30, f:1  },
  { id:"af44", region:"african", country:"EA",       emoji:"🫘", name:"Red kidney beans (cooked)",      serving:"150g", cal:170, p:12,  c:30, f:0.5},
  { id:"af45", region:"african", country:"EA",       emoji:"🥜", name:"Groundnuts (roasted)",           serving:"30g",  cal:170, p:7,   c:5,  f:14 },
  { id:"af46", region:"african", country:"EA",       emoji:"🟡", name:"Jackfruit (ripe)",               serving:"100g", cal:95,  p:1.7, c:23, f:0.6},
  { id:"af47", region:"african", country:"EA",       emoji:"🥑", name:"Avocado (hass, 1 medium)",       serving:"150g", cal:240, p:3,   c:13, f:22 },
  { id:"af48", region:"african", country:"EA",       emoji:"🍆", name:"Eggplant stew",                  serving:"200g", cal:110, p:3,   c:14, f:5  },
  { id:"af49", region:"african", country:"EA",       emoji:"🥩", name:"Liver (beef, fried)",            serving:"100g", cal:175, p:27,  c:5,  f:5  },
  { id:"af50", region:"african", country:"EA",       emoji:"🍲", name:"Matumbo (tripe stew)",           serving:"150g", cal:180, p:20,  c:5,  f:9  },
];

// ─── EXERCISE DATABASE ────────────────────────────────────────────────────────

const GPS_WORKOUT_TYPES = [
  { id:"running",  label:"Running",  emoji:"🏃", met:8.5  },
  { id:"cycling",  label:"Cycling",  emoji:"🚴", met:6.0  },
  { id:"walking",  label:"Walking",  emoji:"🚶", met:3.5  },
  { id:"hiking",   label:"Hiking",   emoji:"🥾", met:5.3  },
];

// ─── COACH REPLIES ────────────────────────────────────────────────────────────
// ─── AI COACH HELPERS ─────────────────────────────────────────────────────────

function detectMessageCategory(message) {
  const msg = message.toLowerCase();
  if (msg.match(/food|eat|meal|calori|protein|carb|fat|diet|nutrition|breakfast|lunch|dinner|snack|ugali|matoke|chapati|sukuma|kachumbari/)) return "nutrition";
  if (msg.match(/workout|exercise|run|cycl|walk|hiit|train|gym|session|cardio|strength/)) return "workout";
  if (msg.match(/sleep|rest|tired|recovery|insomnia|wake/)) return "sleep";
  if (msg.match(/weight|fat|slim|lose|gain|bmi|belly|scale/)) return "weight";
  if (msg.match(/water|hydrat|drink/)) return "hydration";
  if (msg.match(/motivat|give up|hard|struggle|quit|discourag/)) return "motivation";
  if (msg.match(/supplement|protein powder|creatine|vitamin/)) return "supplement";
  if (msg.match(/pain|hurt|injur|sore|ache/)) return "recovery";
  return "general";
}

function getFallbackReply(category, profile) {
  const name = profile?.name || "there";
  const replies = {
    nutrition: [
      `Great question ${name}! Focus on hitting your protein target first — everything else follows. Include sukuma wiki or spinach daily for iron and vitamins. Coach TinaBarks will personally follow up soon! 🌸`,
      `For your goal, aim to fill half your plate with vegetables like kachumbari or sukuma wiki at lunch. Keep dinner light — protein + greens only. Coach TinaBarks will follow up soon! 🌸`,
    ],
    workout: [
      `Consistency beats perfection every time ${name}! Even a 20-min walk counts as movement. Log it in WeGoFit and watch your streak build! Coach TinaBarks will personally follow up soon! 🌸`,
      `For best results, mix cardio with strength training across the week. Your WeGoFit Train tab has everything you need! Coach TinaBarks will follow up with a personalised plan soon! 🌸`,
    ],
    sleep: [
      `Sleep is your secret weapon ${name}! 7-9 hours = better recovery, less cravings and more fat burn. Try sleeping before 10PM tonight. Coach TinaBarks will follow up soon! 🌸`,
    ],
    weight: [
      `You are closer than you think ${name}! Trust the process — your body is changing even when the scale doesn't move. Focus on how you FEEL. Coach TinaBarks will personally follow up soon! 🌸`,
      `Small consistent steps beat drastic measures every time. Stick to your calorie target and keep logging! Coach TinaBarks will check your progress soon! 🌸`,
    ],
    hydration: [
      `Water is your best fat-loss tool ${name}! Aim for 2L daily. Try warm lemon water first thing in the morning — it boosts metabolism! Coach TinaBarks will follow up soon! 🌸`,
    ],
    motivation: [
      `You showed up today ${name} and that is everything! Progress is not always visible but it IS happening. Trust the journey. Coach TinaBarks believes in you completely! 🌸`,
      `Every champion was once a beginner who refused to give up. You have already taken the hardest step — starting. Keep going ${name}! Coach TinaBarks is in your corner always! 🌸`,
    ],
    supplement: [
      `For your goals, focus on whole foods first ${name}. Whey protein post-workout is a great addition if needed. Creatine is safe and effective for strength. Coach TinaBarks will give you a specific recommendation soon! 🌸`,
    ],
    recovery: [
      `Please listen to your body ${name}. Rest days are as important as workout days. If pain persists please see a doctor. Light stretching and hydration help recovery. Coach TinaBarks will follow up soon! 🌸`,
    ],
    general: [
      `Thank you for reaching out ${name}! Your dedication to your health journey is inspiring. Keep logging, keep moving and keep believing. Coach TinaBarks will personally reply to you very soon! 🌸`,
      `Hey ${name}! Great to hear from you. Your WeGoFit journey is looking amazing — keep up the consistency! Coach TinaBarks will personally follow up with you soon! 🌸`,
    ],
  };
  const options = replies[category] || replies.general;
  return options[Math.floor(Math.random() * options.length)];
}

async function getAICoachReply(userMessage, clientProfile) {
  const category = detectMessageCategory(userMessage);
  const systemPrompt = `You are TinaBarks' AI Assistant for WeGoFit, a premium East African fitness app. You are warm, encouraging, professional and knowledgeable about fitness and nutrition.

Client: ${clientProfile?.name || "there"}, Goal: ${clientProfile?.goal || "improve fitness"}, Weight: ${clientProfile?.weight_kg || "unknown"}kg, Calorie target: ${clientProfile?.dailyCalorieTarget || 1800} kcal, Activity: ${clientProfile?.activity_level || "moderate"}, Location: East Africa. Category: ${category}.

CRITICAL RULE: Keep every response under 60 words maximum. Never write long paragraphs. Use short punchy sentences. Maximum 3-4 sentences per response. This is a mobile chat — be concise.
RULES: Never start with a prefix like "TinaBarks' Assistant:" or "Assistant:" — reply directly. Reference East African foods/context where relevant. Use 1-2 emojis max. Never give medical advice. Always be positive. If about injury/pain → recommend seeing a doctor.`;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token || SUPABASE_ANON_KEY;
    const res = await fetch(SUPABASE_URL + "/functions/v1/ai-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}`, "Apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({
        mode: "coach",
        messages: [{ role: "user", content: userMessage }],
        userContext: {
          name: clientProfile?.name,
          goal: clientProfile?.goal,
          weight_kg: clientProfile?.weight_kg,
          dailyCalorieTarget: clientProfile?.dailyCalorieTarget,
          activity_level: clientProfile?.activity_level,
        },
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.reply;
  } catch (_e) {
    return getFallbackReply(category, clientProfile);
  }
}

function generateWelcomeMessage(profile) {
  const name     = profile?.name || "Champion";
  const goal     = profile?.goal;
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const goalText = { lose: "lose weight and feel amazing", gain: "build muscle and get stronger",
    maintain: "maintain your healthy lifestyle", fitness: "improve your fitness and energy" }[goal] || "reach your fitness goals";
  const quickStart = ({
    lose:     ["Log all 4 meals today", "Hit your 2L water goal", "Take a 20-minute walk", "Check your personalised meal plan"],
    gain:     ["Log your protein intake today", "Complete your first workout", "Hit your calorie target", "Check your meal plan for muscle gain"],
    maintain: ["Log today's meals", "Stay hydrated — 2L today", "Move for at least 30 minutes", "Check in on your progress"],
    fitness:  ["Start with a 20-minute workout", "Log all your meals today", "Hit your water goal", "Explore the workout videos"],
  })[goal] || ["Log today's meals", "Drink 2L of water", "Complete a workout", "Check your meal plan"];
  return { id: "welcome_" + Date.now(), sender: "coach", role: "coach", isWelcome: true,
    timestamp: new Date().toISOString(), ts: new Date().toISOString(),
    name, greeting, goalText, quickStart, text: `${greeting} ${name}! Welcome to WeGoFit! 🎉` };
}

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────
function calcBMR(gender, weight_kg, height_cm, age) {
  // Mifflin-St Jeor Equation (most accurate)
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

  // Calories consumed by protein
  const proteinCal = protein * 4;

  // Fat: 30% of non-protein calories, enforced to minimum 40g
  const rawFat = Math.round(((dailyCalories - proteinCal) * 0.30) / 9);
  const fat    = Math.max(FAT_MIN, rawFat);          // line 653 — fat minimum floor

  // Carbs: remaining calories after protein and fat
  let carbCal  = dailyCalories - proteinCal - fat * 9;
  let carbs    = Math.round(carbCal / 4);

  // If carbs fall below minimum, raise total calories to cover the floor
  if (carbs < CARB_MIN) {
    carbs    = CARB_MIN;
    carbCal  = CARB_MIN * 4;
    // dailyCalories is the input — we return adjusted values but don't mutate it
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

// ─── REFERENCE RANGE HELPER ───────────────────────────────────────────────────
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

// ─── CALORIE RANGE NOTE ───────────────────────────────────────────────────────
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

// ─── CALORIE STATUS ENGINE ────────────────────────────────────────────────────
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

// ─── SLEEP UTILITIES ──────────────────────────────────────────────────────────
const SLEEP_GOAL = 7.5; // hours

function parseSleepTime(hhmm) {
  // "23:00" → { h: 23, m: 0 }
  const [h, m] = hhmm.split(":").map(Number);
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

function calcSleepDuration(bedTime, wakeTime) {
  // Both "HH:MM" strings; bed may be previous night
  const b = parseSleepTime(bedTime);
  const w = parseSleepTime(wakeTime);
  let bedMins  = b.h * 60 + b.m;
  let wakeMins = w.h * 60 + w.m;
  if (wakeMins <= bedMins) wakeMins += 1440; // crossed midnight
  const diff = wakeMins - bedMins;
  return Math.round(diff / 60 * 100) / 100; // hours, 2dp
}

function sleepQuality(hours) {
  if (hours < 5)  return "poor";
  if (hours < 6)  return "fair";
  if (hours <= 8) return "good";
  return "great";
}

function sleepQualityEmoji(q) {
  return { poor: "😟", fair: "😐", good: "😊", great: "🌟" }[q] || "😊";
}

function fmtSleepDur(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmt12h(hhmm) {
  if (!hhmm) return "";
  const { h, m } = parseSleepTime(hhmm);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function sleepBarColor(hours) {
  if (hours < 5)  return "#EF4444";
  if (hours < 6)  return "#F59E0B";
  if (hours <= 8) return "#10B981";
  return "#F43F8E";
}

// ─── COMMUNITY / BADGES DATA ─────────────────────────────────────────────────
const POINTS = {
  log_meal:           10,
  complete_workout:   50,
  hit_calorie_goal:   30,
  hit_water_goal:     20,
  log_sleep:          15,
  seven_day_streak:   100,
  complete_challenge: 200,
  lose_1kg:           150,
  share_achievement:  25,
};

const RARITY_CONFIG = {
  common:    { label: "COMMON",    color: "#888888", ringWidth: 3, glowRadius: 6,  cardBg: "#2D2D2D", border: "#444444",  iconBg: "#3D3D3D", rarityColor: "#888888", lockColor: "#666666", glow: "rgba(255,255,255,0.1)"  },
  uncommon:  { label: "UNCOMMON",  color: "#4CAF50", ringWidth: 3, glowRadius: 8,  cardBg: "#0D3D2E", border: "#1a6b4a",  iconBg: "#0F4D38", rarityColor: "#4CAF50", lockColor: "#4CAF50", glow: "rgba(76,175,80,0.3)"   },
  rare:      { label: "RARE",      color: "#4A90E2", ringWidth: 4, glowRadius: 12, cardBg: "#0D1B3E", border: "#1a3a7a",  iconBg: "#0F2050", rarityColor: "#4A90E2", lockColor: "#4A90E2", glow: "rgba(74,144,226,0.3)"  },
  epic:      { label: "EPIC",      color: "#B366FF", ringWidth: 4, glowRadius: 16, cardBg: "#2D0D3E", border: "#6B35B8",  iconBg: "#3D1050", rarityColor: "#B366FF", lockColor: "#B366FF", glow: "rgba(179,102,255,0.3)" },
  legendary: { label: "LEGENDARY", color: "#FFD700", ringWidth: 5, glowRadius: 20, cardBg: "#3D2800", border: "#B8860B",  iconBg: "#4D3300", rarityColor: "#FFD700", lockColor: "#FFD700", glow: "rgba(255,215,0,0.4)"   },
};

const BADGES = [
  // Getting Started
  { id:"first_step",           name:"First Step",           icon:"👶", category:"starter",   desc:"Log your very first meal in WeGoFit. The journey of a thousand miles begins with one bite.",                                                                          how:"Log your first meal",                                           points:10,   rarity:"common"    },
  { id:"show_up",              name:"Show Up",               icon:"🚪", category:"starter",   desc:"Complete WeGoFit onboarding and set your first fitness goal. Showing up is half the battle.",                                                                          how:"Complete onboarding",                                           points:10,   rarity:"common"    },
  { id:"gravity_fighter",      name:"Gravity Fighter",       icon:"⚖️", category:"starter",   desc:"Log your weight for the first time. The scale and you are now on speaking terms.",                                                                                     how:"Log your weight for the first time",                            points:15,   rarity:"common"    },
  // Nutrition
  { id:"clean_eater",          name:"Clean Eater",           icon:"🥗", category:"nutrition", desc:"Log all 4 meals in a single day — breakfast, lunch, dinner and snack. The full squad shows up.",                                                                       how:"Log all 4 meals in one day",                                    points:25,   rarity:"common"    },
  { id:"calorie_sniper",       name:"Target Tracker",        icon:"🎯", category:"nutrition", desc:"Stay within your daily calorie target. Precision is a skill and you have it down.",                                                                                    how:"Finish within your calorie target",                             points:30,   rarity:"uncommon"  },
  // Hydration
  { id:"hydration_hero",       name:"Hydration Hero",        icon:"💧", category:"hydration", desc:"Hit your 2L daily water goal 3 days in a row. Your skin is glowing and your kidneys are throwing a party.",                                                            how:"Hit 2L water goal 3 days running",                              points:25,   rarity:"uncommon"  },
  // Fitness
  { id:"off_the_couch",        name:"Off The Couch",         icon:"🛋️", category:"fitness",   desc:"Complete your first workout in WeGoFit. The couch had a good run. Pun intended.",                                                                                      how:"Complete your first workout",                                   points:20,   rarity:"common"    },
  { id:"sweat_equity",         name:"Sweat Equity",          icon:"💦", category:"fitness",   desc:"Complete 10 workouts total. You have officially sweated more than a nervous accountant.",                                                                               how:"Log 10 total workouts",                                         points:50,   rarity:"uncommon"  },
  // Consistency
  { id:"three_day_wonder",     name:"3-Day Wonder",          icon:"✨", category:"streak",    desc:"Log your meals or workouts 3 days in a row. Habits are forming. Can you feel it?",                                                                                      how:"Log activity 3 days in a row",                                  points:20,   rarity:"common"    },
  { id:"week_warrior",         name:"Week Warrior",          icon:"🗡️", category:"streak",    desc:"Maintain a 7-day logging streak. Monday through Sunday — you showed up every single day like a champion.",                                                             how:"7-day consecutive logging streak",                              points:40,   rarity:"uncommon"  },
  { id:"fortnight_fighter",    name:"Fortnight Fighter",     icon:"⚔️", category:"streak",    desc:"14-day logging streak. At this point WeGoFit is basically part of your personality.",                                                                                   how:"14-day consecutive streak",                                     points:75,   rarity:"rare"      },
  { id:"monthly_monster",      name:"Monthly Monster",       icon:"👹", category:"streak",    desc:"30-day logging streak. You have transcended ordinary motivation. You are a WeGoFit legend.",                                                                            how:"30-day consecutive streak",                                     points:150,  rarity:"epic"      },
  // Weight Loss
  { id:"one_kg_down",          name:"1KG Down",              icon:"🎯", category:"weight",    desc:"Lose your first kilogram since joining WeGoFit. That kg has left the building. Permanently.",                                                                           how:"Lose 1kg since joining WeGoFit",                                points:50,   rarity:"rare"      },
  { id:"five_kg_titan",        name:"5KG Champion",          icon:"🏆", category:"weight",    desc:"Lose 5kg since joining WeGoFit. You have removed the weight of a small dog from your body.",                                                                            how:"Lose 5kg since joining WeGoFit",                                points:150,  rarity:"epic"      },
  // Elite
  { id:"transformation_titan", name:"Transformation Titan", icon:"🦋", category:"legend",   desc:"Complete a 30-day challenge, lose 5kg AND maintain a 30-day streak. You are not the same person who started.",                                                          how:"30-day streak + 5kg lost + challenge complete",                 points:300,  rarity:"legendary" },
  { id:"tinabarks_choice",     name:"TinaBarks Choice",      icon:"👑", category:"legend",   desc:"Personally awarded by Coach TinaBarks for outstanding dedication, consistency or transformation. Not everyone gets this one.",                                           how:"Awarded personally by Coach TinaBarks",                         points:200,  rarity:"legendary" },
];

const BADGE_CATEGORIES = ["all","starter","nutrition","hydration","fitness","streak","weight","legend"];

const MILESTONE_LEVELS = [
  { min: 0,    max: 99,   level: "Beginner",  emoji: "🌱", tagline: "Just Starting",       perk: "Welcome badge on profile",                                                 color: "#888888" },
  { min: 100,  max: 299,  level: "Active",    emoji: "💪", tagline: "Building Habits",     perk: "Unlocks custom profile border",                                            color: "#4CAF50" },
  { min: 300,  max: 599,  level: "Committed", emoji: "🔥", tagline: "On The Journey",      perk: "Unlocks exclusive Squad feed flair",                                       color: "#FB923C" },
  { min: 600,  max: 899,  level: "Champion",  emoji: "🏆", tagline: "Transformation Mode", perk: "Featured on Squad leaderboard + special champion badge",                  color: "#4A90E2" },
  { min: 900,  max: 1170, level: "Elite",     emoji: "👑", tagline: "WeGoFit Legend",      perk: "Permanent Legend crown + personal shoutout from Coach TinaBarks",         color: "#FFD700" },
];

const MOCK_LEADERBOARD = [
  { rank:1,  name:"Sarah K.",  initials:"SK", points:2840, streak:21, plan:"annual",  color:"#F43F8E" },
  { rank:2,  name:"John D.",   initials:"JD", points:1920, streak:14, plan:"monthly", color:"#6366F1" },
  { rank:3,  name:"Mary L.",   initials:"ML", points:1640, streak:8,  plan:"annual",  color:"#10B981" },
  { rank:4,  name:"Anna B.",   initials:"AB", points:1420, streak:5,  plan:"annual",  color:"#F59E0B" },
  { rank:5,  name:"Mike R.",   initials:"MR", points:1180, streak:2,  plan:"monthly", color:"#7C3AED" },
  { rank:6,  name:"Grace N.",  initials:"GN", points:1060, streak:12, plan:"monthly", color:"#FB923C" },
  { rank:7,  name:"David O.",  initials:"DO", points:940,  streak:6,  plan:"annual",  color:"#3B82F6" },
  { rank:8,  name:"Faith M.",  initials:"FM", points:820,  streak:4,  plan:"monthly", color:"#EC4899" },
  { rank:9,  name:"Peter K.",  initials:"PK", points:710,  streak:3,  plan:"free",    color:"#14B8A6" },
  { rank:10, name:"Joyce W.",  initials:"JW", points:580,  streak:1,  plan:"monthly", color:"#8B5CF6" },
];

const MOCK_FEED = [
  { id:"f0",   userId:"coach", userName:"Coach TinaBarks", userInitials:"CT", isCoach:true, isPinned:true, type:"announcement", content:"Welcome to the WeGoFit Squad! 🎉 This is YOUR space to celebrate wins, share progress and motivate each other. Every step counts! Let's crush our goals together! 💪", emoji:"🌸", likes:47, likedBy:[], comments:12, postedAt: new Date(Date.now()-7200000).toISOString() },
  { id:"f1",   userId:"mock_sarah",  userName:"Sarah K.",  userInitials:"SK", type:"workout",     content:"Just completed my first 5K run! Feeling absolutely amazing!", emoji:"🏃", stats:{ distance:"5.2km", duration:"32:14", calories:312 }, likes:8,  likedBy:[], comments:3,  postedAt: new Date(Date.now()-7200000).toISOString()   },
  { id:"f2",   userId:"mock_john",   userName:"John D.",   userInitials:"JD", type:"badge",       content:"Just unlocked the \"Week Warrior\" badge! 7 days straight — no days off!", emoji:"🏆", stats:{ points:150 }, likes:12, likedBy:[], comments:5, postedAt: new Date(Date.now()-18000000).toISOString()  },
  { id:"f3",   userId:"mock_mary",   userName:"Mary L.",   userInitials:"ML", type:"meal",        content:"Crushed my meal plan today! Ugali + sukuma wiki + tilapia for lunch — healthy AND delicious!", emoji:"🥗", stats:{ calories:1780, target:1800 }, likes:6, likedBy:[], comments:2, postedAt: new Date(Date.now()-86400000).toISOString() },
  { id:"f4",   userId:"mock_anna",   userName:"Anna B.",   userInitials:"AB", type:"streak",      content:"Day 5 of my logging streak! Consistency is key. Small steps every day 🔥", emoji:"🔥", stats:{ streak:5 }, likes:9, likedBy:[], comments:1, postedAt: new Date(Date.now()-172800000).toISOString() },
  { id:"f5",   userId:"mock_mike",   userName:"Mike R.",   userInitials:"MR", type:"weight",      content:"Down 1.5kg this week following the WeGoFit meal plan! This actually works!", emoji:"⚖️", stats:{ lost:"1.5kg" }, likes:15, likedBy:[], comments:6, postedAt: new Date(Date.now()-259200000).toISOString() },
  { id:"f6",   userId:"mock_grace",  userName:"Grace N.",  userInitials:"GN", type:"achievement", content:"Hit my water goal 3 days in a row! Never knew hydration could feel this good 💧", emoji:"💧", stats:{ days:3 }, likes:7, likedBy:[], comments:2, postedAt: new Date(Date.now()-345600000).toISOString() },
  { id:"f7",   userId:"mock_david",  userName:"David O.",  userInitials:"DO", type:"workout",     content:"Just burned 520 calories in one session! Coach TinaBarks workouts are no joke 💪", emoji:"🔥", stats:{ calories:520 }, likes:11, likedBy:[], comments:4, postedAt: new Date(Date.now()-432000000).toISOString() },
  { id:"f8",   userId:"mock_faith",  userName:"Faith M.",  userInitials:"FM", type:"meal",        content:"Made uji with milk and banana this morning — perfect high-protein breakfast!", emoji:"🌅", stats:{}, likes:5, likedBy:[], comments:1, postedAt: new Date(Date.now()-518400000).toISOString() },
];

const PRESET_CHALLENGES = [
  { id:"ch001", title:"7-Day Clean Eating Challenge",      emoji:"🥗", type:"nutrition",   description:"Log all 4 meals every day for 7 consecutive days. Show TinaBarks you can eat clean for a full week!", durationDays:7,  goal:{ metric:"meals_logged",       target:28, unit:"meals" }, reward:"🏅 Clean Eater Badge + 200 points",                   prize:"Free 1-month subscription",                  participants:24, isActive:true },
  { id:"ch002", title:"5K Running Challenge",               emoji:"🏃", type:"workout",     description:"Complete a 5K GPS run this week. Track it live in WeGoFit to count!", durationDays:7,  goal:{ metric:"distance_km",         target:5,  unit:"km"    }, reward:"🏅 5K Club Badge + 200 points",                        prize:"WeGoFit water bottle 💧",                     participants:18, isActive:true },
  { id:"ch003", title:"Hydration Hero Challenge",           emoji:"💧", type:"water",       description:"Hit your 2L daily water goal for 7 days in a row. Hydration = fat loss!", durationDays:7,  goal:{ metric:"water_days",          target:7,  unit:"days"  }, reward:"💧 Fish Vibes Badge + 150 points",                    prize:"Shoutout from Coach TinaBarks 📣",            participants:31, isActive:true },
  { id:"ch004", title:"30-Day Transformation Challenge",    emoji:"⚖️", type:"weight_loss", description:"Lose at least 2kg in 30 days using WeGoFit meal plans and workouts.", durationDays:30, goal:{ metric:"weight_lost_kg",      target:2,  unit:"kg"    }, reward:"🦋 Transformation Titan Badge + 500 pts",             prize:"3-month free subscription 🎁",               participants:42, isActive:true },
  { id:"ch005", title:"Sleep Champion Challenge",           emoji:"😴", type:"sleep",       description:"Log 7+ hours of sleep for 5 out of 7 days this week.", durationDays:7,  goal:{ metric:"good_sleep_days",     target:5,  unit:"days"  }, reward:"👑 Sleep Champion Badge + 200 pts",                   prize:"Recovery tips PDF from TinaBarks",            participants:19, isActive:true },
  { id:"ch006", title:"East African Healthy Eating",        emoji:"🌍", type:"nutrition",   description:"Log 3 traditional East African meals from the WeGoFit African database this week.", durationDays:7,  goal:{ metric:"african_foods_logged", target:3, unit:"meals" }, reward:"🌍 East Africa Eats Badge + 150 pts",                 prize:"Featured in WeGoFit community feed 📸",       participants:37, isActive:true },
];

const CHALLENGE_TYPE_COLORS = {
  nutrition:   "#10B981",
  workout:     "#F43F8E",
  steps:       "#3B82F6",
  sleep:       "#7C3AED",
  water:       "#60A5FA",
  weight_loss: "#F59E0B",
};

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

// ─── MEAL PLAN HELPERS ────────────────────────────────────────────────────────
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function isCurrentWeek(weekStart) {
  return weekStart === getMonday(new Date());
}

// last N days as YYYY-MM-DD strings, newest last
function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().split("T")[0];
  });
}

// ─── AUTH / SESSION ───────────────────────────────────────────────────────────
// Change password after first login
const COACH_CREDENTIALS = {
  id:       "coach_tinabarks",
  type:     "coach",
  name:     "TinaBarks",
  email:    "gofit.fitnessapp@gmail.com",
  password: btoa("WeGoFit@Coach2026!"),
  role:     "admin",
};


const PLAN_PRICE = { monthly: 20, annual: 16, free: 0 };

function planMRR(clients) {
  return clients.reduce((sum, c) => sum + (PLAN_PRICE[c.plan] || 0), 0);
}

const AuthCtx = createContext(null);

function AuthProvider({ children }) {
  const [session,     setSession]     = useState(null); // { userId, userType, name, email, loginTime }
  const [authLoading, setAuthLoading] = useState(true);
  const [clients,     setClients]     = useState([]);

  useEffect(() => {
    async function restoreSession() {
      try {
        // Load registered clients from storage
        const stored = await AsyncStorage.getItem("gofit_clients");
        if (stored) {
          const parsed = JSON.parse(stored);
          const all = [];
          parsed.forEach(c => { if (!all.find(x => x.id === c.id)) all.push(c); });
          setClients(all);
        }

        // Check Supabase cloud session first
        const { data: { session: cloudSession } } = await supabase.auth.getSession();

        if (cloudSession?.user) {
          const userId    = cloudSession.user.id;
          const userEmail = cloudSession.user.email;
          const isCoach   = userEmail === COACH_CREDENTIALS.email.toLowerCase();

          if (isCoach) {
            const s = { userId: COACH_CREDENTIALS.id, userType: "coach", name: COACH_CREDENTIALS.name, email: COACH_CREDENTIALS.email, loginTime: new Date().toISOString() };
            await AsyncStorage.setItem("gofit_session", JSON.stringify(s));
            setSession(s);
            setAuthLoading(false);
            return;
          }

          // Load profile from Supabase
          const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
          const name = profile?.name || userEmail.split("@")[0];
          // Seed the per-user onboarded key so GoFitProvider skips onboarding for returning users
          if (profile?.onboarded) {
            await AsyncStorage.setItem(`gf_onboarded_${userId}`, "true");
            await AsyncStorage.setItem("onboardingComplete", "true");
          }
          const s = { userId, userType: "client", name, email: userEmail, loginTime: new Date().toISOString() };
          await AsyncStorage.setItem("gofit_session", JSON.stringify(s));
          setSession(s);
          setAuthLoading(false);
          return;
        }

        // No cloud session — try local AsyncStorage fallback
        const cached = await AsyncStorage.getItem("gofit_session");
        if (cached) {
          const s = JSON.parse(cached);
          setSession(s);
          setAuthLoading(false);
          return;
        }
      } catch (_e) {
        // handled silently
      }
      setAuthLoading(false);
    }

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === "SIGNED_OUT") setSession(null);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email, password) {
    const trimEmail = email.trim().toLowerCase();

    // Coach shortcut — local credential check
    if (trimEmail === COACH_CREDENTIALS.email.toLowerCase() && btoa(password) === COACH_CREDENTIALS.password) {
      const s = { userId: COACH_CREDENTIALS.id, userType: "coach", name: COACH_CREDENTIALS.name, email: COACH_CREDENTIALS.email, loginTime: new Date().toISOString() };
      await AsyncStorage.setItem("gofit_session", JSON.stringify(s));
      setSession(s);
      return { ok: true, type: "coach" };
    }

    // Supabase auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimEmail, password });
      if (error) throw error;

      const userId    = data.user?.id;
      const userEmail = data.user?.email;

      // VIP auto-upgrade in Supabase
      if (isVIPAccount(userEmail)) {
        await supabase.from("profiles").update({ subscription: "annual", is_vip: true }).eq("id", userId);
      }

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      const name = profile?.name || userEmail.split("@")[0];

      // Seed the per-user onboarded key so GoFitProvider skips onboarding for returning users
      if (profile?.onboarded) {
        await AsyncStorage.setItem(`gf_onboarded_${userId}`, "true");
        await AsyncStorage.setItem("onboardingComplete", "true");
      }

      const s = { userId, userType: "client", name, email: userEmail, loginTime: new Date().toISOString() };
      await AsyncStorage.setItem("gofit_session", JSON.stringify(s));
      await AsyncStorage.setItem("userLoggedIn", "true");
      await AsyncStorage.setItem("userId", userId);
      if (profile) await AsyncStorage.setItem(`gofit_profile_${userId}`, JSON.stringify(profile));
      setSession(s);
      return { ok: true, type: "client", userId };

    } catch (supabaseError) {
      console.log("[login] CATCH supabaseError (raw):", supabaseError);
      return { ok: false, error: "Incorrect email or password. Please try again." };
    }
  }

  async function signUp(data) {
    // data: { name, email, password, securityQuestion, securityAnswer }
    const trimEmail = data.email.trim().toLowerCase();

    try {
      const { data: authData, error } = await supabase.auth.signUp({ email: trimEmail, password: data.password });
      // ── DIAGNOSTIC: log the raw authData returned by signUp ──────────────────
      console.log("[signUp] RAW authData.user:", authData?.user?.id ?? "null");
      console.log("[signUp] RAW authData.session:", authData?.session ? "PRESENT" : "NULL");
      console.log("[signUp] RAW session.access_token:", authData?.session?.access_token ? authData.session.access_token.slice(0, 40) + "…" : "NONE");
      try { console.log("[signUp] RAW authData (full):", JSON.stringify({ user: authData?.user?.id, email: authData?.user?.email, session_present: !!authData?.session, token_type: authData?.session?.token_type })); } catch (_) {}
      // ─────────────────────────────────────────────────────────────────────────
      if (error) {
        console.log("[signUp] STEP 1 FAILED — auth.signUp error:");
        console.log("  message:", error.message);
        console.log("  code:",    error.code    ?? "(none)");
        console.log("  status:",  error.status  ?? "(none)");
        console.log("  details:", JSON.stringify(error));
        throw error;
      }

      const userId    = authData.user?.id;
      const userEmail = trimEmail;
      if (!userId) throw new Error("Signup failed — no user id returned");

      // Use session returned directly from signUp (requires email confirmation disabled)
      const accessToken = authData.session?.access_token;
      console.log("[signUp] STEP 1 OK — userId:", userId);
      console.log("[signUp] STEP 1 OK — session token:", accessToken ? "EXISTS" : "NULL (email confirmation may still be ON)");

      const profilePayload = {
        id:           userId,
        email:        userEmail,
        name:         data.name || "",
        subscription: isVIPAccount(userEmail) ? "annual" : "free",
        is_vip:       isVIPAccount(userEmail),
        onboarded:    false,
        member_since: new Date().toISOString(),
        created_at:   new Date().toISOString(),
      };

      let profileSaved = false;

      // ── DIAGNOSTIC: log the payload being sent to the profiles table ─────────
      console.log("[signUp] profilePayload keys:", Object.keys(profilePayload).join(", "));
      try { console.log("[signUp] profilePayload (full):", JSON.stringify(profilePayload)); } catch (_) {}
      // ─────────────────────────────────────────────────────────────────────────

      // Method 1 — REST with session access token
      if (accessToken) {
        try {
          const res = await fetch(SUPABASE_URL + "/rest/v1/profiles", {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "apikey":        SUPABASE_ANON_KEY,
              "Authorization": "Bearer " + accessToken,
              "Prefer":        "resolution=merge-duplicates",
            },
            body: JSON.stringify(profilePayload),
          });
          const text = await res.text();
          console.log("[signUp] STEP 2 (session token) status:", res.status);
          console.log("[signUp] STEP 2 (session token) body:", text);
          if (res.ok || res.status === 201 || res.status === 200) {
            profileSaved = true;
            console.log("[signUp] STEP 2 OK — profile saved with session token");
          } else {
            console.log("[signUp] STEP 2 FAILED — server rejected insert with session token");
          }
        } catch (e) {
          console.log("[signUp] STEP 2 EXCEPTION (session token):", e.message);
        }
      } else {
        console.log("[signUp] STEP 2 SKIPPED — no session token available");
      }

      // Method 2 — REST with anon key fallback
      if (!profileSaved) {
        console.log("[signUp] STEP 2b — trying anon key insert...");
        try {
          const res = await fetch(SUPABASE_URL + "/rest/v1/profiles", {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "apikey":        SUPABASE_ANON_KEY,
              "Authorization": "Bearer " + SUPABASE_ANON_KEY,
              "Prefer":        "resolution=merge-duplicates",
            },
            body: JSON.stringify(profilePayload),
          });
          const text = await res.text();
          console.log("[signUp] STEP 2b (anon key) status:", res.status);
          console.log("[signUp] STEP 2b (anon key) body:", text);
          if (res.ok || res.status === 201 || res.status === 200) {
            profileSaved = true;
            console.log("[signUp] STEP 2b OK — profile saved with anon key");
          } else {
            console.log("[signUp] STEP 2b FAILED — server rejected anon key insert");
          }
        } catch (e) {
          console.log("[signUp] STEP 2b EXCEPTION (anon key):", e.message);
        }
      }

      console.log("[signUp] STEP 2 final — profileSaved:", profileSaved);

      // Save to AsyncStorage regardless of Supabase result
      await AsyncStorage.setItem("gofit_profile_" + userId, JSON.stringify({
        id:    userId,
        email: userEmail,
        ...data,
        subscription: isVIPAccount(userEmail) ? "annual" : "free",
      }));

      // Also add to local clients list for coach dashboard
      const newClient = {
        id: userId, type: "client", name: data.name, email: trimEmail,
        password: btoa(data.password),
        securityQuestion: data.securityQuestion || "What year were you born?",
        securityAnswer:   data.securityAnswer ? btoa(data.securityAnswer.toLowerCase().trim()) : "",
        plan: isVIPAccount(trimEmail) ? "annual" : "free",
        goal: "Improve Fitness", calories: 0, target: 2000, sleep: 0, streak: 0,
        weight: 0, goalWeight: 0, age: 0, gender: "other", height: 0,
        memberSince: new Date().toISOString().split("T")[0], lastActive: "just now", activity_level: "sedentary",
      };
      const updated = [...clients, newClient];
      setClients(updated);
      const registered = updated.filter(c => !c.id.startsWith("mock_"));
      await AsyncStorage.setItem("gofit_clients", JSON.stringify(registered));

      const s = { userId, userType: "client", name: data.name, email: trimEmail, loginTime: new Date().toISOString() };
      await AsyncStorage.setItem("gofit_session", JSON.stringify(s));
      setSession(s);
      return { ok: true, type: "client", clientId: userId };

    } catch (supabaseError) {
      console.log("[signUp] CAUGHT ERROR:", supabaseError?.message);
      console.log("[signUp] error.code:",   supabaseError?.code   ?? "(none)");
      console.log("[signUp] error.status:", supabaseError?.status ?? "(none)");
      try { console.log("[signUp] full error:", JSON.stringify(supabaseError)); } catch (_) {}
      return { ok: false, error: getAuthErrorMessage(supabaseError) };
    }
  }

  async function logout() {
    try { await supabase.auth.signOut(); } catch (_e) {}
    try {
      const keys = await AsyncStorage.getAllKeys();
      if (keys && keys.length) await AsyncStorage.multiRemove(keys);
    } catch (_e) {}
    setSession(null);
  }

  async function updateClientPassword(email, newPassword) {
    const trimEmail = email.trim().toLowerCase();
    const updated = clients.map(c =>
      c.email.toLowerCase() === trimEmail ? { ...c, password: btoa(newPassword) } : c
    );
    setClients(updated);
    const registered = updated.filter(c => !c.id.startsWith("mock_"));
    await AsyncStorage.setItem("gofit_clients", JSON.stringify(registered));
    // Also update any persisted gf_profile key for this user
    const keys = await AsyncStorage.getAllKeys();
    for (const k of keys.filter(k => k.startsWith("gf_profile"))) {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const prof = JSON.parse(raw);
      if (prof.email && prof.email.toLowerCase() === trimEmail) {
        await AsyncStorage.setItem(k, JSON.stringify({ ...prof, password: btoa(newPassword) }));
        break;
      }
    }
  }

  async function saveCoachNote(clientId, note) {
    await AsyncStorage.setItem(`gofit_coachnotes_${clientId}`, note);
  }
  const loadCoachNote = useCallback(async (clientId) => {
    const n = await AsyncStorage.getItem(`gofit_coachnotes_${clientId}`);
    return n || "";
  }, []);

  return (
    <AuthCtx.Provider value={{ session, authLoading, clients, login, signUp, logout, updateClientPassword, saveCoachNote, loadCoachNote }}>
      {children}
    </AuthCtx.Provider>
  );
}

// ─── THEME ────────────────────────────────────────────────────────────────────
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

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
const Ctx = createContext(null);
const PaywallCtx = createContext({ subStatus: "active", trialDays: 0, openPaywall: () => {}, unreadCoachMessages: 0, clearCoachUnread: () => {}, activeRoute: "Home" });

function GoFitProvider({ children, clientId, clientEmail }) {
  // All storage keys are namespaced by clientId for strict data isolation
  const pfx = clientId ? `_${clientId}` : "";
  const KEY_PROFILE  = `gf_profile${pfx}`;
  const KEY_LOG      = (date) => `gf_log${pfx}_${date}`;
  const KEY_WEIGHTS  = `gf_weights${pfx}`;
  const KEY_ONBOARD  = `gf_onboarded${pfx}`;
  const KEY_CHAT     = `gf_chat${pfx}`;
  const KEY_SLEEP    = `gf_sleep_history${pfx}`;

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
  const KEY_MEALPLAN   = `gofit_mealplan${pfx}`;
  const KEY_POINTS     = `gofit_points${pfx}`;
  const KEY_BADGES     = `gofit_badges${pfx}`;
  const KEY_FEED       = "gofit_community_feed";
  const KEY_CHALLENGES = "gofit_challenges_progress";
  const KEY_DARKMODE   = "gofit_dark_mode";

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } catch (_e) {
        // handled silently
      }
      setLoading(false);
      // Clear any previously seeded mock workout data flag
      try { await AsyncStorage.removeItem("gofit_mock_workouts_seeded" + (clientId ? `_${clientId}` : "")); } catch (_e) { /* silent */ }
    })();
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
    // Delete profile row (cascades related data)
    if (userId) {
      try {
        await supabase.from("profiles").delete().eq("id", userId);
      } catch (_e) {}
      // Delete auth user via RPC
      try {
        const { data: { session: sess } } = await supabase.auth.getSession();
        const token = sess?.access_token;
        if (token) {
          await fetch(SUPABASE_URL + "/rest/v1/rpc/delete_user", {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "apikey":        SUPABASE_ANON_KEY,
              "Authorization": "Bearer " + token,
            },
            body: JSON.stringify({}),
          });
        }
      } catch (_e) {}
    }
    // Sign out
    try { await supabase.auth.signOut(); } catch (_e) {}
    // Clear all WeGoFit keys from AsyncStorage
    try {
      const keys = await AsyncStorage.getAllKeys();
      const goFitKeys = keys.filter(k => k.startsWith("gofit_"));
      if (goFitKeys.length) await AsyncStorage.multiRemove(goFitKeys);
    } catch (_e) {}
    // Reset state
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
        console.log("Calling RPC with:", { p_id: user.id, p_name: p.name, p_age: p.age, p_gender: p.gender });
        // Method 1 — RPC (SECURITY DEFINER, bypasses RLS)
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
          console.log("❌ RPC error:", rpcErr.message, rpcErr.code, rpcErr.details);
          // Method 2 — REST API fallback
          try {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess?.session?.access_token;
            if (token) {
              const res = await fetch(SUPABASE_URL + "/rest/v1/profiles", {
                method: "POST",
                headers: {
                  "Content-Type":  "application/json",
                  "apikey":        SUPABASE_ANON_KEY,
                  "Authorization": "Bearer " + token,
                  "Prefer":        "resolution=merge-duplicates",
                },
                body: JSON.stringify({
                  id:          user.id,
                  email:       user.email,
                  name:        p.name                             || "",
                  age:         p.age                              || null,
                  gender:      p.gender                           || "",
                  height_cm:   p.height_cm    || p.height         || null,
                  weight_kg:   p.weight_kg    || p.weight         || null,
                  goal_weight: p.goal_weight  || p.goal_weight_kg || null,
                  activity:    p.activity_level || p.activity     || "light",
                  goal:        p.goal                             || "maintain",
                  calories:    p.dailyCalorieTarget || p.calories || 1800,
                  protein:     p.proteinTarget  || p.protein      || 135,
                  carbs:       p.carbTarget     || p.carbs        || 180,
                  fat:         p.fatTarget      || p.fat          || 60,
                  onboarded:   true,
                }),
              });
              const txt = await res.text();
              console.log("REST fallback:", res.status, txt);
            }
          } catch (e2) {
            console.log("REST fallback failed:", e2.message);
          }
        } else {
          console.log("✅ RPC success!", rpcData);
        }
      }
    } catch (err) {
      console.log("completeOnboarding sync error:", err.message);
    }
  }
  async function addFood(meal, food) {
    await persistLog({
      ...dayLog,
      meals: { ...dayLog.meals, [meal]: [...(dayLog.meals[meal] || []), { ...food, id: Date.now() }] },
    });
    await awardPoints("log_meal", POINTS.log_meal);
    await syncFoodLog({ ...food, date: todayKey(), meal }, profile?.id);
  }
  async function removeFood(meal, idx) {
    await persistLog({
      ...dayLog,
      meals: { ...dayLog.meals, [meal]: dayLog.meals[meal].filter((_, i) => i !== idx) },
    });
  }
  async function addExercise(ex, awardPointsFlag = true) {
    await persistLog({
      ...dayLog,
      exercise: [...(dayLog.exercise || []), { ...ex, id: Date.now() }],
    });
    if (awardPointsFlag) {
      await awardPoints("complete_workout", POINTS.complete_workout);
    }
    await syncExerciseLog(ex, profile?.id);
    // Auto-update challenge progress for run/cardio challenges
    if (profile?.id) {
      try {
        const { data: joined } = await supabase
          .from("challenge_participants")
          .select("challenge_id, progress, goal_target")
          .eq("user_id", profile.id);
        if (joined && joined.length > 0) {
          for (const participant of joined) {
            // Increment run-based challenges by distance, others by 1 session
            const increment = ex.distance_km ? Math.round(ex.distance_km * 10) / 10 : 1;
            const newProgress = Math.min((participant.progress || 0) + increment, participant.goal_target || 9999);
            await supabase.from("challenge_participants")
              .update({ progress: newProgress })
              .eq("challenge_id", participant.challenge_id)
              .eq("user_id", profile.id);
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

  // VIP check uses clientEmail (always available from session) as primary source,
  // falling back to profile?.email for robustness. profile?.email may be null for
  // new users who haven't completed onboarding yet.
  const emailForVIP = clientEmail || profile?.email;
  const isPremium =
    isVIPAccount(emailForVIP) ||
    (profile?.plan === "monthly") ||
    (profile?.plan === "annual");

  async function awardPoints(action, pts) {
    const next = userPoints + pts;
    await AsyncStorage.setItem(KEY_POINTS, JSON.stringify(next));
    setUserPoints(next);
    setPointsToast(`+${pts} WeGoFit Points! 🏆`);
    setTimeout(() => setPointsToast(null), 2500);
    try {
      await supabase.from("user_points").upsert({
        user_id:    profile?.id,
        total:      next,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    } catch (_e) {}
  }

  async function unlockBadge(badgeId) {
    if (unlockedBadges.includes(badgeId)) return false;
    const next = [...unlockedBadges, badgeId];
    await AsyncStorage.setItem(KEY_BADGES, JSON.stringify(next));
    setUnlockedBadges(next);
    const badge = BADGES.find(b => b.id === badgeId);
    if (badge) await awardPoints("badge_unlock", badge.points || 0);
    try {
      await supabase.from("badges_earned").insert({
        user_id:   profile?.id,
        badge_id:  badgeId,
        earned_at: new Date().toISOString(),
      });
    } catch (_e) {}
    return true;
  }

  async function saveMealPlan(plan) {
    await AsyncStorage.setItem(KEY_MEALPLAN, JSON.stringify(plan));
    setMealPlan(plan);
    try {
      await supabase.from("meal_plans").upsert({
        user_id:      profile?.id,
        week_start:   plan.weekStart,
        plan_data:    plan,
        generated_at: new Date().toISOString(),
      }, { onConflict: "user_id,week_start" });
    } catch (_e) {}
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
      isOnline,
      isPremium,
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

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────

function Card({ children, style }) {
  const { theme } = useTheme();
  return (
    <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

function PrimaryBtn({ label, onPress, disabled, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[S.primaryBtn, disabled && { opacity: 0.4 }, style]}
    >
      <Text style={S.primaryBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryBtn({ label, onPress, style }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[S.secondaryBtn, style]}>
      <Text style={S.secondaryBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function Row({ children, style }) {
  return <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>;
}



function Spacer({ h = 12 }) { return <View style={{ height: h }} />; }

// Donut calorie ring using SVG
function CalRing({ eaten, goal, size = 160 }) {
  const r      = (size - 16) / 2;
  const circ   = 2 * Math.PI * r;
  const pct    = Math.min(eaten / Math.max(goal, 1), 1);
  const dash   = pct * circ;
  const remaining = Math.max(goal - eaten, 0);
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={8} fill="none" />
        <Circle
          cx={size/2} cy={size/2} r={r}
          stroke={ROSE} strokeWidth={8} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      <Text style={{ fontSize: 18 }}>🔥</Text>
      <Text style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "800", lineHeight: 34 }}>{eaten}</Text>
      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>kcal eaten</Text>
      <Text style={{ color: ROSE, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
        {remaining > 0 ? `${remaining} remaining` : "Goal reached!"}
      </Text>
    </View>
  );
}

function MacroBar({ label, eaten, goal, color, icon }) {
  const pct = Math.min(eaten / Math.max(goal, 1), 1);
  const pctInt = Math.round(pct * 100);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#1E2837",
        alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <Text style={{ fontSize: 16 }}>{icon || "●"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Row style={{ justifyContent: "space-between", marginBottom: 5 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{label}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13 }}>{eaten}g</Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{pctInt}%</Text>
          </View>
        </Row>
        <View style={{ height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
          <View style={{ height: 4, borderRadius: 2, width: `${pctInt}%`, backgroundColor: color }} />
        </View>
      </View>
    </View>
  );
}

function WaterWidget() {
  const { dayLog, addWater, profile } = useContext(Ctx);
  const waterGoal = calcTargets(profile).waterGoal;
  const goal = Math.round(waterGoal / 0.25);
  const cups = Math.round((dayLog?.water_litres || 0) / 0.25);
  const pct = Math.min(cups / goal, 1);
  const done = cups >= goal;
  const litres = (dayLog?.water_litres || 0);
  return (
    <Card style={{ marginTop: 12 }}>
      <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={S.cardTitle}>💧 Water</Text>
        <TouchableOpacity>
          <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600" }}>Edit Goal ›</Text>
        </TouchableOpacity>
      </Row>
      <Row style={{ gap: 14, marginBottom: 14 }}>
        {/* Ring */}
        <View style={{ width: 80, height: 80, alignItems: "center", justifyContent: "center" }}>
          <Svg width={80} height={80} style={{ position: "absolute" }}>
            <Circle cx={40} cy={40} r={34} stroke="rgba(255,255,255,0.08)" strokeWidth={7} fill="none" />
            <Circle cx={40} cy={40} r={34} stroke={ROSE} strokeWidth={7} fill="none"
              strokeDasharray={`${pct * 2 * Math.PI * 34} ${2 * Math.PI * 34}`}
              strokeLinecap="round" transform="rotate(-90 40 40)" />
          </Svg>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", lineHeight: 24 }}>{cups}</Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, textAlign: "center" }}>of {goal} cups</Text>
        </View>
        {/* Cup icons */}
        <View style={{ flex: 1 }}>
          <Row style={{ flexWrap: "wrap", gap: 6 }}>
            {Array.from({ length: goal }).map((_, i) => (
              <TouchableOpacity key={i} onPress={() => addWater(0.25)} activeOpacity={0.7}>
                <Text style={{ fontSize: 20, opacity: i < cups ? 1 : 0.2 }}>💧</Text>
              </TouchableOpacity>
            ))}
          </Row>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 8 }}>
            {done ? "Goal reached! Keep sipping 💪" : "Keep sipping! You've got this."}
          </Text>
        </View>
      </Row>
      <Row style={{ gap: 6 }}>
        {[{ l: "-¼L", v: -0.25 }, { l: "+¼L", v: 0.25 }, { l: "+½L", v: 0.5 }, { l: "+1L", v: 1.0 }].map(b => (
          <TouchableOpacity key={b.l} onPress={() => addWater(b.v)} activeOpacity={0.7}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center",
              backgroundColor: b.v < 0 ? "#1E2837" : "rgba(255,107,53,0.12)",
              borderWidth: 1, borderColor: b.v < 0 ? "rgba(255,255,255,0.08)" : "rgba(255,107,53,0.3)" }}>
            <Text style={{ color: b.v < 0 ? "rgba(255,255,255,0.45)" : ROSE, fontSize: 11, fontWeight: "600" }}>{b.l}</Text>
          </TouchableOpacity>
        ))}
      </Row>
    </Card>
  );
}

// ─── ADD FOOD MODAL ───────────────────────────────────────────────────────────
const AFRICAN_QUICK_PICKS = ["Ugali","Matoke","Chapati","Nyama Choma","Rolex","Sukuma Wiki","Pilau rice","Githeri (maize+beans)","Mandazi (1 piece)","Chai (spiced milk tea)"];
const GLOBAL_QUICK_PICKS  = ["Rice porridge","2 chapatis with eggs","Bowl of matoke","Spaghetti bolognese","Caesar salad","Chicken biryani","Fruit smoothie","Peanut butter sandwich"];

const COUNTRY_FLAGS = { Uganda:"🇺🇬", Kenya:"🇰🇪", Tanzania:"🇹🇿", Rwanda:"🇷🇼", EA:"🌍" };

function AddFoodModal({ visible, meal, onClose, initialTab, navigation }) {
  const { addFood, isOnline } = useContext(Ctx);
  // tab: "african" | "global" | "ai"
  const [tab,       setTab]       = useState(initialTab || "african");
  const [afSearch,  setAfSearch]  = useState("");
  const [afCountry, setAfCountry] = useState("All");
  const [query,     setQuery]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [nutrition, setNutrition] = useState(null);
  const [error,     setError]     = useState(null);
  const [errorType, setErrorType] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setTab(initialTab || "african");
      setAfSearch(""); setAfCountry("All");
      setQuery(""); setNutrition(null); setError(null); setErrorType(null);
    }
  }, [visible, initialTab]);

  async function fetchNutrition(foodQuery) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || SUPABASE_ANON_KEY;
      const res = await fetch(SUPABASE_URL + "/functions/v1/ai-coach", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}`, "Apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ mode: "nutrition", foodQuery }),
      });
      clearTimeout(timeout);
      if (res.status === 401) throw new Error("INVALID_KEY");
      if (res.status === 429) throw new Error("QUOTA_EXCEEDED");
      if (!res.ok) throw new Error("API_ERROR");
      const parsed = await res.json();
      if (parsed.error) throw new Error("FOOD_NOT_FOUND");
      if (!parsed.calories) throw new Error("FOOD_NOT_FOUND");
      return {
        query:              foodQuery,
        foodName:           parsed.foodName || foodQuery,
        servingDescription: parsed.servingDescription || "",
        calories:           Math.round(parsed.calories || 0),
        protein:            Math.round(parsed.protein  || 0),
        carbs:              Math.round(parsed.carbs    || 0),
        fat:                Math.round(parsed.fat      || 0),
        fiber:              Math.round(parsed.fiber    || 0),
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === "AbortError") throw new Error("TIMEOUT");
      throw err;
    }
  }

  const ERROR_MESSAGES = {
    NO_KEY:         "API key needed. Go to Profile → Settings → AI Search Key to add yours.",
    INVALID_KEY:    "Invalid API key. Check your key in Profile → Settings → AI Search Key.",
    QUOTA_EXCEEDED: "Daily AI limit reached. Try again tomorrow or use the African / Global food lists.",
    TIMEOUT:        "Request timed out. Check your internet connection and try again.",
    FOOD_NOT_FOUND: "Couldn't identify that food. Try being more specific e.g. '1 cup rice porridge with milk' or 'ugali 150g'",
    API_ERROR:      "AI service unavailable. Try again in a moment or use African / Global food lists.",
    PARSE_ERROR:    "Something went wrong. Please try again.",
  };

  async function analyze(q) {
    if (!q.trim()) return;
    setLoading(true); setError(null); setNutrition(null); setErrorType(null);
    try {
      const result = await fetchNutrition(q);
      setNutrition(result);
    } catch (e) {
      const type = ERROR_MESSAGES[e.message] ? e.message : "API_ERROR";
      setErrorType(type);
      setError(ERROR_MESSAGES[type] || ERROR_MESSAGES.API_ERROR);
    }
    setLoading(false);
  }

  function handleAddNutrition() {
    if (!nutrition) return;
    addFood(meal, {
      name: nutrition.foodName, serving: nutrition.servingDescription || query,
      cal: Math.round(nutrition.calories), p: Math.round(nutrition.protein),
      c: Math.round(nutrition.carbs), f: Math.round(nutrition.fat),
    });
    setQuery(""); setNutrition(null); setError(null); onClose();
  }

  function handleAddGlobalFood(food) {
    addFood(meal, { name: food.name, serving: food.serving, cal: food.cal, p: food.p, c: food.c, f: food.f });
    onClose();
  }

  function handleAddAfricanFood(food) {
    addFood(meal, { name: food.name, serving: food.serving, cal: food.cal, p: food.p, c: food.c, f: food.f });
    onClose();
  }

  const mealLabel = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" }[meal] || meal;

  const AFRICAN_FOODS = FOODS.filter(f => f.region === "african");
  const GLOBAL_FOODS  = FOODS.filter(f => f.region === "global");
  const COUNTRIES = ["All", "Uganda", "Kenya", "Tanzania", "Rwanda"];

  const filteredAfrican = AFRICAN_FOODS.filter(f => {
    const matchCountry = afCountry === "All" || f.country === afCountry;
    const matchSearch  = !afSearch.trim() || f.name.toLowerCase().includes(afSearch.trim().toLowerCase());
    return matchCountry && matchSearch;
  });

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={S.overlay}>
            <View style={[S.sheet, { maxHeight: SH * 0.88 }]}>
              {/* Header */}
              <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={S.heading}>Add to {mealLabel}</Text>
                <TouchableOpacity onPress={() => { setQuery(""); setNutrition(null); setError(null); onClose(); }}>
                  <Text style={{ color: C.grey, fontSize: 22 }}>✕</Text>
                </TouchableOpacity>
              </Row>

              {/* 3 main tabs */}
              <Row style={{ marginBottom: 12, backgroundColor: C.cardLight, borderRadius: 10, padding: 3 }}>
                {[["african","🌍 African"],["global","🌐 Global"],["ai","🤖 AI Search"]].map(([id, lbl]) => (
                  <TouchableOpacity key={id} onPress={() => setTab(id)} style={{
                    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center",
                    backgroundColor: tab === id ? C.card : "transparent",
                  }}>
                    <Text style={{ color: tab === id ? C.green : C.grey, fontWeight: "700", fontSize: 11.5 }}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </Row>

              {/* ── AFRICAN FOODS TAB ── */}
              {tab === "african" && (
                <>
                  {/* Country filter pills */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}
                    contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
                    {COUNTRIES.map(c => (
                      <TouchableOpacity key={c} onPress={() => setAfCountry(c)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                          backgroundColor: afCountry === c ? ROSE : C.cardLight,
                          borderWidth: 1, borderColor: afCountry === c ? ROSE : C.border }}>
                        <Text style={{ color: afCountry === c ? "#FFF" : C.text, fontSize: 12, fontWeight: "600" }}>
                          {c === "All" ? "🌍 All EA" : `${COUNTRY_FLAGS[c] || ""} ${c}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Search bar */}
                  <TextInput style={[S.input, { marginBottom: 10 }]}
                    placeholder="Search African foods..."
                    placeholderTextColor={C.grey}
                    value={afSearch} onChangeText={setAfSearch} />

                  {/* Quick picks */}
                  <Text style={{ color: C.grey, fontSize: 11, fontWeight: "700", marginBottom: 6, letterSpacing: 0.5 }}>QUICK PICKS</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}
                    contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
                    {AFRICAN_QUICK_PICKS.map(name => {
                      const food = AFRICAN_FOODS.find(f => f.name === name);
                      if (!food) return null;
                      return (
                        <TouchableOpacity key={name} onPress={() => handleAddAfricanFood(food)}
                          style={{ backgroundColor: "#FFF5F0", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                            borderWidth: 1, borderColor: ROSE_DIM }}>
                          <Text style={{ color: ROSE, fontSize: 12, fontWeight: "600" }}>{food.emoji} {name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Food list */}
                  <FlatList
                    data={filteredAfrican}
                    keyExtractor={i => i.id}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={<Text style={{ color: C.grey, textAlign: "center", marginTop: 24 }}>No foods found</Text>}
                    renderItem={({ item }) => (
                      <TouchableOpacity onPress={() => handleAddAfricanFood(item)} activeOpacity={0.7}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 11,
                          borderBottomWidth: 1, borderBottomColor: C.cardLight }}>
                        <Text style={{ fontSize: 24, marginRight: 10 }}>{item.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }}>{item.name}</Text>
                          <Text style={{ color: C.grey, fontSize: 11 }}>
                            {COUNTRY_FLAGS[item.country] || "🌍"} {item.country === "EA" ? "East Africa" : item.country} · {item.serving}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ color: ROSE, fontWeight: "700", fontSize: 14 }}>{item.cal} cal</Text>
                          <Text style={{ color: C.grey, fontSize: 10 }}>P:{item.p}g C:{item.c}g F:{item.f}g</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    ListFooterComponent={
                      <TouchableOpacity onPress={() => setTab("ai")}
                        style={{ alignItems: "center", paddingVertical: 16 }}>
                        <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600" }}>
                          Can't find your food? Try AI Search →
                        </Text>
                      </TouchableOpacity>
                    }
                  />
                </>
              )}

              {/* ── GLOBAL FOODS TAB ── */}
              {tab === "global" && (
                <FlatList
                  data={GLOBAL_FOODS}
                  keyExtractor={i => i.id}
                  showsVerticalScrollIndicator={false}
                  ListHeaderComponent={
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ color: C.grey, fontSize: 11, fontWeight: "700", marginBottom: 8, letterSpacing: 0.5 }}>QUICK PICKS</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}
                        contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
                        {GLOBAL_QUICK_PICKS.map(pick => {
                          const food = GLOBAL_FOODS.find(f => f.name.toLowerCase().includes(pick.replace(/^\d+[gml]?\s+/,"").toLowerCase()));
                          return (
                            <TouchableOpacity key={pick} onPress={() => food && handleAddGlobalFood(food)}
                              style={{ backgroundColor: C.cardLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                                borderWidth: 1, borderColor: C.greyDim }}>
                              <Text style={{ color: C.text, fontSize: 12 }}>{pick}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => handleAddGlobalFood(item)} activeOpacity={0.7}
                      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12,
                        borderBottomWidth: 1, borderBottomColor: C.cardLight }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }}>{item.name}</Text>
                        <Text style={{ color: C.grey, fontSize: 12 }}>{item.serving}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: C.green, fontWeight: "700" }}>{item.cal} cal</Text>
                        <Text style={{ color: C.grey, fontSize: 11 }}>P:{item.p}g C:{item.c}g F:{item.f}g</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}

              {/* ── AI SEARCH TAB ── */}
              {tab === "ai" && (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {!isOnline ? (
                    <View style={{ backgroundColor: "#FEF3C7", borderRadius: 12, padding: 16, marginBottom: 16,
                      borderWidth: 1, borderColor: "#F59E0B40", alignItems: "center" }}>
                      <Text style={{ fontSize: 28, marginBottom: 8 }}>🌐</Text>
                      <Text style={{ color: "#92400E", fontWeight: "700", fontSize: 15, marginBottom: 6 }}>
                        AI search needs internet
                      </Text>
                      <Text style={{ color: "#92400E", fontSize: 13, textAlign: "center", lineHeight: 18 }}>
                        Your African food database is fully available offline.
                      </Text>
                      <TouchableOpacity onPress={() => setTab("african")}
                        style={{ marginTop: 12, backgroundColor: ROSE, borderRadius: 10,
                          paddingHorizontal: 20, paddingVertical: 10 }}>
                        <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>Browse African Foods →</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <TextInput style={S.input}
                        placeholder="Describe what you ate..."
                        placeholderTextColor={C.grey}
                        value={query} onChangeText={setQuery}
                        onSubmitEditing={() => analyze(query)}
                        returnKeyType="search" />
                      <PrimaryBtn label="Analyze Nutrition" onPress={() => analyze(query)} style={{ marginTop: 8 }} />

                      <Text style={{ color: C.grey, fontSize: 12, marginTop: 16, marginBottom: 8 }}>QUICK PICKS</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}
                        contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
                        {GLOBAL_QUICK_PICKS.map(pick => (
                          <TouchableOpacity key={pick} onPress={() => { setQuery(pick); analyze(pick); }}
                            style={{ backgroundColor: C.cardLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                              borderWidth: 1, borderColor: C.greyDim }}>
                            <Text style={{ color: C.text, fontSize: 12 }}>{pick}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {loading && (
                        <View style={[S.nutritionCard, { alignItems: "center", paddingVertical: 24 }]}>
                          <ActivityIndicator color={C.green} size="large" />
                          <Text style={{ color: C.grey, marginTop: 8 }}>Analyzing with AI...</Text>
                        </View>
                      )}
                      {!!error && !loading && (
                        <View style={[S.nutritionCard, { borderColor: C.red, gap: 10 }]}>
                          <Text style={{ color: C.red, textAlign: "center", fontSize: 13 }}>{error}</Text>
                          {(errorType === "NO_KEY" || errorType === "INVALID_KEY") && (
                            <TouchableOpacity onPress={() => { onClose(); }}
                              style={{ backgroundColor: ROSE, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Go to Profile → Settings</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                      {!!nutrition && !loading && (
                        <View style={S.nutritionCard}>
                          <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, marginBottom: 2 }}>{nutrition.foodName}</Text>
                          <Text style={{ color: C.grey, fontSize: 12, marginBottom: 12 }}>{nutrition.servingDescription}</Text>
                          <Text style={{ color: C.green, fontSize: 40, fontWeight: "800", textAlign: "center", marginBottom: 12 }}>
                            {Math.round(nutrition.calories)}
                            <Text style={{ fontSize: 15, color: C.grey }}>{" "}kcal</Text>
                          </Text>
                          <Row style={{ justifyContent: "space-around" }}>
                            {[
                              { l: "Protein", v: nutrition.protein, col: C.blue },
                              { l: "Carbs",   v: nutrition.carbs,   col: C.amber },
                              { l: "Fat",     v: nutrition.fat,     col: C.rose },
                              { l: "Fiber",   v: nutrition.fiber,   col: C.green },
                            ].map(m => (
                              <View key={m.l} style={{ alignItems: "center" }}>
                                <Text style={{ color: m.col, fontSize: 18, fontWeight: "700" }}>{Math.round(m.v)}g</Text>
                                <Text style={{ color: C.grey, fontSize: 11 }}>{m.l}</Text>
                              </View>
                            ))}
                          </Row>
                        </View>
                      )}
                      <PrimaryBtn
                        label={`✅ Add to ${mealLabel}`}
                        onPress={handleAddNutrition}
                        disabled={!nutrition || loading}
                        style={{ marginTop: 16, marginBottom: 8 }}
                      />
                    </>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function OnboardingScreen() {
  const { completeOnboarding } = useContext(Ctx);
  const { theme }              = useTheme();
  const { session } = useContext(AuthCtx);
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => {
    async function preloadImage() {
      await Asset.loadAsync(
        require('./assets/coach-welcome.png')
      );
      setImageLoaded(true);
    }
    preloadImage();
  }, []);
  const [showWelcome, setShowWelcome] = useState(true);
  const firstName = session?.name?.split(" ")[0] || "there";
  const [step,          setStep]          = useState(0);
  const [goal,          setGoal]          = useState("lose");
  const [form,          setForm]          = useState({
    name: "", age: "", gender: "male", height_cm: "", weight_kg: "",
    goal_weight_kg: "", activity_level: "light",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showOBPrivacy, setShowOBPrivacy] = useState(false);
  const [showOBTerms,   setShowOBTerms]   = useState(false);
  const GOALS = [
    { id: "lose",     emoji: "🔥", label: "Lose Weight",      desc: "Burn fat, feel lighter" },
    { id: "gain",     emoji: "💪", label: "Build Muscle",      desc: "Get stronger & bigger" },
    { id: "maintain", emoji: "⚖️", label: "Maintain Weight",   desc: "Stay at your best" },
    { id: "fitness",  emoji: "🏃", label: "Improve Fitness",   desc: "Endurance & health" },
  ];

  const ACTIVITIES = [
    { id: "sedentary", label: "Sedentary",    desc: "Desk job, little exercise" },
    { id: "light",     label: "Light",        desc: "1-3x / week" },
    { id: "active",    label: "Active",       desc: "4-5x / week" },
    { id: "very",      label: "Very Active",  desc: "Daily intense workouts" },
  ];

  function handleFinish() {
    if (!form.age || !form.height_cm || !form.weight_kg) {
      Alert.alert("Missing info", "Please fill in all fields."); return;
    }
    completeOnboarding({
      ...form,
      name: session?.name || form.name || "",
      goal,
      age: parseInt(form.age),
      height_cm: parseFloat(form.height_cm),
      weight_kg: parseFloat(form.weight_kg),
      goal_weight_kg: parseFloat(form.goal_weight_kg) || parseFloat(form.weight_kg),
      member_since: todayKey(),
    });
  }

  if (showWelcome && !imageLoaded) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: "#070B14",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <Image
          source={require('./assets/Enhanced_Logo.PNG')}
          style={{
            width: 180, height: 72,
            resizeMode: "contain",
            opacity: 0.6,
          }}
        />
      </View>
    );
  }

  if (showWelcome) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14" }}>
        <Image
          source={require('./assets/coach-welcome.png')}
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            width: "100%", height: "100%",
            resizeMode: "cover",
            opacity: 1,
          }}
          fadeDuration={0}
          onLoad={() => setImageLoaded(true)}
        />
        <LinearGradient
          colors={[
            "rgba(7,11,20,0.0)",
            "rgba(7,11,20,0.0)",
            "rgba(7,11,20,0.55)",
            "rgba(7,11,20,0.92)",
            "rgba(7,11,20,1.0)",
          ]}
          locations={[0, 0.2, 0.45, 0.72, 1.0]}
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
          }}
        />
        <View style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          paddingHorizontal: 28,
          paddingBottom: 52,
        }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 20,
            backgroundColor: "rgba(255,107,53,0.15)",
            borderRadius: 30,
            paddingHorizontal: 14,
            paddingVertical: 8,
            alignSelf: "flex-start",
            borderWidth: 1,
            borderColor: "rgba(255,107,53,0.35)",
          }}>
            <View style={{
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: "#FF6B35",
              alignItems: "center", justifyContent: "center",
              marginRight: 8,
            }}>
              <Text style={{ color: "#FFF", fontSize: 12,
                fontWeight: "800" }}>TB</Text>
            </View>
            <Text style={{ color: "#FF6B35", fontSize: 13,
              fontWeight: "700" }}>
              Coach TinaBarks · WeGoFit
            </Text>
          </View>

          <Text style={{
            color: "#FFFFFF",
            fontSize: 30,
            fontWeight: "800",
            lineHeight: 38,
            marginBottom: 16,
            letterSpacing: -0.5,
          }}>
            {`Hi ${firstName} 👋`}
          </Text>

          <Text style={{
            color: "rgba(255,255,255,0.80)",
            fontSize: 15,
            lineHeight: 26,
            marginBottom: 32,
          }}>
            {"I'm Coach TinaBarks, and I'll guide you through your fitness journey step by step.\n\nWhether your goal is weight loss, belly fat reduction, strength, or healthy habits — WeGoFit is built to help you stay consistent and see real progress.\n\nLet's build a stronger, healthier you together 💪"}
          </Text>

          <TouchableOpacity
            onPress={() => setShowWelcome(false)}
            style={{
              backgroundColor: "#FF6B35",
              borderRadius: 16,
              height: 58,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#FF6B35",
              shadowOpacity: 0.5,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
              marginBottom: 16,
            }}>
            <Text style={{
              color: "#FFFFFF",
              fontWeight: "800",
              fontSize: 17,
              letterSpacing: 0.3,
            }}>
              ✅ Let's Begin
            </Text>
          </TouchableOpacity>

          <Text style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: 12,
            textAlign: "center",
          }}>
            Takes less than 2 minutes · Personalised just for you
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <Image
        source={require('./assets/coach-welcome.png')}
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          width: "100%", height: "100%",
          resizeMode: "cover",
          opacity: 0.09,
        }}
        fadeDuration={0}
      />
      <LinearGradient
        colors={[
          "rgba(7,11,20,0.75)",
          "rgba(7,11,20,0.88)",
          "rgba(7,11,20,0.95)",
          "rgba(7,11,20,1.0)",
        ]}
        locations={[0, 0.3, 0.65, 1.0]}
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
        }}
      />
    <SafeAreaView style={{ flex: 1, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={{ alignItems: "center", marginTop: 0, marginBottom: 16 }}>
          <Image source={require('./assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
        </View>

        {/* Progress */}
        <Row style={{ gap: 6, marginBottom: 16 }}>
          {[0, 1].map(i => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? C.green : C.cardLight }} />
          ))}
        </Row>

        {step === 0 && (
          <>
            <Text style={[S.heading, { textAlign: "center", marginBottom: 6 }]}>What's your goal?</Text>
            <Text style={{ color: C.grey, textAlign: "center", marginBottom: 20, fontSize: 14 }}>We'll customize your plan</Text>
            {GOALS.map(g => (
              <TouchableOpacity key={g.id} onPress={() => setGoal(g.id)} activeOpacity={0.8}
                style={[S.card, { flexDirection: "row", alignItems: "center", marginBottom: 10,
                  borderWidth: 2, borderColor: goal === g.id ? C.green : "transparent" }]}>
                <Text style={{ fontSize: 30, marginRight: 14 }}>{g.emoji}</Text>
                <View>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>{g.label}</Text>
                  <Text style={{ color: C.grey, fontSize: 12, marginTop: 2 }}>{g.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <Spacer h={16} />
            <PrimaryBtn label="Next →" onPress={() => setStep(1)} />
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[S.heading, { textAlign: "center", marginBottom: 20 }]}>Tell us about you</Text>
            {[
              { key: "age",            placeholder: "Age",              keyboard: "numeric" },
              { key: "height_cm",      placeholder: "Height (cm)",      keyboard: "decimal-pad" },
              { key: "weight_kg",      placeholder: "Current weight (kg)", keyboard: "decimal-pad" },
              { key: "goal_weight_kg", placeholder: "Goal weight (kg)", keyboard: "decimal-pad" },
            ].map(field => (
              <TextInput key={field.key} style={[S.input, { marginBottom: 10 }]}
                placeholder={field.placeholder} placeholderTextColor={C.grey}
                value={form[field.key]} onChangeText={v => setForm(f => ({ ...f, [field.key]: v }))}
                keyboardType={field.keyboard} returnKeyType="next"
              />
            ))}

            <Text style={{ color: C.grey, fontSize: 12, marginBottom: 8, marginTop: 4 }}>Gender</Text>
            <Row style={{ gap: 8, marginBottom: 14 }}>
              {["male", "female", "other"].map(g => (
                <TouchableOpacity key={g} onPress={() => setForm(f => ({ ...f, gender: g }))}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
                    backgroundColor: form.gender === g ? C.green : C.cardLight }}>
                  <Text style={{ color: form.gender === g ? C.bg : C.grey, fontWeight: "600", fontSize: 13, textTransform: "capitalize" }}>{g}</Text>
                </TouchableOpacity>
              ))}
            </Row>

            <Text style={{ color: C.grey, fontSize: 12, marginBottom: 8 }}>Activity level</Text>
            {ACTIVITIES.map(a => (
              <TouchableOpacity key={a.id} onPress={() => setForm(f => ({ ...f, activity_level: a.id }))} activeOpacity={0.8}
                style={[S.card, { flexDirection: "row", alignItems: "center", marginBottom: 8, paddingVertical: 12,
                  borderWidth: 1.5, borderColor: form.activity_level === a.id ? C.green : "transparent" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }}>{a.label}</Text>
                  <Text style={{ color: C.grey, fontSize: 12 }}>{a.desc}</Text>
                </View>
                {form.activity_level === a.id && <Text style={{ color: C.green, fontSize: 18 }}>✓</Text>}
              </TouchableOpacity>
            ))}

            <Spacer h={16} />

            {/* Terms acceptance */}
            <TouchableOpacity onPress={() => setTermsAccepted(t => !t)}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16, paddingHorizontal: 2 }}
              activeOpacity={0.8}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, marginTop: 1,
                borderColor: termsAccepted ? ROSE : "#CCCCCC",
                backgroundColor: termsAccepted ? ROSE : "transparent",
                alignItems: "center", justifyContent: "center" }}>
                {termsAccepted && <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800", lineHeight: 16 }}>✓</Text>}
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: C.grey, lineHeight: 20 }}>
                {"I agree to WeGoFit's "}
                <Text style={{ color: ROSE, fontWeight: "600" }}
                  onPress={() => setShowOBTerms(true)}>Terms of Service</Text>
                {" and "}
                <Text style={{ color: ROSE, fontWeight: "600" }}
                  onPress={() => setShowOBPrivacy(true)}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[S.primaryBtn, { opacity: termsAccepted ? 1 : 0.4 }]}
              onPress={handleFinish} disabled={!termsAccepted}>
              <Text style={S.primaryBtnTxt}>Start WeGoFit 🚀</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(0)} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: C.grey, fontSize: 13 }}>← Back</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>

    {/* Legal modals inside onboarding */}
    <Modal visible={showOBPrivacy} animationType="slide" onRequestClose={() => setShowOBPrivacy(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#1A1A2E" }}>
        <PrivacyPolicyScreen onBack={() => setShowOBPrivacy(false)} theme={theme} />
      </SafeAreaView>
    </Modal>
    <Modal visible={showOBTerms} animationType="slide" onRequestClose={() => setShowOBTerms(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#1A1A2E" }}>
        <TermsOfServiceScreen onBack={() => setShowOBTerms(false)} theme={theme} />
      </SafeAreaView>
    </Modal>
    </View>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardScreen({ navigation }) {
  const { profile, dayLog, todaySleep, mealPlan, isPremium, userPoints, unlockedBadges, storageClientId } = useContext(Ctx);
  const { theme } = useTheme();
  const { unreadCoachMessages } = useContext(PaywallCtx);
  const [addMeal,          setAddMeal]          = useState(null);
  const [showWeeklyBanner, setShowWeeklyBanner] = useState(false);
  const [weeklyBurned,     setWeeklyBurned]     = useState(0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const targets = calcTargets(profile);
  const totals = dayLog?.totals || {};
  const showSleepBanner = !todaySleep && hour >= 6 && hour < 22;

  // Pulsing dot animation for unread coach messages
  const coachDotAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (unreadCoachMessages > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(coachDotAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(coachDotAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      coachDotAnim.setValue(1);
    }
  }, [unreadCoachMessages]);

  // Load this week's total calories burned from all exercise sessions
  useEffect(() => {
    const userId = storageClientId || profile?.id || profile?.email || "default";
    (async () => {
      const all = await getAllWorkoutSessions(userId);
      const monday = getMonday(new Date());
      const weekSessions = all.filter(s => (s.date || "") >= monday);
      setWeeklyBurned(weekSessions.reduce((sum, s) => sum + (s.caloriesBurned || 0), 0));
    })();
  }, [dayLog, storageClientId, profile?.id]);

  // Monday new-week banner: show if no valid plan for current week
  useEffect(() => {
    const isMonday = new Date().getDay() === 1;
    const hasCurrentPlan = mealPlan && mealPlan.weekStart && isCurrentWeek(mealPlan.weekStart);
    if (!hasCurrentPlan && isPremium) {
      setShowWeeklyBanner(true);
    }
  }, [mealPlan, isPremium]);

  // Today's planned meals (from meal plan)
  const todayDateStr = todayKey();
  const todayPlan = mealPlan?.days?.find(d => d.date === todayDateStr) ||
    (mealPlan?.days?.length > 0 ? mealPlan.days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] : null);

  const MEALS = [
    { meal: "breakfast", label: "Breakfast", emoji: "🌅" },
    { meal: "lunch",     label: "Lunch",     emoji: "☀️" },
    { meal: "dinner",    label: "Dinner",    emoji: "🌙" },
    { meal: "snacks",    label: "Snacks",    emoji: "🍎" },
  ];

  return (
    <SafeAreaView style={S.screen}>

      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <View>
            <Image source={LOGO_URI} style={{ width: 160, height: 65, resizeMode: "contain" }} />
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{greeting},</Text>
            <Text style={S.heading}>{profile?.name || "Athlete"} 👋</Text>
          </View>
          <Image
            source={require('./assets/CoachTinaBarks.PNG')}
            style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: ROSE }}
          />
        </Row>

        {/* Coach TinaBarks banner — dynamic weekly burn message */}
        <TouchableOpacity onPress={() => navigation.navigate("Coach")} activeOpacity={0.85}
          style={{ backgroundColor: ROSE, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16,
            flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <Text style={{ fontSize: 28, marginRight: 12 }}>💪</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 12 }}>Coach TinaBarks</Text>
              {/* Pulsing dot — unread message indicator */}
              {unreadCoachMessages > 0 && (
                <Animated.View style={{
                  width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFF",
                  transform: [{ scale: coachDotAnim }],
                  shadowColor: "#FFF", shadowRadius: 4, shadowOpacity: 0.8, elevation: 3,
                }} />
              )}
            </View>
            {unreadCoachMessages > 0 ? (
              <Text style={{ color: "rgba(255,255,255,0.95)", fontSize: 11, marginTop: 2, fontWeight: "600" }}>
                New message from Coach TinaBarks 💬
              </Text>
            ) : (
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, marginTop: 2 }}>
                {weeklyBurned === 0
                  ? `Your weekly burn goal is ${targets.weeklyBurnTarget.toLocaleString()} kcal. Let's get your first session in today!`
                  : weeklyBurned >= targets.weeklyBurnTarget
                    ? `Weekly burn goal crushed! 🏆 You've burned ${weeklyBurned.toLocaleString()} kcal this week. Incredible work!`
                    : `Great start! You've burned ${weeklyBurned.toLocaleString()} kcal this week. ${(targets.weeklyBurnTarget - weeklyBurned).toLocaleString()} kcal to go — keep pushing! 🔥`
                }
              </Text>
            )}
          </View>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 18, marginLeft: 4 }}>›</Text>
        </TouchableOpacity>

        {/* Calorie card — two-column layout */}
        <Card style={{ marginBottom: 12 }}>
          <Row style={{ alignItems: "stretch", gap: 16 }}>
            {/* Left: ring */}
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <CalRing eaten={totals.caloriesEaten || 0} goal={targets.calories} size={150} />
            </View>
            {/* Right: cta */}
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 20, lineHeight: 24 }}>Ready to</Text>
              <Text style={{ color: ROSE, fontWeight: "700", fontSize: 20, lineHeight: 26 }}>crush today?</Text>
              <View style={{ width: 28, height: 2, backgroundColor: ROSE, borderRadius: 1, marginVertical: 8 }} />
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 12 }}>
                {targets.calories.toLocaleString()} kcal daily goal
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Train")} activeOpacity={0.85}
                style={{ backgroundColor: ROSE, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
                  alignSelf: "flex-start" }}>
                <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 13 }}>⚡ Let's Go!</Text>
              </TouchableOpacity>
            </View>
          </Row>
          {/* Bottom row */}
          <View style={{ flexDirection: "row", marginTop: 14, paddingTop: 14,
            borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)" }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>🔥 {totals.caloriesBurned || 0}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>burned</Text>
            </View>
            <View style={{ width: 0.5, backgroundColor: "rgba(255,255,255,0.1)" }} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: totals.netCalories > targets.calories ? "#EF4444" : "#F59E0B", fontWeight: "700", fontSize: 16 }}>
                {totals.netCalories || 0}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>net calories</Text>
            </View>
          </View>
        </Card>

        {/* Weekly Burn Goal */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={[S.cardTitle, { marginBottom: 12 }]}>🔥 Your Weekly Burn Goal</Text>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 18, marginBottom: 2 }}>
            {targets.weeklyBurnTarget.toLocaleString()} kcal this week
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 12 }}>
            {targets.recommendedSessions} sessions · ~{targets.perSessionBurn.toLocaleString()} kcal per session
          </Text>
          <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 4, marginBottom: 8, overflow: "hidden" }}>
            <View style={{
              height: 8, borderRadius: 4, backgroundColor: "#F97316",
              width: `${Math.min(100, Math.round((weeklyBurned / Math.max(targets.weeklyBurnTarget, 1)) * 100))}%`
            }} />
          </View>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
            {weeklyBurned.toLocaleString()} of {targets.weeklyBurnTarget.toLocaleString()} kcal burned
          </Text>
        </Card>

        {/* Macros */}
        <Card style={{ marginBottom: 12 }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={S.cardTitle}>Macros</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Diary")}>
              <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600" }}>View details ›</Text>
            </TouchableOpacity>
          </Row>
          <MacroBar label="Protein" icon="💪" eaten={totals.protein_g || 0} goal={targets.protein} color={ROSE} />
          <MacroBar label="Carbs"   icon="🌾" eaten={totals.carbs_g   || 0} goal={targets.carbs}   color="#F59E0B" />
          <MacroBar label="Fat"     icon="🔥" eaten={totals.fat_g     || 0} goal={targets.fat}     color="#60A5FA" />
        </Card>

        {/* Water */}
        <WaterWidget />

        {/* Sleep Tracker widget */}
        <View style={[S.card, { marginTop: 12 }]}>
          <Row style={{ justifyContent: "space-between", marginBottom: todaySleep ? 10 : 0 }}>
            <Text style={S.cardTitle}>🌙 Sleep Tracker</Text>
            {todaySleep && (
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                {sleepQualityEmoji(todaySleep.quality)} {todaySleep.quality.charAt(0).toUpperCase() + todaySleep.quality.slice(1)}
              </Text>
            )}
          </Row>
          {todaySleep ? (
            <>
              <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: ROSE, fontWeight: "800", fontSize: 26 }}>
                  {fmtSleepDur(todaySleep.duration)}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>last night</Text>
              </Row>
              <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, marginBottom: 12 }}>
                <View style={{ height: 6, borderRadius: 3,
                  width: `${Math.min(todaySleep.duration / 9 * 100, 100)}%`,
                  backgroundColor: sleepBarColor(todaySleep.duration) }} />
              </View>
              <TouchableOpacity onPress={() => navigation.navigate("Sleep")} activeOpacity={0.8}
                style={{ backgroundColor: ROSE, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Update Sleep</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 6, marginBottom: 14 }}>
                How did you sleep last night?
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Sleep")} activeOpacity={0.8}
                style={{ backgroundColor: ROSE, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>+ Log Last Night's Sleep</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Quick Access shortcuts */}
        <View style={{ marginTop: 14 }}>
          <Text style={[S.cardTitle, { marginBottom: 10 }]}>Quick Access</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {[
              { emoji: "📖", label: "Diary",     onPress: () => navigation.navigate("Nutrition") },
              { emoji: "🗓️", label: "Meal Plan",  onPress: () => navigation.navigate("Nutrition") },
              { emoji: "🌙", label: "Sleep",      onPress: () => navigation.navigate("Sleep")     },
              { emoji: "🎬", label: "Videos",     onPress: () => navigation.navigate("Train")     },
              { emoji: "🏆", label: "Squad",      onPress: () => navigation.navigate("Train")     },
            ].map(s => (
              <TouchableOpacity key={s.label} onPress={s.onPress} activeOpacity={0.75}
                style={{ width: 80, alignItems: "center", backgroundColor: "#111827", borderRadius: 16,
                  padding: 14, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ fontSize: 26 }}>{s.emoji}</Text>
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: "600", marginTop: 6, textAlign: "center" }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Meal plan widget */}
        {isPremium && (
          <TouchableOpacity onPress={() => navigation.navigate("MealPlan")} activeOpacity={0.85}
            style={[S.card, { marginTop: 12 }]}>
            <Row style={{ justifyContent: "space-between", marginBottom: todayPlan ? 12 : 0 }}>
              <Row>
                <Text style={{ fontSize: 20, marginRight: 8 }}>🗓️</Text>
                <View>
                  <Text style={S.cardTitle}>Weekly Meal Plan</Text>
                  {todayPlan && (
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 1 }}>
                      {todayPlan.day}  ·  {todayPlan.totalCalories?.toLocaleString()} cal planned
                    </Text>
                  )}
                </View>
              </Row>
              <Text style={{ color: ROSE, fontSize: 18 }}>›</Text>
            </Row>
            {!todayPlan && (
              <TouchableOpacity onPress={() => navigation.navigate("MealPlan")}
                style={{ backgroundColor: ROSE, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 4 }}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Get your personalised plan →</Text>
              </TouchableOpacity>
            )}
            {todayPlan && (
              <>
                {["breakfast", "lunch", "dinner", "snack"].map(mk => {
                  const m = todayPlan.meals?.[mk];
                  if (!m) return null;
                  return (
                    <Row key={mk} style={{ paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                      <Text style={{ fontSize: 14, marginRight: 8, width: 22 }}>
                        {mk === "breakfast" ? "🌅" : mk === "lunch" ? "☀️" : mk === "dinner" ? "🌙" : "🍎"}
                      </Text>
                      <Text style={{ color: "#FFFFFF", fontSize: 13, flex: 1 }} numberOfLines={1}>{m.name}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{m.calories} cal</Text>
                    </Row>
                  );
                })}
                <Row style={{ justifyContent: "space-between", marginTop: 10 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Total: {todayPlan.totalCalories?.toLocaleString()} cal</Text>
                  <Text style={{ color: ROSE, fontSize: 12, fontWeight: "700" }}>View Full Plan →</Text>
                </Row>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Meals */}
        <Text style={[S.cardTitle, { marginTop: 16, marginBottom: 10 }]}>Today's Meals</Text>
        {MEALS.map(m => {
          const foods = dayLog?.meals?.[m.meal] || [];
          const total = foods.reduce((s, f) => s + (f.cal || 0), 0);
          return (
            <TouchableOpacity key={m.meal} onPress={() => navigation.navigate("Diary")} activeOpacity={0.8}
              style={[S.card, { flexDirection: "row", alignItems: "center", marginBottom: 8 }]}>
              <Text style={{ fontSize: 26, marginRight: 12 }}>{m.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.cardTitle}>{m.label}</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>
                  {foods.length > 0 ? `${foods.length} item${foods.length > 1 ? "s" : ""} · ${total} cal` : `Tap to log ${m.label.toLowerCase()}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAddMeal(m.meal)}
                style={{ backgroundColor: ROSE, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#FFF", fontSize: 20, fontWeight: "800", lineHeight: 22 }}>+</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {/* Exercise shortcut */}
        <TouchableOpacity onPress={() => navigation.navigate("Train")} activeOpacity={0.8}
          style={[S.card, { flexDirection: "row", alignItems: "center", marginTop: 4 }]}>
          <Text style={{ fontSize: 24, marginRight: 12 }}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.cardTitle}>Train</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{totals.caloriesBurned || 0} cal burned today</Text>
          </View>
          <Text style={{ color: ROSE, fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        {/* Coach banner */}
        <TouchableOpacity onPress={() => navigation.navigate("Coach")} activeOpacity={0.8}
          style={[S.card, { marginTop: 8, backgroundColor: unreadCoachMessages > 0 ? "rgba(255,107,53,0.18)" : "rgba(255,107,53,0.12)", borderWidth: 1, borderColor: unreadCoachMessages > 0 ? "rgba(255,107,53,0.5)" : "rgba(255,107,53,0.25)", flexDirection: "row", alignItems: "center" }]}>
          <Text style={{ fontSize: 24, marginRight: 12 }}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              {unreadCoachMessages > 0 ? "New message from Coach TinaBarks 💬" : "Message Coach TinaBarks"}
            </Text>
            <Text style={{ color: unreadCoachMessages > 0 ? "rgba(255,107,53,0.9)" : "rgba(255,255,255,0.45)", fontSize: 12 }}>
              {unreadCoachMessages > 0 ? `${unreadCoachMessages} unread message${unreadCoachMessages > 1 ? "s" : ""}` : "Available 24/7 · WeGoFit Premium"}
            </Text>
          </View>
          <Text style={{ color: ROSE, fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        {/* Community rank widget */}
        <TouchableOpacity onPress={() => navigation.navigate("Squad")} activeOpacity={0.85}
          style={[S.card, { marginTop: 8 }]}>
          <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={[S.cardTitle, { fontSize: 14 }]}>🏆 My Squad Rank</Text>
            <Text style={{ color: ROSE, fontSize: 12, fontWeight: "600" }}>View →</Text>
          </Row>
          <Row style={{ gap: 0 }}>
            <View style={{ flex: 1, alignItems: "center", backgroundColor: "rgba(255,107,53,0.12)", borderRadius: 12, padding: 10, marginRight: 8 }}>
              <Text style={{ color: ROSE, fontWeight: "800", fontSize: 20 }}>{userPoints}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 }}>WeGoFit Points</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center", backgroundColor: "#1E2837", borderRadius: 12, padding: 10, marginRight: 8 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 20 }}>{unlockedBadges.length}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 }}>Badges Earned</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center", backgroundColor: "#1E2837", borderRadius: 12, padding: 10 }}>
              <Text style={{ color: "#F59E0B", fontWeight: "800", fontSize: 20 }}>
                {MOCK_LEADERBOARD.findIndex(e => e.isUser) >= 0 ? `#${MOCK_LEADERBOARD.findIndex(e => e.isUser) + 1}` : "--"}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 }}>This Week</Text>
            </View>
          </Row>
        </TouchableOpacity>

        {/* Recommended Exercises */}
        {(() => {
          const recs = EXERCISES.slice(0, 4);
          return (
            <View style={{ marginTop: 16 }}>
              <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <View>
                  <Text style={S.cardTitle}>Exercise Library</Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Form & technique guides</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate("Train")}>
                  <Text style={{ color: ROSE, fontSize: 13, fontWeight: "700" }}>See all →</Text>
                </TouchableOpacity>
              </Row>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {recs.map(ex => {
                  const catColor = ex.category === "Belly Fat" ? "#FF6B35"
                    : ex.category === "Toning" ? "#9333EA"
                    : ex.category === "Recovery" ? "#22C55E"
                    : ROSE;
                  return (
                    <TouchableOpacity key={ex.id} onPress={() => navigation.navigate("Train")} activeOpacity={0.85}
                      style={{ width: 150, height: 120, backgroundColor: "#111827", borderRadius: 14,
                        padding: 14, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)",
                        alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 32, marginBottom: 6 }}>{ex.emoji || "💪"}</Text>
                      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", marginBottom: 6, textAlign: "center" }} numberOfLines={1}>{ex.title}</Text>
                      <View style={{ backgroundColor: catColor, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>{ex.category}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          );
        })()}

        {/* East African Foods shortcut */}
        {(() => {
          const featured = FOODS.filter(f => f.region === "african").slice(0, 3);
          return (
            <View style={{ marginTop: 16 }}>
              <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <View>
                  <Text style={S.cardTitle}>East African Foods</Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>50 local foods tracked</Text>
                </View>
                <TouchableOpacity onPress={() => setAddMeal("breakfast")}>
                  <Text style={{ color: ROSE, fontSize: 13, fontWeight: "700" }}>Browse all →</Text>
                </TouchableOpacity>
              </Row>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {featured.map(food => (
                  <TouchableOpacity key={food.name} onPress={() => setAddMeal("breakfast")} activeOpacity={0.8}
                    style={{ width: 130, backgroundColor: "#111827", borderRadius: 14, padding: 12,
                      borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" }}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>{food.emoji || "🍽️"}</Text>
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", marginBottom: 2 }} numberOfLines={2}>{food.name}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{food.cal} cal</Text>
                    <Text style={{ color: ROSE, fontSize: 11, marginTop: 4, fontWeight: "600" }}>
                      {COUNTRY_FLAGS[food.country] || "🌍"} {food.country || "EA"}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setAddMeal("breakfast")} activeOpacity={0.8}
                  style={{ width: 100, backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 14, padding: 12,
                    alignItems: "center", justifyContent: "center",
                    borderWidth: 1, borderColor: "rgba(255,107,53,0.25)" }}>
                  <Text style={{ color: ROSE, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>+</Text>
                  <Text style={{ color: ROSE, fontSize: 12, fontWeight: "700", textAlign: "center" }}>See all 50 foods</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          );
        })()}

        <Spacer h={20} />
      </ScrollView>

      <AddFoodModal visible={!!addMeal} meal={addMeal || "breakfast"} onClose={() => setAddMeal(null)} initialTab={addMeal ? "african" : undefined} />
    </SafeAreaView>
  );
}

// ─── DIARY ────────────────────────────────────────────────────────────────────
function DiaryScreen({ navigation, nutritionSubBar }) {
  const { dayLog, removeFood, profile } = useContext(Ctx);
  const { theme } = useTheme();
  const [addMeal, setAddMeal] = useState(null);

  const MEALS = [
    { key: "breakfast", label: "Breakfast", emoji: "🌅" },
    { key: "lunch",     label: "Lunch",     emoji: "☀️" },
    { key: "dinner",    label: "Dinner",    emoji: "🌙" },
    { key: "snacks",    label: "Snacks",    emoji: "🍎" },
  ];
  const totals  = dayLog?.totals || {};
  const targets = calcTargets(profile);

  return (
    <SafeAreaView style={S.screen}>
      {nutritionSubBar || null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {!nutritionSubBar && navigation?.canGoBack?.() && (
          <TouchableOpacity onPress={() => navigation.goBack()}
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, alignSelf: "flex-start" }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.cardLight,
              alignItems: "center", justifyContent: "center", marginRight: 8 }}>
              <Text style={{ color: ROSE, fontSize: 18 }}>‹</Text>
            </View>
            <Text style={{ color: ROSE, fontWeight: "600", fontSize: 15 }}>Back</Text>
          </TouchableOpacity>
        )}
        <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <Text style={[S.heading, { color: theme.text }]}>Food Diary 📖</Text>
          <Image source={LOGO_URI} style={{ width: 80, height: 40, resizeMode: "contain" }} />
        </Row>
        <Text style={{ color: theme.textSub, fontSize: 13, marginBottom: 16 }}>{todayKey()}</Text>

        {MEALS.map(m => {
          const foods = dayLog?.meals?.[m.key] || [];
          const mealCal = foods.reduce((s, f) => s + (f.cal || 0), 0);
          return (
            <Card key={m.key} style={{ marginBottom: 12 }}>
              <Row style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <Row>
                  <Text style={{ fontSize: 20, marginRight: 8 }}>{m.emoji}</Text>
                  <Text style={S.cardTitle}>{m.label}</Text>
                </Row>
                <Row>
                  <Text style={{ color: C.green, fontWeight: "700", marginRight: 10 }}>{mealCal} cal</Text>
                  <TouchableOpacity onPress={() => setAddMeal(m.key)}
                    style={{ backgroundColor: C.green, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: C.bg, fontSize: 18, fontWeight: "800", lineHeight: 20 }}>+</Text>
                  </TouchableOpacity>
                </Row>
              </Row>
              {foods.length === 0 && (
                <Text style={{ color: C.greyDim, fontSize: 13, textAlign: "center", paddingVertical: 10 }}>No foods logged yet</Text>
              )}
              {foods.map((food, idx) => (
                <Row key={idx} style={{ justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.cardLight }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: "600" }}>{food.name}</Text>
                    <Text style={{ color: C.grey, fontSize: 11 }}>{food.serving}</Text>
                  </View>
                  <Row>
                    <Text style={{ color: C.amber, fontWeight: "700", marginRight: 12 }}>{food.cal} cal</Text>
                    <TouchableOpacity onPress={() => removeFood(m.key, idx)}>
                      <Text style={{ color: C.red, fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  </Row>
                </Row>
              ))}
            </Card>
          );
        })}
      </ScrollView>

      {/* Sticky footer */}
      {(() => {
        const diaryStatus = getCalorieStatus(totals.caloriesEaten || 0, targets.calories);
        return (
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0,
            backgroundColor: diaryStatus.bgColor,
            borderTopWidth: 1, borderTopColor: diaryStatus.color + "30", padding: 12 }}>
            <Row style={{ justifyContent: "space-between" }}>
              {["Eaten", "Burned", "Net", "Target"].map(l => (
                <Text key={l} style={{ color: "#888", fontSize: 12, flex: 1, textAlign: "center" }}>{l}</Text>
              ))}
            </Row>
            <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
              <Text style={{ color: diaryStatus.color, fontWeight: "700", fontSize: 16, flex: 1, textAlign: "center" }}>
                {totals.caloriesEaten || 0}
              </Text>
              <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 16, flex: 1, textAlign: "center" }}>
                -{totals.caloriesBurned || 0}
              </Text>
              <Text style={{ color: diaryStatus.color, fontWeight: "700", fontSize: 16, flex: 1, textAlign: "center" }}>
                {totals.netCalories || 0}
              </Text>
              <Text style={{ color: "#888", fontWeight: "600", fontSize: 16, flex: 1, textAlign: "center" }}>
                {targets.calories}
              </Text>
            </Row>
            <Text style={{ color: diaryStatus.color, fontSize: 12, textAlign: "center", marginTop: 6, fontStyle: "italic" }}>
              {diaryStatus.message}
            </Text>
          </View>
        );
      })()}

      <AddFoodModal visible={!!addMeal} meal={addMeal || "breakfast"} onClose={() => setAddMeal(null)} />
    </SafeAreaView>
  );
}

// ─── GPS ROUTE MAP (SVG) ──────────────────────────────────────────────────────
function RouteMap({ positions, height = 200 }) {
  if (positions.length === 0) {
    return (
      <View style={{ height, backgroundColor: C.cardLight, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.greyDim, fontSize: 13 }}>Waiting for GPS...</Text>
      </View>
    );
  }

  const W = SW - 32 - 32; // padding
  const PAD = 20;
  const lats = positions.map(p => p.lat);
  const lngs = positions.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.0001;
  const lngSpan = maxLng - minLng || 0.0001;
  const scaleX = (W - PAD * 2) / lngSpan;
  const scaleY = (height - PAD * 2) / latSpan;
  const scale = Math.min(scaleX, scaleY);

  const toX = lng => PAD + (W - PAD * 2 - lngSpan * scale) / 2 + (lng - minLng) * scale;
  const toY = lat => PAD + (height - PAD * 2 - latSpan * scale) / 2 + (maxLat - lat) * scale;

  const points = positions.map(p => `${toX(p.lng)},${toY(p.lat)}`).join(" ");
  const last = positions[positions.length - 1];
  const first = positions[0];

  return (
    <View style={{ borderRadius: 12, overflow: "hidden", backgroundColor: C.cardLight }}>
      <Svg width={W} height={height}>
        <Rect width={W} height={height} fill={C.cardLight} />
        {positions.length >= 2 && (
          <Polyline points={points} fill="none" stroke={C.green} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {/* Start dot */}
        <Circle cx={toX(first.lng)} cy={toY(first.lat)} r={6} fill={C.white} />
        <SvgText x={toX(first.lng)} y={toY(first.lat) + 4} textAnchor="middle" fill={C.bg} fontSize={7} fontWeight="bold">S</SvgText>
        {/* Current dot */}
        <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={8} fill={C.green} opacity={0.25} />
        <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={5} fill={C.green} />
        <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={2} fill={C.white} />
      </Svg>
    </View>
  );
}

// ─── EXERCISE LIBRARY DATA ────────────────────────────────────────────────────
const EX_LIBRARY = [
  // 🔥 Belly Fat & Weight Loss
  { id:"el1",  name:"Burpees",           category:"belly_fat",  emoji:"💥", met:8.0,  calPerMin:9,
    difficulty:"Advanced",    duration:"15 min", calories:"150-200 kcal", categoryColor:"#FF6B35",
    instructions:["1. Stand with feet shoulder width apart","2. Drop hands to floor and jump feet back","3. Do a push up at the bottom","4. Jump feet forward to hands","5. Explosively jump up with arms overhead","6. Land softly and repeat immediately"],
    coachTip:"Hate them now, thank them later! Burpees are your #1 belly fat weapon." },
  { id:"el2",  name:"Mountain Climbers", category:"belly_fat",  emoji:"🧗", met:8.0,  calPerMin:9,
    difficulty:"Intermediate", duration:"20 min", calories:"120-180 kcal", categoryColor:"#FF6B35",
    instructions:["1. Start in a high plank position","2. Drive right knee toward chest fast","3. Switch legs in a running motion","4. Keep hips level throughout","5. Breathe steadily and maintain pace","6. Speed = more calories burned"],
    coachTip:"Drive your knees FAST — speed is your fat burner here!" },
  { id:"el3",  name:"HIIT Intervals",    category:"belly_fat",  emoji:"⚡", met:12.0, calPerMin:12,
    difficulty:"Advanced",    duration:"25 min", calories:"250-350 kcal", categoryColor:"#FF6B35",
    instructions:["1. Work hard for 40 seconds","2. Rest for 20 seconds","3. Repeat for 8-10 rounds","4. Choose any high intensity move","5. Push to 80-90% max effort","6. Cool down for 5 min after"],
    coachTip:"Push hard for 40 secs, rest 20. That ratio is scientifically proven magic!" },
  { id:"el4",  name:"Jump Rope",         category:"belly_fat",  emoji:"🪢", met:10.0, calPerMin:11,
    difficulty:"Intermediate", duration:"15 min", calories:"150-220 kcal", categoryColor:"#FF6B35",
    instructions:["1. Hold rope handles at hip height","2. Swing rope over head smoothly","3. Jump with both feet together","4. Land softly on balls of feet","5. Keep elbows close to body","6. Build speed gradually"],
    coachTip:"10 min of jump rope burns same as 30 min jogging. Trust the process!" },
  { id:"el5",  name:"High Knees",        category:"belly_fat",  emoji:"🏃", met:8.5,  calPerMin:9,
    difficulty:"Beginner",    duration:"15 min", calories:"100-150 kcal", categoryColor:"#FF6B35",
    instructions:["1. Stand with feet hip width apart","2. Drive right knee up to hip height","3. Switch legs in running motion","4. Pump arms opposite to legs","5. Stay on balls of feet","6. Maintain upright posture throughout"],
    coachTip:"Arms pump = more calories burned. Don't leave your arms behind!" },
  { id:"el6",  name:"Bicycle Crunches",  category:"belly_fat",  emoji:"🚴", met:5.0,  calPerMin:5,
    difficulty:"Beginner",    duration:"10 min", calories:"80-120 kcal",  categoryColor:"#FF6B35",
    instructions:["1. Lie on back hands behind head","2. Lift shoulders off the ground","3. Drive right knee to left elbow","4. Extend left leg straight out","5. Switch sides in pedaling motion","6. Keep lower back pressed to floor"],
    coachTip:"Slow and controlled beats fast and sloppy — this is the #1 proven ab move!" },
  { id:"el7",  name:"Running in Place",  category:"belly_fat",  emoji:"👟", met:9.8,  calPerMin:10,
    difficulty:"Beginner",    duration:"20 min", calories:"180-250 kcal", categoryColor:"#FF6B35",
    instructions:["1. Stand with feet hip width apart","2. Begin jogging on the spot","3. Drive knees up to hip height","4. Pump arms naturally at sides","5. Stay light on your feet","6. Increase pace every 2 minutes"],
    coachTip:"No treadmill? No problem! Running in place melts fat just as well!" },
  { id:"el8",  name:"Fast Walking",      category:"belly_fat",  emoji:"🚶", met:4.5,  calPerMin:5,
    difficulty:"Beginner",    duration:"30 min", calories:"150-200 kcal", categoryColor:"#FF6B35",
    instructions:["1. Stand tall with core engaged","2. Walk at brisk purposeful pace","3. Pump arms at 90 degree angle","4. Strike heel first then roll to toe","5. Breathe rhythmically throughout","6. Maintain pace that makes talking hard"],
    coachTip:"Walk like you are late for something important! Fast walking burns belly fat without joint stress — perfect for beginners!" },
  // 💪 Tone & Sculpt
  { id:"el9",  name:"Squats",            category:"tone",       emoji:"🦵", met:5.0,  calPerMin:6,
    difficulty:"Beginner",    duration:"15 min", calories:"80-120 kcal",  categoryColor:"#9333EA",
    instructions:["1. Stand feet shoulder width apart","2. Toes pointed slightly outward","3. Lower body until thighs parallel to floor","4. Keep chest up and back straight","5. Push through heels to stand up","6. Squeeze glutes at the top"],
    coachTip:"Go deeper for better results! Chest up, knees behind toes always." },
  { id:"el10", name:"Glute Bridges",     category:"tone",       emoji:"🍑", met:3.5,  calPerMin:4,
    difficulty:"Beginner",    duration:"12 min", calories:"60-90 kcal",   categoryColor:"#9333EA",
    instructions:["1. Lie on back knees bent feet flat","2. Place feet hip width apart","3. Press feet into floor and lift hips","4. Squeeze glutes hard at the top","5. Hold for 2 full seconds","6. Lower slowly and repeat"],
    coachTip:"Squeeze at the top for 2 seconds — that's where the toning magic happens!" },
  { id:"el11", name:"Push Ups",          category:"tone",       emoji:"💪", met:4.5,  calPerMin:5,
    difficulty:"Beginner",    duration:"10 min", calories:"70-100 kcal",  categoryColor:"#9333EA",
    instructions:["1. Start in high plank position","2. Hands slightly wider than shoulders","3. Lower chest toward floor slowly","4. Keep elbows at 45 degree angle","5. Push back up to start position","6. Keep core tight throughout"],
    coachTip:"5 perfect push ups beat 20 bad ones every single time!" },
  { id:"el12", name:"Lunges",            category:"tone",       emoji:"🚶", met:4.0,  calPerMin:4,
    difficulty:"Beginner",    duration:"15 min", calories:"70-100 kcal",  categoryColor:"#9333EA",
    instructions:["1. Stand tall feet together","2. Step forward with right foot","3. Lower back knee toward floor","4. Both knees at 90 degree angles","5. Push through front heel to return","6. Alternate legs and repeat"],
    coachTip:"Keep your upper body straight and core tight — this tones legs AND belly!" },
  { id:"el13", name:"Plank Hold",        category:"tone",       emoji:"🪵", met:4.0,  calPerMin:4,
    difficulty:"Beginner",    duration:"10 min", calories:"50-80 kcal",   categoryColor:"#9333EA",
    instructions:["1. Start on forearms and toes","2. Body in straight line head to heel","3. Engage core and squeeze glutes","4. Keep hips level not sagging","5. Breathe steadily throughout","6. Hold for 30-60 seconds per set"],
    coachTip:"Hold that core tight — this is where belly fat fights back and you WIN!" },
  { id:"el14", name:"Tricep Dips",       category:"tone",       emoji:"💺", met:3.5,  calPerMin:4,
    difficulty:"Beginner",    duration:"10 min", calories:"60-90 kcal",   categoryColor:"#9333EA",
    instructions:["1. Sit on edge of chair or bed","2. Hands gripping edge beside hips","3. Slide forward off the edge","4. Lower body by bending elbows","5. Push back up to straight arms","6. Keep back close to chair"],
    coachTip:"Say goodbye to arm flap! 3 sets of these daily transforms your arms in 3 weeks!" },
  { id:"el15", name:"Donkey Kicks",      category:"tone",       emoji:"🦶", met:3.5,  calPerMin:4,
    difficulty:"Beginner",    duration:"12 min", calories:"60-90 kcal",   categoryColor:"#9333EA",
    instructions:["1. Start on all fours on the floor","2. Keep core engaged and back flat","3. Lift right leg keeping knee bent 90°","4. Push foot toward ceiling","5. Squeeze glute hard at the top","6. Lower and repeat then switch legs"],
    coachTip:"Lift and SQUEEZE — this sculpts and lifts your glutes better than any machine!" },
  // 😴 Energy & Recovery
  { id:"el16", name:"Morning Yoga Flow", category:"recovery",   emoji:"🧘", met:3.0,  calPerMin:3,
    difficulty:"Beginner",    duration:"20 min", calories:"60-80 kcal",   categoryColor:"#22C55E",
    instructions:["1. Begin in child's pose breathing deep","2. Flow to downward facing dog","3. Step forward to low lunge","4. Rise to warrior one pose","5. Flow through sun salutation","6. End in savasana for 2 minutes"],
    coachTip:"Start here on low energy days. Movement always beats stillness — even gentle movement!" },
  { id:"el17", name:"Full Body Stretching", category:"recovery", emoji:"🤸", met:2.5, calPerMin:3,
    difficulty:"Beginner",    duration:"15 min", calories:"40-60 kcal",   categoryColor:"#22C55E",
    instructions:["1. Start with neck rolls each direction","2. Shoulder cross body stretch 30 secs","3. Chest opener arms wide behind back","4. Standing quad stretch each leg","5. Seated hamstring stretch both legs","6. Full body side stretch arms overhead"],
    coachTip:"Stretching daily reduces injury risk by 40% AND speeds up fat loss. Never skip this!" },
  { id:"el18", name:"Power Walking",     category:"recovery",   emoji:"🚶", met:3.8,  calPerMin:4,
    difficulty:"Beginner",    duration:"30 min", calories:"120-160 kcal", categoryColor:"#22C55E",
    instructions:["1. Stand tall core gently engaged","2. Set a brisk purposeful pace","3. Swing arms naturally at sides","4. Strike heel first roll to toe","5. Breathe in 3 steps out 3 steps","6. Maintain pace you can talk but barely"],
    coachTip:"Walk like you mean it! 30 min daily power walking transforms energy levels within 2 weeks!" },
  { id:"el19", name:"Foam Rolling",      category:"recovery",   emoji:"🫀", met:2.0,  calPerMin:2,
    difficulty:"Beginner",    duration:"10 min", calories:"30-50 kcal",   categoryColor:"#22C55E",
    instructions:["1. Place foam roller under target muscle","2. Use arms or legs to control pressure","3. Roll slowly 2-3 inches per second","4. Pause on tight or tender spots","5. Hold painful spots for 20-30 seconds","6. Roll calves quads back and shoulders"],
    coachTip:"Roll slow on tight spots. This is your secret recovery weapon — use it every single day!" },
  { id:"el20", name:"Deep Breathing",    category:"recovery",   emoji:"🌬️", met:1.5,  calPerMin:2,
    difficulty:"Beginner",    duration:"10 min", calories:"20-30 kcal",   categoryColor:"#22C55E",
    instructions:["1. Sit or lie in comfortable position","2. Place hand on belly and chest","3. Inhale deeply for 4 counts","4. Hold breath for 4 counts","5. Exhale slowly for 4 counts","6. Repeat 10 times per set"],
    coachTip:"4 counts in, 4 hold, 4 out. This activates your body's natural stress relief system instantly!" },
  { id:"el21", name:"Light Pilates",     category:"recovery",   emoji:"🧸", met:3.5,  calPerMin:4,
    difficulty:"Beginner",    duration:"20 min", calories:"70-100 kcal",  categoryColor:"#22C55E",
    instructions:["1. Lie on back in neutral spine position","2. Begin with pelvic tilts 10 reps","3. Progress to single leg stretches","4. Add double leg stretch slowly","5. Include spine twist seated","6. Finish with cat cow stretches"],
    coachTip:"Perfect for rest days. Active recovery beats doing nothing — your body rebuilds during rest!" },
  { id:"el22", name:"Sleep Prep Routine", category:"recovery",  emoji:"🌙", met:1.5,  calPerMin:2,
    difficulty:"Beginner",    duration:"10 min", calories:"20-30 kcal",   categoryColor:"#22C55E",
    instructions:["1. Dim lights and find quiet space","2. Begin with 5 deep belly breaths","3. Gentle neck and shoulder rolls","4. Seated forward fold 60 seconds","5. Legs up the wall pose 2 minutes","6. Lie still and breathe for 2 minutes"],
    coachTip:"Do this 30 min before bed. Better sleep = faster fat loss = faster transformation. Science!" },
];

const CAT_PILL = {
  belly_fat: { bg: "rgba(255,107,53,0.15)",  text: "#FF6B35" },
  tone:      { bg: "rgba(147,51,234,0.15)",  text: "#9333EA" },
  recovery:  { bg: "rgba(34,197,94,0.15)",   text: "#22C55E" },
  cardio:    { bg: "rgba(255,107,53,0.15)",  text: "#FF6B35" },
  strength:  { bg: "rgba(147,51,234,0.15)",  text: "#9333EA" },
  other:     { bg: "rgba(34,197,94,0.15)",   text: "#22C55E" },
};

const CATEGORY_META = {
  belly_fat: {
    label: "🔥 Belly Fat & Weight Loss",
    shortLabel: "🔥 Belly Fat",
    color: "#FF6B35",
    bannerBg: "rgba(255,107,53,0.15)",
    title: "Burn it. Shed it. Own it.",
    body: "High-intensity home workouts scientifically proven to melt belly fat, accelerate weight loss and transform your body — no gym needed.",
  },
  tone: {
    label: "💪 Tone & Sculpt",
    shortLabel: "💪 Tone & Sculpt",
    color: "#9333EA",
    bannerBg: "rgba(147,51,234,0.15)",
    title: "Sculpt your body. Own your strength.",
    body: "Targeted resistance workouts that build lean muscle, sculpt your curves and give you the toned athletic body you deserve — from your living room.",
  },
  recovery: {
    label: "😴 Energy & Recovery",
    shortLabel: "😴 Recovery",
    color: "#22C55E",
    bannerBg: "rgba(34,197,94,0.15)",
    title: "Rest smart. Rise stronger.",
    body: "Recovery is where results are made. These gentle but powerful workouts reduce stress, restore energy and improve sleep quality so your body transforms faster.",
  },
};

// ─── EXERCISE ─────────────────────────────────────────────────────────────────
function ExerciseScreen({ navigation, trainSubBar }) {
  const { profile, dayLog, addExercise, removeExercise } = useContext(Ctx);

  // screen: "library" | "ready" | "active" | "paused" | "done"
  const [screen,    setScreen]   = useState("library");
  const [selEx,     setSelEx]    = useState(null);
  const [catFilter, setCatFilter] = useState("all");
  const [toast,     setToast]    = useState(null);

  // live session state
  const [elapsed,   setElapsed]  = useState(0);   // seconds
  const [liveCal,   setLiveCal]  = useState(0);
  const [positions, setPositions] = useState([]);
  const [dist,      setDist]     = useState(0);    // metres
  const [speed,     setSpeed]    = useState(0);    // km/h
  const [maxSpeed,  setMaxSpeed] = useState(0);
  const [gpsOk,     setGpsOk]   = useState(false);

  const timerRef   = useRef(null);
  const locSub     = useRef(null);

  // pedometer state
  const [stepCount,      setStepCount]      = useState(0);
  const [pedometerAvail, setPedometerAvail] = useState(false);
  const pedometerSub          = useRef(null);
  const sessionStartSteps     = useRef(0);

  // nudge banner
  const [nudgeMsg,  setNudgeMsg]  = useState(null);
  const nudgeShown5 = useRef(false);
  const nudgeShown10 = useRef(false);
  const distRef    = useRef(0);
  const maxSpeedRef = useRef(0);
  const posRef     = useRef([]);

  // formatted timer HH:MM:SS
  function fmtElapsed(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = n => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  }

  // avg speed km/h from distance + elapsed
  function avgSpeedKmh() {
    if (elapsed < 5 || dist < 10) return 0;
    return Math.round((dist / 1000) / (elapsed / 3600) * 10) / 10;
  }

  // pace MM:SS /km
  function paceStr(kmh) {
    if (!kmh || kmh < 0.5) return "--:--";
    const secPerKm = 3600 / kmh;
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function startTimer() {
    timerRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1;
        if (selEx) {
          const t = getWorkoutThreshold(selEx.category);
          if (!t.usesGPS) {
            // Stationary exercise: use steps+MET or MET×weight×duration
            const weightKg   = profile?.weight || 65;
            const durationHr = next / 3600;
            const steps      = stepCount;
            const met        = selEx.met || 8;
            const cal = steps > 0
              ? Math.round((steps * 0.04) * (met / 9.8))
              : Math.round(met * weightKg * durationHr);
            setLiveCal(cal);
          } else {
            // Outdoor: keep existing time-based estimate during session
            setLiveCal(Math.round((next / 60) * selEx.calPerMin));
          }
        }
        return next;
      });
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function startPedometer() {
    try {
      const isAvailable = Pedometer ? await Pedometer.isAvailableAsync() : false;
      if (isAvailable) {
        const { status } = Pedometer ? await Pedometer.requestPermissionsAsync() : { status: "denied" };
        if (status !== "granted") return;
        setPedometerAvail(true);
        const end   = new Date();
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const result = Pedometer ? await Pedometer.getStepCountAsync(start, end) : { steps: 0 };
        sessionStartSteps.current = result.steps;
        if (Pedometer) {
          pedometerSub.current = Pedometer.watchStepCount(evt => {
            const steps = Math.max(0, evt.steps - sessionStartSteps.current);
            setStepCount(steps);
          });
        }
      }
    } catch (_e) {
      setPedometerAvail(false);
    }
  }

  function stopPedometer() {
    if (pedometerSub.current) {
      pedometerSub.current.remove();
      pedometerSub.current = null;
    }
  }

  async function startSession() {
    // reset everything
    setElapsed(0); setLiveCal(0); setDist(0); setSpeed(0); setMaxSpeed(0); setPositions([]);
    setStepCount(0); setNudgeMsg(null);
    distRef.current = 0; maxSpeedRef.current = 0; posRef.current = [];
    nudgeShown5.current = false; nudgeShown10.current = false;

    startTimer();

    // request GPS
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setGpsOk(true);
        locSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
          loc => {
            const { latitude, longitude, speed: spd, accuracy } = loc.coords;
            const pt = { lat: latitude, lng: longitude, ts: loc.timestamp };
            const prev = posRef.current[posRef.current.length - 1];
            if (prev && accuracy < 40) {
              const d = haversine(prev.lat, prev.lng, latitude, longitude);
              if (d < 200) { distRef.current += d; setDist(Math.round(distRef.current)); }
            }
            posRef.current = [...posRef.current, pt];
            setPositions([...posRef.current]);
            const kmh = spd ? Math.round(spd * 3.6 * 10) / 10 : 0;
            setSpeed(kmh);
            if (kmh > maxSpeedRef.current) { maxSpeedRef.current = kmh; setMaxSpeed(kmh); }
          }
        );
      } else {
        setGpsOk(false);
      }
    } catch (_) {
      setGpsOk(false);
    }

    startPedometer();
    setScreen("active");
  }

  function pauseSession() {
    stopTimer();
    locSub.current?.remove(); locSub.current = null;
    setScreen("paused");
  }

  async function resumeSession() {
    startTimer();
    try {
      if (gpsOk) {
        locSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
          loc => {
            const { latitude, longitude, speed: spd, accuracy } = loc.coords;
            const pt = { lat: latitude, lng: longitude, ts: loc.timestamp };
            const prev = posRef.current[posRef.current.length - 1];
            if (prev && accuracy < 40) {
              const d = haversine(prev.lat, prev.lng, latitude, longitude);
              if (d < 200) { distRef.current += d; setDist(Math.round(distRef.current)); }
            }
            posRef.current = [...posRef.current, pt];
            setPositions([...posRef.current]);
            const kmh = spd ? Math.round(spd * 3.6 * 10) / 10 : 0;
            setSpeed(kmh);
            if (kmh > maxSpeedRef.current) { maxSpeedRef.current = kmh; setMaxSpeed(kmh); }
          }
        );
      }
    } catch (_e) {
      // handled silently
    }
    setScreen("active");
  }

  function finishSession() {
    stopTimer();
    stopPedometer();
    locSub.current?.remove(); locSub.current = null;
    setScreen("done");
  }

  function saveSession() {
    const durationMin = Math.max(1, Math.round(elapsed / 60));
    const distKm = Math.round(distRef.current / 10) / 100;
    const avg = avgSpeedKmh();
    addExercise({
      name:           selEx.name,
      exerciseId:     selEx.id,
      type:           selEx.category,
      durationMin,
      caloriesBurned: liveCal,
      distance_km:    distKm,
      avgSpeed:       avg,
      maxSpeed:       maxSpeedRef.current,
      pace:           paceStr(avg),
      source:         "LIVE_SESSION",
      loggedAt:       new Date().toISOString(),
    });
    const msg = `Session saved! 🔥 ${liveCal} cal burned`;
    setScreen("library");
    setSelEx(null);
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function discardSession() {
    Alert.alert(
      "Discard this session?",
      "Your workout data will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => {
          stopTimer();
          stopPedometer();
          locSub.current?.remove(); locSub.current = null;
          setScreen("library"); setSelEx(null);
        }},
      ]
    );
  }

  const todayEx     = dayLog?.exercise || [];
  const totalBurned = dayLog?.totals?.caloriesBurned || 0;
  const totalMins   = todayEx.reduce((s, e) => s + (e.durationMin || 0), 0);
  const filteredLib = catFilter === "all" ? EX_LIBRARY : EX_LIBRARY.filter(e => e.category === catFilter);
  const distKm      = (dist / 1000).toFixed(2);
  const avg         = avgSpeedKmh();

  // Mid-session nudge alerts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (screen !== "active" || !selEx) return;
    const t = getWorkoutThreshold(selEx.category);
    const elapsed_min = elapsed / 60;
    const distanceKm  = dist / 1000;

    if (t.usesGPS) {
      if (!nudgeShown5.current && elapsed_min >= 5 && distanceKm < 0.1) {
        nudgeShown5.current = true;
        setNudgeMsg("🏃 Still warming up? We haven't detected much movement yet!");
      }
      if (!nudgeShown10.current && elapsed_min >= 10 && distanceKm < 0.2) {
        nudgeShown10.current = true;
        Alert.alert(
          "Are you still working out? 🤔",
          "We haven't detected much movement in the last 10 minutes.\n\nSessions without movement won't count toward challenges.",
          [
            { text: "Yes, I'm going! 💪", style: "default" },
            { text: "End Session", style: "destructive", onPress: finishSession },
          ]
        );
      }
      const threshold = getWorkoutThreshold(selEx.category);
      if (speed > threshold.maxAvgSpeed_kmh && speed > 0) {
        setNudgeMsg("🚗 You're moving very fast — are you in a vehicle?");
      }
    }
  }, [elapsed, screen]);

  // ── READY SCREEN ────────────────────────────────────────────────────────────
  if (screen === "ready" && selEx) {
    const catColor = selEx.categoryColor || ROSE;
    const diffColor = selEx.difficulty === "Advanced" ? "#EF4444"
      : selEx.difficulty === "Intermediate" ? ROSE : "#22C55E";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
        <StatusBar style="light" backgroundColor="transparent" translucent={true} />
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Back button */}
          <TouchableOpacity onPress={() => { setSelEx(null); setScreen("library"); }}
            style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>← Back</Text>
          </TouchableOpacity>

          {/* Hero */}
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <Text style={{ fontSize: 80 }}>{selEx.emoji}</Text>
            <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginTop: 12, textAlign: "center",
              paddingHorizontal: 24 }}>{selEx.name}</Text>
            {/* Badge row */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap",
              justifyContent: "center", paddingHorizontal: 16 }}>
              {[selEx.duration, selEx.calories, selEx.difficulty].map((v, i) => (
                <View key={i} style={{ backgroundColor: "#1E2837", borderRadius: 20,
                  paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: i === 2 ? diffColor : "#FFFFFF", fontSize: 12, fontWeight: "600" }}>{v}</Text>
                </View>
              ))}
            </View>
            {/* Home workout badge */}
            <View style={{ marginTop: 14, backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 6,
              borderWidth: 1, borderColor: ROSE }}>
              <Text style={{ color: ROSE, fontSize: 12, fontWeight: "700" }}>🏠 Home Workout — No Equipment</Text>
            </View>
          </View>

          {/* Instructions */}
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 18, marginBottom: 12 }}>
              How To Do It
            </Text>
            {(selEx.instructions || []).map((step, i) => (
              <View key={i} style={{ backgroundColor: "#111827", borderRadius: 10, padding: 12,
                marginBottom: 8, flexDirection: "row", alignItems: "flex-start" }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: ROSE,
                  alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 1, flexShrink: 0 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{i + 1}</Text>
                </View>
                <Text style={{ color: "#FFFFFF", fontSize: 14, flex: 1, lineHeight: 20 }}>
                  {step.replace(/^\d+\.\s*/, "")}
                </Text>
              </View>
            ))}
          </View>

          {/* Coach Tip */}
          {selEx.coachTip && (
            <View style={{ marginHorizontal: 16, marginBottom: 20,
              backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 12,
              borderLeftWidth: 4, borderLeftColor: ROSE, padding: 16 }}>
              <Text style={{ color: ROSE, fontWeight: "700", fontSize: 13, marginBottom: 6 }}>
                💪 Coach TinaBarks says:
              </Text>
              <Text style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 22 }}>
                {selEx.coachTip}
              </Text>
            </View>
          )}

          {/* Cal/min info */}
          <View style={{ marginHorizontal: 16, backgroundColor: "#111827", borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 16 }}>
            <Row>
              <Text style={{ fontSize: 18, marginRight: 10 }}>🔥</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 15 }}>
                ~{selEx.calPerMin} cal/min · MET {selEx.met}
              </Text>
            </Row>
          </View>
        </ScrollView>

        {/* Start Workout CTA — fixed bottom */}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: "#070B14", paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12,
          borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
          <TouchableOpacity onPress={startSession}
            style={{ height: 56, borderRadius: 14, backgroundColor: ROSE,
              alignItems: "center", justifyContent: "center",
              shadowColor: ROSE, shadowRadius: 12, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 } }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>🏃 Start Workout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── ACTIVE / PAUSED SCREEN ───────────────────────────────────────────────────
  if (screen === "active" || screen === "paused") {
    const isPaused = screen === "paused";
    return (
      <SafeAreaView style={S.screen}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Status bar */}
          <Row style={{ justifyContent: "space-between", paddingVertical: 14 }}>
            <Row>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 6,
                backgroundColor: isPaused ? C.amber : "#EF4444" }} />
              <Text style={{ color: isPaused ? C.amber : "#EF4444", fontWeight: "700", fontSize: 13 }}>
                {isPaused ? "PAUSED" : "LIVE"}
              </Text>
            </Row>
            <Row>
              <Text style={{ fontSize: 20, marginRight: 6 }}>{selEx?.emoji}</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{selEx?.name}</Text>
            </Row>
          </Row>

          {/* Big timer */}
          <View style={{ alignItems: "center", paddingVertical: 28,
            backgroundColor: "#111827", borderRadius: 20, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
            shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "600", letterSpacing: 2, marginBottom: 6 }}>
              DURATION
            </Text>
            <Text style={{ color: ROSE, fontSize: 56, fontWeight: "800", letterSpacing: -1 }}>
              {fmtElapsed(elapsed)}
            </Text>
          </View>

          {/* Stat boxes */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 14, padding: 14, alignItems: "center",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>🔥</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 22 }}>{liveCal}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>calories</Text>
            </View>
            {gpsOk ? (
              <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 14, padding: 14, alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ fontSize: 20, marginBottom: 4 }}>📍</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 22 }}>{distKm}</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>km</Text>
              </View>
            ) : (
              <View style={{ flex: 1, backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 14, padding: 14, alignItems: "center",
                borderWidth: 1, borderColor: "rgba(245,158,11,0.25)", justifyContent: "center" }}>
                <Text style={{ color: C.amber, fontSize: 11, textAlign: "center", fontWeight: "600" }}>
                  📍 GPS unavailable
                </Text>
              </View>
            )}
          </View>

          {gpsOk && (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 14, padding: 14, alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ fontSize: 18, marginBottom: 4 }}>⚡</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 20 }}>{speed}</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>km/h speed</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 14, padding: 14, alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ fontSize: 18, marginBottom: 4 }}>📈</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 20 }}>{paceStr(avg)}</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>/km pace</Text>
              </View>
            </View>
          )}

          {/* Step counter */}
          {pedometerAvail && (
            <View style={{ backgroundColor: "#1E2837", borderRadius: 14, padding: 14, marginBottom: 12,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>👟</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 20 }}>
                  {stepCount.toLocaleString()}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 1 }}>steps this session</Text>
              </View>
              <View style={{ backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "700" }}>LIVE</Text>
              </View>
            </View>
          )}

          {/* Nudge banner */}
          {nudgeMsg && (
            <NudgeBanner message={nudgeMsg} onDismiss={() => setNudgeMsg(null)} />
          )}

          {/* Route map */}
          {gpsOk && positions.length > 1 && (
            <View style={{ backgroundColor: "#111827", borderRadius: 16, overflow: "hidden", marginBottom: 16,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <RouteMap positions={positions} height={180} />
            </View>
          )}

          {/* Controls */}
          <Row style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={isPaused ? resumeSession : pauseSession}
              style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center",
                backgroundColor: "#1E2837", borderWidth: 2, borderColor: C.amber }}>
              <Text style={{ color: C.amber, fontWeight: "800", fontSize: 16 }}>
                {isPaused ? "▶ RESUME" : "⏸ PAUSE"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={finishSession}
              style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center",
                backgroundColor: ROSE,
                shadowColor: ROSE, shadowRadius: 8, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 } }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>⏹ FINISH</Text>
            </TouchableOpacity>
          </Row>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── DONE / SUMMARY SCREEN ────────────────────────────────────────────────────
  if (screen === "done" && selEx) {
    const avg2           = avgSpeedKmh();
    const distKmFinal    = Math.round(distRef.current / 10) / 100;
    const isStationary   = !getWorkoutThreshold(selEx.category).usesGPS;
    const weightKg       = profile?.weight || 65;
    const durationHr     = elapsed / 3600;
    const met            = selEx.met || 8;
    // For stationary: recompute final calories from steps+MET (more accurate than timer ticks)
    const finalCal = isStationary
      ? (stepCount > 0
          ? Math.round((stepCount * 0.04) * (met / 9.8))
          : Math.round(met * weightKg * durationHr))
      : liveCal;
    const calSource = isStationary
      ? "📊 Calculated from steps & duration"
      : "📍 Calculated from GPS & duration";
    const integrity   = calculateIntegrityScore({
      workoutType:  selEx.category,
      distance_km:  distKmFinal,
      avgSpeed_kmh: avg2,
      duration_sec: elapsed,
      stepCount,
    });
    const scoreColor = integrity.score >= 80 ? ROSE : integrity.score >= 60 ? "#10B981" : integrity.score >= 41 ? "#F59E0B" : "#EF4444";
    const scoreBarW  = `${integrity.score}%`;

    function handleSave() {
      if (integrity.vehicleFlag) {
        Alert.alert(
          "Session Not Counted 🚗",
          "This session detected vehicle-speed movement and won't be saved.\n\nStart a new session when ready to run!",
          [{ text: "OK", style: "default", onPress: () => { setScreen("library"); setSelEx(null); } }]
        );
        return;
      }
      const durationMin = Math.max(1, Math.round(elapsed / 60));
      addExercise({
        name:           selEx.name,
        exerciseId:     selEx.id,
        type:           selEx.category,
        durationMin,
        caloriesBurned: integrity.isVerified ? finalCal : 0,
        distance_km:    isStationary ? 0 : distKmFinal,
        avgSpeed:       isStationary ? 0 : avg2,
        maxSpeed:       isStationary ? 0 : maxSpeedRef.current,
        pace:           isStationary ? "--" : paceStr(avg2),
        stepCount,
        integrityScore: integrity.score,
        verified:       integrity.isVerified,
        source:         isStationary
          ? (integrity.isVerified ? "STEPS_MET_VERIFIED" : "STEPS_MET_UNVERIFIED")
          : (integrity.isVerified ? "GPS_VERIFIED"       : "GPS_UNVERIFIED"),
        loggedAt:       new Date().toISOString(),
      }, integrity.isVerified);
      if (integrity.isVerified) {
        setScreen("library"); setSelEx(null);
        setToast(`✅ Verified! +50 WeGoFit Points! 🏆`);
        setTimeout(() => setToast(null), 3500);
      } else {
        Alert.alert(
          "Session Saved ⚠️",
          "Your session was saved but didn't meet the minimum activity thresholds.\n\nNo challenge credit or points awarded this time — keep pushing! 💪",
          [{ text: "Got it!", style: "default", onPress: () => { setScreen("library"); setSelEx(null); } }]
        );
      }
    }

    return (
      <SafeAreaView style={S.screen}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "800", textAlign: "center", marginBottom: 4 }}>
            Session Complete! ✅
          </Text>
          <Row style={{ justifyContent: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 22, marginRight: 6 }}>{selEx.emoji}</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 16 }}>{selEx.name}</Text>
          </Row>

          {/* Stats summary */}
          <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 20, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
            shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }}>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              {[
                { v: fmtElapsed(elapsed),                                    l: "time"     },
                ...(!isStationary ? [{ v: gpsOk ? `${distKmFinal}km` : "--", l: "distance" }] : []),
                { v: `${finalCal}`,                                          l: "calories" },
              ].map(s => (
                <View key={s.l} style={{ flex: 1, alignItems: "center", backgroundColor: "#1E2837", borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: ROSE, fontWeight: "800", fontSize: 18 }}>{s.v}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>{s.l}</Text>
                </View>
              ))}
            </View>
            {pedometerAvail && (
              <Row style={{ justifyContent: "center", gap: 6 }}>
                <Text style={{ fontSize: 16 }}>👟</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{stepCount.toLocaleString()} steps</Text>
              </Row>
            )}
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textAlign: "center", marginTop: 8 }}>
              {calSource}
            </Text>
            {gpsOk && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                {[
                  { l: "Avg Speed", v: `${avg2} km/h` },
                  { l: "Max Speed", v: `${maxSpeed} km/h` },
                  { l: "Avg Pace",  v: `${paceStr(avg2)} /km` },
                ].map(s => (
                  <View key={s.l} style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{s.l}</Text>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{s.v}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Route map */}
          {gpsOk && positions.length > 1 && (
            <View style={{ backgroundColor: "#111827", borderRadius: 16, overflow: "hidden", marginBottom: 16,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <RouteMap positions={positions} height={180} />
            </View>
          )}

          {/* ── INTEGRITY CARD ── */}
          <View style={{
            backgroundColor: "#111827", borderRadius: 20, padding: 20, marginBottom: 20,
            borderWidth: 2,
            borderColor: integrity.vehicleFlag ? "#F59E0B" : integrity.isVerified ? "#10B981" : "#F59E0B",
            shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
          }}>
            {integrity.vehicleFlag ? (
              <>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#F59E0B", marginBottom: 8 }}>🚗 Unusual Speed Detected</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 20 }}>
                  Average speed was {avg2} km/h — too fast for {selEx.name}.{"\n\n"}
                  Looks like you might have been in a vehicle! No worries — start a fresh session when you're ready to run! 🏃
                </Text>
                <View style={{ backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 10, padding: 10, marginTop: 12 }}>
                  <Text style={{ color: "#F59E0B", fontWeight: "700", fontSize: 13, textAlign: "center" }}>Session will not be saved</Text>
                </View>
              </>
            ) : (
              <>
                <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#FFFFFF" }}>
                    {integrity.isVerified ? "🏅" : "⚠️"} Workout Integrity Score
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: scoreColor }}>
                    {integrity.score}<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>/100</Text>
                  </Text>
                </Row>

                {/* Score bar */}
                <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, marginBottom: 16, overflow: "hidden" }}>
                  <View style={{ height: 8, width: scoreBarW, backgroundColor: scoreColor, borderRadius: 4 }} />
                </View>

                {/* Check rows */}
                {integrity.checks.map((c, i) => (
                  <Row key={i} style={{ marginBottom: 8, gap: 8 }}>
                    <Text style={{ width: 20, fontSize: 14 }}>
                      {c.passed === true ? "✅" : c.passed === null ? "⚡" : "❌"}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, width: 70 }}>{c.label}</Text>
                    <Text style={{ flex: 1, color: "#FFFFFF", fontSize: 13, fontWeight: "600" }}>{c.value}</Text>
                    <Text style={{ color: scoreColor, fontSize: 12, fontWeight: "700" }}>+{c.points}</Text>
                  </Row>
                ))}

                {/* Verdict */}
                <View style={{
                  marginTop: 12, borderRadius: 12, padding: 12,
                  backgroundColor: integrity.isVerified ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                }}>
                  <Text style={{ color: integrity.isVerified ? "#10B981" : "#F59E0B", fontWeight: "800", fontSize: 14, textAlign: "center" }}>
                    {integrity.isVerified
                      ? "✅ VERIFIED SESSION — Full challenge credit awarded!"
                      : "⚠️ LOW ACTIVITY — Minimum thresholds not met. You've got this next time! 💪"}
                  </Text>
                </View>
              </>
            )}
          </View>

          {!integrity.vehicleFlag && (
            <TouchableOpacity onPress={handleSave}
              style={{ paddingVertical: 17, borderRadius: 16, alignItems: "center",
                backgroundColor: ROSE, marginBottom: 12,
                shadowColor: ROSE, shadowRadius: 12, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 } }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 17 }}>💾 Save Session</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={discardSession} style={{ alignItems: "center", paddingVertical: 10 }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 15 }}>{integrity.vehicleFlag ? "← Start New Session" : "🗑 Discard"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── LIBRARY SCREEN (default) ─────────────────────────────────────────────────
  const catMeta = catFilter !== "all" ? CATEGORY_META[catFilter] : null;

  return (
    <SafeAreaView style={S.screen}>
      {trainSubBar || null}
      {/* Toast */}
      {toast && (
        <View style={{ position: "absolute", top: 60, left: 24, right: 24, zIndex: 999,
          backgroundColor: "#1A1A1A", borderRadius: 12, padding: 14, alignItems: "center",
          shadowColor: "#000", shadowRadius: 12, shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 } }}>
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>{toast}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>
            Train with Coach TinaBarks
          </Text>
          <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600", marginTop: 4 }}>
            All workouts are home-based — no gym equipment needed! 💪
          </Text>
        </View>

        {/* Home Workout Global Banner */}
        <View style={{ marginHorizontal: 16, marginTop: 10, marginBottom: 4,
          backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 10,
          paddingVertical: 8, paddingHorizontal: 14 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600", textAlign: "center" }}>
            Sweat at home today. Shine everywhere tomorrow. ✨
          </Text>
        </View>

        {/* Today's Summary Bar */}
        <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 10, marginTop: 12, marginBottom: 20 }}>
          {[
            { v: todayEx.length, l: "sessions"  },
            { v: totalMins,      l: "min total"  },
            { v: totalBurned,    l: "cal burned" },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 14, padding: 12,
              alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", elevation: 1 }}>
              <Text style={{ color: ROSE, fontSize: 22, fontWeight: "800" }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Today's Sessions */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 17, marginBottom: 10 }}>
            Today's Sessions
          </Text>
          {todayEx.length === 0 ? (
            <View style={{ backgroundColor: "#1E2837", borderRadius: 14,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 24, alignItems: "center" }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🏋️</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", textAlign: "center", fontSize: 14 }}>
                No sessions today. Pick an exercise below! 👇
              </Text>
            </View>
          ) : (
            todayEx.map((ex, idx) => {
              const lib   = EX_LIBRARY.find(e => e.id === ex.exerciseId);
              const cat   = lib?.category || ex.type || "belly_fat";
              const pill  = CAT_PILL[cat] || CAT_PILL.belly_fat;
              const emoji = lib?.emoji || ex.emoji || "🏃";
              const hasScore = ex.integrityScore != null;
              const scorePillBg    = !hasScore ? null : ex.integrityScore >= 60 ? "#ECFDF5" : "#FFFBEB";
              const scorePillColor = !hasScore ? null : ex.integrityScore >= 60 ? "#10B981" : "#F59E0B";
              const scorePillTxt   = !hasScore ? null : `${ex.verified ? "✅" : "⚠️"}${ex.integrityScore}`;
              return (
                <View key={idx} style={{ backgroundColor: "#1E2837", borderRadius: 14, marginBottom: 8,
                  flexDirection: "row", alignItems: "center", padding: 14,
                  borderWidth: 1, borderColor: ex.verified === false ? "#FDE68A" : "rgba(255,255,255,0.08)",
                  elevation: 1 }}>
                  <Text style={{ fontSize: 26, marginRight: 12 }}>{emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{ex.name}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>
                      {ex.durationMin} min
                      {ex.distance_km ? ` · ${ex.distance_km} km` : ""}
                      {ex.stepCount ? ` · ${ex.stepCount.toLocaleString()} steps` : ""}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3,
                    borderRadius: 20, backgroundColor: pill.bg, marginRight: 6 }}>
                    <Text style={{ color: pill.text, fontSize: 11, fontWeight: "600" }}>
                      {ex.caloriesBurned} cal
                    </Text>
                  </View>
                  {hasScore && (
                    <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
                      backgroundColor: scorePillBg, marginRight: 6 }}>
                      <Text style={{ color: scorePillColor, fontSize: 11, fontWeight: "700" }}>
                        {scorePillTxt}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => removeExercise(idx)}
                    style={{ width: 30, height: 30, borderRadius: 15,
                      backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: C.red, fontSize: 14 }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Exercise Library */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 17, marginBottom: 12 }}>
            Exercise Library
          </Text>

          {/* Category Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16, marginBottom: 14 }}>
            {[
              { id: "all",       label: "All"              },
              { id: "belly_fat", label: "🔥 Belly Fat & Weight Loss" },
              { id: "tone",      label: "💪 Tone & Sculpt" },
              { id: "recovery",  label: "😴 Energy & Recovery" },
            ].map(f => (
              <TouchableOpacity key={f.id} onPress={() => setCatFilter(f.id)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                  backgroundColor: catFilter === f.id ? ROSE : "#1E2837",
                  borderWidth: 1, borderColor: catFilter === f.id ? ROSE : "rgba(255,255,255,0.12)" }}>
                <Text style={{ color: catFilter === f.id ? "#FFF" : "rgba(255,255,255,0.55)",
                  fontWeight: "600", fontSize: 12 }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Category Banner */}
          {catMeta && (
            <View style={{ backgroundColor: catMeta.bannerBg, borderRadius: 16,
              borderLeftWidth: 4, borderLeftColor: catMeta.color, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: catMeta.color, fontWeight: "800", fontSize: 18, marginBottom: 6 }}>
                {catMeta.title}
              </Text>
              <Text style={{ color: "#FFFFFF", fontSize: 12, lineHeight: 18 }}>
                {catMeta.body}
              </Text>
            </View>
          )}

          {/* Exercise Cards */}
          {filteredLib.map(ex => {
            const pill = CAT_PILL[ex.category] || CAT_PILL.belly_fat;
            const diffColor = ex.difficulty === "Advanced" ? "#EF4444"
              : ex.difficulty === "Intermediate" ? ROSE : "#22C55E";
            return (
              <TouchableOpacity key={ex.id} activeOpacity={0.7}
                onPress={() => { setSelEx(ex); setScreen("ready"); }}
                style={{ backgroundColor: "#111827", borderRadius: 16, marginBottom: 10,
                  flexDirection: "row", alignItems: "center", padding: 14,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", elevation: 1 }}>
                {/* Emoji circle */}
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#1E2837",
                  alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Text style={{ fontSize: 20 }}>{ex.emoji}</Text>
                </View>
                {/* Middle info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{ex.name}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
                    {ex.duration} · {ex.calories}
                  </Text>
                  <Text style={{ color: diffColor, fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                    {ex.difficulty}
                  </Text>
                </View>
                {/* Right side */}
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3,
                    backgroundColor: ex.categoryColor || pill.text, marginBottom: 4 }} />
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>MET {ex.met}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 18, marginTop: 2 }}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── COACH ────────────────────────────────────────────────────────────────────
const KEY_OFFLINE_QUEUE = "gofit_offline_queue";

// ─── TYPING DOT ───────────────────────────────────────────────────────────────
function TypingDot({ delay }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1,   duration: 380, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 380, useNativeDriver: true }),
      ])
    ).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: ROSE, opacity }} />;
}

// ─── WELCOME MESSAGE BUBBLE ───────────────────────────────────────────────────
function WelcomeMessageBubble({ message }) {
  return (
    <View style={{ backgroundColor: "#1A1A2E", borderRadius: 20, padding: 20, marginBottom: 12, marginHorizontal: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: ROSE, alignItems: "center",
          justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF30" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>TB</Text>
        </View>
        <View>
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>Coach TinaBarks 🌸</Text>
          <Text style={{ color: "#FFFFFF60", fontSize: 12, marginTop: 2 }}>WeGoFit Head Coach · Just now</Text>
        </View>
      </View>
      <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 10 }}>
        {message.greeting} {message.name}! 🎉
      </Text>
      <Text style={{ color: "#FFFFFFCC", fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
        Welcome to the WeGoFit family — I am so excited you are here!{"\n\n"}You have just taken the BIGGEST step — deciding to start. That takes real courage and I see you! 💪{"\n\n"}Your goal to {message.goalText} is 100% achievable. I have designed WeGoFit to help East African clients just like you get real results.
      </Text>
      <View style={{ backgroundColor: "#FFFFFF15", borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <Text style={{ color: ROSE, fontSize: 13, fontWeight: "700", marginBottom: 10 }}>🎯 Your Quick Start Today:</Text>
        {message.quickStart.map((item, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: ROSE, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{i + 1}</Text>
            </View>
            <Text style={{ color: "#FFFFFFCC", fontSize: 13, flex: 1 }}>{item}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: ROSE, fontSize: 14, fontWeight: "700", textAlign: "right" }}>— Coach TinaBarks 🌸</Text>
    </View>
  );
}

// ─── COACH SCREEN ─────────────────────────────────────────────────────────────
function CoachScreen({ navigation }) {
  const { chatMsgs, saveChat, isOnline, profile } = useContext(Ctx);
  const { clearCoachUnread, incrementCoachUnread, activeRoute } = useContext(PaywallCtx);
  const [msgs,         setMsgs]         = useState([]);
  const [input,        setInput]        = useState("");
  const [typing,       setTyping]       = useState(false);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [readAt,       setReadAt]       = useState(null); // timestamp when screen was opened
  const listRef    = useRef(null);
  const prevOnline = useRef(isOnline);

  // Clear unread badge when Coach screen is opened
  useEffect(() => {
    clearCoachUnread();
    setReadAt(new Date().toISOString());
  }, []);

  // Also clear if user navigates back to Coach tab while it's focused
  useEffect(() => {
    if (activeRoute === "Coach") {
      clearCoachUnread();
      setReadAt(new Date().toISOString());
    }
  }, [activeRoute]);

  // Load chat history and check welcome message
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    async function loadMessages() {
      const raw = await AsyncStorage.getItem(KEY_OFFLINE_QUEUE).catch(() => null);
      if (raw) setOfflineQueue(JSON.parse(raw));

      let base = chatMsgs && chatMsgs.length > 0 ? chatMsgs : [];

      // Try Supabase first
      if (profile?.id) {
        try {
          const { data } = await supabase
            .from("messages")
            .select("*")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: true })
            .limit(100);
          if (data && data.length > 0) {
            base = data.map(m => ({
              id:        m.id,
              text:      m.text,
              sender:    m.sender,
              role:      m.sender,
              isAIReply: m.is_ai,
              isWelcome: m.is_welcome,
              timestamp: m.created_at,
              ts:        m.created_at,
              read:      m.read,
            }));
          }
        } catch (_e) {
          // Supabase failed — use AsyncStorage fallback
          try {
            const cached = await AsyncStorage.getItem("gofit_chat_" + (profile?.id || ""));
            if (cached) base = JSON.parse(cached);
          } catch (_e2) {}
        }
      }

      // Welcome message check
      const userId  = profile?.id || profile?.email || "";
      const flagKey = "gofit_welcome_sent_" + userId;
      const welcomeSent = await AsyncStorage.getItem(flagKey).catch(() => null);
      if (!welcomeSent && profile?.name) {
        const welcome = generateWelcomeMessage(profile);
        const hasWelcome = base.some(m => m.isWelcome);
        const withWelcome = hasWelcome ? base : [welcome, ...base];
        setMsgs(withWelcome);
        await AsyncStorage.setItem(flagKey, "true");
      } else {
        setMsgs(base);
      }
    }
    loadMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const flushQueue = useCallback(async () => {
    const queue = [...offlineQueue];
    setOfflineQueue([]);
    await AsyncStorage.removeItem(KEY_OFFLINE_QUEUE);
    for (const qMsg of queue) {
      const sent = { ...qMsg, pending: false };
      setMsgs(prev => { const next = prev.map(m => m.id === qMsg.id ? sent : m); saveChat(next); return next; });
      await new Promise(r => setTimeout(r, 800));
      const reply    = await getAICoachReply(qMsg.text, profile);
      const coachMsg = { id: `c${Date.now()}`, role: "coach", text: reply, ts: new Date().toISOString(), isAIReply: true };
      setMsgs(prev => { const next = [...prev, coachMsg]; saveChat(next); return next; });
      if (activeRoute !== "Coach") incrementCoachUnread();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineQueue, activeRoute]);

  useEffect(() => {
    if (isOnline && !prevOnline.current && offlineQueue.length > 0) flushQueue();
    prevOnline.current = isOnline;
  }, [isOnline, offlineQueue.length, flushQueue]);

  async function send() {
    if (!input.trim() || typing) return;
    const userMsg = { id: `u${Date.now()}`, role: "user", text: input.trim(), ts: new Date().toISOString(), pending: !isOnline };
    const updated = [...msgs, userMsg];
    setMsgs(updated); saveChat(updated); setInput("");

    if (!isOnline) {
      const newQueue = [...offlineQueue, userMsg];
      setOfflineQueue(newQueue);
      AsyncStorage.setItem(KEY_OFFLINE_QUEUE, JSON.stringify(newQueue));
      return;
    }

    // Sync user message to Supabase
    try {
      await supabase.from("messages").insert({
        user_id: profile?.id,
        sender:  "client",
        text:    userMsg.text,
        is_ai:   false,
        read:    false,
      });
    } catch (_e) {}

    setTyping(true);
    const delay = 1500 + Math.random() * 1000;
    await new Promise(r => setTimeout(r, delay));
    const aiText   = await getAICoachReply(userMsg.text, profile);
    setTyping(false);
    const coachMsg = { id: `c${Date.now()}`, role: "coach", text: aiText, ts: new Date().toISOString(), isAIReply: true, isNew: activeRoute !== "Coach" };
    const final    = [...updated, coachMsg];
    setMsgs(final); saveChat(final);

    // Increment unread badge if user is not currently on Coach screen
    if (activeRoute !== "Coach") incrementCoachUnread();

    // Sync AI reply to Supabase
    try {
      await supabase.from("messages").insert({
        user_id: profile?.id,
        sender:  "coach",
        text:    aiText,
        is_ai:   true,
        read:    true,
      });
    } catch (_e) {}

    // Flag for coach dashboard
    try {
      await AsyncStorage.setItem("gofit_unread_" + (profile?.id || profile?.email || ""), JSON.stringify({
        clientName: profile?.name, lastMessage: userMsg.text, aiReply: aiText,
        timestamp: new Date().toISOString(), needsReply: true,
      }));
    } catch (_e) { /* silent */ }
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <SafeAreaView style={S.screen}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#070B14",
        paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
        borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.1)" }}>
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#1E2837",
            justifyContent: "center", alignItems: "center", marginRight: 12 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600" }}>‹</Text>
        </TouchableOpacity>
        {/* Coach avatar */}
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: ROSE,
          justifyContent: "center", alignItems: "center", marginRight: 10 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>CT</Text>
        </View>
        {/* Coach info */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>Coach TinaBarks</Text>
          <Text style={{ color: ROSE, fontSize: 12 }}>
            {isOnline ? "WeGoFit Head Coach 👑" : "Offline · Messages queued"}
          </Text>
        </View>
      </View>

      {offlineQueue.length > 0 && isOnline && (
        <View style={{ backgroundColor: "#ECFDF5", paddingVertical: 8, paddingHorizontal: 16 }}>
          <Text style={{ color: "#065F46", fontSize: 12, fontWeight: "600" }}>
            Sending {offlineQueue.length} queued message{offlineQueue.length > 1 ? "s" : ""}...
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={[...msgs, ...(typing ? [{ id: "typing", role: "typing" }] : [])]}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            if (item.isWelcome) return <WelcomeMessageBubble message={item} />;

            if (item.role === "typing") {
              return (
                <Row style={{ alignItems: "flex-end" }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: ROSE,
                    alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>TB</Text>
                  </View>
                  <View style={{ backgroundColor: C.cardLight, borderRadius: 18, paddingHorizontal: 14,
                    paddingVertical: 12, flexDirection: "row", gap: 5, alignItems: "center" }}>
                    {[0, 1, 2].map(i => <TypingDot key={i} delay={i * 180} />)}
                  </View>
                  <Text style={{ fontSize: 11, color: C.grey, fontStyle: "italic", marginLeft: 8 }}>
                    TinaBarks is typing...
                  </Text>
                </Row>
              );
            }

            const isUser = item.role === "user";
            const isUnread = !isUser && item.isNew && item.ts && readAt && item.ts > readAt;
            return (
              <View style={{ alignItems: isUser ? "flex-end" : "flex-start" }}>
                <Row style={{ alignItems: "flex-end", flexDirection: isUser ? "row-reverse" : "row" }}>
                  {!isUser && (
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ROSE,
                      alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>TB</Text>
                    </View>
                  )}
                  <View style={[S.bubble, {
                    backgroundColor: isUser ? ROSE : C.card,
                    marginLeft: isUser ? 8 : 0, marginRight: isUser ? 0 : 8,
                    maxWidth: SW * 0.72,
                    opacity: item.pending ? 0.65 : 1,
                    borderLeftWidth: item.isNew ? 3 : 0,
                    borderLeftColor: item.isNew ? ROSE : "transparent",
                  }]}>
                    <Text style={{ color: isUser ? "#FFFFFF" : C.text, fontSize: 14, lineHeight: 20 }}>{item.text}</Text>
                    {item.pending && (
                      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 3 }}>Pending — will send when online</Text>
                    )}
                  </View>
                </Row>
                <Text style={{ color: "#AAAAAA", fontSize: 10, marginTop: 2, marginHorizontal: 36 }}>{fmtTime(item.ts)}</Text>
                {item.isAIReply && (
                  <Text style={{ fontSize: 10, color: C.grey, fontStyle: "italic", marginTop: 2, marginLeft: 36 }}>
                    🤖 AI Assistant · TinaBarks will follow up personally
                  </Text>
                )}
              </View>
            );
          }}
        />

        {!isOnline && (
          <View style={{ backgroundColor: "#FEF3C7", paddingVertical: 8, paddingHorizontal: 14 }}>
            <Text style={{ color: "#92400E", fontSize: 12, textAlign: "center" }}>
              You are offline. Messages will be queued and sent automatically when you reconnect.
            </Text>
          </View>
        )}

        <View style={{ flexDirection: "row", padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: C.cardLight, backgroundColor: C.bg }}>
          <TextInput
            style={[S.input, { flex: 1, paddingVertical: 10 }]}
            placeholder={isOnline ? "Ask Coach TinaBarks anything..." : "Type a message (will send when online)..."}
            placeholderTextColor={C.grey}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity onPress={send} disabled={!input.trim() || typing}
            style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
              backgroundColor: input.trim() && !typing ? ROSE : C.cardLight }}>
            <Text style={{ fontSize: 18, color: input.trim() && !typing ? "#FFFFFF" : C.grey }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── CONTACT SUPPORT SCREEN ───────────────────────────────────────────────────
function ContactSupportScreen({ onBack }) {
  const { profile } = useContext(Ctx);
  const { theme }   = useTheme();
  const C2          = theme;
  const [subject,   setSubject]   = useState("General Question");
  const [message,   setMessage]   = useState("");
  const [sent,      setSent]      = useState(false);
  const [sending,   setSending]   = useState(false);
  const [ticketRef, setTicketRef] = useState("");

  const SUBJECTS = ["General Question","Technical Issue","Billing & Subscription",
    "Account Help","Meal Plan Question","Workout Advice","Feature Request","Other"];

  function generateTicketRef() {
    const now  = new Date();
    const yr   = now.getFullYear().toString().slice(-2);
    const mo   = String(now.getMonth() + 1).padStart(2, "0");
    const dy   = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `GF${yr}${mo}${dy}${rand}`;
  }

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    const ref    = generateTicketRef();
    setTicketRef(ref);
    const ticket = { ref, subject, message: message.trim(), from: profile?.name,
      email: profile?.email, sentAt: new Date().toISOString(), status: "pending" };
    try {
      const existing = await AsyncStorage.getItem("gofit_support_tickets");
      const tickets  = existing ? JSON.parse(existing) : [];
      tickets.push(ticket);
      await AsyncStorage.setItem("gofit_support_tickets", JSON.stringify(tickets));
    } catch (_e) { /* silent */ }
    try {
      await supabase.from("support_tickets").insert({
        user_id:    profile?.id,
        ref,
        subject,
        message:    message.trim(),
        from_name:  profile?.name  || "",
        from_email: profile?.email || "",
        status:     "pending",
      });
    } catch (_e) {}
    await new Promise(r => setTimeout(r, 1500));
    setSending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: C2.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#ECFDF5",
          alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Text style={{ fontSize: 40 }}>✅</Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: "800", color: C2.text, textAlign: "center", marginBottom: 12 }}>
          Message Sent!
        </Text>
        <Text style={{ fontSize: 15, color: C2.textSub, textAlign: "center", lineHeight: 24, marginBottom: 20 }}>
          Thank you {profile?.name}! 🙏{"\n\n"}Coach TinaBarks personally reviews every support message and will get back to you within 24 hours at:{"\n"}
          <Text style={{ color: ROSE, fontWeight: "700" }}>support@wegofit.app</Text>
        </Text>
        <View style={{ backgroundColor: C2.cardLight, borderRadius: 14, padding: 16, width: "100%", marginBottom: 24, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: C2.textSub, marginBottom: 4 }}>Your reference number</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: ROSE, letterSpacing: 2 }}>#{ticketRef}</Text>
          <Text style={{ fontSize: 11, color: C2.textSub, marginTop: 4, textAlign: "center" }}>Keep this for your records</Text>
        </View>
        <TouchableOpacity onPress={onBack}
          style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>Back to Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView style={{ flex: 1, backgroundColor: C2.bg }} contentContainerStyle={{ padding: 20, paddingTop: 50 }}
        keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 4 }}>
          <Text style={{ color: ROSE, fontSize: 16, fontWeight: "600" }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "800", color: C2.text, marginBottom: 4 }}>Contact Support 💬</Text>
        <Text style={{ fontSize: 14, color: C2.textSub, marginBottom: 24, lineHeight: 20 }}>
          We typically respond within 24 hours at{" "}
          <Text style={{ color: ROSE }}>support@wegofit.app</Text>
        </Text>

        <Text style={{ fontSize: 12, fontWeight: "600", color: C2.textSub, marginBottom: 6,
          textTransform: "uppercase", letterSpacing: 0.5 }}>From</Text>
        <View style={{ backgroundColor: C2.cardLight, borderRadius: 12, padding: 14, marginBottom: 16,
          flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 16 }}>👤</Text>
          <View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: C2.text }}>{profile?.name || "WeGoFit User"}</Text>
            <Text style={{ fontSize: 12, color: C2.textSub }}>{profile?.email || ""}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 12, fontWeight: "600", color: C2.textSub, marginBottom: 6,
          textTransform: "uppercase", letterSpacing: 0.5 }}>Subject</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {SUBJECTS.map(s => (
            <TouchableOpacity key={s} onPress={() => setSubject(s)}
              style={{ backgroundColor: subject === s ? ROSE : C2.cardLight, borderRadius: 20,
                paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
                borderWidth: 1, borderColor: subject === s ? ROSE : C2.border }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: subject === s ? "#FFFFFF" : C2.textSub }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={{ fontSize: 12, fontWeight: "600", color: C2.textSub, marginBottom: 6,
          textTransform: "uppercase", letterSpacing: 0.5 }}>Message</Text>
        <TextInput
          style={{ backgroundColor: C2.cardLight, borderRadius: 16, padding: 16, color: C2.text,
            fontSize: 15, minHeight: 160, textAlignVertical: "top", borderWidth: 1.5, lineHeight: 22,
            borderColor: message.length > 0 ? ROSE : C2.border }}
          placeholder={"Describe your issue or question in detail...\n\nThe more detail you provide the faster we can help you!"}
          placeholderTextColor={C2.textSub}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={1000}
        />
        <Text style={{ fontSize: 11, color: C2.textSub, textAlign: "right", marginTop: 4, marginBottom: 24 }}>
          {message.length}/1000
        </Text>

        <TouchableOpacity onPress={handleSend} disabled={!message.trim() || sending}
          style={{ backgroundColor: message.trim() && !sending ? ROSE : C2.border,
            borderRadius: 16, padding: 18, alignItems: "center", flexDirection: "row",
            justifyContent: "center", gap: 8 }}>
          {sending ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>Sending...</Text>
            </>
          ) : (
            <Text style={{ color: message.trim() ? "#FFFFFF" : C2.textSub, fontSize: 16, fontWeight: "800" }}>
              Send Message 📨
            </Text>
          )}
        </TouchableOpacity>
        <Text style={{ fontSize: 12, color: C2.textSub, textAlign: "center", marginTop: 16, lineHeight: 18 }}>
          🔒 Your message is private and secure. Only Coach TinaBarks has access to support messages.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── LEGAL SCREENS ───────────────────────────────────────────────────────────

function PolicySection({ section, theme, accentColor }) {
  const [expanded, setExpanded] = useState(false);
  const color = accentColor || ROSE;
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 16, marginBottom: 10,
      borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.7}
        style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color + "18",
          alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: color + "30" }}>
          <Text style={{ fontSize: 18 }}>{section.icon}</Text>
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: theme.text }}>{section.title}</Text>
        <Text style={{ fontSize: 20, color: color, transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>›</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text style={{ fontSize: 13, color: theme.textSub, lineHeight: 22, marginTop: 12 }}>
            {section.content}
          </Text>
        </View>
      )}
    </View>
  );
}

function PrivacyPolicyScreen({ onBack, theme }) {
  const sections = [
    { icon: "🛡️", title: "Introduction", content: `WeGoFit ("we", "our", or "us") is operated by Coach TinaBarks and is committed to protecting your personal information and your right to privacy.\n\nThis Privacy Policy explains how we collect, use, and protect your data when you use the WeGoFit mobile application.\n\nBy using WeGoFit, you agree to the collection and use of information in accordance with this policy.\n\nLast updated: May 2026\nEffective date: May 2026` },
    { icon: "📋", title: "Information We Collect", content: `We collect the following types of information:\n\nPERSONAL INFORMATION:\n- Full name and email address\n- Age, gender, height and weight\n- Fitness goals and activity level\n- Profile photos (optional)\n\nHEALTH & FITNESS DATA:\n- Daily calorie and macro intake\n- Food diary entries\n- Exercise sessions and GPS routes\n- Sleep duration and quality\n- Body weight measurements\n- Water intake records\n- Step count data\n\nDEVICE DATA:\n- Device type and operating system\n- GPS location (during workouts only)\n- Motion and fitness sensor data\n- App usage and interaction data\n\nCOMMUNICATION DATA:\n- Messages sent to Coach TinaBarks\n- Support tickets and enquiries` },
    { icon: "🎯", title: "How We Use Your Information", content: `We use your personal data to:\n\n- Provide personalised fitness coaching and nutrition recommendations\n- Calculate your BMR, TDEE and daily calorie targets using the Mifflin-St Jeor formula\n- Generate your weekly meal plans\n- Track your workout progress and verify session authenticity\n- Enable Coach TinaBarks to provide personal coaching and support\n- Send you relevant health tips and motivational messages\n- Improve the WeGoFit app and services\n- Process subscription payments\n- Respond to support enquiries\n- Comply with legal obligations\n\nWe do NOT use your data for:\n- Selling to third parties\n- Advertising or marketing by others\n- Any purpose without your consent` },
    { icon: "🔒", title: "Data Storage & Security", content: `YOUR DATA STAYS ON YOUR DEVICE:\nThe majority of your WeGoFit data is stored locally on your device using AsyncStorage. This means your food logs, workout history, sleep records and personal measurements remain on your phone.\n\nCOACH ACCESS:\nCoach TinaBarks can view your progress data through the WeGoFit Coach Dashboard to provide personalised coaching. This data is accessed securely.\n\nAI FOOD SEARCH:\nWhen you use the AI food search feature, your food queries are sent to OpenAI's API to retrieve nutritional information. Please review OpenAI's privacy policy at openai.com/privacy for details.\n\nSECURITY MEASURES:\n- All data transmission uses HTTPS encryption\n- Passwords are encoded before storage\n- We regularly review our security\n- Access to coaching data is restricted to authorised personnel\n\nDATA RETENTION:\nYour data is retained for as long as your WeGoFit account is active. Upon account deletion, all personal data is permanently removed from our systems within 30 days.` },
    { icon: "📍", title: "Location Data", content: `WeGoFit requests access to your device location ONLY during active GPS workout sessions.\n\nHOW WE USE LOCATION:\n- To track workout routes in real time\n- To calculate distance and speed\n- To verify workout authenticity\n- To display your route on the map\n\nHOW WE DO NOT USE LOCATION:\n- We do not track your location in the background\n- We do not share location data with third parties\n- Location is not used for advertising purposes\n\nYou can revoke location permissions at any time through your device Settings. Note that GPS tracking features will not work without location permission.` },
    { icon: "👨‍👩‍👧", title: "Children's Privacy", content: `WeGoFit is designed for users aged 16 years and older.\n\nWe do not knowingly collect personal information from children under 16. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at:\nsupport@wegofit.app\n\nWe will take immediate steps to delete such information from our systems.` },
    { icon: "🤝", title: "Third Party Services", content: `GoFit uses the following third-party services:\n\nOPENAI (AI Food Search):\n- Purpose: Nutritional data lookup\n- Data shared: Food search queries\n- Their policy: openai.com/privacy\n\nEXPO / REACT NATIVE:\n- Purpose: App development platform\n- Data shared: Crash reports\n- Their policy: expo.dev/privacy\n\nPAYMENT PROCESSORS:\n- Purpose: Subscription billing\n- Data shared: Payment information\n- Note: We never store card details\n\nThese services have their own privacy policies and we encourage you to review them. We are not responsible for the privacy practices of third-party services.` },
    { icon: "⚖️", title: "Your Rights", content: `You have the following rights regarding your personal data:\n\nRIGHT TO ACCESS:\nRequest a copy of all personal data we hold about you.\n\nRIGHT TO CORRECTION:\nUpdate or correct inaccurate personal information at any time through Profile Settings.\n\nRIGHT TO DELETION:\nRequest deletion of your account and all associated data through Profile → Delete Account or by contacting us directly.\n\nRIGHT TO DATA PORTABILITY:\nExport your WeGoFit data through Profile → Export My Data.\n\nRIGHT TO WITHDRAW CONSENT:\nWithdraw consent for data processing at any time by deleting your account.\n\nTO EXERCISE YOUR RIGHTS:\nEmail: support@wegofit.app\nWe will respond within 30 days.` },
    { icon: "📧", title: "Contact Us", content: `For any privacy-related questions, concerns or requests:\n\nCoach TinaBarks\nWeGoFit Fitness App\nEmail: support@wegofit.app\n\nFor support enquiries please use the in-app Contact Support feature in Profile → Contact Support.\n\nWe are committed to resolving any privacy concerns promptly and transparently.` },
    { icon: "🔄", title: "Changes to This Policy", content: `We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational or regulatory reasons.\n\nWhen we make significant changes we will notify you through:\n- An in-app notification\n- A message from Coach TinaBarks\n- Updated "Last updated" date above\n\nYour continued use of WeGoFit after changes become effective constitutes your acceptance of the revised policy.` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ backgroundColor: "#1A1A2E", padding: 20, paddingTop: 50 }}>
        <TouchableOpacity onPress={onBack} style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 6 }}>
          <Text style={{ color: ROSE, fontSize: 16, fontWeight: "600" }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 }}>Privacy Policy 🛡️</Text>
        <Text style={{ fontSize: 13, color: "#FFFFFF60" }}>WeGoFit · Last updated May 2026</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 16, padding: 16, marginBottom: 20,
          borderLeftWidth: 4, borderLeftColor: "#10B981", flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Text style={{ fontSize: 24 }}>💚</Text>
          <Text style={{ flex: 1, fontSize: 13, color: "#10B981", lineHeight: 20 }}>
            Your privacy matters to us. WeGoFit stores most of your health data locally on your device — we believe your health data belongs to you.
          </Text>
        </View>
        {sections.map((section, i) => (
          <PolicySection key={i} section={section} theme={theme} accentColor="#10B981" />
        ))}
        <View style={{ alignItems: "center", marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text style={{ fontSize: 12, color: theme.textSub, textAlign: "center", lineHeight: 18 }}>
            © 2026 WeGoFit · Coach TinaBarks{"\n"}support@wegofit.app{"\n\n"}WeGoFit v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function TermsOfServiceScreen({ onBack, theme }) {
  const sections = [
    { icon: "📜", title: "Agreement to Terms", content: `These Terms of Service ("Terms") govern your use of the WeGoFit mobile application operated by Coach TinaBarks ("WeGoFit", "we", "us", or "our").\n\nBy downloading, installing or using WeGoFit you agree to be bound by these Terms. If you do not agree to these Terms please do not use WeGoFit.\n\nThese Terms apply to all users including free users, paying subscribers and Coach TinaBarks' direct clients.\n\nLast updated: May 2026\nEffective date: May 2026` },
    { icon: "📱", title: "Use of WeGoFit", content: `ELIGIBILITY:\nYou must be at least 16 years old to use WeGoFit. By using WeGoFit you confirm that you meet this age requirement.\n\nACCOUNT REGISTRATION:\n- You are responsible for maintaining the confidentiality of your account credentials\n- You are responsible for all activity under your account\n- You must provide accurate and complete information\n- One account per person only\n- You may not share your account with others\n\nPERMITTED USE:\nWeGoFit is for your personal, non-commercial fitness and nutrition tracking purposes only.\n\nPROHIBITED USE:\nYou may not:\n- Use WeGoFit for any unlawful purpose\n- Attempt to access other users' data\n- Reverse engineer or copy the app\n- Use WeGoFit to harass or harm others\n- Create false or misleading content\n- Attempt to circumvent subscription payments or security features` },
    { icon: "💳", title: "Subscriptions & Payments", content: `SUBSCRIPTION PLANS:\n\nMONTHLY PLAN — $20.00/month\n- Billed monthly\n- Cancel anytime\n- Access to all premium features\n\nANNUAL PLAN — $16.00/month\n- Billed $192.00 annually\n- Save $48 compared to monthly\n- Access to all premium features\n- Priority coach access\n\nFREE PLAN:\n- Limited access to basic features\n- Food and exercise logging\n- No coach chat access\n- No AI meal planning\n\nFREE TRIAL:\n- 7-day free trial available\n- Full premium access during trial\n- Cancel before trial ends to avoid charges\n- One free trial per user\n\nBILLING:\n- Payments processed securely\n- Subscriptions renew automatically\n- You will be notified before renewal\n- We do not store payment card details\n\nCANCELLATION:\n- Cancel anytime through your device's app store subscription settings\n- Cancellation takes effect at end of current billing period\n- No refunds for partial periods unless required by law\n\nREFUNDS:\n- Refund requests considered on a case-by-case basis\n- Contact: support@wegofit.app\n\nVIP ACCESS:\n- Certain accounts may receive complimentary premium access\n- VIP access is granted at our discretion and may be revoked` },
    { icon: "🏋️", title: "Health & Fitness Disclaimer", content: `IMPORTANT — PLEASE READ CAREFULLY:\n\nWeGoFit provides general fitness and nutrition information and tracking tools. WeGoFit is NOT a medical service and Coach TinaBarks is NOT a medical doctor.\n\nTHE INFORMATION IN WEGOFIT:\n- Is for general informational purposes only\n- Is not medical advice\n- Is not a substitute for professional medical consultation\n- Should not be used to diagnose or treat any medical condition\n\nBEFORE STARTING ANY FITNESS PROGRAMME:\n- Consult your doctor especially if you have any medical conditions\n- Inform your doctor of any medications you take\n- Stop exercising immediately if you experience pain, dizziness or discomfort\n- Seek immediate medical attention for any health emergency\n\nCALORIE AND NUTRITION TARGETS:\n- Targets are calculated using standard formulas (Mifflin-St Jeor)\n- Individual results may vary\n- Nutritional needs differ by person\n- These targets are guidelines only\n\nBY USING WEGOFIT YOU ACKNOWLEDGE:\nThat you are voluntarily participating in physical activity and assume all risks associated with such activity.` },
    { icon: "🤖", title: "AI Features", content: `WeGoFit uses artificial intelligence features powered by OpenAI to provide:\n\n- AI food search and nutritional data\n- AI weekly meal plan generation\n- AI coach assistant responses\n- Smart workout recommendations\n\nIMPORTANT ABOUT AI FEATURES:\n- AI responses are generated automatically and may not be perfectly accurate\n- AI meal plans are suggestions only and should be adapted to your individual needs\n- AI coach responses are not a substitute for Coach TinaBarks' personal coaching\n- Always verify nutritional information from trusted sources\n- AI features require an internet connection and an OpenAI API key\n\nACCURACY:\nWhile we strive for accuracy, WeGoFit and its AI features may occasionally provide incorrect nutritional or fitness information. We are not liable for decisions made based on AI-generated content.` },
    { icon: "🏆", title: "Community & Challenges", content: `WEGOFIT SQUAD COMMUNITY:\nBy participating in the WeGoFit community features you agree to:\n\n- Be respectful to all members\n- Not post offensive, harmful or misleading content\n- Not share other users' personal information without consent\n- Not spam or post promotional content\n\nCHALLENGES & LEADERBOARD:\n- Challenge results are based on data logged in WeGoFit\n- WeGoFit uses workout verification to ensure challenge integrity\n- We reserve the right to disqualify entries that appear fraudulent\n- Prizes and rewards are subject to availability and our discretion\n- We may modify or cancel challenges at any time\n\nBADGES & POINTS:\n- WeGoFit points and badges have no monetary value\n- They cannot be transferred or sold\n- We reserve the right to adjust the points system at any time` },
    { icon: "📊", title: "Intellectual Property", content: `WEGOFIT CONTENT:\nAll content in WeGoFit including but not limited to the app design, logo, workout videos, meal plans, text and graphics is owned by WeGoFit and Coach TinaBarks and is protected by intellectual property laws.\n\nYOU MAY NOT:\n- Copy, reproduce or distribute WeGoFit content without permission\n- Use the WeGoFit name or logo without written consent\n- Create derivative works based on WeGoFit content\n- Use WeGoFit content for commercial purposes\n\nYOUR CONTENT:\nContent you create and log in WeGoFit (food diary, workouts, progress) remains your personal property. WeGoFit uses this data only to provide our services to you.` },
    { icon: "⚠️", title: "Limitation of Liability", content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW:\n\nWeGoFit and Coach TinaBarks shall not be liable for:\n\n- Any injury, illness or health complications arising from following WeGoFit recommendations\n- Loss of data due to technical issues\n- Inaccuracies in AI-generated nutritional information\n- Interruption or unavailability of the WeGoFit service\n- Actions of other WeGoFit users\n- Third-party service failures\n\nTOTAL LIABILITY:\nOur total liability to you for any claim shall not exceed the amount you paid to WeGoFit in the 3 months preceding the claim.\n\nINDEMNIFICATION:\nYou agree to indemnify WeGoFit and Coach TinaBarks against any claims, damages or expenses arising from your violation of these Terms.` },
    { icon: "🔚", title: "Termination", content: `WE MAY SUSPEND OR TERMINATE your account if you:\n\n- Violate these Terms of Service\n- Engage in fraudulent activity\n- Attempt to harm other users\n- Misuse the AI or coaching features\n- Provide false information\n- Fail to pay subscription fees\n\nYOU MAY TERMINATE your account at any time through:\nProfile → Account → Delete Account\n\nUpon termination:\n- Your access to WeGoFit will end\n- Your data will be deleted within 30 days as per our Privacy Policy\n- No refunds for unused subscription periods unless required by law\n\nSections of these Terms that by their nature should survive termination will continue to apply.` },
    { icon: "⚖️", title: "Governing Law", content: `These Terms are governed by and construed in accordance with the laws of Uganda and applicable East African community regulations.\n\nAny disputes arising from these Terms or your use of WeGoFit shall be resolved through:\n\n1. Direct communication with Coach TinaBarks first\n2. Mediation if direct resolution fails\n3. Competent courts of Uganda as a last resort\n\nCONTACT FOR DISPUTES:\nsupport@wegofit.app\n\nWe are committed to resolving any issues fairly and promptly.` },
    { icon: "📬", title: "Contact Us", content: `For questions about these Terms of Service:\n\nCoach TinaBarks\nWeGoFit Fitness App\nEmail: support@wegofit.app\n\nFor in-app support:\nProfile → Contact Support\n\nWe aim to respond to all enquiries within 24 hours on business days.\n\nFor urgent matters please mark your email subject as "URGENT — WeGoFit".` },
    { icon: "🔄", title: "Changes to Terms", content: `We reserve the right to modify these Terms at any time.\n\nWhen we make significant changes:\n- We will notify you in-app\n- We will update the effective date\n- Continued use after changes means you accept the new Terms\n\nIf you do not agree to changes you may close your account before the new Terms take effect.\n\nMinor changes (grammar, formatting) may be made without notification.` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ backgroundColor: "#1A1A2E", padding: 20, paddingTop: 50 }}>
        <TouchableOpacity onPress={onBack} style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 6 }}>
          <Text style={{ color: ROSE, fontSize: 16, fontWeight: "600" }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 }}>Terms of Service ⚖️</Text>
        <Text style={{ fontSize: 13, color: "#FFFFFF60" }}>WeGoFit · Last updated May 2026</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 16, padding: 16, marginBottom: 20,
          borderLeftWidth: 4, borderLeftColor: ROSE, flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Text style={{ fontSize: 24 }}>📋</Text>
          <Text style={{ flex: 1, fontSize: 13, color: ROSE, lineHeight: 20 }}>
            Please read these Terms carefully before using WeGoFit. By using the app you agree to be bound by these Terms.
          </Text>
        </View>
        {sections.map((section, i) => (
          <PolicySection key={i} section={section} theme={theme} accentColor={i % 2 === 0 ? ROSE : "#1A1A2E"} />
        ))}
        <View style={{ alignItems: "center", marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text style={{ fontSize: 12, color: theme.textSub, textAlign: "center", lineHeight: 18 }}>
            © 2026 WeGoFit · Coach TinaBarks{"\n"}support@wegofit.app{"\n\n"}These terms were last reviewed by Coach TinaBarks in May 2026.{"\n\n"}WeGoFit v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────
// ─── PROFILE SCREEN ───────────────────────────────────────────────────────────

// Reusable settings row with iOS-style icon chip
function SettingsRow({ iconBg, icon, label, value, onPress, last, hideChevron, valueStyle }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      style={{
        flexDirection: "row", alignItems: "center",
        minHeight: 56, paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(255,255,255,0.06)",
      }}
    >
      <View style={{
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: iconBg || "#1E2837",
        alignItems: "center", justifyContent: "center",
        marginRight: 12,
      }}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <Text style={{ flex: 1, color: "#FFFFFF", fontSize: 15 }}>{label}</Text>
      {value !== undefined && (
        <Text style={[{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginRight: 6 }, valueStyle]}>{value}</Text>
      )}
      {!hideChevron && onPress && (
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 18, lineHeight: 22 }}>›</Text>
      )}
    </TouchableOpacity>
  );
}

// Section wrapper
function SettingsSection({ title, children }) {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700",
        letterSpacing: 1.2, textTransform: "uppercase",
        marginBottom: 8, marginLeft: 4 }}>{title}</Text>
      <View style={{ backgroundColor: "#111827", borderRadius: 16, overflow: "hidden",
        borderWidth: 0.5, borderColor: "rgba(255,255,255,0.06)" }}>
        {children}
      </View>
    </View>
  );
}

// Bottom sheet modal wrapper
function Sheet({ visible, onClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            >
              <View style={{
                backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
                padding: 20, paddingBottom: 36, maxHeight: SH * 0.85,
                borderTopWidth: 0.5, borderColor: "rgba(255,255,255,0.08)",
              }}>
                {/* Drag handle */}
                <View style={{ width: 40, height: 4, borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.18)", alignSelf: "center", marginBottom: 20 }} />
                {children}
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// Achievement badge data
const ACHIEVEMENTS = [
  { id: "a1", icon: "🔥", name: "7-Day Warrior",   desc: "Log food 7 days in a row",                    color: "#FF6B35" },
  { id: "a2", icon: "💧", name: "Hydration Hero",   desc: "Hit your 2.0L water goal 3 days running",     color: "#3B82F6" },
  { id: "a3", icon: "🥗", name: "Clean Eater",      desc: "Log all 4 meals in a single day",             color: "#10B981" },
  { id: "a4", icon: "🏃", name: "First 5K",         desc: "Complete a 5km GPS-tracked run",              color: "#00FF87" },
  { id: "a5", icon: "👑", name: "WeGoFit Pro",      desc: "Upgrade to a WeGoFit Premium plan",           color: "#F59E0B" },
  { id: "a6", icon: "⚡", name: "Speed Demon",      desc: "Reach 15 km/h during a tracked workout",      color: "#FACC15" },
  { id: "a7", icon: "🎯", name: "Goal Crusher",     desc: "Hit your calorie goal 5 days",                color: "#A78BFA" },
  { id: "a8", icon: "📅", name: "30-Day Legend",    desc: "Maintain a 30-day logging streak",            color: "#FB7185" },
  { id: "s1", icon: "🌙", name: "Early Bird",       desc: "Wake before 6 AM 3 days in a row",            color: ROSE      },
  { id: "s2", icon: "😴", name: "Sleep Champion",   desc: "Get 8+ hours of sleep 5 nights in a row",     color: "#8B5CF6" },
  { id: "s3", icon: "💤", name: "Consistent",       desc: "Log your sleep 7 days straight",              color: "#06B6D4" },
  { id: "s4", icon: "🌟", name: "Well Rested",      desc: "Hit the 7h+ sleep goal 14 days in a row",     color: "#F59E0B" },
  { id: "s5", icon: "🧘", name: "Recovery Pro",     desc: "Get 8h sleep the night before a workout",     color: "#10B981" },
];

function ClientChangePwModal({ visible, onClose }) {
  const { profile } = useContext(Ctx);
  const [curPw,    setCurPw]    = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [confPw,   setConfPw]   = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [error,    setError]    = useState("");
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);

  const str     = pwStrengthFull(newPw);
  const match   = newPw && confPw && newPw === confPw;
  const mismatch = confPw.length > 0 && newPw !== confPw;

  function reset() { setCurPw(""); setNewPw(""); setConfPw(""); setError(""); setDone(false); }

  async function handleUpdate() {
    setError("");
    if (!curPw) { setError("Enter your current password."); return; }
    if (!newPw || newPw.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (!match) { setError("New passwords do not match."); return; }
    // Verify current password
    const keys = await AsyncStorage.getAllKeys();
    const profileKeys = keys.filter(k => k.startsWith("gf_profile"));
    let found = false;
    for (const k of profileKeys) {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const prof = JSON.parse(raw);
      if (prof.email && profile?.email && prof.email.toLowerCase() === profile.email.toLowerCase()) {
        if (prof.password !== btoa(curPw)) { setError("Current password is incorrect."); return; }
        setBusy(true);
        prof.password = btoa(newPw);
        await AsyncStorage.setItem(k, JSON.stringify(prof));
        found = true;
        break;
      }
    }
    setBusy(false);
    if (!found) { setError("Could not verify account. Please try again."); return; }
    setDone(true);
    setTimeout(() => { onClose(); reset(); }, 1800);
  }

  const newPwRef  = useRef(null);
  const confPwRef = useRef(null);
  const [focused, setFocused] = useState(null);

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableWithoutFeedback onPress={() => { onClose(); reset(); }} accessible={false}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} />
        </TouchableWithoutFeedback>
        <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 44 : 36, paddingTop: 16, maxHeight: "92%" }}>
          <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2,
            alignSelf: "center", marginBottom: 20 }} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {done ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Text style={{ fontSize: 48 }}>🎉</Text>
                <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 16 }}>Password Updated!</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginTop: 8, textAlign: "center" }}>Your new password is now active.</Text>
              </View>
            ) : (
              <>
                <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 20 }}>🔒 Change Password</Text>
                {error ? (
                  <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginBottom: 14,
                    borderWidth: 1, borderColor: "#FECACA" }}>
                    <Text style={{ color: "#EF4444", fontSize: 13 }}>{error}</Text>
                  </View>
                ) : null}

                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Current Password</Text>
                <View style={{ position: "relative", justifyContent: "center", marginBottom: 14 }}>
                  <TextInput style={[S.input, { paddingRight: 50 }, focused === "cur" && S.inputFocused]}
                    placeholder="Current password" placeholderTextColor="rgba(255,255,255,0.3)"
                    value={curPw} onChangeText={v => { setCurPw(v); setError(""); }}
                    secureTextEntry={!showCur} autoCapitalize="none" autoCorrect={false}
                    returnKeyType="next" onSubmitEditing={() => newPwRef.current?.focus()} blurOnSubmit={false}
                    onFocus={() => setFocused("cur")} onBlur={() => setFocused(null)} />
                  <EyeBtn show={showCur} onToggle={() => setShowCur(v => !v)} />
                </View>

                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>New Password</Text>
                <View style={{ position: "relative", justifyContent: "center", marginBottom: 8 }}>
                  <TextInput ref={newPwRef} style={[S.input, { paddingRight: 50 }, focused === "new" && S.inputFocused]}
                    placeholder="New password" placeholderTextColor="rgba(255,255,255,0.3)"
                    value={newPw} onChangeText={setNewPw}
                    secureTextEntry={!showNew} autoCapitalize="none" autoCorrect={false}
                    returnKeyType="next" onSubmitEditing={() => confPwRef.current?.focus()} blurOnSubmit={false}
                    onFocus={() => setFocused("new")} onBlur={() => setFocused(null)} />
                  <EyeBtn show={showNew} onToggle={() => setShowNew(v => !v)} />
                </View>
                {newPw.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, marginBottom: 4 }}>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: str.color, width: `${str.pct * 100}%` }} />
                    </View>
                    <Text style={{ color: str.color, fontSize: 12, fontWeight: "600" }}>{str.level}</Text>
                  </View>
                )}

                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Confirm New Password</Text>
                <View style={{ position: "relative", justifyContent: "center", marginBottom: 8 }}>
                  <TextInput ref={confPwRef} style={[S.input, { paddingRight: 50 }, focused === "conf" && S.inputFocused]}
                    placeholder="Repeat new password" placeholderTextColor="rgba(255,255,255,0.3)"
                    value={confPw} onChangeText={setConfPw}
                    secureTextEntry={!showConf} autoCapitalize="none" autoCorrect={false}
                    returnKeyType="done" onSubmitEditing={handleUpdate}
                    onFocus={() => setFocused("conf")} onBlur={() => setFocused(null)} />
                  <EyeBtn show={showConf} onToggle={() => setShowConf(v => !v)} />
                </View>
                {confPw.length > 0 && (
                  <Text style={{ color: match ? "#22C55E" : "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 16 }}>
                    {match ? "✅ Passwords match" : "❌ Passwords don't match"}
                  </Text>
                )}

                <TouchableOpacity onPress={handleUpdate} disabled={busy || !match || !curPw}
                  style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 16, alignItems: "center",
                    opacity: busy || !match || !curPw ? 0.5 : 1,
                    shadowColor: ROSE, shadowRadius: 8, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 3 } }}>
                  {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Update Password</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onClose(); reset(); }} style={{ alignItems: "center", marginTop: 16, padding: 8 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ProfileScreen({ navigation }) {
  const { profile, saveProfile, weights, dayLog, sleepHistory, isOnline, isPremium, unlockedBadges, userPoints, mealPlan, deleteAccount } = useContext(Ctx);
  const { logout, session } = useContext(AuthCtx);
  const paywallCtx = useContext(PaywallCtx);
  const { theme } = useTheme();
  const targets = calcTargets(profile);

  // Edit field modal
  const [editField,    setEditField]    = useState(null); // { key, label, keyboard, options }
  const [editValue,    setEditValue]    = useState("");
  const [toast,        setToast]        = useState(null);

  // Account modals
  const [showLogout,   setShowLogout]   = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  // Contact support
  const [showSupport,  setShowSupport]  = useState(false);
  const [showPrivacy,  setShowPrivacy]  = useState(false);
  const [showTerms,    setShowTerms]    = useState(false);

  // Badge grid
  const [badge,        setBadge]        = useState(null);
  const [badgeCat,     setBadgeCat]     = useState("All");

  const [reminders,    setReminders]    = useState(false);
  const [units,        setUnits]        = useState("metric"); // "metric" | "imperial"

  useEffect(() => {
    AsyncStorage.getItem("remindersEnabled").then(val => {
      setReminders(val === "true");
    }).catch(() => {});
  }, []);

  async function handleRemindersToggle(value) {
    try {
      setReminders(value);
      if (value) {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: true,
          },
        });
        console.log("Permission status:", status);
        if (status !== "granted") {
          Alert.alert(
            "🔔 Enable Notifications",
            "WeGoFit needs notification permission to send you daily reminders.\n\nPlease tap Allow when prompted.",
            [{ text: "OK" }]
          );
          setReminders(false);
          return;
        }
        await Notifications.cancelAllScheduledNotificationsAsync();
        // Test notification fires in 5 seconds
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "💪 WeGoFit Reminders Active!",
            body: "Your daily reminders are now on. Coach TinaBarks has got you! 🔥",
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
        });
        // Daily reminders
        await Notifications.scheduleNotificationAsync({
          content: { title: "🌅 Good Morning!", body: "Start strong — log your breakfast!" },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 8, minute: 0 },
        });
        await Notifications.scheduleNotificationAsync({
          content: { title: "🥗 Lunch Time!", body: "Log your lunch. Stay on track!" },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 12, minute: 30 },
        });
        await Notifications.scheduleNotificationAsync({
          content: { title: "🏃 Workout Time!", body: "Coach TinaBarks is waiting. Let's go!" },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 18, minute: 0 },
        });
        await Notifications.scheduleNotificationAsync({
          content: { title: "🌙 Evening Check-in", body: "Log dinner and review your day!" },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 21, minute: 0 },
        });
        await AsyncStorage.setItem("remindersEnabled", "true");
        Alert.alert(
          "✅ Reminders Set!",
          "You will receive daily reminders:\n\n🌅 8:00 AM — Breakfast reminder\n🥗 12:30 PM — Lunch reminder\n🏃 6:00 PM — Workout reminder\n🌙 9:00 PM — Evening check-in\n\nA test notification will arrive in 5 seconds!",
          [{ text: "Got it! 💪" }]
        );
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await AsyncStorage.setItem("remindersEnabled", "false");
        Alert.alert("Reminders Off", "Daily reminders have been cancelled.", [{ text: "OK" }]);
      }
    } catch (error) {
      Alert.alert("Reminder Error", error.message || JSON.stringify(error));
      setReminders(false);
    }
  }

  const { completeOnboarding } = useContext(Ctx);

  // Derived
  const initial      = (profile?.name || "A")[0].toUpperCase();
  const memberSince  = profile?.member_since || todayKey();
  const memberMonth  = new Date(memberSince).toLocaleString("default", { month: "long", year: "numeric" });
  const plan         = profile?.plan || "free";

  const GOAL_LABELS = { lose: "🔥 Losing Weight", gain: "💪 Building Muscle", maintain: "⚖️ Maintaining", fitness: "🏃 Improving Fitness" };
  const ACT_LABELS  = { sedentary: "Sedentary", light: "Light", active: "Active", very: "Very Active" };

  // Streak: count consecutive days with a log entry saved
  // We approximate using the weights array length as a proxy — a real impl would check stored logs
  const streak = weights.length > 0 ? Math.min(weights.length, 99) : 0;

  // Unlocked achievements (simple heuristics)
  function isUnlocked(id) {
    if (id === "a5") return isPremium;
    if (id === "a4") return (dayLog?.exercise || []).some(e => (e.distance_km || 0) >= 5);
    if (id === "s1") {
      // Wake before 6 AM 3 days
      const early = sleepHistory.filter(s => {
        const { h } = parseSleepTime(s.wakeTime);
        return h < 6;
      });
      return early.length >= 3;
    }
    if (id === "s2") {
      // 8+ hours 5 nights in a row — find any 5-consecutive run
      if (sleepHistory.length < 5) return false;
      let run = 0;
      for (const s of sleepHistory) { run = s.duration >= 8 ? run + 1 : 0; if (run >= 5) return true; }
      return false;
    }
    if (id === "s3") return sleepHistory.length >= 7;
    if (id === "s4") {
      // 7h+ goal 14 days in a row
      if (sleepHistory.length < 14) return false;
      const last14 = sleepHistory.slice(-14);
      return last14.every(s => s.duration >= 7);
    }
    if (id === "s5") {
      // 8h sleep day before a workout
      return sleepHistory.some(s => s.duration >= 8);
    }
    return false;
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function openEdit(field) {
    setEditField(field);
    setEditValue(String(profile?.[field.key] || ""));
  }

  async function saveEdit() {
    if (!editField) return;
    let val = editValue.trim();
    if (!val) { setEditField(null); return; }
    // Coerce numeric fields
    if (["age","height_cm","weight_kg","goal_weight_kg"].includes(editField.key)) {
      val = parseFloat(val);
      if (isNaN(val) || val <= 0) { Alert.alert("Invalid value"); return; }
    }
    const updated = { ...profile, [editField.key]: val };
    await saveProfile(updated);
    setEditField(null);
    showToast("Targets updated! ✅");
  }

  async function handleLogout() {
    setShowLogout(false);
    await logout();
  }

  function handleDelete() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your WeGoFit account and all data:\n\n• Profile\n• Food logs\n• Workout history\n• Progress data\n\nThis cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "Your account will be permanently deleted.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteAccount();
                      await logout();
                    } catch (_e) {
                      Alert.alert("Error", "Could not delete account. Please contact support at support@wegofit.app");
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  // Data sync state
  const [lastSynced,     setLastSynced]     = useState(null);
  const [localEntries,   setLocalEntries]   = useState(0);
  const [syncing,        setSyncing]        = useState(false);

  useEffect(() => {
    (async () => {
      const keys = await AsyncStorage.getAllKeys();
      setLocalEntries(keys.length);
      const raw = await AsyncStorage.getItem("gofit_last_synced");
      if (raw) setLastSynced(raw);
    })();
  }, []);

  async function handleForceSync() {
    if (!isOnline) { Alert.alert("Offline", "Cannot sync while offline. Please connect to the internet."); return; }
    setSyncing(true);
    await new Promise(r => setTimeout(r, 1800));
    const now = new Date().toISOString();
    await AsyncStorage.setItem("gofit_last_synced", now);
    setLastSynced(now);
    setSyncing(false);
    showToast("Data synced successfully!");
  }

  // Plan badge config
  const PLAN_BADGE = {
    free:    { label: "FREE",       bg: "#F3F4F6",  text: "#888888" },
    monthly: { label: "⚡ PREMIUM", bg: "#6366F1",  text: "#FFFFFF" },
    annual:  { label: "👑 ANNUAL",  bg: "#B45309",  text: "#FDE68A" },
    vip:     { label: "👑 VIP",     bg: "#B45309",  text: "#FDE68A" },
  };
  const isVIP = isVIPAccount(session?.email || profile?.email);
  const pb = isVIP ? PLAN_BADGE.vip : (PLAN_BADGE[plan] || PLAN_BADGE.free);

  // Full subscription record for active subscriber card
  const [subRecord,      setSubRecord]      = useState(null);
  const [subRecordLoaded, setSubRecordLoaded] = useState(false);
  const [showManageSub,  setShowManageSub]  = useState(false);

  useEffect(() => {
    if (!session?.userId) return;
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session.userId)
        .order("created_at", { ascending: false })
        .limit(4)
        .maybeSingle();
      setSubRecord(data || null);
      setSubRecordLoaded(true);
    })();
  }, [session?.userId]);

  const PROFILE_FIELDS = [
    { key: "name",           icon: "🧑", label: "Full Name",      iconBg: "#DBEAFE", keyboard: "default" },
    { key: "age",            icon: "🎂", label: "Age",            iconBg: "#DBEAFE", keyboard: "numeric" },
    { key: "gender",         icon: "⚥",  label: "Gender",         iconBg: "#DBEAFE", options: ["male","female","other"] },
    { key: "height_cm",      icon: "📏", label: "Height (cm)",    iconBg: "#DBEAFE", keyboard: "decimal-pad" },
    { key: "weight_kg",      icon: "⚖️", label: "Current Weight", iconBg: "#DBEAFE", keyboard: "decimal-pad" },
    { key: "goal_weight_kg", icon: "🎯", label: "Goal Weight",    iconBg: "#DBEAFE", keyboard: "decimal-pad" },
    { key: "activity_level", icon: "🏃", label: "Activity Level", iconBg: "#DBEAFE", options: ["sedentary","light","active","very"] },
    { key: "goal",           icon: "🥅", label: "My Goal",        iconBg: "#DBEAFE", options: ["lose","gain","maintain","fitness"] },
  ];

  function fieldDisplayValue(field) {
    const v = profile?.[field.key];
    if (!v) return "—";
    if (field.key === "gender")         return v.charAt(0).toUpperCase() + v.slice(1);
    if (field.key === "activity_level") return ACT_LABELS[v] || v;
    if (field.key === "goal")           return { lose:"Lose Weight", gain:"Build Muscle", maintain:"Maintain", fitness:"Improve Fitness" }[v] || v;
    if (["height_cm","weight_kg","goal_weight_kg"].includes(field.key)) return `${v} ${units === "metric" ? (field.key === "height_cm" ? "cm" : "kg") : (field.key === "height_cm" ? "ft" : "lbs")}`;
    if (field.key === "age") return `${v} yrs`;
    return String(v);
  }

  return (
    <SafeAreaView style={S.screen}>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── HEADER BANNER ── */}
        <View style={{
          backgroundColor: "#111827",
          paddingTop: 28, paddingBottom: 24,
          alignItems: "center",
          borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.06)",
        }}>
          {/* Logo top-left */}
          <View style={{ position: "absolute", top: 16, left: 16 }}>
            <Image source={LOGO_URI} style={{ width: 160, height: 65, resizeMode: "contain" }} />
          </View>

          {/* Plan badge top-right */}
          <View style={{ position: "absolute", top: 16, right: 16,
            backgroundColor: pb.bg === "#F3F4F6" ? "#1E2837" : pb.bg, borderRadius: 20,
            paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: pb.bg === "#F3F4F6" ? "rgba(255,255,255,0.55)" : pb.text, fontSize: 11, fontWeight: "800" }}>{pb.label}</Text>
          </View>

          {/* Avatar with glow ring */}
          <View style={{ marginBottom: 14 }}>
            <View style={{
              width: 84, height: 84, borderRadius: 42,
              backgroundColor: "#1E2837",
              borderWidth: 3, borderColor: ROSE,
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ color: ROSE, fontSize: 32, fontWeight: "800" }}>{initial}</Text>
            </View>
            {/* Camera badge */}
            <TouchableOpacity
              onPress={() => Alert.alert("Photo picker", "Image picker coming soon!")}
              style={{
                position: "absolute", bottom: 0, right: 0,
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: ROSE, alignItems: "center", justifyContent: "center",
                borderWidth: 2, borderColor: "#111827",
              }}
            >
              <Text style={{ fontSize: 12 }}>📷</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }}>
            {profile?.name || "Athlete"}
          </Text>

          {!!(profile?.email || session?.email) && (
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 2, textAlign: "center" }}>
              {profile?.email || session?.email}
            </Text>
          )}

          {/* Goal pill */}
          <View style={{ backgroundColor: "rgba(255,107,53,0.12)", borderRadius: 20,
            paddingHorizontal: 14, paddingVertical: 5, marginTop: 8,
            borderWidth: 1, borderColor: "rgba(255,107,53,0.25)" }}>
            <Text style={{ color: ROSE, fontSize: 13, fontWeight: "700" }}>
              {GOAL_LABELS[profile?.goal] || "🏃 Getting Fit"}
            </Text>
          </View>

          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 8 }}>
            WeGoFit Member since {memberMonth}
          </Text>
        </View>

        {/* ── STATS ROW ── */}
        <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: 16, marginBottom: 4,
          backgroundColor: "#111827", borderRadius: 16, overflow: "hidden",
          borderWidth: 0.5, borderColor: "rgba(255,255,255,0.06)" }}>
          {[
            { v: targets.calories.toLocaleString(), l: "Cal/day" },
            { v: profile?.weight_kg ? `${profile.weight_kg}kg` : "—", l: "Current" },
            { v: `${streak}d`, l: "Streak" },
          ].map((s, i) => (
            <View key={s.l} style={{ flex: 1, alignItems: "center", paddingVertical: 16,
              borderRightWidth: i < 2 ? StyleSheet.hairlineWidth : 0,
              borderRightColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: ROSE, fontSize: 22, fontWeight: "800" }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* ── HEALTH METRICS (BMI + Calorie Target) ── */}
        {profile?.weight_kg && profile?.height_cm && (
          <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: "#111827",
            borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.06)" }}>
            <Row style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>📊</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Your Health Metrics</Text>
            </Row>

            {/* BMI + Calorie Target tiles */}
            {(() => {
              const bmi      = calcBMI(profile.weight_kg, profile.height_cm);
              const bmiInfo  = getBMICategory(bmi);
              const rangeNote = getCalorieRangeNote(targets.calories, profile.gender, profile.goal, profile.activityLevel);
              const refRange  = getReferenceRange(profile.gender, profile.goal, profile.activityLevel);
              return (
                <>
                  <Row style={{ gap: 10, marginBottom: 14 }}>
                    {/* BMI tile */}
                    <View style={{ flex: 1, backgroundColor: bmiInfo.color + "20", borderRadius: 12,
                      padding: 14, alignItems: "center", borderWidth: 1, borderColor: bmiInfo.color + "40" }}>
                      <Text style={{ color: bmiInfo.color, fontSize: 26, fontWeight: "800" }}>{bmi}</Text>
                      <Text style={{ color: bmiInfo.color, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
                        {bmiInfo.label}
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 }}>BMI Score</Text>
                    </View>
                    {/* Calorie target tile */}
                    <View style={{ flex: 1, backgroundColor: "rgba(255,107,53,0.12)", borderRadius: 12,
                      padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,107,53,0.25)" }}>
                      <Text style={{ color: ROSE, fontSize: 26, fontWeight: "800" }}>
                        {targets.calories.toLocaleString()}
                      </Text>
                      <Text style={{ color: ROSE, fontSize: 12, fontWeight: "700", marginTop: 2 }}>kcal / day</Text>
                      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 }}>Calorie Target</Text>
                    </View>
                  </Row>

                  {/* Reference range — grey info only, no warning */}
                  <View style={{ backgroundColor: "#1E2837", borderRadius: 10, padding: 10, marginBottom: 14 }}>
                    <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                      Reference: {refRange}
                    </Text>
                    <Text style={{ color: rangeNote.color, fontSize: 12, fontWeight: "600", marginTop: 4 }}>
                      {rangeNote.icon} {rangeNote.text}
                    </Text>
                  </View>

                  {/* BMI scale bar */}
                  {(() => {
                    const MAX_BMI = 40;
                    const zones = [
                      { start: 0,    end: 18.5,    color: "#3B82F6", label: "Under"   },
                      { start: 18.5, end: 25,      color: "#10B981", label: "Healthy" },
                      { start: 25,   end: 30,      color: "#F59E0B", label: "Over"    },
                      { start: 30,   end: MAX_BMI, color: "#FB923C", label: "High"    },
                    ];
                    const dotPct = Math.min(bmi / MAX_BMI, 1);
                    return (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 6 }}>BMI Scale</Text>
                        <View style={{ height: 10, borderRadius: 5, flexDirection: "row", overflow: "hidden", marginBottom: 6 }}>
                          {zones.map(z => (
                            <View key={z.label}
                              style={{ flex: (z.end - z.start) / MAX_BMI, backgroundColor: z.color }} />
                          ))}
                        </View>
                        <View style={{ position: "relative", height: 16 }}>
                          <View style={{ position: "absolute", left: `${dotPct * 100}%`,
                            transform: [{ translateX: -6 }] }}>
                            <View style={{ width: 12, height: 12, borderRadius: 6,
                              backgroundColor: bmiInfo.color, borderWidth: 2, borderColor: "#FFF",
                              shadowColor: bmiInfo.color, shadowRadius: 3, shadowOpacity: 0.5 }} />
                          </View>
                        </View>
                        <Row style={{ justifyContent: "space-between", marginTop: 2 }}>
                          {["18.5", "25.0", "30.0", "35+"].map(l => (
                            <Text key={l} style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>{l}</Text>
                          ))}
                        </Row>
                        <Row style={{ justifyContent: "space-between" }}>
                          {zones.map(z => (
                            <Text key={z.label} style={{ color: z.color, fontSize: 9, fontWeight: "600", flex: 1, textAlign: "center" }}>
                              {z.label}
                            </Text>
                          ))}
                        </Row>
                      </View>
                    );
                  })()}

                  {/* Motivational advice */}
                  <View style={{ backgroundColor: bmiInfo.color + "12", borderRadius: 10, padding: 10,
                    borderLeftWidth: 3, borderLeftColor: bmiInfo.color }}>
                    <Text style={{ color: bmiInfo.color, fontSize: 13, fontWeight: "600" }}>
                      {bmiInfo.emoji} {bmiInfo.advice}
                    </Text>
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 8, textAlign: "center" }}>
                    Calculated using Mifflin-St Jeor formula based on your profile
                  </Text>
                </>
              );
            })()}
          </View>
        )}

        {/* ── SECTION 3: NUTRITION TARGETS ── */}
        <SettingsSection title="Nutrition Targets 🥗">
          {[
            { icon: "🔥", label: "Daily Calories",       value: `${targets.calories.toLocaleString()} kcal` },
            { icon: "🥩", label: "Protein Target",       value: `${targets.protein}g` },
            { icon: "🍞", label: "Carbs Target",         value: `${targets.carbs}g` },
            { icon: "🥑", label: "Fat Target",           value: `${targets.fat}g` },
            { icon: "💧", label: "Water Goal",           value: `${targets.waterGoal.toFixed(1)}L daily` },
            { icon: "🔥", label: "Weekly Burn Goal",     value: `${targets.weeklyBurnTarget.toLocaleString()} kcal`, orange: true },
            { icon: "🏋️", label: "Recommended Sessions", value: `${targets.recommendedSessions}x per week · ~${targets.perSessionBurn.toLocaleString()} kcal each`, orange: true },
          ].map((row, i, arr) => (
            <SettingsRow key={row.label} iconBg="#1E2837" icon={row.icon}
              label={row.label} value={row.value}
              valueStyle={row.orange ? { color: "#F97316" } : undefined}
              last={i === arr.length - 1} hideChevron />
          ))}
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 4, marginBottom: 10 }}>
              Calculated using Mifflin-St Jeor formula
            </Text>
            <TouchableOpacity
              onPress={() => showToast("Targets recalculated! ✅")}
              style={{ borderWidth: 1, borderColor: ROSE, borderRadius: 10,
                paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ color: ROSE, fontWeight: "700", fontSize: 14 }}>Recalculate Targets</Text>
            </TouchableOpacity>
          </View>
        </SettingsSection>

        {/* ── MEAL PLAN ROW ── */}
        <SettingsSection title="My Meal Plan 🗓️">
          <TouchableOpacity onPress={() => navigation.navigate("MealPlan")} activeOpacity={0.75}
            style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#1E2837",
              alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Text style={{ fontSize: 18 }}>🗓️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>Weekly Meal Plan</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 1 }}>
                {mealPlan?.weekStart
                  ? `Generated ${new Date(mealPlan.weekStart).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}`
                  : "No plan yet — tap to create"}
              </Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 20 }}>›</Text>
          </TouchableOpacity>
        </SettingsSection>

        <Spacer h={20} />

        {/* ── SECTION 1: MY PLAN ── */}
        <SettingsSection title="My Plan 💎">
          {(() => {
            const COACH_IMG = { uri: "/Coach_TinaBarks.PNG" };

            const FEATURES = [
              { emoji: "👑", title: "Direct Coach TinaBarks Support",
                description: "Message your personal coach anytime. Real guidance, real accountability, real results." },
              { emoji: "🧠", title: "AI Nutrition Planner",
                description: "Know exactly what to eat for YOUR body and YOUR goals. No guessing. No confusion." },
              { emoji: "🔥", title: "Squad Accountability",
                description: "Join a community of people on the same journey. We push each other. We celebrate together." },
              { emoji: "📈", title: "Transformation Tracking",
                description: "See your progress in real time. Every workout, every meal, every win — tracked and celebrated." },
              { emoji: "🏆", title: "Rewards & Streaks",
                description: "Earn badges, build streaks, unlock achievements. Your consistency deserves recognition." },
            ];

            // Hero section with emotional copy + coach
            const HeroBlock = () => (
              <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 16,
                borderLeftWidth: 4, borderLeftColor: ROSE, padding: 20, marginBottom: 20 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 8 }}>
                  Become Your Strongest Self. 💪
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
                  Transform your body. Build better habits.{"\n"}Feel unstoppable every single day.
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Image source={COACH_IMG}
                    style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: ROSE }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 18 }}>
                      Coach TinaBarks personally supports YOUR transformation journey.
                    </Text>
                    <Text style={{ color: ROSE, fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                      Not an algorithm. A real human coach.
                    </Text>
                  </View>
                </View>
              </View>
            );

            // Emotional feature list
            const FeatureList = () => (
              <View style={{ marginBottom: 4 }}>
                {FEATURES.map((f, i) => (
                  <View key={i}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,107,53,0.15)",
                        justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ fontSize: 18 }}>{f.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14, marginBottom: 3 }}>{f.title}</Text>
                        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 18 }}>{f.description}</Text>
                      </View>
                    </View>
                    {i < FEATURES.length - 1 && (
                      <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 4 }} />
                    )}
                  </View>
                ))}
              </View>
            );

            // Social proof quote
            const SocialProof = () => (
              <View style={{ backgroundColor: "#111827", borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <Text style={{ color: ROSE, fontSize: 16, marginBottom: 6 }}>⭐⭐⭐⭐⭐</Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontStyle: "italic", lineHeight: 20, marginBottom: 8 }}>
                  "WeGoFit changed how I see myself. Coach TinaBarks noticed when I skipped a day and sent me a message. I have never felt so supported."
                </Text>
                <Text style={{ color: ROSE, fontSize: 12, fontWeight: "600" }}>
                  — Sarah K., lost 8kg in 3 months 🇺🇬
                </Text>
              </View>
            );

            // Urgency + pricing
            const PricingCards = ({ daysLeft }) => (
              <>
                {daysLeft != null && (
                  <Text style={{ color: ROSE, fontSize: 13, fontWeight: "700", textAlign: "center", marginBottom: 6 }}>
                    🔥 Your free trial ends in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                  </Text>
                )}
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center", marginBottom: 16 }}>
                  Join 500+ members already transforming with Coach TinaBarks
                </Text>
                {/* Annual */}
                <TouchableOpacity onPress={paywallCtx.openPaywall}
                  style={{ backgroundColor: ROSE, borderRadius: 14, padding: 16, marginBottom: 10,
                    flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Annual Plan 🏆</Text>
                    <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>$192/year · Save 20% · Best Value</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 18 }}>$16/mo</Text>
                    <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10 }}>≈ UGX 58,400/mo</Text>
                    <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10,
                      paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>MOST POPULAR</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {/* Monthly */}
                <TouchableOpacity onPress={paywallCtx.openPaywall}
                  style={{ backgroundColor: "#1E2837", borderColor: ROSE, borderWidth: 1,
                    borderRadius: 14, padding: 16, marginBottom: 16,
                    flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Monthly Plan</Text>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Flexible · Cancel anytime</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: ROSE, fontWeight: "700", fontSize: 18 }}>$20/mo</Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>≈ UGX 73,000/mo</Text>
                  </View>
                </TouchableOpacity>
                {/* Trust footer */}
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", textAlign: "center" }}>
                  🔒 Secure Payment
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center", marginTop: 4 }}>
                  MTN Mobile Money · Airtel Money · Visa · Mastercard
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center", marginTop: 6 }}>
                  Cancel anytime · No hidden fees · Your data is always private.
                </Text>
              </>
            );

            // VIP or active paid subscriber
            if (isVIP || isPremium || paywallCtx.subStatus === "active") {
              const activePlan = subRecord?.plan || plan;
              const isAnnual   = activePlan === "annual";
              const fmt = (iso) => iso
                ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : null;
              // Prefer stored next_billing_date; fall back to computing from paid_at, then updated_at
              const nextBilling = fmt(subRecord?.next_billing_date) || (() => {
                const ref = subRecord?.paid_at || subRecord?.updated_at;
                if (!ref) return null;
                const d = new Date(ref);
                d.setMonth(d.getMonth() + (isAnnual ? 12 : 1));
                return fmt(d.toISOString());
              })();
              const lastPayment = fmt(subRecord?.paid_at);
              return (
                <View style={{ padding: 16 }}>
                  <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 20 }}>
                    {/* Header */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>My Subscription</Text>
                      <View style={{ backgroundColor: isVIP ? "rgba(253,230,138,0.15)" : "rgba(34,197,94,0.15)",
                        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                        <Text style={{ color: isVIP ? "#FDE68A" : "#22C55E", fontSize: 12, fontWeight: "700" }}>
                          {isVIP ? "VIP" : (isAnnual ? "ANNUAL" : "MONTHLY")}
                        </Text>
                      </View>
                    </View>
                    {/* Plan detail */}
                    <View style={{ backgroundColor: "#1E2837", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                      <Text style={{ color: isVIP ? "#FDE68A" : ROSE, fontWeight: "800", fontSize: 15, marginBottom: 4 }}>
                        {isVIP ? "👑 VIP Access" : (isAnnual ? "👑 WeGoFit Annual" : "⚡ WeGoFit Monthly")}
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                        {isVIP ? "Full premium access · Complimentary"
                          : isAnnual ? "$16/month (UGX 58,400) · Billed $192/year"
                          : "$20/month (UGX 73,000) · Billed monthly"}
                      </Text>
                      {!isVIP && lastPayment && (
                        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 4 }}>
                          Last payment: {lastPayment}
                        </Text>
                      )}
                      {!isVIP && nextBilling && (
                        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>
                          Next billing: {nextBilling}
                        </Text>
                      )}
                    </View>
                    {/* Payment method */}
                    {!isVIP && subRecord?.currency && (
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                        <View style={{ backgroundColor: "#1E2837", borderRadius: 8, paddingHorizontal: 10,
                          paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ fontSize: 16 }}>💳</Text>
                          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                            Paid via Pesapal · {subRecord.currency}
                          </Text>
                        </View>
                      </View>
                    )}
                    {/* Manage button */}
                    {!isVIP && (
                      <TouchableOpacity onPress={() => setShowManageSub(true)}
                        style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
                          borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 14 }}>
                        <Text style={{ color: "rgba(255,255,255,0.7)", fontWeight: "600", fontSize: 14 }}>
                          Manage Subscription
                        </Text>
                      </TouchableOpacity>
                    )}
                    {/* Manage modal */}
                    <Modal visible={showManageSub} transparent animationType="slide"
                      onRequestClose={() => setShowManageSub(false)}>
                      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
                        <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
                          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 20, textAlign: "center" }}>
                            Manage Subscription
                          </Text>
                          {!isAnnual && (
                            <TouchableOpacity onPress={() => { setShowManageSub(false); paywallCtx.openPaywall(); }}
                              style={{ backgroundColor: ROSE, borderRadius: 14, padding: 16,
                                flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                              <View>
                                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Switch to Annual 🏆</Text>
                                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Save 20% · $16/mo (UGX 58,400)</Text>
                              </View>
                              <Text style={{ color: "#FFFFFF", fontSize: 20 }}>›</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity onPress={() => {
                            setShowManageSub(false);
                            Alert.alert(
                              "Cancel Subscription",
                              "To cancel your subscription, please contact support at support@wegofit.app",
                              [{ text: "OK" }]
                            );
                          }}
                            style={{ backgroundColor: "#1E2837", borderRadius: 14, padding: 16,
                              alignItems: "center", marginBottom: 12 }}>
                            <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 15 }}>Cancel Subscription</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setShowManageSub(false)}
                            style={{ padding: 12, alignItems: "center" }}>
                            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Close</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Modal>
                  </View>
                </View>
              );
            }

            // Active trial
            if (paywallCtx.subStatus === "trial") {
              const dLeft = Math.max(0, 7 - paywallCtx.trialDays);
              const progress = Math.min(1, (7 - dLeft) / 7);
              return (
                <View style={{ padding: 16 }}>
                  <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 20 }}>
                    {/* Badge row */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>My Subscription</Text>
                      <View style={{ backgroundColor: "rgba(255,107,53,0.2)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                        <Text style={{ color: ROSE, fontSize: 12, fontWeight: "700" }}>FREE TRIAL</Text>
                      </View>
                    </View>
                    {/* Trial progress bar */}
                    <View style={{ backgroundColor: "#1E2837", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 8 }}>Trial Progress</Text>
                      <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, marginBottom: 6 }}>
                        <View style={{ height: 6, backgroundColor: ROSE, borderRadius: 3, width: `${progress * 100}%` }} />
                      </View>
                      <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600" }}>
                        {dLeft} day{dLeft !== 1 ? "s" : ""} remaining of your 7-day free trial
                      </Text>
                    </View>
                    <HeroBlock />
                    <FeatureList />
                    <SocialProof />
                    <PricingCards daysLeft={dLeft} />
                  </View>
                </View>
              );
            }

            // Expired trial
            if (paywallCtx.subStatus === "expired_trial") {
              return (
                <View style={{ padding: 16 }}>
                  <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 20 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>My Subscription</Text>
                      <View style={{ backgroundColor: "rgba(239,68,68,0.2)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                        <Text style={{ color: "#EF4444", fontSize: 12, fontWeight: "700" }}>EXPIRED</Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 12, padding: 14, marginBottom: 20,
                      borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" }}>
                      <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 14, marginBottom: 4 }}>Your trial has ended</Text>
                      <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 19 }}>
                        Subscribe now to keep your progress and unlock all premium features.
                      </Text>
                    </View>
                    <HeroBlock />
                    <FeatureList />
                    <SocialProof />
                    <PricingCards daysLeft={null} />
                  </View>
                </View>
              );
            }

            // No trial yet
            return (
              <View style={{ padding: 16 }}>
                <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 20 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>My Subscription</Text>
                    <View style={{ backgroundColor: "rgba(255,107,53,0.2)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                      <Text style={{ color: ROSE, fontSize: 12, fontWeight: "700" }}>FREE TRIAL</Text>
                    </View>
                  </View>
                  <HeroBlock />
                  <FeatureList />
                  <SocialProof />
                  <PricingCards daysLeft={null} />
                </View>
              </View>
            );
          })()}
        </SettingsSection>

        {/* ── BADGE GRID ── */}
        <View style={{ marginTop: 20, marginBottom: 4 }}>
          {/* Milestone header */}
          {(() => {
            const pts = userPoints || 0;
            const milestone = MILESTONE_LEVELS.slice().reverse().find(m => pts >= m.min) || MILESTONE_LEVELS[0];
            const nextMilestone = MILESTONE_LEVELS.find(m => m.min > pts);
            const progressPct = nextMilestone
              ? Math.min(((pts - milestone.min) / (nextMilestone.min - milestone.min)) * 100, 100)
              : 100;
            return (
              <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: "#111827",
                borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.06)" }}>

                {/* Title row */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "800", letterSpacing: 0.3 }}>Badges & Rewards 🏅</Text>
                  <View style={{ backgroundColor: ROSE + "25", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: ROSE + "60" }}>
                    <Text style={{ color: ROSE, fontSize: 12, fontWeight: "800" }}>
                      {unlockedBadges.length}/{BADGES.length}
                    </Text>
                  </View>
                </View>

                {/* Current milestone pill */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12,
                  backgroundColor: milestone.color + "18", borderRadius: 12, padding: 10,
                  borderWidth: 1, borderColor: milestone.color + "40" }}>
                  <Text style={{ fontSize: 26 }}>{milestone.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <Text style={{ color: milestone.color, fontSize: 14, fontWeight: "800" }}>{milestone.level}</Text>
                      <Text style={{ color: "#666", fontSize: 11 }}>·</Text>
                      <Text style={{ color: "#CCC", fontSize: 11 }}>{milestone.tagline}</Text>
                    </View>
                    <Text style={{ color: "#666", fontSize: 10 }} numberOfLines={1}>{milestone.perk}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: milestone.color, fontSize: 20, fontWeight: "800" }}>{pts}</Text>
                    <Text style={{ color: "#666", fontSize: 9 }}>pts</Text>
                  </View>
                </View>

                {/* Progress toward next milestone */}
                {nextMilestone ? (
                  <>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                      <Text style={{ color: "#888", fontSize: 10 }}>
                        {"Next: "}
                        <Text style={{ color: nextMilestone.color, fontWeight: "700" }}>{nextMilestone.emoji} {nextMilestone.level}</Text>
                      </Text>
                      <Text style={{ color: "#888", fontSize: 10 }}>
                        <Text style={{ color: "#CCC", fontWeight: "700" }}>{nextMilestone.min - pts}</Text>{" pts to go"}
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: "#2A2A3E", borderRadius: 3, overflow: "hidden" }}>
                      <View style={{ height: "100%", width: `${progressPct}%`,
                        backgroundColor: milestone.color, borderRadius: 3 }} />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                      <Text style={{ color: "#FFD700", fontSize: 10, fontWeight: "700" }}>Max level reached! 🎉</Text>
                      <Text style={{ color: "#888", fontSize: 10 }}>{pts}/1170 pts</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: "#2A2A3E", borderRadius: 3, overflow: "hidden" }}>
                      <View style={{ height: "100%", width: "100%",
                        backgroundColor: "#FFD700", borderRadius: 3 }} />
                    </View>
                  </>
                )}
              </View>
            );
          })()}

          {/* Badge grouped display */}
          {(() => {
            const BADGE_GROUPS = [
              { key: "starter",   label: "🚀 Getting Started" },
              { key: "nutrition", label: "🥗 Nutrition"        },
              { key: "hydration", label: "💧 Hydration"        },
              { key: "fitness",   label: "🏃 Fitness"          },
              { key: "streak",    label: "🔥 Consistency"      },
              { key: "weight",    label: "⚖️ Weight Loss"      },
              { key: "legend",    label: "👑 Elite"            },
            ];
            return (
              <View style={{ marginHorizontal: 16, backgroundColor: "#111827", borderRadius: 20, padding: 16,
                borderWidth: 0.5, borderColor: "rgba(255,255,255,0.06)" }}>
                {BADGE_GROUPS.map((group, gi) => {
                  const groupBadges = BADGES.filter(b => b.category === group.key);
                  const rows = [];
                  for (let i = 0; i < groupBadges.length; i += 3) rows.push(groupBadges.slice(i, i + 3));
                  return (
                    <View key={group.key} style={{ marginBottom: gi < BADGE_GROUPS.length - 1 ? 24 : 0 }}>
                      {/* Category header */}
                      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800", letterSpacing: 0.5,
                        marginBottom: 10, paddingBottom: 8,
                        borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
                        {group.label}
                      </Text>
                      {rows.map((row, ri) => (
                        <View key={ri} style={{ flexDirection: "row", gap: 10, marginBottom: ri < rows.length - 1 ? 10 : 0 }}>
                          {row.map(b => {
                            const unlocked = unlockedBadges.includes(b.id);
                            const rarity = RARITY_CONFIG[b.rarity] || RARITY_CONFIG.common;
                            return (
                              <TouchableOpacity key={b.id} onPress={() => setBadge(b)}
                                activeOpacity={0.85}
                                style={{ flex: 1, alignItems: "center", minHeight: 140,
                                  backgroundColor: unlocked ? rarity.cardBg : "#1A1A2E",
                                  borderRadius: 16, padding: 12,
                                  borderWidth: 1, borderColor: unlocked ? rarity.border : "#2A2A3E",
                                  opacity: unlocked ? 1 : 0.6,
                                  ...(unlocked ? {
                                    shadowColor: rarity.color,
                                    shadowRadius: rarity.glowRadius,
                                    shadowOpacity: 0.4,
                                    shadowOffset: { width: 0, height: 0 }
                                  } : {}) }}>

                                {/* Icon area */}
                                <View style={{ width: 56, height: 56, borderRadius: 14,
                                  backgroundColor: unlocked ? rarity.iconBg : "#222233",
                                  alignItems: "center", justifyContent: "center",
                                  marginBottom: 8,
                                  borderWidth: unlocked ? 1 : 0,
                                  borderColor: unlocked ? rarity.border : "transparent" }}>
                                  {unlocked ? (
                                    <Text style={{ fontSize: 28 }}>{b.icon}</Text>
                                  ) : (
                                    <>
                                      <Text style={{ fontSize: 22, opacity: 0.15 }}>{b.icon}</Text>
                                      <View style={{ position: "absolute" }}>
                                        <Text style={{ fontSize: 22, color: "#444" }}>🔒</Text>
                                      </View>
                                    </>
                                  )}
                                </View>

                                {!unlocked && (
                                  <Text style={{ color: "#555", fontSize: 8, fontWeight: "800",
                                    letterSpacing: 1.2, marginBottom: 4 }}>LOCKED</Text>
                                )}

                                {/* Badge name */}
                                <Text style={{ color: unlocked ? "#FFFFFF" : "#666", fontSize: 10, fontWeight: "700",
                                  textAlign: "center", lineHeight: 13, marginBottom: 4 }}
                                  numberOfLines={2}>
                                  {b.name}
                                </Text>

                                {/* Rarity label */}
                                <Text style={{ color: unlocked ? rarity.rarityColor : "#444", fontSize: 8, fontWeight: "800",
                                  letterSpacing: 0.8 }}>
                                  {rarity.label}
                                </Text>

                                {/* Unlocked dot indicator */}
                                {unlocked && (
                                  <View style={{ position: "absolute", top: 8, right: 8,
                                    width: 8, height: 8, borderRadius: 4,
                                    backgroundColor: rarity.color,
                                    shadowColor: rarity.color, shadowRadius: 4, shadowOpacity: 0.8 }} />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                          {row.length < 3 && Array(3 - row.length).fill(0).map((_, i) => (
                            <View key={i} style={{ flex: 1 }} />
                          ))}
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </View>

        {/* Badge detail modal */}
        {badge && (
          <Modal visible={!!badge} transparent animationType="fade">
            <TouchableWithoutFeedback onPress={() => setBadge(null)}>
              <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 32 }}>
                <TouchableWithoutFeedback>
                  {(() => {
                    const unlocked = unlockedBadges.includes(badge.id);
                    const rarity = RARITY_CONFIG[badge.rarity] || RARITY_CONFIG.common;
                    return (
                      <View style={{ backgroundColor: rarity.cardBg, borderRadius: 24, padding: 28,
                        alignItems: "center", width: "100%",
                        borderWidth: 1.5, borderColor: rarity.border,
                        shadowColor: rarity.color, shadowRadius: 24, shadowOpacity: 0.5, shadowOffset: { width: 0, height: 0 } }}>
                        <View style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: rarity.iconBg,
                          alignItems: "center", justifyContent: "center", marginBottom: 16,
                          borderWidth: 2, borderColor: rarity.border }}>
                          <Text style={{ fontSize: 48, opacity: unlocked ? 1 : 0.3 }}>{badge.icon}</Text>
                        </View>
                        <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>{badge.name}</Text>
                        <View style={{ backgroundColor: rarity.color + "30", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 14,
                          borderWidth: 1, borderColor: rarity.color + "60" }}>
                          <Text style={{ color: rarity.rarityColor, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{rarity.label} · {badge.points} pts</Text>
                        </View>
                        <Text style={{ color: "#AAA", fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 10 }}>{badge.desc}</Text>
                        {!unlocked && (
                          <View style={{ backgroundColor: "#1A1A1A", borderRadius: 10, padding: 10, marginBottom: 8, width: "100%" }}>
                            <Text style={{ color: "#666", fontSize: 11, textAlign: "center" }}>How to earn: {badge.how}</Text>
                          </View>
                        )}
                        {unlocked && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <Text style={{ color: "#10B981", fontSize: 14, fontWeight: "800" }}>✓ Earned!</Text>
                          </View>
                        )}
                        <TouchableOpacity onPress={() => setBadge(null)}
                          style={{ marginTop: 16, backgroundColor: ROSE, borderRadius: 14,
                            paddingHorizontal: 36, paddingVertical: 12 }}>
                          <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 14 }}>Close</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}

        {/* ── SECTION 2: MY PROFILE ── */}
        <SettingsSection title="My Profile 👤">
          <SettingsRow
            iconBg="#1E2837"
            icon="📧"
            label="Login Email"
            value={profile?.email || session?.email || "No email found"}
            hideChevron
          />
          {PROFILE_FIELDS.map((field, i) => (
            <SettingsRow
              key={field.key}
              iconBg="#1E2837"
              icon={field.icon}
              label={field.label}
              value={fieldDisplayValue(field)}
              onPress={() => openEdit(field)}
              last={i === PROFILE_FIELDS.length - 1}
            />
          ))}
        </SettingsSection>

        {/* ── SECTION 5: COACH & SUPPORT ── */}
        <SettingsSection title="Coach & Support 💬">
          {[
            { icon: "💬", label: "Message Coach TinaBarks",
              onPress: () => navigation?.navigate("Coach") },
            { icon: "⭐", label: "Rate WeGoFit",
              onPress: () => Alert.alert("Rate Us", "Thank you! Rating opens App Store.") },
            { icon: "📧", label: "Contact Support",
              onPress: () => setShowSupport(true) },
            { icon: "📜", label: "Privacy Policy",
              onPress: () => setShowPrivacy(true) },
            { icon: "📋", label: "Terms of Service",
              onPress: () => setShowTerms(true), last: true },
          ].map((row, i, arr) => (
            <SettingsRow key={row.label} iconBg="#1E2837" icon={row.icon}
              label={row.label} onPress={row.onPress} last={row.last} />
          ))}
        </SettingsSection>

        {/* ── SECTION 4: PREFERENCES ── */}
        <SettingsSection title="App Preferences ⚙️">
          <View style={{ flexDirection: "row", alignItems: "center", minHeight: 56,
            paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#1E2837",
              alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Text style={{ fontSize: 16 }}>🔔</Text>
            </View>
            <Text style={{ flex: 1, color: "#FFFFFF", fontSize: 15 }}>Reminders</Text>
            <Switch
              value={reminders}
              onValueChange={handleRemindersToggle}
              trackColor={{ false: "rgba(255,255,255,0.1)", true: ROSE }}
              thumbColor={reminders ? "#ffffff" : "#f4f3f4"}
              ios_backgroundColor="rgba(255,255,255,0.1)"
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: 16,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#1E2837",
              alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Text style={{ fontSize: 16 }}>📊</Text>
            </View>
            <Text style={{ flex: 1, color: "#FFFFFF", fontSize: 15 }}>Units</Text>
            <Row style={{ gap: 6 }}>
              {["metric","imperial"].map(u => (
                <TouchableOpacity key={u} onPress={() => setUnits(u)}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                    backgroundColor: units === u ? ROSE : "#1E2837" }}>
                  <Text style={{ color: units === u ? "#FFFFFF" : "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700" }}>
                    {u === "metric" ? "kg/cm" : "lbs/ft"}
                  </Text>
                </TouchableOpacity>
              ))}
            </Row>
          </View>

          <SettingsRow iconBg="#1E2837" icon="🌍" label="Language" value="English" last hideChevron />
        </SettingsSection>

        {/* ── SECTION 6: DATA SYNC ── */}
        <SettingsSection title="Data Sync">
          <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <Row style={{ marginBottom: 12 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5,
                backgroundColor: isOnline ? "#10B981" : "#F59E0B", marginRight: 8, marginTop: 2 }} />
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
                {isOnline ? "Connected" : "Offline"}
              </Text>
            </Row>
            <Row style={{ gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 12 }}>
                <Text style={{ color: ROSE, fontWeight: "800", fontSize: 18 }}>{localEntries}</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>Local records</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 12 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }} numberOfLines={2}>
                  {lastSynced
                    ? new Date(lastSynced).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "Never synced"}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>Last synced</Text>
              </View>
            </Row>
            {!isOnline && (
              <View style={{ backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 10, padding: 10, marginBottom: 12,
                borderWidth: 1, borderColor: "rgba(245,158,11,0.25)" }}>
                <Text style={{ color: "#F59E0B", fontSize: 12 }}>
                  You are offline. Your data is saved locally and will sync when you reconnect.
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleForceSync}
              disabled={syncing || !isOnline}
              style={{ borderWidth: 1, borderColor: isOnline ? ROSE : "rgba(255,255,255,0.2)", borderRadius: 10,
                paddingVertical: 10, alignItems: "center", opacity: (!isOnline || syncing) ? 0.5 : 1 }}>
              <Text style={{ color: isOnline ? ROSE : "rgba(255,255,255,0.2)", fontWeight: "700", fontSize: 14 }}>
                {syncing ? "Syncing..." : "Force Sync Now"}
              </Text>
            </TouchableOpacity>
          </View>
        </SettingsSection>

        {/* ── SECTION 7: ACCOUNT ── */}
        <SettingsSection title="Account">
          <SettingsRow iconBg="#1E2837" icon="🔐" label="Change Password"
            onPress={() => setShowChangePw(true)} />
          <SettingsRow iconBg="#1E2837" icon="📤" label="Export My Data"
            onPress={async () => {
              const keys = await AsyncStorage.getAllKeys();
              const entries = await AsyncStorage.multiGet(keys);
              Alert.alert("Data Export", `${keys.length} records ready for export.`);
            }} last />
        </SettingsSection>

        {/* Log out / Delete */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <TouchableOpacity onPress={() => setShowLogout(true)}
            style={{ paddingVertical: 12, paddingHorizontal: 48, borderRadius: 14,
              backgroundColor: "#1E2837", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>Log Out</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete}
            style={{ paddingVertical: 10, paddingHorizontal: 32, marginTop: 12 }}>
            <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "500" }}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* Version footer */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>WeGoFit v1.0.0</Text>
          <Text style={{ color: "rgba(255,255,255,0.15)", fontSize: 11, marginTop: 2 }}>© 2026 WeGoFit. All rights reserved.</Text>
        </View>

      </ScrollView>

      {/* ── TOAST ── */}
      {toast && (
        <View style={{ position: "absolute", bottom: 80, alignSelf: "center",
          backgroundColor: "#111827", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
          borderWidth: 1, borderColor: ROSE }}>
          <Text style={{ color: ROSE, fontWeight: "700", fontSize: 14 }}>{toast}</Text>
        </View>
      )}

      {/* ── EDIT FIELD SHEET ── */}
      <Sheet visible={!!editField} onClose={() => setEditField(null)}>
        {editField && (
          <View>
            <Text style={[S.heading, { marginBottom: 16 }]}>Edit {editField.label}</Text>
            {editField.options ? (
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                {editField.options.map(opt => {
                  const OPTION_LABELS = {
                    male: "Male", female: "Female", other: "Other",
                    sedentary: "Sedentary", light: "Light", active: "Active", very: "Very Active",
                    lose: "Lose Weight", gain: "Build Muscle", maintain: "Maintain Weight", fitness: "Improve Fitness",
                  };
                  return (
                    <TouchableOpacity key={opt} onPress={() => setEditValue(opt)} activeOpacity={0.7}
                      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14,
                        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.cardLight,
                        paddingHorizontal: 4 }}>
                      <Text style={{ flex: 1, color: C.text, fontSize: 15 }}>{OPTION_LABELS[opt] || opt}</Text>
                      {editValue === opt && <Text style={{ color: C.green, fontSize: 18 }}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <TextInput
                style={[S.input, { marginBottom: 4 }]}
                value={editValue}
                onChangeText={setEditValue}
                keyboardType={editField.keyboard || "default"}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveEdit}
                blurOnSubmit={true}
                placeholder={`Enter ${editField.label.toLowerCase()}`}
                placeholderTextColor={C.grey}
              />
            )}
            <Spacer h={16} />
            <PrimaryBtn label="Save" onPress={saveEdit} />
            <TouchableOpacity onPress={() => setEditField(null)} style={{ alignItems: "center", marginTop: 12 }}>
              <Text style={{ color: C.grey, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </Sheet>

      {/* ── BADGE MODAL ── */}
      <Sheet visible={!!badge} onClose={() => setBadge(null)}>
        {badge && (
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>{badge.icon}</Text>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 6 }}>{badge.name}</Text>
            <Text style={{ color: C.grey, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 16 }}>{badge.desc}</Text>
            {isUnlocked(badge.id)
              ? <View style={{ backgroundColor: "rgba(0,255,135,0.12)", borderRadius: 20,
                  paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: C.green }}>
                  <Text style={{ color: C.green, fontWeight: "700" }}>Unlocked ✅</Text>
                </View>
              : <View style={{ backgroundColor: C.cardLight, borderRadius: 20,
                  paddingHorizontal: 16, paddingVertical: 6 }}>
                  <Text style={{ color: C.grey, fontWeight: "600" }}>🔒 Locked</Text>
                </View>
            }
          </View>
        )}
      </Sheet>

      {/* ── LOG OUT SHEET ── */}
      <Sheet visible={showLogout} onClose={() => setShowLogout(false)}>
        <Text style={[S.heading, { textAlign: "center", marginBottom: 8 }]}>Log out of WeGoFit?</Text>
        <Text style={{ color: C.grey, textAlign: "center", fontSize: 14, marginBottom: 24, lineHeight: 20 }}>
          Your data will be saved and ready when you return.
        </Text>
        <PrimaryBtn label="Log Out" onPress={handleLogout} style={{ backgroundColor: C.greyDim }} />
        <TouchableOpacity onPress={() => setShowLogout(false)} style={{ alignItems: "center", marginTop: 12 }}>
          <Text style={{ color: C.grey, fontSize: 15 }}>Cancel</Text>
        </TouchableOpacity>
      </Sheet>

      {/* ── CHANGE PASSWORD MODAL ── */}
      <ClientChangePwModal visible={showChangePw} onClose={() => setShowChangePw(false)} />

      {/* ── CONTACT SUPPORT MODAL ── */}
      <Modal visible={showSupport} animationType="slide" onRequestClose={() => setShowSupport(false)}>
        <ContactSupportScreen onBack={() => setShowSupport(false)} />
      </Modal>

      {/* ── PRIVACY POLICY MODAL ── */}
      <Modal visible={showPrivacy} animationType="slide" onRequestClose={() => setShowPrivacy(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#1A1A2E" }}>
          <PrivacyPolicyScreen onBack={() => setShowPrivacy(false)} theme={theme} />
        </SafeAreaView>
      </Modal>

      {/* ── TERMS OF SERVICE MODAL ── */}
      <Modal visible={showTerms} animationType="slide" onRequestClose={() => setShowTerms(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#1A1A2E" }}>
          <TermsOfServiceScreen onBack={() => setShowTerms(false)} theme={theme} />
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── SLEEP SCREEN ─────────────────────────────────────────────────────────────

const SLEEP_TIPS = [
  { icon: "📵", text: "No screens 1 hour before bed" },
  { icon: "🌡️", text: "Keep bedroom cool (18–20°C)" },
  { icon: "☕", text: "No caffeine after 2 PM" },
  { icon: "🧘", text: "Try 5-min meditation before bed" },
  { icon: "💧", text: "Stay hydrated throughout the day" },
  { icon: "🏃", text: "Exercise improves sleep quality" },
  { icon: "⏰", text: "Wake up at the same time daily" },
];

// Inline time input component — simple HH:MM text field with helpers
// ─── NATIVE TIME PICKER ───────────────────────────────────────────────────────
const ITEM_H = 52;
const VISIBLE = 5; // rows visible in the wheel

function WheelColumn({ items, selectedIndex, onSelect, width = 80 }) {
  const scrollRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Scroll to selected on mount and when selectedIndex changes
  useEffect(() => {
    if (scrollRef.current && ready) {
      scrollRef.current.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }
  }, [selectedIndex, ready]);

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: "hidden" }}>
      {/* Selection highlight bar */}
      <View pointerEvents="none" style={{
        position: "absolute", top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H,
        borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: ROSE,
        backgroundColor: "rgba(244,63,142,0.06)", zIndex: 2,
      }} />
      {/* Fade top */}
      <View pointerEvents="none" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H * 1.5,
        zIndex: 1,
        backgroundColor: "transparent",
      }} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onLayout={() => {
          setReady(true);
          setTimeout(() => {
            scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
          }, 0);
        }}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          onSelect(Math.max(0, Math.min(idx, items.length - 1)));
        }}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        style={{ flex: 1 }}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              onSelect(i);
              scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true });
            }}
            style={{ height: ITEM_H, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{
              fontSize: 22, fontWeight: i === selectedIndex ? "800" : "400",
              color: i === selectedIndex ? ROSE : "#888",
              opacity: Math.abs(i - selectedIndex) > 2 ? 0.3 : 1,
            }}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const HOURS_12   = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i).padStart(2, "0"));
const MINUTES_30 = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const AMPM       = ["AM", "PM"];

function parse24ToWheel(hhmm) {
  const [hStr, mStr] = (hhmm || "00:00").split(":");
  let h = parseInt(hStr, 10) || 0;
  let m = parseInt(mStr, 10) || 0;
  const ampm = h < 12 ? 0 : 1; // 0=AM, 1=PM
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const hIdx = HOURS_12.indexOf(String(h12).padStart(2, "0"));
  // Find closest minute bucket
  const mIdx = MINUTES_30.reduce((best, val, i) =>
    Math.abs(parseInt(val) - m) < Math.abs(parseInt(MINUTES_30[best]) - m) ? i : best, 0);
  return { hIdx: Math.max(0, hIdx), mIdx, ampm };
}

function wheelTo24(hIdx, mIdx, ampm) {
  let h = parseInt(HOURS_12[hIdx], 10);
  if (ampm === 0 && h === 12) h = 0;
  if (ampm === 1 && h !== 12) h += 12;
  const m = parseInt(MINUTES_30[mIdx], 10);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function TimePickerModal({ visible, value, label, onConfirm, onClose }) {
  const parsed = parse24ToWheel(value);
  const [hIdx,  setHIdx]  = useState(parsed.hIdx);
  const [mIdx,  setMIdx]  = useState(parsed.mIdx);
  const [ampm,  setAmpm]  = useState(parsed.ampm);

  // Sync when modal opens
  useEffect(() => {
    if (visible) {
      const p = parse24ToWheel(value);
      setHIdx(p.hIdx); setMIdx(p.mIdx); setAmpm(p.ampm);
    }
  }, [visible]);

  function handleConfirm() {
    onConfirm(wheelTo24(hIdx, mIdx, ampm));
    onClose();
  }

  const preview = fmt12h(wheelTo24(hIdx, mIdx, ampm));

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
          <TouchableWithoutFeedback>
            <View style={{
              backgroundColor: "#111827", borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingBottom: 36, paddingTop: 6,
            }}>
              {/* Drag handle */}
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)",
                alignSelf: "center", marginBottom: 12 }} />

              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingHorizontal: 24, marginBottom: 8 }}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#FFFFFF" }}>{label}</Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={{ fontSize: 15, color: ROSE, fontWeight: "800" }}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Preview */}
              <Text style={{ textAlign: "center", fontSize: 28, fontWeight: "800", color: ROSE, marginBottom: 4 }}>
                {preview}
              </Text>

              {/* Wheels */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center",
                paddingHorizontal: 16, gap: 4 }}>
                <WheelColumn items={HOURS_12}   selectedIndex={hIdx}  onSelect={setHIdx}  width={72} />
                <Text style={{ fontSize: 26, fontWeight: "800", color: "rgba(255,255,255,0.3)", marginBottom: 0 }}>:</Text>
                <WheelColumn items={MINUTES_30} selectedIndex={mIdx}  onSelect={setMIdx}  width={72} />
                <WheelColumn items={AMPM}       selectedIndex={ampm}  onSelect={setAmpm}  width={64} />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function TimeInput({ label, icon, value, onChange }) {
  const [open, setOpen] = useState(false);
  const display = fmt12h(value);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
        {icon}  {label}
      </Text>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        style={{
          backgroundColor: "#1E2837", borderRadius: 12, padding: 14,
          borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)",
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
        <Text style={{ fontSize: 22 }}>🕐</Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 }}>
          {display}
        </Text>
      </TouchableOpacity>
      <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "center", marginTop: 4 }}>
        tap to change
      </Text>
      <TimePickerModal
        visible={open}
        value={value}
        label={label}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function LogSleepModal({ visible, existing, onClose }) {
  const { logSleep } = useContext(Ctx);
  const [bedTime,  setBedTime]  = useState(existing?.bedTime  || "22:00");
  const [wakeTime, setWakeTime] = useState(existing?.wakeTime || "06:00");
  const [quality,  setQuality]  = useState(existing?.quality  || "good");
  const [notes,    setNotes]    = useState(existing?.notes    || "");
  const [overrideQ, setOverrideQ] = useState(false);

  const duration = calcSleepDuration(bedTime, wakeTime);
  const autoQ    = sleepQuality(duration);

  // Auto-set quality unless user overrode
  useEffect(() => {
    if (!overrideQ) setQuality(autoQ);
  }, [autoQ, overrideQ]);

  // Reset when modal opens — existing is intentionally excluded to avoid re-running mid-session
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (visible) {
      setBedTime(existing?.bedTime   || "22:00");
      setWakeTime(existing?.wakeTime || "06:00");
      setQuality(existing?.quality   || "good");
      setNotes(existing?.notes       || "");
      setOverrideQ(false);
    }
  }, [visible]);

  function handleSave() {
    if (duration <= 0 || duration > 24) {
      Alert.alert("Check times", "Please enter valid bed and wake times."); return;
    }
    logSleep({ bedTime, wakeTime, duration, quality, notes });
    onClose();
  }

  const QUALITIES = [
    { id: "poor",  label: "Poor",  emoji: "😴" },
    { id: "fair",  label: "Fair",  emoji: "😐" },
    { id: "good",  label: "Good",  emoji: "😊" },
    { id: "great", label: "Great", emoji: "🌟" },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 28, borderTopRightRadius: 28,
                padding: 24, paddingBottom: 36, maxHeight: SH * 0.9 }}>
                {/* Drag handle */}
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)",
                  alignSelf: "center", marginBottom: 20 }} />

                <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800" }}>Log Your Sleep 🌙</Text>
                  <TouchableOpacity onPress={onClose}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 22 }}>✕</Text>
                  </TouchableOpacity>
                </Row>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <TimeInput label="What time did you go to bed?"  icon="🌙" value={bedTime}  onChange={setBedTime}  />
                  <TimeInput label="What time did you wake up?"    icon="☀️" value={wakeTime} onChange={setWakeTime} />

                  {/* Live duration */}
                  <View style={{ backgroundColor: "rgba(255,107,53,0.12)", borderRadius: 12, padding: 14,
                    alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: "rgba(255,107,53,0.25)" }}>
                    <Text style={{ color: ROSE, fontSize: 28, fontWeight: "800" }}>
                      💤 {duration > 0 ? fmtSleepDur(duration) : "--"}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>Duration</Text>
                  </View>

                  {/* Quality selector */}
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600", marginBottom: 10 }}>
                    How do you feel?
                  </Text>
                  <Row style={{ gap: 8, marginBottom: 20 }}>
                    {QUALITIES.map(q => (
                      <TouchableOpacity key={q.id} onPress={() => { setQuality(q.id); setOverrideQ(true); }}
                        style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12,
                          backgroundColor: quality === q.id ? "rgba(255,107,53,0.15)" : "#1E2837",
                          borderWidth: 1.5, borderColor: quality === q.id ? ROSE : "rgba(255,255,255,0.1)" }}>
                        <Text style={{ fontSize: 20 }}>{q.emoji}</Text>
                        <Text style={{ color: quality === q.id ? ROSE : "rgba(255,255,255,0.45)", fontSize: 11,
                          fontWeight: "700", marginTop: 3 }}>{q.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </Row>

                  {/* Notes */}
                  <TextInput
                    style={{ backgroundColor: "#1E2837", borderRadius: 12, padding: 14,
                      color: "#FFFFFF", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
                      minHeight: 72, textAlignVertical: "top", marginBottom: 20 }}
                    placeholder="Any notes? e.g. 'Woke up at 3am...'"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />

                  <TouchableOpacity onPress={handleSave} activeOpacity={0.85}
                    style={{ backgroundColor: ROSE, borderRadius: 14, padding: 16,
                      alignItems: "center", marginBottom: 8,
                      shadowColor: ROSE, shadowRadius: 12, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 } }}>
                    <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Save Sleep Log 🌙</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Weekly sleep bar chart (SVG)
function SleepChart({ history, onBarPress }) {
  const days  = lastNDays(7);
  const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const W     = SW - 32;
  const H     = 140;
  const PAD_L = 28, PAD_B = 28, PAD_T = 16, PAD_R = 8;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const maxH   = 10; // y-axis max hours
  const barW   = Math.floor(chartW / 7) - 6;
  const goalY  = PAD_T + chartH * (1 - SLEEP_GOAL / maxH);

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 8, overflow: "hidden" }}>
      <Svg width={W} height={H}>
        {/* Y-axis labels */}
        {[0, 3, 6, 9].map(h => {
          const y = PAD_T + chartH * (1 - h / maxH);
          return (
            <React.Fragment key={h}>
              <SvgText x={PAD_L - 4} y={y + 4} textAnchor="end" fill={C.grey} fontSize={9}>{h}</SvgText>
              <Path d={`M${PAD_L},${y} H${W - PAD_R}`} stroke={C.cardLight} strokeWidth={0.5} />
            </React.Fragment>
          );
        })}

        {/* Goal line (dashed) */}
        <Path d={`M${PAD_L},${goalY} H${W - PAD_R}`}
          stroke={ROSE} strokeWidth={1.5} strokeDasharray="4 3" />
        <SvgText x={W - PAD_R + 2} y={goalY + 4} fill={ROSE} fontSize={8}>goal</SvgText>

        {/* Bars */}
        {days.map((date, i) => {
          const entry = history.find(s => s.date === date);
          const hrs   = entry?.duration || 0;
          const barH  = Math.max(hrs / maxH * chartH, hrs > 0 ? 4 : 0);
          const x     = PAD_L + i * (chartW / 7) + 3;
          const y     = PAD_T + chartH - barH;
          const color = sleepBarColor(hrs);
          const d     = new Date(date + "T12:00:00");
          const lbl   = DAY_LABELS[d.getDay()].slice(0, 2);

          return (
            <React.Fragment key={date}>
              <Rect x={x} y={y} width={barW} height={barH}
                fill={hrs > 0 ? color : C.cardLight} rx={4}
                onPress={() => onBarPress && onBarPress(entry || { date, duration: 0 })}
              />
              <SvgText x={x + barW / 2} y={H - 4} textAnchor="middle" fill={C.grey} fontSize={9}>
                {lbl}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function SleepScreen({ navigation }) {
  const { todaySleep, sleepHistory } = useContext(Ctx);
  const { theme } = useTheme();
  const [showLog,    setShowLog]    = useState(false);
  const [selectedBar, setSelectedBar] = useState(null);
  const hour = new Date().getHours();

  // 7-day stats
  const week7 = lastNDays(7).map(d => sleepHistory.find(s => s.date === d));
  const logged7 = week7.filter(Boolean);
  const avg7    = logged7.length > 0
    ? Math.round(logged7.reduce((s, e) => s + e.duration, 0) / logged7.length * 10) / 10
    : 0;
  const best7   = logged7.length > 0 ? Math.max(...logged7.map(e => e.duration)) : 0;
  const onGoal7 = logged7.length > 0
    ? Math.round(logged7.filter(e => e.duration >= SLEEP_GOAL).length / 7 * 100)
    : 0;

  // Alert banner config
  function alertConfig(sleep) {
    if (!sleep) return null;
    const h = sleep.duration;
    if (h < 5)  return { emoji:"😟", title:"You need more rest!", body:`Only ${fmtSleepDur(h)} sleep detected. Sleep deprivation slows metabolism and increases cravings. Aim for 7-9 hours.\n\n💡 Tip: Try sleeping 30 mins earlier tonight.`, bg:"rgba(239,68,68,0.12)", border:"rgba(239,68,68,0.35)", text:"#EF4444" };
    if (h < 6)  return { emoji:"😐", title:"Almost there!", body:`${fmtSleepDur(h)} is decent but your body repairs muscle and burns fat during deep sleep. Try to get 1 more hour tonight.`, bg:"rgba(245,158,11,0.12)", border:"rgba(245,158,11,0.35)", text:"#F59E0B" };
    if (h <= 8) return { emoji:"😊", title:"Great sleep last night!", body:`${fmtSleepDur(h)} of rest means your body is recovering well. Your muscles are repairing and your metabolism is optimized!`, bg:"rgba(16,185,129,0.12)", border:"rgba(16,185,129,0.35)", text:"#10B981" };
    return { emoji:"🌟", title:"Outstanding rest!", body:`${fmtSleepDur(h)} of sleep is excellent! You're fully recovered and ready to crush today's workout. Peak performance mode activated! 💪`, bg:"rgba(255,107,53,0.12)", border:"rgba(255,107,53,0.35)", text:ROSE };
  }
  const alert = alertConfig(todaySleep);

  // History last 14
  const hist14 = lastNDays(14).reverse().map(d => ({
    date: d,
    entry: sleepHistory.find(s => s.date === d) || null,
  }));

  return (
    <SafeAreaView style={S.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ padding: 16, paddingBottom: 8, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <TouchableOpacity onPress={() => navigation.navigate("Home")}
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 4 }}>
              <Text style={{ color: ROSE, fontSize: 16, fontWeight: "600" }}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={{ color: theme.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 }}>
              Sleep Tracker 🌙
            </Text>
            <Text style={{ color: theme.textSub, fontSize: 13, marginTop: 2 }}>
              Track your rest, fuel your best
            </Text>
          </View>
          <Image source={LOGO_URI} style={{ width: 80, height: 40, resizeMode: "contain" }} />
        </View>

        {/* Today's sleep card */}
        <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
          {!todaySleep ? (
            <View style={[S.card, { alignItems: "center", paddingVertical: 32 }]}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>🌙</Text>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 17, marginBottom: 6 }}>
                No sleep logged yet
              </Text>
              <Text style={{ color: C.grey, fontSize: 14, textAlign: "center", marginBottom: 20 }}>
                How did you sleep last night?
              </Text>
              <TouchableOpacity onPress={() => setShowLog(true)} activeOpacity={0.85}
                style={{ backgroundColor: ROSE, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13,
                  shadowColor: ROSE, shadowRadius: 10, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 } }}>
                <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>+ Log Last Night's Sleep</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={S.card}>
              <Row style={{ justifyContent: "space-between", marginBottom: 16 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Last Night</Text>
                <TouchableOpacity onPress={() => setShowLog(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600" }}>✏️ Edit</Text>
                </TouchableOpacity>
              </Row>

              {/* Big duration */}
              <Text style={{ color: ROSE, fontSize: 52, fontWeight: "800", textAlign: "center", letterSpacing: -2 }}>
                {fmtSleepDur(todaySleep.duration)}
              </Text>
              <Text style={{ color: C.grey, textAlign: "center", fontSize: 16, marginBottom: 16 }}>
                {sleepQualityEmoji(todaySleep.quality)} {todaySleep.quality.charAt(0).toUpperCase() + todaySleep.quality.slice(1)} Sleep
              </Text>

              {/* Bed / Wake */}
              <Row style={{ justifyContent: "space-around", marginBottom: 16 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: C.grey, fontSize: 11, marginBottom: 2 }}>🌙 Bedtime</Text>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 17 }}>{fmt12h(todaySleep.bedTime)}</Text>
                </View>
                <View style={{ width: 1, height: 36, backgroundColor: C.cardLight }} />
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: C.grey, fontSize: 11, marginBottom: 2 }}>☀️ Wake Up</Text>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 17 }}>{fmt12h(todaySleep.wakeTime)}</Text>
                </View>
              </Row>

              {/* Quality bar */}
              <View>
                <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ color: C.greyDim, fontSize: 11 }}>Poor</Text>
                  <Text style={{ color: C.greyDim, fontSize: 11 }}>Great</Text>
                </Row>
                <View style={{ height: 8, backgroundColor: C.cardLight, borderRadius: 4 }}>
                  <View style={{ height: 8, borderRadius: 4,
                    width: `${Math.min(todaySleep.duration / 9 * 100, 100)}%`,
                    backgroundColor: sleepBarColor(todaySleep.duration) }} />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Smart alert banner */}
        {alert && (
          <View style={{ marginHorizontal: 16, marginBottom: 16, borderRadius: 14,
            backgroundColor: alert.bg, borderLeftWidth: 4, borderLeftColor: alert.border,
            padding: 14 }}>
            <Text style={{ color: alert.text, fontWeight: "800", fontSize: 15, marginBottom: 4 }}>
              {alert.emoji} {alert.title}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 19 }}>{alert.body}</Text>
          </View>
        )}

        {/* Weekly chart */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
            This Week 📊
          </Text>
          <SleepChart history={sleepHistory} onBarPress={e => setSelectedBar(e)} />
          {selectedBar && selectedBar.duration > 0 && (
            <View style={{ backgroundColor: C.cardLight, borderRadius: 10, padding: 10, marginTop: 8,
              flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: C.grey, fontSize: 13 }}>{selectedBar.date}</Text>
              <Text style={{ color: ROSE, fontWeight: "700", fontSize: 14 }}>
                {fmtSleepDur(selectedBar.duration)}  {sleepQualityEmoji(selectedBar.quality || sleepQuality(selectedBar.duration))}
              </Text>
              <TouchableOpacity onPress={() => setSelectedBar(null)}>
                <Text style={{ color: C.greyDim }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Average */}
          <Text style={{ color: C.grey, fontSize: 13, textAlign: "center", marginTop: 10 }}>
            7-day average: <Text style={{ color: ROSE, fontWeight: "700" }}>{avg7}h</Text>
            {"  "}{avg7 > 0 ? sleepQualityEmoji(sleepQuality(avg7)) : ""}
          </Text>
        </View>

        {/* Insights row */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
            Your Sleep Insights 💡
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {[
              { v: `${avg7}h`,    l1: "7-day",   l2: "average",  col: ROSE        },
              { v: `${best7 > 0 ? fmtSleepDur(best7) : "--"}`, l1: "Best",    l2: "night",    col: "#10B981"   },
              { v: `${onGoal7}%`, l1: "On-goal", l2: "nights",   col: C.amber     },
              { v: `${logged7.length}/7`, l1: "Days",   l2: "logged",   col: C.blue      },
            ].map((s, i) => (
              <View key={i} style={{ width: 88, backgroundColor: C.card, borderRadius: 14,
                padding: 14, alignItems: "center",
                borderTopWidth: 3, borderTopColor: s.col }}>
                <Text style={{ color: s.col, fontSize: 20, fontWeight: "800" }}>{s.v}</Text>
                <Text style={{ color: C.grey, fontSize: 11, marginTop: 2 }}>{s.l1}</Text>
                <Text style={{ color: C.grey, fontSize: 11 }}>{s.l2}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Sleep Tips */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16,
            marginHorizontal: 16, marginBottom: 12 }}>
            Sleep Better Tonight 🌙
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {SLEEP_TIPS.map((tip, i) => (
              <View key={i} style={{ width: 160, backgroundColor: C.card,
                borderRadius: 14, padding: 14,
                borderLeftWidth: 3, borderLeftColor: ROSE_DIM }}>
                <Text style={{ fontSize: 24, marginBottom: 8 }}>{tip.icon}</Text>
                <Text style={{ color: C.text, fontSize: 13, lineHeight: 18 }}>{tip.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Sleep History */}
        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
            Sleep History 📅
          </Text>
          <View style={{ backgroundColor: C.card, borderRadius: 16, overflow: "hidden" }}>
            {hist14.map(({ date, entry }, i) => {
              const d = new Date(date + "T12:00:00");
              const dayLbl = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
              return (
                <View key={date} style={{
                  flexDirection: "row", alignItems: "center", paddingVertical: 13,
                  paddingHorizontal: 14,
                  borderBottomWidth: i < hist14.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: C.cardLight,
                }}>
                  <Text style={{ color: C.grey, fontSize: 12, width: 90 }}>{dayLbl}</Text>
                  <Text style={{ color: entry ? ROSE : C.greyDim, fontWeight: "700",
                    fontSize: 13, width: 56 }}>
                    {entry ? fmtSleepDur(entry.duration) : "—"}
                  </Text>
                  <Text style={{ fontSize: 16, width: 28 }}>
                    {entry ? sleepQualityEmoji(entry.quality) : ""}
                  </Text>
                  <Text style={{ color: C.greyDim, fontSize: 11, flex: 1, textAlign: "right" }}>
                    {entry ? `${fmt12h(entry.bedTime)} → ${fmt12h(entry.wakeTime)}` : "Not logged"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Spacer h={24} />
      </ScrollView>

      <LogSleepModal visible={showLog} existing={todaySleep} onClose={() => setShowLog(false)} />
    </SafeAreaView>
  );
}

// ─── EXERCISE LIBRARY DATA ────────────────────────────────────────────────────

const EXERCISES = [
  {
    id: 1,
    title: "Squats",
    category: "Legs",
    emoji: "🦵",
    instructions: "Stand feet shoulder width apart. Lower your body until thighs are parallel to floor. Keep back straight. Push back up.",
    coachTip: "Keep your chest up and knees behind your toes!",
  },
  {
    id: 2,
    title: "Push Ups",
    category: "Upper Body",
    emoji: "💪",
    instructions: "Start in plank position. Lower chest to floor keeping elbows close. Push back up to start.",
    coachTip: "Engage your core throughout the entire movement!",
  },
  {
    id: 3,
    title: "Lunges",
    category: "Legs",
    emoji: "🏃",
    instructions: "Step forward with one leg. Lower hips until both knees at 90 degrees. Push back to start. Alternate legs.",
    coachTip: "Keep your upper body straight and core tight!",
  },
  {
    id: 4,
    title: "Plank",
    category: "Core",
    emoji: "🧘",
    instructions: "Hold body in straight line from head to heels. Support on forearms and toes. Breathe steadily.",
    coachTip: "Squeeze your glutes and don't let your hips drop!",
  },
  {
    id: 5,
    title: "Mountain Climbers",
    category: "Cardio",
    emoji: "⛰️",
    instructions: "Start in plank position. Drive knees to chest alternately in running motion. Keep hips level.",
    coachTip: "The faster you go the more calories you burn!",
  },
  {
    id: 6,
    title: "Jumping Jacks",
    category: "HIIT",
    emoji: "⚡",
    instructions: "Stand upright. Jump feet wide while raising arms overhead. Jump back to start. Repeat continuously.",
    coachTip: "Land softly on the balls of your feet!",
  },
  {
    id: 7,
    title: "Cycling",
    category: "Cardio",
    emoji: "🚴",
    instructions: "Lie on back. Bring knees to chest. Pedal legs in circular motion like riding a bike. Keep lower back pressed to floor.",
    coachTip: "Control the movement — slow is more effective!",
  },
  {
    id: 8,
    title: "Running In Place",
    category: "Cardio",
    emoji: "🔥",
    instructions: "Run on the spot driving knees up to hip height. Pump arms naturally. Maintain upright posture.",
    coachTip: "High knees = higher heart rate = more fat burn!",
  },
];

const EXERCISE_CATEGORIES = ["All", "Legs", "Upper Body", "Core", "Cardio", "HIIT"];

// ─── EXERCISE CARD ────────────────────────────────────────────────────────────
function ExerciseCard({ exercise, onPress }) {
  return (
    <TouchableOpacity onPress={() => onPress(exercise)} activeOpacity={0.88}
      style={{ backgroundColor: "#111827", borderRadius: 18, overflow: "hidden", marginBottom: 16,
        borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" }}>
      {/* Emoji header */}
      <View style={{ height: 120, backgroundColor: "#1E2837", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 56 }}>{exercise.emoji || "💪"}</Text>
      </View>
      <View style={{ padding: 16 }}>
        {/* Title + category badge */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>{exercise.title}</Text>
          <View style={{ backgroundColor: ROSE, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>{exercise.category}</Text>
          </View>
        </View>
        {/* Instructions */}
        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 20, marginBottom: 12 }}>{exercise.instructions}</Text>
        {/* Coach TinaBarks Tip */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,107,53,0.3)", overflow: "hidden" }}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ color: ROSE, fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
              💪 Coach TinaBarks Tip:
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 19 }}>{exercise.coachTip}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── VIDEO LIBRARY DATA ───────────────────────────────────────────────────────
const VIDEO_LIBRARY = [
  { id: "2pLT-olgUJs", title: "Lose Belly Fat in 1 Week",        channel: "Chloe Ting",                 views: "45M views",  duration: "10:35", category: "belly_fat" },
  { id: "UItWltVZZmE", title: "20 Min Full Body Workout",        channel: "Pamela Reif",                views: "100M views", duration: "20:11", category: "belly_fat" },
  { id: "sVt9cqNheOE", title: "10 Min Cardio HIIT Workout",      channel: "MadFit",                     views: "12M views",  duration: "10:20", category: "belly_fat" },
  { id: "ml6cT4AZdqI", title: "20 Min HIIT Workout",             channel: "Heather Robertson",          views: "8M views",   duration: "20:05", category: "belly_fat" },
  { id: "_kGESn8ArrU", title: "Running Workout for Beginners",   channel: "Global Triathlon Network",   views: "5M views",   duration: "15:30", category: "belly_fat" },
  { id: "aclHkVaku9U", title: "30 Day Squat Challenge",          channel: "Chloe Ting",                 views: "20M views",  duration: "10:15", category: "tone"      },
  { id: "UBMk30rjy0o", title: "Full Body Toning Workout",        channel: "Heather Robertson",          views: "6M views",   duration: "30:00", category: "tone"      },
  { id: "vc1E5CfRfos", title: "Glute & Leg Workout",             channel: "Caroline Girvan",            views: "4M views",   duration: "25:00", category: "tone"      },
  { id: "oAPCPjnU1wA", title: "Arm Toning No Equipment",         channel: "MadFit",                     views: "8M views",   duration: "12:00", category: "tone"      },
  { id: "CBcfDxoGsO0", title: "Full Body Strength Training",     channel: "Sydney Cummings",            views: "3M views",   duration: "35:00", category: "tone"      },
  { id: "v7AYKMP6rOE", title: "Morning Yoga for Beginners",      channel: "Yoga With Adriene",          views: "25M views",  duration: "20:00", category: "recovery"  },
  { id: "4pKly2JojMw", title: "Full Body Stretch Routine",       channel: "MadFit",                     views: "10M views",  duration: "15:00", category: "recovery"  },
  { id: "enFBMgTogtY", title: "30 Min Power Walk at Home",       channel: "Walk at Home",               views: "15M views",  duration: "30:00", category: "recovery"  },
  { id: "L_xrDAtykMI", title: "10 Min Morning Energy Flow",      channel: "Yoga With Adriene",          views: "8M views",   duration: "10:00", category: "recovery"  },
  { id: "AnYl6Mv5Qvc", title: "Bedtime Yoga for Deep Sleep",     channel: "Yoga With Adriene",          views: "20M views",  duration: "18:00", category: "recovery"  },
];

const VIDEO_CAT_META = {
  belly_fat: { label: "🔥 Belly Fat", color: "#FF6B35" },
  tone:      { label: "💪 Toning",    color: "#9333EA" },
  recovery:  { label: "😴 Recovery",  color: "#22C55E" },
};

// ─── VIDEO SCREEN ─────────────────────────────────────────────────────────────
function VideoScreen({ navigation, trainSubBar }) {
  const [activeCat, setActiveCat] = useState("all");

  const filtered = activeCat === "all"
    ? VIDEO_LIBRARY
    : VIDEO_LIBRARY.filter(v => v.category === activeCat);

  const openVideo = (videoId) => {
    Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
  };

  return (
    <SafeAreaView style={S.screen}>
      {trainSubBar || null}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>Workout Videos</Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 4 }}>
            Curated from the world's top fitness channels
          </Text>
        </View>

        {/* Category filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 24, gap: 8 }}
          style={{ marginBottom: 16 }}>
          {[
            { id: "all",       label: "All"           },
            { id: "belly_fat", label: "🔥 Belly Fat"  },
            { id: "tone",      label: "💪 Toning"     },
            { id: "recovery",  label: "😴 Recovery"   },
          ].map(f => (
            <TouchableOpacity key={f.id} onPress={() => setActiveCat(f.id)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                backgroundColor: activeCat === f.id ? ROSE : "#1E2837",
                borderWidth: 1, borderColor: activeCat === f.id ? ROSE : "rgba(255,255,255,0.12)" }}>
              <Text style={{ color: activeCat === f.id ? "#FFF" : "rgba(255,255,255,0.55)",
                fontWeight: "600", fontSize: 12 }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Video cards */}
        <View style={{ paddingHorizontal: 16 }}>
          {filtered.map(video => {
            const catMeta = VIDEO_CAT_META[video.category];
            return (
              <TouchableOpacity key={video.id} activeOpacity={0.85}
                onPress={() => openVideo(video.id)}
                style={{ backgroundColor: "#111827", borderRadius: 16, marginBottom: 14, overflow: "hidden" }}>
                {/* Thumbnail */}
                <View style={{ width: "100%", height: 180, position: "relative" }}>
                  <Image
                    source={{ uri: `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg` }}
                    style={{ width: "100%", height: 180, resizeMode: "cover" }}
                  />
                  {/* Play button overlay */}
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    alignItems: "center", justifyContent: "center" }}>
                    <View style={{ width: 50, height: 50, borderRadius: 25,
                      backgroundColor: "rgba(255,107,53,0.9)", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#FFF", fontSize: 20 }}>▶</Text>
                    </View>
                  </View>
                  {/* Duration badge top-right */}
                  <View style={{ position: "absolute", top: 10, right: 10,
                    backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 6,
                    paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>{video.duration}</Text>
                  </View>
                  {/* Category badge top-left */}
                  <View style={{ position: "absolute", top: 10, left: 10,
                    backgroundColor: catMeta.color + "DD", borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>{catMeta.label}</Text>
                  </View>
                </View>
                {/* Card body */}
                <View style={{ padding: 12 }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14, marginBottom: 4 }}>
                    {video.title}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ color: ROSE, fontSize: 12, fontWeight: "600" }}>{video.channel}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>{video.views}</Text>
                    </View>
                    <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>Opens in YouTube</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Premium note banner */}
        <View style={{ marginHorizontal: 16, marginTop: 4, backgroundColor: "rgba(255,107,53,0.1)",
          borderRadius: 12, padding: 14 }}>
          <Text style={{ color: ROSE, fontWeight: "700", fontSize: 13, textAlign: "center", marginBottom: 6 }}>
            🎬 Coach TinaBarks' exclusive workout videos coming soon!
          </Text>
          <Text style={{ color: "#FFFFFF", fontSize: 11, textAlign: "center", lineHeight: 17 }}>
            These are the world's best fitness videos while we prepare something even better for you.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── MEAL PLANNER ────────────────────────────────────────────────────────────
const MEAL_ICONS = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

async function generateMealPlanFromAPI(profile, targets) {

  const systemPrompt = `You are a nutrition assistant. Respond ONLY with a valid JSON object. No markdown, no code blocks, no backticks, no explanation text before or after. Start your response with { and end with }.
The JSON must follow this exact structure:
{"coachMessage":"...","days":[{"day":"Monday","totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"coachTip":"...","meals":{"breakfast":{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"description":"...","prepTime":"...","ingredients":["..."],"nutritionistNote":"..."},"lunch":{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"description":"...","prepTime":"...","ingredients":["..."],"nutritionistNote":"..."},"dinner":{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"description":"...","prepTime":"...","ingredients":["..."],"nutritionistNote":"..."},"snack":{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"description":"...","prepTime":"...","ingredients":["..."],"nutritionistNote":"..."}}}]}`;

  const userPrompt = `Generate a 7-day meal plan. Include East African foods like Matoke, Posho, Ugali, Rolex, Beans, Groundnuts, Sukuma Wiki, Sweet Potato, Tilapia, Chicken, Eggs. Mix with international options.

Client profile:
Name: ${profile.name || "Client"}
Goal: ${profile.goal || "Improve Fitness"}
Activity Level: ${profile.activity_level || "moderate"}

Match these targets exactly:
Daily Calories: ${targets.calories}
Protein: ${targets.protein}g
Carbs: ${targets.carbs}g
Fat: ${targets.fat}g

NUTRITIONIST RULES — MUST FOLLOW ALL:

BREAKFAST (300-400 calories):
- High protein to reduce morning cravings
- Complex carbs for sustained energy
- No refined sugar or white bread
- Examples: uji with milk, eggs with vegetables, oats with fruit, avocado with eggs, boiled sweet potato with eggs
- Always include 1 glass of warm lemon water as a note (boosts metabolism)

LUNCH (400-500 calories):
- The largest meal of the day
- Must include a LARGE serving of vegetables or salad (cucumber, carrots, beetroot, tomatoes, cabbage, sukuma wiki, spinach, kachumbari)
- Lean protein: tilapia, chicken breast, boiled eggs, beans, lentils, ndengu
- Complex carbs in MODERATE portion: ugali (small), brown rice, matoke, sweet potato
- NO fried foods at lunch

DINNER (300-400 calories — ALWAYS LIGHT):
- Dinner must be the LIGHTEST meal of the day
- No heavy carbs at dinner (no ugali, no rice, no posho, no matoke at dinner)
- Focus on: lean protein + vegetables only

SNACK (100-200 calories — MANDATORY DAILY):
- Must include ONE fresh fruit every single day (rotate through the week)
- Snack between lunch and dinner (3-4pm)

CALORIE DISTRIBUTION TARGET:
Breakfast: 25% of daily calories
Lunch: 35% of daily calories
Dinner: 25% of daily calories
Snack: 15% of daily calories
Each day total must be within 50 calories of the client's daily calorie target.

Include all 7 days: Monday through Sunday.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token || SUPABASE_ANON_KEY;
    const res = await fetch(SUPABASE_URL + "/functions/v1/ai-coach", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}`, "Apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({
        mode: "meal-plan",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }),
    });
    clearTimeout(timeout);
    if (res.status === 401) throw new Error("INVALID_KEY");
    if (res.status === 429) throw new Error("QUOTA_EXCEEDED");
    if (!res.ok) throw new Error("API_ERROR");
    const parsed = await res.json();
    if (!parsed.days || !Array.isArray(parsed.days)) throw new Error("PARSE_ERROR");
    const monday = getMonday(new Date());
    return {
      generatedAt: new Date().toISOString(),
      weekStart: monday,
      goal: profile.goal,
      dailyCalorieTarget: targets.calories,
      coachMessage: parsed.coachMessage || "Here is your personalised meal plan for this week!",
      days: (parsed.days || []).map((d, i) => ({
        ...d,
        date: (() => { const dt = new Date(monday); dt.setDate(dt.getDate() + i); return dt.toISOString().split("T")[0]; })(),
      })),
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("TIMEOUT");
    throw err;
  }
}

function MealPlannerScreen({ navigation, nutritionSubBar }) {
  const { profile, mealPlan, saveMealPlan, addFood, isPremium } = useContext(Ctx);
  const { theme } = useTheme();
  const targets = calcTargets(profile);

  const [generating, setGenerating] = useState(false);
  const [genStep,    setGenStep]    = useState(0);
  const [genError,   setGenError]   = useState(null);
  const [activeDay,  setActiveDay]  = useState(0);
  const [expanded,   setExpanded]   = useState({});
  const [logged,     setLogged]     = useState({}); // { "Monday_breakfast": true }
  const [toast,      setToast]      = useState(null);

  const GEN_STEPS = [
    "Analysing your calorie goals",
    "Selecting East African foods",
    "Balancing your macros",
    "Writing your coach tips",
    "Finalising your plan",
  ];

  useEffect(() => {
    let timer;
    if (generating && genStep < GEN_STEPS.length - 1) {
      timer = setTimeout(() => setGenStep(s => s + 1), 5000);
    }
    return () => clearTimeout(timer);
  }, [generating, genStep]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const PLAN_ERR_MSGS = {
    NO_KEY:         "API key needed. Go to Profile → Settings → AI Search Key to add yours.",
    INVALID_KEY:    "Invalid API key. Check Profile → Settings → AI Search Key.",
    QUOTA_EXCEEDED: "Daily AI limit reached. Try again tomorrow.",
    TIMEOUT:        "Request timed out — the plan can take up to 30s. Check your connection and try again.",
    API_ERROR:      "AI service unavailable. Please try again.",
    PARSE_ERROR:    "Coach TinaBarks is preparing your plan. Please tap try again in a moment. 🍽️",
  };

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    setGenStep(0);
    try {
      const plan = await generateMealPlanFromAPI(profile, targets);
      await saveMealPlan(plan);
      setActiveDay(0);
    } catch (e) {
      const key = PLAN_ERR_MSGS[e.message] ? e.message : "API_ERROR";
      setGenError(PLAN_ERR_MSGS[key]);
    }
    setGenerating(false);
  }

  async function handleConfirmRegenerate() {
    Alert.alert("Regenerate Plan", "This will replace your current plan. Continue?", [
      { text: "Cancel", style: "cancel" },
      { text: "Regenerate", style: "destructive", onPress: handleGenerate },
    ]);
  }

  function toggleExpand(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function logMeal(dayObj, mealKey) {
    const logKey = `${dayObj.day}_${mealKey}`;
    if (logged[logKey]) return;
    const meal = dayObj.meals[mealKey];
    if (!meal) return;
    const mealMap = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snack: "snacks" };
    await addFood(mealMap[mealKey] || "snacks", {
      name: meal.name,
      serving: "1 serving",
      cal: meal.calories || 0,
      p: meal.protein || 0,
      c: meal.carbs || 0,
      f: meal.fat || 0,
    });
    setLogged(prev => ({ ...prev, [logKey]: true }));
    showToast(`${MEAL_LABELS[mealKey]} logged! +${meal.calories} cal`);
  }

  const hasValidPlan = mealPlan && mealPlan.days && mealPlan.days.length > 0;
  const currentDay  = hasValidPlan ? mealPlan.days[activeDay] : null;

  if (!isPremium) {
    return (
      <SafeAreaView style={S.screen}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <Text style={[S.heading, { marginBottom: 4 }]}>Weekly Meal Plan</Text>
          <Text style={{ color: C.grey, fontSize: 13, marginBottom: 20 }}>By Coach TinaBarks</Text>
          <View style={{ backgroundColor: "#FFF5F0", borderRadius: 20, padding: 28, alignItems: "center", borderWidth: 1, borderColor: ROSE_DIM }}>
            <Text style={{ fontSize: 44, marginBottom: 16 }}>🔒</Text>
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 20, marginBottom: 8, textAlign: "center" }}>Premium Feature</Text>
            <Text style={{ color: C.grey, fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 20 }}>
              Upgrade to WeGoFit Premium to get your personalised 7-day East African meal plan powered by AI Coach TinaBarks.
            </Text>
            {[
              "East African foods included",
              "Matches your calorie target",
              "Practical & affordable meals",
              "Log meals directly to diary",
            ].map(f => (
              <Row key={f} style={{ marginBottom: 8 }}>
                <Text style={{ color: "#22C55E", marginRight: 8 }}>✓</Text>
                <Text style={{ color: C.text, fontSize: 14 }}>{f}</Text>
              </Row>
            ))}
            <TouchableOpacity onPress={() => navigation?.navigate("Profile")}
              style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 20 }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Upgrade to Premium →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.screen}>
      {nutritionSubBar || null}
      {/* Toast */}
      {!!toast && (
        <View style={{ position: "absolute", top: 60, left: 20, right: 20, zIndex: 999,
          backgroundColor: "#1A1A1A", borderRadius: 12, padding: 14, alignItems: "center",
          shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>{toast}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        {navigation?.canGoBack?.() && (
          <TouchableOpacity onPress={() => navigation.goBack()}
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, alignSelf: "flex-start" }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.cardLight,
              alignItems: "center", justifyContent: "center", marginRight: 8 }}>
              <Text style={{ color: ROSE, fontSize: 18 }}>‹</Text>
            </View>
            <Text style={{ color: ROSE, fontWeight: "600", fontSize: 15 }}>Back</Text>
          </TouchableOpacity>
        )}
        <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
          <View>
            <Text style={[S.heading, { color: theme.text }]}>Weekly Meal Plan</Text>
            <Text style={{ color: theme.textSub, fontSize: 13 }}>By Coach TinaBarks</Text>
          </View>
          <Text style={{ fontSize: 28 }}>🗓️</Text>
        </Row>

        <Spacer h={16} />

        {/* GENERATING STATE */}
        {generating && (
          <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 28, alignItems: "center",
            borderWidth: 1, borderColor: ROSE_DIM, marginBottom: 16 }}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🌸</Text>
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 18, marginBottom: 8 }}>
              Coach TinaBarks is cooking...
            </Text>
            <ActivityIndicator color={ROSE} style={{ marginBottom: 16 }} />
            <Text style={{ color: C.grey, fontSize: 13, marginBottom: 20, textAlign: "center" }}>
              Creating your personalised East African meal plan...
            </Text>
            {GEN_STEPS.map((step, i) => (
              <Row key={step} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
                <Text style={{ fontSize: 14, marginRight: 8, width: 20 }}>
                  {i < genStep ? "✅" : i === genStep ? "⏳" : "○"}
                </Text>
                <Text style={{ color: i <= genStep ? C.text : C.greyDim, fontSize: 14 }}>{step}</Text>
              </Row>
            ))}
          </View>
        )}

        {/* ERROR */}
        {!!genError && !generating && (
          <View style={{ backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 14, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }}>
            <Text style={{ color: "#EF4444", fontSize: 14, textAlign: "center", marginBottom: 10 }}>{genError}</Text>
            {genError.includes("API key") && (
              <TouchableOpacity onPress={() => navigation?.navigate("Profile")}
                style={{ backgroundColor: ROSE, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Go to Profile → Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* NO PLAN YET */}
        {!hasValidPlan && !generating && (
          <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 28, alignItems: "center",
            borderWidth: 1, borderColor: ROSE_DIM, marginBottom: 20 }}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>🗓️</Text>
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 20, marginBottom: 8 }}>No meal plan yet</Text>
            <Text style={{ color: C.grey, fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 20 }}>
              Let Coach TinaBarks create your personalised 7-day meal plan based on your goals and calorie targets.
            </Text>
            {[
              "East African foods included",
              "Matches your calorie target",
              "Practical & affordable meals",
              "Ready in about 30 seconds",
            ].map(f => (
              <Row key={f} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
                <Text style={{ color: "#22C55E", marginRight: 8 }}>✓</Text>
                <Text style={{ color: C.text, fontSize: 14 }}>{f}</Text>
              </Row>
            ))}
            <TouchableOpacity onPress={handleGenerate}
              style={{ backgroundColor: ROSE, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32,
                marginTop: 20, width: "100%", alignItems: "center",
                shadowColor: ROSE, shadowRadius: 10, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 } }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 17 }}>Generate My Meal Plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PLAN READY */}
        {hasValidPlan && !generating && (
          <>
            {/* Coach message card */}
            <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
              borderLeftWidth: 4, borderLeftColor: ROSE, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Row style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 20, marginRight: 8 }}>🌸</Text>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Coach TinaBarks</Text>
              </Row>
              <Text style={{ color: C.grey, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
                {mealPlan.coachMessage}
              </Text>
              <Text style={{ color: C.greyDim, fontSize: 11 }}>
                Generated: {new Date(mealPlan.generatedAt).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </View>

            {/* Day selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 8, marginBottom: 12 }}>
              {DAYS_SHORT.map((d, i) => (
                <TouchableOpacity key={d} onPress={() => setActiveDay(i)}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: activeDay === i ? ROSE : C.cardLight,
                    borderWidth: 1, borderColor: activeDay === i ? ROSE : "rgba(255,255,255,0.08)" }}>
                  <Text style={{ color: activeDay === i ? "#FFF" : C.text, fontWeight: "700", fontSize: 13 }}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Day macro summary */}
            {currentDay && (
              <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 12, padding: 12, marginBottom: 12,
                borderWidth: 1, borderColor: ROSE_DIM }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 13, marginBottom: 4 }}>
                  {currentDay.day} — Total: {currentDay.totalCalories?.toLocaleString()} cal
                </Text>
                <Text style={{ color: C.grey, fontSize: 12 }}>
                  P:{currentDay.totalProtein}g  C:{currentDay.totalCarbs}g  F:{currentDay.totalFat}g
                </Text>
              </View>
            )}

            {/* Coach tip */}
            {currentDay?.coachTip && (
              <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 14, padding: 14, marginBottom: 14,
                borderLeftWidth: 4, borderLeftColor: "#F59E0B", borderWidth: 1, borderColor: "rgba(253,230,138,0.2)" }}>
                <Row style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 16, marginRight: 6 }}>💡</Text>
                  <Text style={{ color: "#F59E0B", fontWeight: "700", fontSize: 13 }}>Coach Tip</Text>
                </Row>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 20 }}>{currentDay.coachTip}</Text>
              </View>
            )}

            {/* Meal cards */}
            {currentDay && ["breakfast", "lunch", "dinner", "snack"].map(mealKey => {
              const meal = currentDay.meals?.[mealKey];
              if (!meal) return null;
              const expandKey = `${currentDay.day}_${mealKey}_ing`;
              const logKey    = `${currentDay.day}_${mealKey}`;
              const isLogged  = logged[logKey];
              return (
                <View key={mealKey} style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16,
                  marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                  shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
                  {/* Meal header */}
                  <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
                    <Row>
                      <Text style={{ fontSize: 20, marginRight: 8 }}>{MEAL_ICONS[mealKey]}</Text>
                      <Text style={{ color: C.grey, fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {MEAL_LABELS[mealKey]}
                      </Text>
                    </Row>
                    <Text style={{ color: ROSE, fontWeight: "800", fontSize: 15 }}>{meal.calories} cal</Text>
                  </Row>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 6 }}>{meal.name}</Text>
                  <Text style={{ color: C.grey, fontSize: 13, lineHeight: 20, marginBottom: meal.nutritionistNote ? 8 : 10 }}>{meal.description}</Text>

                  {!!meal.nutritionistNote && (
                    <View style={{ backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 8, padding: 10,
                      marginBottom: 10, borderLeftWidth: 3, borderLeftColor: "#10B981" }}>
                      <Text style={{ color: "#10B981", fontSize: 12, fontStyle: "italic" }}>
                        🥗 {meal.nutritionistNote}
                      </Text>
                    </View>
                  )}

                  {/* Stats row */}
                  <Row style={{ gap: 12, marginBottom: 12 }}>
                    <Text style={{ color: C.grey, fontSize: 12 }}>⏱ {meal.prepTime}</Text>
                    <Text style={{ color: "#6366F1", fontSize: 12, fontWeight: "600" }}>P:{meal.protein}g</Text>
                    <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "600" }}>C:{meal.carbs}g</Text>
                    <Text style={{ color: ROSE, fontSize: 12, fontWeight: "600" }}>F:{meal.fat}g</Text>
                  </Row>

                  {/* Ingredients toggle */}
                  <TouchableOpacity onPress={() => toggleExpand(expandKey)}
                    style={{ flexDirection: "row", alignItems: "center", marginBottom: expanded[expandKey] ? 10 : 0 }}>
                    <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600", marginRight: 4 }}>
                      {expanded[expandKey] ? "▲" : "▼"} Ingredients
                    </Text>
                    <Text style={{ color: C.grey, fontSize: 12 }}>({(meal.ingredients || []).length} items)</Text>
                  </TouchableOpacity>
                  {expanded[expandKey] && (
                    <View style={{ backgroundColor: C.bgSecondary, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                      {(meal.ingredients || []).map((ing, idx) => (
                        <Text key={idx} style={{ color: C.text, fontSize: 13, marginBottom: 3 }}>• {ing}</Text>
                      ))}
                    </View>
                  )}

                  {/* Log button */}
                  <TouchableOpacity onPress={() => logMeal(currentDay, mealKey)} disabled={isLogged}
                    style={{ borderWidth: 1.5, borderColor: isLogged ? "#22C55E" : ROSE, borderRadius: 12,
                      paddingVertical: 10, alignItems: "center",
                      backgroundColor: isLogged ? "rgba(16,185,129,0.1)" : "transparent" }}>
                    <Text style={{ color: isLogged ? "#22C55E" : ROSE, fontWeight: "700", fontSize: 14 }}>
                      {isLogged ? "✅ Logged Today" : `+ Log This Meal`}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Day nutrition summary */}
            {currentDay && (
              <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Row style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 18, marginRight: 8 }}>📊</Text>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Day Summary</Text>
                </Row>
                {[
                  { label: "Calories", val: currentDay.totalCalories, target: targets.calories, unit: "cal", color: ROSE },
                  { label: "Protein",  val: currentDay.totalProtein,  target: targets.protein,  unit: "g",   color: "#6366F1" },
                  { label: "Carbs",    val: currentDay.totalCarbs,    target: targets.carbs,    unit: "g",   color: "#F59E0B" },
                  { label: "Fat",      val: currentDay.totalFat,      target: targets.fat,      unit: "g",   color: "#10B981" },
                ].map(m => {
                  const pct = Math.min((m.val || 0) / Math.max(m.target, 1), 1);
                  const ok  = Math.abs((m.val || 0) - m.target) < m.target * 0.1;
                  return (
                    <View key={m.label} style={{ marginBottom: 12 }}>
                      <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ color: C.text, fontSize: 13 }}>{m.label}</Text>
                        <Text style={{ color: C.grey, fontSize: 12 }}>
                          {m.val}{m.unit} / {m.target}{m.unit} {ok ? "✓" : ""}
                        </Text>
                      </Row>
                      <View style={{ height: 6, backgroundColor: C.cardLight, borderRadius: 3 }}>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: m.color, width: `${pct * 100}%` }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Weekly mini calendar */}
            <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Week Overview</Text>
              <Row style={{ justifyContent: "space-between" }}>
                {mealPlan.days.map((d, i) => {
                  const diff = Math.abs((d.totalCalories || 0) - (mealPlan.dailyCalorieTarget || targets.calories));
                  const col  = diff < 100 ? "#22C55E" : diff < 200 ? "#F59E0B" : "#EF4444";
                  return (
                    <TouchableOpacity key={i} onPress={() => setActiveDay(i)}
                      style={{ alignItems: "center", flex: 1 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col, marginBottom: 4 }} />
                      <Text style={{ color: activeDay === i ? ROSE : C.grey, fontSize: 10, fontWeight: activeDay === i ? "800" : "400" }}>
                        {DAYS_SHORT[i]}
                      </Text>
                      <Text style={{ color: C.greyDim, fontSize: 9, marginTop: 1 }}>{d.totalCalories || 0}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Row>
            </View>

            {/* Action buttons */}
            <TouchableOpacity onPress={handleConfirmRegenerate}
              style={{ borderWidth: 1.5, borderColor: C.greyDim, borderRadius: 14, paddingVertical: 14,
                alignItems: "center", marginBottom: 10 }}>
              <Text style={{ color: C.grey, fontWeight: "700", fontSize: 15 }}>Regenerate Plan</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── BADGE CARD ───────────────────────────────────────────────────────────────
function BadgeCard({ badge, size = "medium", unlocked = false, showName = true, isNew = false, onPress }) {
  const sizes = { small: { card: 70, emoji: 28, font: 9 }, medium: { card: 100, emoji: 42, font: 11 }, large: { card: 130, emoji: 58, font: 13 } };
  const s = sizes[size] || sizes.medium;
  const rarity = RARITY_CONFIG[badge.rarity] || RARITY_CONFIG.common;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.75 : 1}
      style={{ width: s.card, alignItems: "center", margin: 8 }}>
      <View style={{
        width: s.card, height: s.card, borderRadius: s.card / 2,
        backgroundColor: unlocked ? badge.bgColor : badge.bgColor + "30",
        borderWidth: unlocked ? rarity.ringWidth : 1.5,
        borderColor: unlocked ? badge.borderColor : badge.borderColor + "40",
        alignItems: "center", justifyContent: "center",
        shadowColor: unlocked ? badge.borderColor : "transparent",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: unlocked ? 0.6 : 0,
        shadowRadius: unlocked ? rarity.glowRadius : 0,
        elevation: unlocked ? 8 : 0,
      }}>
        <Text style={{ fontSize: s.emoji, opacity: unlocked ? 1 : 0.25 }}>{badge.emoji}</Text>
      </View>
      {unlocked && isNew && (
        <View style={{ position: "absolute", top: -4, right: -4,
          backgroundColor: "#EF4444", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: "#FFF", fontSize: 9, fontWeight: "800" }}>NEW!</Text>
        </View>
      )}
      {showName && (
        <Text style={{ fontSize: s.font, fontWeight: "700", color: unlocked ? "#1A1A1A" : "#AAAAAA",
          textAlign: "center", marginTop: 6, lineHeight: s.font + 3 }}>{badge.name}</Text>
      )}
      {showName && size !== "small" && (
        <Text style={{ fontSize: s.font - 1, color: unlocked ? "#888" : "#CCC",
          textAlign: "center", marginTop: 2, fontStyle: "italic", lineHeight: s.font + 2 }}>{badge.tagline}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── BADGE UNLOCK OVERLAY ─────────────────────────────────────────────────────
function BadgeUnlockOverlay({ badge, onClose, onShare, onViewAll }) {
  const scale    = useRef(new Animated.Value(0)).current;
  const rarity   = RARITY_CONFIG[badge?.rarity] || RARITY_CONFIG.common;
  useEffect(() => {
    if (!badge) return;
    scale.setValue(0);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 350, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [badge]);
  if (!badge) return null;
  return (
    <Modal visible={!!badge} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.82)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: "#FFF", fontSize: 28, fontWeight: "800", marginBottom: 16, textAlign: "center" }}>🎉 Badge Unlocked! 🎉</Text>
        <Animated.View style={{ transform: [{ scale }] }}>
          <BadgeCard badge={badge} size="large" unlocked showName={false} />
        </Animated.View>
        <Text style={{ color: "#FFF", fontSize: 22, fontWeight: "800", marginTop: 16, textAlign: "center" }}>{badge.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 }}>
          <View style={{ backgroundColor: rarity.color + "30", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: rarity.color, fontSize: 13, fontWeight: "700" }}>{rarity.label} Badge</Text>
          </View>
        </View>
        <Text style={{ color: "#DDD", fontSize: 14, textAlign: "center", marginTop: 8, fontStyle: "italic" }}>"{badge.tagline}"</Text>
        <View style={{ backgroundColor: "#F43F8E30", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 14 }}>
          <Text style={{ color: "#F43F8E", fontWeight: "800", fontSize: 18, textAlign: "center" }}>+{badge.points} WeGoFit Points</Text>
        </View>
        <TouchableOpacity onPress={onShare}
          style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 20, width: "100%", alignItems: "center" }}>
          <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Share with Community 📢</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewAll}
          style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, marginTop: 10, width: "100%", alignItems: "center" }}>
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>View All Badges</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 14, padding: 10 }}>
          <Text style={{ color: "#AAA", fontSize: 14 }}>Continue</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── CHALLENGE PROGRESS SCREEN ────────────────────────────────────────────────
function ChallengeProgressScreen({ challenge, progress, onBack }) {
  const pct = Math.min(progress / challenge.goal.target, 1);
  const typeColor = CHALLENGE_TYPE_COLORS[challenge.type] || ROSE;
  const today = new Date();
  const dayOfChallenge = Math.min(challenge.durationDays, Math.max(1,
    Math.ceil((today - new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)) / 86400000)
  ));

  // Build daily breakdown for day-by-day challenges
  const isNutritionChallenge = challenge.type === "nutrition";
  const isRunChallenge       = challenge.type === "workout";
  const dailyTarget          = isNutritionChallenge ? 4 : null; // meals per day

  const days = Array.from({ length: challenge.durationDays }, (_, i) => {
    const dayNum  = i + 1;
    const isDone  = isNutritionChallenge
      ? (progress / challenge.durationDays) >= dayNum - 1 + 1
      : false;
    const isCurrent = dayNum === dayOfChallenge;
    const isFuture  = dayNum > dayOfChallenge;
    return { dayNum, isDone, isCurrent, isFuture };
  });

  const myRank = MOCK_LEADERBOARD.filter(u => u.points > (progress * 10)).length + 1;
  const top3   = MOCK_LEADERBOARD.slice(0, 3);

  // SVG ring params
  const R = 70, CIRC = 2 * Math.PI * R;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#070B14" }}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}>
      <SafeAreaView>
        <TouchableOpacity onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <Text style={{ color: "#FF6B35", fontSize: 16, fontWeight: "700" }}>‹ Back</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <View style={{ paddingHorizontal: 16 }}>
        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 24, marginBottom: 6 }}>{challenge.emoji}</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#FFFFFF", lineHeight: 26 }}>{challenge.title}</Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            {challenge.durationDays}-day challenge · {challenge.participants} participants
          </Text>
        </View>

        {/* Progress ring */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 20, marginBottom: 16,
          alignItems: "center" }}>
          <View style={{ position: "relative", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Svg width={160} height={160} style={{ transform: [{ rotate: "-90deg" }] }}>
              <Circle cx={80} cy={80} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={12} />
              <Circle cx={80} cy={80} r={R} fill="none" stroke="#FF6B35" strokeWidth={12}
                strokeDasharray={`${pct * CIRC} ${CIRC - pct * CIRC}`}
                strokeLinecap="round" />
            </Svg>
            <View style={{ position: "absolute", alignItems: "center" }}>
              <Text style={{ fontSize: 32, fontWeight: "800", color: "#FFFFFF" }}>{Math.round(pct * 100)}%</Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>complete</Text>
            </View>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FF6B35" }}>
            {progress} / {challenge.goal.target} {challenge.goal.unit}
          </Text>
        </View>

        {/* Daily breakdown */}
        {(isNutritionChallenge || challenge.durationDays <= 14) && (
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 }}>
              📅 Daily Breakdown
            </Text>
            {isRunChallenge ? (
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Distance covered</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF6B35" }}>
                    {Number(progress).toFixed(1)} km / {challenge.goal.target} km
                  </Text>
                </View>
                <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                  <View style={{ height: 8, borderRadius: 4, width: `${pct * 100}%`, backgroundColor: "#FF6B35" }} />
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {days.map(({ dayNum, isDone, isCurrent, isFuture }) => (
                  <View key={dayNum} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                    backgroundColor: isCurrent ? "rgba(255,107,53,0.1)" : "transparent",
                    borderRadius: 10, padding: isCurrent ? 8 : 0,
                    borderWidth: isCurrent ? 1 : 0, borderColor: isCurrent ? "rgba(255,107,53,0.3)" : "transparent" }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14,
                      backgroundColor: isDone ? "rgba(16,185,129,0.15)" : isCurrent ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.06)",
                      alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 12 }}>{isDone ? "✅" : isCurrent ? "⏳" : isFuture ? "○" : "—"}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: isDone ? "#10B981" : isCurrent ? "#FF6B35" : isFuture ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)",
                      fontWeight: isCurrent ? "700" : "400" }}>
                      Day {dayNum}
                    </Text>
                    {!isFuture && dailyTarget && (
                      <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: "auto" }}>
                        {isDone ? dailyTarget : isCurrent ? Math.round(progress % dailyTarget || 0) : "—"} / {dailyTarget} meals
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Badge & reward */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16, alignItems: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12, alignSelf: "flex-start" }}>
            🏅 Reward
          </Text>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>{challenge.emoji}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: typeColor, textAlign: "center", lineHeight: 18 }}>
            {challenge.reward}
          </Text>
          {pct < 1 && (
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 6, textAlign: "center" }}>
              {challenge.goal.target - progress} {challenge.goal.unit} more to unlock
            </Text>
          )}
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4, textAlign: "center" }}>
            🎁 Prize: {challenge.prize}
          </Text>
        </View>

        {/* Motivation */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 12, padding: 14,
          marginBottom: 16, borderLeftWidth: 3, borderLeftColor: "#FF6B35" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF6B35", marginBottom: 4 }}>
            Coach TinaBarks 🌸
          </Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 18 }}>
            Keep going! You're {Math.round(pct * 100)}% there! 💪 Every step counts — show the Squad what you're made of!
          </Text>
        </View>

        {/* Leaderboard position */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 }}>
            🏆 Leaderboard
          </Text>
          <View style={{ backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 10, padding: 10, marginBottom: 12,
            borderWidth: 1, borderColor: "rgba(255,107,53,0.3)", alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Your position</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#FF6B35" }}>#{myRank}</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>out of {challenge.participants} participants</Text>
          </View>
          {top3.map((u, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10,
              paddingVertical: 8, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ fontSize: 16, width: 24 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
              </Text>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: u.color,
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 12 }}>{u.initials}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>{u.name}</Text>
              <Text style={{ fontSize: 12, color: "#FF6B35", fontWeight: "700" }}>{u.points} pts</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── COMMUNITY SCREEN ─────────────────────────────────────────────────────────
function CommunityScreen({ navigation }) {
  const { userPoints, unlockedBadges, awardPoints, unlockBadge, profile, dayLog } = useContext(Ctx);
  const { session } = useContext(AuthCtx);
  const { theme } = useTheme();

  const [activeTab,       setActiveTab]       = useState("challenges");
  const [joinedChs,       setJoinedChs]       = useState({});
  const [chProgress,      setChProgress]      = useState({});
  const [feedPosts,       setFeedPosts]        = useState([]);
  const [feedLoading,     setFeedLoading]      = useState(false);
  const [lbFilter,        setLbFilter]         = useState("week");
  const [showPostModal,   setShowPostModal]    = useState(false);
  const [postType,        setPostType]         = useState(null);
  const [customText,      setCustomText]       = useState("");
  const [unlockBadgeData, setUnlockBadgeData] = useState(null);
  const [viewingChallenge,setViewingChallenge] = useState(null);
  const [commentPost,     setCommentPost]      = useState(null); // post being commented on
  const [comments,        setComments]         = useState({});   // { postId: [comment,...] }
  const [commentInput,    setCommentInput]     = useState("");
  const [feedFilter,      setFeedFilter]       = useState("all"); // all|workout|meal|challenge|streak
  const [editingPost,     setEditingPost]      = useState(null);  // { id, content } being edited
  const [editText,        setEditText]         = useState("");
  const [postMenuId,      setPostMenuId]       = useState(null);  // post id with open ⋮ menu
  const [showStandards,   setShowStandards]    = useState(false);
  const [postSubmitting,  setPostSubmitting]   = useState(false);
  const [postToast,       setPostToast]        = useState(null);  // success message string

  const currentUserId   = session?.userId || null;
  const currentEmail    = session?.email  || null;
  const isCoachSession  = session?.userType === "coach";
  const COACH_EMAILS    = ["gofit.fitnessapp@gmail.com", "arintina77@gmail.com"];
  const isCoach         = isCoachSession || COACH_EMAILS.includes((currentEmail || "").toLowerCase());

  // Show community standards once per device
  useEffect(() => {
    (async () => {
      const seen = await AsyncStorage.getItem("hasSeenSquadStandards");
      if (!seen) {
        setShowStandards(true);
        await AsyncStorage.setItem("hasSeenSquadStandards", "true");
      }
    })();
  }, []);

  // ── helpers ──────────────────────────────────────────────────────────────────
  function mapDbPost(row) {
    const type = row.post_type || row.type || "thought";
    const TYPE_EMOJIS = { thought:"💬", workout:"🏃", meal:"🍽️", challenge:"🏆", water:"💧" };
    return {
      id:           row.id,
      userId:       row.user_id,
      userName:     row.user_name || "Member",
      userInitials: row.user_initials || "?",
      isCoach:      row.is_coach || false,
      isPinned:     row.is_pinned || false,
      type,
      emoji:        row.emoji || TYPE_EMOJIS[type] || "✨",
      content:      row.content || "",
      stats:        row.workout_data || null,
      likes:        row.likes || 0,
      likedBy:      row.liked_by || [],
      comments:     row.comments || 0,
      postedAt:     row.created_at,
      edited:       row.edited || false,
      editedAt:     row.edited_at || null,
    };
  }

  function formatTimestamp(ts) {
    if (!ts) return "";
    const diff = Date.now() - new Date(ts).getTime();
    const sec  = Math.floor(diff / 1000);
    const min  = Math.floor(sec / 60);
    const hr   = Math.floor(min / 60);
    const day  = Math.floor(hr / 24);
    if (sec < 60)  return "Just now";
    if (min < 60)  return `${min}m ago`;
    if (hr < 24)   return `${hr}h ago`;
    if (day === 1) return "Yesterday";
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  // ── load feed from Supabase ───────────────────────────────────────────────────
  async function fetchFeed() {
    setFeedLoading(true);
    const { data, error } = await supabase
      .from("squad_feed")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setFeedPosts(data.map(mapDbPost));
    setFeedLoading(false);
  }

  useEffect(() => {
    fetchFeed();
    const channel = supabase
      .channel("squad_feed_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── load challenge join/progress state ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // local fallback
      const [jc, cp] = await Promise.all([
        AsyncStorage.getItem("gofit_joined_challenges"),
        AsyncStorage.getItem("gofit_ch_progress"),
      ]);
      if (jc) setJoinedChs(JSON.parse(jc));
      if (cp) setChProgress(JSON.parse(cp));

      // sync from Supabase if logged in
      if (!currentUserId) return;
      try {
        const { data } = await supabase
          .from("challenge_participants")
          .select("challenge_id, progress, is_active")
          .eq("user_id", currentUserId);
        if (data && data.length > 0) {
          const jMap = {}, pMap = {};
          data.forEach(r => { jMap[r.challenge_id] = r.is_active; pMap[r.challenge_id] = r.progress; });
          setJoinedChs(jMap);
          setChProgress(pMap);
        }
      } catch (_) {}
    })();
  }, [currentUserId]);

  // ── join challenge ────────────────────────────────────────────────────────────
  async function joinChallenge(chId) {
    const next = { ...joinedChs, [chId]: true };
    setJoinedChs(next);
    await AsyncStorage.setItem("gofit_joined_challenges", JSON.stringify(next));
    setChProgress(prev => ({ ...prev, [chId]: prev[chId] || 0 }));
    if (currentUserId) {
      await supabase.from("challenge_participants").upsert(
        { challenge_id: chId, user_id: currentUserId, progress: 0, is_active: true },
        { onConflict: "challenge_id,user_id" }
      );
    }
  }

  // ── like / unlike a post ──────────────────────────────────────────────────────
  async function toggleLike(post) {
    if (!currentUserId) return;
    const uid = currentUserId;
    const alreadyLiked = (post.likedBy || []).includes(uid);
    const newLikedBy   = alreadyLiked
      ? (post.likedBy || []).filter(id => id !== uid)
      : [...(post.likedBy || []), uid];
    const newLikes = Math.max(0, alreadyLiked ? post.likes - 1 : post.likes + 1);

    // optimistic update
    setFeedPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, likes: newLikes, likedBy: newLikedBy } : p));

    await supabase.from("squad_feed")
      .update({ likes: newLikes, liked_by: newLikedBy })
      .eq("id", post.id);
  }

  // ── load comments for a post ──────────────────────────────────────────────────
  async function loadComments(postId) {
    try {
      const { data } = await supabase
        .from("squad_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (data) setComments(prev => ({ ...prev, [postId]: data }));
    } catch (_) {}
  }

  async function submitComment(postId) {
    if (!commentInput.trim()) return;
    const text     = commentInput.trim();
    const initials = (profile?.name || session?.name || "M").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
    const row = {
      post_id:       postId,
      user_id:       currentUserId || null,
      user_name:     profile?.name || session?.name || "Member",
      user_initials: initials,
      is_coach:      isCoachSession,
      content:       text,
    };
    setCommentInput("");
    // optimistic
    const optimistic = { ...row, id: `tmp_${Date.now()}`, created_at: new Date().toISOString() };
    setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), optimistic] }));
    // update comment count optimistically
    setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments + 1 } : p));

    try {
      const { data: inserted } = await supabase.from("squad_comments").insert(row).select().maybeSingle();
      if (inserted) {
        setComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(c => c.id === optimistic.id ? inserted : c),
        }));
        await supabase.from("squad_feed").update({ comments: (feedPosts.find(p=>p.id===postId)?.comments||0)+1 }).eq("id", postId);
      }
    } catch (_) {}
  }

  // ── pin / delete / edit ───────────────────────────────────────────────────────
  async function pinPost(postId, pinned) {
    setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, isPinned: !pinned } : p));
    await supabase.from("squad_feed").update({ is_pinned: !pinned }).eq("id", postId);
  }

  async function deletePost(postId, isCoachAction = false) {
    setFeedPosts(prev => prev.filter(p => p.id !== postId));
    try {
      await supabase.from("squad_feed").delete().eq("id", postId);
    } catch (_) {}
  }

  async function saveEditPost() {
    if (!editingPost || !editText.trim()) return;
    const { id } = editingPost;
    const content = editText.trim();
    setFeedPosts(prev => prev.map(p => p.id === id ? { ...p, content, edited: true } : p));
    setEditingPost(null);
    setEditText("");
    try {
      await supabase.from("squad_feed")
        .update({ content, edited: true, edited_at: new Date().toISOString() })
        .eq("id", id);
    } catch (_) {}
  }

  // ── helpers ──────────────────────────────────────────────────────────────────
  function getInitials(nameOrEmail) {
    if (!nameOrEmail) return "M";
    const parts = nameOrEmail.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nameOrEmail.substring(0, 2).toUpperCase();
  }

  // ── create post ───────────────────────────────────────────────────────────────
  async function handlePost() {
    if (!customText.trim() || !postType) return;
    if (postSubmitting) return;

    const TYPE_EMOJIS = { thought:"💬", workout:"🏃", meal:"🍽️", challenge:"🏆", water:"💧" };
    const em       = TYPE_EMOJIS[postType] || "✨";
    const rawName  = profile?.name || session?.name || session?.email?.split("@")[0] || "Member";
    const initials = getInitials(rawName);

    const row = {
      user_id:       currentUserId?.toString() || "anonymous",
      user_name:     rawName,
      user_initials: initials,
      content:       customText.trim(),
      post_type:     postType || "thought",
      likes:         0,
      liked_by:      [],
    };

    setPostSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from("squad_feed")
        .insert([row])
        .select()
        .maybeSingle();

      if (error) {
        console.log("SUPABASE ERROR:", JSON.stringify(error));
        Alert.alert("Could not post", error.message);
        setPostSubmitting(false);
        return;
      }

      // Close and reset
      setShowPostModal(false);
      setCustomText("");
      setPostType(null);
      setPostSubmitting(false);

      // Refresh feed from Supabase
      fetchFeed();

      // Success toast
      setPostToast("Posted to Squad! 🎉");
      setTimeout(() => setPostToast(null), 2500);

      await awardPoints("share_achievement", POINTS.share_achievement);
      const unlocked = await unlockBadge("community_spark");
      if (unlocked) setUnlockBadgeData(BADGES.find(b => b.id === "community_spark"));
    } catch (err) {
      console.log("SUPABASE CATCH:", err?.message || err);
      Alert.alert("Could not post", err?.message || "Please check your connection and try again.");
      setPostSubmitting(false);
    }
  }

  // My rank on leaderboard (mock: append current user if points available)
  const myPoints = userPoints || 0;
  const myRank   = MOCK_LEADERBOARD.filter(u => u.points > myPoints).length + 1;
  const aheadOf  = MOCK_LEADERBOARD.find(u => u.rank === myRank - 1);

  const CHALLENGE_TYPE_ICONS = { nutrition:"🥗", workout:"🏃", water:"💧", weight_loss:"⚖️", sleep:"😴" };

  // ── CHALLENGES TAB ──
  function ChallengesTab() {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        <Text style={[S.heading, { marginBottom: 4 }]}>Squad Challenges 🏆</Text>
        <Text style={{ color: C.grey, fontSize: 13, marginBottom: 4 }}>Compete. Sweat. Win.</Text>
        <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600", marginBottom: 20 }}>Set by Coach TinaBarks 🌸</Text>

        <Text style={{ color: C.text, fontSize: 15, fontWeight: "700", marginBottom: 12 }}>🔥 Active This Week</Text>

        {PRESET_CHALLENGES.map(ch => {
          const joined   = joinedChs[ch.id];
          const progress = chProgress[ch.id] || 0;
          const pct      = Math.min(progress / ch.goal.target, 1);
          const typeColor = CHALLENGE_TYPE_COLORS[ch.type] || ROSE;
          return (
            <View key={ch.id} style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 14,
              borderLeftWidth: 4, borderLeftColor: typeColor,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1, marginRight: joined ? 8 : 0 }}>
                  <Text style={{ fontSize: 24, marginRight: 10 }}>{ch.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 14 }} numberOfLines={2}>{ch.title}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>👥 {ch.participants} participants · ⏰ {ch.durationDays}d</Text>
                  </View>
                </View>
                {joined && (
                  <View style={{ backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 }}>
                    <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "700" }}>JOINED ✅</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18, marginBottom: 10 }}>{ch.description}</Text>
              {joined && (
                <View style={{ marginBottom: 10 }}>
                  <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{progress} / {ch.goal.target} {ch.goal.unit}</Text>
                    <Text style={{ color: typeColor, fontSize: 12, fontWeight: "700" }}>{Math.round(pct * 100)}%</Text>
                  </Row>
                  <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                    <View style={{ height: 8, borderRadius: 4, width: `${pct * 100}%`, backgroundColor: typeColor }} />
                  </View>
                </View>
              )}
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 8 }}>🎁 Prize: {ch.prize}</Text>
              <Text style={{ color: typeColor, fontSize: 12, fontWeight: "600", marginBottom: 10 }}>🏅 {ch.reward}</Text>
              {!joined ? (
                <TouchableOpacity onPress={() => joinChallenge(ch.id)}
                  style={{ backgroundColor: "#FF6B35", borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14,
                    alignItems: "center", alignSelf: "stretch" }}>
                  <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Join</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setViewingChallenge({ challenge: ch, progress })}
                  style={{ borderWidth: 1.5, borderColor: typeColor, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
                  <Text style={{ color: typeColor, fontWeight: "700", fontSize: 14 }}>View My Progress</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // ── LEADERBOARD TAB ──
  function LeaderboardTab() {
    const top3  = MOCK_LEADERBOARD.slice(0, 3);
    const rest  = MOCK_LEADERBOARD.slice(3);
    const podiumColors = [
      { bg: "rgba(245,158,11,0.12)", border: "#F59E0B", medal: "🥇", label: "1st" },
      { bg: "#1E2837", border: "#9CA3AF", medal: "🥈", label: "2nd" },
      { bg: "rgba(180,83,9,0.12)", border: "#B45309", medal: "🥉", label: "3rd" },
    ];
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Text style={[S.heading, { marginBottom: 4 }]}>Squad Leaderboard 🏆</Text>

        {/* Stats row */}
        <Row style={{ gap: 8, marginBottom: 20 }}>
          {[{ v: "47", l: "Active Members" }, { v: "12,840", l: "Total Points" }, { v: "284", l: "Challenges Done" }].map(s => (
            <View key={s.l} style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 12,
              alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: ROSE, fontWeight: "800", fontSize: 18 }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, textAlign: "center", marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </Row>

        {/* Time filter */}
        <Row style={{ gap: 8, marginBottom: 20 }}>
          {[["week","This Week"],["month","This Month"],["all","All Time"]].map(([k,l]) => (
            <TouchableOpacity key={k} onPress={() => setLbFilter(k)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10,
                backgroundColor: lbFilter === k ? ROSE : "#1E2837",
                alignItems: "center", borderWidth: 1,
                borderColor: lbFilter === k ? ROSE : "rgba(255,255,255,0.12)" }}>
              <Text style={{ color: lbFilter === k ? "#FFF" : "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 12 }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </Row>

        {/* Top 3 podium */}
        <View style={{ marginBottom: 20 }}>
          {/* 1st place */}
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 28 }}>🥇</Text>
            <View style={{ backgroundColor: podiumColors[0].bg, borderRadius: 16, padding: 16,
              borderWidth: 2, borderColor: podiumColors[0].border, alignItems: "center", width: "70%" }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: top3[0].color,
                alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>{top3[0].initials}</Text>
              </View>
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>{top3[0].name}</Text>
              <Text style={{ color: podiumColors[0].border, fontWeight: "700", fontSize: 14 }}>{top3[0].points.toLocaleString()} pts</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>🔥 {top3[0].streak}d streak</Text>
            </View>
          </View>
          {/* 2nd + 3rd */}
          <Row style={{ gap: 10, justifyContent: "center" }}>
            {[1, 2].map(i => (
              <View key={i} style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 24 }}>{podiumColors[i].medal}</Text>
                <View style={{ backgroundColor: podiumColors[i].bg, borderRadius: 14, padding: 12,
                  borderWidth: 1.5, borderColor: podiumColors[i].border, alignItems: "center", width: 130 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: top3[i].color,
                    alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                    <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 14 }}>{top3[i].initials}</Text>
                  </View>
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>{top3[i].name}</Text>
                  <Text style={{ color: podiumColors[i].border, fontWeight: "700", fontSize: 13 }}>{top3[i].points.toLocaleString()} pts</Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>🔥 {top3[i].streak}d</Text>
                </View>
              </View>
            ))}
          </Row>
        </View>

        {/* Rank 4-10 */}
        {rest.map(u => (
          <View key={u.rank} style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 8,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 16, width: 28 }}>#{u.rank}</Text>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: u.color,
              alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 13 }}>{u.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{u.name}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{u.plan} · 🔥 {u.streak}d streak</Text>
            </View>
            <Text style={{ color: ROSE, fontWeight: "800", fontSize: 14 }}>{u.points.toLocaleString()}</Text>
          </View>
        ))}

        {/* My position */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.12)", borderRadius: 16, padding: 16, marginTop: 8,
          borderWidth: 1.5, borderColor: "rgba(255,107,53,0.35)" }}>
          <Text style={{ color: ROSE, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>YOUR POSITION</Text>
          <Row style={{ justifyContent: "space-between" }}>
            <Row>
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>#{myRank}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginLeft: 8 }}>You · {myPoints.toLocaleString()} pts</Text>
            </Row>
            <Text style={{ color: ROSE, fontWeight: "800", fontSize: 15 }}>{myPoints.toLocaleString()}</Text>
          </Row>
          {aheadOf && (
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 6 }}>
              {aheadOf.points - myPoints} points behind #{aheadOf.rank} — keep going! 💪
            </Text>
          )}
        </View>
      </ScrollView>
    );
  }

  // ── FEED POST CARD ────────────────────────────────────────────────────────────
  function FeedPostCard({ post }) {
    const isLiked   = (post.likedBy || []).includes(currentUserId);
    const isOwner   = post.userId === currentUserId;
    const menuOpen  = postMenuId === post.id;

    function openMenu() { setPostMenuId(menuOpen ? null : post.id); }
    function closeMenu() { setPostMenuId(null); }

    function handleEdit() {
      closeMenu();
      setEditingPost(post);
      setEditText(post.content);
    }

    function handleDeleteOwn() {
      closeMenu();
      Alert.alert(
        "Delete this post?",
        "This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => deletePost(post.id) },
        ]
      );
    }

    function handleCoachRemove() {
      closeMenu();
      Alert.alert(
        "Remove post?",
        "Remove this post for violating community standards?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove Post", style: "destructive", onPress: () => deletePost(post.id, true) },
        ]
      );
    }

    const showMenu = isOwner || isCoach;

    return (
      <View style={{
        backgroundColor: post.isPinned ? "rgba(255,107,53,0.08)" : "#111827",
        borderRadius: 16, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: post.isPinned ? "rgba(255,107,53,0.3)" : "rgba(255,255,255,0.06)",
        ...(post.isPinned ? { borderLeftWidth: 4, borderLeftColor: ROSE } : {}),
      }}>
        {post.isPinned && (
          <Text style={{ color: ROSE, fontSize: 11, fontWeight: "700", marginBottom: 6 }}>📌 PINNED</Text>
        )}
        <Row style={{ marginBottom: 8, alignItems: "flex-start" }}>
          <View style={{ width: 36, height: 36, borderRadius: 18,
            backgroundColor: post.isCoach ? ROSE : "#1E6091",
            alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 12 }}>{post.userInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 14 }}>{post.userName}</Text>
              {post.isCoach && (
                <View style={{ backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: ROSE, fontSize: 9, fontWeight: "800" }}>HEAD COACH</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: C.grey, fontSize: 12 }}>{formatTimestamp(post.postedAt)}</Text>
              {post.edited && (
                <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>· edited</Text>
              )}
            </View>
          </View>
          {/* Three-dot menu */}
          {showMenu && (
            <View style={{ position: "relative" }}>
              <TouchableOpacity onPress={openMenu}
                style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center",
                  borderRadius: 8, backgroundColor: menuOpen ? "rgba(255,255,255,0.08)" : "transparent" }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 18, lineHeight: 20 }}>⋮</Text>
              </TouchableOpacity>
              {menuOpen && (
                <View style={{ position: "absolute", right: 0, top: 36, zIndex: 999,
                  backgroundColor: "#1E2837", borderRadius: 12, minWidth: 180,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                  shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10 }}>
                  {isOwner && (
                    <TouchableOpacity onPress={handleEdit}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
                        borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                      <Text style={{ fontSize: 16 }}>✏️</Text>
                      <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>Edit Post</Text>
                    </TouchableOpacity>
                  )}
                  {isOwner && (
                    <TouchableOpacity onPress={handleDeleteOwn}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
                        borderBottomWidth: isCoach ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                      <Text style={{ fontSize: 16 }}>🗑️</Text>
                      <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 14 }}>Delete Post</Text>
                    </TouchableOpacity>
                  )}
                  {isCoach && (
                    <TouchableOpacity onPress={handleCoachRemove}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14 }}>
                      <Text style={{ fontSize: 16 }}>🚫</Text>
                      <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 14 }}>Remove Post</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </Row>
        <Text style={{ color: C.text, fontSize: 14, lineHeight: 20,
          marginBottom: post.stats && Object.keys(post.stats).length > 0 ? 10 : 8 }}>
          {post.emoji} {post.content}
        </Text>
        {post.stats && Object.keys(post.stats).length > 0 && (
          <View style={{ backgroundColor: C.bgSecondary, borderRadius: 10, padding: 10, marginBottom: 10 }}>
            {Object.entries(post.stats).map(([k, v]) => (
              <Text key={k} style={{ color: C.grey, fontSize: 12 }}>
                {k === "distance" ? "📍 " : k === "duration" ? "⏱ " : k === "calories" ? "🔥 " : k === "points" ? "🏆 " : k === "streak" ? "🔥 " : k === "lost" ? "⚖️ " : k === "days" ? "💧 " : "📊 "}{v}
              </Text>
            ))}
          </View>
        )}
        <Row style={{ gap: 16 }}>
          <TouchableOpacity onPress={() => toggleLike(post)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 16 }}>{isLiked ? "❤️" : "🤍"}</Text>
            <Text style={{ color: isLiked ? ROSE : C.grey, fontSize: 13, fontWeight: "600" }}>{post.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { closeMenu(); setCommentPost(post); loadComments(post.id); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 16 }}>💬</Text>
            <Text style={{ color: C.grey, fontSize: 13 }}>{post.comments}</Text>
          </TouchableOpacity>
        </Row>
      </View>
    );
  }

  // ── FEED TAB ──
  function FeedTab() {
    const FILTERS = [
      { key: "all", label: "All" },
      { key: "workout", label: "🏃 Workouts" },
      { key: "meal", label: "🥗 Meals" },
      { key: "challenge", label: "🏆 Challenges" },
      { key: "streak", label: "🔥 Milestones" },
    ];
    const filtered = feedFilter === "all"
      ? feedPosts
      : feedPosts.filter(p => p.type === feedFilter);

    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
          <View>
            <Text style={[S.heading, { marginBottom: 2 }]}>Squad Feed 📢</Text>
            <Text style={{ color: C.grey, fontSize: 13 }}>
              {feedLoading ? "Loading..." : `${feedPosts.length} posts · celebrating every win 🌸`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowPostModal(true)}
            style={{ backgroundColor: ROSE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 13 }}>+ Share</Text>
          </TouchableOpacity>
        </Row>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.key} onPress={() => setFeedFilter(f.key)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: feedFilter === f.key ? ROSE : "#1E2837",
                borderWidth: 1, borderColor: feedFilter === f.key ? ROSE : "rgba(255,255,255,0.1)" }}>
              <Text style={{ color: feedFilter === f.key ? "#FFF" : "rgba(255,255,255,0.6)", fontWeight: "600", fontSize: 12 }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {feedLoading && (
          <View style={{ alignItems: "center", padding: 40 }}>
            <ActivityIndicator size="large" color={ROSE} />
          </View>
        )}
        {!feedLoading && filtered.map(post => (
          <FeedPostCard key={post.id} post={post} />
        ))}
        {!feedLoading && filtered.length === 0 && (
          <View style={{ alignItems: "center", padding: 40 }}>
            <Text style={{ fontSize: 36 }}>📢</Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 12, textAlign: "center" }}>
              No posts yet. Be the first to share!
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  const TABS = [
    { key: "challenges", label: "🏆 Challenges" },
    { key: "leaderboard", label: "📊 Leaderboard" },
    { key: "feed",        label: "📢 Feed" },
  ];

  if (viewingChallenge) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
        <ChallengeProgressScreen
          challenge={viewingChallenge.challenge}
          progress={viewingChallenge.progress}
          onBack={() => setViewingChallenge(null)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.screen}>
      {/* Squad header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>WeGoFit Squad 🏆</Text>
          <Text style={{ color: theme.textSub, fontSize: 13, marginTop: 2 }}>Challenges · Leaderboard · Feed</Text>
        </View>
        <Image source={LOGO_URI} style={{ width: 80, height: 40, resizeMode: "contain" }} />
      </View>

      {/* Tab bar */}
      <View style={{ backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border, paddingTop: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: activeTab === t.key ? ROSE : theme.cardLight,
                borderWidth: 1, borderColor: activeTab === t.key ? ROSE : theme.border }}>
              <Text style={{ color: activeTab === t.key ? "#FFF" : theme.text, fontWeight: "700", fontSize: 13 }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeTab === "challenges"  && <ChallengesTab />}
      {activeTab === "leaderboard" && <LeaderboardTab />}
      {activeTab === "feed"        && <FeedTab />}

      {/* Post creation modal */}
      <Modal visible={showPostModal} animationType="slide" transparent presentationStyle="overFullScreen"
        onRequestClose={() => { if (!postSubmitting) { setShowPostModal(false); setPostType(null); setCustomText(""); } }}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => { if (!postSubmitting) { setShowPostModal(false); setPostType(null); setCustomText(""); } }} accessible={false}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} />
          </TouchableWithoutFeedback>
          <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 44 : 28 }}>
            {/* drag handle */}
            <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />

            {/* STEP 1 — type not yet selected */}
            {!postType && (
              <>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 18, marginBottom: 4 }}>Share with the Squad</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 16 }}>What would you like to share today?</Text>
                {[
                  { t: "thought",   l: "💬 Share a thought",             sub: "What's on your mind today?" },
                  { t: "workout",   l: "🏃 Share a workout",             sub: "How did your workout go?" },
                  { t: "meal",      l: "🍽️ Share a meal win",            sub: "What did you eat well today?" },
                  { t: "challenge", l: "🏆 Share a challenge milestone",  sub: "Share your challenge progress!" },
                  { t: "water",     l: "💧 Share a water goal",           sub: "How much water did you drink?" },
                ].map(o => (
                  <TouchableOpacity key={o.t} onPress={() => setPostType(o.t)}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1E2837",
                      borderRadius: 12, padding: 14, marginBottom: 8,
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{o.l}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{o.sub}</Text>
                    </View>
                    <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 18 }}>›</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* STEP 2 — type selected, show text input */}
            {!!postType && (
              <>
                {/* Back + type label header */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 10 }}>
                  <TouchableOpacity onPress={() => { setPostType(null); setCustomText(""); }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: "rgba(255,255,255,0.07)" }}>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>‹ Back</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>
                      {{ thought:"💬 Share a thought", workout:"🏃 Share a workout",
                         meal:"🍽️ Share a meal win", challenge:"🏆 Challenge milestone",
                         water:"💧 Water goal" }[postType]}
                    </Text>
                  </View>
                </View>

                {/* Required text input */}
                <TextInput
                  style={{ backgroundColor: "#1E2837", borderColor: ROSE, borderWidth: 1.5,
                    borderRadius: 12, color: "#FFFFFF", fontSize: 15, padding: 14,
                    minHeight: 100, textAlignVertical: "top", marginBottom: 16 }}
                  placeholder={
                    { thought: "What's on your mind today?",
                      workout: "How did your workout go?",
                      meal:    "What did you eat well today?",
                      challenge: "Share your challenge progress!",
                      water:   "How much water did you drink?" }[postType]
                  }
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={customText}
                  onChangeText={setCustomText}
                  multiline
                  autoFocus
                />

                {/* Post button — disabled when empty */}
                <TouchableOpacity
                  onPress={handlePost}
                  disabled={!customText.trim() || postSubmitting}
                  style={{ borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center",
                    backgroundColor: customText.trim() && !postSubmitting ? ROSE : "rgba(255,255,255,0.1)" }}>
                  {postSubmitting
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={{ fontWeight: "800", fontSize: 16,
                        color: customText.trim() ? "#FFFFFF" : "rgba(255,255,255,0.3)" }}>
                        Post to Community 📢
                      </Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments modal */}
      <Modal visible={!!commentPost} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => setCommentPost(null)} accessible={false}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
          </TouchableWithoutFeedback>
          <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: "70%", paddingBottom: Platform.OS === "ios" ? 36 : 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 12 }} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>
                💬 Comments ({commentPost ? (comments[commentPost.id] || []).length : 0})
              </Text>
              {commentPost && (
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {commentPost.emoji} {commentPost.content}
                </Text>
              )}
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
              {commentPost && (comments[commentPost.id] || []).length === 0 && (
                <Text style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 20, fontSize: 13 }}>
                  No comments yet. Be the first!
                </Text>
              )}
              {commentPost && (comments[commentPost.id] || []).map((c, i) => (
                <View key={c.id || i} style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, flexShrink: 0,
                    backgroundColor: c.is_coach ? ROSE : "#6366F1",
                    alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 10 }}>{c.user_initials || "?"}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 10,
                    borderWidth: c.is_coach ? 1 : 0, borderColor: c.is_coach ? "rgba(255,107,53,0.4)" : "transparent" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <Text style={{ color: c.is_coach ? ROSE : "#FFFFFF", fontWeight: "700", fontSize: 12 }}>
                        {c.user_name || "Member"}
                      </Text>
                      {c.is_coach && (
                        <View style={{ backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                          <Text style={{ color: ROSE, fontSize: 8, fontWeight: "800" }}>COACH</Text>
                        </View>
                      )}
                      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginLeft: "auto" }}>
                        {timeAgo(c.created_at)}
                      </Text>
                    </View>
                    <Text style={{ color: c.is_coach ? "rgba(255,200,150,0.9)" : "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 18 }}>
                      {c.content}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10,
              borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
              <TextInput
                style={[S.input, { flex: 1, minHeight: 40, paddingVertical: 10 }]}
                placeholder="Write a comment..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={commentInput}
                onChangeText={setCommentInput}
                returnKeyType="send"
                onSubmitEditing={() => commentPost && submitComment(commentPost.id)}
              />
              <TouchableOpacity
                onPress={() => commentPost && submitComment(commentPost.id)}
                style={{ backgroundColor: commentInput.trim() ? ROSE : "rgba(255,107,53,0.3)",
                  borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Success toast */}
      {!!postToast && (
        <View style={{ position: "absolute", bottom: 100, left: 20, right: 20, zIndex: 9999,
          backgroundColor: "#22C55E", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
          flexDirection: "row", alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>{postToast}</Text>
        </View>
      )}

      {/* Edit post modal */}
      <Modal visible={!!editingPost} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => { setEditingPost(null); setEditText(""); }} accessible={false}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
          </TouchableWithoutFeedback>
          <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 32 }}>
            <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 18, marginBottom: 4 }}>Edit Post</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 16 }}>Update your message to the Squad</Text>
            <TextInput
              style={[S.input, { minHeight: 100, textAlignVertical: "top", marginBottom: 16 }]}
              placeholder="What's on your mind?"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => { setEditingPost(null); setEditText(""); }}
                style={{ flex: 1, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)", borderRadius: 14,
                  paddingVertical: 14, alignItems: "center" }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontWeight: "700", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEditPost}
                style={{ flex: 2, backgroundColor: editText.trim() ? ROSE : "rgba(255,107,53,0.4)",
                  borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Community standards modal — shown once */}
      <Modal visible={showStandards} animationType="fade" transparent presentationStyle="overFullScreen">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 24, width: "90%" }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 24 }}>🧡</Text>
              <Text style={{ flex: 1, color: "#FFFFFF", fontWeight: "800", fontSize: 18, textAlign: "center" }}>
                WeGoFit Squad Standards
              </Text>
              <TouchableOpacity onPress={() => setShowStandards(false)} style={{ padding: 4 }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 20, lineHeight: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {/* Divider */}
            <View style={{ height: 2, backgroundColor: ROSE, borderRadius: 1, marginBottom: 16 }} />
            {/* Body */}
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 22, marginBottom: 20 }}>
              {"WeGoFit Squad is a safe space to celebrate wins, share progress and lift each other up. 💪\n\n✅ Be kind and encouraging\n✅ Celebrate each other's wins\n✅ Share your real journey\n✅ Motivate — never criticise\n\n❌ No negativity or put-downs\n❌ No disrespectful language\n❌ No content that tears others down\n\nWe're all on this journey together. Let's grow stronger as one Squad! 🧡"}
            </Text>
            {/* CTA */}
            <TouchableOpacity onPress={() => setShowStandards(false)}
              style={{ backgroundColor: ROSE, borderRadius: 12, height: 50, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>I Understand — Let's Go! 💪</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Badge unlock overlay */}
      {unlockBadgeData && (
        <BadgeUnlockOverlay
          badge={unlockBadgeData}
          onClose={() => setUnlockBadgeData(null)}
          onShare={() => { setUnlockBadgeData(null); setShowPostModal(true); }}
          onViewAll={() => { setUnlockBadgeData(null); navigation?.navigate("Profile"); }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── COACH CHALLENGES SCREEN ──────────────────────────────────────────────────
function ParticipantsModal({ challenge, onClose }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, name, email, created_at, last_active")
          .neq("email", COACH_CREDENTIALS.email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(challenge.participants || 20);
        if (data && data.length > 0) {
          setParticipants(data);
        } else {
          setParticipants([]);
        }
      } catch (_e) {
        setParticipants([]);
      }
      setLoading(false);
    }
    load();
  }, [challenge.id]);

  const count = participants.length || challenge.participants;

  return (
    <Modal visible animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight: SH * 0.82, paddingBottom: 40 }}>
          {/* drag handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)",
            alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
          {/* header */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 16,
            borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 4 }}>
              {challenge.emoji} {challenge.title}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
              {count} participant{count !== 1 ? "s" : ""}
            </Text>
          </View>
          {/* list */}
          {loading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Loading participants...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
              {participants.length > 0 ? participants.map((p, i) => (
                <View key={p.id || i} style={{ backgroundColor: "#1E2837", borderRadius: 12,
                  padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{p.name || "Client"}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                      Joined {new Date(p.created_at).toLocaleDateString()}
                    </Text>
                    {p.last_active && (
                      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 1 }}>
                        Last active: {p.last_active}
                      </Text>
                    )}
                  </View>
                  <View style={{ backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 20,
                    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,107,53,0.3)" }}>
                    <Text style={{ color: ROSE, fontSize: 11, fontWeight: "700" }}>In Progress</Text>
                  </View>
                </View>
              )) : (
                Array.from({ length: challenge.participants || 5 }, (_, i) => (
                  <View key={i} style={{ backgroundColor: "#1E2837", borderRadius: 12,
                    padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>Client {i + 1}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                        Joined {new Date(Date.now() - i * 86400000).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 20,
                      paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,107,53,0.3)" }}>
                      <Text style={{ color: ROSE, fontSize: 11, fontWeight: "700" }}>In Progress</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
          <TouchableOpacity onPress={onClose}
            style={{ marginHorizontal: 20, marginTop: 8, backgroundColor: "#1E2837", borderRadius: 12,
              paddingVertical: 14, alignItems: "center" }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CoachChallenges() {
  const [showCreate,      setShowCreate]      = useState(false);
  const [title,           setTitle]           = useState("");
  const [desc,            setDesc]            = useState("");
  const [duration,        setDuration]        = useState("7");
  const [prize,           setPrize]           = useState("");
  const [viewChallenge,   setViewChallenge]   = useState(null);

  async function handleCreate() {
    if (!title.trim()) return;
    Alert.alert("Challenge Created! 🎉", `"${title}" has been added and is now visible to all clients.`);
    setTitle(""); setDesc(""); setDuration("7"); setPrize(""); setShowCreate(false);
  }

  return (
    <SafeAreaView style={S.screen}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      {viewChallenge && (
        <ParticipantsModal challenge={viewChallenge} onClose={() => setViewChallenge(null)} />
      )}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 22, marginBottom: 4 }}>🏆 Challenge Manager</Text>
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 20 }}>Create and manage community challenges</Text>

        {/* Active challenges */}
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16, marginBottom: 12 }}>Active Challenges</Text>
        {PRESET_CHALLENGES.map(ch => (
          <View key={ch.id} style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 10,
            borderLeftWidth: 3, borderLeftColor: ROSE,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{ch.emoji} {ch.title}</Text>
              <View style={{ backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 20,
                paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ color: "#22C55E", fontSize: 11, fontWeight: "700" }}>ACTIVE</Text>
              </View>
            </Row>
            <Row style={{ gap: 16 }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>👥 {ch.participants} joined</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>⏰ {ch.durationDays}d duration</Text>
            </Row>
            <Row style={{ gap: 8, marginTop: 10 }}>
              <TouchableOpacity onPress={() => Alert.alert("Edit", "Edit functionality coming soon.")}
                style={{ backgroundColor: "#1E2837", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("End Early", "End Early functionality coming soon.")}
                style={{ backgroundColor: "#1E2837", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" }}>End Early</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewChallenge(ch)}
                style={{ backgroundColor: ROSE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>View Participants</Text>
              </TouchableOpacity>
            </Row>
          </View>
        ))}

        {/* Create challenge */}
        <TouchableOpacity onPress={() => setShowCreate(v => !v)}
          style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8, marginBottom: 16 }}>
          <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>+ Create New Challenge</Text>
        </TouchableOpacity>

        {showCreate && (
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16, marginBottom: 14 }}>New Challenge</Text>
            {[
              { l:"Challenge Title", v:title,    sv:setTitle,    ph:"e.g. 7-Day Step Challenge", kb:"default"  },
              { l:"Description",     v:desc,     sv:setDesc,     ph:"What do participants need to do?", kb:"default" },
              { l:"Duration (days)", v:duration, sv:setDuration, ph:"7",                           kb:"numeric"  },
              { l:"Prize / Reward",  v:prize,    sv:setPrize,    ph:"e.g. Free month subscription", kb:"default" },
            ].map(f => (
              <View key={f.l} style={{ marginBottom: 14 }}>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>{f.l}</Text>
                <TextInput style={S.input} placeholder={f.ph} placeholderTextColor="rgba(255,255,255,0.3)"
                  value={f.v} onChangeText={f.sv} keyboardType={f.kb}
                  multiline={f.l === "Description"} />
              </View>
            ))}
            <TouchableOpacity onPress={handleCreate}
              style={{ backgroundColor: ROSE, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Create Challenge 🏆</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Leaderboard view */}
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16, marginTop: 20, marginBottom: 12 }}>Client Leaderboard</Text>
        {MOCK_LEADERBOARD.map(u => (
          <View key={u.rank} style={{ backgroundColor: "#111827", borderRadius: 12, padding: 12, marginBottom: 8,
            flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", width: 24, fontSize: 14 }}>#{u.rank}</Text>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: u.color,
              alignItems: "center", justifyContent: "center", marginRight: 10 }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 12 }}>{u.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>{u.name}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>🔥 {u.streak}d streak</Text>
            </View>
            <View>
              <Text style={{ color: ROSE, fontWeight: "800", fontSize: 14 }}>{u.points.toLocaleString()}</Text>
              <TouchableOpacity onPress={() => Alert.alert("Motivation Sent!", `Message sent to ${u.name} 💪`)}
                style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 }}>
                <Text style={{ color: ROSE, fontSize: 10, fontWeight: "600" }}>Send Motivation</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── WORKOUT PROGRESS — DATA HELPERS ─────────────────────────────────────────

function isRealWorkout(ex) {
  if (ex.source === "VIDEO_WATCHED" || ex.source === "VIDEO_COMPLETED" ||
      ex.source === "video" || ex.source === "MOCK" ||
      ex.type === "video" || ex.isVideo === true) return false;
  // Accept both camelCase (durationMin) and snake_case (duration_min) field names
  const hasDuration = ex.durationMin || ex.duration_min || ex.duration_sec;
  if (!hasDuration && !ex.caloriesBurned) return false;
  return true;
}

async function getAllWorkoutSessions(userId) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pfxPart = userId ? `_${userId}` : "";
    const logKeys = keys.filter(k => k.startsWith(`gf_log${pfxPart}_`));
    const sessions = [];
    for (const key of logKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      const log = JSON.parse(raw);
      if (log.exercise && log.exercise.length > 0) {
        log.exercise.forEach(ex => {
          if (!isRealWorkout(ex)) return;
          sessions.push({ ...ex, date: log.date || key.split("_").pop() });
        });
      }
    }
    return sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (_e) { return []; }
}

function filterSessionsByRange(sessions, range) {
  const now   = new Date();
  const cutoff = new Date();
  if      (range === "week")    cutoff.setDate(now.getDate() - 7);
  else if (range === "month")   cutoff.setDate(now.getDate() - 30);
  else if (range === "3months") cutoff.setDate(now.getDate() - 90);
  else                          cutoff.setFullYear(2020);
  return sessions.filter(s => new Date(s.date) >= cutoff);
}

function groupByMonth(sessions) {
  const groups = {};
  sessions.forEach(s => {
    const key = (s.date || "").substring(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return groups;
}

function getFavouriteType(sessions) {
  const counts = {};
  sessions.forEach(s => { const t = s.name || "Other"; counts[t] = (counts[t] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";
}

function calcStreak(sessions) {
  if (!sessions.length) return 0;
  const dates = [...new Set(sessions.map(s => (s.date || "").substring(0, 10)))].sort();
  let maxStreak = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    cur = diff === 1 ? cur + 1 : 1;
    if (cur > maxStreak) maxStreak = cur;
  }
  return maxStreak;
}

function calcPersonalBests(sessions) {
  if (!sessions.length) return null;
  return {
    longestDistance: Math.max(0, ...sessions.map(s => s.distance_km || 0)),
    fastestSpeed:    Math.max(0, ...sessions.map(s => s.maxSpeed || s.avgSpeed || 0)),
    mostCalories:    Math.max(0, ...sessions.map(s => s.caloriesBurned || 0)),
    longestDuration: Math.max(0, ...sessions.map(s => s.durationMin || Math.round((s.duration_sec || 0) / 60))),
    bestIntegrity:   Math.max(0, ...sessions.map(s => s.integrityScore || 0)),
    totalSessions:   sessions.length,
    totalDistance:   sessions.reduce((t, s) => t + (s.distance_km || 0), 0),
    totalCalories:   sessions.reduce((t, s) => t + (s.caloriesBurned || 0), 0),
    totalMinutes:    sessions.reduce((t, s) => t + (s.durationMin || Math.round((s.duration_sec || 0) / 60)), 0),
    favouriteType:   getFavouriteType(sessions),
    longestStreak:   calcStreak(sessions),
  };
}

function calcTrend(sessions) {
  if (sessions.length < 4) return "not_enough_data";
  const mid = Math.floor(sessions.length / 2);
  const avgFirst = sessions.slice(0, mid).reduce((s, x) => s + (x.caloriesBurned || 0), 0) / mid;
  const avgLast  = sessions.slice(mid).reduce((s, x) => s + (x.caloriesBurned || 0), 0) / (sessions.length - mid);
  const diff = avgLast - avgFirst;
  if (diff > 20)  return "improving";
  if (diff < -20) return "declining";
  return "maintaining";
}

function getWorkoutTypeColor(name) {
  const t = (name || "").toLowerCase();
  if (t.includes("run"))   return "#FF6B35";
  if (t.includes("cycl"))  return "#60A5FA";
  if (t.includes("walk"))  return "#34D399";
  if (t.includes("hiit"))  return "#FBBF24";
  if (t.includes("hik"))   return "#A78BFA";
  if (t.includes("danc"))  return "#F472B6";
  if (t.includes("jump"))  return "#22D3EE";
  if (t.includes("squat")) return "#FF6B35";
  return "#FF6B35";
}

function getWorkoutEmoji(name) {
  const t = (name || "").toLowerCase();
  if (t.includes("run"))   return "🏃";
  if (t.includes("cycl"))  return "🚴";
  if (t.includes("walk"))  return "🚶";
  if (t.includes("hiit"))  return "⚡";
  if (t.includes("hik"))   return "🥾";
  if (t.includes("danc"))  return "💃";
  if (t.includes("jump"))  return "🪢";
  if (t.includes("squat")) return "🏋️";
  return "💪";
}

// ─── PROGRESS SCREEN CHART CONSTANTS ─────────────────────────────────────────
const CHART_W      = SW - 32;
const CHART_H      = 200;
const SCREEN_WIDTH  = SW;
const SCREEN_HEIGHT = Dimensions.get("window").height;

// ─── CALENDAR COLOUR SYSTEM ───────────────────────────────────────────────────
const CAL_COLORS = {
  rest:         "#111827",
  light:        "rgba(255,107,53,0.2)",
  moderate:     "rgba(255,107,53,0.4)",
  good:         "rgba(255,107,53,0.7)",
  intense:      "#FF6B35",
  restText:     "rgba(255,255,255,0.5)",
  activeText:   "#FFFFFF",
  todayText:    "#FFFFFF",
  today:        "#FF6B35",
  headerBg:     "#111827",
  headerText:   "#FFFFFF",
  headerAccent: "#FF6B35",
  gridBorder:   "rgba(255,255,255,0.06)",
  weekdayLabel: "rgba(255,255,255,0.5)",
  detailBg:     "#111827",
  detailBorder: "#FF6B35",
  detailHeader: "#111827",
};

function getCalorieBg(cal) {
  if (!cal || cal === 0) return CAL_COLORS.rest;
  if (cal < 150)         return CAL_COLORS.light;
  if (cal < 300)         return CAL_COLORS.moderate;
  if (cal < 450)         return CAL_COLORS.good;
  return                        CAL_COLORS.intense;
}

// ─── RANGE SELECTOR ───────────────────────────────────────────────────────────
function RangeSelector({ range, onChange, theme }) {
  const options = [
    { key: "week",     label: "Week"      },
    { key: "month",    label: "Month"     },
    { key: "3months",  label: "3 Months"  },
    { key: "calendar", label: "📅 Calendar"},
  ];
  return (
    <View style={{ flexDirection: "row", backgroundColor: theme.cardLight,
      borderRadius: 14, padding: 4, marginBottom: 16 }}>
      {options.map(opt => {
        const isAct = range === opt.key;
        return (
          <TouchableOpacity key={opt.key} onPress={() => onChange(opt.key)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
              backgroundColor: isAct ? theme.card : "transparent",
              shadowColor: isAct ? "#000" : "transparent",
              shadowOpacity: isAct ? 0.08 : 0, shadowRadius: 4, elevation: isAct ? 2 : 0 }}>
            <Text style={{ fontSize: 12, fontWeight: isAct ? "700" : "500",
              color: isAct ? ROSE : theme.textSub }}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── SUMMARY STATS ROW ────────────────────────────────────────────────────────
function SummaryStatsRow({ sessions, theme }) {
  const totalCal  = sessions.reduce((s, x) => s + (x.caloriesBurned || 0), 0);
  const totalKm   = sessions.reduce((s, x) => s + (x.distance_km || 0), 0);
  const totalMins = sessions.reduce((s, x) => s + (x.durationMin || Math.round((x.duration_sec || 0) / 60)), 0);
  const stats = [
    { label: "Sessions", value: sessions.length,      unit: "",    emoji: "💪", color: "#F43F8E" },
    { label: "Calories",  value: Math.round(totalCal), unit: "cal", emoji: "🔥", color: "#F59E0B" },
    { label: "Distance",  value: totalKm.toFixed(1),   unit: "km",  emoji: "📍", color: "#10B981" },
    { label: "Minutes",   value: totalMins,             unit: "min", emoji: "⏱", color: "#3B82F6" },
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {stats.map(stat => (
        <View key={stat.label} style={{ flex: 1, minWidth: "45%", backgroundColor: theme.card,
          borderRadius: 16, padding: 14, alignItems: "center",
          borderWidth: 1, borderColor: theme.border,
          shadowColor: stat.color, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 22 }}>{stat.emoji}</Text>
          <Text style={{ fontSize: 22, fontWeight: "800", color: stat.color, marginTop: 4 }}>
            {stat.value}<Text style={{ fontSize: 11, color: theme.textSub }}>{stat.unit}</Text>
          </Text>
          <Text style={{ fontSize: 11, color: theme.textSub, marginTop: 2 }}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── MAIN BAR CHART ───────────────────────────────────────────────────────────
// ─── BAR TOOLTIP ─────────────────────────────────────────────────────────────
function BarTooltip({ bar, x, theme }) {
  if (!bar) return null;
  const totalCal = (bar.sessions || []).reduce((s, x) => s + (x.caloriesBurned || 0), 0);
  const totalKm  = (bar.sessions || []).reduce((s, x) => s + (x.distance_km   || 0), 0);
  const totalMin = (bar.sessions || []).reduce((s, x) => s + (x.durationMin   || Math.round((x.duration_sec || 0) / 60)), 0);
  const left     = Math.max(8, Math.min(x - 90, CHART_W - 200));
  return (
    <View style={{ position: "absolute", top: 0, left: left, width: 185,
      backgroundColor: theme.card, borderRadius: 14, padding: 12,
      borderWidth: 1.5, borderColor: ROSE,
      shadowColor: ROSE, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6, zIndex: 999 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: ROSE, marginBottom: 6 }}>
        📅 {bar.fullDate || bar.label}
      </Text>
      <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 6 }} />
      {(bar.sessions || []).length === 0 ? (
        <Text style={{ fontSize: 12, color: theme.textSub, fontStyle: "italic" }}>Rest day 😴</Text>
      ) : (
        <>
          <Text style={{ fontSize: 12, color: theme.textSub, marginBottom: 3 }}>💪 {bar.sessions.length} session{bar.sessions.length > 1 ? "s" : ""}</Text>
          <Text style={{ fontSize: 12, color: theme.textSub, marginBottom: 3 }}>🔥 {Math.round(totalCal)} cal burned</Text>
          {totalKm > 0 && <Text style={{ fontSize: 12, color: theme.textSub, marginBottom: 3 }}>📍 {totalKm.toFixed(1)}km covered</Text>}
          <Text style={{ fontSize: 12, color: theme.textSub, marginBottom: 6 }}>⏱ {totalMin} minutes total</Text>
          {bar.sessions.map((s, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 2, gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getWorkoutTypeColor(s.name) }} />
              <Text style={{ fontSize: 11, color: theme.text, flex: 1 }}>{s.name} · {s.caloriesBurned || 0}cal</Text>
              {s.integrityScore > 0 && (
                <Text style={{ fontSize: 10, color: s.verified ? "#10B981" : "#F59E0B" }}>
                  {s.verified ? "✅" : "⚠️"}{s.integrityScore}
                </Text>
              )}
            </View>
          ))}
        </>
      )}
      <Text style={{ fontSize: 10, color: theme.textSub, marginTop: 8, textAlign: "center", fontStyle: "italic" }}>
        tap bar again to close
      </Text>
    </View>
  );
}

// ─── MAIN BAR CHART ───────────────────────────────────────────────────────────
function MainBarChart({ sessions, range, theme }) {
  const [selectedBar, setSelectedBar] = useState(null);

  let bars = [];
  if (range === "week") {
    for (let i = 6; i >= 0; i--) {
      const d   = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().substring(0, 10);
      const day = sessions.filter(s => (s.date || "").substring(0, 10) === key);
      bars.push({
        label:    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()],
        fullDate: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
        date:     key,
        value:    day.reduce((s, x) => s + (x.caloriesBurned || 0), 0),
        count:    day.length,
        isToday:  i === 0,
        sessions: day,
      });
    }
  } else if (range === "month") {
    for (let w = 3; w >= 0; w--) {
      const start = new Date(); start.setDate(start.getDate() - (w + 1) * 7);
      const end   = new Date(); end.setDate(end.getDate() - w * 7);
      const week  = sessions.filter(s => { const d = new Date(s.date); return d >= start && d < end; });
      const startStr = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const endStr   = end.toLocaleDateString("en-GB",   { day: "numeric", month: "short" });
      bars.push({
        label:    startStr.split(" ")[0] + "-" + endStr.split(" ")[0],
        fullDate: startStr + " – " + endStr,
        value:    week.reduce((s, x) => s + (x.caloriesBurned || 0), 0),
        count:    week.length,
        sessions: week,
      });
    }
  } else if (range === "3months") {
    let lastMonth = -1;
    for (let w = 11; w >= 0; w--) {
      const start = new Date(); start.setDate(start.getDate() - (w + 1) * 7);
      const end   = new Date(); end.setDate(end.getDate() - w * 7);
      const week  = sessions.filter(s => { const d = new Date(s.date); return d >= start && d < end; });
      const month = start.getMonth();
      const lbl   = month !== lastMonth ? start.toLocaleDateString("en-GB", { month: "short" }) : "";
      lastMonth   = month;
      bars.push({
        label:    lbl,
        fullDate: "Week of " + start.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        value:    week.reduce((s, x) => s + (x.caloriesBurned || 0), 0),
        count:    week.length,
        sessions: week,
      });
    }
  } else {
    let lastYear = -1;
    const byMonth = groupByMonth(sessions);
    Object.entries(byMonth).sort().forEach(([key, s]) => {
      const d  = new Date(key + "-01");
      const yr = d.getFullYear();
      bars.push({
        label:     d.toLocaleDateString("en-GB", { month: "short" }),
        fullDate:  d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        monthKey:  key,
        showYear:  yr !== lastYear,
        yearLabel: String(yr),
        value:     s.reduce((t, x) => t + (x.caloriesBurned || 0), 0),
        count:     s.length,
        sessions:  s,
      });
      lastYear = yr;
    });
  }

  const chartH = CHART_H;
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  const BAR_W  = Math.max(4, Math.floor((CHART_W - 64) / Math.max(bars.length, 1)) - 4);
  const innerW = CHART_W - 48;

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => setSelectedBar(null)} style={{ marginBottom: 16 }}>
    <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 16,
      borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 16 }}>
        🔥 Calories Burned
      </Text>

      <View style={{ position: "relative" }}>
        <Svg width={innerW} height={chartH}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
            <Line key={i} x1={0} y1={chartH * (1 - pct) - 20} x2={innerW} y2={chartH * (1 - pct) - 20}
              stroke={theme.border} strokeWidth={0.5} strokeDasharray="4 4" />
          ))}
          {bars.map((bar, i) => {
            const barH       = bar.value > 0 ? Math.max(4, (bar.value / maxVal) * (chartH - 40)) : 4;
            const x          = i * (BAR_W + 4) + 2;
            const y          = chartH - barH - 20;
            const isSelected = selectedBar?.index === i;
            const color      = isSelected ? ROSE : bar.isToday ? ROSE : bar.value > 0 ? ROSE + "99" : theme.border;
            return (
              <G key={i} onPress={(e) => { e.stopPropagation?.(); setSelectedBar(isSelected ? null : { ...bar, index: i, x: x + BAR_W / 2 }); }}>
                {isSelected && (
                  <Rect x={i * (BAR_W + 4)} y={0} width={BAR_W + 4} height={chartH - 20}
                    fill={ROSE} opacity={0.06} rx={4} />
                )}
                <Rect x={x} y={y} width={BAR_W} height={barH} rx={4} fill={color} opacity={isSelected ? 1 : 0.85} />
                {isSelected && (
                  <Rect x={x} y={y} width={BAR_W} height={barH} rx={4} fill="none" stroke={ROSE} strokeWidth={2} />
                )}
                {bar.count > 0 && (
                  <Circle cx={x + BAR_W / 2} cy={y - 8} r={4} fill={ROSE} />
                )}
                <SvgText x={x + BAR_W / 2} y={chartH - 4} textAnchor="middle"
                  fontSize={9} fill={isSelected || bar.isToday ? ROSE : theme.textSub}
                  fontWeight={isSelected || bar.isToday ? "700" : "400"}>
                  {bar.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {selectedBar && (
          <BarTooltip bar={selectedBar} x={selectedBar.x} theme={theme} />
        )}
      </View>

      {/* Week view: date numbers below labels */}
      {range === "week" && (
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 4, paddingHorizontal: 2 }}>
          {bars.map((bar, i) => (
            <TouchableOpacity key={i}
              onPress={() => setSelectedBar(selectedBar?.index === i ? null : { ...bar, index: i, x: i * (BAR_W + 4) + BAR_W / 2 + 2 })}
              style={{ flex: 1, alignItems: "center", padding: 4, borderRadius: 8,
                backgroundColor: selectedBar?.index === i ? "#FFF5F7" : "transparent" }}>
              <Text style={{ fontSize: 9, color: bar.isToday ? ROSE : theme.textSub,
                fontWeight: bar.isToday ? "700" : "400", textAlign: "center" }}>
                {new Date(bar.date).getDate()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Month view: best week banner */}
      {range === "month" && (() => {
        const bestBar = [...bars].sort((a, b) => b.value - a.value)[0];
        if (!bestBar || bestBar.value === 0) return null;
        return (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5F7",
            borderRadius: 10, padding: 10, marginTop: 8, gap: 8 }}>
            <Text style={{ fontSize: 18 }}>🏆</Text>
            <Text style={{ fontSize: 12, color: theme.text, flex: 1 }}>
              <Text style={{ fontWeight: "700", color: ROSE }}>Best week: </Text>
              {bestBar.fullDate} — {bestBar.count} session{bestBar.count !== 1 ? "s" : ""}, {Math.round(bestBar.value)} cal
            </Text>
          </View>
        );
      })()}

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 }}>
        {[{ color: ROSE, label: "Calories burned" }, { color: ROSE, label: "• = session logged" }].map(item => (
          <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
            <Text style={{ fontSize: 10, color: theme.textSub }}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
    </TouchableOpacity>
  );
}

// ─── BEST DAY CALLOUT ─────────────────────────────────────────────────────────
function BestDayCallout({ calByDate, theme }) {
  const entries = Object.entries(calByDate);
  if (!entries.length) return null;
  const [bestDate, bestCal] = entries.sort((a, b) => b[1] - a[1])[0];
  const dateStr = new Date(bestDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5F7",
      borderRadius: 12, padding: 12, marginTop: 12, gap: 10 }}>
      <Text style={{ fontSize: 28 }}>🏆</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: ROSE }}>Your Best Day</Text>
        <Text style={{ fontSize: 12, color: theme.text, marginTop: 2 }}>{dateStr}</Text>
        <Text style={{ fontSize: 12, color: theme.textSub, marginTop: 2 }}>🔥 {Math.round(bestCal)} calories burned</Text>
      </View>
    </View>
  );
}

// ─── FITNESS CALENDAR ─────────────────────────────────────────────────────────

function CalendarHeader({ monthName, monthStats, onPrev, onNext, isCurrentMonth, onTitlePress }) {
  return (
    <View style={{ backgroundColor: CAL_COLORS.headerBg, borderRadius: 20, padding: 20, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <TouchableOpacity onPress={onPrev}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "600" }}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onTitlePress} style={{ alignItems: "center" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", letterSpacing: -0.5 }}>{monthName}</Text>
          <Text style={{ color: CAL_COLORS.headerAccent, fontSize: 11, marginTop: 2 }}>tap to jump to any month</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} activeOpacity={isCurrentMonth ? 1 : 0.7}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isCurrentMonth ? "transparent" : "#FFFFFF15",
            alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: isCurrentMonth ? "#FFFFFF30" : "#FFFFFF", fontSize: 22, fontWeight: "600" }}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {[
          { label: "Sessions",    value: monthStats.sessions,    emoji: "💪" },
          { label: "Active Days", value: monthStats.activeDays,  emoji: "📅" },
          { label: "Calories",    value: monthStats.calories > 999 ? (monthStats.calories / 1000).toFixed(1) + "k" : monthStats.calories, emoji: "🔥" },
          { label: "Best Day",    value: monthStats.bestDay ? monthStats.bestDayCal + "cal" : "—", emoji: "🏆" },
        ].map(stat => (
          <View key={stat.label} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 16 }}>{stat.emoji}</Text>
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginTop: 4 }}>{stat.value}</Text>
            <Text style={{ color: "#FFFFFF80", fontSize: 10, marginTop: 2 }}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CalendarGrid({ year, month, sessionMap, bestDayKey, selectedDay, onDayPress, theme }) {
  const today     = new Date();
  const todayKey  = today.toISOString().substring(0, 10);
  const firstDay  = new Date(year, month, 1);
  const lastDay   = new Date(year, month + 1, 0);
  const daysInMo  = lastDay.getDate();
  let startDow    = firstDay.getDay();
  startDow        = startDow === 0 ? 6 : startDow - 1;

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMo; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({
      day: d, dateKey,
      sessions:   sessionMap[dateKey] || [],
      isToday:    dateKey === todayKey,
      isBest:     dateKey === bestDayKey,
      isFuture:   new Date(dateKey + "T12:00:00") > today,
      isSelected: dateKey === selectedDay,
    });
  }

  const CELL = Math.floor((SCREEN_WIDTH - 48) / 7);
  const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 12, marginBottom: 12,
      borderWidth: 1, borderColor: theme.border }}>
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {DAYS.map(day => (
          <View key={day} style={{ width: CELL, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "600",
              color: day === "Sat" || day === "Sun" ? "rgba(255,107,53,0.7)" : CAL_COLORS.weekdayLabel }}>
              {day}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 8 }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell, i) => {
          if (!cell) return <View key={`e${i}`} style={{ width: CELL, height: CELL + 8 }} />;
          const totalCal = cell.sessions.reduce((s, x) => s + (x.caloriesBurned || 0), 0);
          const bgColor  = cell.isFuture ? "transparent" : getCalorieBg(totalCal);
          const emojis   = [...new Set(cell.sessions.map(s => getWorkoutEmoji(s.name)))].slice(0, 2);
          const cellBg = cell.isToday ? "#FF6B35"
            : cell.isSelected ? "#1E2837"
            : cell.sessions.length > 0 ? "#1E2837"
            : cell.isFuture ? "transparent"
            : "#111827";
          return (
            <TouchableOpacity key={cell.dateKey}
              onPress={() => !cell.isFuture && onDayPress(cell.dateKey)}
              activeOpacity={cell.isFuture ? 1 : 0.7}
              style={{ width: CELL, height: CELL + 8, padding: 2 }}>
              <View style={{
                flex: 1, borderRadius: 10, backgroundColor: cellBg,
                alignItems: "center", justifyContent: "center", overflow: "hidden",
                borderWidth: cell.isBest && !cell.isToday ? 1.5 : 0,
                borderColor: cell.isBest ? "#F59E0B" : "transparent",
              }}>
                <Text style={{
                  fontSize: cell.isToday ? 13 : 12,
                  fontWeight: (cell.isToday || cell.isSelected) ? "800" : "500",
                  color: cell.isToday ? "#FFFFFF"
                    : cell.isSelected ? "#FFFFFF"
                    : cell.isFuture ? "rgba(255,255,255,0.2)"
                    : cell.sessions.length > 0 ? "#FFFFFF"
                    : "rgba(255,255,255,0.5)",
                  lineHeight: 16,
                }}>{cell.day}</Text>
                {cell.sessions.length > 0 && !cell.isFuture && !cell.isToday && (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#FF6B35", marginTop: 2 }} />
                )}
                {cell.isBest && (
                  <View style={{ position: "absolute", top: 2, right: 2 }}>
                    <Text style={{ fontSize: 8 }}>👑</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DayDetailPanel({ dateKey, sessions, onClose, theme }) {
  const d       = new Date(dateKey + "T12:00:00");
  const dateStr = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const totalCal  = sessions.reduce((s, x) => s + (x.caloriesBurned || 0), 0);
  const totalKm   = sessions.reduce((s, x) => s + (x.distance_km || 0), 0);
  const totalMins = sessions.reduce((s, x) => s + (x.durationMin || Math.round((x.duration_sec || 0) / 60)), 0);
  const isRest    = sessions.length === 0;

  return (
    <View style={{ backgroundColor: "#111827", borderRadius: 20, marginBottom: 12,
      borderWidth: 1, borderColor: isRest ? "rgba(255,255,255,0.08)" : "#FF6B35", overflow: "hidden",
      shadowColor: "#FF6B35", shadowOpacity: isRest ? 0 : 0.15, shadowRadius: 12, elevation: isRest ? 0 : 4 }}>
      <View style={{ backgroundColor: "#111827",
        padding: 16, flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFFFFF", marginBottom: 2 }}>
            📅 {dateStr}
          </Text>
          {!isRest && (
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              {sessions.length} session{sessions.length > 1 ? "s" : ""} · {Math.round(totalCal)} cal
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onClose}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)",
            alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 18, lineHeight: 20, fontWeight: "600" }}>×</Text>
        </TouchableOpacity>
      </View>

      {isRest ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ fontSize: 36 }}>😴</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF", marginTop: 8 }}>Rest Day</Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4, textAlign: "center", lineHeight: 18 }}>
            Recovery is part of training.{"\n"}Your body is rebuilding stronger! 💪
          </Text>
        </View>
      ) : (
        <View style={{ padding: 16 }}>
          {sessions.length > 1 && (
            <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: "#1E2837",
              borderRadius: 12, padding: 12, marginBottom: 12 }}>
              {[
                { emoji: "🔥", val: Math.round(totalCal), unit: "cal" },
                { emoji: "📍", val: totalKm > 0 ? totalKm.toFixed(1) : "—", unit: totalKm > 0 ? "km" : "" },
                { emoji: "⏱", val: totalMins, unit: "min" },
              ].map((s, i) => (
                <View key={i} style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#FF6B35", marginTop: 2 }}>
                    {s.val}<Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{s.unit}</Text>
                  </Text>
                </View>
              ))}
            </View>
          )}
          {sessions.map((s, i) => {
            const score     = s.integrityScore || 0;
            const statChips = [
              s.durationMin > 0 ? { icon: "⏱", label: s.durationMin + " min" } : null,
              (s.distance_km || 0) > 0 ? { icon: "📍", label: Number(s.distance_km).toFixed(1) + " km" } : null,
              (s.avgSpeed || 0) > 0 ? { icon: "⚡", label: Number(s.avgSpeed).toFixed(1) + " km/h" } : null,
              (s.stepCount || 0) > 0 ? { icon: "👟", label: Number(s.stepCount).toLocaleString() + " steps" } : null,
            ].filter(Boolean);
            return (
              <View key={i} style={{ borderRadius: 14, backgroundColor: "#1E2837",
                padding: 14,
                marginBottom: i < sessions.length - 1 ? 10 : 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: statChips.length > 0 ? 10 : 0 }}>
                  <Text style={{ fontSize: 24, marginRight: 8 }}>{getWorkoutEmoji(s.name)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>{s.name || "Workout"}</Text>
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
                      {s.verified ? "✅ Verified" : "⚠️ Unverified"}{score > 0 ? ` · ${score}/100` : ""}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: "rgba(255,107,53,0.2)", borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#FF6B35" }}>🔥 {s.caloriesBurned || 0}</Text>
                    <Text style={{ fontSize: 9, color: "#FF6B35", textAlign: "center" }}>cal</Text>
                  </View>
                </View>
                {statChips.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {statChips.map((chip, si) => (
                      <View key={si} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)",
                        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, gap: 4 }}>
                        <Text style={{ fontSize: 12 }}>{chip.icon}</Text>
                        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>{chip.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function IntensityLegend({ theme }) {
  const levels = [
    { color: CAL_COLORS.rest,     label: "Rest"    },
    { color: CAL_COLORS.light,    label: "<150"    },
    { color: CAL_COLORS.moderate, label: "150-300" },
    { color: CAL_COLORS.good,     label: "300-450" },
    { color: CAL_COLORS.intense,  label: "450+"    },
  ];
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 12, marginBottom: 12,
      borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textSub, marginBottom: 8,
        textAlign: "center", letterSpacing: 0.5, textTransform: "uppercase" }}>
        Intensity Guide (calories)
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "center" }}>
        {levels.map((level, i) => (
          <View key={i} style={{ alignItems: "center" }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: level.color,
              borderWidth: 1, borderColor: i === 0 ? theme.border : level.color, marginBottom: 4,
              shadowColor: i > 2 ? "#E8175D" : "transparent",
              shadowOpacity: i > 2 ? 0.25 : 0, shadowRadius: 4, elevation: i > 2 ? 2 : 0 }} />
            <Text style={{ fontSize: 9, color: theme.textSub, textAlign: "center", fontWeight: "500" }}>
              {level.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MonthPickerModal({ currentYear, currentMonth, allSessions, onSelect, onClose, theme }) {
  const today   = new Date();
  const minYear = allSessions.length > 0 ? parseInt(allSessions[0].date.substring(0, 4)) : today.getFullYear();
  const months  = [];
  for (let y = minYear; y <= today.getFullYear(); y++) {
    const maxM = y === today.getFullYear() ? today.getMonth() : 11;
    for (let m = 0; m <= maxM; m++) {
      const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
      months.push({ year: y, month: m, count: allSessions.filter(s => s.date.startsWith(prefix)).length });
    }
  }
  months.reverse();
  const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <Modal visible={true} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={{ backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: SCREEN_HEIGHT * 0.6 }}>
            <View style={{ width: 40, height: 4, backgroundColor: theme.border, borderRadius: 2,
              alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text,
              paddingHorizontal: 20, marginBottom: 16 }}>Jump to Month</Text>
            <ScrollView style={{ paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}>
              {months.map((m, i) => {
                const isActive = m.year === currentYear && m.month === currentMonth;
                return (
                  <TouchableOpacity key={i} onPress={() => onSelect(m.year, m.month)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14,
                      paddingHorizontal: 16, borderRadius: 14, marginBottom: 4,
                      backgroundColor: isActive ? CAL_COLORS.headerBg : theme.cardLight }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: isActive ? "#FFFFFF" : theme.text }}>
                        {MN[m.month]} {m.year}
                      </Text>
                      {m.count > 0 && (
                        <Text style={{ fontSize: 12, color: isActive ? "#FFFFFF80" : theme.textSub, marginTop: 2 }}>
                          {m.count} session{m.count > 1 ? "s" : ""}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", gap: 3 }}>
                      {[...Array(Math.min(m.count, 5))].map((_, di) => (
                        <View key={di} style={{ width: 6, height: 6, borderRadius: 3,
                          backgroundColor: isActive ? "#FFFFFF" : "#E8175D",
                          opacity: isActive ? 0.8 : 0.4 + di * 0.12 }} />
                      ))}
                    </View>
                    {isActive && <Text style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 8 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function FitnessCalendar({ allSessions, theme }) {
  const today   = new Date();
  const [viewYear,         setViewYear]         = useState(today.getFullYear());
  const [viewMonth,        setViewMonth]        = useState(today.getMonth());
  const [selectedDay,      setSelectedDay]      = useState(null);
  const [showMonthPicker,  setShowMonthPicker]  = useState(false);

  const sessionMap = React.useMemo(() => {
    const map = {};
    allSessions.forEach(s => {
      const key = (s.date || "").substring(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [allSessions]);

  const bestDayKey = React.useMemo(() => {
    let best = null, bestCal = 0;
    Object.entries(sessionMap).forEach(([key, ss]) => {
      const cal = ss.reduce((t, x) => t + (x.caloriesBurned || 0), 0);
      if (cal > bestCal) { bestCal = cal; best = key; }
    });
    return best;
  }, [sessionMap]);

  const monthStats = React.useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    const ms     = allSessions.filter(s => s.date.startsWith(prefix));
    const byDay  = {};
    ms.forEach(s => { const k = s.date.substring(0, 10); byDay[k] = (byDay[k] || 0) + (s.caloriesBurned || 0); });
    let bestDay = null, bestDayCal = 0;
    Object.entries(byDay).forEach(([k, c]) => { if (c > bestDayCal) { bestDayCal = c; bestDay = k; } });
    return { sessions: ms.length, calories: Math.round(ms.reduce((t, x) => t + (x.caloriesBurned || 0), 0)),
      activeDays: Object.keys(byDay).length, bestDay, bestDayCal: Math.round(bestDayCal) };
  }, [allSessions, viewYear, viewMonth]);

  function prevMonth() {
    setSelectedDay(null);
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    setSelectedDay(null);
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const prefix       = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const monthIsEmpty = !allSessions.some(s => s.date.startsWith(prefix));

  return (
    <View>
      <CalendarHeader monthName={monthName} monthStats={monthStats} onPrev={prevMonth} onNext={nextMonth}
        isCurrentMonth={isCurrentMonth} onTitlePress={() => setShowMonthPicker(true)} />
      <CalendarGrid year={viewYear} month={viewMonth} sessionMap={sessionMap} bestDayKey={bestDayKey}
        selectedDay={selectedDay} onDayPress={day => setSelectedDay(selectedDay === day ? null : day)} theme={theme} />
      {selectedDay && (
        <DayDetailPanel dateKey={selectedDay} sessions={sessionMap[selectedDay] || []}
          onClose={() => setSelectedDay(null)} theme={theme} />
      )}
      {monthIsEmpty && (
        <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 32, marginBottom: 12,
          borderWidth: 1, borderColor: theme.border, alignItems: "center" }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🏃</Text>
          <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text, textAlign: "center", marginBottom: 8 }}>
            No workouts in {new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", { month: "long" })} yet
          </Text>
          <Text style={{ fontSize: 14, color: theme.textSub, textAlign: "center", lineHeight: 20, marginBottom: 20 }}>
            Complete a workout in the Train tab and it will appear here automatically!
          </Text>
        </View>
      )}
      {!monthIsEmpty && <IntensityLegend theme={theme} />}
      {showMonthPicker && (
        <MonthPickerModal currentYear={viewYear} currentMonth={viewMonth} allSessions={allSessions}
          onSelect={(y, m) => { setViewYear(y); setViewMonth(m); setSelectedDay(null); setShowMonthPicker(false); }}
          onClose={() => setShowMonthPicker(false)} theme={theme} />
      )}
    </View>
  );
}


// ─── TREND CARD ───────────────────────────────────────────────────────────────
function TrendCard({ trend, sessions, theme }) {
  const configs = {
    improving:        { emoji: "📈", label: "Improving!",          message: "Your training is getting stronger — keep it up! 🔥", color: "#10B981", bgColor: "#ECFDF5" },
    maintaining:      { emoji: "➡️", label: "Maintaining",         message: "Consistent training — ready to push harder? 💪",     color: "#F59E0B", bgColor: "#FFFBEB" },
    declining:        { emoji: "📉", label: "Needs Attention",      message: "Your workouts have dipped — let's get back on track! 🏃", color: "#F43F8E", bgColor: "#FFF5F7" },
    not_enough_data:  { emoji: "🌱", label: "Just Getting Started", message: "Log more workouts to see your trend develop! 💪",    color: "#3B82F6", bgColor: "#EFF6FF" },
  };
  const c = configs[trend] || configs.not_enough_data;
  const consistency = sessions.length > 0
    ? Math.round((sessions.filter(s => s.verified).length / sessions.length) * 100)
    : 0;
  return (
    <View style={{ backgroundColor: c.bgColor, borderRadius: 16, padding: 16, marginBottom: 16,
      borderLeftWidth: 4, borderLeftColor: c.color, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ fontSize: 32 }}>{c.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: c.color, marginBottom: 2 }}>{c.label}</Text>
        <Text style={{ fontSize: 12, color: c.color + "CC", lineHeight: 18 }}>{c.message}</Text>
        <Text style={{ fontSize: 11, color: c.color, marginTop: 6, fontWeight: "600" }}>
          ✅ {consistency}% verified sessions
        </Text>
      </View>
    </View>
  );
}

// ─── WORKOUT TYPE BREAKDOWN ───────────────────────────────────────────────────
function WorkoutTypeBreakdown({ sessions, theme }) {
  const typeCounts = {};
  sessions.forEach(s => { const t = s.name || "Other"; typeCounts[t] = (typeCounts[t] || 0) + 1; });
  const total = sessions.length || 1;
  const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 16, marginBottom: 16,
      borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 16 }}>
        📊 Workout Breakdown
      </Text>
      {types.map(([type, count]) => {
        const pct   = count / total;
        const color = getWorkoutTypeColor(type);
        return (
          <View key={type} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>{type}</Text>
              <Text style={{ fontSize: 12, color: theme.textSub }}>
                {count} session{count !== 1 ? "s" : ""} · {Math.round(pct * 100)}%
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: theme.cardLight, borderRadius: 4 }}>
              <View style={{ height: 8, width: `${Math.round(pct * 100)}%`, backgroundColor: color, borderRadius: 4 }} />
            </View>
          </View>
        );
      })}
      {types.length === 0 && (
        <Text style={{ color: theme.textSub, textAlign: "center", padding: 16 }}>
          No workouts yet in this period
        </Text>
      )}
    </View>
  );
}

// ─── PERSONAL BESTS ───────────────────────────────────────────────────────────
function PersonalBests({ bests, theme }) {
  const cards = [
    { emoji: "🏃", label: "Longest Run",     value: bests.longestDistance.toFixed(1) + "km", color: "#F43F8E" },
    { emoji: "⚡", label: "Fastest Speed",   value: bests.fastestSpeed.toFixed(1) + "km/h",  color: "#F59E0B" },
    { emoji: "🔥", label: "Most Calories",   value: Math.round(bests.mostCalories) + "cal",  color: "#EF4444" },
    { emoji: "⏱", label: "Longest Session", value: bests.longestDuration + "min",            color: "#3B82F6" },
    { emoji: "📅", label: "Best Streak",     value: bests.longestStreak + " days",            color: "#FB923C" },
    { emoji: "🏅", label: "Best Integrity",  value: bests.bestIntegrity + "/100",             color: "#10B981" },
  ];
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 16, marginBottom: 16,
      borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 16 }}>
        🏆 Personal Bests
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {cards.map(card => (
          <View key={card.label} style={{ width: "30%", backgroundColor: card.color + "15",
            borderRadius: 14, padding: 12, alignItems: "center",
            borderWidth: 1, borderColor: card.color + "30" }}>
            <Text style={{ fontSize: 20 }}>{card.emoji}</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: card.color, marginTop: 4, textAlign: "center" }}>
              {card.value}
            </Text>
            <Text style={{ fontSize: 10, color: theme.textSub, marginTop: 2, textAlign: "center" }}>
              {card.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 16, padding: 12, backgroundColor: theme.cardLight, borderRadius: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text, marginBottom: 10 }}>
          📈 Lifetime Totals
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {[
            { label: "Sessions", value: bests.totalSessions },
            { label: "Distance", value: bests.totalDistance.toFixed(0) + "km" },
            { label: "Calories", value: Math.round(bests.totalCalories).toLocaleString() },
            { label: "Minutes",  value: bests.totalMinutes },
          ].map(item => (
            <View key={item.label} style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: ROSE }}>{item.value}</Text>
              <Text style={{ fontSize: 10, color: theme.textSub, marginTop: 2 }}>{item.label}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 12, color: theme.textSub, marginTop: 12, textAlign: "center" }}>
          ❤️ Favourite: {bests.favouriteType}
        </Text>
      </View>
    </View>
  );
}

// ─── SESSION DETAIL SCREEN ───────────────────────────────────────────────────
function SessionDetailScreen({ session, onBack, theme }) {
  const durationMin = session.durationMin || Math.round((session.duration_sec || 0) / 60);
  const distKm      = session.distance_km ? Number(session.distance_km).toFixed(2) : null;
  const avgSpeed    = session.avgSpeed ? Number(session.avgSpeed).toFixed(1) : null;
  const maxSpeed    = session.maxSpeed ? Number(session.maxSpeed).toFixed(1) : null;
  const steps       = session.stepCount || 0;
  const score       = session.integrityScore || 0;
  const scoreColor  = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
  const positions   = session.positions || [];
  const hasGPS      = positions.length >= 2;

  const avgSpeedKmh = avgSpeed ? parseFloat(avgSpeed) : 0;
  const paceMinsPerKm = avgSpeedKmh > 0
    ? `${Math.floor(60 / avgSpeedKmh)}:${String(Math.round((60 / avgSpeedKmh % 1) * 60)).padStart(2, "0")}`
    : null;

  const dateStr = new Date(session.date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const statsCards = [
    { icon: "⏱", label: "Duration", value: durationMin, unit: "min" },
    { icon: "📍", label: "Distance", value: distKm || "—", unit: distKm ? "km" : "" },
    { icon: "🔥", label: "Calories", value: session.caloriesBurned || 0, unit: "cal" },
    { icon: "👟", label: "Steps",    value: steps > 0 ? steps.toLocaleString() : "—", unit: steps > 0 ? "steps" : "" },
  ];

  const W = SW - 32;
  const MAP_H = 200;
  const PAD = 20;

  function renderMap() {
    if (!hasGPS) {
      return (
        <View style={{ height: 120, backgroundColor: "#111827", borderRadius: 14,
          alignItems: "center", justifyContent: "center", marginTop: 8 }}>
          <Text style={{ fontSize: 28, marginBottom: 6 }}>🏠</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Indoor workout — no map available</Text>
        </View>
      );
    }
    const lats = positions.map(p => p.lat);
    const lngs = positions.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latSpan = maxLat - minLat || 0.0001;
    const lngSpan = maxLng - minLng || 0.0001;
    const scaleX = (W - PAD * 2) / lngSpan;
    const scaleY = (MAP_H - PAD * 2) / latSpan;
    const scale  = Math.min(scaleX, scaleY);
    const toX = lng => PAD + (W - PAD * 2 - lngSpan * scale) / 2 + (lng - minLng) * scale;
    const toY = lat => PAD + (MAP_H - PAD * 2 - latSpan * scale) / 2 + (maxLat - lat) * scale;
    const pts = positions.map(p => `${toX(p.lng)},${toY(p.lat)}`).join(" ");
    const first = positions[0], last = positions[positions.length - 1];
    return (
      <View style={{ borderRadius: 14, overflow: "hidden", backgroundColor: "#111827", marginTop: 8 }}>
        <Svg width={W} height={MAP_H}>
          <Rect width={W} height={MAP_H} fill="#111827" />
          <Polyline points={pts} fill="none" stroke="#FF6B35" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={toX(first.lng)} cy={toY(first.lat)} r={7} fill="#FFFFFF" />
          <SvgText x={toX(first.lng)} y={toY(first.lat) + 4} textAnchor="middle" fill="#070B14" fontSize={7} fontWeight="bold">S</SvgText>
          <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={8} fill="#FF6B35" opacity={0.3} />
          <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={5} fill="#FF6B35" />
          <SvgText x={toX(last.lng)} y={toY(last.lat) + 4} textAnchor="middle" fill="#FFFFFF" fontSize={7} fontWeight="bold">E</SvgText>
        </Svg>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#070B14" }}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}>
      {/* Back button + header */}
      <SafeAreaView>
        <TouchableOpacity onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <Text style={{ color: "#FF6B35", fontSize: 16, fontWeight: "700" }}>‹ Back</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        {/* Header card */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "#FF6B35" }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 28 }}>{getWorkoutEmoji(session.name)}</Text>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#FFFFFF", flex: 1 }} numberOfLines={2}>
                  {session.name || "Workout"}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{dateStr}</Text>
            </View>
            {score > 0 && (
              <View style={{ backgroundColor: "#FF6B35" + "20", borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#FF6B35" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF6B35" }}>⚡{score}</Text>
                <Text style={{ fontSize: 9, color: "#FF6B35", textAlign: "center" }}>score</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats grid 2x2 */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {statsCards.map((card, i) => (
            <View key={i} style={{ width: (SW - 42) / 2, backgroundColor: "#111827",
              borderRadius: 14, padding: 14, alignItems: "center" }}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>{card.icon}</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#FF6B35" }}>
                {card.value}
                <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.5)" }}>
                  {card.unit ? " " + card.unit : ""}
                </Text>
              </Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* Map section */}
        <View style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 }}>📍 Route Map</Text>
          {renderMap()}
        </View>

        {/* Performance */}
        {(avgSpeed || maxSpeed || paceMinsPerKm) && (
          <View style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 }}>⚡ Performance</Text>
            {[
              avgSpeed     ? { label: "Avg Speed",  value: avgSpeed + " km/h" }    : null,
              maxSpeed     ? { label: "Max Speed",  value: maxSpeed + " km/h" }    : null,
              paceMinsPerKm ? { label: "Avg Pace",  value: paceMinsPerKm + " /km" } : null,
            ].filter(Boolean).map((row, i, arr) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between",
                paddingVertical: 8, borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{row.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Integrity score */}
        {score > 0 && (
          <View style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 }}>🏅 Workout Integrity Score</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30,
                backgroundColor: scoreColor + "20", borderWidth: 2, borderColor: scoreColor,
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: scoreColor }}>{score}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: scoreColor }}>
                  {score >= 80 ? "Excellent!" : score >= 60 ? "Good effort!" : "Keep improving!"}
                </Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                  {session.verified ? "✅ Verified session" : "⚠️ Unverified session"}
                </Text>
              </View>
            </View>
            <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
              <View style={{ height: 8, borderRadius: 4, width: `${score}%`, backgroundColor: scoreColor }} />
            </View>
          </View>
        )}

        {/* Coach TinaBarks note */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 12, padding: 14,
          borderLeftWidth: 3, borderLeftColor: "#FF6B35", marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF6B35", marginBottom: 4 }}>
            Coach TinaBarks 🌸
          </Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 18 }}>
            Great job completing this session! Keep the consistency going! 💪
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── RECENT SESSIONS LIST ─────────────────────────────────────────────────────
function RecentSessionsList({ sessions, theme, onSelectSession }) {
  const recent = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 16, marginBottom: 16,
      borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 12 }}>
        📋 Recent Sessions
      </Text>
      {recent.map((s, i) => {
        const color      = getWorkoutTypeColor(s.name);
        const score      = s.integrityScore || 0;
        const scoreColor = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
        return (
          <TouchableOpacity key={i} onPress={() => onSelectSession(s)} activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12,
              borderBottomWidth: i < recent.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color + "20",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18 }}>{getWorkoutEmoji(s.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text }}>
                {s.name || "Workout"}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textSub, marginTop: 2 }}>
                {new Date(s.date).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}
                {" · "}{s.durationMin || Math.round((s.duration_sec || 0) / 60)}min
                {" · "}{s.caloriesBurned || 0}cal
                {s.distance_km ? ` · ${Number(s.distance_km).toFixed(1)}km` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {score > 0 && (
                <View style={{ backgroundColor: scoreColor + "20", borderRadius: 10,
                  paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: scoreColor + "40" }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: scoreColor }}>
                    {s.verified ? "✅" : "⚠️"}{score}
                  </Text>
                </View>
              )}
              <Text style={{ color: theme.textSub, fontSize: 16 }}>›</Text>
            </View>
          </TouchableOpacity>
        );
      })}
      {recent.length === 0 && (
        <Text style={{ color: theme.textSub, textAlign: "center", padding: 20, fontSize: 14 }}>
          No sessions in this period yet
        </Text>
      )}
    </View>
  );
}

// ─── LOADING / EMPTY STATES ───────────────────────────────────────────────────
function ProgressLoadingState({ theme }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: 60 }}>
      <ActivityIndicator size="large" color={ROSE} />
      <Text style={{ color: theme.textSub, marginTop: 12, fontSize: 14 }}>Loading your progress...</Text>
    </View>
  );
}

function ProgressEmptyState({ range, theme }) {
  const msg = { week: "No workouts this week yet", month: "No workouts this month yet",
    "3months": "No workouts in 3 months yet", calendar: "No workouts logged yet" };
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: 40,
      backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 48 }}>🏃</Text>
      <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text, marginTop: 12, textAlign: "center" }}>
        {msg[range] || "No workouts yet"}
      </Text>
      <Text style={{ fontSize: 14, color: theme.textSub, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
        Complete your first workout in the Workout tab and your progress will appear here! 💪
      </Text>
    </View>
  );
}

// ─── WORKOUT PROGRESS SCREEN ──────────────────────────────────────────────────
function WorkoutProgressScreen() {
  const { profile, storageClientId } = useContext(Ctx);
  const { theme }    = useTheme();
  const [range,       setRange]       = useState("week");
  const [sessions,    setSessions]    = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [bests,       setBests]       = useState(null);
  const [detailSession, setDetailSession] = useState(null);

  // Must match GoFitProvider's pfx: clientId is the Supabase session userId
  // used as the storage namespace when keys are written as gf_log_${clientId}_${date}
  const userId = storageClientId || profile?.id || profile?.email || "default";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const all      = await getAllWorkoutSessions(userId);
      const filtered = range === "calendar" ? all : filterSessionsByRange(all, range);
      if (!cancelled) {
        setAllSessions(all);
        setSessions(filtered);
        setBests(calcPersonalBests(all));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, userId]);

  const trend = calcTrend(sessions);

  if (detailSession) {
    return (
      <SessionDetailScreen
        session={detailSession}
        onBack={() => setDetailSession(null)}
        theme={theme}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 4 }}>
        My Training Progress 📊
      </Text>
      <Text style={{ fontSize: 13, color: theme.textSub, marginBottom: 16 }}>
        Your fitness journey at a glance
      </Text>

      <RangeSelector range={range} onChange={setRange} theme={theme} />

      {loading ? (
        <ProgressLoadingState theme={theme} />
      ) : range === "calendar" ? (
        <FitnessCalendar allSessions={allSessions} theme={theme} />
      ) : sessions.length === 0 ? (
        <ProgressEmptyState range={range} theme={theme} />
      ) : (
        <>
          <SummaryStatsRow sessions={sessions} theme={theme} />
          <MainBarChart sessions={sessions} range={range} theme={theme} />
          <TrendCard trend={trend} sessions={sessions} theme={theme} />
          <WorkoutTypeBreakdown sessions={sessions} theme={theme} />
          {bests && <PersonalBests bests={bests} theme={theme} />}
          <RecentSessionsList sessions={sessions} theme={theme} onSelectSession={setDetailSession} />
        </>
      )}
    </ScrollView>
  );
}

// ─── NUTRITION SCREEN (Diary + Water + Meal Plan + Targets sub-tabs) ─────────
function NutritionSubBar({ activeTab, setActiveTab }) {
  const { theme } = useTheme();
  return (
    <View style={{ backgroundColor: theme.cardLight, borderRadius: 14, padding: 4,
      marginHorizontal: 16, marginBottom: 8, flexDirection: "row" }}>
      {[
        { key: "diary",    label: "🍽️ Diary"     },
        { key: "water",    label: "💧 Water"      },
        { key: "mealplan", label: "🗓️ Meal Plan" },
        { key: "targets",  label: "🎯 Targets"   },
      ].map(t => (
        <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)} style={{ flex: 1 }}>
          <View style={{
            backgroundColor: activeTab === t.key ? theme.card : "transparent",
            borderRadius: 10, paddingVertical: 8,
            alignItems: "center", justifyContent: "center",
            elevation: activeTab === t.key ? 2 : 0,
          }}>
            <Text style={{
              color:      activeTab === t.key ? ROSE : theme.navInactive,
              fontWeight: activeTab === t.key ? "700" : "500",
              fontSize:   12,
            }}>{t.label}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function NutritionTargetsPanel() {
  const { profile } = useContext(Ctx);
  const targets = calcTargets(profile);
  const rows = [
    { icon: "🔥", label: "Daily Calories",  value: `${targets.calories.toLocaleString()} kcal` },
    { icon: "🥩", label: "Protein Target",  value: `${targets.protein}g` },
    { icon: "🍞", label: "Carbs Target",    value: `${targets.carbs}g` },
    { icon: "🥑", label: "Fat Target",      value: `${targets.fat}g` },
    { icon: "💧", label: "Water Goal",      value: `${targets.waterGoal.toFixed(1)}L daily` },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
      <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 18, marginBottom: 4 }}>Your Nutrition Targets</Text>
      <Text style={{ color: C.grey, fontSize: 13, marginBottom: 20 }}>Calculated using Mifflin-St Jeor formula</Text>
      {rows.map(r => (
        <View key={r.label} style={{
          backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10,
          flexDirection: "row", alignItems: "center",
        }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.cardLight,
            alignItems: "center", justifyContent: "center", marginRight: 14 }}>
            <Text style={{ fontSize: 20 }}>{r.icon}</Text>
          </View>
          <Text style={{ flex: 1, color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>{r.label}</Text>
          <Text style={{ color: ROSE, fontWeight: "800", fontSize: 15 }}>{r.value}</Text>
        </View>
      ))}
      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center", marginTop: 8 }}>
        Targets update automatically when you update your profile.
      </Text>
    </ScrollView>
  );
}

function NutritionScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("diary");
  const subBar = <NutritionSubBar activeTab={activeTab} setActiveTab={setActiveTab} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {activeTab === "diary" ? (
        <DiaryScreen navigation={navigation} nutritionSubBar={subBar} />
      ) : activeTab === "water" ? (
        <SafeAreaView style={S.screen}>
          {subBar}
          <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            <WaterWidget />
          </ScrollView>
        </SafeAreaView>
      ) : activeTab === "mealplan" ? (
        <MealPlannerScreen navigation={navigation} nutritionSubBar={subBar} />
      ) : (
        <SafeAreaView style={S.screen}>
          {subBar}
          <NutritionTargetsPanel />
        </SafeAreaView>
      )}
    </View>
  );
}

// ─── TRAIN SCREEN (Workout + Videos + Progress + Squad sub-tabs) ──────────────
function TrainSubBar({ activeTab, setActiveTab }) {
  const { theme } = useTheme();
  return (
    <View style={{ backgroundColor: theme.cardLight, borderRadius: 14, padding: 4,
      marginHorizontal: 16, marginBottom: 8, flexDirection: "row" }}>
      {[
        { key: "workout",  label: "🏃 Workout"  },
        { key: "videos",   label: "🎬 Videos"   },
        { key: "progress", label: "📊 Progress" },
        { key: "squad",    label: "🏆 Squad"    },
      ].map(t => (
        <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)} style={{ flex: 1 }}>
          <View style={{
            backgroundColor: activeTab === t.key ? theme.card : "transparent",
            borderRadius: 10, paddingVertical: 9,
            alignItems: "center", justifyContent: "center",
            shadowColor: activeTab === t.key ? "#000" : "transparent",
            shadowOpacity: activeTab === t.key ? 0.08 : 0,
            shadowRadius: 4, elevation: activeTab === t.key ? 2 : 0,
          }}>
            <Text style={{
              color:      activeTab === t.key ? ROSE : theme.navInactive,
              fontWeight: activeTab === t.key ? "700" : "500",
              fontSize:   12,
            }}>{t.label}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function TrainScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("workout");
  const subBar = <TrainSubBar activeTab={activeTab} setActiveTab={setActiveTab} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {activeTab === "workout" ? (
        <ExerciseScreen navigation={navigation} trainSubBar={subBar} />
      ) : activeTab === "videos" ? (
        <VideoScreen navigation={navigation} trainSubBar={subBar} />
      ) : activeTab === "squad" ? (
        <View style={{ flex: 1 }}>
          <SafeAreaView style={{ backgroundColor: C.bg }}>
            {subBar}
          </SafeAreaView>
          <CommunityScreen navigation={navigation} />
        </View>
      ) : (
        <SafeAreaView style={S.screen}>
          {subBar}
          <WorkoutProgressScreen />
        </SafeAreaView>
      )}
    </View>
  );
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

// SVG icon paths for tab bar (no external icon library needed)
function TabIcon({ name, color, size = 22 }) {
  const s = size;
  const c = color;
  if (name === "home") return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke={c} strokeWidth={1.8} strokeLinejoin="round"/>
      <Path d="M9 21V12h6v9" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
  if (name === "train") return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M6 12h12M3 8h18M3 16h18" stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
      <Circle cx="6" cy="12" r="2" fill={c}/>
      <Circle cx="18" cy="12" r="2" fill={c}/>
    </Svg>
  );
  if (name === "squad") return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke={c} strokeWidth={1.8} strokeLinejoin="round"/>
    </Svg>
  );
  if (name === "sleep") return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
  if (name === "profile") return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={c} strokeWidth={1.8}/>
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
    </Svg>
  );
  if (name === "nutrition") return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z" stroke={c} strokeWidth={1.8} strokeLinejoin="round"/>
      <Circle cx="12" cy="9" r="2.5" stroke={c} strokeWidth={1.5}/>
    </Svg>
  );
  if (name === "coach") return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke={c} strokeWidth={1.8} strokeLinejoin="round"/>
      <Path d="M8 10h8M8 13h5" stroke={c} strokeWidth={1.5} strokeLinecap="round"/>
    </Svg>
  );
  return null;
}

const NAV_TABS = [
  { name: "Home",      icon: "home"      },
  { name: "Nutrition", icon: "nutrition" },
  { name: "Train",     icon: "train"     },
  { name: "Coach",     icon: "coach"     },
  { name: "Profile",   icon: "profile"   },
];

function CustomTabBar({ state, descriptors, navigation }) {
  const insets    = useSafeAreaInsets();
  const tabWidth  = Math.floor(SW / NAV_TABS.length);
  const bottomPad = insets.bottom > 0 ? insets.bottom : 8;
  const { unreadCoachMessages } = useContext(PaywallCtx);

  // Pulse animation for Coach tab when there are unread messages
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (unreadCoachMessages > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [unreadCoachMessages]);

  const visibleRoutes = state.routes.filter(r =>
    NAV_TABS.some(t => t.name === r.name)
  );

  return (
    <View style={{
      flexDirection:   "row",
      backgroundColor: "#111827",
      borderTopWidth:  0.5,
      borderTopColor:  "rgba(255,255,255,0.08)",
      width:           SW,
      height:          56 + bottomPad,
      paddingBottom:   bottomPad,
    }}>
      {visibleRoutes.map((route) => {
        const tab       = NAV_TABS.find(t => t.name === route.name);
        const isFocused = state.index === state.routes.indexOf(route);
        const color     = isFocused ? ROSE : "rgba(255,255,255,0.35)";
        const isCoach   = tab.name === "Coach";

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.name}
            onPress={onPress}
            activeOpacity={0.7}
            style={{
              width:          tabWidth,
              alignItems:     "center",
              justifyContent: "center",
              paddingTop:     8,
              position:       "relative",
            }}
          >
            {isFocused && (
              <View style={{
                position:        "absolute",
                top:             0,
                width:           24,
                height:          2.5,
                borderRadius:    2,
                backgroundColor: ROSE,
              }} />
            )}
            {/* Coach tab: wrap icon in animated view + badge */}
            {isCoach ? (
              <View style={{ position: "relative" }}>
                <Animated.View style={{ transform: [{ scale: unreadCoachMessages > 0 ? pulseAnim : 1 }] }}>
                  <TabIcon name={tab.icon} color={color} size={22} />
                </Animated.View>
                {/* Unread badge */}
                {unreadCoachMessages > 0 && (
                  <View style={{
                    position: "absolute", top: -4, right: -6,
                    minWidth: unreadCoachMessages > 1 ? 16 : 8,
                    height: unreadCoachMessages > 1 ? 16 : 8,
                    borderRadius: 8,
                    backgroundColor: ROSE,
                    alignItems: "center", justifyContent: "center",
                    borderWidth: 1.5, borderColor: "#111827",
                    paddingHorizontal: unreadCoachMessages > 1 ? 3 : 0,
                  }}>
                    {unreadCoachMessages > 1 && (
                      <Text style={{ color: "#FFF", fontSize: 9, fontWeight: "800", lineHeight: 12 }}>
                        {unreadCoachMessages > 9 ? "9+" : unreadCoachMessages}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <TabIcon name={tab.icon} color={color} size={22} />
            )}
            <Text style={{
              fontSize:   10,
              fontWeight: isFocused ? "700" : "500",
              color,
              marginTop:  4,
              textAlign:  "center",
            }}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"      component={DashboardScreen}  />
      <Tab.Screen name="Nutrition" component={NutritionScreen}  />
      <Tab.Screen name="Train"     component={TrainScreen}      />
      <Tab.Screen name="Coach"     component={CoachScreen}      />
      <Tab.Screen name="Profile"   component={ProfileScreen}    />
      {/* Hidden routes — accessible via navigation.navigate() */}
      <Tab.Screen name="Squad"    component={CommunityScreen}   options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Sleep"    component={SleepScreen}       options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Diary"    component={DiaryScreen}       options={{ tabBarButton: () => null }} />
      <Tab.Screen name="MealPlan" component={MealPlannerScreen} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Exercise" component={ExerciseScreen}    options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Videos"   component={VideoScreen}       options={{ tabBarButton: () => null }} />
    </Tab.Navigator>
  );
}

// ─── PASSWORD STRENGTH HELPER ─────────────────────────────────────────────────
function pwStrength(pw) {
  if (!pw || pw.length < 6) return { level: "Weak",   pct: 0.25, color: "#EF4444" };
  if (pw.length < 8)        return { level: "Fair",   pct: 0.50, color: "#F59E0B" };
  if (/\d/.test(pw))        return { level: "Good",   pct: 0.75, color: "#3B82F6" };
  return                           { level: "Strong", pct: 1.00, color: "#22C55E" };
}
function pwStrengthFull(pw) {
  if (!pw || pw.length < 6)                         return { level: "Weak",   pct: 0.25, color: "#EF4444" };
  if (pw.length < 8)                                return { level: "Fair",   pct: 0.50, color: "#F59E0B" };
  if (pw.length >= 8 && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) return { level: "Strong", pct: 1.00, color: "#22C55E" };
  if (pw.length >= 8 && /\d/.test(pw))              return { level: "Good",   pct: 0.75, color: "#3B82F6" };
  return                                                   { level: "Fair",   pct: 0.50, color: "#F59E0B" };
}

// ─── EYE TOGGLE BUTTON ────────────────────────────────────────────────────────
function EyeBtn({ show, onToggle }) {
  return (
    <TouchableOpacity onPress={onToggle}
      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 50,
        alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 18 }}>{show ? "🙈" : "👁️"}</Text>
    </TouchableOpacity>
  );
}

// ─── FORGOT PASSWORD MODAL ────────────────────────────────────────────────────
// 4-step in-app reset: email → security question → new password → success
function ForgotPasswordModal({ visible, onClose, onResetDone }) {
  const { clients, updateClientPassword } = useContext(AuthCtx);

  // step: "email" | "question" | "newpass" | "success"
  const [step,         setStep]         = useState("email");
  const [fpEmail,      setFpEmail]      = useState("");
  const [fpError,      setFpError]      = useState("");
  const [busy,         setBusy]         = useState(false);

  // Step 2 — security question
  const [foundUser,    setFoundUser]    = useState(null); // the client object
  const [sqAnswer,     setSqAnswer]     = useState("");
  const [sqError,      setSqError]      = useState("");
  const [attempts,     setAttempts]     = useState(0);
  const MAX_ATTEMPTS = 3;

  // Step 3 — new password
  const [newPw,        setNewPw]        = useState("");
  const [confPw,       setConfPw]       = useState("");
  const [showNew,      setShowNew]      = useState(false);
  const [showConf,     setShowConf]     = useState(false);
  const [pwBusy,       setPwBusy]       = useState(false);
  const [fpFocused,    setFpFocused]    = useState(null);
  const confPwRef = useRef(null);

  const str   = pwStrengthFull(newPw);
  const match = newPw.length >= 6 && confPw.length > 0 && newPw === confPw;

  function resetAll() {
    setStep("email"); setFpEmail(""); setFpError(""); setBusy(false);
    setFoundUser(null); setSqAnswer(""); setSqError(""); setAttempts(0);
    setNewPw(""); setConfPw(""); setShowNew(false); setShowConf(false); setPwBusy(false);
  }

  function close() { onClose(); setTimeout(resetAll, 400); }

  function validateEmailFmt(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }

  // STEP 1 — find account by email
  async function handleEmailContinue() {
    setFpError("");
    const trimmed = fpEmail.trim().toLowerCase();
    if (!trimmed) { setFpError("Please enter your email."); return; }
    if (!validateEmailFmt(trimmed)) { setFpError("Invalid email format."); return; }
    setBusy(true);
    await new Promise(r => setTimeout(r, 400)); // brief pause for UX
    setBusy(false);

    // Coach shortcut — skip security question
    if (trimmed === COACH_CREDENTIALS.email.toLowerCase()) {
      setFoundUser({ id: COACH_CREDENTIALS.id, email: COACH_CREDENTIALS.email, isCoach: true });
      setStep("newpass");
      return;
    }

    const user = clients.find(c => c.email.toLowerCase() === trimmed);
    if (!user) {
      setFpError("⚠️ No WeGoFit account found with that email address.\nDouble-check or create a new account.");
      return;
    }
    setFoundUser(user);
    setStep("question");
  }

  // STEP 2 — verify security answer
  function handleVerifyAnswer() {
    setSqError("");
    const trimmedAnswer = sqAnswer.trim().toLowerCase();
    if (!trimmedAnswer) { setSqError("Please enter your answer."); return; }

    // If user has no security answer stored, accept any non-empty answer (fallback for old accounts)
    const storedAnswer = foundUser?.securityAnswer || "";
    const correct = storedAnswer ? btoa(trimmedAnswer) === storedAnswer : true;

    if (correct) {
      setStep("newpass");
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setSqError(`🔒 Too many incorrect attempts. Please contact Coach TinaBarks at:\nsupport@wegofit.app`);
      } else {
        setSqError(`❌ Incorrect answer. Please try again. (${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? "s" : ""} remaining)`);
      }
    }
  }

  // STEP 3 — save new password
  async function handleUpdatePassword() {
    if (!newPw || newPw.length < 6) return;
    if (!match) return;
    setPwBusy(true);

    if (foundUser?.isCoach) {
      // Coach: update in COACH_CREDENTIALS via AsyncStorage override key
      await AsyncStorage.setItem("gofit_coach_pw_override", btoa(newPw));
    } else {
      await updateClientPassword(foundUser.email, newPw);
    }

    setPwBusy(false);
    setStep("success");
  }

  // Pill for progress steps
  function StepDots({ current }) {
    const steps = ["email","question","newpass","success"];
    const idx   = steps.indexOf(current);
    return (
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 20 }}>
        {[0,1,2,3].map(i => (
          <View key={i} style={{ width: i === idx ? 20 : 8, height: 8, borderRadius: 4,
            backgroundColor: i <= idx ? ROSE : "#E0E0E0" }} />
        ))}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableWithoutFeedback onPress={close} accessible={false}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        </TouchableWithoutFeedback>
        <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 44 : 36, paddingTop: 16, maxHeight: "92%" }}>
          {/* Handle bar */}
          <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2,
            alignSelf: "center", marginBottom: 16 }} />

          {/* ── STEP 1: EMAIL ── */}
          {step === "email" && (
            <>
              <StepDots current="email" />
              <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 6 }}>🔑 Reset Password</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginBottom: 8, lineHeight: 20 }}>
                Enter your WeGoFit account email to reset your password right here.
              </Text>
              <View style={{ backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 10, padding: 10, marginBottom: 18,
                borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" }}>
                <Text style={{ color: "#10B981", fontSize: 12, lineHeight: 18 }}>
                  ✅ WeGoFit resets passwords in-app — simple and instant, no email required.
                </Text>
              </View>
              {fpError ? (
                <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginBottom: 14,
                  borderWidth: 1, borderColor: "#FECACA" }}>
                  <Text style={{ color: "#EF4444", fontSize: 13, lineHeight: 18 }}>{fpError}</Text>
                </View>
              ) : null}
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Email address</Text>
              <TextInput style={[S.input, { marginBottom: 20 }, fpFocused === "fpemail" && S.inputFocused]}
                placeholder="your@email.com" placeholderTextColor="rgba(255,255,255,0.3)"
                value={fpEmail} onChangeText={v => { setFpEmail(v); setFpError(""); }}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                returnKeyType="done" onSubmitEditing={handleEmailContinue}
                onFocus={() => setFpFocused("fpemail")} onBlur={() => setFpFocused(null)} />
              <TouchableOpacity onPress={handleEmailContinue} disabled={busy}
                style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 16, alignItems: "center",
                  opacity: busy ? 0.7 : 1, shadowColor: ROSE, shadowRadius: 8, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 3 } }}>
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Continue →</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={close} style={{ alignItems: "center", marginTop: 16, padding: 8 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 2: SECURITY QUESTION ── */}
          {step === "question" && foundUser && (
            <>
              <StepDots current="question" />
              <View style={{ backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 12, padding: 12, marginBottom: 18,
                borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" }}>
                <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 14 }}>✅ Account Found!</Text>
                <Text style={{ color: "#10B981", fontSize: 13, marginTop: 2 }}>{foundUser.email} is registered with WeGoFit.</Text>
              </View>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Security Question</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
                To protect your account, please answer your security question:
              </Text>
              <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 12, padding: 14, marginBottom: 16,
                borderWidth: 1, borderColor: ROSE_DIM }}>
                <Text style={{ color: ROSE, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
                  {foundUser.securityQuestion || "What year were you born?"}
                </Text>
              </View>
              {sqError ? (
                <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginBottom: 14,
                  borderWidth: 1, borderColor: "#FECACA" }}>
                  <Text style={{ color: "#EF4444", fontSize: 13, lineHeight: 18 }}>{sqError}</Text>
                </View>
              ) : null}
              {attempts < MAX_ATTEMPTS && (
                <>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Your Answer</Text>
                  <TextInput style={[S.input, { marginBottom: 20 }, fpFocused === "sqans" && S.inputFocused]}
                    placeholder="Your answer..." placeholderTextColor="rgba(255,255,255,0.3)"
                    value={sqAnswer} onChangeText={v => { setSqAnswer(v); setSqError(""); }}
                    autoCapitalize="none" autoCorrect={false}
                    returnKeyType="done" onSubmitEditing={handleVerifyAnswer}
                    onFocus={() => setFpFocused("sqans")} onBlur={() => setFpFocused(null)} />
                  <TouchableOpacity onPress={handleVerifyAnswer}
                    style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 16, alignItems: "center",
                      shadowColor: ROSE, shadowRadius: 8, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 3 } }}>
                    <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Verify Answer</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => { setStep("email"); setSqAnswer(""); setSqError(""); setAttempts(0); }}
                style={{ alignItems: "center", marginTop: 16, padding: 8 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>← Back</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 3: NEW PASSWORD ── */}
          {step === "newpass" && (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <StepDots current="newpass" />
              <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 6 }}>🔒 Create New Password</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 20, lineHeight: 18 }}>
                Choose a strong new password for your account.
              </Text>

              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>New Password</Text>
              <View style={{ position: "relative", justifyContent: "center", marginBottom: 8 }}>
                <TextInput style={[S.input, { paddingRight: 50 }, fpFocused === "newpw" && S.inputFocused]}
                  placeholder="New password" placeholderTextColor="rgba(255,255,255,0.3)"
                  value={newPw} onChangeText={setNewPw}
                  secureTextEntry={!showNew} autoCapitalize="none" autoCorrect={false}
                  returnKeyType="next" onSubmitEditing={() => confPwRef.current?.focus()} blurOnSubmit={false}
                  onFocus={() => setFpFocused("newpw")} onBlur={() => setFpFocused(null)} />
                <EyeBtn show={showNew} onToggle={() => setShowNew(v => !v)} />
              </View>
              {newPw.length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, marginBottom: 4 }}>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: str.color, width: `${str.pct * 100}%` }} />
                  </View>
                  <Text style={{ color: str.color, fontSize: 12, fontWeight: "600" }}>{str.level}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 }}>Use 8+ chars, numbers & symbols</Text>
                </View>
              )}

              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Confirm New Password</Text>
              <View style={{ position: "relative", justifyContent: "center", marginBottom: 8 }}>
                <TextInput ref={confPwRef} style={[S.input, { paddingRight: 50 }, fpFocused === "confpw" && S.inputFocused]}
                  placeholder="Repeat password" placeholderTextColor="rgba(255,255,255,0.3)"
                  value={confPw} onChangeText={setConfPw}
                  secureTextEntry={!showConf} autoCapitalize="none" autoCorrect={false}
                  returnKeyType="done" onSubmitEditing={handleUpdatePassword}
                  onFocus={() => setFpFocused("confpw")} onBlur={() => setFpFocused(null)} />
                <EyeBtn show={showConf} onToggle={() => setShowConf(v => !v)} />
              </View>
              {confPw.length > 0 && (
                <Text style={{ color: match ? "#22C55E" : "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 16 }}>
                  {match ? "✅ Passwords match" : "❌ Passwords don't match"}
                </Text>
              )}

              <TouchableOpacity onPress={handleUpdatePassword} disabled={pwBusy || !match}
                style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 16, alignItems: "center",
                  opacity: pwBusy || !match ? 0.45 : 1, marginTop: 4,
                  shadowColor: ROSE, shadowRadius: 8, shadowOpacity: match ? 0.25 : 0, shadowOffset: { width: 0, height: 3 } }}>
                {pwBusy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Update Password</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={close} style={{ alignItems: "center", marginTop: 16, padding: 8 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── STEP 4: SUCCESS ── */}
          {step === "success" && (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <StepDots current="success" />
              <Text style={{ fontSize: 64 }}>✅</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 20, marginBottom: 10 }}>
                Password Updated!
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
                Your WeGoFit password has been successfully changed.{"\n"}You can now log in with your new password.
              </Text>
              <TouchableOpacity onPress={() => { if (onResetDone) onResetDone(foundUser?.email || fpEmail); close(); }}
                style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48,
                  alignItems: "center", shadowColor: ROSE, shadowRadius: 8, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 3 } }}>
                <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
// ─── AUTH SCREEN SHARED STYLES ───────────────────────────────────────────────
const AUTH = {
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingLeft: 50,
    paddingRight: 16,
    color: "#FFFFFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    minHeight: 56,
  },
  inputFocused: {
    borderColor: ROSE,
    backgroundColor: "rgba(255,107,53,0.08)",
  },
  label: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  iconBox: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 50,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
};

function AuthIconMail() {
  return (
    <View style={AUTH.iconBox}>
      <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Rect x="2" y="4" width="20" height="16" rx="3" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8"/>
        <Path d="M2 8l10 7 10-7" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round"/>
      </Svg>
    </View>
  );
}
function AuthIconLock() {
  return (
    <View style={AUTH.iconBox}>
      <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Rect x="5" y="11" width="14" height="10" rx="2.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8"/>
        <Path d="M8 11V7a4 4 0 018 0v4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round"/>
      </Svg>
    </View>
  );
}
function AuthIconPerson() {
  return (
    <View style={AUTH.iconBox}>
      <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8"/>
        <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round"/>
      </Svg>
    </View>
  );
}

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was your childhood nickname?",
  "What is your oldest sibling's name?",
];

// ─── AUTH SCREEN (Sign In only — Create Account redirects to onboarding) ──────
function AuthScreen({ onCreateAccount }) {
  const { login } = useContext(AuthCtx);

  const [imageLoading, setImageLoading] = useState(true);
  const [siEmail,      setSiEmail]      = useState("");
  const [siPassword,   setSiPassword]   = useState("");
  const [siShowPw,     setSiShowPw]     = useState(false);
  const [siError,      setSiError]      = useState("");
  const [siBusy,       setSiBusy]       = useState(false);
  const [showForgot,   setShowForgot]   = useState(false);
  const [resetNotice,  setResetNotice]  = useState("");
  const [siFocused,    setSiFocused]    = useState(null);
  const siPasswordRef = useRef(null);

  async function handleLogin() {
    Keyboard.dismiss();
    if (!siEmail.trim() || !siPassword) { setSiError("Enter your email and password."); return; }
    setSiBusy(true); setSiError("");
    const result = await login(siEmail, siPassword);
    setSiBusy(false);
    if (!result.ok) setSiError(result.error);
    else {
      try {
        await AsyncStorage.setItem("userLoggedIn", "true");
        await AsyncStorage.setItem("userId", result.userId || "");
      } catch (_e) {}
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0F0F19" }}>

      {/* Background image */}
      <Image
        source={require('./assets/signin-background_old.png')}
        style={{ position: "absolute", top: 0, left: 0, right: 0,
                 bottom: 0, width: "100%", height: "100%", zIndex: 0 }}
        resizeMode="cover"
        fadeDuration={0}
        onLoadStart={() => setImageLoading(true)}
        onLoadEnd={() => setImageLoading(false)}
      />

      {/* Gradient overlay */}
      <LinearGradient
        colors={["rgba(0,0,0,0.0)","rgba(0,0,0,0.0)",
                 "rgba(10,10,20,0.3)","rgba(10,10,20,0.55)",
                 "rgba(10,10,20,0.75)","rgba(10,10,20,0.88)"]}
        locations={[0, 0.25, 0.45, 0.60, 0.75, 1.0]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, zIndex: 10 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
      >
        <View style={{ flex: 1 }} />

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ zIndex: 10, backgroundColor: "#0F0F19" }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}
            >
              {(resetNotice || siError) ? (
                <View style={{ marginBottom: 10 }}>
                  {resetNotice ? (
                    <View style={{ backgroundColor: "rgba(16,185,129,0.11)", borderRadius: 9,
                      padding: 9, borderWidth: 1, borderColor: "rgba(16,185,129,0.25)", marginBottom: 6 }}>
                      <Text style={{ color: "#6EE7B7", fontSize: 12, lineHeight: 17 }}>{resetNotice}</Text>
                    </View>
                  ) : null}
                  {siError ? (
                    <View style={{ backgroundColor: "rgba(239,68,68,0.09)", borderRadius: 9,
                      padding: 9, borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" }}>
                      <Text style={{ color: "#FCA5A5", fontSize: 12, lineHeight: 17 }}>{siError}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700",
                letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginTop: 4 }}>Email</Text>
              <View style={{ position: "relative", marginBottom: 12 }}>
                <View style={{ position: "absolute", left: 14, top: 0, bottom: 0,
                  alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <Rect x="2" y="4" width="20" height="16" rx="3"
                      stroke="rgba(255,255,255,0.45)" strokeWidth="1.6"/>
                    <Path d="M2 8l10 7 10-7"
                      stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeLinecap="round"/>
                  </Svg>
                </View>
                <TextInput
                  style={{
                    height: 52, backgroundColor: "rgba(255,255,255,0.08)",
                    borderRadius: 14, borderWidth: siFocused === "email" ? 1.5 : 1,
                    borderColor: siFocused === "email" ? "rgba(255,107,53,0.7)" : "rgba(255,255,255,0.18)",
                    paddingLeft: 44, paddingRight: 14, color: "#FFFFFF", fontSize: 15,
                  }}
                  placeholder="your@email.com" placeholderTextColor="rgba(255,255,255,0.45)"
                  value={siEmail} onChangeText={v => { setSiEmail(v); setSiError(""); setResetNotice(""); }}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  returnKeyType="next" onSubmitEditing={() => siPasswordRef.current?.focus()} blurOnSubmit={false}
                  onFocus={() => setSiFocused("email")} onBlur={() => setSiFocused(null)}
                />
              </View>

              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700",
                letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginTop: 4 }}>Password</Text>
              <View style={{ position: "relative", marginBottom: 0 }}>
                <View style={{ position: "absolute", left: 14, top: 0, bottom: 0,
                  alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <Rect x="5" y="11" width="14" height="10" rx="2.5"
                      stroke="rgba(255,255,255,0.45)" strokeWidth="1.6"/>
                    <Path d="M8 11V7a4 4 0 018 0v4"
                      stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeLinecap="round"/>
                  </Svg>
                </View>
                <TextInput
                  ref={siPasswordRef}
                  style={{
                    height: 52, backgroundColor: "rgba(255,255,255,0.08)",
                    borderRadius: 14, borderWidth: siFocused === "password" ? 1.5 : 1,
                    borderColor: siFocused === "password" ? "rgba(255,107,53,0.7)" : "rgba(255,255,255,0.18)",
                    paddingLeft: 44, paddingRight: 50, color: "#FFFFFF", fontSize: 15,
                  }}
                  placeholder="Password" placeholderTextColor="rgba(255,255,255,0.45)"
                  value={siPassword} onChangeText={v => { setSiPassword(v); setSiError(""); }}
                  secureTextEntry={!siShowPw} autoCapitalize="none" autoCorrect={false}
                  returnKeyType="done" onSubmitEditing={handleLogin}
                  onFocus={() => setSiFocused("password")} onBlur={() => setSiFocused(null)}
                />
                <TouchableOpacity onPress={() => setSiShowPw(v => !v)}
                  style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 48,
                    alignItems: "center", justifyContent: "center", opacity: 0.8 }}>
                  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    {siShowPw
                      ? <><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke={ROSE} strokeWidth="1.6"/><Circle cx="12" cy="12" r="3" stroke={ROSE} strokeWidth="1.6"/></>
                      : <><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke={ROSE} strokeWidth="1.6"/><Circle cx="12" cy="12" r="3" stroke={ROSE} strokeWidth="1.6"/><Path d="M3 3l18 18" stroke={ROSE} strokeWidth="1.6" strokeLinecap="round"/></>
                    }
                  </Svg>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setShowForgot(true)}
                style={{ alignSelf: "flex-end", paddingTop: 8, paddingBottom: 20 }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" }}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleLogin} disabled={siBusy}
                style={{ height: 54, backgroundColor: ROSE, borderRadius: 14,
                  alignItems: "center", justifyContent: "center",
                  opacity: siBusy ? 0.75 : 1, marginTop: 8, marginBottom: 20,
                  shadowColor: ROSE, shadowRadius: 16, shadowOpacity: 0.45,
                  shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
                {siBusy
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.5 }}>Sign In</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={onCreateAccount} style={{ alignItems: "center", marginTop: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", textAlign: "center" }}>
                  <Text style={{ color: "rgba(255,255,255,0.5)" }}>New here?  </Text>
                  <Text style={{ color: ROSE, fontWeight: "600" }}>Create Account ›</Text>
                </Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </TouchableWithoutFeedback>

      </KeyboardAvoidingView>

      {/* Loading placeholder */}
      {imageLoading && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "#0F0F19", justifyContent: "center", alignItems: "center", zIndex: 20,
        }}>
          <Image source={LOGO_URI} style={{ width: 180, height: 80, resizeMode: "contain", opacity: 0.9 }} />
          <ActivityIndicator color="#FF6B35" size="small" style={{ marginTop: 20 }} />
        </View>
      )}

      <ForgotPasswordModal
        visible={showForgot}
        onClose={() => setShowForgot(false)}
        onResetDone={(resetEmail) => {
          setSiEmail(resetEmail || "");
          setSiPassword("");
          setResetNotice("Password updated! Sign in with your new password.");
        }}
      />

    </View>
  );
}

// ─── COACH DASHBOARD ──────────────────────────────────────────────────────────

function CoachAvatar({ name, size = 40 }) {
  const initials = name ? name.slice(0, 2).toUpperCase() : "??";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2,
      backgroundColor: "#FFF5F0", alignItems: "center", justifyContent: "center",
      borderWidth: 1.5, borderColor: ROSE_DIM }}>
      <Text style={{ color: ROSE, fontWeight: "800", fontSize: size * 0.35 }}>{initials}</Text>
    </View>
  );
}

function PlanBadge({ plan }) {
  const map = {
    annual:  { bg: "#FEF3C7", text: "#D97706", label: "ANNUAL"  },
    monthly: { bg: "#FFF5F0", text: ROSE,      label: "PREMIUM" },
    free:    { bg: "#F3F4F6", text: "#888888", label: "FREE"    },
  };
  const s = map[plan] || map.free;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: s.bg }}>
      <Text style={{ color: s.text, fontSize: 10, fontWeight: "800" }}>{s.label}</Text>
    </View>
  );
}

function KpiCard({ value, label, color }) {
  return (
    <View style={{ minWidth: 90, backgroundColor: "#111827", borderRadius: 14, padding: 14,
      borderTopWidth: 3, borderTopColor: color || ROSE,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
      shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
      elevation: 2, marginRight: 10, alignItems: "center" }}>
      <Text style={{ color: color || ROSE, fontSize: 24, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

// ── Coach Squad Feed ──────────────────────────────────────────────────────────
function CoachSquadFeed() {
  const { session } = useContext(AuthCtx);
  const [feedPosts,   setFeedPosts]   = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedFilter,  setFeedFilter]  = useState("all");
  const [commentPost, setCommentPost] = useState(null);
  const [comments,    setComments]    = useState({});
  const [commentInput,setCommentInput]= useState("");
  const [activitySummary, setActivitySummary] = useState({ postsToday: 0, milestonesToday: 0 });

  const currentUserId = session?.userId || null;

  function mapDbPost(row) {
    const type = row.post_type || row.type || "thought";
    const TYPE_EMOJIS = { thought:"💬", workout:"🏃", meal:"🍽️", challenge:"🏆", water:"💧" };
    return {
      id:           row.id,
      userId:       row.user_id,
      userName:     row.user_name || "Member",
      userInitials: row.user_initials || "?",
      isCoach:      row.is_coach || false,
      isPinned:     row.is_pinned || false,
      type,
      emoji:        row.emoji || TYPE_EMOJIS[type] || "✨",
      content:      row.content || "",
      stats:        row.workout_data || null,
      likes:        row.likes || 0,
      likedBy:      row.liked_by || [],
      comments:     row.comments || 0,
      postedAt:     row.created_at,
    };
  }

  async function fetchFeed() {
    setFeedLoading(true);
    const { data, error } = await supabase
      .from("squad_feed")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const posts = data.map(mapDbPost);
      setFeedPosts(posts);
      const today = new Date().toISOString().split("T")[0];
      const todayPosts = posts.filter(p => p.postedAt && p.postedAt.startsWith(today));
      setActivitySummary({
        postsToday: todayPosts.length,
        milestonesToday: todayPosts.filter(p => p.type === "challenge" || p.type === "streak").length,
      });
    }
    setFeedLoading(false);
  }

  useEffect(() => {
    fetchFeed();
    const channel = supabase
      .channel("coach_squad_feed_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function toggleLike(post) {
    const uid = currentUserId;
    if (!uid) return;
    const alreadyLiked = (post.likedBy || []).includes(uid);
    const newLikedBy = alreadyLiked ? post.likedBy.filter(id => id !== uid) : [...(post.likedBy || []), uid];
    const newLikes = newLikedBy.length;
    setFeedPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes, likedBy: newLikedBy } : p));
    try {
      await supabase.from("squad_feed").update({ likes: newLikes, liked_by: newLikedBy }).eq("id", post.id);
    } catch (_) {}
  }

  async function pinPost(postId, pinned) {
    setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, isPinned: !pinned } : p));
    try { await supabase.from("squad_feed").update({ is_pinned: !pinned }).eq("id", postId); } catch (_) {}
  }

  async function deletePost(postId) {
    setFeedPosts(prev => prev.filter(p => p.id !== postId));
    try { await supabase.from("squad_feed").update({ content: "[deleted]", emoji: "🗑️" }).eq("id", postId); } catch (_) {}
  }

  async function loadComments(postId) {
    try {
      const { data } = await supabase.from("squad_comments").select("*").eq("post_id", postId).order("created_at");
      if (data) setComments(prev => ({ ...prev, [postId]: data }));
    } catch (_) {}
  }

  async function submitComment(postId) {
    const text = commentInput.trim();
    if (!text) return;
    setCommentInput("");
    const newComment = { id: Date.now().toString(), post_id: postId, user_name: "Coach TinaBarks", user_initials: "CT", is_coach: true, content: text, created_at: new Date().toISOString() };
    setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), newComment] }));
    setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p));
    try {
      await supabase.from("squad_comments").insert({ post_id: postId, user_id: currentUserId, user_name: "Coach TinaBarks", user_initials: "CT", is_coach: true, content: text });
      await supabase.from("squad_feed").update({ comments: (feedPosts.find(p => p.id === postId)?.comments || 0) + 1 }).eq("id", postId);
    } catch (_) {}
  }

  const FILTERS = [
    { key: "all",        label: "All" },
    { key: "workout",    label: "Workouts" },
    { key: "meal",       label: "Meals" },
    { key: "challenge",  label: "Challenges" },
    { key: "streak",     label: "Milestones" },
  ];

  const filtered = feedFilter === "all" ? feedPosts
    : feedFilter === "streak" ? feedPosts.filter(p => p.type === "challenge" || p.type === "streak")
    : feedPosts.filter(p => p.type === feedFilter);

  function CoachFeedCard({ post }) {
    const isLiked = (post.likedBy || []).includes(currentUserId);
    return (
      <View style={{ backgroundColor: post.isPinned ? "rgba(255,107,53,0.08)" : "#111827",
        borderRadius: 16, marginBottom: 12, padding: 16,
        borderWidth: 1, borderColor: post.isPinned ? "rgba(255,107,53,0.35)" : "rgba(255,255,255,0.08)" }}>
        {post.isPinned && (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: ROSE, fontSize: 11, fontWeight: "700", marginLeft: 4 }}>📌 PINNED</Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20,
            backgroundColor: post.isCoach ? ROSE : "#1E2837",
            alignItems: "center", justifyContent: "center", marginRight: 10 }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 14 }}>{post.userInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>{post.userName}</Text>
              {post.isCoach && (
                <View style={{ backgroundColor: ROSE, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "800" }}>HEAD COACH</Text>
                </View>
              )}
            </View>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 1 }}>
              {post.postedAt ? new Date(post.postedAt).toLocaleString() : ""}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => pinPost(post.id, post.isPinned)}
              style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, padding: 6 }}>
              <Text style={{ fontSize: 14 }}>{post.isPinned ? "📌" : "📍"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deletePost(post.id)}
              style={{ backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 8, padding: 6 }}>
              <Text style={{ fontSize: 14 }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20, marginBottom: 10 }}>
          {post.emoji} {post.content}
        </Text>
        {post.stats && (
          <View style={{ backgroundColor: "#1E2837", borderRadius: 10, padding: 10, marginBottom: 10,
            flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {post.stats.distance && <Text style={{ color: ROSE, fontSize: 12, fontWeight: "700" }}>📍 {post.stats.distance}</Text>}
            {post.stats.duration && <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>⏱ {post.stats.duration}</Text>}
            {post.stats.calories && <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>🔥 {post.stats.calories} cal</Text>}
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingTop: 10 }}>
          <TouchableOpacity onPress={() => toggleLike(post)} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ fontSize: 16 }}>{isLiked ? "❤️" : "🤍"}</Text>
            <Text style={{ color: isLiked ? ROSE : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600" }}>{post.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setCommentPost(post); loadComments(post.id); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ fontSize: 16 }}>💬</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600" }}>{post.comments || 0}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0D1B2A" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#111827" }}>
        <View style={{ padding: 16, paddingBottom: 12 }}>
          <Text style={{ color: "#FFF", fontSize: 20, fontWeight: "800" }}>Squad Feed</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 }}>Full coach visibility — all member activity</Text>
        </View>
      </SafeAreaView>

      {/* Activity summary */}
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: "#111827", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
        <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 12, alignItems: "center",
          borderTopWidth: 2, borderTopColor: ROSE }}>
          <Text style={{ color: ROSE, fontSize: 22, fontWeight: "800" }}>{activitySummary.postsToday}</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>posts today</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 12, alignItems: "center",
          borderTopWidth: 2, borderTopColor: "#22C55E" }}>
          <Text style={{ color: "#22C55E", fontSize: 22, fontWeight: "800" }}>{activitySummary.milestonesToday}</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>milestones reached</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 12, alignItems: "center",
          borderTopWidth: 2, borderTopColor: "#60A5FA" }}>
          <Text style={{ color: "#60A5FA", fontSize: 22, fontWeight: "800" }}>{feedPosts.length}</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>total posts</Text>
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: "#111827" }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row" }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.key} onPress={() => setFeedFilter(f.key)}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
              backgroundColor: feedFilter === f.key ? ROSE : "#1E2837",
              borderWidth: 1, borderColor: feedFilter === f.key ? ROSE : "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: feedFilter === f.key ? "#FFF" : "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Feed */}
      {feedLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={ROSE} size="large" />
          <Text style={{ color: "rgba(255,255,255,0.4)", marginTop: 12, fontSize: 14 }}>Loading squad activity...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <CoachFeedCard post={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>👥</Text>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>No posts yet in the Squad feed</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Comments Modal */}
      <Modal visible={!!commentPost} transparent animationType="slide" onRequestClose={() => setCommentPost(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCommentPost(null)} />
          <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: "75%", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" }} />
            </View>
            <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700", paddingHorizontal: 20, paddingBottom: 12 }}>
              Comments on {commentPost?.userName}'s post
            </Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {(comments[commentPost?.id] || []).length === 0 ? (
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", paddingVertical: 20 }}>No comments yet</Text>
              ) : (
                (comments[commentPost?.id] || []).map(c => (
                  <View key={c.id} style={{ flexDirection: "row", marginBottom: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16,
                      backgroundColor: c.is_coach ? ROSE : "#1E2837",
                      alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                      <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 12 }}>{c.user_initials || "?"}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 10 }}>
                      <Text style={{ color: c.is_coach ? ROSE : "#FFF", fontSize: 12, fontWeight: "700", marginBottom: 3 }}>{c.user_name}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 18 }}>{c.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={{ flexDirection: "row", padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
              <TextInput
                style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                  color: "#FFF", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                placeholder="Reply as Coach TinaBarks..." placeholderTextColor="rgba(255,255,255,0.35)"
                value={commentInput} onChangeText={setCommentInput}
                returnKeyType="send" onSubmitEditing={() => submitComment(commentPost?.id)} />
              <TouchableOpacity onPress={() => submitComment(commentPost?.id)}
                style={{ backgroundColor: ROSE, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Coach Overview ────────────────────────────────────────────────────────────
function CoachOverview() {
  const { logout, clients } = useContext(AuthCtx);
  const [realClients, setRealClients] = useState([]);

  useEffect(() => {
    async function loadClients() {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .neq("email", COACH_CREDENTIALS.email.toLowerCase())
          .order("created_at", { ascending: false });
        if (data && data.length > 0) setRealClients(data);
      } catch (_e) {}
    }
    loadClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayClients = realClients.length > 0 ? realClients : clients;

  const totalClients  = displayClients.length;
  const activeClients = displayClients.filter(c => !c.lastActive?.includes("day") || parseInt(c.lastActive) < 7).length;
  const newThisWeek   = 1; // demo
  const mrr           = planMRR(displayClients.map(c => ({ ...c, plan: c.subscription || c.plan || "free" })));
  const premium       = displayClients.filter(c => (c.subscription || c.plan) === "monthly" || (c.subscription || c.plan) === "annual").length;
  const annualRev     = displayClients.filter(c => (c.subscription || c.plan) === "annual").reduce((s) => s + 16, 0);
  const retention     = Math.round((activeClients / Math.max(totalClients, 1)) * 100);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const ACTIVITY = [
    { icon: "🟢", text: "Sarah K. logged breakfast",         time: "2m ago"   },
    { icon: "🏃", text: "John D. completed 5K run",          time: "15m ago"  },
    { icon: "💤", text: "Mary L. logged 8h sleep",           time: "1h ago"   },
    { icon: "🆕", text: "James M. joined WeGoFit",           time: "2h ago"   },
    { icon: "💳", text: "Anna B. upgraded to Annual",        time: "3h ago"   },
    { icon: "⚠️", text: "Mike R. hasn't logged in 5 days",   time: "—"        },
  ];

  const ALERTS = [
    { color: "#EF4444", text: "3 clients inactive 7+ days"          },
    { color: "#F59E0B", text: "2 subscriptions expiring this week"  },
    { color: "#EF4444", text: "1 client averaging <5h sleep"         },
    { color: "#F59E0B", text: "5 clients not hitting calorie goals"  },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ backgroundColor: "#111827", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
          borderBottomWidth: 1, borderBottomColor: ROSE_DIM }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", textAlign: "center" }}>{greeting}, TinaBarks 👋</Text>
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <View style={{ backgroundColor: "rgba(255,184,0,0.15)", borderRadius: 20, paddingHorizontal: 12,
              paddingVertical: 4, borderWidth: 1, borderColor: "#FFB800" }}>
              <Text style={{ color: "#FFB800", fontSize: 12, fontWeight: "700" }}>👑 HEAD COACH</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{COACH_CREDENTIALS.email}</Text>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>{new Date().toDateString()}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          {/* KPI Row 1 */}
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 10 }}>Overview</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <KpiCard value={totalClients}  label={"Total\nClients"}       color={ROSE}      />
            <KpiCard value={activeClients} label={"Active\n(30 days)"}    color={ROSE}      />
            <KpiCard value={newThisWeek}   label={"New\nThis Week"}        color="#10B981"   />
            <KpiCard value={`$${mrr}`}     label={"Monthly\nRevenue"}      color="#10B981"   />
            <KpiCard value={premium}       label={"Premium\nMembers"}      color={ROSE}      />
            <KpiCard value={`$${annualRev}`} label={"Annual\nRevenue"}     color="#10B981"   />
            <KpiCard value={`${retention}%`} label={"Retention\nRate"}    color="#F59E0B"   />
          </ScrollView>

          {/* Activity Feed */}
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>
              Recent Activity 🔔
            </Text>
            {ACTIVITY.map((a, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8,
                borderBottomWidth: i < ACTIVITY.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ fontSize: 18, marginRight: 10 }}>{a.icon}</Text>
                <Text style={{ color: "#FFFFFF", fontSize: 13, flex: 1 }}>{a.text}</Text>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{a.time}</Text>
              </View>
            ))}
          </View>

          {/* Alerts */}
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>
              ⚠️ Needs Attention
            </Text>
            {ALERTS.map((a, i) => (
              <TouchableOpacity key={i}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10,
                  borderBottomWidth: i < ALERTS.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: a.color, marginRight: 10 }} />
                <Text style={{ color: "#FFFFFF", fontSize: 13, flex: 1 }}>{a.text}</Text>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Client Detail Screen ──────────────────────────────────────────────────────
function ClientDetail({ client: rawClient, onBack }) {
  const { saveCoachNote, loadCoachNote } = useContext(AuthCtx);
  const ctx = useContext(Ctx);
  const unlockBadge = ctx?.unlockBadge ?? (() => Promise.resolve(false));
  const awardPoints = ctx?.awardPoints ?? (() => Promise.resolve());
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [hasError, setHasError] = useState(false);

  // safe client object — every field has a fallback so nothing downstream can crash
  const client = {
    id:          rawClient?.id          ?? "unknown",
    name:        rawClient?.name        ?? "Unknown Client",
    email:       rawClient?.email       ?? "—",
    plan:        rawClient?.plan        ?? "free",
    goal:        rawClient?.goal        ?? "—",
    calories:    rawClient?.calories    ?? 0,
    target:      rawClient?.target      ?? 2000,
    sleep:       rawClient?.sleep       ?? 0,
    streak:      rawClient?.streak      ?? 0,
    weight:      rawClient?.weight      ?? null,
    goalWeight:  rawClient?.goalWeight  ?? null,
    age:         rawClient?.age         ?? null,
    gender:      rawClient?.gender      ?? "female",
    height:      rawClient?.height      ?? null,
    memberSince: rawClient?.memberSince ?? "—",
    lastActive:  rawClient?.lastActive  ?? "—",
    activity_level: rawClient?.activity_level ?? "moderate",
  };

  const loadNote = useCallback(() => {
    loadCoachNote(client.id).then(n => setNote(n ?? "")).catch(() => {});
  }, [client.id, loadCoachNote]);

  useEffect(() => {
    try { loadNote(); } catch (e) {}
  }, [loadNote]);

  async function handleSaveNote() {
    try {
      await saveCoachNote(client.id, note);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (e) {}
  }

  const planName = client.plan ? client.plan.charAt(0).toUpperCase() + client.plan.slice(1) : "Free";
  const calPct   = client.target > 0 ? Math.min(Math.round((client.calories / client.target) * 100), 100) : 0;

  const calHistory = [1650, 1820, 1550, 1780, client.calories || 0, 1690, 1720];
  const avgCal     = Math.round(calHistory.reduce((s, v) => s + (v || 0), 0) / calHistory.length);
  const adherence  = Math.round((calHistory.filter(v => Math.abs((v || 0) - client.target) < 200).length / 7) * 100);

  if (hasError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: ROSE, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Unable to load profile</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center", marginBottom: 24 }}>
          Unable to load profile. Try again.
        </Text>
        <TouchableOpacity onPress={onBack}
          style={{ backgroundColor: ROSE, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>← Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16,
        backgroundColor: "#111827", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
          <Text style={{ color: ROSE, fontSize: 16, fontWeight: "700" }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 17, flex: 1 }}>Client Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 16, padding: 20, marginBottom: 16,
          borderWidth: 1, borderColor: ROSE_DIM, alignItems: "center" }}>
          <CoachAvatar name={client.name} size={64} />
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 10 }}>{client.name}</Text>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 2 }}>{client.email}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <PlanBadge plan={client.plan} />
          </View>
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 6 }}>Member since {client.memberSince}</Text>
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Last active: {client.lastActive}</Text>
          <TouchableOpacity style={{ backgroundColor: ROSE, borderRadius: 10, paddingHorizontal: 20,
            paddingVertical: 10, marginTop: 14 }}>
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>💬 Message Client</Text>
          </TouchableOpacity>
        </View>

        {/* Vital stats */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          {[
            { l: "Age",    v: client.age    || "—" },
            { l: "Height", v: client.height ? `${client.height}cm` : "—" },
            { l: "Weight", v: client.weight ? `${client.weight}kg` : "—" },
            { l: "Goal Wt", v: client.goalWeight ? `${client.goalWeight}kg` : "—" },
          ].map(s => (
            <View key={s.l} style={{ flex: 1, backgroundColor: "#111827", borderRadius: 12, padding: 10,
              alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: ROSE, fontWeight: "800", fontSize: 16 }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Today's progress */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Today's Progress</Text>
          <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Calories</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>
              {client.calories} / {client.target} kcal
            </Text>
          </Row>
          <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, marginBottom: 12 }}>
            <View style={{ height: 8, borderRadius: 4, width: `${calPct}%`, backgroundColor: ROSE }} />
          </View>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Sleep last night</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>{client.sleep}h</Text>
          </Row>
        </View>

        {/* Health Metrics */}
        {client.weight && client.height && (
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Row style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>📊</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Health Metrics</Text>
            </Row>
            {(() => {
              const bmi       = calcBMI(client.weight, client.height);
              const bmiInfo   = getBMICategory(bmi);
              const clientBmr = calcBMR(client.gender || "female", client.weight, client.height, client.age || 30);
              const clientTdee = calcTDEE(clientBmr, client.activity_level || "moderate");
              const rawTarget = calcDailyTarget(clientTdee, (client.goal || "").toLowerCase().includes("lose") ? "lose"
                : (client.goal || "").toLowerCase().includes("muscle") ? "gain" : "maintain");
              const dailyTarget = getSafeCalorieTarget(rawTarget, client.gender || "female");
              const intakeStatus = getCalorieStatus(client.calories || 0, dailyTarget);
              const minCal = getMinimumCalories(client.gender || "female");
              const maxCal = client.gender === "male" ? 2200 : 1800;
              return (
                <>
                  {[
                    { l: "BMI",           v: `${bmi}  ${bmiInfo.emoji || ""}`, note: bmiInfo.label, col: bmiInfo.color },
                    { l: "Daily Target",  v: `${dailyTarget.toLocaleString()} kcal`, col: ROSE },
                    { l: "Formula",       v: "Mifflin-St Jeor + TDEE", col: "#888" },
                    { l: "Today's intake", v: `${client.calories || 0} kcal`, col: intakeStatus.color },
                  ].map(r => (
                    <Row key={r.l} style={{ justifyContent: "space-between", paddingVertical: 5,
                      borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{r.l}</Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: r.col, fontWeight: "600", fontSize: 13 }}>{r.v}</Text>
                        {r.note && <Text style={{ color: r.col, fontSize: 10 }}>{r.note}</Text>}
                      </View>
                    </Row>
                  ))}
                  <Row style={{ justifyContent: "space-between", paddingTop: 6 }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Status</Text>
                    <Text style={{ color: intakeStatus.color, fontWeight: "700", fontSize: 13 }}>
                      {intakeStatus.emoji} {intakeStatus.label} ({(client.calories || 0) - dailyTarget > 0 ? "+" : ""}{(client.calories || 0) - dailyTarget})
                    </Text>
                  </Row>
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 8 }}>
                    {client.gender === "male" ? "Men" : "Women"} reference: {minCal.toLocaleString()}–{maxCal.toLocaleString()} kcal
                  </Text>
                </>
              );
            })()}
          </View>
        )}

        {/* Nutrition history */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Nutrition (7 days)</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 12 }}>
            {calHistory.map((v, i) => {
              const h = Math.round((v / 2200) * 60);
              return (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ height: h, backgroundColor: i === 4 ? ROSE : "rgba(255,107,53,0.2)", borderRadius: 4, width: "100%" }} />
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 3 }}>
                    {["M","T","W","T","F","S","S"][i]}
                  </Text>
                </View>
              );
            })}
          </View>
          {[
            { l: "Avg cal/day",  v: `${avgCal} kcal` },
            { l: "Adherence",    v: `${adherence}%`   },
            { l: "Goal",         v: `${client.target} kcal` },
          ].map(r => (
            <Row key={r.l} style={{ justifyContent: "space-between", paddingVertical: 5,
              borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{r.l}</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{r.v}</Text>
            </Row>
          ))}
        </View>

        {/* Sleep history */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Sleep (7 days)</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 12 }}>
            {[7.2, 6.8, 8.0, 7.5, client.sleep || 0, 7.0, 6.5].map((v, i) => {
              const h = Math.round((v / 10) * 60);
              const col = v >= 7 ? "#10B981" : v >= 6 ? "#F59E0B" : "#EF4444";
              return (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ height: h, backgroundColor: col, borderRadius: 4, width: "100%", opacity: 0.7 }} />
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 3 }}>
                    {["M","T","W","T","F","S","S"][i]}
                  </Text>
                </View>
              );
            })}
          </View>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Avg sleep</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{client.sleep || "—"}h / night</Text>
          </Row>
        </View>

        {/* Coach notes */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 4 }}>Coach Notes</Text>
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginBottom: 10 }}>🔒 Private — only you can see these</Text>
          <TextInput
            style={[S.input, { height: 100, textAlignVertical: "top", fontSize: 14 }]}
            placeholder="Add private coaching notes..."
            placeholderTextColor="#BBB"
            value={note}
            onChangeText={setNote}
            multiline
          />
          <TouchableOpacity onPress={handleSaveNote}
            style={{ backgroundColor: noteSaved ? "#10B981" : ROSE, borderRadius: 10,
              paddingVertical: 10, alignItems: "center", marginTop: 10 }}>
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>
              {noteSaved ? "✅ Saved!" : "Save Notes"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subscription */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Subscription</Text>
          {[
            { l: "Plan",          v: planName },
            { l: "Member since",  v: client.memberSince },
            { l: "Monthly value", v: `$${PLAN_PRICE[client.plan] || 0}` },
          ].map(r => (
            <Row key={r.l} style={{ justifyContent: "space-between", paddingVertical: 6,
              borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{r.l}</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{r.v}</Text>
            </Row>
          ))}
        </View>

        {/* Meal Plan Summary */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Row style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>📋</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Current Meal Plan</Text>
          </Row>
          <Row style={{ justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Plan status</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>
              {client.plan !== "free" ? "Premium — can generate" : "Free plan"}
            </Text>
          </Row>
          <Row style={{ justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Calorie target</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{client.target} kcal / day</Text>
          </Row>
          <Row style={{ justifyContent: "space-between", paddingVertical: 6 }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Logging adherence</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{adherence}% this week</Text>
          </Row>
        </View>

        {/* TinaBarks Choice Badge Award */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1.5, borderColor: ROSE_DIM }}>
          <Row style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 22, marginRight: 8 }}>🌸</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: ROSE, fontWeight: "700", fontSize: 15 }}>TinaBarks Choice Award</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>Legendary badge · 500 pts · Awarded personally by you</Text>
            </View>
          </Row>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
            Award {client.name} this exclusive badge for outstanding dedication, consistency or transformation.
            This cannot be revoked once given.
          </Text>
          <TouchableOpacity
            onPress={() => Alert.alert(
              "Award TinaBarks Choice?",
              `This will award ${client.name} the legendary "TinaBarks Choice" badge (500 pts) and post a community announcement. This action cannot be undone.`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Award Badge 🌸", onPress: async () => {
                    const awarded = await unlockBadge("tinabarks_choice");
                    if (awarded) {
                      await awardPoints("badge_award", 500);
                      Alert.alert("Badge Awarded! 🌸", `${client.name} has been awarded the TinaBarks Choice badge. They'll receive 500 WeGoFit Points!`);
                    } else {
                      Alert.alert("Already Awarded", `${client.name} already has this badge.`);
                    }
                  }
                },
              ]
            )}
            style={{ backgroundColor: ROSE, borderRadius: 12, padding: 14, alignItems: "center",
              shadowColor: ROSE, shadowRadius: 8, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 0 } }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 14 }}>Award TinaBarks Choice Badge 🌸</Text>
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 8,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 14, marginBottom: 10 }}>Danger Zone</Text>
          <TouchableOpacity onPress={() => Alert.alert("Suspend Account", `Suspend ${client.name}?`, [{ text: "Cancel" }, { text: "Suspend", style: "destructive" }])}
            style={{ backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 10, padding: 12, alignItems: "center",
              borderWidth: 1, borderColor: "#F59E0B", marginBottom: 8 }}>
            <Text style={{ color: "#F59E0B", fontWeight: "700" }}>Suspend Account</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("Remove Client", `Permanently remove ${client.name}?`, [{ text: "Cancel" }, { text: "Remove", style: "destructive" }])}
            style={{ backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, padding: 12, alignItems: "center",
              borderWidth: 1, borderColor: "#EF4444" }}>
            <Text style={{ color: "#EF4444", fontWeight: "700" }}>Remove Client</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Coach Clients ─────────────────────────────────────────────────────────────
function CoachClients() {
  const { clients } = useContext(AuthCtx);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("all");
  const [selected,    setSelected]    = useState(null);
  const [realClients, setRealClients] = useState([]);

  useEffect(() => {
    async function loadClients() {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .neq("email", COACH_CREDENTIALS.email.toLowerCase())
          .order("created_at", { ascending: false });
        if (data && data.length > 0) setRealClients(data);
      } catch (_e) {}
    }
    loadClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayClients = realClients.length > 0
    ? realClients.map(c => ({
        id:          c.id,
        name:        c.name || c.email,
        email:       c.email,
        plan:        c.subscription || "free",
        goal:        c.goal || "Improve Fitness",
        calories:    0,
        target:      c.calories || 2000,
        sleep:       0,
        streak:      0,
        weight:      c.weight_kg || 0,
        goalWeight:  c.goal_weight || 0,
        age:         c.age || 0,
        gender:      c.gender || "other",
        height:      c.height_cm || 0,
        memberSince: c.member_since || (c.created_at || "").split("T")[0],
        lastActive:  "recently",
        activity_level: c.activity || "sedentary",
      }))
    : clients;

  if (selected) return <ClientDetail client={selected} onBack={() => setSelected(null)} />;

  const filtered = displayClients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    const matchFilter = filter === "all"
      || (filter === "active"   && !c.lastActive?.includes("day"))
      || (filter === "inactive" && (c.lastActive?.includes("day") && parseInt(c.lastActive) >= 5))
      || (filter === "premium"  && (c.plan === "monthly" || c.plan === "annual"))
      || (filter === "free"     && c.plan === "free");
    return matchSearch && matchFilter;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: "#111827",
        borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 10 }}>Clients</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1E2837",
          borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "rgba(255,255,255,0.3)", marginRight: 8 }}>🔍</Text>
          <TextInput
            style={{ flex: 1, color: "#FFFFFF", fontSize: 14 }}
            placeholder="Search by name or email..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {["all","active","inactive","premium","free"].map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: filter === f ? ROSE : "#1E2837",
                borderWidth: 1, borderColor: filter === f ? ROSE : "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: filter === f ? "#FFF" : "rgba(255,255,255,0.45)", fontWeight: "600", fontSize: 13,
                textTransform: "capitalize" }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>No clients found.</Text>
          </View>
        )}
        {filtered.map((c, i) => {
          const calPct = c.target > 0 ? Math.min(Math.round((c.calories / c.target) * 100), 100) : 0;
          return (
            <View key={c.id} style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 12,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
              shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
              <Row style={{ marginBottom: 10 }}>
                <CoachAvatar name={c.name} size={44} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Row>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginRight: 8 }}>{c.name}</Text>
                    <PlanBadge plan={c.plan} />
                  </Row>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>{c.email}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Goal: {c.goal}</Text>
                </View>
              </Row>

              {/* Today's stats */}
              <Row style={{ gap: 10, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: "space-between", marginBottom: 3 }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>Calories today</Text>
                    <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 11 }}>
                      {c.calories}/{c.target}
                    </Text>
                  </Row>
                  <View style={{ height: 5, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                    <View style={{ height: 5, borderRadius: 3, width: `${calPct}%`, backgroundColor: calPct >= 90 ? "#10B981" : ROSE }} />
                  </View>
                </View>
              </Row>

              <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                  Sleep: <Text style={{ color: c.sleep >= 7 ? "#10B981" : c.sleep >= 6 ? "#F59E0B" : "#EF4444", fontWeight: "700" }}>{c.sleep}h</Text>
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                  Streak: <Text style={{ color: ROSE, fontWeight: "700" }}>🔥{c.streak} days</Text>
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Active: {c.lastActive}</Text>
              </Row>

              <TouchableOpacity onPress={() => setSelected(c)}
                style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 10, padding: 10,
                  alignItems: "center", borderWidth: 1, borderColor: ROSE_DIM }}>
                <Text style={{ color: ROSE, fontWeight: "700", fontSize: 13 }}>View Full Profile →</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Coach Messages ────────────────────────────────────────────────────────────
function CoachMessages() {
  const { clients } = useContext(AuthCtx);
  const [selClient, setSelClient] = useState(null);
  const [threads,   setThreads]   = useState({});
  const [input,     setInput]     = useState("");
  const listRef = useRef(null);

  const QUICK = [
    "Great progress this week! Keep it up 💪",
    "Don't forget to log your meals today! 🥗",
    "How are you feeling after yesterday's workout?",
    "Your sleep has been low this week 😴 Try to get to bed earlier tonight.",
    "You're doing amazing — keep going! 🎯",
    "Reminder: hit your water goal today! 💧",
  ];

  function send(text) {
    if (!text?.trim() || !selClient) return;
    const msg = { id: `m${Date.now()}`, from: "coach", text: text.trim(), ts: new Date().toISOString() };
    setThreads(t => ({ ...t, [selClient.id]: [...(t[selClient.id] || []), msg] }));
    setInput("");
  }

  function broadcastAll() {
    Alert.alert(
      "Broadcast Message",
      `Send to all ${clients.length} clients?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send", onPress: () => {
          const msg = { id: `m${Date.now()}`, from: "coach", text: "Hello everyone! 👋 Keep up the great work!", ts: new Date().toISOString() };
          const newThreads = {};
          clients.forEach(c => { newThreads[c.id] = [...(threads[c.id] || []), msg]; });
          setThreads(prev => ({ ...prev, ...newThreads }));
          Alert.alert("Sent!", `Message sent to ${clients.length} clients.`);
        }},
      ]
    );
  }

  if (selClient) {
    const msgs = threads[selClient.id] || [];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
        <StatusBar style="light" backgroundColor="transparent" translucent={true} />
        <View style={{ flexDirection: "row", alignItems: "center", padding: 16,
          backgroundColor: "#111827", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
          <TouchableOpacity onPress={() => setSelClient(null)} style={{ marginRight: 12 }}>
            <Text style={{ color: ROSE, fontSize: 16, fontWeight: "700" }}>← Back</Text>
          </TouchableOpacity>
          <CoachAvatar name={selClient.name} size={34} />
          <View style={{ marginLeft: 8 }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{selClient.name}</Text>
            <Text style={{ color: "#10B981", fontSize: 11 }}>🟢 Active</Text>
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 14, gap: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isCoach = item.from === "coach";
              return (
                <View style={{ alignItems: isCoach ? "flex-end" : "flex-start" }}>
                  <View style={{ backgroundColor: isCoach ? ROSE : "#1E2837",
                    borderRadius: 16, padding: 12, maxWidth: SW * 0.72,
                    borderWidth: isCoach ? 0 : 1, borderColor: "rgba(255,255,255,0.08)" }}>
                    <Text style={{ color: isCoach ? "#FFF" : "#FFFFFF", fontSize: 14 }}>{item.text}</Text>
                    <Text style={{ color: isCoach ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 4 }}>
                      {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No messages yet. Say hello! 👋</Text>
              </View>
            }
          />

          {/* Quick replies */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}
            style={{ backgroundColor: "#111827", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
            {QUICK.map((q, i) => (
              <TouchableOpacity key={i} onPress={() => send(q)}
                style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                  borderWidth: 1, borderColor: ROSE_DIM }}>
                <Text style={{ color: ROSE, fontSize: 12, maxWidth: 160 }} numberOfLines={1}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", padding: 12, gap: 8, backgroundColor: "#111827",
            borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
            <TextInput
              style={[S.input, { flex: 1, paddingVertical: 10 }]}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={() => send(input)}
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: input.trim() ? ROSE : "rgba(255,255,255,0.08)",
                alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18 }}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
        backgroundColor: "#111827", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>Messages</Text>
          <TouchableOpacity onPress={broadcastAll}
            style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 10, paddingHorizontal: 12,
              paddingVertical: 6, borderWidth: 1, borderColor: ROSE_DIM }}>
            <Text style={{ color: ROSE, fontSize: 13, fontWeight: "700" }}>📢 Broadcast</Text>
          </TouchableOpacity>
        </Row>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {clients.map(c => {
          const last = (threads[c.id] || []).slice(-1)[0];
          const unread = (threads[c.id] || []).filter(m => m.from !== "coach").length;
          return (
            <TouchableOpacity key={c.id} onPress={() => setSelClient(c)}
              style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 10,
                flexDirection: "row", alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
              <View style={{ position: "relative", marginRight: 12 }}>
                <CoachAvatar name={c.name} size={44} />
                <View style={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 12,
                  borderRadius: 6, backgroundColor: "#10B981", borderWidth: 2, borderColor: "#111827" }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{c.name}</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {last ? last.text : "No messages yet"}
                </Text>
              </View>
              {unread > 0 && (
                <View style={{ backgroundColor: ROSE, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>{unread}</Text>
                </View>
              )}
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 18, marginLeft: 8 }}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Coach Revenue ─────────────────────────────────────────────────────────────
function CoachRevenue() {
  const { clients } = useContext(AuthCtx);
  const monthly  = clients.filter(c => c.plan === "monthly");
  const annual   = clients.filter(c => c.plan === "annual");
  const mrr      = planMRR(clients);
  const monthRev = monthly.length * 20;
  const annRev   = annual.length * 16;
  const projected = mrr * 12;

  const paying = clients.filter(c => c.plan !== "free");

  async function exportAsPDF() {
    try {
      if (!Print) { Alert.alert("Error", "PDF export not available."); return; }
      const html = `
        <html>
          <body style="font-family:Arial; padding:40px; color:#1A1A2E;">
            <h1 style="color:#FF6B35;">WeGoFit Revenue Report</h1>
            <p>Generated: ${new Date().toDateString()}</p>
            <hr/>
            <h2>Summary</h2>
            <p>Total Monthly Revenue: $${mrr}</p>
            <p>Active Clients: ${clients.length}</p>
            <p>Monthly Subscribers: ${monthly.length}</p>
            <p>Annual Subscribers: ${annual.length}</p>
            <p>Projected Annual Revenue: $${projected.toLocaleString()}</p>
            <hr/>
            <p style="color:gray; font-size:12px;">WeGoFit — Better Habits. Better You.</p>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      if (Sharing) {
        await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
      } else {
        Alert.alert("PDF saved", uri);
      }
    } catch (_e) {
      Alert.alert("Error", "Could not export PDF.");
    }
  }

  async function exportAsCSV() {
    try {
      if (!FileSystem) { Alert.alert("Error", "CSV export not available."); return; }
      const rows = [
        "Date,Client,Plan,Amount,Status",
        ...paying.map(c =>
          `${new Date().toISOString().slice(0, 10)},${c.name},${c.plan},$${PLAN_PRICE[c.plan]},Paid`
        ),
      ];
      const csvContent = rows.join("\n");
      const fileUri = FileSystem.documentDirectory + "wegofit-revenue-report.csv";
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      if (Sharing) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "WeGoFit Revenue Report" });
      } else {
        Alert.alert("CSV saved", fileUri);
      }
    } catch (_e) {
      Alert.alert("Error", "Could not export CSV.");
    }
  }

  function handleExport() {
    Alert.alert(
      "Export Revenue Report",
      "Choose your preferred format:",
      [
        { text: "📄 Export as PDF",         onPress: exportAsPDF },
        { text: "📊 Export as CSV (Excel)", onPress: exportAsCSV },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  // mock 6-month history
  const months = ["Dec","Jan","Feb","Mar","Apr","May"];
  const barData = [58, 62, 68, 74, 80, mrr];
  const maxBar  = Math.max(...barData);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 16 }}>Revenue</Text>

        {/* Summary cards */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          {[
            { v: `$${mrr}`,      l: "Total MRR"       },
            { v: `$${monthRev}`, l: "Monthly plan"    },
            { v: `$${annRev}`,   l: "Annual plan"     },
          ].map(s => (
            <View key={s.l} style={{ flex: 1, backgroundColor: "#111827", borderRadius: 14, padding: 14,
              alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
              borderTopWidth: 3, borderTopColor: "#10B981" }}>
              <Text style={{ color: "#10B981", fontSize: 22, fontWeight: "800" }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2, textAlign: "center" }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Projected */}
        <View style={{ backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 14, padding: 14, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" }}>
          <Text style={{ color: "#10B981", fontWeight: "800", fontSize: 15 }}>
            📈 Projected Annual: ${projected.toLocaleString()}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 4 }}>Based on current MRR × 12</Text>
        </View>

        {/* Revenue chart */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 16 }}>
            Monthly Revenue (6 months)
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 80, marginBottom: 8 }}>
            {barData.map((v, i) => {
              const h = Math.max(4, Math.round((v / maxBar) * 80));
              return (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, marginBottom: 2 }}>${v}</Text>
                  <View style={{ height: h, backgroundColor: i === barData.length - 1 ? "#10B981" : "rgba(16,185,129,0.2)",
                    borderRadius: 4, width: "100%" }} />
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {months.map(m => (
              <Text key={m} style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, flex: 1, textAlign: "center" }}>{m}</Text>
            ))}
          </View>
        </View>

        {/* Subscription breakdown */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>
            Subscription Breakdown
          </Text>
          {[
            { label: "Free",    count: clients.filter(c=>c.plan==="free").length,    color: "rgba(255,255,255,0.2)", pct: Math.round(clients.filter(c=>c.plan==="free").length/clients.length*100)    },
            { label: "Monthly", count: monthly.length, color: ROSE,      pct: Math.round(monthly.length/clients.length*100)  },
            { label: "Annual",  count: annual.length,  color: "#F59E0B", pct: Math.round(annual.length/clients.length*100)   },
          ].map(row => (
            <View key={row.label} style={{ marginBottom: 10 }}>
              <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{row.label} ({row.count})</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{row.pct}%</Text>
              </Row>
              <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                <View style={{ height: 6, borderRadius: 3, width: `${row.pct}%`, backgroundColor: row.color }} />
              </View>
            </View>
          ))}
        </View>

        {/* Subscriber table */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>
            Paying Subscribers
          </Text>
          {paying.map((c, i) => {
            const exp = c.plan === "monthly" ? "Monthly" : "Annual";
            return (
              <View key={c.id} style={{ paddingVertical: 10,
                borderBottomWidth: i < paying.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13, flex: 1 }}>{c.name}</Text>
                  <PlanBadge plan={c.plan} />
                  <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 13, marginLeft: 10 }}>
                    ${PLAN_PRICE[c.plan]}/mo
                  </Text>
                </Row>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 }}>
                  Since {c.memberSince} · {exp} · ✅ Active
                </Text>
              </View>
            );
          })}
          {paying.length === 0 && <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No paying subscribers yet.</Text>}
        </View>

        {/* Export button */}
        <TouchableOpacity onPress={handleExport}
          style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, alignItems: "center",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 14 }}>📥 Export Revenue Report</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Coach Settings ────────────────────────────────────────────────────────────
function CoachSettings() {
  const { logout } = useContext(AuthCtx);
  const [notifClient,  setNotifClient]  = useState(true);
  const [dailySummary, setDailySummary] = useState(true);
  const [inactiveAlert,setInactiveAlert]= useState(true);
  const [paymentNotif, setPaymentNotif] = useState(true);
  const [showCoachPw,  setShowCoachPw]  = useState(false);
  const [newSignup,    setNewSignup]    = useState(true);

  function Toggle({ value, onToggle }) {
    return (
      <TouchableOpacity onPress={onToggle}
        style={{ width: 46, height: 26, borderRadius: 13,
          backgroundColor: value ? ROSE : "rgba(255,255,255,0.15)", justifyContent: "center", paddingHorizontal: 2 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFF",
          alignSelf: value ? "flex-end" : "flex-start" }} />
      </TouchableOpacity>
    );
  }

  function SettingRow({ label, value, onToggle, onPress }) {
    return (
      <TouchableOpacity onPress={onPress || undefined}
        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
        <Text style={{ flex: 1, color: "#FFFFFF", fontSize: 15 }}>{label}</Text>
        {onToggle
          ? <Toggle value={value} onToggle={onToggle} />
          : <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>›</Text>
        }
      </TouchableOpacity>
    );
  }

  function Section({ title, children }) {
    return (
      <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700", textTransform: "uppercase",
          letterSpacing: 1, marginBottom: 4 }}>{title}</Text>
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 16 }}>Settings</Text>

        {/* Profile */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 16, padding: 20, marginBottom: 16,
          borderWidth: 1, borderColor: ROSE_DIM, alignItems: "center" }}>
          <CoachAvatar name="TinaBarks" size={64} />
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 10 }}>TinaBarks</Text>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 2 }}>{COACH_CREDENTIALS.email}</Text>
          <View style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
            marginTop: 8, borderWidth: 1, borderColor: "#F59E0B40" }}>
            <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "700" }}>👑 Head Coach & Admin</Text>
          </View>
          <TouchableOpacity style={{ marginTop: 12, borderWidth: 1, borderColor: ROSE_DIM,
            borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 }}>
            <Text style={{ color: ROSE, fontWeight: "700", fontSize: 14 }}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <Section title="Notifications">
          <SettingRow label="🔔 Client activity"        value={notifClient}   onToggle={() => setNotifClient(v=>!v)}   />
          <SettingRow label="📧 Daily summary email"    value={dailySummary}  onToggle={() => setDailySummary(v=>!v)}  />
          <SettingRow label="⚠️ Inactive client alerts" value={inactiveAlert} onToggle={() => setInactiveAlert(v=>!v)} />
          <SettingRow label="💳 Payment notifications"  value={paymentNotif}  onToggle={() => setPaymentNotif(v=>!v)}  />
          <SettingRow label="🌙 New signup alerts"      value={newSignup}     onToggle={() => setNewSignup(v=>!v)}      />
        </Section>

        <Section title="Business Info">
          {[
            { l: "App Name",         v: "WeGoFit"                       },
            { l: "Coach",            v: "TinaBarks"                     },
            { l: "Email",            v: COACH_CREDENTIALS.email         },
            { l: "Monthly Price",    v: "$20 / month"                   },
            { l: "Annual Price",     v: "$16 / mo ($192/year)"          },
            { l: "Free Trial",       v: "7 days"                        },
          ].map(r => (
            <Row key={r.l} style={{ justifyContent: "space-between", paddingVertical: 8,
              borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{r.l}</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{r.v}</Text>
            </Row>
          ))}
        </Section>

        <Section title="Security">
          <SettingRow label="Change Password" onPress={() => setShowCoachPw(true)} />
          <SettingRow label="Change Email"    onPress={() => Alert.alert("Change Email", "Feature coming soon.")}    />
          <Row style={{ paddingVertical: 8, justifyContent: "space-between" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Last login</Text>
            <Text style={{ color: "#FFFFFF", fontSize: 13 }}>{new Date().toLocaleString()}</Text>
          </Row>
        </Section>

        <Section title="Danger Zone">
          <TouchableOpacity onPress={() => Alert.alert("Export Data", "All client data export — coming soon.")}
            style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 15 }}>Export All Client Data</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("Reset Demo Data", "This will reset all demo data.", [{ text: "Cancel" }, { text: "Reset", style: "destructive" }])}
            style={{ paddingVertical: 12 }}>
            <Text style={{ color: "#EF4444", fontSize: 15 }}>Reset All Demo Data</Text>
          </TouchableOpacity>
        </Section>

        <TouchableOpacity onPress={() => Alert.alert("Sign Out", "Sign out of coach dashboard?",
          [{ text: "Cancel" }, { text: "Sign Out", style: "destructive", onPress: logout }])}
          style={{ backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 14, padding: 16, alignItems: "center",
            borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", marginBottom: 16 }}>
          <Text style={{ color: "#EF4444", fontWeight: "800", fontSize: 15 }}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", marginBottom: 4 }}>
          WeGoFit Coach Dashboard v1.0.0
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center" }}>© 2026 WeGoFit · TinaBarks</Text>
      </ScrollView>
      <CoachChangePwModal visible={showCoachPw} onClose={() => setShowCoachPw(false)} />
    </SafeAreaView>
  );
}

// ─── COACH CHANGE PASSWORD MODAL ──────────────────────────────────────────────
function CoachChangePwModal({ visible, onClose }) {
  const [curPw,    setCurPw]    = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [confPw,   setConfPw]   = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [error,    setError]    = useState("");
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);

  const str    = pwStrengthFull(newPw);
  const match  = newPw && confPw && newPw === confPw;

  function reset() { setCurPw(""); setNewPw(""); setConfPw(""); setError(""); setDone(false); }

  async function handleUpdate() {
    setError("");
    if (!curPw) { setError("Enter your current password."); return; }
    if (btoa(curPw) !== COACH_CREDENTIALS.password) { setError("Current password is incorrect."); return; }
    if (!newPw || newPw.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (!match) { setError("New passwords do not match."); return; }
    setBusy(true);
    COACH_CREDENTIALS.password = btoa(newPw);
    await new Promise(r => setTimeout(r, 600));
    setBusy(false);
    setDone(true);
    setTimeout(() => { onClose(); reset(); }, 1800);
  }

  const coachNewPwRef  = useRef(null);
  const coachConfPwRef = useRef(null);
  const [focused, setFocused] = useState(null);

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableWithoutFeedback onPress={() => { onClose(); reset(); }} accessible={false}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} />
        </TouchableWithoutFeedback>
        <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 44 : 36, paddingTop: 16, maxHeight: "92%" }}>
          <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2,
            alignSelf: "center", marginBottom: 20 }} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {done ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Text style={{ fontSize: 48 }}>🎉</Text>
                <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 16 }}>Password Updated!</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginTop: 8, textAlign: "center" }}>Your coach password has been changed.</Text>
              </View>
            ) : (
              <>
                <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 20 }}>🔒 Change Coach Password</Text>
                {error ? (
                  <View style={{ backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, padding: 12, marginBottom: 14,
                    borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }}>
                    <Text style={{ color: "#EF4444", fontSize: 13 }}>{error}</Text>
                  </View>
                ) : null}

                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Current Password</Text>
                <View style={{ position: "relative", justifyContent: "center", marginBottom: 14 }}>
                  <TextInput style={[S.input, { paddingRight: 50 }, focused === "cur" && S.inputFocused]}
                    placeholder="Current password" placeholderTextColor="rgba(255,255,255,0.3)"
                    value={curPw} onChangeText={v => { setCurPw(v); setError(""); }}
                    secureTextEntry={!showCur} autoCapitalize="none" autoCorrect={false}
                    returnKeyType="next" onSubmitEditing={() => coachNewPwRef.current?.focus()} blurOnSubmit={false}
                    onFocus={() => setFocused("cur")} onBlur={() => setFocused(null)} />
                  <EyeBtn show={showCur} onToggle={() => setShowCur(v => !v)} />
                </View>

                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>New Password</Text>
                <View style={{ position: "relative", justifyContent: "center", marginBottom: 8 }}>
                  <TextInput ref={coachNewPwRef} style={[S.input, { paddingRight: 50 }, focused === "new" && S.inputFocused]}
                    placeholder="New password" placeholderTextColor="rgba(255,255,255,0.3)"
                    value={newPw} onChangeText={setNewPw}
                    secureTextEntry={!showNew} autoCapitalize="none" autoCorrect={false}
                    returnKeyType="next" onSubmitEditing={() => coachConfPwRef.current?.focus()} blurOnSubmit={false}
                    onFocus={() => setFocused("new")} onBlur={() => setFocused(null)} />
                  <EyeBtn show={showNew} onToggle={() => setShowNew(v => !v)} />
                </View>
                {newPw.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, marginBottom: 4 }}>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: str.color, width: `${str.pct * 100}%` }} />
                    </View>
                    <Text style={{ color: str.color, fontSize: 12, fontWeight: "600" }}>{str.level}</Text>
                  </View>
                )}

                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Confirm New Password</Text>
                <View style={{ position: "relative", justifyContent: "center", marginBottom: 8 }}>
                  <TextInput ref={coachConfPwRef} style={[S.input, { paddingRight: 50 }, focused === "conf" && S.inputFocused]}
                    placeholder="Repeat new password" placeholderTextColor="rgba(255,255,255,0.3)"
                    value={confPw} onChangeText={setConfPw}
                    secureTextEntry={!showConf} autoCapitalize="none" autoCorrect={false}
                    returnKeyType="done" onSubmitEditing={handleUpdate}
                    onFocus={() => setFocused("conf")} onBlur={() => setFocused(null)} />
                  <EyeBtn show={showConf} onToggle={() => setShowConf(v => !v)} />
                </View>
                {confPw.length > 0 && (
                  <Text style={{ color: match ? "#22C55E" : "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 16 }}>
                    {match ? "✅ Passwords match" : "❌ Passwords don't match"}
                  </Text>
                )}

                <TouchableOpacity onPress={handleUpdate} disabled={busy || !match || !curPw}
                  style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 16, alignItems: "center",
                    opacity: busy || !match || !curPw ? 0.5 : 1,
                    shadowColor: ROSE, shadowRadius: 8, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 3 } }}>
                  {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Update Password</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onClose(); reset(); }} style={{ alignItems: "center", marginTop: 16, padding: 8 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Coach Tab Navigator ───────────────────────────────────────────────────────
const CoachTab = createBottomTabNavigator();

function CoachDashboard() {
  return (
    <CoachTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#111827", borderTopColor: "rgba(255,255,255,0.08)", height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   ROSE,
        tabBarInactiveTintColor: "rgba(255,255,255,0.45)",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <CoachTab.Screen name="COverview"    component={CoachOverview}    options={{ tabBarLabel: "Overview",   tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text> }} />
      <CoachTab.Screen name="CClients"     component={CoachClients}     options={{ tabBarLabel: "Clients",    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👥</Text> }} />
      <CoachTab.Screen name="CSquadFeed"   component={CoachSquadFeed}   options={{ tabBarLabel: "Squad",      tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏅</Text> }} />
      <CoachTab.Screen name="CChallenges"  component={CoachChallenges}  options={{ tabBarLabel: "Challenges", tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏆</Text> }} />
      <CoachTab.Screen name="CMessages"    component={CoachMessages}    options={{ tabBarLabel: "Messages",   tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💬</Text> }} />
      <CoachTab.Screen name="CRevenue"     component={CoachRevenue}     options={{ tabBarLabel: "Revenue",    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💰</Text> }} />
      <CoachTab.Screen name="CSettings"    component={CoachSettings}    options={{ tabBarLabel: "Settings",   tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text> }} />
    </CoachTab.Navigator>
  );
}

// ─── SUBSCRIPTION SCREEN ──────────────────────────────────────────────────────
const PESAPAL_ORDER_URL = "https://yswkyjfsxsbmshliphet.supabase.co/functions/v1/pesapal-order";
const SUPABASE_ANON_KEY_FOR_EDGE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzd2t5amZzeHNibXNobGlwaGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTQxMTksImV4cCI6MjA5NDE5MDExOX0.fo_Eq_6c3jk8Ws02TJLxNWX3qHSD2otu3ZvdQBVeD1Y";

const PLAN_PRICES = {
  monthly: { USD: 20,  UGX: 74000  },
  annual:  { USD: 192, UGX: 710000 },
};

// Display prices shown to user regardless of selected currency (fixed to UGX for clarity)
const PLAN_DISPLAY = {
  monthly: "UGX 74,000",
  annual:  "UGX 710,000",
};

const CURRENCY_SYMBOLS = { USD: "$", UGX: "UGX " };

function formatPrice(plan, currency) {
  const sym = CURRENCY_SYMBOLS[currency] || "";
  const amt = PLAN_PRICES[plan][currency];
  return `${sym}${amt.toLocaleString()}`;
}

async function submitPesapalOrder(payload, accessToken) {
  const res = await fetch(PESAPAL_ORDER_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "Apikey":        SUPABASE_ANON_KEY_FOR_EDGE,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Payment service error");
  return data;
}

// ─── TRIAL HELPERS ────────────────────────────────────────────────────────────
function trialKey(userId)        { return `gf_trial_start_${userId}`; }
function trialStatusKey(userId)  { return `gf_trial_status_${userId}`; }

async function getTrialDaysElapsed(userId) {
  try {
    // Primary: AsyncStorage (fast local cache)
    const raw = await AsyncStorage.getItem(trialKey(userId));
    if (raw) {
      const start = parseInt(raw, 10);
      if (!isNaN(start)) return Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
    }
    // Fallback: Supabase (survives device change / data clear)
    const { data } = await supabase
      .from("subscriptions")
      .select("start_date")
      .eq("user_id", userId)
      .eq("plan", "trial")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.start_date) {
      const start = new Date(data.start_date).getTime();
      // Repopulate local cache so subsequent reads are fast
      await AsyncStorage.setItem(trialKey(userId), String(start)).catch(() => {});
      return Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
    }
    return null;
  } catch (_e) { return null; }
}

async function startFreeTrial(userId) {
  await AsyncStorage.setItem(`gf_trial_start_${userId}`, String(Date.now()));
  await AsyncStorage.setItem(`gf_trial_status_${userId}`, "active");
}

async function clearTrialKeys(userId) {
  try {
    await AsyncStorage.multiRemove([trialKey(userId), trialStatusKey(userId)]);
  } catch (_e) {}
}

function SubscriptionScreen({ onSubscribed, expiredTrial, trialStats, onBack, isOnTrial }) {
  const { session, logout }    = useContext(AuthCtx);
  const [plan,       setPlan]       = useState("annual");
  const [currency,   setCurrency]   = useState("UGX");
  const [loading,    setLoading]    = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error,      setError]      = useState("");
  const [pendingMsg, setPendingMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const amount = PLAN_PRICES[plan][currency];

  async function getAccessToken() {
    const { data: { session: sess } } = await supabase.auth.getSession();
    return sess?.access_token || SUPABASE_ANON_KEY_FOR_EDGE;
  }

  async function checkSubscriptionStatus() {
    if (!session?.userId) return;
    setCheckingStatus(true);
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, plan, amount, currency, paid_at, next_billing_date, pesapal_tracking_id")
        .eq("user_id", session.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.status === "active") {
        // Stamp paid_at and compute next_billing_date exactly once (first confirmation)
        const isFirstConfirmation = !data.paid_at;
        let paidAt         = data.paid_at;
        let nextBillingIso = data.next_billing_date;
        if (isFirstConfirmation) {
          paidAt = new Date().toISOString();
          const isAnnual = data.plan === "annual";
          const nextDate = new Date(paidAt);
          nextDate.setMonth(nextDate.getMonth() + (isAnnual ? 12 : 1));
          nextBillingIso = nextDate.toISOString();
          await supabase
            .from("subscriptions")
            .update({ paid_at: paidAt, next_billing_date: nextBillingIso, updated_at: paidAt })
            .eq("user_id", session.userId)
            .eq("status", "active")
            .is("paid_at", null);
          // Send receipt email (fire-and-forget; failure must not block the UI)
          supabase.functions.invoke("send-receipt-email", {
            body: {
              email:                session.email || "",
              plan:                 data.plan,
              amount:               data.amount,
              currency:             data.currency,
              paid_at:              paidAt,
              next_billing_date:    nextBillingIso,
              pesapal_tracking_id:  data.pesapal_tracking_id || "",
            },
          }).catch(() => {});
        }
        setSuccessMsg("Payment confirmed! Welcome to WeGoFit Premium.");
        setTimeout(() => onSubscribed && onSubscribed(), 1500);
      } else if (data?.status === "pending") {
        setPendingMsg("Your payment is still being processed. Please wait a moment and check again.");
      } else {
        setPendingMsg("No active subscription found yet. If you just paid, please wait a minute and try again.");
      }
    } catch (_e) {
      setPendingMsg("Could not check status. Please try again.");
    }
    setCheckingStatus(false);
  }

  async function handleSubscribe() {
    setError(""); setPendingMsg(""); setSuccessMsg("");
    // Pre-auth flow: no session yet, just advance to next step
    if (!session?.userId || !session?.email) {
      onSubscribed && onSubscribed();
      return;
    }
    setLoading(true);
    try {
      const merchantRef = `GOFIT-${session.userId.replace(/-/g, "").slice(0, 12).toUpperCase()}-${Date.now()}`;
      const { error: dbErr } = await supabase.from("subscriptions").upsert({
        user_id: session.userId, email: session.email,
        plan, currency, amount, status: "pending", pesapal_order_id: merchantRef,
      }, { onConflict: 'user_id' });
      if (dbErr) throw new Error("Could not save subscription: " + dbErr.message);
      const token = await getAccessToken();
      const nameParts = (session.name || "WeGoFit User").split(" ");
      const orderData = await submitPesapalOrder({
        merchant_reference: merchantRef, currency, amount,
        description: `WeGoFit ${plan === "annual" ? "Annual" : "Monthly"} Plan`,
        email: session.email, first_name: nameParts[0] || "",
        last_name: nameParts.slice(1).join(" ") || "",
      }, token);
      if (!orderData.redirect_url) throw new Error("No payment URL returned from Pesapal.");
      if (typeof window !== "undefined" && window.open) {
        window.open(orderData.redirect_url, "_blank");
      } else {
        const { Linking } = require("react-native");
        await Linking.openURL(orderData.redirect_url);
      }
      setPendingMsg("Payment page opened. Complete your payment, then tap 'Check Payment Status' below.");
    } catch (e) {
      setError(e.message || "Payment failed. Please try again.");
    }
    setLoading(false);
  }

  async function handleFreeTrial() {
    if (!session?.userId) {
      onSubscribed && onSubscribed("trial");
      return;
    }
    setTrialLoading(true);
    setError("");
    let trialSaved = false;
    try {
      await AsyncStorage.setItem("gf_trial_start_" + session.userId, String(Date.now()));
      await AsyncStorage.setItem("gf_trial_status_" + session.userId, "active");
      trialSaved = true;
    } catch (e) {
      setTrialLoading(false);
      setError("Could not start trial. Please try again.");
      return;
    }
    setTrialLoading(false);
    if (trialSaved) {
      onSubscribed && onSubscribed("trial");
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "Are you sure? This will permanently delete all your WeGoFit data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Delete My Account",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const userId = session?.userId;
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
                await clearTrialKeys(userId);
              }
              try {
                const keys = await AsyncStorage.getAllKeys();
                const toRemove = keys.filter(k => k.startsWith("gofit_") || k.startsWith("gf_"));
                if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
              } catch (_e) {}
              await supabase.auth.signOut();
              logout();
            } catch (_e) {
              Alert.alert("Error", "Could not delete account. Please contact support at support@wegofit.app");
            }
            setDeletingAccount(false);
          },
        },
      ]
    );
  }

  async function handleContactSupport() {
    const url = "mailto:support@wegofit.app?subject=WeGoFit%20Support%20Request";
    try {
      if (typeof window !== "undefined" && window.open) {
        window.open(url, "_blank");
      } else {
        const { Linking } = require("react-native");
        await Linking.openURL(url);
      }
    } catch (_e) {}
  }

  function handleSignOut() {
    Alert.alert("Sign Out", "Sign out of WeGoFit?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      {/* Top bar — always visible */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 20, paddingVertical: 10,
        backgroundColor: "#070B14",
      }}>
        {/* Left slot */}
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: ROSE }}>← Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
        </View>
        {/* Centre logo */}
        <Image source={LOGO_URI} style={{ width: 90, height: 40, resizeMode: "contain" }} />
        {/* Right slot — balanced spacer */}
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={{ alignItems: "center", marginTop: 8, marginBottom: 4 }}>
          <Image source={require('./assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
        </View>
        {/* Hero */}
        <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.5, textAlign: "center" }}>
            Your Transformation Starts Now 👑
          </Text>
          <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", marginTop: 8, textAlign: "center", lineHeight: 22 }}>
            Join a community already seeing real results
          </Text>
        </View>

        {/* Expired trial summary */}
        {expiredTrial && trialStats && (
          <View style={{
            backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 16, padding: 18,
            borderWidth: 1.5, borderColor: "rgba(255,107,53,0.3)", marginBottom: 20,
          }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#FF6B35", marginBottom: 10 }}>
              Your free trial has ended.{"\n"}Subscribe to keep your progress!
            </Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>During your trial you:</Text>
            {trialStats.meals > 0    && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>✅ Logged {trialStats.meals} meals</Text>}
            {trialStats.workouts > 0 && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>✅ Completed {trialStats.workouts} workouts</Text>}
            {trialStats.sleepDays > 0 && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>✅ Tracked {trialStats.sleepDays} days of sleep</Text>}
          </View>
        )}

        {/* Features */}
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center", marginBottom: 14, lineHeight: 18 }}>
          Trusted by busy professionals, parents, and fitness beginners looking to build healthier habits and achieve lasting results.
        </Text>
        {[
          "Personalized fitness coaching",
          "Smart nutrition guidance",
          "Daily accountability from Coach TinaBarks",
          "Belly fat & weight loss programs",
          "Personalized local & global meal plans",
        ].map((f, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: ROSE, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
              <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "800" }}>✓</Text>
            </View>
            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: "500" }}>{f}</Text>
          </View>
        ))}

        {/* Social proof 2x2 grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 24, marginBottom: 8 }}>
          {[
            { emoji: "🔥", text: "For busy professionals" },
            { emoji: "🥗", text: "Foods you actually eat" },
            { emoji: "💪", text: "Daily accountability" },
            { emoji: "🏆", text: "Habits not just weight" },
          ].map(({ emoji, text }) => (
            <View key={text} style={{
              width: "47%", flexDirection: "row", alignItems: "center",
              backgroundColor: "#111827", borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>{emoji}</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "600", flex: 1 }}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Currency selector */}
        <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.45)", marginTop: 24, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
          Currency
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {["USD", "UGX"].map(cur => (
            <TouchableOpacity
              key={cur}
              onPress={() => setCurrency(cur)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: currency === cur ? ROSE : "#111827",
                borderWidth: 1.5,
                borderColor: currency === cur ? ROSE : "rgba(255,255,255,0.12)",
              }}>
              <Text style={{ fontWeight: "700", fontSize: 14, color: currency === cur ? "#FFF" : "rgba(255,255,255,0.75)" }}>{cur}</Text>
              <Text style={{ fontSize: 10, color: currency === cur ? "#FFD6E8" : "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {cur === "USD" ? "International" : cur === "UGX" ? "Uganda" : "Kenya"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Plan selector */}
        <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.45)", marginTop: 20, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
          Choose Plan
        </Text>

        {/* Monthly card */}
        <TouchableOpacity
          onPress={() => setPlan("monthly")}
          style={{
            borderRadius: 16, padding: 16, marginBottom: 12,
            backgroundColor: plan === "monthly" ? "rgba(255,107,53,0.12)" : "#111827",
            borderWidth: 2, borderColor: plan === "monthly" ? ROSE : "rgba(255,255,255,0.1)",
          }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontWeight: "700", fontSize: 16, color: "#FFFFFF" }}>Monthly</Text>
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>Cancel anytime · Start transforming today</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: "800", fontSize: 20, color: plan === "monthly" ? ROSE : "#FFFFFF" }}>
                UGX 74,000
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>/ month · ($20)</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Annual card */}
        <TouchableOpacity
          onPress={() => setPlan("annual")}
          style={{
            borderRadius: 16, padding: 16, marginBottom: 4,
            backgroundColor: plan === "annual" ? "rgba(255,107,53,0.12)" : "#111827",
            borderWidth: 2, borderColor: plan === "annual" ? ROSE : "rgba(255,255,255,0.1)",
          }}>
          {/* BEST VALUE badge */}
          <View style={{ position: "absolute", top: -1, right: 12 }}>
            <View style={{ backgroundColor: "#10B981", borderRadius: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>BEST VALUE</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: "#FFFFFF" }}>Annual</Text>
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>Best results · Save $48 · Coach TinaBarks' top pick 👑</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: "800", fontSize: 20, color: plan === "annual" ? ROSE : "#FFFFFF" }}>
                UGX 710,000
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>/ year · ($192)</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Error / status messages */}
        {!!error && (
          <View style={{ backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }}>
            <Text style={{ color: "#F87171", fontSize: 14, fontWeight: "600" }}>{error}</Text>
          </View>
        )}
        {!!successMsg && (
          <View style={{ backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" }}>
            <Text style={{ color: "#34D399", fontSize: 14, fontWeight: "700" }}>{successMsg}</Text>
          </View>
        )}
        {!!pendingMsg && !successMsg && (
          <View style={{ backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)" }}>
            <Text style={{ color: "#FCD34D", fontSize: 14, fontWeight: "600" }}>{pendingMsg}</Text>
          </View>
        )}

        {/* Primary subscribe button */}
        <TouchableOpacity
          onPress={handleSubscribe}
          disabled={loading}
          style={{
            marginTop: 24, borderRadius: 14, padding: 18,
            backgroundColor: loading ? "#FECDD3" : ROSE,
            alignItems: "center",
            shadowColor: ROSE, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
            elevation: 5,
          }}>
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 17 }}>
                Subscribe Now — {plan === "annual" ? "UGX 710,000" : "UGX 74,000"}
              </Text>
          }
        </TouchableOpacity>

        {/* Check status button */}
        {!!pendingMsg && !successMsg && (
          <TouchableOpacity
            onPress={checkSubscriptionStatus}
            disabled={checkingStatus}
            style={{
              marginTop: 12, borderRadius: 14, padding: 16,
              backgroundColor: "#111827", alignItems: "center",
              borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)",
            }}>
            {checkingStatus
              ? <ActivityIndicator color={ROSE} />
              : <Text style={{ color: "rgba(255,255,255,0.75)", fontWeight: "700", fontSize: 15 }}>Check Payment Status</Text>
            }
          </TouchableOpacity>
        )}

        {/* Free trial CTA — three states */}
        {isOnTrial ? (
          // Already on trial → offer to go back to app
          <TouchableOpacity
            onPress={onBack}
            style={{ marginTop: 16, alignItems: "center", paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, color: ROSE, fontWeight: "700" }}>← Continue your free trial</Text>
          </TouchableOpacity>
        ) : !expiredTrial ? (
          // Never started trial → offer to start it
          <TouchableOpacity
            onPress={handleFreeTrial}
            disabled={trialLoading}
            style={{ marginTop: 16, alignItems: "center", paddingVertical: 12 }}>
            {trialLoading
              ? <ActivityIndicator color={ROSE} size="small" />
              : <Text style={{ fontSize: 14, color: "#888", fontWeight: "600" }}>
                  Not ready? → <Text style={{ color: ROSE, fontWeight: "700" }}>Start 7-Day Free Trial</Text>
                </Text>
            }
          </TouchableOpacity>
        ) : null /* expired trial → hide completely */}

        <Text style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 8, marginBottom: 28, lineHeight: 18 }}>
          Secure payment. Cancel anytime.
        </Text>

        {/* Bottom links */}
        <View style={{
          borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
          paddingTop: 20, gap: 14, alignItems: "center",
        }}>
          <TouchableOpacity onPress={handleContactSupport} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: "500" }}>Contact Support</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
            {deletingAccount
              ? <ActivityIndicator color="#DC2626" size="small" />
              : <Text style={{ fontSize: 13, color: "#F87171", fontWeight: "500" }}>Delete My Account</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert("Privacy Policy", "Available at support@wegofit.app or inside the app after subscribing.")}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontWeight: "400" }}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── SUBSCRIPTION GATE ────────────────────────────────────────────────────────
// subStatus values: "loading" | "active" | "trial" | "expired_trial" | "none"
function useSubscriptionStatus(userId, email) {
  const [subStatus,   setSubStatus]   = useState("loading");
  const [trialDays,   setTrialDays]   = useState(0);   // days elapsed in trial
  const [trialStats,  setTrialStats]  = useState(null); // { meals, workouts, sleepDays }

  const check = useCallback(async (override) => {
    if (!userId) { setSubStatus("none"); return; }

    // 1. VIP — always full access
    if (isVIPAccount(email)) { setSubStatus("active"); return; }

    // 2. Active Supabase subscription
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (data) { setSubStatus("active"); return; }
    } catch (_e) {}

    // 3. Trial check
    const elapsed = await getTrialDaysElapsed(userId);
    if (elapsed !== null) {
      setTrialDays(elapsed);
      // Day-5 reminder (show once per day using a flag)
      if (elapsed === 5) {
        const remKey = `gf_trial_rem5_${userId}`;
        const shown  = await AsyncStorage.getItem(remKey).catch(() => null);
        if (!shown) {
          await AsyncStorage.setItem(remKey, "1").catch(() => {});
          Alert.alert("WeGoFit Trial", "Your WeGoFit trial ends in 2 days! 🔥 Keep your progress going");
        }
      }
      // Day-7 reminder
      if (elapsed === 7) {
        const remKey = `gf_trial_rem7_${userId}`;
        const shown  = await AsyncStorage.getItem(remKey).catch(() => null);
        if (!shown) {
          await AsyncStorage.setItem(remKey, "1").catch(() => {});
          Alert.alert("WeGoFit Trial", "Your WeGoFit trial ends today! Subscribe now to keep your data");
        }
      }
      if (elapsed < 7) {
        await AsyncStorage.setItem(trialStatusKey(userId), "active").catch(() => {});
        setSubStatus(override === "trial" ? "trial" : "trial");
        return;
      }
      // Trial expired
      await AsyncStorage.setItem(trialStatusKey(userId), "expired").catch(() => {});
      // Gather activity summary
      try {
        const keys = await AsyncStorage.getAllKeys();
        const logKeys = keys.filter(k => k.startsWith("gf_log_"));
        let meals = 0;
        for (const k of logKeys) {
          const raw = await AsyncStorage.getItem(k);
          if (raw) {
            try {
              const log = JSON.parse(raw);
              const entries = [
                ...(log.breakfast || []), ...(log.lunch || []),
                ...(log.dinner || []),  ...(log.snacks || []),
              ];
              meals += entries.length;
            } catch (_e) {}
          }
        }
        const wRaw = await AsyncStorage.getItem(`gf_workouts_${userId}`).catch(() => null);
        const workouts = wRaw ? (JSON.parse(wRaw) || []).length : 0;
        const sRaw = await AsyncStorage.getItem(`gf_sleep_${userId}`).catch(() => null);
        const sleepDays = sRaw ? (JSON.parse(sRaw) || []).length : 0;
        setTrialStats({ meals, workouts, sleepDays });
      } catch (_e) { setTrialStats({ meals: 0, workouts: 0, sleepDays: 0 }); }
      setSubStatus("expired_trial");
      return;
    }

    // 4. No trial, no sub
    setSubStatus("none");
  }, [userId, email]);

  useEffect(() => {
    let cancelled = false;
    check().then(() => {}).catch(() => {});
    return () => { cancelled = true; };
  }, [check]);

  const activate = useCallback((mode) => {
    if (mode === "trial") {
      setTrialDays(0);
      setSubStatus("trial");
    } else {
      setSubStatus("active");
    }
  }, []);

  return { subStatus, trialDays, trialStats, activate, recheck: check };
}

// ─── PRE-AUTH ONBOARDING SCREENS ─────────────────────────────────────────────
// These render before the user creates an account:
// CoachWelcomeScreen → OnboardingScreen (goal) → BiggestChallengeScreen → TellUsAboutYouScreen → AuthScreen → SubscriptionScreen

function PreAuthCoachWelcomeScreen({ onNext }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => {
    async function preload() {
      await Asset.loadAsync(require('./assets/coach-welcome.png'));
      setImageLoaded(true);
    }
    preload();
  }, []);

  if (!imageLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14", alignItems: "center", justifyContent: "center" }}>
        <Image source={require('./assets/Enhanced_Logo.PNG')} style={{ width: 180, height: 72, resizeMode: "contain", opacity: 0.6 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <Image
        source={require('./assets/coach-welcome.png')}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", resizeMode: "cover", opacity: 1 }}
        fadeDuration={0}
      />
      <LinearGradient
        colors={["rgba(7,11,20,0.0)", "rgba(7,11,20,0.0)", "rgba(7,11,20,0.55)", "rgba(7,11,20,0.92)", "rgba(7,11,20,1.0)"]}
        locations={[0, 0.2, 0.45, 0.72, 1.0]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 28, paddingBottom: 52 }}>
        <View style={{
          flexDirection: "row", alignItems: "center", marginBottom: 20,
          backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 30,
          paddingHorizontal: 14, paddingVertical: 8, alignSelf: "flex-start",
          borderWidth: 1, borderColor: "rgba(255,107,53,0.35)",
        }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#FF6B35", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
            <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "800" }}>TB</Text>
          </View>
          <Text style={{ color: "#FF6B35", fontSize: 13, fontWeight: "700" }}>Coach TinaBarks · WeGoFit</Text>
        </View>
        <Text style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "800", lineHeight: 38, marginBottom: 16, letterSpacing: -0.5 }}>
          {`Hi there 👋`}
        </Text>
        <Text style={{ color: "#FF6B35", fontWeight: "800", fontSize: 15, marginBottom: 12 }}>
          Transform Your Habits. Transform Your Body.
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.80)", fontSize: 15, lineHeight: 26, marginBottom: 32 }}>
          {"Welcome to WeGoFit. I'm Coach TinaBarks. Whether your goal is weight loss, belly fat reduction, muscle gain, or building healthier habits — I'll guide you every step of the way. Let's build consistency together."}
        </Text>
        <TouchableOpacity
          onPress={onNext}
          style={{
            backgroundColor: "#FF6B35", borderRadius: 16, height: 58,
            alignItems: "center", justifyContent: "center",
            shadowColor: "#FF6B35", shadowOpacity: 0.5, shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 }, elevation: 8, marginBottom: 16,
          }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 17, letterSpacing: 0.3 }}>✅ Let's Begin</Text>
        </TouchableOpacity>
        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center" }}>
          7-Day Free Trial • No Credit Card Required
        </Text>
      </View>
    </View>
  );
}

function PreAuthGoalScreen({ onNext, onBack, initialGoal }) {
  const [goal, setGoal] = useState(initialGoal || "lose");
  const GOALS = [
    { id: "lose",     emoji: "🔥", label: "Lose Weight",    desc: "Burn fat, feel lighter" },
    { id: "gain",     emoji: "💪", label: "Build Muscle",    desc: "Get stronger & bigger" },
    { id: "maintain", emoji: "⚖️", label: "Maintain Weight", desc: "Stay at your best" },
    { id: "fitness",  emoji: "🏃", label: "Improve Fitness", desc: "Endurance & health" },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <Image
        source={require('./assets/coach-welcome.png')}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", resizeMode: "cover", opacity: 0.09 }}
        fadeDuration={0}
      />
      <LinearGradient
        colors={["rgba(7,11,20,0.75)", "rgba(7,11,20,0.88)", "rgba(7,11,20,0.95)", "rgba(7,11,20,1.0)"]}
        locations={[0, 0.3, 0.65, 1.0]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <SafeAreaView style={{ flex: 1, paddingTop: 0 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", marginTop: 0, marginBottom: 16 }}>
            <Image source={require('./assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
          </View>
          <Row style={{ gap: 6, marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i === 0 ? C.green : C.cardLight }} />
            ))}
          </Row>
          <Text style={[S.heading, { textAlign: "center", marginBottom: 6 }]}>What's your goal?</Text>
          <Text style={{ color: C.grey, textAlign: "center", marginBottom: 20, fontSize: 14 }}>We'll customize your plan</Text>
          {GOALS.map(g => (
            <TouchableOpacity key={g.id} onPress={() => setGoal(g.id)} activeOpacity={0.8}
              style={[S.card, { flexDirection: "row", alignItems: "center", marginBottom: 10, borderWidth: 2, borderColor: goal === g.id ? C.green : "transparent" }]}>
              <Text style={{ fontSize: 30, marginRight: 14 }}>{g.emoji}</Text>
              <View>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>{g.label}</Text>
                <Text style={{ color: C.grey, fontSize: 12, marginTop: 2 }}>{g.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <Spacer h={16} />
          <PrimaryBtn label="Next →" onPress={() => onNext(goal)} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PreAuthBiggestChallengeScreen({ onNext, onBack, initialChallenge }) {
  const CHALLENGES = [
    { id: "belly",       emoji: "🔥", label: "Belly Fat Reduction",   desc: "I want to slim my waist and reduce stubborn belly fat" },
    { id: "consistency", emoji: "📅", label: "Staying Consistent",    desc: "I start strong but struggle to stay on track" },
    { id: "diet",        emoji: "🍕", label: "Controlling My Eating", desc: "Cravings, overeating, or unhealthy food choices" },
    { id: "motivation",  emoji: "😴", label: "Lack of Motivation",    desc: "Hard to get started and keep going" },
    { id: "time",        emoji: "⏰", label: "Busy Schedule",         desc: "I don't have enough time for fitness" },
    { id: "knowledge",   emoji: "🧭", label: "Need a Clear Plan",     desc: "I'm not sure what works for me" },
  ];
  const initChallengeId = (() => {
    if (!initialChallenge) return null;
    if (initialChallenge.id) return initialChallenge.id;
    if (initialChallenge.title) {
      const match = CHALLENGES.find(c => c.label === initialChallenge.title);
      return match ? match.id : null;
    }
    return null;
  })();
  const [challenge, setChallenge] = useState(initChallengeId);
  const [error, setError] = useState(false);
  function handleNext() {
    if (!challenge) { setError(true); return; }
    const selected = CHALLENGES.find(c => c.id === challenge);
    onNext({ title: selected.label, subtitle: selected.desc });
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <Image
        source={require('./assets/coach-welcome.png')}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", resizeMode: "cover", opacity: 0.09 }}
        fadeDuration={0}
      />
      <LinearGradient
        colors={["rgba(7,11,20,0.75)", "rgba(7,11,20,0.88)", "rgba(7,11,20,0.95)", "rgba(7,11,20,1.0)"]}
        locations={[0, 0.3, 0.65, 1.0]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <SafeAreaView style={{ flex: 1, paddingTop: 0 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", marginTop: 0, marginBottom: 16 }}>
            <Image source={require('./assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
          </View>
          <Row style={{ gap: 6, marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 1 ? C.green : C.cardLight }} />
            ))}
          </Row>
          <Text style={[S.heading, { textAlign: "center", marginBottom: 6 }]}>What's your biggest challenge?</Text>
          <Text style={{ color: C.grey, textAlign: "center", marginBottom: 20, fontSize: 14 }}>We'll tailor your coaching around this</Text>
          {CHALLENGES.map(ch => (
            <TouchableOpacity key={ch.id} onPress={() => { setChallenge(ch.id); setError(false); }} activeOpacity={0.8}
              style={[S.card, { flexDirection: "row", alignItems: "center", marginBottom: 10, borderWidth: 2, borderColor: challenge === ch.id ? C.green : "transparent" }]}>
              <Text style={{ fontSize: 28, marginRight: 14 }}>{ch.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>{ch.label}</Text>
                <Text style={{ color: C.grey, fontSize: 12, marginTop: 2 }}>{ch.desc}</Text>
              </View>
              {challenge === ch.id && <Text style={{ color: C.green, fontSize: 18 }}>✓</Text>}
            </TouchableOpacity>
          ))}
          {error && (
            <Text style={{ color: "#FF6B6B", fontSize: 13, textAlign: "center", marginBottom: 8, marginTop: -4 }}>
              Please select your biggest challenge to continue
            </Text>
          )}
          <Spacer h={16} />
          <PrimaryBtn label="Next →" onPress={handleNext} />
          <TouchableOpacity onPress={onBack} style={{ marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: C.grey, fontSize: 13 }}>← Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PreAuthPersonalisedPlanScreen({ onNext, onBack, pendingGoal, pendingAbout, pendingChallenge }) {
  // Mifflin-St Jeor calorie calculation using collected profile data
  const age         = parseFloat(pendingAbout?.age)        || 0;
  const height_cm   = parseFloat(pendingAbout?.height_cm)  || 0;
  const weight_kg   = parseFloat(pendingAbout?.weight_kg)  || 0;
  const goal_weight = parseFloat(pendingAbout?.goal_weight_kg) || weight_kg;
  const gender      = pendingAbout?.gender      || "male";
  const activity    = pendingAbout?.activity_level || "light";

  const bmr          = calcBMR(gender, weight_kg, height_cm, age);
  const dailyCalories = calcTDEE(bmr, activity);

  const GOAL_LABELS = {
    lose:     "Lose Weight",
    gain:     "Build Muscle",
    maintain: "Maintain Weight",
    fitness:  "Improve Fitness",
  };
  const goalLabel = GOAL_LABELS[pendingGoal] || pendingGoal || "Improve Fitness";

  const challenge = pendingChallenge?.title || "";
  function getCoachFocus() {
    if (challenge === "Belly Fat Reduction")
      return "Coach TinaBarks will focus on calorie awareness, targeted workouts, and sustainable habits to help reduce belly fat and support long-term weight loss.";
    if (challenge === "Staying Consistent")
      return "Coach TinaBarks will focus on building daily habits, accountability check-ins, and small wins that keep you on track week after week.";
    if (challenge === "Controlling My Eating")
      return "Coach TinaBarks will focus on nutrition awareness, managing cravings, and building a healthy relationship with food that lasts.";
    if (challenge === "Lack of Motivation")
      return "Coach TinaBarks will focus on momentum-building, celebrating progress, and daily encouragement to keep you moving forward.";
    if (challenge === "Busy Schedule")
      return "Coach TinaBarks will focus on time-efficient workouts, simple meal strategies, and a realistic plan that fits your lifestyle.";
    if (challenge === "Need a Clear Plan")
      return "Coach TinaBarks will build you a clear, step-by-step programme — no guessing, no confusion, just a plan that works for your body and goals.";
    return "Coach TinaBarks will guide you with a personalised fitness and nutrition plan built specifically around your goals and lifestyle.";
  }

  const BENEFITS = [
    "Personalised fitness coaching",
    "Smart nutrition guidance",
    "Daily accountability from Coach TinaBarks",
    "Belly fat & weight loss programs",
    "Meal plans featuring local and international foods",
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <Image
        source={require('./assets/coach-welcome.png')}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", resizeMode: "cover", opacity: 0.09 }}
        fadeDuration={0}
      />
      <LinearGradient
        colors={["rgba(7,11,20,0.75)", "rgba(7,11,20,0.88)", "rgba(7,11,20,0.95)", "rgba(7,11,20,1.0)"]}
        locations={[0, 0.3, 0.65, 1.0]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <SafeAreaView style={{ flex: 1, paddingTop: 0 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={{ alignItems: "center", marginTop: 0, marginBottom: 16 }}>
            <Image source={require('./assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
          </View>
          {/* Progress bar — step 4 of 4 pre-auth steps, all filled */}
          <Row style={{ gap: 6, marginBottom: 20 }}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: C.green }} />
            ))}
          </Row>

          {/* Section 1 — Heading */}
          <Text style={[S.heading, { textAlign: "center", marginBottom: 6, fontSize: 24 }]}>Your Plan Is Ready 🎯</Text>
          <Text style={{ color: C.grey, textAlign: "center", marginBottom: 22, fontSize: 14, lineHeight: 20 }}>
            Based on your goal, here is what Coach TinaBarks has prepared for you
          </Text>

          {/* Section 2 — Personalised summary card */}
          <View style={{
            backgroundColor: C.card,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: ROSE,
            padding: 18,
            marginBottom: 14,
          }}>
            <Text style={{ color: ROSE, fontWeight: "800", fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 12 }}>
              Your Personalised Summary
            </Text>
            {[
              { label: "Daily Calorie Target", value: dailyCalories > 0 ? `${dailyCalories.toLocaleString()} kcal` : "—" },
              { label: "Target Weight",        value: goal_weight > 0   ? `${goal_weight} kg`                        : "—" },
              { label: "Goal",                 value: goalLabel },
            ].map(({ label, value }) => (
              <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ color: C.grey, fontSize: 13 }}>{label}</Text>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 14 }}>{value}</Text>
              </View>
            ))}
          </View>

          {/* Section 3 — Coach focus message */}
          <View style={{ backgroundColor: C.cardLight, borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <Text style={{ color: ROSE, fontWeight: "700", fontSize: 12, letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 8 }}>
              Your Coach Focus
            </Text>
            <Text style={{ color: C.text, fontSize: 14, lineHeight: 22 }}>{getCoachFocus()}</Text>
          </View>

          {/* Section 4 — Benefits list */}
          <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 24 }}>
            <Text style={{ color: ROSE, fontWeight: "700", fontSize: 12, letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 12 }}>
              What You Get
            </Text>
            {BENEFITS.map(b => (
              <View key={b} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10 }}>
                <Text style={{ color: "#10B981", fontSize: 16, marginRight: 10, lineHeight: 22 }}>✅</Text>
                <Text style={{ color: C.text, fontSize: 14, lineHeight: 22, flex: 1 }}>{b}</Text>
              </View>
            ))}
          </View>

          {/* Section 5 — CTA */}
          <PrimaryBtn label="Create My Account →" onPress={onNext} />
          <TouchableOpacity onPress={onBack} style={{ marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: C.grey, fontSize: 13 }}>← Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── ACCOUNT CREATION SCREEN ──────────────────────────────────────────────────
function AccountCreationScreen({ onNext, onBack, pendingGoal, pendingAbout, pendingChallenge }) {
  const { signUp } = useContext(AuthCtx);

  const SU_INPUT = {
    height: 50, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    paddingLeft: 46, paddingRight: 14, color: "#FFFFFF", fontSize: 14,
  };
  const SU_LABEL = {
    color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700",
    letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 6, marginTop: 12,
  };

  const [suName,       setSuName]       = useState("");
  const [suEmail,      setSuEmail]      = useState("");
  const [suPassword,   setSuPassword]   = useState("");
  const [suConfirm,    setSuConfirm]    = useState("");
  const [suShowPw,     setSuShowPw]     = useState(false);
  const [suShowConf,   setSuShowConf]   = useState(false);
  const [secQ,         setSecQ]         = useState("");
  const [secA,         setSecA]         = useState("");
  const [showSecQ,     setShowSecQ]     = useState(false);
  const [agreed,       setAgreed]       = useState(false);
  const [suError,      setSuError]      = useState("");
  const [suBusy,       setSuBusy]       = useState(false);
  const [focused,      setFocused]      = useState(null);

  const emailRef   = useRef(null);
  const pwRef      = useRef(null);
  const confRef    = useRef(null);
  const secARef    = useRef(null);

  async function handleCreate() {
    Keyboard.dismiss();
    if (!suName.trim())           { setSuError("Please enter your full name."); return; }
    if (!suEmail.trim())          { setSuError("Please enter your email."); return; }
    if (!suPassword)              { setSuError("Please enter a password."); return; }
    if (suPassword !== suConfirm) { setSuError("Passwords do not match."); return; }
    if (suPassword.length < 6)   { setSuError("Password must be at least 6 characters."); return; }
    if (!secQ)                   { setSuError("Please select a security question."); return; }
    if (!secA.trim())            { setSuError("Please answer your security question."); return; }
    if (!agreed)                 { setSuError("Please agree to the Terms of Service."); return; }
    setSuBusy(true); setSuError("");
    try {
      const pending = {
        ...(pendingAbout || {}),
        goal: pendingGoal,
        biggest_challenge: pendingChallenge?.title || "",
        biggest_challenge_subtitle: pendingChallenge?.subtitle || "",
      };
      await AsyncStorage.setItem("gofit_pending_onboarding", JSON.stringify(pending));
    } catch (_e) {}
    const result = await signUp({ name: suName.trim(), email: suEmail, password: suPassword, securityQuestion: secQ, securityAnswer: secA });
    setSuBusy(false);
    if (!result.ok) { setSuError(result.error); return; }
    try {
      await AsyncStorage.setItem("onboardingComplete", "true");
      await AsyncStorage.setItem("userLoggedIn", "true");
      await AsyncStorage.setItem("userId", result.clientId || "");
    } catch (_e) {}
    onNext();
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A14" }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
        >
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={{ alignItems: "center", marginBottom: 28 }}>
              <Image source={require('./assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
            </View>

            {/* Title */}
            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 6, letterSpacing: -0.3 }}>
              Almost there! Create your account 🎉
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
              Your personalised plan is ready.{"\n"}Let's set up your account.
            </Text>

            {/* Error banner */}
            {suError ? (
              <View style={{ backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 10, padding: 10,
                marginBottom: 14, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }}>
                <Text style={{ color: "#FCA5A5", fontSize: 12, lineHeight: 18 }}>{suError}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <Text style={SU_LABEL}>Full Name</Text>
            <View style={{ position: "relative", marginBottom: 4 }}>
              <View style={{ position: "absolute", left: 14, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7"/>
                  <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7" strokeLinecap="round"/>
                </Svg>
              </View>
              <TextInput style={[SU_INPUT, focused === "name" && { borderColor: ROSE }]}
                placeholder="Your full name" placeholderTextColor="rgba(255,255,255,0.35)"
                value={suName} onChangeText={v => { setSuName(v); setSuError(""); }}
                autoCapitalize="words" returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()} blurOnSubmit={false}
                onFocus={() => setFocused("name")} onBlur={() => setFocused(null)} />
            </View>

            {/* Email */}
            <Text style={SU_LABEL}>Email</Text>
            <View style={{ position: "relative", marginBottom: 4 }}>
              <View style={{ position: "absolute", left: 14, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <Rect x="2" y="4" width="20" height="16" rx="3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7"/>
                  <Path d="M2 8l10 7 10-7" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7" strokeLinecap="round"/>
                </Svg>
              </View>
              <TextInput ref={emailRef} style={[SU_INPUT, focused === "email" && { borderColor: ROSE }]}
                placeholder="your@email.com" placeholderTextColor="rgba(255,255,255,0.35)"
                value={suEmail} onChangeText={v => { setSuEmail(v); setSuError(""); }}
                keyboardType="email-address" autoCapitalize="none" returnKeyType="next"
                onSubmitEditing={() => pwRef.current?.focus()} blurOnSubmit={false}
                onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} />
            </View>

            {/* Password */}
            <Text style={SU_LABEL}>Password</Text>
            <View style={{ position: "relative", marginBottom: 4 }}>
              <View style={{ position: "absolute", left: 14, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <Rect x="5" y="11" width="14" height="10" rx="2.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7"/>
                  <Path d="M8 11V7a4 4 0 018 0v4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7" strokeLinecap="round"/>
                </Svg>
              </View>
              <TextInput ref={pwRef} style={[SU_INPUT, { paddingRight: 48 }, focused === "pw" && { borderColor: ROSE }]}
                placeholder="Min 6 characters" placeholderTextColor="rgba(255,255,255,0.35)"
                value={suPassword} onChangeText={v => { setSuPassword(v); setSuError(""); }}
                secureTextEntry={!suShowPw} autoCapitalize="none" autoCorrect={false} returnKeyType="next"
                onSubmitEditing={() => confRef.current?.focus()} blurOnSubmit={false}
                onFocus={() => setFocused("pw")} onBlur={() => setFocused(null)} />
              <TouchableOpacity onPress={() => setSuShowPw(v => !v)}
                style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 46, alignItems: "center", justifyContent: "center" }}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  {suShowPw
                    ? <><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke={ROSE} strokeWidth="1.7"/><Circle cx="12" cy="12" r="3" stroke={ROSE} strokeWidth="1.7"/></>
                    : <><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke={ROSE} strokeWidth="1.7"/><Circle cx="12" cy="12" r="3" stroke={ROSE} strokeWidth="1.7"/><Path d="M3 3l18 18" stroke={ROSE} strokeWidth="1.7" strokeLinecap="round"/></>
                  }
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <Text style={SU_LABEL}>Confirm Password</Text>
            <View style={{ position: "relative", marginBottom: 4 }}>
              <View style={{ position: "absolute", left: 14, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <Rect x="5" y="11" width="14" height="10" rx="2.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7"/>
                  <Path d="M8 11V7a4 4 0 018 0v4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7" strokeLinecap="round"/>
                </Svg>
              </View>
              <TextInput ref={confRef} style={[SU_INPUT, { paddingRight: 48 }, focused === "conf" && { borderColor: ROSE }]}
                placeholder="Repeat password" placeholderTextColor="rgba(255,255,255,0.35)"
                value={suConfirm} onChangeText={v => { setSuConfirm(v); setSuError(""); }}
                secureTextEntry={!suShowConf} autoCapitalize="none" autoCorrect={false} returnKeyType="next"
                onSubmitEditing={() => { Keyboard.dismiss(); setShowSecQ(true); }} blurOnSubmit={false}
                onFocus={() => setFocused("conf")} onBlur={() => setFocused(null)} />
              <TouchableOpacity onPress={() => setSuShowConf(v => !v)}
                style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 46, alignItems: "center", justifyContent: "center" }}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  {suShowConf
                    ? <><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke={ROSE} strokeWidth="1.7"/><Circle cx="12" cy="12" r="3" stroke={ROSE} strokeWidth="1.7"/></>
                    : <><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke={ROSE} strokeWidth="1.7"/><Circle cx="12" cy="12" r="3" stroke={ROSE} strokeWidth="1.7"/><Path d="M3 3l18 18" stroke={ROSE} strokeWidth="1.7" strokeLinecap="round"/></>
                  }
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Security Question */}
            <Text style={SU_LABEL}>Security Question</Text>
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowSecQ(true); }}
              style={{ height: 50, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14,
                borderWidth: 1, borderColor: secQ ? ROSE : "rgba(255,255,255,0.15)",
                paddingHorizontal: 14, justifyContent: "center", flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ color: secQ ? "#FFFFFF" : "rgba(255,255,255,0.35)", fontSize: 13, flex: 1 }} numberOfLines={1}>
                {secQ || "Select a security question…"}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>▾</Text>
            </TouchableOpacity>

            <Text style={SU_LABEL}>Security Answer</Text>
            <View style={{ position: "relative", marginBottom: 4 }}>
              <View style={{ position: "absolute", left: 14, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <Path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7"/>
                  <Path d="M12 8v4l3 3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7" strokeLinecap="round"/>
                </Svg>
              </View>
              <TextInput ref={secARef} style={[SU_INPUT, focused === "seca" && { borderColor: ROSE }]}
                placeholder="Your answer" placeholderTextColor="rgba(255,255,255,0.35)"
                value={secA} onChangeText={v => { setSecA(v); setSuError(""); }}
                autoCapitalize="none" autoCorrect={false} returnKeyType="done"
                onSubmitEditing={handleCreate}
                onFocus={() => setFocused("seca")} onBlur={() => setFocused(null)} />
            </View>

            {/* Terms checkbox */}
            <TouchableOpacity onPress={() => setAgreed(v => !v)}
              style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 20, marginBottom: 24, gap: 12 }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
                borderColor: agreed ? ROSE : "rgba(255,255,255,0.3)",
                backgroundColor: agreed ? ROSE : "transparent",
                alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                {agreed && <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "800" }}>✓</Text>}
              </View>
              <Text style={{ flex: 1, color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 20 }}>
                I agree to WeGoFit's{" "}
                <Text style={{ color: ROSE, fontWeight: "700" }}>Terms of Service</Text>
                {" "}and{" "}
                <Text style={{ color: ROSE, fontWeight: "700" }}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Create Account button */}
            <TouchableOpacity onPress={handleCreate} disabled={suBusy}
              style={{ height: 56, backgroundColor: ROSE, borderRadius: 14, alignItems: "center",
                justifyContent: "center", opacity: suBusy ? 0.75 : 1,
                shadowColor: ROSE, shadowRadius: 18, shadowOpacity: 0.45,
                shadowOffset: { width: 0, height: 6 }, elevation: 8, marginBottom: 14 }}>
              {suBusy
                ? <ActivityIndicator color="#FFF" />
                : <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.4 }}>Create My Account →</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={onBack} style={{ alignItems: "center", paddingVertical: 8 }}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: "600" }}>‹ Back</Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Security question picker */}
      <Modal visible={showSecQ} animationType="slide" transparent presentationStyle="overFullScreen">
        <TouchableWithoutFeedback onPress={() => setShowSecQ(false)} accessible={false}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
            <TouchableWithoutFeedback accessible={false}>
              <View style={{ backgroundColor: "#14142A", borderTopLeftRadius: 26, borderTopRightRadius: 26,
                paddingHorizontal: 24, paddingBottom: 48, paddingTop: 18,
                borderTopWidth: 1, borderColor: "rgba(255,107,53,0.25)" }}>
                <View style={{ width: 36, height: 4, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 2,
                  alignSelf: "center", marginBottom: 20 }} />
                <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "800", marginBottom: 16 }}>
                  Select Security Question
                </Text>
                {SECURITY_QUESTIONS.map(q => (
                  <TouchableOpacity key={q} onPress={() => { setSecQ(q); setShowSecQ(false); }}
                    style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
                      flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ flex: 1, color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 20 }}>{q}</Text>
                    {secQ === q && <Text style={{ color: ROSE, fontSize: 18, fontWeight: "700" }}>✓</Text>}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setShowSecQ(false)}
                  style={{ alignItems: "center", marginTop: 16, padding: 10 }}>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}


function PreAuthAboutYouScreen({ onNext, onBack, initialData }) {
  // ── value arrays (defined before useState so we can compute initial indices) ──
  const AGE_VALUES  = Array.from({ length: 65 }, (_, i) => i + 16);   // 16–80
  const FEET_VALUES = Array.from({ length: 4  }, (_, i) => i + 4);    // 4–7
  const INCH_VALUES = Array.from({ length: 12 }, (_, i) => i);        // 0–11
  const KG_VALUES   = Array.from({ length: 161 }, (_, i) => i + 40);  // 40–200
  const LBS_VALUES  = Array.from({ length: 353 }, (_, i) => i + 88);  // 88–440

  // ── derive initial indices from saved data if available ──────────────────────
  const initAgeIdx = (() => {
    if (!initialData?.age) return 9;
    const idx = AGE_VALUES.indexOf(parseInt(initialData.age));
    return idx >= 0 ? idx : 9;
  })();
  const initFtIdx = (() => {
    if (!initialData?.height_cm) return 1;
    const totalIn = initialData.height_cm / 2.54;
    const ft = Math.floor(totalIn / 12);
    const idx = FEET_VALUES.indexOf(ft);
    return idx >= 0 ? idx : 1;
  })();
  const initInIdx = (() => {
    if (!initialData?.height_cm) return 7;
    const totalIn = Math.round(initialData.height_cm / 2.54);
    const ins = totalIn % 12;
    const idx = INCH_VALUES.indexOf(ins);
    return idx >= 0 ? idx : 7;
  })();
  const initCwIdx = (() => {
    if (!initialData?.weight_kg) return 30;
    const idx = KG_VALUES.indexOf(Math.round(initialData.weight_kg));
    return idx >= 0 ? idx : 30;
  })();
  const initGwIdx = (() => {
    if (!initialData?.goal_weight_kg) return 25;
    const idx = KG_VALUES.indexOf(Math.round(initialData.goal_weight_kg));
    return idx >= 0 ? idx : 25;
  })();

  // ── wheel defaults ──────────────────────────────────────────────────────────
  const [ageIdx,    setAgeIdx]    = useState(initAgeIdx);
  const [feetIdx,   setFeetIdx]   = useState(initFtIdx);
  const [inchIdx,   setInchIdx]   = useState(initInIdx);
  const [cwIdx,     setCwIdx]     = useState(initCwIdx);
  const [gwIdx,     setGwIdx]     = useState(initGwIdx);
  const [wUnit,     setWUnit]     = useState("kg");
  const [gender,    setGender]    = useState(initialData?.gender || "male");
  const [activity,  setActivity]  = useState(initialData?.activity_level || "light");

  const weightValues = wUnit === "kg" ? KG_VALUES : LBS_VALUES;

  // ── activities ───────────────────────────────────────────────────────────────
  const ACTIVITIES = [
    { id: "sedentary", emoji: "🪑", label: "Sedentary",     desc: "Little or no exercise" },
    { id: "light",     emoji: "🚶", label: "Lightly Active", desc: "1–3 workouts per week" },
    { id: "active",    emoji: "🏃", label: "Active",         desc: "4–5 workouts per week" },
    { id: "very",      emoji: "💪", label: "Very Active",    desc: "Training most days" },
  ];

  // ── unit switch: re-map indices to closest value ──────────────────────────────
  function switchUnit(newUnit) {
    if (newUnit === wUnit) return;
    const cwKg = wUnit === "kg" ? KG_VALUES[cwIdx] : Math.round(LBS_VALUES[cwIdx] / 2.20462);
    const gwKg = wUnit === "kg" ? KG_VALUES[gwIdx] : Math.round(LBS_VALUES[gwIdx] / 2.20462);
    if (newUnit === "lbs") {
      const cwLbs = Math.round(cwKg * 2.20462);
      const gwLbs = Math.round(gwKg * 2.20462);
      setCwIdx(Math.max(0, Math.min(LBS_VALUES.length - 1, LBS_VALUES.indexOf(cwLbs) >= 0 ? LBS_VALUES.indexOf(cwLbs) : LBS_VALUES.findIndex(v => v >= cwLbs))));
      setGwIdx(Math.max(0, Math.min(LBS_VALUES.length - 1, LBS_VALUES.indexOf(gwLbs) >= 0 ? LBS_VALUES.indexOf(gwLbs) : LBS_VALUES.findIndex(v => v >= gwLbs))));
    } else {
      setCwIdx(Math.max(0, Math.min(KG_VALUES.length - 1, KG_VALUES.indexOf(cwKg) >= 0 ? KG_VALUES.indexOf(cwKg) : KG_VALUES.findIndex(v => v >= cwKg))));
      setGwIdx(Math.max(0, Math.min(KG_VALUES.length - 1, KG_VALUES.indexOf(gwKg) >= 0 ? KG_VALUES.indexOf(gwKg) : KG_VALUES.findIndex(v => v >= gwKg))));
    }
    setWUnit(newUnit);
  }

  // ── derived values ────────────────────────────────────────────────────────────
  const age    = AGE_VALUES[ageIdx];
  const feet   = FEET_VALUES[feetIdx];
  const inches = INCH_VALUES[inchIdx];
  const heightCm = Math.round(feet * 30.48 + inches * 2.54);  // ft+in → cm
  const cwKg   = wUnit === "kg" ? KG_VALUES[cwIdx] : +(LBS_VALUES[cwIdx] / 2.20462).toFixed(1);
  const gwKg   = wUnit === "kg" ? KG_VALUES[gwIdx] : +(LBS_VALUES[gwIdx] / 2.20462).toFixed(1);

  function handleFinish() {
    onNext({
      age,
      gender,
      height_cm: heightCm,
      weight_kg: cwKg,
      goal_weight_kg: gwKg,
      activity_level: activity,
      member_since: todayKey(),
    });
  }

  // ── Scroll Wheel component ─────────────────────────────────────────────────────
  const WHEEL_ITEM_H = 44;
  const WHEEL_VISIBLE = 5;
  const WHEEL_H = WHEEL_ITEM_H * WHEEL_VISIBLE;

  function ScrollWheel({ values, selectedIdx, onSelect, width = 80 }) {
    const flatRef = useRef(null);
    const isScrolling = useRef(false);

    useEffect(() => {
      if (flatRef.current) {
        flatRef.current.scrollToOffset({ offset: selectedIdx * WHEEL_ITEM_H, animated: false });
      }
    }, []);

    function onMomentumScrollEnd(e) {
      const idx = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_H);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      onSelect(clamped);
      isScrolling.current = false;
    }

    function onScrollBeginDrag() { isScrolling.current = true; }

    return (
      <View style={{ width, height: WHEEL_H, overflow: "hidden", position: "relative" }}>
        {/* Top fade */}
        <LinearGradient
          colors={["rgba(7,11,20,1)", "rgba(7,11,20,0)"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: WHEEL_ITEM_H * 2, zIndex: 2, pointerEvents: "none" }}
        />
        {/* Bottom fade */}
        <LinearGradient
          colors={["rgba(7,11,20,0)", "rgba(7,11,20,1)"]}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: WHEEL_ITEM_H * 2, zIndex: 2, pointerEvents: "none" }}
        />
        {/* Selection highlight */}
        <View style={{
          position: "absolute", top: WHEEL_ITEM_H * 2, left: 0, right: 0, height: WHEEL_ITEM_H,
          borderTopWidth: 1.5, borderBottomWidth: 1.5,
          borderColor: "rgba(255,107,53,0.45)", zIndex: 1, pointerEvents: "none",
        }} />
        <FlatList
          ref={flatRef}
          data={values}
          keyExtractor={(_, i) => String(i)}
          showsVerticalScrollIndicator={false}
          snapToInterval={WHEEL_ITEM_H}
          decelerationRate="fast"
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollBeginDrag={onScrollBeginDrag}
          contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H * 2 }}
          renderItem={({ item, index }) => {
            const isSelected = index === selectedIdx;
            return (
              <View style={{ height: WHEEL_ITEM_H, alignItems: "center", justifyContent: "center" }}>
                <Text style={{
                  fontSize: isSelected ? 22 : 16,
                  fontWeight: isSelected ? "800" : "400",
                  color: isSelected ? ROSE : "rgba(255,255,255,0.3)",
                }}>
                  {item}
                </Text>
              </View>
            );
          }}
          getItemLayout={(_, index) => ({ length: WHEEL_ITEM_H, offset: WHEEL_ITEM_H * index, index })}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <Image
        source={require('./assets/coach-welcome.png')}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", resizeMode: "cover", opacity: 0.09 }}
        fadeDuration={0}
      />
      <LinearGradient
        colors={["rgba(7,11,20,0.75)", "rgba(7,11,20,0.88)", "rgba(7,11,20,0.95)", "rgba(7,11,20,1.0)"]}
        locations={[0, 0.3, 0.65, 1.0]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <SafeAreaView style={{ flex: 1, paddingTop: 0 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={{ alignItems: "center", marginTop: 0, marginBottom: 16 }}>
            <Image source={require('./assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
          </View>
          {/* Progress bar */}
          <Row style={{ gap: 6, marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 2 ? C.green : C.cardLight }} />
            ))}
          </Row>
          {/* Title */}
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 4, letterSpacing: -0.4 }}>
            Build Your Personalized WeGoFit Plan
          </Text>
          <Text style={{ color: C.grey, fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
            This helps us calculate your perfect targets
          </Text>

          {/* ── Age ── */}
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: C.grey, fontSize: 13, fontWeight: "700", marginBottom: 8 }}>🎂 Age</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <ScrollWheel values={AGE_VALUES} selectedIdx={ageIdx} onSelect={setAgeIdx} width={80} />
              <Text style={{ color: C.grey, fontSize: 14, fontWeight: "600" }}>years</Text>
            </View>
          </View>

          {/* ── Height ── */}
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: C.grey, fontSize: 13, fontWeight: "700", marginBottom: 8 }}>📏 Height</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <View style={{ alignItems: "center" }}>
                <ScrollWheel values={FEET_VALUES} selectedIdx={feetIdx} onSelect={setFeetIdx} width={72} />
                <Text style={{ color: C.grey, fontSize: 12, fontWeight: "600", marginTop: 4 }}>ft</Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 28, marginBottom: 16 }}>·</Text>
              <View style={{ alignItems: "center" }}>
                <ScrollWheel values={INCH_VALUES} selectedIdx={inchIdx} onSelect={setInchIdx} width={72} />
                <Text style={{ color: C.grey, fontSize: 12, fontWeight: "600", marginTop: 4 }}>in</Text>
              </View>
              <Text style={{ color: C.grey, fontSize: 12, marginBottom: 16, marginLeft: 4 }}>= {heightCm} cm</Text>
            </View>
          </View>

          {/* ── Current Weight ── */}
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: C.grey, fontSize: 13, fontWeight: "700" }}>⚖️ Current Weight</Text>
              {/* Unit toggle */}
              <View style={{ flexDirection: "row", backgroundColor: C.cardLight, borderRadius: 8, overflow: "hidden" }}>
                {["kg", "lbs"].map(u => (
                  <TouchableOpacity key={u} onPress={() => switchUnit(u)}
                    style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: wUnit === u ? ROSE : "transparent" }}>
                    <Text style={{ color: wUnit === u ? "#FFF" : C.grey, fontWeight: "700", fontSize: 13 }}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <ScrollWheel values={weightValues} selectedIdx={cwIdx} onSelect={setCwIdx} width={90} />
              <Text style={{ color: C.grey, fontSize: 14, fontWeight: "600" }}>{wUnit}</Text>
            </View>
          </View>

          {/* ── Goal Weight ── */}
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: C.grey, fontSize: 13, fontWeight: "700" }}>🎯 Goal Weight</Text>
              <Text style={{ color: C.grey, fontSize: 11 }}>matches {wUnit} above</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <ScrollWheel values={weightValues} selectedIdx={gwIdx} onSelect={setGwIdx} width={90} />
              <Text style={{ color: C.grey, fontSize: 14, fontWeight: "600" }}>{wUnit}</Text>
            </View>
          </View>

          {/* ── Gender ── */}
          <Text style={{ color: C.grey, fontSize: 12, marginBottom: 8, marginTop: 4 }}>Gender</Text>
          <Row style={{ gap: 8, marginBottom: 14 }}>
            {["male", "female", "other"].map(g => (
              <TouchableOpacity key={g} onPress={() => setGender(g)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: gender === g ? C.green : C.cardLight }}>
                <Text style={{ color: gender === g ? C.bg : C.grey, fontWeight: "600", fontSize: 13, textTransform: "capitalize" }}>{g}</Text>
              </TouchableOpacity>
            ))}
          </Row>

          {/* ── Activity Level ── */}
          <Text style={{ color: C.grey, fontSize: 12, marginBottom: 8 }}>Activity level</Text>
          {ACTIVITIES.map(a => (
            <TouchableOpacity key={a.id} onPress={() => setActivity(a.id)} activeOpacity={0.8}
              style={[S.card, { flexDirection: "row", alignItems: "center", marginBottom: 8, paddingVertical: 12, borderWidth: 1.5, borderColor: activity === a.id ? ROSE : "transparent" }]}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>{a.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }}>{a.label}</Text>
                <Text style={{ color: C.grey, fontSize: 12 }}>{a.desc}</Text>
              </View>
              {activity === a.id && <Text style={{ color: ROSE, fontSize: 18 }}>✓</Text>}
            </TouchableOpacity>
          ))}

          <Spacer h={16} />

          {/* ── Next button ── */}
          <TouchableOpacity style={S.primaryBtn} onPress={handleFinish}>
            <Text style={S.primaryBtnTxt}>Next →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onBack} style={{ marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: C.grey, fontSize: 13 }}>← Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
function GoFitRoot() {
  const { session, authLoading } = useContext(AuthCtx);

  // Launch screen state — shown for up to 2s while checking stored auth
  const [launching,       setLaunching]       = useState(true);
  const [skipToHome,      setSkipToHome]       = useState(false);

  // Pre-auth onboarding flow state
  // Steps: "coachWelcome" → "goal" → "biggestChallenge" → "aboutYou" → "plan" → "createAccount" → (session set) → SubscriptionScreen via ClientApp
  const [preAuthStep,    setPreAuthStep]    = useState("auth");
  const [pendingGoal,    setPendingGoal]    = useState("lose");
  const [pendingChallenge, setPendingChallenge] = useState({ title: "Staying Consistent", subtitle: "I start strong but struggle to stay on track" });
  const [pendingAbout,   setPendingAbout]   = useState(null);

  // When session is cleared (logout), reset pre-auth flow to the Sign In screen
  useEffect(() => {
    if (!session) {
      setPreAuthStep("auth");
      setSkipToHome(false);
    }
  }, [session]);

  // Check AsyncStorage on mount: if returning user, skip to home
  useEffect(() => {
    (async () => {
      try {
        const loggedIn       = await AsyncStorage.getItem("userLoggedIn");
        const onboardDone    = await AsyncStorage.getItem("onboardingComplete");
        if (loggedIn === "true" && onboardDone === "true") {
          setSkipToHome(true);
        }
      } catch (_e) {}
      // Show launch screen for exactly 2 seconds max
      setTimeout(() => setLaunching(false), 2000);
    })();
  }, []);

  // Launch Screen — shown while checking auth state
  if (launching || authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0A14", alignItems: "center", justifyContent: "center" }}>
        <Image source={require('./assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
        <ActivityIndicator color={ROSE} style={{ marginTop: 24 }} size="small" />
      </View>
    );
  }

  // Returning user with valid session — skip straight to dashboard
  if (session && skipToHome) {
    if (session.userType === "coach") {
      return (
        <NavigationContainer>
          <CoachDashboard />
        </NavigationContainer>
      );
    }
    return (
      <GoFitProvider clientId={session.userId} clientEmail={session.email}>
        <ClientApp />
      </GoFitProvider>
    );
  }

  // No session — run pre-auth onboarding flow
  if (!session) {
    // Show AuthScreen first as entry point — user can sign in or tap "Create Account" to start onboarding
    if (preAuthStep === "auth") {
      return (
        <AuthScreen
          onCreateAccount={() => setPreAuthStep("coachWelcome")}
        />
      );
    }

    // Step 1: CoachWelcomeScreen
    if (preAuthStep === "coachWelcome") {
      return (
        <PreAuthCoachWelcomeScreen
          onNext={() => setPreAuthStep("goal")}
        />
      );
    }

    // Step 2: Goal selection
    if (preAuthStep === "goal") {
      return (
        <PreAuthGoalScreen
          onNext={(goal) => { setPendingGoal(goal); setPreAuthStep("biggestChallenge"); }}
          onBack={() => setPreAuthStep("auth")}
          initialGoal={pendingGoal}
        />
      );
    }

    // Step 3: Biggest challenge
    if (preAuthStep === "biggestChallenge") {
      return (
        <PreAuthBiggestChallengeScreen
          onNext={(ch) => { setPendingChallenge(ch); setPreAuthStep("aboutYou"); }}
          onBack={() => setPreAuthStep("goal")}
          initialChallenge={pendingChallenge}
        />
      );
    }

    // Step 4: Tell us about you
    if (preAuthStep === "aboutYou") {
      return (
        <PreAuthAboutYouScreen
          onNext={(aboutData) => { setPendingAbout(aboutData); setPreAuthStep("plan"); }}
          onBack={() => setPreAuthStep("biggestChallenge")}
          initialData={pendingAbout}
        />
      );
    }

    // Step 5: Personalised plan preview
    if (preAuthStep === "plan") {
      return (
        <PreAuthPersonalisedPlanScreen
          onNext={() => setPreAuthStep("createAccount")}
          onBack={() => setPreAuthStep("aboutYou")}
          pendingGoal={pendingGoal}
          pendingAbout={pendingAbout}
          pendingChallenge={pendingChallenge}
        />
      );
    }

    // Step 6: Account creation (email, password, name) — navigates to SubscriptionScreen on success via session set
    if (preAuthStep === "createAccount") {
      return (
        <AccountCreationScreen
          onNext={() => { /* session is now set by signUp, ClientApp will show SubscriptionScreen */ }}
          onBack={() => setPreAuthStep("plan")}
          pendingGoal={pendingGoal}
          pendingAbout={pendingAbout}
          pendingChallenge={pendingChallenge}
        />
      );
    }

    // Default: AuthScreen (sign in)
    return (
      <AuthScreen
        onCreateAccount={() => setPreAuthStep("coachWelcome")}
      />
    );
  }

  // Coach session — always full access
  if (session.userType === "coach") {
    return (
      <NavigationContainer>
        <CoachDashboard />
      </NavigationContainer>
    );
  }

  // Client session — wrap GoFitProvider
  return (
    <GoFitProvider clientId={session.userId} clientEmail={session.email}>
      <ClientApp />
    </GoFitProvider>
  );
}

function TrialReminderModal({ visible, firstName, daysLeft, isExpired, isFirstLogin, profile, onUpgrade, onDismiss }) {
  let title, message, buttonLabel, showMaybeLater;

  if (isExpired) {
    title          = `Your trial has ended 💙`;
    message        = `Subscribe to keep your WeGoFit journey going`;
    buttonLabel    = "View Plans";
    showMaybeLater = true;
  } else if (isFirstLogin) {
    title       = `Welcome, ${firstName}! 🎉`;
    message     = `Your personalized Plan is ready!\nBased on your profile we've calculated:\n\n🔥 Your daily Calorie Target: ${profile?.dailyCalorieTarget ?? "—"} Kcal\n💪 Protein Goal: ${profile?.proteinTarget ?? "—"}g\n🏃 Workout plan: matched to your goal\n💧 Daily Water Goal: ${calcTargets(profile).waterGoal.toFixed(1)}L\n\nYour 7-day free trial has started.\nLet's make every day count! 💪`;
    buttonLabel    = "Let's Go! 🚀";
    showMaybeLater = false;
  } else if (daysLeft >= 5) {
    title          = `Welcome back, ${firstName}! 🌸`;
    message        = `You're doing amazing! You have ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left on your free trial. Stay consistent — results are coming! 💪`;
    buttonLabel    = "Upgrade Now 👑";
    showMaybeLater = true;
  } else if (daysLeft >= 3) {
    title          = `Welcome back, ${firstName}! 🌸`;
    message        = `You're doing amazing! You have ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left on your free trial. Stay consistent — results are coming! 💪`;
    buttonLabel    = "Upgrade Now 👑";
    showMaybeLater = true;
  } else {
    title          = `Welcome back, ${firstName}! 🌸`;
    message        = `You're doing amazing! You have ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left on your free trial. Stay consistent — results are coming! 💪`;
    buttonLabel    = "Upgrade Now 👑";
    showMaybeLater = true;
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}>
        <View style={{
          backgroundColor: "#FFF8FA", borderRadius: 24, padding: 28,
          width: "100%", maxWidth: 360,
          shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}>
          <Text style={{ fontSize: 38, textAlign: "center", marginBottom: 12 }}>👑</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#1A1A1A", textAlign: "center", marginBottom: 10, lineHeight: 26 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, color: "#666", textAlign: "center", lineHeight: 21, marginBottom: 24 }}>
            {message}
          </Text>
          <TouchableOpacity
            onPress={isFirstLogin ? onDismiss : onUpgrade}
            style={{
              backgroundColor: ROSE, borderRadius: 14, padding: 15, alignItems: "center",
              shadowColor: ROSE, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
              elevation: 4, marginBottom: showMaybeLater ? 12 : 0,
            }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>
              {buttonLabel}
            </Text>
          </TouchableOpacity>
          {showMaybeLater && (
            <TouchableOpacity onPress={onDismiss} style={{ alignItems: "center", padding: 10 }}>
              <Text style={{ fontSize: 14, color: "#AAA", fontWeight: "500" }}>Maybe Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ClientApp() {
  const { onboarded, loading, isOnline, profile, completeOnboarding } = useContext(Ctx);
  const { isDark, theme } = useTheme();
  const { session } = useContext(AuthCtx);
  const insets = useSafeAreaInsets();
  const { subStatus, trialDays, trialStats, activate } = useSubscriptionStatus(session?.userId, session?.email);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [activeRoute, setActiveRoute] = useState("Home");
  const [unreadCoachMessages, setUnreadCoachMessages] = useState(0);
  const [lastCoachMessageTime, setLastCoachMessageTime] = useState(null);
  const reminderShownRef = useRef(false);

  const clearCoachUnread = useCallback(() => {
    setUnreadCoachMessages(0);
  }, []);

  const incrementCoachUnread = useCallback(() => {
    setUnreadCoachMessages(prev => prev + 1);
    setLastCoachMessageTime(new Date().toISOString());
  }, []);

  const daysLeft = Math.max(0, 7 - trialDays);
  const openPaywall = useCallback(() => setShowPaywall(true), []);

  // Auto-complete onboarding using pre-auth collected data if available
  useEffect(() => {
    if (onboarded || loading) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("gofit_pending_onboarding");
        if (raw) {
          const pending = JSON.parse(raw);
          await AsyncStorage.removeItem("gofit_pending_onboarding");
          const name = session?.name || "";
          await completeOnboarding({ ...pending, name, member_since: pending.member_since || todayKey() });
        }
      } catch (_e) {}
    })();
  }, [onboarded, loading, session]);

  // Show login-session reminder once when trial status is known
  useEffect(() => {
    if (reminderShownRef.current) return;
    if (subStatus === "trial" || subStatus === "expired_trial") {
      reminderShownRef.current = true;
      // Small delay so the app renders first
      const t = setTimeout(() => setShowReminderModal(true), 800);
      return () => clearTimeout(t);
    }
  }, [subStatus]);

  if (loading || subStatus === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: "#1A1A2E", alignItems: "center", justifyContent: "center" }}>
        <Image source={LOGO_URI} style={{ width: 180, height: 180, resizeMode: "contain", marginBottom: 8 }} />
        <Text style={{ color: "#FFFFFF99", fontSize: 14, fontWeight: "500", letterSpacing: 0.5, marginBottom: 24 }}>Better Habits. Better You.</Text>
        <ActivityIndicator color={ROSE} style={{ marginTop: 12 }} />
      </View>
    );
  }

  // Show paywall: no access at all, or expired trial, or manually opened
  // Only after onboarding is complete — never interrupt the onboarding flow
  if (onboarded && (subStatus === "none" || subStatus === "expired_trial" || showPaywall)) {
    // User can go back only when they opened it manually from inside the app
    const canGoBack = showPaywall && (subStatus === "trial" || subStatus === "active");
    return (
      <SubscriptionScreen
        expiredTrial={subStatus === "expired_trial"}
        isOnTrial={subStatus === "trial"}
        trialStats={trialStats}
        onBack={canGoBack ? () => setShowPaywall(false) : undefined}
        onSubscribed={(mode) => {
          activate(mode);
          setShowPaywall(false);
        }}
      />
    );
  }

  const firstName = (profile?.name || session?.name || "there").split(" ")[0];

  return (
    <PaywallCtx.Provider value={{ subStatus, trialDays, openPaywall, unreadCoachMessages, clearCoachUnread, incrementCoachUnread, activeRoute }}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Safe-area spacer — pushes banners below status bar */}
        <View style={{ height: insets.top, backgroundColor: theme.bg }} />
        {!isOnline && (
          <View style={{
            backgroundColor: "#92400E", paddingVertical: 8, paddingHorizontal: 16,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Text style={{ color: "#FEF3C7", fontSize: 13, fontWeight: "600" }}>
              You are offline. Some features are unavailable.
            </Text>
          </View>
        )}
        {/* Trial banner — hidden on Profile (MY PLAN card already shows it) */}
        {subStatus === "trial" && activeRoute !== "Profile" && (
          <TouchableOpacity
            onPress={openPaywall}
            style={{
              backgroundColor: "#FFF5F0", paddingVertical: 8,
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
              borderBottomWidth: 1, borderBottomColor: "#FECDD3",
            }}>
            <Text style={{ fontSize: 12, color: "#1A1A1A", fontWeight: "500" }}>
              🔥 Free Trial: {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining —{" "}
            </Text>
            <Text style={{ fontSize: 12, color: ROSE, fontWeight: "800" }}>Upgrade Now</Text>
          </TouchableOpacity>
        )}
        <NavigationContainer
          onStateChange={(state) => {
            // Pull the active tab name from the navigator state
            const route = state?.routes?.[state.index];
            if (route) setActiveRoute(route.name);
          }}
        >
          {onboarded ? <AppTabs /> : <OnboardingScreen />}
        </NavigationContainer>
        {/* Login-session trial reminder modal */}
        <TrialReminderModal
          visible={showReminderModal && onboarded === true && activeRoute === "Home"}
          firstName={firstName}
          daysLeft={daysLeft}
          isExpired={subStatus === "expired_trial"}
          isFirstLogin={trialDays === 0 || trialDays < 1}
          profile={profile}
          onUpgrade={() => { setShowReminderModal(false); setShowPaywall(true); }}
          onDismiss={() => setShowReminderModal(false)}
        />
      </View>
    </PaywallCtx.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <AuthProvider>
        <GoFitRoot />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#070B14",
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 16,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  heading: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  input: {
    backgroundColor: "#1E2837",
    borderRadius: 12,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    minHeight: 50,
  },
  inputFocused: {
    borderColor: ROSE,
    backgroundColor: "rgba(255,107,53,0.05)",
  },
  primaryBtn: {
    backgroundColor: ROSE,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  primaryBtnTxt: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: "#1E2837",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  secondaryBtnTxt: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: SH * 0.88,
  },
  nutritionCard: {
    backgroundColor: "#1E2837",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.25)",
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
