function isRealWorkout(ex) {
  return ex && ex.verified === true && (ex.caloriesBurned || 0) > 0;
}

async function getAllWorkoutSessions(userId) {
  if (!userId) return [];
  try {
    const { supabase } = await import("../lib/supabase");
    const { data, error } = await supabase
      .from("exercise_logs")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });
    if (error) return [];
    return (data || []).filter(isRealWorkout);
  } catch (_e) {
    return [];
  }
}

function filterSessionsByRange(sessions, range) {
  const now = new Date();
  const ranges = {
    week: 7, month: 30, "3month": 90, year: 365,
  };
  const days = ranges[range] || 30;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return sessions.filter(s => new Date(s.date) >= cutoff);
}

function groupByMonth(sessions) {
  const groups = {};
  sessions.forEach(s => {
    const d = new Date(s.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return Object.entries(groups).map(([month, items]) => ({
    month,
    count: items.length,
    calories: items.reduce((sum, s) => sum + (s.calories_burned || 0), 0),
  }));
}

function getFavouriteType(sessions) {
  if (!sessions.length) return null;
  const counts = {};
  sessions.forEach(s => {
    const name = s.name || "Unknown";
    counts[name] = (counts[name] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
}

function calcStreak(sessions) {
  if (!sessions.length) return 0;
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    if (dates[i] === expected) streak++;
    else break;
  }
  return streak;
}

function calcPersonalBests(sessions) {
  const bests = {};
  sessions.forEach(s => {
    const type = s.name || "Unknown";
    if (!bests[type] || (s.calories_burned || 0) > (bests[type].calories || 0)) {
      bests[type] = {
        calories: s.calories_burned || 0,
        distance: s.distance_km || 0,
        duration: s.duration_min || 0,
        date: s.date,
      };
    }
  });
  return bests;
}

function calcTrend(sessions) {
  if (sessions.length < 2) return "stable";
  const recent = sessions.slice(0, Math.min(5, Math.floor(sessions.length / 2)));
  const older = sessions.slice(Math.min(5, Math.floor(sessions.length / 2)));
  const recentAvg = recent.reduce((s, e) => s + (e.calories_burned || 0), 0) / (recent.length || 1);
  const olderAvg = older.reduce((s, e) => s + (e.calories_burned || 0), 0) / (older.length || 1);
  if (recentAvg > olderAvg * 1.1) return "up";
  if (recentAvg < olderAvg * 0.9) return "down";
  return "stable";
}

function getWorkoutTypeColor(name) {
  const colors = {
    running: "#F43F8E", cycling: "#3B82F6", walking: "#10B981",
    hiking: "#F59E0B", hiit: "#FB923C", dancing: "#EC4899",
    jumprope: "#7C3AED", squats: "#14B8A6",
  };
  return colors[(name || "").toLowerCase()] || "#FF6B35";
}

function getWorkoutEmoji(name) {
  const emojis = {
    running: "🏃", cycling: "🚴", walking: "🚶", hiking: "🥾",
    hiit: "🔥", dancing: "💃", jumprope: "🪢", squats: "🦵",
  };
  return emojis[(name || "").toLowerCase()] || "💪";
}

export {
  isRealWorkout, getAllWorkoutSessions, filterSessionsByRange,
  groupByMonth, getFavouriteType, calcStreak, calcPersonalBests,
  calcTrend, getWorkoutTypeColor, getWorkoutEmoji,
};
