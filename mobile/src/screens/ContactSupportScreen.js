import React, { useState, useContext } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import S from "../lib/styles";
import { ROSE, C } from "../lib/constants";
import { Ctx, useTheme } from "../contexts/AppContext";
import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, PrimaryBtn, Row, Spacer } from "../components/shared";

// ─── CONTACT SUPPORT SCREEN ───────────────────────────────────────────────────
export function ContactSupportScreen({ onBack }) {
  const { profile } = useContext(Ctx);
  const { theme }   = useTheme();
  const C2          = theme;
  const [subject,   setSubject]   = useState("General Question");
  const [message,   setMessage]   = useState("");
  const [sent,      setSent]      = useState(false);
  const [sending,   setSending]   = useState(false);
  const [ticketRef, setTicketRef] = useState("");

  const SUBJECTS = ["General Question","Technical Issue","Billing & Subscription",
    "Account Help","Meal Plan Question","Workout Advice","Feature Request","Other"];

  function generateTicketRef() {
    const now  = new Date();
    const yr   = now.getFullYear().toString().slice(-2);
    const mo   = String(now.getMonth() + 1).padStart(2, "0");
    const dy   = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `GF${yr}${mo}${dy}${rand}`;
  }

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    const ref    = generateTicketRef();
    setTicketRef(ref);
    const ticket = { ref, subject, message: message.trim(), from: profile?.name,
      email: profile?.email, sentAt: new Date().toISOString(), status: "pending" };
    try {
      const existing = await AsyncStorage.getItem("gofit_support_tickets");
      const tickets  = existing ? JSON.parse(existing) : [];
      tickets.push(ticket);
      await AsyncStorage.setItem("gofit_support_tickets", JSON.stringify(tickets));
    } catch (_e) { /* silent */ }
    try {
      await supabase.from("support_tickets").insert({
        user_id:    profile?.id,
        ref,
        subject,
        message:    message.trim(),
        from_name:  profile?.name  || "",
        from_email: profile?.email || "",
        status:     "pending",
      });
    } catch (_e) {}
    await new Promise(r => setTimeout(r, 1500));
    setSending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: C2.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#ECFDF5",
          alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Text style={{ fontSize: 40 }}>✅</Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: "800", color: C2.text, textAlign: "center", marginBottom: 12 }}>
          Message Sent!
        </Text>
        <Text style={{ fontSize: 15, color: C2.textSub, textAlign: "center", lineHeight: 24, marginBottom: 20 }}>
          Thank you {profile?.name}! 🙏{"\n\n"}Coach TinaBarks personally reviews every support message and will get back to you within 24 hours at:{"\n"}
          <Text style={{ color: ROSE, fontWeight: "700" }}>support@wegofit.app</Text>
        </Text>
        <View style={{ backgroundColor: C2.cardLight, borderRadius: 14, padding: 16, width: "100%", marginBottom: 24, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: C2.textSub, marginBottom: 4 }}>Your reference number</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: ROSE, letterSpacing: 2 }}>#{ticketRef}</Text>
          <Text style={{ fontSize: 11, color: C2.textSub, marginTop: 4, textAlign: "center" }}>Keep this for your records</Text>
        </View>
        <TouchableOpacity onPress={onBack}
          style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>Back to Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView style={{ flex: 1, backgroundColor: C2.bg }} contentContainerStyle={{ padding: 20, paddingTop: 50 }}
        keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 4 }}>
          <Text style={{ color: ROSE, fontSize: 16, fontWeight: "600" }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "800", color: C2.text, marginBottom: 4 }}>Contact Support 💬</Text>
        <Text style={{ fontSize: 14, color: C2.textSub, marginBottom: 24, lineHeight: 20 }}>
          We typically respond within 24 hours at{" "}
          <Text style={{ color: ROSE }}>support@wegofit.app</Text>
        </Text>

        <Text style={{ fontSize: 12, fontWeight: "600", color: C2.textSub, marginBottom: 6,
          textTransform: "uppercase", letterSpacing: 0.5 }}>From</Text>
        <View style={{ backgroundColor: C2.cardLight, borderRadius: 12, padding: 14, marginBottom: 16,
          flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 16 }}>👤</Text>
          <View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: C2.text }}>{profile?.name || "WeGoFit User"}</Text>
            <Text style={{ fontSize: 12, color: C2.textSub }}>{profile?.email || ""}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 12, fontWeight: "600", color: C2.textSub, marginBottom: 6,
          textTransform: "uppercase", letterSpacing: 0.5 }}>Subject</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {SUBJECTS.map(s => (
            <TouchableOpacity key={s} onPress={() => setSubject(s)}
              style={{ backgroundColor: subject === s ? ROSE : C2.cardLight, borderRadius: 20,
                paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
                borderWidth: 1, borderColor: subject === s ? ROSE : C2.border }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: subject === s ? "#FFFFFF" : C2.textSub }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={{ fontSize: 12, fontWeight: "600", color: C2.textSub, marginBottom: 6,
          textTransform: "uppercase", letterSpacing: 0.5 }}>Message</Text>
        <TextInput
          style={{ backgroundColor: C2.cardLight, borderRadius: 16, padding: 16, color: C2.text,
            fontSize: 15, minHeight: 160, textAlignVertical: "top", borderWidth: 1.5, lineHeight: 22,
            borderColor: message.length > 0 ? ROSE : C2.border }}
          placeholder={"Describe your issue or question in detail...\n\nThe more detail you provide the faster we can help you!"}
          placeholderTextColor={C2.textSub}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={1000}
        />
        <Text style={{ fontSize: 11, color: C2.textSub, textAlign: "right", marginTop: 4, marginBottom: 24 }}>
          {message.length}/1000
        </Text>

        <TouchableOpacity onPress={handleSend} disabled={!message.trim() || sending}
          style={{ backgroundColor: message.trim() && !sending ? ROSE : C2.border,
            borderRadius: 16, padding: 18, alignItems: "center", flexDirection: "row",
            justifyContent: "center", gap: 8 }}>
          {sending ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>Sending...</Text>
            </>
          ) : (
            <Text style={{ color: message.trim() ? "#FFFFFF" : C2.textSub, fontSize: 16, fontWeight: "800" }}>
              Send Message 📨
            </Text>
          )}
        </TouchableOpacity>
        <Text style={{ fontSize: 12, color: C2.textSub, textAlign: "center", marginTop: 16, lineHeight: 18 }}>
          🔒 Your message is private and secure. Only Coach TinaBarks has access to support messages.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
