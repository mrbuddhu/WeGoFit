import React, { useState, useContext } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import S from "../lib/styles";
import { ROSE, C, SW, LOGO_URI } from "../lib/constants";
import { Ctx, useTheme } from "../contexts/AppContext";
import { Card, Row, Spacer, AddFoodModal } from "../components/shared";
import { calcTargets, todayKey, getCalorieStatus } from "../utils/calculations";

export function DiaryScreen({ navigation, nutritionSubBar }) {
  const { dayLog, removeFood, profile } = useContext(Ctx);
  const { theme } = useTheme();
  const [addMeal, setAddMeal] = useState(null);

  const MEALS = [
    { key: "breakfast", label: "Breakfast", emoji: "🌅" },
    { key: "lunch",     label: "Lunch",     emoji: "☀️" },
    { key: "dinner",    label: "Dinner",    emoji: "🌙" },
    { key: "snacks",    label: "Snacks",    emoji: "🍎" },
  ];
  const totals  = dayLog?.totals || {};
  const targets = calcTargets(profile);

  return (
    <SafeAreaView style={S.screen}>
      {nutritionSubBar || null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {!nutritionSubBar && navigation?.canGoBack?.() && (
          <TouchableOpacity onPress={() => navigation.goBack()}
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, alignSelf: "flex-start" }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.cardLight,
              alignItems: "center", justifyContent: "center", marginRight: 8 }}>
              <Text style={{ color: ROSE, fontSize: 18 }}>‹</Text>
            </View>
            <Text style={{ color: ROSE, fontWeight: "600", fontSize: 15 }}>Back</Text>
          </TouchableOpacity>
        )}
        <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <Text style={[S.heading, { color: theme.text }]}>Food Diary 📖</Text>
          <Image source={LOGO_URI} style={{ width: 80, height: 40, resizeMode: "contain" }} />
        </Row>
        <Text style={{ color: theme.textSub, fontSize: 13, marginBottom: 16 }}>{todayKey()}</Text>

        {MEALS.map(m => {
          const foods = dayLog?.meals?.[m.key] || [];
          const mealCal = foods.reduce((s, f) => s + (f.cal || 0), 0);
          return (
            <Card key={m.key} style={{ marginBottom: 12 }}>
              <Row style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <Row>
                  <Text style={{ fontSize: 20, marginRight: 8 }}>{m.emoji}</Text>
                  <Text style={S.cardTitle}>{m.label}</Text>
                </Row>
                <Row>
                  <Text style={{ color: C.green, fontWeight: "700", marginRight: 10 }}>{mealCal} cal</Text>
                  <TouchableOpacity onPress={() => setAddMeal(m.key)}
                    style={{ backgroundColor: C.green, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: C.bg, fontSize: 18, fontWeight: "800", lineHeight: 20 }}>+</Text>
                  </TouchableOpacity>
                </Row>
              </Row>
              {foods.length === 0 && (
                <Text style={{ color: C.greyDim, fontSize: 13, textAlign: "center", paddingVertical: 10 }}>No foods logged yet</Text>
              )}
              {foods.map((food, idx) => (
                <Row key={idx} style={{ justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.cardLight }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: "600" }}>{food.name}</Text>
                    <Text style={{ color: C.grey, fontSize: 11 }}>{food.serving}</Text>
                  </View>
                  <Row>
                    <Text style={{ color: C.amber, fontWeight: "700", marginRight: 12 }}>{food.cal} cal</Text>
                    <TouchableOpacity onPress={() => removeFood(m.key, idx)}>
                      <Text style={{ color: C.red, fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  </Row>
                </Row>
              ))}
            </Card>
          );
        })}
      </ScrollView>

      {/* Sticky footer */}
      {(() => {
        const diaryStatus = getCalorieStatus(totals.caloriesEaten || 0, targets.calories);
        return (
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0,
            backgroundColor: diaryStatus.bgColor,
            borderTopWidth: 1, borderTopColor: diaryStatus.color + "30", padding: 12 }}>
            <Row style={{ justifyContent: "space-between" }}>
              {["Eaten", "Burned", "Net", "Target"].map(l => (
                <Text key={l} style={{ color: "#888", fontSize: 12, flex: 1, textAlign: "center" }}>{l}</Text>
              ))}
            </Row>
            <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
              <Text style={{ color: diaryStatus.color, fontWeight: "700", fontSize: 16, flex: 1, textAlign: "center" }}>
                {totals.caloriesEaten || 0}
              </Text>
              <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 16, flex: 1, textAlign: "center" }}>
                -{totals.caloriesBurned || 0}
              </Text>
              <Text style={{ color: diaryStatus.color, fontWeight: "700", fontSize: 16, flex: 1, textAlign: "center" }}>
                {totals.netCalories || 0}
              </Text>
              <Text style={{ color: "#888", fontWeight: "600", fontSize: 16, flex: 1, textAlign: "center" }}>
                {targets.calories}
              </Text>
            </Row>
            <Text style={{ color: diaryStatus.color, fontSize: 12, textAlign: "center", marginTop: 6, fontStyle: "italic" }}>
              {diaryStatus.message}
            </Text>
          </View>
        );
      })()}

      <AddFoodModal visible={!!addMeal} meal={addMeal || "breakfast"} onClose={() => setAddMeal(null)} />
    </SafeAreaView>
  );
}
