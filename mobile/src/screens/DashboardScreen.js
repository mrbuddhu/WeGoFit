import React, { useState, useContext, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import S from "../lib/styles";
import { ROSE, C, SH, LOGO_URI } from "../lib/constants";
import { Ctx, PaywallCtx, useTheme } from "../contexts/AppContext";
import { calcTargets, getCalorieStatus, todayKey, recalc } from "../utils/calculations";
import { getMonday, isCurrentWeek } from "../utils/mealPlan";
import { sleepQualityEmoji, fmtSleepDur, sleepBarColor } from "../utils/sleep";
import { getAllWorkoutSessions } from "../utils/workoutProgress";
import { Card, PrimaryBtn, Row, Spacer, CalRing, MacroBar, WaterWidget, AddFoodModal } from "../components/shared";
import { FOODS, COUNTRY_FLAGS } from "../data/foods";
import { EXERCISES } from "../data/exercises";
import { MOCK_LEADERBOARD } from "../data/community";

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export function DashboardScreen({ navigation }) {
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
            source={require('../../assets/CoachTinaBarks.PNG')}
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
