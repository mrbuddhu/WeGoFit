import React, { useState, useContext, useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Modal, Alert, Animated, Dimensions } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Circle, Path } from "react-native-svg";
import S from "../lib/styles";
import { ROSE, C, SH, SW, LOGO_URI, isVIPAccount } from "../lib/constants";
import { AuthCtx } from "../contexts/AuthContext";
import { Ctx, PaywallCtx, GoFitProvider, useTheme } from "../contexts/AppContext";
import { Card, Row, Spacer } from "../components/shared";
import { calcTargets, todayKey } from "../utils/calculations";
import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { DashboardScreen } from "../screens/DashboardScreen";
import { CoachScreen } from "../screens/CoachScreen";
import { ExerciseScreen } from "../screens/ExerciseScreen";
import { DiaryScreen } from "../screens/DiaryScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { CommunityScreen } from "../screens/CommunityScreen";
import { SleepScreen } from "../screens/SleepScreen";
import { MealPlannerScreen } from "../screens/MealPlannerScreen";
import { WorkoutProgressScreen } from "../screens/ProgressScreen";
import { VideoScreen } from "../screens/SleepScreen";
import { TrainScreen, TrainSubBar, NutritionScreen } from "../screens/TrainScreen";
import { AuthScreen } from "../screens/SignInScreen";
import { CoachDashboard } from "../screens/CoachDashboardScreen";
import { CoachChallenges } from "../screens/CoachChallengesScreen";
import { SubscriptionScreen } from "../screens/SubscriptionScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import {
  PreAuthCoachWelcomeScreen,
  PreAuthGoalScreen,
  PreAuthBiggestChallengeScreen,
  PreAuthAboutYouScreen,
  PreAuthPersonalisedPlanScreen,
  AccountCreationScreen,
} from "../screens/PreAuthScreens";

const Tab = createBottomTabNavigator();

// ─── TRIAL HELPERS ───────────────────────────────────────────────────────────
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

// ─── TAB ICON ────────────────────────────────────────────────────────────────
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
        <Image source={require("../../public/Enhanced_Logo.PNG")} style={{ width: 220, height: 90, resizeMode: "contain" }} />
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

export { GoFitRoot, ClientApp };
