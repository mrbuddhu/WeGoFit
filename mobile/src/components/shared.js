import React, { useState, useEffect, useContext } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, Platform, Alert } from "react-native";
import Svg, { Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import S from "../lib/styles";
import { ROSE, C, SH } from "../lib/constants";
import { Ctx, useTheme } from "../contexts/AppContext";
import { calcTargets, todayKey } from "../utils/calculations";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import { FOODS, AFRICAN_QUICK_PICKS, COUNTRY_FLAGS } from "../data/foods";

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
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} style={[S.primaryBtn, disabled && { opacity: 0.4 }, style]}>
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
        <Circle cx={size/2} cy={size/2} r={r} stroke={ROSE} strokeWidth={8} fill="none"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} />
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
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#1E2837", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
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

function NudgeBanner({ message, onDismiss }) {
  return (
    <View style={{ backgroundColor: "#FFFBEB", borderLeftWidth: 4, borderLeftColor: "#F59E0B", margin: 16, padding: 12, borderRadius: 12, flexDirection: "row", alignItems: "center" }}>
      <Text style={{ flex: 1, color: "#92400E", fontSize: 13, fontWeight: "600" }}>{message}</Text>
      <TouchableOpacity onPress={onDismiss}><Text style={{ color: "#F59E0B", fontSize: 18 }}>✕</Text></TouchableOpacity>
    </View>
  );
}

