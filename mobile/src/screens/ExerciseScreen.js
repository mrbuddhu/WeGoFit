import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import Svg, { Circle, Polyline, Rect, Text as SvgText } from "react-native-svg";

import S from "../lib/styles";
import { ROSE, C, SH, SW } from "../lib/constants";
import { Ctx } from "../contexts/AppContext";
import { haversine, fmtDur, fmtPace } from "../utils/calculations";
import {
  getWorkoutThreshold,
  calculateIntegrityScore,
  fmtDurationSec,
} from "../utils/workoutVerification";
import { EX_LIBRARY, CAT_PILL, CATEGORY_META } from "../data/exercises";
import { Card, Row, Spacer, NudgeBanner } from "../components/shared";

let Pedometer = null;
try { Pedometer = require("expo-sensors").Pedometer; } catch (_e) { Pedometer = null; }

// ─── ROUTE MAP ───────────────────────────────────────────────────────────────
function RouteMap({ positions, height = 200 }) {
  if (positions.length === 0) {
    return (
      <View style={{ height, backgroundColor: C.cardLight, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.greyDim, fontSize: 13 }}>Waiting for GPS...</Text>
      </View>
    );
  }

  const W = SW - 32 - 32; // padding
  const PAD = 20;
  const lats = positions.map(p => p.lat);
  const lngs = positions.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.0001;
  const lngSpan = maxLng - minLng || 0.0001;
  const scaleX = (W - PAD * 2) / lngSpan;
  const scaleY = (height - PAD * 2) / latSpan;
  const scale = Math.min(scaleX, scaleY);

  const toX = lng => PAD + (W - PAD * 2 - lngSpan * scale) / 2 + (lng - minLng) * scale;
  const toY = lat => PAD + (height - PAD * 2 - latSpan * scale) / 2 + (maxLat - lat) * scale;

  const points = positions.map(p => `${toX(p.lng)},${toY(p.lat)}`).join(" ");
  const last = positions[positions.length - 1];
  const first = positions[0];

  return (
    <View style={{ borderRadius: 12, overflow: "hidden", backgroundColor: C.cardLight }}>
      <Svg width={W} height={height}>
        <Rect width={W} height={height} fill={C.cardLight} />
        {positions.length >= 2 && (
          <Polyline points={points} fill="none" stroke={C.green} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {/* Start dot */}
        <Circle cx={toX(first.lng)} cy={toY(first.lat)} r={6} fill={C.white} />
        <SvgText x={toX(first.lng)} y={toY(first.lat) + 4} textAnchor="middle" fill={C.bg} fontSize={7} fontWeight="bold">S</SvgText>
        {/* Current dot */}
        <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={8} fill={C.green} opacity={0.25} />
        <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={5} fill={C.green} />
        <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={2} fill={C.white} />
      </Svg>
    </View>
  );
}

// ─── EXERCISE ─────────────────────────────────────────────────────────────────
export function ExerciseScreen({ navigation, trainSubBar }) {
  const { profile, dayLog, addExercise, removeExercise } = useContext(Ctx);

  // screen: "library" | "ready" | "active" | "paused" | "done"
  const [screen,    setScreen]   = useState("library");
  const [selEx,     setSelEx]    = useState(null);
  const [catFilter, setCatFilter] = useState("all");
  const [toast,     setToast]    = useState(null);

  // live session state
  const [elapsed,   setElapsed]  = useState(0);   // seconds
  const [liveCal,   setLiveCal]  = useState(0);
  const [positions, setPositions] = useState([]);
  const [dist,      setDist]     = useState(0);    // metres
  const [speed,     setSpeed]    = useState(0);    // km/h
  const [maxSpeed,  setMaxSpeed] = useState(0);
  const [gpsOk,     setGpsOk]   = useState(false);

  const timerRef   = useRef(null);
  const locSub     = useRef(null);

  // pedometer state
  const [stepCount,      setStepCount]      = useState(0);
  const [pedometerAvail, setPedometerAvail] = useState(false);
  const pedometerSub          = useRef(null);
  const sessionStartSteps     = useRef(0);

  // nudge banner
  const [nudgeMsg,  setNudgeMsg]  = useState(null);
  const nudgeShown5 = useRef(false);
  const nudgeShown10 = useRef(false);
  const distRef    = useRef(0);
  const maxSpeedRef = useRef(0);
  const posRef     = useRef([]);

  // formatted timer HH:MM:SS
  function fmtElapsed(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = n => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  }

  // avg speed km/h from distance + elapsed
  function avgSpeedKmh() {
    if (elapsed < 5 || dist < 10) return 0;
    return Math.round((dist / 1000) / (elapsed / 3600) * 10) / 10;
  }

  // pace MM:SS /km
  function paceStr(kmh) {
    if (!kmh || kmh < 0.5) return "--:--";
    const secPerKm = 3600 / kmh;
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function startTimer() {
    timerRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1;
        if (selEx) {
          const t = getWorkoutThreshold(selEx.category);
          if (!t.usesGPS) {
            // Stationary exercise: use steps+MET or MET×weight×duration
            const weightKg   = profile?.weight || 65;
            const durationHr = next / 3600;
            const steps      = stepCount;
            const met        = selEx.met || 8;
            const cal = steps > 0
              ? Math.round((steps * 0.04) * (met / 9.8))
              : Math.round(met * weightKg * durationHr);
            setLiveCal(cal);
          } else {
            // Outdoor: keep existing time-based estimate during session
            setLiveCal(Math.round((next / 60) * selEx.calPerMin));
          }
        }
        return next;
      });
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function startPedometer() {
    try {
      const isAvailable = Pedometer ? await Pedometer.isAvailableAsync() : false;
      if (isAvailable) {
        const { status } = Pedometer ? await Pedometer.requestPermissionsAsync() : { status: "denied" };
        if (status !== "granted") return;
        setPedometerAvail(true);
        const end   = new Date();
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const result = Pedometer ? await Pedometer.getStepCountAsync(start, end) : { steps: 0 };
        sessionStartSteps.current = result.steps;
        if (Pedometer) {
          pedometerSub.current = Pedometer.watchStepCount(evt => {
            const steps = Math.max(0, evt.steps - sessionStartSteps.current);
            setStepCount(steps);
          });
        }
      }
    } catch (_e) {
      setPedometerAvail(false);
    }
  }

  function stopPedometer() {
    if (pedometerSub.current) {
      pedometerSub.current.remove();
      pedometerSub.current = null;
    }
  }

  async function startSession() {
    // reset everything
    setElapsed(0); setLiveCal(0); setDist(0); setSpeed(0); setMaxSpeed(0); setPositions([]);
    setStepCount(0); setNudgeMsg(null);
    distRef.current = 0; maxSpeedRef.current = 0; posRef.current = [];
    nudgeShown5.current = false; nudgeShown10.current = false;

    startTimer();

    // request GPS
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setGpsOk(true);
        locSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
          loc => {
            const { latitude, longitude, speed: spd, accuracy } = loc.coords;
            const pt = { lat: latitude, lng: longitude, ts: loc.timestamp };
            const prev = posRef.current[posRef.current.length - 1];
            if (prev && accuracy < 40) {
              const d = haversine(prev.lat, prev.lng, latitude, longitude);
              if (d < 200) { distRef.current += d; setDist(Math.round(distRef.current)); }
            }
            posRef.current = [...posRef.current, pt];
            setPositions([...posRef.current]);
            const kmh = spd ? Math.round(spd * 3.6 * 10) / 10 : 0;
            setSpeed(kmh);
            if (kmh > maxSpeedRef.current) { maxSpeedRef.current = kmh; setMaxSpeed(kmh); }
          }
        );
      } else {
        setGpsOk(false);
      }
    } catch (_) {
      setGpsOk(false);
    }

    startPedometer();
    setScreen("active");
  }

  function pauseSession() {
    stopTimer();
    locSub.current?.remove(); locSub.current = null;
    setScreen("paused");
  }

  async function resumeSession() {
    startTimer();
    try {
      if (gpsOk) {
        locSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
          loc => {
            const { latitude, longitude, speed: spd, accuracy } = loc.coords;
            const pt = { lat: latitude, lng: longitude, ts: loc.timestamp };
            const prev = posRef.current[posRef.current.length - 1];
            if (prev && accuracy < 40) {
              const d = haversine(prev.lat, prev.lng, latitude, longitude);
              if (d < 200) { distRef.current += d; setDist(Math.round(distRef.current)); }
            }
            posRef.current = [...posRef.current, pt];
            setPositions([...posRef.current]);
            const kmh = spd ? Math.round(spd * 3.6 * 10) / 10 : 0;
            setSpeed(kmh);
            if (kmh > maxSpeedRef.current) { maxSpeedRef.current = kmh; setMaxSpeed(kmh); }
          }
        );
      }
    } catch (_e) {
      // handled silently
    }
    setScreen("active");
  }

  function finishSession() {
    stopTimer();
    stopPedometer();
    locSub.current?.remove(); locSub.current = null;
    setScreen("done");
  }

  function saveSession() {
    const durationMin = Math.max(1, Math.round(elapsed / 60));
    const distKm = Math.round(distRef.current / 10) / 100;
    const avg = avgSpeedKmh();
    addExercise({
      name:           selEx.name,
      exerciseId:     selEx.id,
      type:           selEx.category,
      durationMin,
      caloriesBurned: liveCal,
      distance_km:    distKm,
      avgSpeed:       avg,
      maxSpeed:       maxSpeedRef.current,
      pace:           paceStr(avg),
      source:         "LIVE_SESSION",
      loggedAt:       new Date().toISOString(),
    });
    const msg = `Session saved! 🔥 ${liveCal} cal burned`;
    setScreen("library");
    setSelEx(null);
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function discardSession() {
    Alert.alert(
      "Discard this session?",
      "Your workout data will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => {
          stopTimer();
          stopPedometer();
          locSub.current?.remove(); locSub.current = null;
          setScreen("library"); setSelEx(null);
        }},
      ]
    );
  }

  const todayEx     = dayLog?.exercise || [];
  const totalBurned = dayLog?.totals?.caloriesBurned || 0;
  const totalMins   = todayEx.reduce((s, e) => s + (e.durationMin || 0), 0);
  const filteredLib = catFilter === "all" ? EX_LIBRARY : EX_LIBRARY.filter(e => e.category === catFilter);
  const distKm      = (dist / 1000).toFixed(2);
  const avg         = avgSpeedKmh();

  // Mid-session nudge alerts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (screen !== "active" || !selEx) return;
    const t = getWorkoutThreshold(selEx.category);
    const elapsed_min = elapsed / 60;
    const distanceKm  = dist / 1000;

    if (t.usesGPS) {
      if (!nudgeShown5.current && elapsed_min >= 5 && distanceKm < 0.1) {
        nudgeShown5.current = true;
        setNudgeMsg("🏃 Still warming up? We haven't detected much movement yet!");
      }
      if (!nudgeShown10.current && elapsed_min >= 10 && distanceKm < 0.2) {
        nudgeShown10.current = true;
        Alert.alert(
          "Are you still working out? 🤔",
          "We haven't detected much movement in the last 10 minutes.\n\nSessions without movement won't count toward challenges.",
          [
            { text: "Yes, I'm going! 💪", style: "default" },
            { text: "End Session", style: "destructive", onPress: finishSession },
          ]
        );
      }
      const threshold = getWorkoutThreshold(selEx.category);
      if (speed > threshold.maxAvgSpeed_kmh && speed > 0) {
        setNudgeMsg("🚗 You're moving very fast — are you in a vehicle?");
      }
    }
  }, [elapsed, screen]);

  // ── READY SCREEN ────────────────────────────────────────────────────────────
  if (screen === "ready" && selEx) {
    const catColor = selEx.categoryColor || ROSE;
    const diffColor = selEx.difficulty === "Advanced" ? "#EF4444"
      : selEx.difficulty === "Intermediate" ? ROSE : "#22C55E";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
        <StatusBar style="light" backgroundColor="transparent" translucent={true} />
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Back button */}
          <TouchableOpacity onPress={() => { setSelEx(null); setScreen("library"); }}
            style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>← Back</Text>
          </TouchableOpacity>

          {/* Hero */}
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <Text style={{ fontSize: 80 }}>{selEx.emoji}</Text>
            <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginTop: 12, textAlign: "center",
              paddingHorizontal: 24 }}>{selEx.name}</Text>
            {/* Badge row */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap",
              justifyContent: "center", paddingHorizontal: 16 }}>
              {[selEx.duration, selEx.calories, selEx.difficulty].map((v, i) => (
                <View key={i} style={{ backgroundColor: "#1E2837", borderRadius: 20,
                  paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: i === 2 ? diffColor : "#FFFFFF", fontSize: 12, fontWeight: "600" }}>{v}</Text>
                </View>
              ))}
            </View>
            {/* Home workout badge */}
            <View style={{ marginTop: 14, backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 6,
              borderWidth: 1, borderColor: ROSE }}>
              <Text style={{ color: ROSE, fontSize: 12, fontWeight: "700" }}>🏠 Home Workout — No Equipment</Text>
            </View>
          </View>

          {/* Instructions */}
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 18, marginBottom: 12 }}>
              How To Do It
            </Text>
            {(selEx.instructions || []).map((step, i) => (
              <View key={i} style={{ backgroundColor: "#111827", borderRadius: 10, padding: 12,
                marginBottom: 8, flexDirection: "row", alignItems: "flex-start" }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: ROSE,
                  alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 1, flexShrink: 0 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{i + 1}</Text>
                </View>
                <Text style={{ color: "#FFFFFF", fontSize: 14, flex: 1, lineHeight: 20 }}>
                  {step.replace(/^\d+\.\s*/, "")}
                </Text>
              </View>
            ))}
          </View>

          {/* Coach Tip */}
          {selEx.coachTip && (
            <View style={{ marginHorizontal: 16, marginBottom: 20,
              backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 12,
              borderLeftWidth: 4, borderLeftColor: ROSE, padding: 16 }}>
              <Text style={{ color: ROSE, fontWeight: "700", fontSize: 13, marginBottom: 6 }}>
                💪 Coach TinaBarks says:
              </Text>
              <Text style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 22 }}>
                {selEx.coachTip}
              </Text>
            </View>
          )}

          {/* Cal/min info */}
          <View style={{ marginHorizontal: 16, backgroundColor: "#111827", borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 16 }}>
            <Row>
              <Text style={{ fontSize: 18, marginRight: 10 }}>🔥</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 15 }}>
                ~{selEx.calPerMin} cal/min · MET {selEx.met}
              </Text>
            </Row>
          </View>
        </ScrollView>

        {/* Start Workout CTA — fixed bottom */}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: "#070B14", paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12,
          borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
          <TouchableOpacity onPress={startSession}
            style={{ height: 56, borderRadius: 14, backgroundColor: ROSE,
              alignItems: "center", justifyContent: "center",
              shadowColor: ROSE, shadowRadius: 12, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 } }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>🏃 Start Workout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── ACTIVE / PAUSED SCREEN ───────────────────────────────────────────────────
  if (screen === "active" || screen === "paused") {
    const isPaused = screen === "paused";
    return (
      <SafeAreaView style={S.screen}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Status bar */}
          <Row style={{ justifyContent: "space-between", paddingVertical: 14 }}>
            <Row>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 6,
                backgroundColor: isPaused ? C.amber : "#EF4444" }} />
              <Text style={{ color: isPaused ? C.amber : "#EF4444", fontWeight: "700", fontSize: 13 }}>
                {isPaused ? "PAUSED" : "LIVE"}
              </Text>
            </Row>
            <Row>
              <Text style={{ fontSize: 20, marginRight: 6 }}>{selEx?.emoji}</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{selEx?.name}</Text>
            </Row>
          </Row>

          {/* Big timer */}
          <View style={{ alignItems: "center", paddingVertical: 28,
            backgroundColor: "#111827", borderRadius: 20, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
            shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "600", letterSpacing: 2, marginBottom: 6 }}>
              DURATION
            </Text>
            <Text style={{ color: ROSE, fontSize: 56, fontWeight: "800", letterSpacing: -1 }}>
              {fmtElapsed(elapsed)}
            </Text>
          </View>

          {/* Stat boxes */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 14, padding: 14, alignItems: "center",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>🔥</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 22 }}>{liveCal}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>calories</Text>
            </View>
            {gpsOk ? (
              <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 14, padding: 14, alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ fontSize: 20, marginBottom: 4 }}>📍</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 22 }}>{distKm}</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>km</Text>
              </View>
            ) : (
              <View style={{ flex: 1, backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 14, padding: 14, alignItems: "center",
                borderWidth: 1, borderColor: "rgba(245,158,11,0.25)", justifyContent: "center" }}>
                <Text style={{ color: C.amber, fontSize: 11, textAlign: "center", fontWeight: "600" }}>
                  📍 GPS unavailable
                </Text>
              </View>
            )}
          </View>

          {gpsOk && (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 14, padding: 14, alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ fontSize: 18, marginBottom: 4 }}>⚡</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 20 }}>{speed}</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>km/h speed</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 14, padding: 14, alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ fontSize: 18, marginBottom: 4 }}>📈</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 20 }}>{paceStr(avg)}</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>/km pace</Text>
              </View>
            </View>
          )}

          {/* Step counter */}
          {pedometerAvail && (
            <View style={{ backgroundColor: "#1E2837", borderRadius: 14, padding: 14, marginBottom: 12,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>👟</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 20 }}>
                  {stepCount.toLocaleString()}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 1 }}>steps this session</Text>
              </View>
              <View style={{ backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "700" }}>LIVE</Text>
              </View>
            </View>
          )}

          {/* Nudge banner */}
          {nudgeMsg && (
            <NudgeBanner message={nudgeMsg} onDismiss={() => setNudgeMsg(null)} />
          )}

          {/* Route map */}
          {gpsOk && positions.length > 1 && (
            <View style={{ backgroundColor: "#111827", borderRadius: 16, overflow: "hidden", marginBottom: 16,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <RouteMap positions={positions} height={180} />
            </View>
          )}

          {/* Controls */}
          <Row style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={isPaused ? resumeSession : pauseSession}
              style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center",
                backgroundColor: "#1E2837", borderWidth: 2, borderColor: C.amber }}>
              <Text style={{ color: C.amber, fontWeight: "800", fontSize: 16 }}>
                {isPaused ? "▶ RESUME" : "⏸ PAUSE"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={finishSession}
              style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center",
                backgroundColor: ROSE,
                shadowColor: ROSE, shadowRadius: 8, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 } }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>⏹ FINISH</Text>
            </TouchableOpacity>
          </Row>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── DONE / SUMMARY SCREEN ────────────────────────────────────────────────────
  if (screen === "done" && selEx) {
    const avg2           = avgSpeedKmh();
    const distKmFinal    = Math.round(distRef.current / 10) / 100;
    const isStationary   = !getWorkoutThreshold(selEx.category).usesGPS;
    const weightKg       = profile?.weight || 65;
    const durationHr     = elapsed / 3600;
    const met            = selEx.met || 8;
    // For stationary: recompute final calories from steps+MET (more accurate than timer ticks)
    const finalCal = isStationary
      ? (stepCount > 0
          ? Math.round((stepCount * 0.04) * (met / 9.8))
          : Math.round(met * weightKg * durationHr))
      : liveCal;
    const calSource = isStationary
      ? "📊 Calculated from steps & duration"
      : "📍 Calculated from GPS & duration";
    const integrity   = calculateIntegrityScore({
      workoutType:  selEx.category,
      distance_km:  distKmFinal,
      avgSpeed_kmh: avg2,
      duration_sec: elapsed,
      stepCount,
    });
    const scoreColor = integrity.score >= 80 ? ROSE : integrity.score >= 60 ? "#10B981" : integrity.score >= 41 ? "#F59E0B" : "#EF4444";
    const scoreBarW  = `${integrity.score}%`;

    function handleSave() {
      if (integrity.vehicleFlag) {
        Alert.alert(
          "Session Not Counted 🚗",
          "This session detected vehicle-speed movement and won't be saved.\n\nStart a new session when ready to run!",
          [{ text: "OK", style: "default", onPress: () => { setScreen("library"); setSelEx(null); } }]
        );
        return;
      }
      const durationMin = Math.max(1, Math.round(elapsed / 60));
      addExercise({
        name:           selEx.name,
        exerciseId:     selEx.id,
        type:           selEx.category,
        durationMin,
        caloriesBurned: integrity.isVerified ? finalCal : 0,
        distance_km:    isStationary ? 0 : distKmFinal,
        avgSpeed:       isStationary ? 0 : avg2,
        maxSpeed:       isStationary ? 0 : maxSpeedRef.current,
        pace:           isStationary ? "--" : paceStr(avg2),
        stepCount,
        integrityScore: integrity.score,
        verified:       integrity.isVerified,
        source:         isStationary
          ? (integrity.isVerified ? "STEPS_MET_VERIFIED" : "STEPS_MET_UNVERIFIED")
          : (integrity.isVerified ? "GPS_VERIFIED"       : "GPS_UNVERIFIED"),
        loggedAt:       new Date().toISOString(),
      }, integrity.isVerified);
      if (integrity.isVerified) {
        setScreen("library"); setSelEx(null);
        setToast(`✅ Verified! +50 WeGoFit Points! 🏆`);
        setTimeout(() => setToast(null), 3500);
      } else {
        Alert.alert(
          "Session Saved ⚠️",
          "Your session was saved but didn't meet the minimum activity thresholds.\n\nNo challenge credit or points awarded this time — keep pushing! 💪",
          [{ text: "Got it!", style: "default", onPress: () => { setScreen("library"); setSelEx(null); } }]
        );
      }
    }

    return (
      <SafeAreaView style={S.screen}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "800", textAlign: "center", marginBottom: 4 }}>
            Session Complete! ✅
          </Text>
          <Row style={{ justifyContent: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 22, marginRight: 6 }}>{selEx.emoji}</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 16 }}>{selEx.name}</Text>
          </Row>

          {/* Stats summary */}
          <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 20, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
            shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }}>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              {[
                { v: fmtElapsed(elapsed),                                    l: "time"     },
                ...(!isStationary ? [{ v: gpsOk ? `${distKmFinal}km` : "--", l: "distance" }] : []),
                { v: `${finalCal}`,                                          l: "calories" },
              ].map(s => (
                <View key={s.l} style={{ flex: 1, alignItems: "center", backgroundColor: "#1E2837", borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: ROSE, fontWeight: "800", fontSize: 18 }}>{s.v}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>{s.l}</Text>
                </View>
              ))}
            </View>
            {pedometerAvail && (
              <Row style={{ justifyContent: "center", gap: 6 }}>
                <Text style={{ fontSize: 16 }}>👟</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{stepCount.toLocaleString()} steps</Text>
              </Row>
            )}
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textAlign: "center", marginTop: 8 }}>
              {calSource}
            </Text>
            {gpsOk && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                {[
                  { l: "Avg Speed", v: `${avg2} km/h` },
                  { l: "Max Speed", v: `${maxSpeed} km/h` },
                  { l: "Avg Pace",  v: `${paceStr(avg2)} /km` },
                ].map(s => (
                  <View key={s.l} style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{s.l}</Text>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{s.v}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Route map */}
          {gpsOk && positions.length > 1 && (
            <View style={{ backgroundColor: "#111827", borderRadius: 16, overflow: "hidden", marginBottom: 16,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <RouteMap positions={positions} height={180} />
            </View>
          )}

          {/* ── INTEGRITY CARD ── */}
          <View style={{
            backgroundColor: "#111827", borderRadius: 20, padding: 20, marginBottom: 20,
            borderWidth: 2,
            borderColor: integrity.vehicleFlag ? "#F59E0B" : integrity.isVerified ? "#10B981" : "#F59E0B",
            shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
          }}>
            {integrity.vehicleFlag ? (
              <>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#F59E0B", marginBottom: 8 }}>🚗 Unusual Speed Detected</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 20 }}>
                  Average speed was {avg2} km/h — too fast for {selEx.name}.{"\n\n"}
                  Looks like you might have been in a vehicle! No worries — start a fresh session when you're ready to run! 🏃
                </Text>
                <View style={{ backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 10, padding: 10, marginTop: 12 }}>
                  <Text style={{ color: "#F59E0B", fontWeight: "700", fontSize: 13, textAlign: "center" }}>Session will not be saved</Text>
                </View>
              </>
            ) : (
              <>
                <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#FFFFFF" }}>
                    {integrity.isVerified ? "🏅" : "⚠️"} Workout Integrity Score
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: scoreColor }}>
                    {integrity.score}<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>/100</Text>
                  </Text>
                </Row>

                {/* Score bar */}
                <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, marginBottom: 16, overflow: "hidden" }}>
                  <View style={{ height: 8, width: scoreBarW, backgroundColor: scoreColor, borderRadius: 4 }} />
                </View>

                {/* Check rows */}
                {integrity.checks.map((c, i) => (
                  <Row key={i} style={{ marginBottom: 8, gap: 8 }}>
                    <Text style={{ width: 20, fontSize: 14 }}>
                      {c.passed === true ? "✅" : c.passed === null ? "⚡" : "❌"}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, width: 70 }}>{c.label}</Text>
                    <Text style={{ flex: 1, color: "#FFFFFF", fontSize: 13, fontWeight: "600" }}>{c.value}</Text>
                    <Text style={{ color: scoreColor, fontSize: 12, fontWeight: "700" }}>+{c.points}</Text>
                  </Row>
                ))}

                {/* Verdict */}
                <View style={{
                  marginTop: 12, borderRadius: 12, padding: 12,
                  backgroundColor: integrity.isVerified ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                }}>
                  <Text style={{ color: integrity.isVerified ? "#10B981" : "#F59E0B", fontWeight: "800", fontSize: 14, textAlign: "center" }}>
                    {integrity.isVerified
                      ? "✅ VERIFIED SESSION — Full challenge credit awarded!"
                      : "⚠️ LOW ACTIVITY — Minimum thresholds not met. You've got this next time! 💪"}
                  </Text>
                </View>
              </>
            )}
          </View>

          {!integrity.vehicleFlag && (
            <TouchableOpacity onPress={handleSave}
              style={{ paddingVertical: 17, borderRadius: 16, alignItems: "center",
                backgroundColor: ROSE, marginBottom: 12,
                shadowColor: ROSE, shadowRadius: 12, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 } }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 17 }}>💾 Save Session</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={discardSession} style={{ alignItems: "center", paddingVertical: 10 }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 15 }}>{integrity.vehicleFlag ? "← Start New Session" : "🗑 Discard"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── LIBRARY SCREEN (default) ─────────────────────────────────────────────────
  const catMeta = catFilter !== "all" ? CATEGORY_META[catFilter] : null;

  return (
    <SafeAreaView style={S.screen}>
      {trainSubBar || null}
      {/* Toast */}
      {toast && (
        <View style={{ position: "absolute", top: 60, left: 24, right: 24, zIndex: 999,
          backgroundColor: "#1A1A1A", borderRadius: 12, padding: 14, alignItems: "center",
          shadowColor: "#000", shadowRadius: 12, shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 } }}>
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>{toast}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>
            Train with Coach TinaBarks
          </Text>
          <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600", marginTop: 4 }}>
            All workouts are home-based — no gym equipment needed! 💪
          </Text>
        </View>

        {/* Home Workout Global Banner */}
        <View style={{ marginHorizontal: 16, marginTop: 10, marginBottom: 4,
          backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 10,
          paddingVertical: 8, paddingHorizontal: 14 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600", textAlign: "center" }}>
            Sweat at home today. Shine everywhere tomorrow. ✨
          </Text>
        </View>

        {/* Today's Summary Bar */}
        <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 10, marginTop: 12, marginBottom: 20 }}>
          {[
            { v: todayEx.length, l: "sessions"  },
            { v: totalMins,      l: "min total"  },
            { v: totalBurned,    l: "cal burned" },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 14, padding: 12,
              alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", elevation: 1 }}>
              <Text style={{ color: ROSE, fontSize: 22, fontWeight: "800" }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Today's Sessions */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 17, marginBottom: 10 }}>
            Today's Sessions
          </Text>
          {todayEx.length === 0 ? (
            <View style={{ backgroundColor: "#1E2837", borderRadius: 14,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 24, alignItems: "center" }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🏋️</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", textAlign: "center", fontSize: 14 }}>
                No sessions today. Pick an exercise below! 👇
              </Text>
            </View>
          ) : (
            todayEx.map((ex, idx) => {
              const lib   = EX_LIBRARY.find(e => e.id === ex.exerciseId);
              const cat   = lib?.category || ex.type || "belly_fat";
              const pill  = CAT_PILL[cat] || CAT_PILL.belly_fat;
              const emoji = lib?.emoji || ex.emoji || "🏃";
              const hasScore = ex.integrityScore != null;
              const scorePillBg    = !hasScore ? null : ex.integrityScore >= 60 ? "#ECFDF5" : "#FFFBEB";
              const scorePillColor = !hasScore ? null : ex.integrityScore >= 60 ? "#10B981" : "#F59E0B";
              const scorePillTxt   = !hasScore ? null : `${ex.verified ? "✅" : "⚠️"}${ex.integrityScore}`;
              return (
                <View key={idx} style={{ backgroundColor: "#1E2837", borderRadius: 14, marginBottom: 8,
                  flexDirection: "row", alignItems: "center", padding: 14,
                  borderWidth: 1, borderColor: ex.verified === false ? "#FDE68A" : "rgba(255,255,255,0.08)",
                  elevation: 1 }}>
                  <Text style={{ fontSize: 26, marginRight: 12 }}>{emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{ex.name}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>
                      {ex.durationMin} min
                      {ex.distance_km ? ` · ${ex.distance_km} km` : ""}
                      {ex.stepCount ? ` · ${ex.stepCount.toLocaleString()} steps` : ""}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3,
                    borderRadius: 20, backgroundColor: pill.bg, marginRight: 6 }}>
                    <Text style={{ color: pill.text, fontSize: 11, fontWeight: "600" }}>
                      {ex.caloriesBurned} cal
                    </Text>
                  </View>
                  {hasScore && (
                    <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
                      backgroundColor: scorePillBg, marginRight: 6 }}>
                      <Text style={{ color: scorePillColor, fontSize: 11, fontWeight: "700" }}>
                        {scorePillTxt}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => removeExercise(idx)}
                    style={{ width: 30, height: 30, borderRadius: 15,
                      backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: C.red, fontSize: 14 }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Exercise Library */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 17, marginBottom: 12 }}>
            Exercise Library
          </Text>

          {/* Category Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16, marginBottom: 14 }}>
            {[
              { id: "all",       label: "All"              },
              { id: "belly_fat", label: "🔥 Belly Fat & Weight Loss" },
              { id: "tone",      label: "💪 Tone & Sculpt" },
              { id: "recovery",  label: "😴 Energy & Recovery" },
            ].map(f => (
              <TouchableOpacity key={f.id} onPress={() => setCatFilter(f.id)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                  backgroundColor: catFilter === f.id ? ROSE : "#1E2837",
                  borderWidth: 1, borderColor: catFilter === f.id ? ROSE : "rgba(255,255,255,0.12)" }}>
                <Text style={{ color: catFilter === f.id ? "#FFF" : "rgba(255,255,255,0.55)",
                  fontWeight: "600", fontSize: 12 }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Category Banner */}
          {catMeta && (
            <View style={{ backgroundColor: catMeta.bannerBg, borderRadius: 16,
              borderLeftWidth: 4, borderLeftColor: catMeta.color, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: catMeta.color, fontWeight: "800", fontSize: 18, marginBottom: 6 }}>
                {catMeta.title}
              </Text>
              <Text style={{ color: "#FFFFFF", fontSize: 12, lineHeight: 18 }}>
                {catMeta.body}
              </Text>
            </View>
          )}

          {/* Exercise Cards */}
          {filteredLib.map(ex => {
            const pill = CAT_PILL[ex.category] || CAT_PILL.belly_fat;
            const diffColor = ex.difficulty === "Advanced" ? "#EF4444"
              : ex.difficulty === "Intermediate" ? ROSE : "#22C55E";
            return (
              <TouchableOpacity key={ex.id} activeOpacity={0.7}
                onPress={() => { setSelEx(ex); setScreen("ready"); }}
                style={{ backgroundColor: "#111827", borderRadius: 16, marginBottom: 10,
                  flexDirection: "row", alignItems: "center", padding: 14,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", elevation: 1 }}>
                {/* Emoji circle */}
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#1E2837",
                  alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Text style={{ fontSize: 20 }}>{ex.emoji}</Text>
                </View>
                {/* Middle info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{ex.name}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
                    {ex.duration} · {ex.calories}
                  </Text>
                  <Text style={{ color: diffColor, fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                    {ex.difficulty}
                  </Text>
                </View>
                {/* Right side */}
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3,
                    backgroundColor: ex.categoryColor || pill.text, marginBottom: 4 }} />
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>MET {ex.met}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 18, marginTop: 2 }}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
