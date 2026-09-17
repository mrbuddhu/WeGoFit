import React, { useState, useContext, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions, Image, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, G, Text as SvgText, Rect, Polyline, Line } from "react-native-svg";
import S from "../lib/styles";
import { ROSE, C, SH, SW } from "../lib/constants";
import { Ctx, useTheme } from "../contexts/AppContext";
import { Card, Row, Spacer } from "../components/shared";
import { getAllWorkoutSessions, filterSessionsByRange, getFavouriteType, calcStreak, calcPersonalBests, calcTrend, getWorkoutTypeColor, getWorkoutEmoji, groupByMonth } from "../utils/workoutProgress";
import { calcTargets, todayKey, lastNDays } from "../utils/calculations";
import { supabase } from "../lib/supabase";

// ─── PROGRESS SCREEN CHART CONSTANTS ─────────────────────────────────────────
const CHART_W      = SW - 32;
const CHART_H      = 200;
const SCREEN_WIDTH  = SW;
const SCREEN_HEIGHT = Dimensions.get("window").height;

// ─── CALENDAR COLOUR SYSTEM ───────────────────────────────────────────────────
const CAL_COLORS = {
  rest:         "#111827",
  light:        "rgba(255,107,53,0.2)",
  moderate:     "rgba(255,107,53,0.4)",
  good:         "rgba(255,107,53,0.7)",
  intense:      "#FF6B35",
  restText:     "rgba(255,255,255,0.5)",
  activeText:   "#FFFFFF",
  todayText:    "#FFFFFF",
  today:        "#FF6B35",
  headerBg:     "#111827",
  headerText:   "#FFFFFF",
  headerAccent: "#FF6B35",
  gridBorder:   "rgba(255,255,255,0.06)",
  weekdayLabel: "rgba(255,255,255,0.5)",
  detailBg:     "#111827",
  detailBorder: "#FF6B35",
  detailHeader: "#111827",
};

function getCalorieBg(cal) {
  if (!cal || cal === 0) return CAL_COLORS.rest;
  if (cal < 150)         return CAL_COLORS.light;
  if (cal < 300)         return CAL_COLORS.moderate;
  if (cal < 450)         return CAL_COLORS.good;
  return                        CAL_COLORS.intense;
}

