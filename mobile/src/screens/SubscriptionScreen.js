import React, { useState, useContext, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Image, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import S from "../lib/styles";
import { ROSE, C, SH, LOGO_URI, PLAN_PRICES, PLAN_DISPLAY, CURRENCY_SYMBOLS, formatPrice, PESAPAL_ORDER_URL, SUPABASE_ANON_KEY_FOR_EDGE, isVIPAccount } from "../lib/constants";
import { Ctx, PaywallCtx } from "../contexts/AppContext";
import { AuthCtx } from "../contexts/AuthContext";
import { Card, PrimaryBtn, Row, Spacer } from "../components/shared";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── SUBSCRIPTION SCREEN ──────────────────────────────────────────────────────

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

export function SubscriptionScreen({ onSubscribed, expiredTrial, trialStats, onBack, isOnTrial }) {
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
        <Image source={require("../../assets/Enhanced_Logo.PNG")} style={{ width: 90, height: 40, resizeMode: "contain" }} />
        {/* Right slot — balanced spacer */}
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={{ alignItems: "center", marginTop: 8, marginBottom: 4 }}>
          <Image source={require('../../assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
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
                {formatPrice("monthly", currency)}
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                {`/ month${currency === "UGX" ? ` · (${formatPrice("monthly", "USD")})` : ""}`}
              </Text>
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
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>Best results · Save on annual billing · Coach TinaBarks' top pick 👑</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: "800", fontSize: 20, color: plan === "annual" ? ROSE : "#FFFFFF" }}>
                {formatPrice("annual", currency)}
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                {`/ year${currency === "UGX" ? ` · (${formatPrice("annual", "USD")})` : ""}`}
              </Text>
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
                Subscribe Now — {formatPrice(plan, currency)}
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
export function useSubscriptionStatus(userId, email) {
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
