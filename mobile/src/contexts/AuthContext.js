import React, { useState, useEffect, useCallback, useContext, createContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import { COACH_CREDENTIALS, isVIPAccount } from "../lib/constants";
import { getAuthErrorMessage } from "../services/sync";

const AuthCtx = createContext(null);

function AuthProvider({ children }) {
  const [session,     setSession]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [clients,     setClients]     = useState([]);

  useEffect(() => {
    async function restoreSession() {
      try {
        const stored = await AsyncStorage.getItem("gofit_clients");
        if (stored) {
          const parsed = JSON.parse(stored);
          const all = [];
          parsed.forEach(c => { if (!all.find(x => x.id === c.id)) all.push(c); });
          setClients(all);
        }

        const { data: { session: cloudSession } } = await supabase.auth.getSession();

        if (cloudSession?.user) {
          const userId    = cloudSession.user.id;
          const userEmail = cloudSession.user.email;
          const isCoach   = userEmail === COACH_CREDENTIALS.email.toLowerCase();

          if (isCoach) {
            const s = { userId: COACH_CREDENTIALS.id, userType: "coach", name: COACH_CREDENTIALS.name, email: COACH_CREDENTIALS.email, loginTime: new Date().toISOString() };
            await AsyncStorage.setItem("gofit_session", JSON.stringify(s));
            setSession(s);
            setAuthLoading(false);
            return;
          }

          const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
          const name = profile?.name || userEmail.split("@")[0];
          if (profile?.onboarded) {
            await AsyncStorage.setItem(`gf_onboarded_${userId}`, "true");
            await AsyncStorage.setItem("onboardingComplete", "true");
          }
          const s = { userId, userType: "client", name, email: userEmail, loginTime: new Date().toISOString() };
          await AsyncStorage.setItem("gofit_session", JSON.stringify(s));
          setSession(s);
          setAuthLoading(false);
          return;
        }

        const cached = await AsyncStorage.getItem("gofit_session");
        if (cached) {
          setSession(JSON.parse(cached));
          setAuthLoading(false);
          return;
        }
      } catch (_e) {}
      setAuthLoading(false);
    }

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === "SIGNED_OUT") setSession(null);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email, password) {
    const trimEmail = email.trim().toLowerCase();

    if (trimEmail === COACH_CREDENTIALS.email.toLowerCase() && btoa(password) === COACH_CREDENTIALS.password) {
      const s = { userId: COACH_CREDENTIALS.id, userType: "coach", name: COACH_CREDENTIALS.name, email: COACH_CREDENTIALS.email, loginTime: new Date().toISOString() };
      await AsyncStorage.setItem("gofit_session", JSON.stringify(s));
      setSession(s);
      return { ok: true, type: "coach" };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimEmail, password });
      if (error) throw error;

      const userId    = data.user?.id;
      const userEmail = data.user?.email;

      if (isVIPAccount(userEmail)) {
        await supabase.from("profiles").update({ subscription: "annual", is_vip: true }).eq("id", userId);
      }

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      const name = profile?.name || userEmail.split("@")[0];

      if (profile?.onboarded) {
        await AsyncStorage.setItem(`gf_onboarded_${userId}`, "true");
        await AsyncStorage.setItem("onboardingComplete", "true");
      }

      const s = { userId, userType: "client", name, email: userEmail, loginTime: new Date().toISOString() };
      await AsyncStorage.setItem("gofit_session", JSON.stringify(s));
      await AsyncStorage.setItem("userLoggedIn", "true");
      await AsyncStorage.setItem("userId", userId);
      if (profile) await AsyncStorage.setItem(`gofit_profile_${userId}`, JSON.stringify(profile));
      setSession(s);
      return { ok: true, type: "client", userId };
    } catch (supabaseError) {
      console.log("[login] CATCH supabaseError (raw):", supabaseError);
      return { ok: false, error: "Incorrect email or password. Please try again." };
    }
  }

  async function signUp(data) {
    const trimEmail = data.email.trim().toLowerCase();

    try {
      const { data: authData, error } = await supabase.auth.signUp({ email: trimEmail, password: data.password });
      console.log("[signUp] RAW authData.user:", authData?.user?.id ?? "null");
      console.log("[signUp] RAW authData.session:", authData?.session ? "PRESENT" : "NULL");
      if (error) {
        console.log("[signUp] STEP 1 FAILED — auth.signUp error:", error.message);
        throw error;
      }

      const userId    = authData.user?.id;
      const userEmail = trimEmail;
      if (!userId) throw new Error("Signup failed — no user id returned");

      const accessToken = authData.session?.access_token;
      console.log("[signUp] STEP 1 OK — userId:", userId);

      const profilePayload = {
        id:           userId,
        email:        userEmail,
        name:         data.name || "",
        subscription: isVIPAccount(userEmail) ? "annual" : "free",
        is_vip:       isVIPAccount(userEmail),
        onboarded:    false,
        member_since: new Date().toISOString(),
        created_at:   new Date().toISOString(),
      };

      let profileSaved = false;

      if (accessToken) {
        try {
          const res = await fetch(SUPABASE_URL + "/rest/v1/profiles", {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "apikey":        SUPABASE_ANON_KEY,
              "Authorization": "Bearer " + accessToken,
              "Prefer":        "resolution=merge-duplicates",
            },
            body: JSON.stringify(profilePayload),
          });
          const text = await res.text();
          console.log("[signUp] STEP 2 (session token) status:", res.status, text);
          if (res.ok || res.status === 201 || res.status === 200) profileSaved = true;
        } catch (e) {
          console.log("[signUp] STEP 2 EXCEPTION:", e.message);
        }
      }

      if (!profileSaved) {
        try {
          const res = await fetch(SUPABASE_URL + "/rest/v1/profiles", {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "apikey":        SUPABASE_ANON_KEY,
              "Authorization": "Bearer " + SUPABASE_ANON_KEY,
              "Prefer":        "resolution=merge-duplicates",
            },
            body: JSON.stringify(profilePayload),
          });
          const text = await res.text();
          console.log("[signUp] STEP 2b (anon key) status:", res.status, text);
          if (res.ok || res.status === 201 || res.status === 200) profileSaved = true;
        } catch (e) {
          console.log("[signUp] STEP 2b EXCEPTION:", e.message);
        }
      }

      await AsyncStorage.setItem("gofit_profile_" + userId, JSON.stringify({
        id:    userId,
        email: userEmail,
        ...data,
        subscription: isVIPAccount(userEmail) ? "annual" : "free",
      }));

      const newClient = {
        id: userId, type: "client", name: data.name, email: trimEmail,
        password: btoa(data.password),
        securityQuestion: data.securityQuestion || "What year were you born?",
        securityAnswer:   data.securityAnswer ? btoa(data.securityAnswer.toLowerCase().trim()) : "",
        plan: isVIPAccount(trimEmail) ? "annual" : "free",
        goal: "Improve Fitness", calories: 0, target: 2000, sleep: 0, streak: 0,
        weight: 0, goalWeight: 0, age: 0, gender: "other", height: 0,
        memberSince: new Date().toISOString().split("T")[0], lastActive: "just now", activity_level: "sedentary",
      };
      const updated = [...clients, newClient];
      setClients(updated);
      const registered = updated.filter(c => !c.id.startsWith("mock_"));
      await AsyncStorage.setItem("gofit_clients", JSON.stringify(registered));

      const s = { userId, userType: "client", name: data.name, email: trimEmail, loginTime: new Date().toISOString() };
      await AsyncStorage.setItem("gofit_session", JSON.stringify(s));
      setSession(s);
      return { ok: true, type: "client", clientId: userId };
    } catch (supabaseError) {
      console.log("[signUp] CAUGHT ERROR:", supabaseError?.message);
      return { ok: false, error: getAuthErrorMessage(supabaseError) };
    }
  }

  async function logout() {
    try { await supabase.auth.signOut(); } catch (_e) {}
    try {
      const keys = await AsyncStorage.getAllKeys();
      if (keys && keys.length) await AsyncStorage.multiRemove(keys);
    } catch (_e) {}
    setSession(null);
  }

  async function updateClientPassword(email, newPassword) {
    const trimEmail = email.trim().toLowerCase();
    const updated = clients.map(c =>
      c.email.toLowerCase() === trimEmail ? { ...c, password: btoa(newPassword) } : c
    );
    setClients(updated);
    const registered = updated.filter(c => !c.id.startsWith("mock_"));
    await AsyncStorage.setItem("gofit_clients", JSON.stringify(registered));
    const keys = await AsyncStorage.getAllKeys();
    for (const k of keys.filter(k => k.startsWith("gf_profile"))) {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const prof = JSON.parse(raw);
      if (prof.email && prof.email.toLowerCase() === trimEmail) {
        await AsyncStorage.setItem(k, JSON.stringify({ ...prof, password: btoa(newPassword) }));
        break;
      }
    }
  }

  async function saveCoachNote(clientId, note) {
    await AsyncStorage.setItem(`gofit_coachnotes_${clientId}`, note);
  }
  const loadCoachNote = useCallback(async (clientId) => {
    const n = await AsyncStorage.getItem(`gofit_coachnotes_${clientId}`);
    return n || "";
  }, []);

  return (
    <AuthCtx.Provider value={{ session, authLoading, clients, login, signUp, logout, updateClientPassword, saveCoachNote, loadCoachNote }}>
      {children}
    </AuthCtx.Provider>
  );
}

export { AuthCtx, AuthProvider };