// ─── RANGE SELECTOR ───────────────────────────────────────────────────────────
export function RangeSelector({ range, onChange, theme }) {
  const options = [
    { key: "week",     label: "Week"      },
    { key: "month",    label: "Month"     },
    { key: "3months",  label: "3 Months"  },
    { key: "calendar", label: "📅 Calendar"},
  ];
  return (
    <View style={{ flexDirection: "row", backgroundColor: theme.cardLight,
      borderRadius: 14, padding: 4, marginBottom: 16 }}>
      {options.map(opt => {
        const isAct = range === opt.key;
        return (
          <TouchableOpacity key={opt.key} onPress={() => onChange(opt.key)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
              backgroundColor: isAct ? theme.card : "transparent",
              shadowColor: isAct ? "#000" : "transparent",
              shadowOpacity: isAct ? 0.08 : 0, shadowRadius: 4, elevation: isAct ? 2 : 0 }}>
            <Text style={{ fontSize: 12, fontWeight: isAct ? "700" : "500",
              color: isAct ? ROSE : theme.textSub }}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── SUMMARY STATS ROW ────────────────────────────────────────────────────────
export function SummaryStatsRow({ sessions, theme }) {
  const totalCal  = sessions.reduce((s, x) => s + (x.caloriesBurned || 0), 0);
  const totalKm   = sessions.reduce((s, x) => s + (x.distance_km || 0), 0);
  const totalMins = sessions.reduce((s, x) => s + (x.durationMin || Math.round((x.duration_sec || 0) / 60)), 0);
  const stats = [
    { label: "Sessions", value: sessions.length,      unit: "",    emoji: "💪", color: "#F43F8E" },
    { label: "Calories",  value: Math.round(totalCal), unit: "cal", emoji: "🔥", color: "#F59E0B" },
    { label: "Distance",  value: totalKm.toFixed(1),   unit: "km",  emoji: "📍", color: "#10B981" },
    { label: "Minutes",   value: totalMins,             unit: "min", emoji: "⏱", color: "#3B82F6" },
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {stats.map(stat => (
        <View key={stat.label} style={{ flex: 1, minWidth: "45%", backgroundColor: theme.card,
          borderRadius: 16, padding: 14, alignItems: "center",
          borderWidth: 1, borderColor: theme.border,
          shadowColor: stat.color, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 22 }}>{stat.emoji}</Text>
          <Text style={{ fontSize: 22, fontWeight: "800", color: stat.color, marginTop: 4 }}>
            {stat.value}<Text style={{ fontSize: 11, color: theme.textSub }}>{stat.unit}</Text>
          </Text>
          <Text style={{ fontSize: 11, color: theme.textSub, marginTop: 2 }}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── MAIN BAR CHART ───────────────────────────────────────────────────────────
// ─── BAR TOOLTIP ─────────────────────────────────────────────────────────────
export function BarTooltip({ bar, x, theme }) {
  if (!bar) return null;
  const totalCal = (bar.sessions || []).reduce((s, x) => s + (x.caloriesBurned || 0), 0);
  const totalKm  = (bar.sessions || []).reduce((s, x) => s + (x.distance_km   || 0), 0);
  const totalMin = (bar.sessions || []).reduce((s, x) => s + (x.durationMin   || Math.round((x.duration_sec || 0) / 60)), 0);
  const left     = Math.max(8, Math.min(x - 90, CHART_W - 200));
  return (
    <View style={{ position: "absolute", top: 0, left: left, width: 185,
      backgroundColor: theme.card, borderRadius: 14, padding: 12,
      borderWidth: 1.5, borderColor: ROSE,
      shadowColor: ROSE, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6, zIndex: 999 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: ROSE, marginBottom: 6 }}>
        📅 {bar.fullDate || bar.label}
      </Text>
      <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 6 }} />
      {(bar.sessions || []).length === 0 ? (
        <Text style={{ fontSize: 12, color: theme.textSub, fontStyle: "italic" }}>Rest day 😴</Text>
      ) : (
        <>
          <Text style={{ fontSize: 12, color: theme.textSub, marginBottom: 3 }}>💪 {bar.sessions.length} session{bar.sessions.length > 1 ? "s" : ""}</Text>
          <Text style={{ fontSize: 12, color: theme.textSub, marginBottom: 3 }}>🔥 {Math.round(totalCal)} cal burned</Text>
          {totalKm > 0 && <Text style={{ fontSize: 12, color: theme.textSub, marginBottom: 3 }}>📍 {totalKm.toFixed(1)}km covered</Text>}
          <Text style={{ fontSize: 12, color: theme.textSub, marginBottom: 6 }}>⏱ {totalMin} minutes total</Text>
          {bar.sessions.map((s, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 2, gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getWorkoutTypeColor(s.name) }} />
              <Text style={{ fontSize: 11, color: theme.text, flex: 1 }}>{s.name} · {s.caloriesBurned || 0}cal</Text>
              {s.integrityScore > 0 && (
                <Text style={{ fontSize: 10, color: s.verified ? "#10B981" : "#F59E0B" }}>
                  {s.verified ? "✅" : "⚠️"}{s.integrityScore}
                </Text>
              )}
            </View>
          ))}
        </>
      )}
      <Text style={{ fontSize: 10, color: theme.textSub, marginTop: 8, textAlign: "center", fontStyle: "italic" }}>
        tap bar again to close
      </Text>
    </View>
  );
}

// ─── MAIN BAR CHART ───────────────────────────────────────────────────────────
export function MainBarChart({ sessions, range, theme }) {
  const [selectedBar, setSelectedBar] = useState(null);

  let bars = [];
  if (range === "week") {
    for (let i = 6; i >= 0; i--) {
      const d   = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().substring(0, 10);
      const day = sessions.filter(s => (s.date || "").substring(0, 10) === key);
      bars.push({
        label:    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()],
        fullDate: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
        date:     key,
        value:    day.reduce((s, x) => s + (x.caloriesBurned || 0), 0),
        count:    day.length,
        isToday:  i === 0,
        sessions: day,
      });
    }
  } else if (range === "month") {
    for (let w = 3; w >= 0; w--) {
      const start = new Date(); start.setDate(start.getDate() - (w + 1) * 7);
      const end   = new Date(); end.setDate(end.getDate() - w * 7);
      const week  = sessions.filter(s => { const d = new Date(s.date); return d >= start && d < end; });
      const startStr = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const endStr   = end.toLocaleDateString("en-GB",   { day: "numeric", month: "short" });
      bars.push({
        label:    startStr.split(" ")[0] + "-" + endStr.split(" ")[0],
        fullDate: startStr + " – " + endStr,
        value:    week.reduce((s, x) => s + (x.caloriesBurned || 0), 0),
        count:    week.length,
        sessions: week,
      });
    }
  } else if (range === "3months") {
    let lastMonth = -1;
    for (let w = 11; w >= 0; w--) {
      const start = new Date(); start.setDate(start.getDate() - (w + 1) * 7);
      const end   = new Date(); end.setDate(end.getDate() - w * 7);
      const week  = sessions.filter(s => { const d = new Date(s.date); return d >= start && d < end; });
      const month = start.getMonth();
      const lbl   = month !== lastMonth ? start.toLocaleDateString("en-GB", { month: "short" }) : "";
      lastMonth   = month;
      bars.push({
        label:    lbl,
        fullDate: "Week of " + start.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        value:    week.reduce((s, x) => s + (x.caloriesBurned || 0), 0),
        count:    week.length,
        sessions: week,
      });
    }
  } else {
    let lastYear = -1;
    const byMonth = groupByMonth(sessions);
    Object.entries(byMonth).sort().forEach(([key, s]) => {
      const d  = new Date(key + "-01");
      const yr = d.getFullYear();
      bars.push({
        label:     d.toLocaleDateString("en-GB", { month: "short" }),
        fullDate:  d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        monthKey:  key,
        showYear:  yr !== lastYear,
        yearLabel: String(yr),
        value:     s.reduce((t, x) => t + (x.caloriesBurned || 0), 0),
        count:     s.length,
        sessions:  s,
      });
      lastYear = yr;
    });
  }

  const chartH = CHART_H;
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  const BAR_W  = Math.max(4, Math.floor((CHART_W - 64) / Math.max(bars.length, 1)) - 4);
  const innerW = CHART_W - 48;

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => setSelectedBar(null)} style={{ marginBottom: 16 }}>
    <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 16,
      borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 16 }}>
        🔥 Calories Burned
      </Text>

      <View style={{ position: "relative" }}>
        <Svg width={innerW} height={chartH}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
            <Line key={i} x1={0} y1={chartH * (1 - pct) - 20} x2={innerW} y2={chartH * (1 - pct) - 20}
              stroke={theme.border} strokeWidth={0.5} strokeDasharray="4 4" />
          ))}
          {bars.map((bar, i) => {
            const barH       = bar.value > 0 ? Math.max(4, (bar.value / maxVal) * (chartH - 40)) : 4;
            const x          = i * (BAR_W + 4) + 2;
            const y          = chartH - barH - 20;
            const isSelected = selectedBar?.index === i;
            const color      = isSelected ? ROSE : bar.isToday ? ROSE : bar.value > 0 ? ROSE + "99" : theme.border;
            return (
              <G key={i} onPress={(e) => { e.stopPropagation?.(); setSelectedBar(isSelected ? null : { ...bar, index: i, x: x + BAR_W / 2 }); }}>
                {isSelected && (
                  <Rect x={i * (BAR_W + 4)} y={0} width={BAR_W + 4} height={chartH - 20}
                    fill={ROSE} opacity={0.06} rx={4} />
                )}
                <Rect x={x} y={y} width={BAR_W} height={barH} rx={4} fill={color} opacity={isSelected ? 1 : 0.85} />
                {isSelected && (
                  <Rect x={x} y={y} width={BAR_W} height={barH} rx={4} fill="none" stroke={ROSE} strokeWidth={2} />
                )}
                {bar.count > 0 && (
                  <Circle cx={x + BAR_W / 2} cy={y - 8} r={4} fill={ROSE} />
                )}
                <SvgText x={x + BAR_W / 2} y={chartH - 4} textAnchor="middle"
                  fontSize={9} fill={isSelected || bar.isToday ? ROSE : theme.textSub}
                  fontWeight={isSelected || bar.isToday ? "700" : "400"}>
                  {bar.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {selectedBar && (
          <BarTooltip bar={selectedBar} x={selectedBar.x} theme={theme} />
        )}
      </View>

      {/* Week view: date numbers below labels */}
      {range === "week" && (
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 4, paddingHorizontal: 2 }}>
          {bars.map((bar, i) => (
            <TouchableOpacity key={i}
              onPress={() => setSelectedBar(selectedBar?.index === i ? null : { ...bar, index: i, x: i * (BAR_W + 4) + BAR_W / 2 + 2 })}
              style={{ flex: 1, alignItems: "center", padding: 4, borderRadius: 8,
                backgroundColor: selectedBar?.index === i ? "#FFF5F7" : "transparent" }}>
              <Text style={{ fontSize: 9, color: bar.isToday ? ROSE : theme.textSub,
                fontWeight: bar.isToday ? "700" : "400", textAlign: "center" }}>
                {new Date(bar.date).getDate()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Month view: best week banner */}
      {range === "month" && (() => {
        const bestBar = [...bars].sort((a, b) => b.value - a.value)[0];
        if (!bestBar || bestBar.value === 0) return null;
        return (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5F7",
            borderRadius: 10, padding: 10, marginTop: 8, gap: 8 }}>
            <Text style={{ fontSize: 18 }}>🏆</Text>
            <Text style={{ fontSize: 12, color: theme.text, flex: 1 }}>
              <Text style={{ fontWeight: "700", color: ROSE }}>Best week: </Text>
              {bestBar.fullDate} — {bestBar.count} session{bestBar.count !== 1 ? "s" : ""}, {Math.round(bestBar.value)} cal
            </Text>
          </View>
        );
      })()}

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 }}>
        {[{ color: ROSE, label: "Calories burned" }, { color: ROSE, label: "• = session logged" }].map(item => (
          <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
            <Text style={{ fontSize: 10, color: theme.textSub }}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
    </TouchableOpacity>
  );
}

// ─── BEST DAY CALLOUT ─────────────────────────────────────────────────────────
export function BestDayCallout({ calByDate, theme }) {
  const entries = Object.entries(calByDate);
  if (!entries.length) return null;
  const [bestDate, bestCal] = entries.sort((a, b) => b[1] - a[1])[0];
  const dateStr = new Date(bestDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5F7",
      borderRadius: 12, padding: 12, marginTop: 12, gap: 10 }}>
      <Text style={{ fontSize: 28 }}>🏆</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: ROSE }}>Your Best Day</Text>
        <Text style={{ fontSize: 12, color: theme.text, marginTop: 2 }}>{dateStr}</Text>
        <Text style={{ fontSize: 12, color: theme.textSub, marginTop: 2 }}>🔥 {Math.round(bestCal)} calories burned</Text>
      </View>
    </View>
  );
}

// ─── FITNESS CALENDAR ─────────────────────────────────────────────────────────

export function CalendarHeader({ monthName, monthStats, onPrev, onNext, isCurrentMonth, onTitlePress }) {
  return (
    <View style={{ backgroundColor: CAL_COLORS.headerBg, borderRadius: 20, padding: 20, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <TouchableOpacity onPress={onPrev}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "600" }}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onTitlePress} style={{ alignItems: "center" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", letterSpacing: -0.5 }}>{monthName}</Text>
          <Text style={{ color: CAL_COLORS.headerAccent, fontSize: 11, marginTop: 2 }}>tap to jump to any month</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} activeOpacity={isCurrentMonth ? 1 : 0.7}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isCurrentMonth ? "transparent" : "#FFFFFF15",
            alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: isCurrentMonth ? "#FFFFFF30" : "#FFFFFF", fontSize: 22, fontWeight: "600" }}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {[
          { label: "Sessions",    value: monthStats.sessions,    emoji: "💪" },
          { label: "Active Days", value: monthStats.activeDays,  emoji: "📅" },
          { label: "Calories",    value: monthStats.calories > 999 ? (monthStats.calories / 1000).toFixed(1) + "k" : monthStats.calories, emoji: "🔥" },
          { label: "Best Day",    value: monthStats.bestDay ? monthStats.bestDayCal + "cal" : "—", emoji: "🏆" },
        ].map(stat => (
          <View key={stat.label} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 16 }}>{stat.emoji}</Text>
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginTop: 4 }}>{stat.value}</Text>
            <Text style={{ color: "#FFFFFF80", fontSize: 10, marginTop: 2 }}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function CalendarGrid({ year, month, sessionMap, bestDayKey, selectedDay, onDayPress, theme }) {
  const today     = new Date();
  const todayKey  = today.toISOString().substring(0, 10);
  const firstDay  = new Date(year, month, 1);
  const lastDay   = new Date(year, month + 1, 0);
  const daysInMo  = lastDay.getDate();
  let startDow    = firstDay.getDay();
  startDow        = startDow === 0 ? 6 : startDow - 1;

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMo; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({
      day: d, dateKey,
      sessions:   sessionMap[dateKey] || [],
      isToday:    dateKey === todayKey,
      isBest:     dateKey === bestDayKey,
      isFuture:   new Date(dateKey + "T12:00:00") > today,
      isSelected: dateKey === selectedDay,
    });
  }

  const CELL = Math.floor((SCREEN_WIDTH - 48) / 7);
  const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 12, marginBottom: 12,
      borderWidth: 1, borderColor: theme.border }}>
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {DAYS.map(day => (
          <View key={day} style={{ width: CELL, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "600",
              color: day === "Sat" || day === "Sun" ? "rgba(255,107,53,0.7)" : CAL_COLORS.weekdayLabel }}>
              {day}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 8 }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell, i) => {
          if (!cell) return <View key={`e${i}`} style={{ width: CELL, height: CELL + 8 }} />;
          const totalCal = cell.sessions.reduce((s, x) => s + (x.caloriesBurned || 0), 0);
          const bgColor  = cell.isFuture ? "transparent" : getCalorieBg(totalCal);
          const emojis   = [...new Set(cell.sessions.map(s => getWorkoutEmoji(s.name)))].slice(0, 2);
          const cellBg = cell.isToday ? "#FF6B35"
            : cell.isSelected ? "#1E2837"
            : cell.sessions.length > 0 ? "#1E2837"
            : cell.isFuture ? "transparent"
            : "#111827";
          return (
            <TouchableOpacity key={cell.dateKey}
              onPress={() => !cell.isFuture && onDayPress(cell.dateKey)}
              activeOpacity={cell.isFuture ? 1 : 0.7}
              style={{ width: CELL, height: CELL + 8, padding: 2 }}>
              <View style={{
                flex: 1, borderRadius: 10, backgroundColor: cellBg,
                alignItems: "center", justifyContent: "center", overflow: "hidden",
                borderWidth: cell.isBest && !cell.isToday ? 1.5 : 0,
                borderColor: cell.isBest ? "#F59E0B" : "transparent",
              }}>
                <Text style={{
                  fontSize: cell.isToday ? 13 : 12,
                  fontWeight: (cell.isToday || cell.isSelected) ? "800" : "500",
                  color: cell.isToday ? "#FFFFFF"
                    : cell.isSelected ? "#FFFFFF"
                    : cell.isFuture ? "rgba(255,255,255,0.2)"
                    : cell.sessions.length > 0 ? "#FFFFFF"
                    : "rgba(255,255,255,0.5)",
                  lineHeight: 16,
                }}>{cell.day}</Text>
                {cell.sessions.length > 0 && !cell.isFuture && !cell.isToday && (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#FF6B35", marginTop: 2 }} />
                )}
                {cell.isBest && (
                  <View style={{ position: "absolute", top: 2, right: 2 }}>
                    <Text style={{ fontSize: 8 }}>👑</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function DayDetailPanel({ dateKey, sessions, onClose, theme }) {
  const d       = new Date(dateKey + "T12:00:00");
  const dateStr = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const totalCal  = sessions.reduce((s, x) => s + (x.caloriesBurned || 0), 0);
  const totalKm   = sessions.reduce((s, x) => s + (x.distance_km || 0), 0);
  const totalMins = sessions.reduce((s, x) => s + (x.durationMin || Math.round((x.duration_sec || 0) / 60)), 0);
  const isRest    = sessions.length === 0;

  return (
    <View style={{ backgroundColor: "#111827", borderRadius: 20, marginBottom: 12,
      borderWidth: 1, borderColor: isRest ? "rgba(255,255,255,0.08)" : "#FF6B35", overflow: "hidden",
      shadowColor: "#FF6B35", shadowOpacity: isRest ? 0 : 0.15, shadowRadius: 12, elevation: isRest ? 0 : 4 }}>
      <View style={{ backgroundColor: "#111827",
        padding: 16, flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFFFFF", marginBottom: 2 }}>
            📅 {dateStr}
          </Text>
          {!isRest && (
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              {sessions.length} session{sessions.length > 1 ? "s" : ""} · {Math.round(totalCal)} cal
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onClose}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)",
            alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 18, lineHeight: 20, fontWeight: "600" }}>×</Text>
        </TouchableOpacity>
      </View>

      {isRest ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ fontSize: 36 }}>😴</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF", marginTop: 8 }}>Rest Day</Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4, textAlign: "center", lineHeight: 18 }}>
            Recovery is part of training.{"\n"}Your body is rebuilding stronger! 💪
          </Text>
        </View>
      ) : (
        <View style={{ padding: 16 }}>
          {sessions.length > 1 && (
            <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: "#1E2837",
              borderRadius: 12, padding: 12, marginBottom: 12 }}>
              {[
                { emoji: "🔥", val: Math.round(totalCal), unit: "cal" },
                { emoji: "📍", val: totalKm > 0 ? totalKm.toFixed(1) : "—", unit: totalKm > 0 ? "km" : "" },
                { emoji: "⏱", val: totalMins, unit: "min" },
              ].map((s, i) => (
                <View key={i} style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#FF6B35", marginTop: 2 }}>
                    {s.val}<Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{s.unit}</Text>
                  </Text>
                </View>
              ))}
            </View>
          )}
          {sessions.map((s, i) => {
            const score     = s.integrityScore || 0;
            const statChips = [
              s.durationMin > 0 ? { icon: "⏱", label: s.durationMin + " min" } : null,
              (s.distance_km || 0) > 0 ? { icon: "📍", label: Number(s.distance_km).toFixed(1) + " km" } : null,
              (s.avgSpeed || 0) > 0 ? { icon: "⚡", label: Number(s.avgSpeed).toFixed(1) + " km/h" } : null,
              (s.stepCount || 0) > 0 ? { icon: "👟", label: Number(s.stepCount).toLocaleString() + " steps" } : null,
            ].filter(Boolean);
            return (
              <View key={i} style={{ borderRadius: 14, backgroundColor: "#1E2837",
                padding: 14,
                marginBottom: i < sessions.length - 1 ? 10 : 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: statChips.length > 0 ? 10 : 0 }}>
                  <Text style={{ fontSize: 24, marginRight: 8 }}>{getWorkoutEmoji(s.name)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>{s.name || "Workout"}</Text>
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
                      {s.verified ? "✅ Verified" : "⚠️ Unverified"}{score > 0 ? ` · ${score}/100` : ""}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: "rgba(255,107,53,0.2)", borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#FF6B35" }}>🔥 {s.caloriesBurned || 0}</Text>
                    <Text style={{ fontSize: 9, color: "#FF6B35", textAlign: "center" }}>cal</Text>
                  </View>
                </View>
                {statChips.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {statChips.map((chip, si) => (
                      <View key={si} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)",
                        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, gap: 4 }}>
                        <Text style={{ fontSize: 12 }}>{chip.icon}</Text>
                        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>{chip.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function IntensityLegend({ theme }) {
  const levels = [
    { color: CAL_COLORS.rest,     label: "Rest"    },
    { color: CAL_COLORS.light,    label: "<150"    },
    { color: CAL_COLORS.moderate, label: "150-300" },
    { color: CAL_COLORS.good,     label: "300-450" },
    { color: CAL_COLORS.intense,  label: "450+"    },
  ];
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 12, marginBottom: 12,
      borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textSub, marginBottom: 8,
        textAlign: "center", letterSpacing: 0.5, textTransform: "uppercase" }}>
        Intensity Guide (calories)
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "center" }}>
        {levels.map((level, i) => (
          <View key={i} style={{ alignItems: "center" }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: level.color,
              borderWidth: 1, borderColor: i === 0 ? theme.border : level.color, marginBottom: 4,
              shadowColor: i > 2 ? "#E8175D" : "transparent",
              shadowOpacity: i > 2 ? 0.25 : 0, shadowRadius: 4, elevation: i > 2 ? 2 : 0 }} />
            <Text style={{ fontSize: 9, color: theme.textSub, textAlign: "center", fontWeight: "500" }}>
              {level.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function MonthPickerModal({ currentYear, currentMonth, allSessions, onSelect, onClose, theme }) {
  const today   = new Date();
  const minYear = allSessions.length > 0 ? parseInt(allSessions[0].date.substring(0, 4)) : today.getFullYear();
  const months  = [];
  for (let y = minYear; y <= today.getFullYear(); y++) {
    const maxM = y === today.getFullYear() ? today.getMonth() : 11;
    for (let m = 0; m <= maxM; m++) {
      const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
      months.push({ year: y, month: m, count: allSessions.filter(s => s.date.startsWith(prefix)).length });
    }
  }
  months.reverse();
  const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <Modal visible={true} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={{ backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: SCREEN_HEIGHT * 0.6 }}>
            <View style={{ width: 40, height: 4, backgroundColor: theme.border, borderRadius: 2,
              alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text,
              paddingHorizontal: 20, marginBottom: 16 }}>Jump to Month</Text>
            <ScrollView style={{ paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}>
              {months.map((m, i) => {
                const isActive = m.year === currentYear && m.month === currentMonth;
                return (
                  <TouchableOpacity key={i} onPress={() => onSelect(m.year, m.month)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14,
                      paddingHorizontal: 16, borderRadius: 14, marginBottom: 4,
                      backgroundColor: isActive ? CAL_COLORS.headerBg : theme.cardLight }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: isActive ? "#FFFFFF" : theme.text }}>
                        {MN[m.month]} {m.year}
                      </Text>
                      {m.count > 0 && (
                        <Text style={{ fontSize: 12, color: isActive ? "#FFFFFF80" : theme.textSub, marginTop: 2 }}>
                          {m.count} session{m.count > 1 ? "s" : ""}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", gap: 3 }}>
                      {[...Array(Math.min(m.count, 5))].map((_, di) => (
                        <View key={di} style={{ width: 6, height: 6, borderRadius: 3,
                          backgroundColor: isActive ? "#FFFFFF" : "#E8175D",
                          opacity: isActive ? 0.8 : 0.4 + di * 0.12 }} />
                      ))}
                    </View>
                    {isActive && <Text style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 8 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function FitnessCalendar({ allSessions, theme }) {
  const today   = new Date();
  const [viewYear,         setViewYear]         = useState(today.getFullYear());
  const [viewMonth,        setViewMonth]        = useState(today.getMonth());
  const [selectedDay,      setSelectedDay]      = useState(null);
  const [showMonthPicker,  setShowMonthPicker]  = useState(false);

  const sessionMap = React.useMemo(() => {
    const map = {};
    allSessions.forEach(s => {
      const key = (s.date || "").substring(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [allSessions]);

  const bestDayKey = React.useMemo(() => {
    let best = null, bestCal = 0;
    Object.entries(sessionMap).forEach(([key, ss]) => {
      const cal = ss.reduce((t, x) => t + (x.caloriesBurned || 0), 0);
      if (cal > bestCal) { bestCal = cal; best = key; }
    });
    return best;
  }, [sessionMap]);

  const monthStats = React.useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    const ms     = allSessions.filter(s => s.date.startsWith(prefix));
    const byDay  = {};
    ms.forEach(s => { const k = s.date.substring(0, 10); byDay[k] = (byDay[k] || 0) + (s.caloriesBurned || 0); });
    let bestDay = null, bestDayCal = 0;
    Object.entries(byDay).forEach(([k, c]) => { if (c > bestDayCal) { bestDayCal = c; bestDay = k; } });
    return { sessions: ms.length, calories: Math.round(ms.reduce((t, x) => t + (x.caloriesBurned || 0), 0)),
      activeDays: Object.keys(byDay).length, bestDay, bestDayCal: Math.round(bestDayCal) };
  }, [allSessions, viewYear, viewMonth]);

  function prevMonth() {
    setSelectedDay(null);
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    setSelectedDay(null);
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const prefix       = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const monthIsEmpty = !allSessions.some(s => s.date.startsWith(prefix));

  return (
    <View>
      <CalendarHeader monthName={monthName} monthStats={monthStats} onPrev={prevMonth} onNext={nextMonth}
        isCurrentMonth={isCurrentMonth} onTitlePress={() => setShowMonthPicker(true)} />
      <CalendarGrid year={viewYear} month={viewMonth} sessionMap={sessionMap} bestDayKey={bestDayKey}
        selectedDay={selectedDay} onDayPress={day => setSelectedDay(selectedDay === day ? null : day)} theme={theme} />
      {selectedDay && (
        <DayDetailPanel dateKey={selectedDay} sessions={sessionMap[selectedDay] || []}
          onClose={() => setSelectedDay(null)} theme={theme} />
      )}
      {monthIsEmpty && (
        <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 32, marginBottom: 12,
          borderWidth: 1, borderColor: theme.border, alignItems: "center" }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🏃</Text>
          <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text, textAlign: "center", marginBottom: 8 }}>
            No workouts in {new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", { month: "long" })} yet
          </Text>
          <Text style={{ fontSize: 14, color: theme.textSub, textAlign: "center", lineHeight: 20, marginBottom: 20 }}>
            Complete a workout in the Train tab and it will appear here automatically!
          </Text>
        </View>
      )}
      {!monthIsEmpty && <IntensityLegend theme={theme} />}
      {showMonthPicker && (
        <MonthPickerModal currentYear={viewYear} currentMonth={viewMonth} allSessions={allSessions}
          onSelect={(y, m) => { setViewYear(y); setViewMonth(m); setSelectedDay(null); setShowMonthPicker(false); }}
          onClose={() => setShowMonthPicker(false)} theme={theme} />
      )}
    </View>
  );
}


// ─── TREND CARD ───────────────────────────────────────────────────────────────
export function TrendCard({ trend, sessions, theme }) {
  const configs = {
    improving:        { emoji: "📈", label: "Improving!",          message: "Your training is getting stronger — keep it up! 🔥", color: "#10B981", bgColor: "#ECFDF5" },
    maintaining:      { emoji: "➡️", label: "Maintaining",         message: "Consistent training — ready to push harder? 💪",     color: "#F59E0B", bgColor: "#FFFBEB" },
    declining:        { emoji: "📉", label: "Needs Attention",      message: "Your workouts have dipped — let's get back on track! 🏃", color: "#F43F8E", bgColor: "#FFF5F7" },
    not_enough_data:  { emoji: "🌱", label: "Just Getting Started", message: "Log more workouts to see your trend develop! 💪",    color: "#3B82F6", bgColor: "#EFF6FF" },
  };
  const c = configs[trend] || configs.not_enough_data;
  const consistency = sessions.length > 0
    ? Math.round((sessions.filter(s => s.verified).length / sessions.length) * 100)
    : 0;
  return (
    <View style={{ backgroundColor: c.bgColor, borderRadius: 16, padding: 16, marginBottom: 16,
      borderLeftWidth: 4, borderLeftColor: c.color, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ fontSize: 32 }}>{c.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: c.color, marginBottom: 2 }}>{c.label}</Text>
        <Text style={{ fontSize: 12, color: c.color + "CC", lineHeight: 18 }}>{c.message}</Text>
        <Text style={{ fontSize: 11, color: c.color, marginTop: 6, fontWeight: "600" }}>
          ✅ {consistency}% verified sessions
        </Text>
      </View>
    </View>
  );
}

// ─── WORKOUT TYPE BREAKDOWN ───────────────────────────────────────────────────
export function WorkoutTypeBreakdown({ sessions, theme }) {
  const typeCounts = {};
  sessions.forEach(s => { const t = s.name || "Other"; typeCounts[t] = (typeCounts[t] || 0) + 1; });
  const total = sessions.length || 1;
  const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 16, marginBottom: 16,
      borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 16 }}>
        📊 Workout Breakdown
      </Text>
      {types.map(([type, count]) => {
        const pct   = count / total;
        const color = getWorkoutTypeColor(type);
        return (
          <View key={type} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>{type}</Text>
              <Text style={{ fontSize: 12, color: theme.textSub }}>
                {count} session{count !== 1 ? "s" : ""} · {Math.round(pct * 100)}%
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: theme.cardLight, borderRadius: 4 }}>
              <View style={{ height: 8, width: `${Math.round(pct * 100)}%`, backgroundColor: color, borderRadius: 4 }} />
            </View>
          </View>
        );
      })}
      {types.length === 0 && (
        <Text style={{ color: theme.textSub, textAlign: "center", padding: 16 }}>
          No workouts yet in this period
        </Text>
      )}
    </View>
  );
}

// ─── PERSONAL BESTS ───────────────────────────────────────────────────────────
export function PersonalBests({ bests, theme }) {
  const cards = [
    { emoji: "🏃", label: "Longest Run",     value: bests.longestDistance.toFixed(1) + "km", color: "#F43F8E" },
    { emoji: "⚡", label: "Fastest Speed",   value: bests.fastestSpeed.toFixed(1) + "km/h",  color: "#F59E0B" },
    { emoji: "🔥", label: "Most Calories",   value: Math.round(bests.mostCalories) + "cal",  color: "#EF4444" },
    { emoji: "⏱", label: "Longest Session", value: bests.longestDuration + "min",            color: "#3B82F6" },
    { emoji: "📅", label: "Best Streak",     value: bests.longestStreak + " days",            color: "#FB923C" },
    { emoji: "🏅", label: "Best Integrity",  value: bests.bestIntegrity + "/100",             color: "#10B981" },
  ];
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 16, marginBottom: 16,
      borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 16 }}>
        🏆 Personal Bests
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {cards.map(card => (
          <View key={card.label} style={{ width: "30%", backgroundColor: card.color + "15",
            borderRadius: 14, padding: 12, alignItems: "center",
            borderWidth: 1, borderColor: card.color + "30" }}>
            <Text style={{ fontSize: 20 }}>{card.emoji}</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: card.color, marginTop: 4, textAlign: "center" }}>
              {card.value}
            </Text>
            <Text style={{ fontSize: 10, color: theme.textSub, marginTop: 2, textAlign: "center" }}>
              {card.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 16, padding: 12, backgroundColor: theme.cardLight, borderRadius: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text, marginBottom: 10 }}>
          📈 Lifetime Totals
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {[
            { label: "Sessions", value: bests.totalSessions },
            { label: "Distance", value: bests.totalDistance.toFixed(0) + "km" },
            { label: "Calories", value: Math.round(bests.totalCalories).toLocaleString() },
            { label: "Minutes",  value: bests.totalMinutes },
          ].map(item => (
            <View key={item.label} style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: ROSE }}>{item.value}</Text>
              <Text style={{ fontSize: 10, color: theme.textSub, marginTop: 2 }}>{item.label}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 12, color: theme.textSub, marginTop: 12, textAlign: "center" }}>
          ❤️ Favourite: {bests.favouriteType}
        </Text>
      </View>
    </View>
  );
}

// ─── SESSION DETAIL SCREEN ───────────────────────────────────────────────────
export function SessionDetailScreen({ session, onBack, theme }) {
  const durationMin = session.durationMin || Math.round((session.duration_sec || 0) / 60);
  const distKm      = session.distance_km ? Number(session.distance_km).toFixed(2) : null;
  const avgSpeed    = session.avgSpeed ? Number(session.avgSpeed).toFixed(1) : null;
  const maxSpeed    = session.maxSpeed ? Number(session.maxSpeed).toFixed(1) : null;
  const steps       = session.stepCount || 0;
  const score       = session.integrityScore || 0;
  const scoreColor  = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
  const positions   = session.positions || [];
  const hasGPS      = positions.length >= 2;

  const avgSpeedKmh = avgSpeed ? parseFloat(avgSpeed) : 0;
  const paceMinsPerKm = avgSpeedKmh > 0
    ? `${Math.floor(60 / avgSpeedKmh)}:${String(Math.round((60 / avgSpeedKmh % 1) * 60)).padStart(2, "0")}`
    : null;

  const dateStr = new Date(session.date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const statsCards = [
    { icon: "⏱", label: "Duration", value: durationMin, unit: "min" },
    { icon: "📍", label: "Distance", value: distKm || "—", unit: distKm ? "km" : "" },
    { icon: "🔥", label: "Calories", value: session.caloriesBurned || 0, unit: "cal" },
    { icon: "👟", label: "Steps",    value: steps > 0 ? steps.toLocaleString() : "—", unit: steps > 0 ? "steps" : "" },
  ];

  const W = SW - 32;
  const MAP_H = 200;
  const PAD = 20;

  function renderMap() {
    if (!hasGPS) {
      return (
        <View style={{ height: 120, backgroundColor: "#111827", borderRadius: 14,
          alignItems: "center", justifyContent: "center", marginTop: 8 }}>
          <Text style={{ fontSize: 28, marginBottom: 6 }}>🏠</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Indoor workout — no map available</Text>
        </View>
      );
    }
    const lats = positions.map(p => p.lat);
    const lngs = positions.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latSpan = maxLat - minLat || 0.0001;
    const lngSpan = maxLng - minLng || 0.0001;
    const scaleX = (W - PAD * 2) / lngSpan;
    const scaleY = (MAP_H - PAD * 2) / latSpan;
    const scale  = Math.min(scaleX, scaleY);
    const toX = lng => PAD + (W - PAD * 2 - lngSpan * scale) / 2 + (lng - minLng) * scale;
    const toY = lat => PAD + (MAP_H - PAD * 2 - latSpan * scale) / 2 + (maxLat - lat) * scale;
    const pts = positions.map(p => `${toX(p.lng)},${toY(p.lat)}`).join(" ");
    const first = positions[0], last = positions[positions.length - 1];
    return (
      <View style={{ borderRadius: 14, overflow: "hidden", backgroundColor: "#111827", marginTop: 8 }}>
        <Svg width={W} height={MAP_H}>
          <Rect width={W} height={MAP_H} fill="#111827" />
          <Polyline points={pts} fill="none" stroke="#FF6B35" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={toX(first.lng)} cy={toY(first.lat)} r={7} fill="#FFFFFF" />
          <SvgText x={toX(first.lng)} y={toY(first.lat) + 4} textAnchor="middle" fill="#070B14" fontSize={7} fontWeight="bold">S</SvgText>
          <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={8} fill="#FF6B35" opacity={0.3} />
          <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={5} fill="#FF6B35" />
          <SvgText x={toX(last.lng)} y={toY(last.lat) + 4} textAnchor="middle" fill="#FFFFFF" fontSize={7} fontWeight="bold">E</SvgText>
        </Svg>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#070B14" }}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}>
      {/* Back button + header */}
      <SafeAreaView>
        <TouchableOpacity onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <Text style={{ color: "#FF6B35", fontSize: 16, fontWeight: "700" }}>‹ Back</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        {/* Header card */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "#FF6B35" }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 28 }}>{getWorkoutEmoji(session.name)}</Text>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#FFFFFF", flex: 1 }} numberOfLines={2}>
                  {session.name || "Workout"}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{dateStr}</Text>
            </View>
            {score > 0 && (
              <View style={{ backgroundColor: "#FF6B35" + "20", borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#FF6B35" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF6B35" }}>⚡{score}</Text>
                <Text style={{ fontSize: 9, color: "#FF6B35", textAlign: "center" }}>score</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats grid 2x2 */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {statsCards.map((card, i) => (
            <View key={i} style={{ width: (SW - 42) / 2, backgroundColor: "#111827",
              borderRadius: 14, padding: 14, alignItems: "center" }}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>{card.icon}</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#FF6B35" }}>
                {card.value}
                <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.5)" }}>
                  {card.unit ? " " + card.unit : ""}
                </Text>
              </Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* Map section */}
        <View style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 }}>📍 Route Map</Text>
          {renderMap()}
        </View>

        {/* Performance */}
        {(avgSpeed || maxSpeed || paceMinsPerKm) && (
          <View style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 }}>⚡ Performance</Text>
            {[
              avgSpeed     ? { label: "Avg Speed",  value: avgSpeed + " km/h" }    : null,
              maxSpeed     ? { label: "Max Speed",  value: maxSpeed + " km/h" }    : null,
              paceMinsPerKm ? { label: "Avg Pace",  value: paceMinsPerKm + " /km" } : null,
            ].filter(Boolean).map((row, i, arr) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between",
                paddingVertical: 8, borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{row.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Integrity score */}
        {score > 0 && (
          <View style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 }}>🏅 Workout Integrity Score</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30,
                backgroundColor: scoreColor + "20", borderWidth: 2, borderColor: scoreColor,
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: scoreColor }}>{score}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: scoreColor }}>
                  {score >= 80 ? "Excellent!" : score >= 60 ? "Good effort!" : "Keep improving!"}
                </Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                  {session.verified ? "✅ Verified session" : "⚠️ Unverified session"}
                </Text>
              </View>
            </View>
            <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
              <View style={{ height: 8, borderRadius: 4, width: `${score}%`, backgroundColor: scoreColor }} />
            </View>
          </View>
        )}

        {/* Coach TinaBarks note */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 12, padding: 14,
          borderLeftWidth: 3, borderLeftColor: "#FF6B35", marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF6B35", marginBottom: 4 }}>
            Coach TinaBarks 🌸
          </Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 18 }}>
            Great job completing this session! Keep the consistency going! 💪
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── RECENT SESSIONS LIST ─────────────────────────────────────────────────────
export function RecentSessionsList({ sessions, theme, onSelectSession }) {
  const recent = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 16, marginBottom: 16,
      borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 12 }}>
        📋 Recent Sessions
      </Text>
      {recent.map((s, i) => {
        const color      = getWorkoutTypeColor(s.name);
        const score      = s.integrityScore || 0;
        const scoreColor = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
        return (
          <TouchableOpacity key={i} onPress={() => onSelectSession(s)} activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12,
              borderBottomWidth: i < recent.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color + "20",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18 }}>{getWorkoutEmoji(s.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text }}>
                {s.name || "Workout"}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textSub, marginTop: 2 }}>
                {new Date(s.date).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}
                {" · "}{s.durationMin || Math.round((s.duration_sec || 0) / 60)}min
                {" · "}{s.caloriesBurned || 0}cal
                {s.distance_km ? ` · ${Number(s.distance_km).toFixed(1)}km` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {score > 0 && (
                <View style={{ backgroundColor: scoreColor + "20", borderRadius: 10,
                  paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: scoreColor + "40" }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: scoreColor }}>
                    {s.verified ? "✅" : "⚠️"}{score}
                  </Text>
                </View>
              )}
              <Text style={{ color: theme.textSub, fontSize: 16 }}>›</Text>
            </View>
          </TouchableOpacity>
        );
      })}
      {recent.length === 0 && (
        <Text style={{ color: theme.textSub, textAlign: "center", padding: 20, fontSize: 14 }}>
          No sessions in this period yet
        </Text>
      )}
    </View>
  );
}

// ─── LOADING / EMPTY STATES ───────────────────────────────────────────────────
export function ProgressLoadingState({ theme }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: 60 }}>
      <ActivityIndicator size="large" color={ROSE} />
      <Text style={{ color: theme.textSub, marginTop: 12, fontSize: 14 }}>Loading your progress...</Text>
    </View>
  );
}

