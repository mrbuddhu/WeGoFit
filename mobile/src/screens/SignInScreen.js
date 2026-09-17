import React, { useState, useContext, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  ActivityIndicator,
  LinearGradient,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Rect, Path, Circle } from "react-native-svg";
import S from "../lib/styles";
import { ROSE, ROSE_DIM, C, SH, LOGO_URI, COACH_CREDENTIALS } from "../lib/constants";
import { AuthCtx } from "../contexts/AuthContext";
import { Card, PrimaryBtn, Row, Spacer, KeyboardSafeView } from "../components/shared";
import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── PASSWORD STRENGTH HELPER ─────────────────────────────────────────────────
function pwStrength(pw) {
  if (!pw || pw.length < 6) return { level: "Weak",   pct: 0.25, color: "#EF4444" };
  if (pw.length < 8)        return { level: "Fair",   pct: 0.50, color: "#F59E0B" };
  if (/\d/.test(pw))        return { level: "Good",   pct: 0.75, color: "#3B82F6" };
  return                           { level: "Strong", pct: 1.00, color: "#22C55E" };
}
export function pwStrengthFull(pw) {
  if (!pw || pw.length < 6)                         return { level: "Weak",   pct: 0.25, color: "#EF4444" };
  if (pw.length < 8)                                return { level: "Fair",   pct: 0.50, color: "#F59E0B" };
  if (pw.length >= 8 && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) return { level: "Strong", pct: 1.00, color: "#22C55E" };
  if (pw.length >= 8 && /\d/.test(pw))              return { level: "Good",   pct: 0.75, color: "#3B82F6" };
  return                                                   { level: "Fair",   pct: 0.50, color: "#F59E0B" };
}

// ─── EYE TOGGLE BUTTON ────────────────────────────────────────────────────────
export function EyeBtn({ show, onToggle }) {
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
export function ForgotPasswordModal({ visible, onClose, onResetDone }) {
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
export function AuthScreen({ onCreateAccount }) {
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
        source={require('../../assets/signin-background_old.png')}
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
