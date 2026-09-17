const SLEEP_GOAL = 7.5;

function parseSleepTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

function calcSleepDuration(bedTime, wakeTime) {
  const b = parseSleepTime(bedTime);
  const w = parseSleepTime(wakeTime);
  let bedMins  = b.h * 60 + b.m;
  let wakeMins = w.h * 60 + w.m;
  if (wakeMins <= bedMins) wakeMins += 1440;
  const diff = wakeMins - bedMins;
  return Math.round(diff / 60 * 100) / 100;
}

function sleepQuality(hours) {
  if (hours < 5)  return "poor";
  if (hours < 6)  return "fair";
  if (hours <= 8) return "good";
  return "great";
}

function sleepQualityEmoji(q) {
  return { poor: "😟", fair: "😐", good: "😊", great: "🌟" }[q] || "😊";
}

function fmtSleepDur(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmt12h(hhmm) {
  if (!hhmm) return "";
  const { h, m } = parseSleepTime(hhmm);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function sleepBarColor(hours) {
  if (hours < 5)  return "#EF4444";
  if (hours < 6)  return "#F59E0B";
  if (hours <= 8) return "#10B981";
  return "#F43F8E";
}

export {
  SLEEP_GOAL, parseSleepTime, calcSleepDuration,
  sleepQuality, sleepQualityEmoji, fmtSleepDur, fmt12h, sleepBarColor,
};