export function ProgressEmptyState({ range, theme }) {
  const msg = { week: "No workouts this week yet", month: "No workouts this month yet",
    "3months": "No workouts in 3 months yet", calendar: "No workouts logged yet" };
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: 40,
      backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 48 }}>🏃</Text>
      <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text, marginTop: 12, textAlign: "center" }}>
        {msg[range] || "No workouts yet"}
      </Text>
      <Text style={{ fontSize: 14, color: theme.textSub, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
        Complete your first workout in the Workout tab and your progress will appear here! 💪
      </Text>
    </View>
  );
}

// ─── WORKOUT PROGRESS SCREEN ──────────────────────────────────────────────────
export function WorkoutProgressScreen() {
  const { profile, storageClientId } = useContext(Ctx);
  const { theme }    = useTheme();
  const [range,       setRange]       = useState("week");
  const [sessions,    setSessions]    = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [bests,       setBests]       = useState(null);
  const [detailSession, setDetailSession] = useState(null);

  // Must match GoFitProvider's pfx: clientId is the Supabase session userId
  // used as the storage namespace when keys are written as gf_log_${clientId}_${date}
  const userId = storageClientId || profile?.id || profile?.email || "default";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const all      = await getAllWorkoutSessions(userId);
      const filtered = range === "calendar" ? all : filterSessionsByRange(all, range);
      if (!cancelled) {
        setAllSessions(all);
        setSessions(filtered);
        setBests(calcPersonalBests(all));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, userId]);

  const trend = calcTrend(sessions);

  if (detailSession) {
    return (
      <SessionDetailScreen
        session={detailSession}
        onBack={() => setDetailSession(null)}
        theme={theme}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 4 }}>
        My Training Progress 📊
      </Text>
      <Text style={{ fontSize: 13, color: theme.textSub, marginBottom: 16 }}>
        Your fitness journey at a glance
      </Text>

      <RangeSelector range={range} onChange={setRange} theme={theme} />

      {loading ? (
        <ProgressLoadingState theme={theme} />
      ) : range === "calendar" ? (
        <FitnessCalendar allSessions={allSessions} theme={theme} />
      ) : sessions.length === 0 ? (
        <ProgressEmptyState range={range} theme={theme} />
      ) : (
        <>
          <SummaryStatsRow sessions={sessions} theme={theme} />
          <MainBarChart sessions={sessions} range={range} theme={theme} />
          <TrendCard trend={trend} sessions={sessions} theme={theme} />
          <WorkoutTypeBreakdown sessions={sessions} theme={theme} />
          {bests && <PersonalBests bests={bests} theme={theme} />}
          <RecentSessionsList sessions={sessions} theme={theme} onSelectSession={setDetailSession} />
        </>
      )}
    </ScrollView>
  );
}
