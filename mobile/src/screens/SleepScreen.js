import React, { useState, useContext, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Platform, Image, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import S from "../lib/styles";
import { ROSE, C, SH } from "../lib/constants";
import { Ctx, useTheme } from "../contexts/AppContext";
import { SLEEP_GOAL, parseSleepTime, calcSleepDuration, sleepQuality, sleepQualityEmoji, fmtSleepDur, fmt12h, sleepBarColor } from "../utils/sleep";
import { Card, PrimaryBtn, Row, Spacer } from "../components/shared";
import { SLEEP_TIPS } from "../data/community";
import { EXERCISES, EXERCISE_CATEGORIES, VIDEO_LIBRARY, VIDEO_CAT_META } from "../data/exercises";

// ─── SLEEP SCREEN ─────────────────────────────────────────────────────────────

// Inline time input component — simple HH:MM text field with helpers
// ─── NATIVE TIME PICKER ───────────────────────────────────────────────────────
const ITEM_H = 52;
const VISIBLE = 5; // rows visible in the wheel

function WheelColumn({ items, selectedIndex, onSelect, width = 80 }) {
  const scrollRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Scroll to selected on mount and when selectedIndex changes
  useEffect(() => {
    if (scrollRef.current && ready) {
      scrollRef.current.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }
  }, [selectedIndex, ready]);

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: "hidden" }}>
      {/* Selection highlight bar */}
      <View pointerEvents="none" style={{
        position: "absolute", top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H,
        borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: ROSE,
        backgroundColor: "rgba(244,63,142,0.06)", zIndex: 2,
      }} />
      {/* Fade top */}
      <View pointerEvents="none" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H * 1.5,
        zIndex: 1,
        backgroundColor: "transparent",
      }} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onLayout={() => {
          setReady(true);
          setTimeout(() => {
            scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
          }, 0);
        }}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          onSelect(Math.max(0, Math.min(idx, items.length - 1)));
        }}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        style={{ flex: 1 }}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              onSelect(i);
              scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true });
            }}
            style={{ height: ITEM_H, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{
              fontSize: 22, fontWeight: i === selectedIndex ? "800" : "400",
              color: i === selectedIndex ? ROSE : "#888",
              opacity: Math.abs(i - selectedIndex) > 2 ? 0.3 : 1,
            }}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const HOURS_12   = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i).padStart(2, "0"));
const MINUTES_30 = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const AMPM       = ["AM", "PM"];

function parse24ToWheel(hhmm) {
  const [hStr, mStr] = (hhmm || "00:00").split(":");
  let h = parseInt(hStr, 10) || 0;
  let m = parseInt(mStr, 10) || 0;
  const ampm = h < 12 ? 0 : 1; // 0=AM, 1=PM
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const hIdx = HOURS_12.indexOf(String(h12).padStart(2, "0"));
  // Find closest minute bucket
  const mIdx = MINUTES_30.reduce((best, val, i) =>
    Math.abs(parseInt(val) - m) < Math.abs(parseInt(MINUTES_30[best]) - m) ? i : best, 0);
  return { hIdx: Math.max(0, hIdx), mIdx, ampm };
}

