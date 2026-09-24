import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
    flowType:           "implicit",
  },
  realtime: {
    logLevel: "warn",
    heartbeatIntervalMs: 15000,
  },
  global: {
    headers: {
      "X-Client-Info": "gofit-expo-snack",
    },
  },
});

function subscribeTable(tableName, filter, handler) {
  const { uid, eq } = filter || {};
  const channelName = `realtime:${tableName}${uid ? `:user_id=eq.${uid}` : ""}${eq ? `:${eq}` : ""}`;
  const channel = supabase.channel(channelName);
  const onEvent = (evtType, rec) => {
    try { handler(evtType, rec); } catch (_e) {}
  };
  const filterObj = uid ? { filter: `user_id=eq.${uid}` } : eq ? { filter: eq } : undefined;
  channel
    .on("postgres_changes", { event: "INSERT", schema: "public", table: tableName, ...(filterObj || {}) }, (payload) => onEvent("INSERT", payload.new))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: tableName, ...(filterObj || {}) }, (payload) => onEvent("UPDATE", { ...payload.new, _old: payload.old }))
    .on("postgres_changes", { event: "DELETE", schema: "public", table: tableName, ...(filterObj || {}) }, (payload) => onEvent("DELETE", payload.old))
    .subscribe();
  return {
    unsubscribe: () => {
      try { supabase.removeChannel(channel); } catch (_e) {}
    },
  };
}

function uidFilter(userId) {
  return userId ? { uid: userId } : {};
}

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, subscribeTable, uidFilter };
