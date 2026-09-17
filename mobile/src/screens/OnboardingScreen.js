import React, { useState, useContext, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Asset } from "expo-asset";
import S from "../lib/styles";
import { ROSE, C, SH, LOGO_URI } from "../lib/constants";
import { Ctx, useTheme } from "../contexts/AppContext";
import { AuthCtx } from "../contexts/AuthContext";
import { calcTargets, todayKey } from "../utils/calculations";
import { Card, PrimaryBtn, Row, Spacer } from "../components/shared";
import { PrivacyPolicyScreen, TermsOfServiceScreen } from "../App";

export function OnboardingScreen() {
  const { completeOnboarding } = useContext(Ctx);
  const { theme }              = useTheme();
  const { session } = useContext(AuthCtx);
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => {
    async function preloadImage() {
      await Asset.loadAsync(
        require('../../assets/coach-welcome.png')
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
          source={require('../../assets/Enhanced_Logo.PNG')}
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
          source={require('../../assets/coach-welcome.png')}
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
        source={require('../../assets/coach-welcome.png')}
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
          <Image source={require('../../assets/Enhanced_Logo.PNG')} style={{ width: 220, height: 90, resizeMode: "contain" }} />
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
