const WORKOUT_THRESHOLDS = {
  running:  { minDistance_km: 0.5,  minAvgSpeed_kmh: 4.0,  maxAvgSpeed_kmh: 25.0, minSteps: 600, minDuration_sec: 120, usesGPS: true,  usesPedometer: true  },
  cycling:  { minDistance_km: 1.0,  minAvgSpeed_kmh: 8.0,  maxAvgSpeed_kmh: 60.0, minSteps: 0,   minDuration_sec: 180, usesGPS: true,  usesPedometer: false },
  walking:  { minDistance_km: 0.3,  minAvgSpeed_kmh: 2.0,  maxAvgSpeed_kmh: 8.0,  minSteps: 400, minDuration_sec: 120, usesGPS: true,  usesPedometer: true  },
  hiking:   { minDistance_km: 0.5,  minAvgSpeed_kmh: 1.5,  maxAvgSpeed_kmh: 10.0, minSteps: 600, minDuration_sec: 300, usesGPS: true,  usesPedometer: true  },
  hiit:     { minDistance_km: 0,    minAvgSpeed_kmh: 0,    maxAvgSpeed_kmh: 999,  minSteps: 200, minDuration_sec: 300, usesGPS: false, usesPedometer: true  },
  jumprope: { minDistance_km: 0,    minAvgSpeed_kmh: 0,    maxAvgSpeed_kmh: 999,  minSteps: 300, minDuration_sec: 180, usesGPS: false, usesPedometer: true  },
  dancing:  { minDistance_km: 0,    minAvgSpeed_kmh: 0,    maxAvgSpeed_kmh: 999,  minSteps: 150, minDuration_sec: 180, usesGPS: false, usesPedometer: true  },
  squats:   { minDistance_km: 0,    minAvgSpeed_kmh: 0,    maxAvgSpeed_kmh: 999,  minSteps: 50,  minDuration_sec: 120, usesGPS: false, usesPedometer: true  },
};

function getWorkoutThreshold(workoutType) {
  return WORKOUT_THRESHOLDS[(workoutType || "").toLowerCase()] || WORKOUT_THRESHOLDS.hiit;
}

function fmtDurationSec(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function calculateIntegrityScore({ workoutType, distance_km, avgSpeed_kmh, duration_sec, stepCount }) {
  const t = getWorkoutThreshold(workoutType);
  let score = 0;
  const checks = [];

  if (t.usesGPS) {
    const passed = distance_km >= t.minDistance_km;
    if (passed) score += 30;
    checks.push({
      label:  "Distance",
      value:  passed ? `${distance_km.toFixed(2)}km` : `${distance_km.toFixed(2)}km (min ${t.minDistance_km}km)`,
      passed,
      points: passed ? 30 : 0,
    });
  } else {
    score += 30;
    checks.push({ label: "Distance", value: "Indoor ✅", passed: true, points: 30 });
  }

  if (t.usesGPS && avgSpeed_kmh > 0) {
    const tooFast = avgSpeed_kmh > t.maxAvgSpeed_kmh;
    const tooSlow = avgSpeed_kmh < t.minAvgSpeed_kmh;
    const passed  = !tooFast && !tooSlow;
    if (passed) score += 25;
    checks.push({
      label:  "Avg Speed",
      value:  tooFast ? `${avgSpeed_kmh.toFixed(1)}km/h ⚠️ Too fast` : tooSlow ? `${avgSpeed_kmh.toFixed(1)}km/h (too slow)` : `${avgSpeed_kmh.toFixed(1)}km/h`,
      passed,
      points: passed ? 25 : 0,
      flag:   tooFast ? "POSSIBLE_VEHICLE" : null,
    });
  } else if (!t.usesGPS) {
    score += 25;
    checks.push({ label: "Avg Speed", value: "Indoor — N/A ✅", passed: true, points: 25 });
  } else {
    checks.push({ label: "Avg Speed", value: "No GPS data", passed: false, points: 0 });
  }

  const durPassed = duration_sec >= t.minDuration_sec;
  if (durPassed) score += 20;
  checks.push({
    label:  "Duration",
    value:  durPassed ? fmtDurationSec(duration_sec) : `${fmtDurationSec(duration_sec)} (min ${Math.round(t.minDuration_sec / 60)} mins)`,
    passed: durPassed,
    points: durPassed ? 20 : 0,
  });

  if (t.usesPedometer) {
    if (stepCount >= t.minSteps) {
      score += 25;
      checks.push({ label: "Steps", value: `${stepCount.toLocaleString()} steps`, passed: true, points: 25 });
    } else if (stepCount === 0) {
      score += 12;
      checks.push({ label: "Steps", value: "Sensor unavailable", passed: null, points: 12 });
    } else {
      checks.push({ label: "Steps", value: `${stepCount} steps (min ${t.minSteps})`, passed: false, points: 0 });
    }
  } else {
    score += 25;
    checks.push({ label: "Steps", value: "Not required ✅", passed: true, points: 25 });
  }

  const vehicleFlag = checks.some(c => c.flag === "POSSIBLE_VEHICLE");
  const isVerified  = score >= 60;
  return {
    score,
    maxScore:    100,
    isVerified,
    vehicleFlag,
    checks,
    verdict: isVerified ? "verified" : vehicleFlag ? "flagged_vehicle" : "insufficient",
  };
}

export { WORKOUT_THRESHOLDS, getWorkoutThreshold, fmtDurationSec, calculateIntegrityScore };