function wheelTo24(hIdx, mIdx, ampm) {
  let h = parseInt(HOURS_12[hIdx], 10);
  if (ampm === 0 && h === 12) h = 0;
  if (ampm === 1 && h !== 12) h += 12;
  const m = parseInt(MINUTES_30[mIdx], 10);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function TimePickerModal({ visible, value, label, onConfirm, onClose }) {
  const parsed = parse24ToWheel(value);
  const [hIdx,  setHIdx]  = useState(parsed.hIdx);
  const [mIdx,  setMIdx]  = useState(parsed.mIdx);
  const [ampm,  setAmpm]  = useState(parsed.ampm);

  // Sync when modal opens
  useEffect(() => {
    if (visible) {
      const p = parse24ToWheel(value);
      setHIdx(p.hIdx); setMIdx(p.mIdx); setAmpm(p.ampm);
    }
  }, [visible]);

  function handleConfirm() {
    onConfirm(wheelTo24(hIdx, mIdx, ampm));
    onClose();
  }

  const preview = fmt12h(wheelTo24(hIdx, mIdx, ampm));

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
          <TouchableWithoutFeedback>
            <View style={{
              backgroundColor: "#111827", borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingBottom: 36, paddingTop: 6,
            }}>
              {/* Drag handle */}
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)",
                alignSelf: "center", marginBottom: 12 }} />

              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingHorizontal: 24, marginBottom: 8 }}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#FFFFFF" }}>{label}</Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={{ fontSize: 15, color: ROSE, fontWeight: "800" }}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Preview */}
              <Text style={{ textAlign: "center", fontSize: 28, fontWeight: "800", color: ROSE, marginBottom: 4 }}>
                {preview}
              </Text>

              {/* Wheels */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center",
                paddingHorizontal: 16, gap: 4 }}>
                <WheelColumn items={HOURS_12}   selectedIndex={hIdx}  onSelect={setHIdx}  width={72} />
                <Text style={{ fontSize: 26, fontWeight: "800", color: "rgba(255,255,255,0.3)", marginBottom: 0 }}>:</Text>
                <WheelColumn items={MINUTES_30} selectedIndex={mIdx}  onSelect={setMIdx}  width={72} />
                <WheelColumn items={AMPM}       selectedIndex={ampm}  onSelect={setAmpm}  width={64} />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function TimeInput({ label, icon, value, onChange }) {
  const [open, setOpen] = useState(false);
  const display = fmt12h(value);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
        {icon}  {label}
      </Text>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        style={{
          backgroundColor: "#1E2837", borderRadius: 12, padding: 14,
          borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)",
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
        <Text style={{ fontSize: 22 }}>🕐</Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 }}>
          {display}
        </Text>
      </TouchableOpacity>
      <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "center", marginTop: 4 }}>
        tap to change
      </Text>
      <TimePickerModal
        visible={open}
        value={value}
        label={label}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function LogSleepModal({ visible, existing, onClose }) {
  const { logSleep } = useContext(Ctx);
  const [bedTime,  setBedTime]  = useState(existing?.bedTime  || "22:00");
  const [wakeTime, setWakeTime] = useState(existing?.wakeTime || "06:00");
  const [quality,  setQuality]  = useState(existing?.quality  || "good");
  const [notes,    setNotes]    = useState(existing?.notes    || "");
  const [overrideQ, setOverrideQ] = useState(false);

  const duration = calcSleepDuration(bedTime, wakeTime);
  const autoQ    = sleepQuality(duration);

  // Auto-set quality unless user overrode
  useEffect(() => {
    if (!overrideQ) setQuality(autoQ);
  }, [autoQ, overrideQ]);

  // Reset when modal opens — existing is intentionally excluded to avoid re-running mid-session
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (visible) {
      setBedTime(existing?.bedTime   || "22:00");
      setWakeTime(existing?.wakeTime || "06:00");
      setQuality(existing?.quality   || "good");
      setNotes(existing?.notes       || "");
      setOverrideQ(false);
    }
  }, [visible]);

  function handleSave() {
    if (duration <= 0 || duration > 24) {
      Alert.alert("Check times", "Please enter valid bed and wake times."); return;
    }
    logSleep({ bedTime, wakeTime, duration, quality, notes });
    onClose();
  }

  const QUALITIES = [
    { id: "poor",  label: "Poor",  emoji: "😴" },
    { id: "fair",  label: "Fair",  emoji: "😐" },
    { id: "good",  label: "Good",  emoji: "😊" },
    { id: "great", label: "Great", emoji: "🌟" },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 28, borderTopRightRadius: 28,
                padding: 24, paddingBottom: 36, maxHeight: SH * 0.9 }}>
                {/* Drag handle */}
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)",
                  alignSelf: "center", marginBottom: 20 }} />

                <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800" }}>Log Your Sleep 🌙</Text>
                  <TouchableOpacity onPress={onClose}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 22 }}>✕</Text>
                  </TouchableOpacity>
                </Row>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <TimeInput label="What time did you go to bed?"  icon="🌙" value={bedTime}  onChange={setBedTime}  />
                  <TimeInput label="What time did you wake up?"    icon="☀️" value={wakeTime} onChange={setWakeTime} />

                  {/* Live duration */}
                  <View style={{ backgroundColor: "rgba(255,107,53,0.12)", borderRadius: 12, padding: 14,
                    alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: "rgba(255,107,53,0.25)" }}>
                    <Text style={{ color: ROSE, fontSize: 28, fontWeight: "800" }}>
                      💤 {duration > 0 ? fmtSleepDur(duration) : "--"}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>Duration</Text>
                  </View>

                  {/* Quality selector */}
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600", marginBottom: 10 }}>
                    How do you feel?
                  </Text>
                  <Row style={{ gap: 8, marginBottom: 20 }}>
                    {QUALITIES.map(q => (
                      <TouchableOpacity key={q.id} onPress={() => { setQuality(q.id); setOverrideQ(true); }}
                        style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12,
                          backgroundColor: quality === q.id ? "rgba(255,107,53,0.15)" : "#1E2837",
                          borderWidth: 1.5, borderColor: quality === q.id ? ROSE : "rgba(255,255,255,0.1)" }}>
                        <Text style={{ fontSize: 20 }}>{q.emoji}</Text>
                        <Text style={{ color: quality === q.id ? ROSE : "rgba(255,255,255,0.45)", fontSize: 11,
                          fontWeight: "700", marginTop: 3 }}>{q.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </Row>

                  {/* Notes */}
                  <TextInput
                    style={{ backgroundColor: "#1E2837", borderRadius: 12, padding: 14,
                      color: "#FFFFFF", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
                      minHeight: 72, textAlignVertical: "top", marginBottom: 20 }}
                    placeholder="Any notes? e.g. 'Woke up at 3am...'"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />

                  <TouchableOpacity onPress={handleSave} activeOpacity={0.85}
                    style={{ backgroundColor: ROSE, borderRadius: 14, padding: 16,
                      alignItems: "center", marginBottom: 8,
                      shadowColor: ROSE, shadowRadius: 12, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 } }}>
                    <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Save Sleep Log 🌙</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Weekly sleep bar chart (SVG)
function SleepChart({ history, onBarPress }) {
  const days  = lastNDays(7);
  const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const W     = SW - 32;
  const H     = 140;
  const PAD_L = 28, PAD_B = 28, PAD_T = 16, PAD_R = 8;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const maxH   = 10; // y-axis max hours
  const barW   = Math.floor(chartW / 7) - 6;
  const goalY  = PAD_T + chartH * (1 - SLEEP_GOAL / maxH);

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 8, overflow: "hidden" }}>
      <Svg width={W} height={H}>
        {/* Y-axis labels */}
        {[0, 3, 6, 9].map(h => {
          const y = PAD_T + chartH * (1 - h / maxH);
          return (
            <React.Fragment key={h}>
              <SvgText x={PAD_L - 4} y={y + 4} textAnchor="end" fill={C.grey} fontSize={9}>{h}</SvgText>
              <Path d={`M${PAD_L},${y} H${W - PAD_R}`} stroke={C.cardLight} strokeWidth={0.5} />
            </React.Fragment>
          );
        })}

        {/* Goal line (dashed) */}
        <Path d={`M${PAD_L},${goalY} H${W - PAD_R}`}
          stroke={ROSE} strokeWidth={1.5} strokeDasharray="4 3" />
        <SvgText x={W - PAD_R + 2} y={goalY + 4} fill={ROSE} fontSize={8}>goal</SvgText>

        {/* Bars */}
        {days.map((date, i) => {
          const entry = history.find(s => s.date === date);
          const hrs   = entry?.duration || 0;
          const barH  = Math.max(hrs / maxH * chartH, hrs > 0 ? 4 : 0);
          const x     = PAD_L + i * (chartW / 7) + 3;
          const y     = PAD_T + chartH - barH;
          const color = sleepBarColor(hrs);
          const d     = new Date(date + "T12:00:00");
          const lbl   = DAY_LABELS[d.getDay()].slice(0, 2);

          return (
            <React.Fragment key={date}>
              <Rect x={x} y={y} width={barW} height={barH}
                fill={hrs > 0 ? color : C.cardLight} rx={4}
                onPress={() => onBarPress && onBarPress(entry || { date, duration: 0 })}
              />
              <SvgText x={x + barW / 2} y={H - 4} textAnchor="middle" fill={C.grey} fontSize={9}>
                {lbl}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function SleepScreen({ navigation }) {
  const { todaySleep, sleepHistory } = useContext(Ctx);
  const { theme } = useTheme();
  const [showLog,    setShowLog]    = useState(false);
  const [selectedBar, setSelectedBar] = useState(null);
  const hour = new Date().getHours();

  // 7-day stats
  const week7 = lastNDays(7).map(d => sleepHistory.find(s => s.date === d));
  const logged7 = week7.filter(Boolean);
  const avg7    = logged7.length > 0
    ? Math.round(logged7.reduce((s, e) => s + e.duration, 0) / logged7.length * 10) / 10
    : 0;
  const best7   = logged7.length > 0 ? Math.max(...logged7.map(e => e.duration)) : 0;
  const onGoal7 = logged7.length > 0
    ? Math.round(logged7.filter(e => e.duration >= SLEEP_GOAL).length / 7 * 100)
    : 0;

  // Alert banner config
  function alertConfig(sleep) {
    if (!sleep) return null;
    const h = sleep.duration;
    if (h < 5)  return { emoji:"😟", title:"You need more rest!", body:`Only ${fmtSleepDur(h)} sleep detected. Sleep deprivation slows metabolism and increases cravings. Aim for 7-9 hours.\n\n💡 Tip: Try sleeping 30 mins earlier tonight.`, bg:"rgba(239,68,68,0.12)", border:"rgba(239,68,68,0.35)", text:"#EF4444" };
    if (h < 6)  return { emoji:"😐", title:"Almost there!", body:`${fmtSleepDur(h)} is decent but your body repairs muscle and burns fat during deep sleep. Try to get 1 more hour tonight.`, bg:"rgba(245,158,11,0.12)", border:"rgba(245,158,11,0.35)", text:"#F59E0B" };
    if (h <= 8) return { emoji:"😊", title:"Great sleep last night!", body:`${fmtSleepDur(h)} of rest means your body is recovering well. Your muscles are repairing and your metabolism is optimized!`, bg:"rgba(16,185,129,0.12)", border:"rgba(16,185,129,0.35)", text:"#10B981" };
    return { emoji:"🌟", title:"Outstanding rest!", body:`${fmtSleepDur(h)} of sleep is excellent! You're fully recovered and ready to crush today's workout. Peak performance mode activated! 💪`, bg:"rgba(255,107,53,0.12)", border:"rgba(255,107,53,0.35)", text:ROSE };
  }
  const alert = alertConfig(todaySleep);

  // History last 14
  const hist14 = lastNDays(14).reverse().map(d => ({
    date: d,
    entry: sleepHistory.find(s => s.date === d) || null,
  }));

  return (
    <SafeAreaView style={S.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ padding: 16, paddingBottom: 8, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <TouchableOpacity onPress={() => navigation.navigate("Home")}
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 4 }}>
              <Text style={{ color: ROSE, fontSize: 16, fontWeight: "600" }}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={{ color: theme.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 }}>
              Sleep Tracker 🌙
            </Text>
            <Text style={{ color: theme.textSub, fontSize: 13, marginTop: 2 }}>
              Track your rest, fuel your best
            </Text>
          </View>
          <Image source={require("../../assets/Enhanced_Logo.PNG")} style={{ width: 80, height: 40, resizeMode: "contain" }} />
        </View>

        {/* Today's sleep card */}
        <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
          {!todaySleep ? (
            <View style={[S.card, { alignItems: "center", paddingVertical: 32 }]}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>🌙</Text>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 17, marginBottom: 6 }}>
                No sleep logged yet
              </Text>
              <Text style={{ color: C.grey, fontSize: 14, textAlign: "center", marginBottom: 20 }}>
                How did you sleep last night?
              </Text>
              <TouchableOpacity onPress={() => setShowLog(true)} activeOpacity={0.85}
                style={{ backgroundColor: ROSE, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13,
                  shadowColor: ROSE, shadowRadius: 10, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 } }}>
                <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>+ Log Last Night's Sleep</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={S.card}>
              <Row style={{ justifyContent: "space-between", marginBottom: 16 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Last Night</Text>
                <TouchableOpacity onPress={() => setShowLog(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600" }}>✏️ Edit</Text>
                </TouchableOpacity>
              </Row>

              {/* Big duration */}
              <Text style={{ color: ROSE, fontSize: 52, fontWeight: "800", textAlign: "center", letterSpacing: -2 }}>
                {fmtSleepDur(todaySleep.duration)}
              </Text>
              <Text style={{ color: C.grey, textAlign: "center", fontSize: 16, marginBottom: 16 }}>
                {sleepQualityEmoji(todaySleep.quality)} {todaySleep.quality.charAt(0).toUpperCase() + todaySleep.quality.slice(1)} Sleep
              </Text>

              {/* Bed / Wake */}
              <Row style={{ justifyContent: "space-around", marginBottom: 16 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: C.grey, fontSize: 11, marginBottom: 2 }}>🌙 Bedtime</Text>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 17 }}>{fmt12h(todaySleep.bedTime)}</Text>
                </View>
                <View style={{ width: 1, height: 36, backgroundColor: C.cardLight }} />
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: C.grey, fontSize: 11, marginBottom: 2 }}>☀️ Wake Up</Text>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 17 }}>{fmt12h(todaySleep.wakeTime)}</Text>
                </View>
              </Row>

              {/* Quality bar */}
              <View>
                <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ color: C.greyDim, fontSize: 11 }}>Poor</Text>
                  <Text style={{ color: C.greyDim, fontSize: 11 }}>Great</Text>
                </Row>
                <View style={{ height: 8, backgroundColor: C.cardLight, borderRadius: 4 }}>
                  <View style={{ height: 8, borderRadius: 4,
                    width: `${Math.min(todaySleep.duration / 9 * 100, 100)}%`,
                    backgroundColor: sleepBarColor(todaySleep.duration) }} />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Smart alert banner */}
        {alert && (
          <View style={{ marginHorizontal: 16, marginBottom: 16, borderRadius: 14,
            backgroundColor: alert.bg, borderLeftWidth: 4, borderLeftColor: alert.border,
            padding: 14 }}>
            <Text style={{ color: alert.text, fontWeight: "800", fontSize: 15, marginBottom: 4 }}>
              {alert.emoji} {alert.title}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 19 }}>{alert.body}</Text>
          </View>
        )}

        {/* Weekly chart */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
            This Week 📊
          </Text>
          <SleepChart history={sleepHistory} onBarPress={e => setSelectedBar(e)} />
          {selectedBar && selectedBar.duration > 0 && (
            <View style={{ backgroundColor: C.cardLight, borderRadius: 10, padding: 10, marginTop: 8,
              flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: C.grey, fontSize: 13 }}>{selectedBar.date}</Text>
              <Text style={{ color: ROSE, fontWeight: "700", fontSize: 14 }}>
                {fmtSleepDur(selectedBar.duration)}  {sleepQualityEmoji(selectedBar.quality || sleepQuality(selectedBar.duration))}
              </Text>
              <TouchableOpacity onPress={() => setSelectedBar(null)}>
                <Text style={{ color: C.greyDim }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Average */}
          <Text style={{ color: C.grey, fontSize: 13, textAlign: "center", marginTop: 10 }}>
            7-day average: <Text style={{ color: ROSE, fontWeight: "700" }}>{avg7}h</Text>
            {"  "}{avg7 > 0 ? sleepQualityEmoji(sleepQuality(avg7)) : ""}
          </Text>
        </View>

        {/* Insights row */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
            Your Sleep Insights 💡
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {[
              { v: `${avg7}h`,    l1: "7-day",   l2: "average",  col: ROSE        },
              { v: `${best7 > 0 ? fmtSleepDur(best7) : "--"}`, l1: "Best",    l2: "night",    col: "#10B981"   },
              { v: `${onGoal7}%`, l1: "On-goal", l2: "nights",   col: C.amber     },
              { v: `${logged7.length}/7`, l1: "Days",   l2: "logged",   col: C.blue      },
            ].map((s, i) => (
              <View key={i} style={{ width: 88, backgroundColor: C.card, borderRadius: 14,
                padding: 14, alignItems: "center",
                borderTopWidth: 3, borderTopColor: s.col }}>
                <Text style={{ color: s.col, fontSize: 20, fontWeight: "800" }}>{s.v}</Text>
                <Text style={{ color: C.grey, fontSize: 11, marginTop: 2 }}>{s.l1}</Text>
                <Text style={{ color: C.grey, fontSize: 11 }}>{s.l2}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Sleep Tips */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16,
            marginHorizontal: 16, marginBottom: 12 }}>
            Sleep Better Tonight 🌙
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {SLEEP_TIPS.map((tip, i) => (
              <View key={i} style={{ width: 160, backgroundColor: C.card,
                borderRadius: 14, padding: 14,
                borderLeftWidth: 3, borderLeftColor: ROSE_DIM }}>
                <Text style={{ fontSize: 24, marginBottom: 8 }}>{tip.icon}</Text>
                <Text style={{ color: C.text, fontSize: 13, lineHeight: 18 }}>{tip.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Sleep History */}
        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
            Sleep History 📅
          </Text>
          <View style={{ backgroundColor: C.card, borderRadius: 16, overflow: "hidden" }}>
            {hist14.map(({ date, entry }, i) => {
              const d = new Date(date + "T12:00:00");
              const dayLbl = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
              return (
                <View key={date} style={{
                  flexDirection: "row", alignItems: "center", paddingVertical: 13,
                  paddingHorizontal: 14,
                  borderBottomWidth: i < hist14.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: C.cardLight,
                }}>
                  <Text style={{ color: C.grey, fontSize: 12, width: 90 }}>{dayLbl}</Text>
                  <Text style={{ color: entry ? ROSE : C.greyDim, fontWeight: "700",
                    fontSize: 13, width: 56 }}>
                    {entry ? fmtSleepDur(entry.duration) : "—"}
                  </Text>
                  <Text style={{ fontSize: 16, width: 28 }}>
                    {entry ? sleepQualityEmoji(entry.quality) : ""}
                  </Text>
                  <Text style={{ color: C.greyDim, fontSize: 11, flex: 1, textAlign: "right" }}>
                    {entry ? `${fmt12h(entry.bedTime)} → ${fmt12h(entry.wakeTime)}` : "Not logged"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Spacer h={24} />
      </ScrollView>

      <LogSleepModal visible={showLog} existing={todaySleep} onClose={() => setShowLog(false)} />
    </SafeAreaView>
  );
}

// ─── EXERCISE LIBRARY DATA ────────────────────────────────────────────────────

// ─── EXERCISE CARD ────────────────────────────────────────────────────────────
export function ExerciseCard({ exercise, onPress }) {
  return (
    <TouchableOpacity onPress={() => onPress(exercise)} activeOpacity={0.88}
      style={{ backgroundColor: "#111827", borderRadius: 18, overflow: "hidden", marginBottom: 16,
        borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" }}>
      {/* Emoji header */}
      <View style={{ height: 120, backgroundColor: "#1E2837", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 56 }}>{exercise.emoji || "💪"}</Text>
      </View>
      <View style={{ padding: 16 }}>
        {/* Title + category badge */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>{exercise.title}</Text>
          <View style={{ backgroundColor: ROSE, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>{exercise.category}</Text>
          </View>
        </View>
        {/* Instructions */}
        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 20, marginBottom: 12 }}>{exercise.instructions}</Text>
        {/* Coach TinaBarks Tip */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,107,53,0.3)", overflow: "hidden" }}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ color: ROSE, fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
              💪 Coach TinaBarks Tip:
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 19 }}>{exercise.coachTip}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── VIDEO LIBRARY DATA ───────────────────────────────────────────────────────

// ─── VIDEO SCREEN ─────────────────────────────────────────────────────────────
export function VideoScreen({ navigation, trainSubBar }) {
  const [activeCat, setActiveCat] = useState("all");

  const filtered = activeCat === "all"
    ? VIDEO_LIBRARY
    : VIDEO_LIBRARY.filter(v => v.category === activeCat);

  const openVideo = (videoId) => {
    Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
  };

  return (
    <SafeAreaView style={S.screen}>
      {trainSubBar || null}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>Workout Videos</Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 4 }}>
            Curated from the world's top fitness channels
          </Text>
        </View>

        {/* Category filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 24, gap: 8 }}
          style={{ marginBottom: 16 }}>
          {[
            { id: "all",       label: "All"           },
            { id: "belly_fat", label: "🔥 Belly Fat"  },
            { id: "tone",      label: "💪 Toning"     },
            { id: "recovery",  label: "😴 Recovery"   },
          ].map(f => (
            <TouchableOpacity key={f.id} onPress={() => setActiveCat(f.id)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                backgroundColor: activeCat === f.id ? ROSE : "#1E2837",
                borderWidth: 1, borderColor: activeCat === f.id ? ROSE : "rgba(255,255,255,0.12)" }}>
              <Text style={{ color: activeCat === f.id ? "#FFF" : "rgba(255,255,255,0.55)",
                fontWeight: "600", fontSize: 12 }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Video cards */}
        <View style={{ paddingHorizontal: 16 }}>
          {filtered.map(video => {
            const catMeta = VIDEO_CAT_META[video.category];
            return (
              <TouchableOpacity key={video.id} activeOpacity={0.85}
                onPress={() => openVideo(video.id)}
                style={{ backgroundColor: "#111827", borderRadius: 16, marginBottom: 14, overflow: "hidden" }}>
                {/* Thumbnail */}
                <View style={{ width: "100%", height: 180, position: "relative" }}>
                  <Image
                    source={{ uri: `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg` }}
                    style={{ width: "100%", height: 180, resizeMode: "cover" }}
                  />
                  {/* Play button overlay */}
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    alignItems: "center", justifyContent: "center" }}>
                    <View style={{ width: 50, height: 50, borderRadius: 25,
                      backgroundColor: "rgba(255,107,53,0.9)", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#FFF", fontSize: 20 }}>▶</Text>
                    </View>
                  </View>
                  {/* Duration badge top-right */}
                  <View style={{ position: "absolute", top: 10, right: 10,
                    backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 6,
                    paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>{video.duration}</Text>
                  </View>
                  {/* Category badge top-left */}
                  <View style={{ position: "absolute", top: 10, left: 10,
                    backgroundColor: catMeta.color + "DD", borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>{catMeta.label}</Text>
                  </View>
                </View>
                {/* Card body */}
                <View style={{ padding: 12 }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14, marginBottom: 4 }}>
                    {video.title}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ color: ROSE, fontSize: 12, fontWeight: "600" }}>{video.channel}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>{video.views}</Text>
                    </View>
                    <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>Opens in YouTube</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Premium note banner */}
        <View style={{ marginHorizontal: 16, marginTop: 4, backgroundColor: "rgba(255,107,53,0.1)",
          borderRadius: 12, padding: 14 }}>
          <Text style={{ color: ROSE, fontWeight: "700", fontSize: 13, textAlign: "center", marginBottom: 6 }}>
            🎬 Coach TinaBarks' exclusive workout videos coming soon!
          </Text>
          <Text style={{ color: "#FFFFFF", fontSize: 11, textAlign: "center", lineHeight: 17 }}>
            These are the world's best fitness videos while we prepare something even better for you.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
