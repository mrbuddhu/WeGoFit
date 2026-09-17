import React, { useState, useContext, useRef, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, Platform, Animated, FlatList, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import S from "../lib/styles";
import { ROSE, C, SH, LOGO_URI } from "../lib/constants";
import { Ctx } from "../contexts/AppContext";
import { getAICoachReply, generateWelcomeMessage } from "../services/aiCoach";
import { Card, Row, Spacer } from "../components/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

const { width: SW } = Dimensions.get("window");

// PaywallCtx is defined in the monolith App.js; replicate a minimal local
// fallback so this screen remains functional when consumed independently.
import { createContext } from "react";
const PaywallCtx = createContext({
  subStatus: "active",
  trialDays: 0,
  openPaywall: () => {},
  unreadCoachMessages: 0,
  clearCoachUnread: () => {},
  incrementCoachUnread: () => {},
  activeRoute: "Home",
});

// ─── COACH ────────────────────────────────────────────────────────────────────
const KEY_OFFLINE_QUEUE = "gofit_offline_queue";

// ─── TYPING DOT ───────────────────────────────────────────────────────────────
export function TypingDot({ delay }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1,   duration: 380, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 380, useNativeDriver: true }),
      ])
    ).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: ROSE, opacity }} />;
}

// ─── WELCOME MESSAGE BUBBLE ───────────────────────────────────────────────────
export function WelcomeMessageBubble({ message }) {
  return (
    <View style={{ backgroundColor: "#1A1A2E", borderRadius: 20, padding: 20, marginBottom: 12, marginHorizontal: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: ROSE, alignItems: "center",
          justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF30" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>TB</Text>
        </View>
        <View>
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>Coach TinaBarks 🌸</Text>
          <Text style={{ color: "#FFFFFF60", fontSize: 12, marginTop: 2 }}>WeGoFit Head Coach · Just now</Text>
        </View>
      </View>
      <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 10 }}>
        {message.greeting} {message.name}! 🎉
      </Text>
      <Text style={{ color: "#FFFFFFCC", fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
        Welcome to the WeGoFit family — I am so excited you are here!{"\n\n"}You have just taken the BIGGEST step — deciding to start. That takes real courage and I see you! 💪{"\n\n"}Your goal to {message.goalText} is 100% achievable. I have designed WeGoFit to help East African clients just like you get real results.
      </Text>
      <View style={{ backgroundColor: "#FFFFFF15", borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <Text style={{ color: ROSE, fontSize: 13, fontWeight: "700", marginBottom: 10 }}>🎯 Your Quick Start Today:</Text>
        {message.quickStart.map((item, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: ROSE, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{i + 1}</Text>
            </View>
            <Text style={{ color: "#FFFFFFCC", fontSize: 13, flex: 1 }}>{item}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: ROSE, fontSize: 14, fontWeight: "700", textAlign: "right" }}>— Coach TinaBarks 🌸</Text>
    </View>
  );
}

// ─── COACH SCREEN ─────────────────────────────────────────────────────────────
export function CoachScreen({ navigation }) {
  const { chatMsgs, saveChat, isOnline, profile } = useContext(Ctx);
  const { clearCoachUnread, incrementCoachUnread, activeRoute } = useContext(PaywallCtx);
  const [msgs,         setMsgs]         = useState([]);
  const [input,        setInput]        = useState("");
  const [typing,       setTyping]       = useState(false);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [readAt,       setReadAt]       = useState(null); // timestamp when screen was opened
  const listRef    = useRef(null);
  const prevOnline = useRef(isOnline);

  // Clear unread badge when Coach screen is opened
  useEffect(() => {
    clearCoachUnread();
    setReadAt(new Date().toISOString());
  }, []);

  // Also clear if user navigates back to Coach tab while it's focused
  useEffect(() => {
    if (activeRoute === "Coach") {
      clearCoachUnread();
      setReadAt(new Date().toISOString());
    }
  }, [activeRoute]);

  // Load chat history and check welcome message
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    async function loadMessages() {
      const raw = await AsyncStorage.getItem(KEY_OFFLINE_QUEUE).catch(() => null);
      if (raw) setOfflineQueue(JSON.parse(raw));

      let base = chatMsgs && chatMsgs.length > 0 ? chatMsgs : [];

      // Try Supabase first
      if (profile?.id) {
        try {
          const { data } = await supabase
            .from("messages")
            .select("*")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: true })
            .limit(100);
          if (data && data.length > 0) {
            base = data.map(m => ({
              id:        m.id,
              text:      m.text,
              sender:    m.sender,
              role:      m.sender,
              isAIReply: m.is_ai,
              isWelcome: m.is_welcome,
              timestamp: m.created_at,
              ts:        m.created_at,
              read:      m.read,
            }));
          }
        } catch (_e) {
          // Supabase failed — use AsyncStorage fallback
          try {
            const cached = await AsyncStorage.getItem("gofit_chat_" + (profile?.id || ""));
            if (cached) base = JSON.parse(cached);
          } catch (_e2) {}
        }
      }

      // Welcome message check
      const userId  = profile?.id || profile?.email || "";
      const flagKey = "gofit_welcome_sent_" + userId;
      const welcomeSent = await AsyncStorage.getItem(flagKey).catch(() => null);
      if (!welcomeSent && profile?.name) {
        const welcome = generateWelcomeMessage(profile);
        const hasWelcome = base.some(m => m.isWelcome);
        const withWelcome = hasWelcome ? base : [welcome, ...base];
        setMsgs(withWelcome);
        await AsyncStorage.setItem(flagKey, "true");
      } else {
        setMsgs(base);
      }
    }
    loadMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const flushQueue = useCallback(async () => {
    const queue = [...offlineQueue];
    setOfflineQueue([]);
    await AsyncStorage.removeItem(KEY_OFFLINE_QUEUE);
    for (const qMsg of queue) {
      const sent = { ...qMsg, pending: false };
      setMsgs(prev => { const next = prev.map(m => m.id === qMsg.id ? sent : m); saveChat(next); return next; });
      await new Promise(r => setTimeout(r, 800));
      const reply    = await getAICoachReply(qMsg.text, profile);
      const coachMsg = { id: `c${Date.now()}`, role: "coach", text: reply, ts: new Date().toISOString(), isAIReply: true };
      setMsgs(prev => { const next = [...prev, coachMsg]; saveChat(next); return next; });
      if (activeRoute !== "Coach") incrementCoachUnread();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineQueue, activeRoute]);

  useEffect(() => {
    if (isOnline && !prevOnline.current && offlineQueue.length > 0) flushQueue();
    prevOnline.current = isOnline;
  }, [isOnline, offlineQueue.length, flushQueue]);

  async function send() {
    if (!input.trim() || typing) return;
    const userMsg = { id: `u${Date.now()}`, role: "user", text: input.trim(), ts: new Date().toISOString(), pending: !isOnline };
    const updated = [...msgs, userMsg];
    setMsgs(updated); saveChat(updated); setInput("");

    if (!isOnline) {
      const newQueue = [...offlineQueue, userMsg];
      setOfflineQueue(newQueue);
      AsyncStorage.setItem(KEY_OFFLINE_QUEUE, JSON.stringify(newQueue));
      return;
    }

    // Sync user message to Supabase
    try {
      await supabase.from("messages").insert({
        user_id: profile?.id,
        sender:  "client",
        text:    userMsg.text,
        is_ai:   false,
        read:    false,
      });
    } catch (_e) {}

    setTyping(true);
    const delay = 1500 + Math.random() * 1000;
    await new Promise(r => setTimeout(r, delay));
    const aiText   = await getAICoachReply(userMsg.text, profile);
    setTyping(false);
    const coachMsg = { id: `c${Date.now()}`, role: "coach", text: aiText, ts: new Date().toISOString(), isAIReply: true, isNew: activeRoute !== "Coach" };
    const final    = [...updated, coachMsg];
    setMsgs(final); saveChat(final);

    // Increment unread badge if user is not currently on Coach screen
    if (activeRoute !== "Coach") incrementCoachUnread();

    // Sync AI reply to Supabase
    try {
      await supabase.from("messages").insert({
        user_id: profile?.id,
        sender:  "coach",
        text:    aiText,
        is_ai:   true,
        read:    true,
      });
    } catch (_e) {}

    // Flag for coach dashboard
    try {
      await AsyncStorage.setItem("gofit_unread_" + (profile?.id || profile?.email || ""), JSON.stringify({
        clientName: profile?.name, lastMessage: userMsg.text, aiReply: aiText,
        timestamp: new Date().toISOString(), needsReply: true,
      }));
    } catch (_e) { /* silent */ }
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <SafeAreaView style={S.screen}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#070B14",
        paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
        borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.1)" }}>
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#1E2837",
            justifyContent: "center", alignItems: "center", marginRight: 12 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600" }}>‹</Text>
        </TouchableOpacity>
        {/* Coach avatar */}
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: ROSE,
          justifyContent: "center", alignItems: "center", marginRight: 10 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>CT</Text>
        </View>
        {/* Coach info */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>Coach TinaBarks</Text>
          <Text style={{ color: ROSE, fontSize: 12 }}>
            {isOnline ? "WeGoFit Head Coach 👑" : "Offline · Messages queued"}
          </Text>
        </View>
      </View>

      {offlineQueue.length > 0 && isOnline && (
        <View style={{ backgroundColor: "#ECFDF5", paddingVertical: 8, paddingHorizontal: 16 }}>
          <Text style={{ color: "#065F46", fontSize: 12, fontWeight: "600" }}>
            Sending {offlineQueue.length} queued message{offlineQueue.length > 1 ? "s" : ""}...
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={[...msgs, ...(typing ? [{ id: "typing", role: "typing" }] : [])]}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            if (item.isWelcome) return <WelcomeMessageBubble message={item} />;

            if (item.role === "typing") {
              return (
                <Row style={{ alignItems: "flex-end" }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: ROSE,
                    alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>TB</Text>
                  </View>
                  <View style={{ backgroundColor: C.cardLight, borderRadius: 18, paddingHorizontal: 14,
                    paddingVertical: 12, flexDirection: "row", gap: 5, alignItems: "center" }}>
                    {[0, 1, 2].map(i => <TypingDot key={i} delay={i * 180} />)}
                  </View>
                  <Text style={{ fontSize: 11, color: C.grey, fontStyle: "italic", marginLeft: 8 }}>
                    TinaBarks is typing...
                  </Text>
                </Row>
              );
            }

            const isUser = item.role === "user";
            const isUnread = !isUser && item.isNew && item.ts && readAt && item.ts > readAt;
            return (
              <View style={{ alignItems: isUser ? "flex-end" : "flex-start" }}>
                <Row style={{ alignItems: "flex-end", flexDirection: isUser ? "row-reverse" : "row" }}>
                  {!isUser && (
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ROSE,
                      alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>TB</Text>
                    </View>
                  )}
                  <View style={[S.bubble, {
                    backgroundColor: isUser ? ROSE : C.card,
                    marginLeft: isUser ? 8 : 0, marginRight: isUser ? 0 : 8,
                    maxWidth: SW * 0.72,
                    opacity: item.pending ? 0.65 : 1,
                    borderLeftWidth: item.isNew ? 3 : 0,
                    borderLeftColor: item.isNew ? ROSE : "transparent",
                  }]}>
                    <Text style={{ color: isUser ? "#FFFFFF" : C.text, fontSize: 14, lineHeight: 20 }}>{item.text}</Text>
                    {item.pending && (
                      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 3 }}>Pending — will send when online</Text>
                    )}
                  </View>
                </Row>
                <Text style={{ color: "#AAAAAA", fontSize: 10, marginTop: 2, marginHorizontal: 36 }}>{fmtTime(item.ts)}</Text>
                {item.isAIReply && (
                  <Text style={{ fontSize: 10, color: C.grey, fontStyle: "italic", marginTop: 2, marginLeft: 36 }}>
                    🤖 AI Assistant · TinaBarks will follow up personally
                  </Text>
                )}
              </View>
            );
          }}
        />

        {!isOnline && (
          <View style={{ backgroundColor: "#FEF3C7", paddingVertical: 8, paddingHorizontal: 14 }}>
            <Text style={{ color: "#92400E", fontSize: 12, textAlign: "center" }}>
              You are offline. Messages will be queued and sent automatically when you reconnect.
            </Text>
          </View>
        )}

        <View style={{ flexDirection: "row", padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: C.cardLight, backgroundColor: C.bg }}>
          <TextInput
            style={[S.input, { flex: 1, paddingVertical: 10 }]}
            placeholder={isOnline ? "Ask Coach TinaBarks anything..." : "Type a message (will send when online)..."}
            placeholderTextColor={C.grey}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity onPress={send} disabled={!input.trim() || typing}
            style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
              backgroundColor: input.trim() && !typing ? ROSE : C.cardLight }}>
            <Text style={{ fontSize: 18, color: input.trim() && !typing ? "#FFFFFF" : C.grey }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
