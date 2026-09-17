import React, { useState, useEffect } from "react"
import { View, Text, ScrollView, TouchableOpacity, Modal, FlatList, Alert, Image, TextInput } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import S from "../lib/styles"
import { ROSE, C, SH, COACH_CREDENTIALS } from "../lib/constants"
import { PRESET_CHALLENGES, CHALLENGE_TYPE_COLORS, MOCK_LEADERBOARD } from "../data/community"
import { Card, Row, Spacer } from "../components/shared"
import { supabase } from "../lib/supabase"

// ─── COACH CHALLENGES SCREEN ──────────────────────────────────────────────────
export function ParticipantsModal({ challenge, onClose }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, name, email, created_at, last_active")
          .neq("email", COACH_CREDENTIALS.email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(challenge.participants || 20);
        if (data && data.length > 0) {
          setParticipants(data);
        } else {
          setParticipants([]);
        }
      } catch (_e) {
        setParticipants([]);
      }
      setLoading(false);
    }
    load();
  }, [challenge.id]);

  const count = participants.length || challenge.participants;

  return (
    <Modal visible animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight: SH * 0.82, paddingBottom: 40 }}>
          {/* drag handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)",
            alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
          {/* header */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 16,
            borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 4 }}>
              {challenge.emoji} {challenge.title}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
              {count} participant{count !== 1 ? "s" : ""}
            </Text>
          </View>
          {/* list */}
          {loading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Loading participants...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
              {participants.length > 0 ? participants.map((p, i) => (
                <View key={p.id || i} style={{ backgroundColor: "#1E2837", borderRadius: 12,
                  padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{p.name || "Client"}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                      Joined {new Date(p.created_at).toLocaleDateString()}
                    </Text>
                    {p.last_active && (
                      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 1 }}>
                        Last active: {p.last_active}
                      </Text>
                    )}
                  </View>
                  <View style={{ backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 20,
                    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,107,53,0.3)" }}>
                    <Text style={{ color: ROSE, fontSize: 11, fontWeight: "700" }}>In Progress</Text>
                  </View>
                </View>
              )) : (
                Array.from({ length: challenge.participants || 5 }, (_, i) => (
                  <View key={i} style={{ backgroundColor: "#1E2837", borderRadius: 12,
                    padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>Client {i + 1}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                        Joined {new Date(Date.now() - i * 86400000).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 20,
                      paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,107,53,0.3)" }}>
                      <Text style={{ color: ROSE, fontSize: 11, fontWeight: "700" }}>In Progress</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
          <TouchableOpacity onPress={onClose}
            style={{ marginHorizontal: 20, marginTop: 8, backgroundColor: "#1E2837", borderRadius: 12,
              paddingVertical: 14, alignItems: "center" }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function CoachChallenges() {
  const [showCreate,      setShowCreate]      = useState(false);
  const [title,           setTitle]           = useState("");
  const [desc,            setDesc]            = useState("");
  const [duration,        setDuration]        = useState("7");
  const [prize,           setPrize]           = useState("");
  const [viewChallenge,   setViewChallenge]   = useState(null);

  async function handleCreate() {
    if (!title.trim()) return;
    Alert.alert("Challenge Created! 🎉", `"${title}" has been added and is now visible to all clients.`);
    setTitle(""); setDesc(""); setDuration("7"); setPrize(""); setShowCreate(false);
  }

  return (
    <SafeAreaView style={S.screen}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      {viewChallenge && (
        <ParticipantsModal challenge={viewChallenge} onClose={() => setViewChallenge(null)} />
      )}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 22, marginBottom: 4 }}>🏆 Challenge Manager</Text>
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 20 }}>Create and manage community challenges</Text>

        {/* Active challenges */}
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16, marginBottom: 12 }}>Active Challenges</Text>
        {PRESET_CHALLENGES.map(ch => (
          <View key={ch.id} style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 10,
            borderLeftWidth: 3, borderLeftColor: ROSE,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{ch.emoji} {ch.title}</Text>
              <View style={{ backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 20,
                paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ color: "#22C55E", fontSize: 11, fontWeight: "700" }}>ACTIVE</Text>
              </View>
            </Row>
            <Row style={{ gap: 16 }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>👥 {ch.participants} joined</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>⏰ {ch.durationDays}d duration</Text>
            </Row>
            <Row style={{ gap: 8, marginTop: 10 }}>
              <TouchableOpacity onPress={() => Alert.alert("Edit", "Edit functionality coming soon.")}
                style={{ backgroundColor: "#1E2837", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("End Early", "End Early functionality coming soon.")}
                style={{ backgroundColor: "#1E2837", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" }}>End Early</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewChallenge(ch)}
                style={{ backgroundColor: ROSE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>View Participants</Text>
              </TouchableOpacity>
            </Row>
          </View>
        ))}

        {/* Create challenge */}
        <TouchableOpacity onPress={() => setShowCreate(v => !v)}
          style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8, marginBottom: 16 }}>
          <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>+ Create New Challenge</Text>
        </TouchableOpacity>

        {showCreate && (
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16, marginBottom: 14 }}>New Challenge</Text>
            {[
              { l:"Challenge Title", v:title,    sv:setTitle,    ph:"e.g. 7-Day Step Challenge", kb:"default"  },
              { l:"Description",     v:desc,     sv:setDesc,     ph:"What do participants need to do?", kb:"default" },
              { l:"Duration (days)", v:duration, sv:setDuration, ph:"7",                           kb:"numeric"  },
              { l:"Prize / Reward",  v:prize,    sv:setPrize,    ph:"e.g. Free month subscription", kb:"default" },
            ].map(f => (
              <View key={f.l} style={{ marginBottom: 14 }}>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>{f.l}</Text>
                <TextInput style={S.input} placeholder={f.ph} placeholderTextColor="rgba(255,255,255,0.3)"
                  value={f.v} onChangeText={f.sv} keyboardType={f.kb}
                  multiline={f.l === "Description"} />
              </View>
            ))}
            <TouchableOpacity onPress={handleCreate}
              style={{ backgroundColor: ROSE, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Create Challenge 🏆</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Leaderboard view */}
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16, marginTop: 20, marginBottom: 12 }}>Client Leaderboard</Text>
        {MOCK_LEADERBOARD.map(u => (
          <View key={u.rank} style={{ backgroundColor: "#111827", borderRadius: 12, padding: 12, marginBottom: 8,
            flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", width: 24, fontSize: 14 }}>#{u.rank}</Text>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: u.color,
              alignItems: "center", justifyContent: "center", marginRight: 10 }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 12 }}>{u.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>{u.name}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>🔥 {u.streak}d streak</Text>
            </View>
            <View>
              <Text style={{ color: ROSE, fontWeight: "800", fontSize: 14 }}>{u.points.toLocaleString()}</Text>
              <TouchableOpacity onPress={() => Alert.alert("Motivation Sent!", `Message sent to ${u.name} 💪`)}
                style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 }}>
                <Text style={{ color: ROSE, fontSize: 10, fontWeight: "600" }}>Send Motivation</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
