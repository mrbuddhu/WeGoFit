import React, { useState, useContext } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import S from "../lib/styles";
import { ROSE, C, SH } from "../lib/constants";
import { Ctx } from "../contexts/AppContext";
import { Card, Row, Spacer } from "../components/shared";
import { calcTargets } from "../utils/calculations";

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

export { NutritionTargetsPanel, NutritionScreen, TrainSubBar, TrainScreen };
