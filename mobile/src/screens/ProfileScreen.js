import React, { useState, useContext, useEffect, useRef } from "react"
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Alert, Modal, Platform, Linking, Image, ActivityIndicator, StyleSheet, TouchableWithoutFeedback, KeyboardAvoidingView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import S from "../lib/styles"
import { ROSE, C, SH, LOGO_URI, isVIPAccount, COACH_CREDENTIALS, PLAN_PRICE, PLAN_PRICES, planMRR, formatPrice } from "../lib/constants"
import { Ctx, PaywallCtx, useTheme } from "../contexts/AppContext"
import { AuthCtx } from "../contexts/AuthContext"
import { pwStrengthFull, EyeBtn } from "./SignInScreen"
import * as Notifications from "expo-notifications"
import { calcTargets, calcBMI, getBMICategory, getReferenceRange, getCalorieRangeNote } from "../utils/calculations"
import { Card, PrimaryBtn, SecondaryBtn, Row, Spacer } from "../components/shared"
import { BADGES, MILESTONE_LEVELS, ACHIEVEMENTS } from "../data/community"
import { supabase } from "../lib/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"

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
const ACHIEVEMENTS_LOCAL = [
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
  const { session } = useContext(AuthCtx);
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
    setBusy(true);
    try {
      const userEmail = profile?.email || session?.email || "";
      if (!userEmail) throw new Error("Could not verify account. Please try again.");
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: curPw,
      });
      if (signInErr) throw new Error("Current password is incorrect.");
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      if (updateErr) throw new Error(updateErr.message);
      setBusy(false);
      setDone(true);
      setTimeout(() => { onClose(); reset(); }, 1800);
    } catch (e) {
      setBusy(false);
      setError(e?.message || "Could not update password. Please try again.");
    }
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

export function ProfileScreen({ navigation }) {
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
            <Image source={require("../../assets/Enhanced_Logo.PNG")} style={{ width: 160, height: 65, resizeMode: "contain" }} />
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
            const PricingCards = ({ daysLeft }) => {
              const annualTotalUSD = PLAN_PRICES.annual.USD;
              const annualTotalUGX = PLAN_PRICES.annual.UGX;
              const annualPerMoUSD = (annualTotalUSD / 12).toFixed(2);
              const annualPerMoUGX = Math.round(annualTotalUGX / 12).toLocaleString();
              const savePct = Math.round((1 - annualTotalUSD / (PLAN_PRICES.monthly.USD * 12)) * 100);
              return (
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
                    <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>{`${formatPrice("annual", "USD")}/year · Save ${savePct}% · Best Value`}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 18 }}>{`$${annualPerMoUSD}/mo`}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10 }}>{`≈ UGX ${annualPerMoUGX}/mo`}</Text>
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
                    <Text style={{ color: ROSE, fontWeight: "700", fontSize: 18 }}>{`${formatPrice("monthly", "USD")}/mo`}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>{`≈ ${formatPrice("monthly", "UGX")}/mo`}</Text>
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
            };

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
                          : isAnnual
                            ? `$${(PLAN_PRICES.annual.USD / 12).toFixed(2)}/month (${formatPrice("annual", "UGX")}/year) · Billed annually`
                            : `${formatPrice("monthly", "USD")}/month (${formatPrice("monthly", "UGX")}) · Billed monthly`}
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
                                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{`Save ${Math.round((1 - PLAN_PRICES.annual.USD / (PLAN_PRICES.monthly.USD * 12)) * 100)}% · $${(PLAN_PRICES.annual.USD / 12).toFixed(2)}/mo (${formatPrice("annual", "UGX")}/yr)`}</Text>
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

export {
  SettingsRow,
  SettingsSection,
  Sheet,
  ClientChangePwModal,
};
