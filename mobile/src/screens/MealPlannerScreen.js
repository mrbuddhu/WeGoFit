import React, { useState, useContext, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import S from "../lib/styles";
import { ROSE, ROSE_DIM, C, SH } from "../lib/constants";
import { Ctx, useTheme } from "../contexts/AppContext";
import { calcTargets, todayKey } from "../utils/calculations";
import { getMonday, isCurrentWeek } from "../utils/mealPlan";
import { Card, PrimaryBtn, Row, Spacer } from "../components/shared";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import { MEAL_ICONS, MEAL_LABELS, DAYS_SHORT } from "../data/exercises";
import { RARITY_CONFIG } from "../data/community";

// ─── MEAL PLANNER ────────────────────────────────────────────────────────────
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

export function MealPlannerScreen({ navigation, nutritionSubBar }) {
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
export function BadgeCard({ badge, size = "medium", unlocked = false, showName = true, isNew = false, onPress }) {
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