function KeyboardSafeView({ children, style, centerContent = true }) {
  return (
    <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: centerContent ? "center" : "flex-start" }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View>{children}</View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ModalSheet({ visible, onClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableWithoutFeedback onPress={onClose} accessible={false}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        </TouchableWithoutFeedback>
        <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 44 : 36, paddingTop: 16, maxHeight: "92%" }}>
          <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const GLOBAL_QUICK_PICKS = ["Rice porridge","2 chapatis with eggs","Bowl of matoke","Spaghetti bolognese","Caesar salad","Chicken biryani","Fruit smoothie","Peanut butter sandwich"];

function AddFoodModal({ visible, meal, onClose, initialTab, navigation }) {
  const { addFood, isOnline } = useContext(Ctx);
  const [tab,       setTab]       = useState(initialTab || "african");
  const [afSearch,  setAfSearch]  = useState("");
  const [afCountry, setAfCountry] = useState("All");
  const [query,     setQuery]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [nutrition, setNutrition] = useState(null);
  const [error,     setError]     = useState(null);
  const [errorType, setErrorType] = useState(null);

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
        method: "POST", signal: controller.signal,
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
        query: foodQuery, foodName: parsed.foodName || foodQuery, servingDescription: parsed.servingDescription || "",
        calories: Math.round(parsed.calories || 0), protein: Math.round(parsed.protein || 0),
        carbs: Math.round(parsed.carbs || 0), fat: Math.round(parsed.fat || 0), fiber: Math.round(parsed.fiber || 0),
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === "AbortError") throw new Error("TIMEOUT");
      throw err;
    }
  }

  const ERROR_MESSAGES = {
    NO_KEY: "API key needed. Go to Profile → Settings → AI Search Key to add yours.",
    INVALID_KEY: "Invalid API key. Check your key in Profile → Settings → AI Search Key.",
    QUOTA_EXCEEDED: "Daily AI limit reached. Try again tomorrow or use the African / Global food lists.",
    TIMEOUT: "Request timed out. Check your internet connection and try again.",
    FOOD_NOT_FOUND: "Couldn't identify that food. Try being more specific e.g. '1 cup rice porridge with milk' or 'ugali 150g'",
    API_ERROR: "AI service unavailable. Try again in a moment or use African / Global food lists.",
    PARSE_ERROR: "Something went wrong. Please try again.",
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
              <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={S.heading}>Add to {mealLabel}</Text>
                <TouchableOpacity onPress={() => { setQuery(""); setNutrition(null); setError(null); onClose(); }}>
                  <Text style={{ color: C.grey, fontSize: 22 }}>✕</Text>
                </TouchableOpacity>
              </Row>

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

              {tab === "african" && (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6, paddingRight: 16 }}>
                    {COUNTRIES.map(c => (
                      <TouchableOpacity key={c} onPress={() => setAfCountry(c)} style={{
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                        backgroundColor: afCountry === c ? ROSE : "#1E2837",
                      }}>
                        <Text style={{ color: afCountry === c ? "#FFF" : "rgba(255,255,255,0.5)", fontWeight: "600", fontSize: 12 }}>
                          {c === "All" ? "🌍 All" : `${COUNTRY_FLAGS[c] || ""} ${c}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TextInput style={[S.input, { marginBottom: 10 }]} placeholder="Search African foods..." placeholderTextColor="rgba(255,255,255,0.3)" value={afSearch} onChangeText={setAfSearch} />
                  <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                    {filteredAfrican.map(food => (
                      <TouchableOpacity key={food.id} onPress={() => handleAddAfricanFood(food)} style={{
                        flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 6,
                        backgroundColor: "#1E2837", borderRadius: 12,
                      }}>
                        <Text style={{ fontSize: 24, marginRight: 12 }}>{food.emoji || "🍽️"}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>{food.name}</Text>
                          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{food.serving} · {food.cal} kcal</Text>
                        </View>
                        <Text style={{ color: ROSE, fontSize: 20 }}>+</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {tab === "global" && (
                <>
                  <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                    {GLOBAL_FOODS.map(food => (
                      <TouchableOpacity key={food.id} onPress={() => handleAddGlobalFood(food)} style={{
                        flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 6,
                        backgroundColor: "#1E2837", borderRadius: 12,
                      }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,107,53,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                          <Text style={{ fontSize: 18 }}>🍽️</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>{food.name}</Text>
                          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{food.serving} · {food.cal} kcal · P{food.p} C{food.c} F{food.f}</Text>
                        </View>
                        <Text style={{ color: ROSE, fontSize: 20 }}>+</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {tab === "ai" && (
                <>
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 10 }}>
                    Describe any food and AI will estimate the nutrition. e.g. "1 cup rice porridge with milk" or "ugali 150g with sukuma wiki"
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                    <TextInput style={[S.input, { flex: 1 }]} placeholder="Describe your food..." placeholderTextColor="rgba(255,255,255,0.3)" value={query} onChangeText={setQuery} onSubmitEditing={() => analyze(query)} />
                    <TouchableOpacity onPress={() => analyze(query)} disabled={loading} style={{ backgroundColor: ROSE, borderRadius: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>{loading ? "..." : "Analyze"}</Text>
                    </TouchableOpacity>
                  </View>
                  {AFRICAN_QUICK_PICKS.map((s, i) => (
                    <TouchableOpacity key={i} onPress={() => { setQuery(s); analyze(s); }} style={{ padding: 8, marginBottom: 4 }}>
                      <Text style={{ color: "rgba(255,107,53,0.8)", fontSize: 13 }}>💡 {s}</Text>
                    </TouchableOpacity>
                  ))}
                  {nutrition && (
                    <Card style={{ marginTop: 12 }}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 8 }}>{nutrition.foodName}</Text>
                      {nutrition.servingDescription ? <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>{nutrition.servingDescription}</Text> : null}
                      <Row style={{ gap: 16 }}>
                        <Text style={{ color: ROSE, fontWeight: "700" }}>{nutrition.calories} kcal</Text>
                        <Text style={{ color: "#FFFFFF" }}>P {nutrition.protein}g</Text>
                        <Text style={{ color: "#FFFFFF" }}>C {nutrition.carbs}g</Text>
                        <Text style={{ color: "#FFFFFF" }}>F {nutrition.fat}g</Text>
                      </Row>
                      <PrimaryBtn label="Add to meal" onPress={handleAddNutrition} style={{ marginTop: 12 }} />
                    </Card>
                  )}
                  {error && (
                    <View style={{ marginTop: 12, padding: 14, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 12 }}>
                      <Text style={{ color: "#EF4444", fontSize: 13, textAlign: "center" }}>{error}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export {
  Card, PrimaryBtn, SecondaryBtn, Row, Spacer, CalRing, MacroBar, WaterWidget,
  NudgeBanner, KeyboardSafeView, ModalSheet, AddFoodModal,
};
