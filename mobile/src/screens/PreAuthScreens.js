import React, { useState, useContext, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import S from "../lib/styles";
import { ROSE, C, SH, LOGO_URI } from "../lib/constants";
import { AuthCtx } from "../contexts/AuthContext";
import { Card, PrimaryBtn, Row, Spacer, KeyboardSafeView } from "../components/shared";
import { calcTargets, calcBMI, getBMICategory, getSafeCalorieTarget, getCalorieRangeNote, getReferenceRange, calcBMR, calcTDEE, todayKey } from "../utils/calculations";
import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";

// ─── PRE-AUTH ONBOARDING SCREENS ─────────────────────────────────────────────
// These render before the user creates an account:
// CoachWelcomeScreen → OnboardingScreen (goal) → BiggestChallengeScreen → TellUsAboutYouScreen → AuthScreen → SubscriptionScreen


export function PreAuthCoachWelcomeScreen({ onNext }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => {
    async function preload() {
      await Asset.loadAsync(require('../../assets/coach-welcome.png'));
      setImageLoaded(true);
    }
    preload();
  }, []);

  if (!imageLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14", alignItems: "center", justifyContent: "center" }}>
        <Image source={require('../../assets/Enhanced_Logo.PNG')} style={{ width: 180, height: 72, resizeMode: "contain", opacity: 0.6 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <Image
        source={require('../../assets/coach-welcome.png')}
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

export function PreAuthGoalScreen({ onNext, onBack, initialGoal }) {
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
        source={require('../../assets/coach-welcome.png')}
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
            <Image source={require('../../assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
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

export function PreAuthBiggestChallengeScreen({ onNext, onBack, initialChallenge }) {
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
        source={require('../../assets/coach-welcome.png')}
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
            <Image source={require('../../assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
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

export function PreAuthPersonalisedPlanScreen({ onNext, onBack, pendingGoal, pendingAbout, pendingChallenge }) {
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
        source={require('../../assets/coach-welcome.png')}
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
            <Image source={require('../../assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
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
export function AccountCreationScreen({ onNext, onBack, pendingGoal, pendingAbout, pendingChallenge }) {
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
  const [agreed,       setAgreed]       = useState(false);
  const [suError,      setSuError]      = useState("");
  const [suBusy,       setSuBusy]       = useState(false);
  const [focused,      setFocused]      = useState(null);

  const emailRef   = useRef(null);
  const pwRef      = useRef(null);
  const confRef    = useRef(null);

  async function handleCreate() {
    Keyboard.dismiss();
    if (!suName.trim())           { setSuError("Please enter your full name."); return; }
    if (!suEmail.trim())          { setSuError("Please enter your email."); return; }
    if (!suPassword)              { setSuError("Please enter a password."); return; }
    if (suPassword !== suConfirm) { setSuError("Passwords do not match."); return; }
    if (suPassword.length < 6)   { setSuError("Password must be at least 6 characters."); return; }
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
    const result = await signUp({ name: suName.trim(), email: suEmail, password: suPassword });
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
              <Image source={require('../../assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
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
                secureTextEntry={!suShowConf} autoCapitalize="none" autoCorrect={false} returnKeyType="done"
                onSubmitEditing={handleCreate} blurOnSubmit={false}
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
    </View>
  );
}


export function PreAuthAboutYouScreen({ onNext, onBack, initialData }) {
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
        source={require('../../assets/coach-welcome.png')}
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
            <Image source={require('../../assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
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
