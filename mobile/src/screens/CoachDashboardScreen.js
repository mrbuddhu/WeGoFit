import React, { useState, useContext, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, Modal, Alert, Image, Linking, ActivityIndicator, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import S from "../lib/styles";
import { ROSE, C, SH, LOGO_URI, COACH_CREDENTIALS, PLAN_PRICE, planMRR } from "../lib/constants";
import { AuthCtx } from "../contexts/AuthContext";
import { Card, PrimaryBtn, SecondaryBtn, Row, Spacer } from "../components/shared";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── COACH DASHBOARD ──────────────────────────────────────────────────────────

export function CoachAvatar({ name, size = 40 }) {
  const initials = name ? name.slice(0, 2).toUpperCase() : "??";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2,
      backgroundColor: "#FFF5F0", alignItems: "center", justifyContent: "center",
      borderWidth: 1.5, borderColor: ROSE_DIM }}>
      <Text style={{ color: ROSE, fontWeight: "800", fontSize: size * 0.35 }}>{initials}</Text>
    </View>
  );
}

export function PlanBadge({ plan }) {
  const map = {
    annual:  { bg: "#FEF3C7", text: "#D97706", label: "ANNUAL"  },
    monthly: { bg: "#FFF5F0", text: ROSE,      label: "PREMIUM" },
    free:    { bg: "#F3F4F6", text: "#888888", label: "FREE"    },
  };
  const s = map[plan] || map.free;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: s.bg }}>
      <Text style={{ color: s.text, fontSize: 10, fontWeight: "800" }}>{s.label}</Text>
    </View>
  );
}

export function KpiCard({ value, label, color }) {
  return (
    <View style={{ minWidth: 90, backgroundColor: "#111827", borderRadius: 14, padding: 14,
      borderTopWidth: 3, borderTopColor: color || ROSE,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
      shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
      elevation: 2, marginRight: 10, alignItems: "center" }}>
      <Text style={{ color: color || ROSE, fontSize: 24, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

// ── Coach Squad Feed ──────────────────────────────────────────────────────────
export function CoachSquadFeed() {
  const { session } = useContext(AuthCtx);
  const [feedPosts,   setFeedPosts]   = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedFilter,  setFeedFilter]  = useState("all");
  const [commentPost, setCommentPost] = useState(null);
  const [comments,    setComments]    = useState({});
  const [commentInput,setCommentInput]= useState("");
  const [activitySummary, setActivitySummary] = useState({ postsToday: 0, milestonesToday: 0 });

  const currentUserId = session?.userId || null;

  function mapDbPost(row) {
    const type = row.post_type || row.type || "thought";
    const TYPE_EMOJIS = { thought:"💬", workout:"🏃", meal:"🍽️", challenge:"🏆", water:"💧" };
    return {
      id:           row.id,
      userId:       row.user_id,
      userName:     row.user_name || "Member",
      userInitials: row.user_initials || "?",
      isCoach:      row.is_coach || false,
      isPinned:     row.is_pinned || false,
      type,
      emoji:        row.emoji || TYPE_EMOJIS[type] || "✨",
      content:      row.content || "",
      stats:        row.workout_data || null,
      likes:        row.likes || 0,
      likedBy:      row.liked_by || [],
      comments:     row.comments || 0,
      postedAt:     row.created_at,
    };
  }

  async function fetchFeed() {
    setFeedLoading(true);
    const { data, error } = await supabase
      .from("squad_feed")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const posts = data.map(mapDbPost);
      setFeedPosts(posts);
      const today = new Date().toISOString().split("T")[0];
      const todayPosts = posts.filter(p => p.postedAt && p.postedAt.startsWith(today));
      setActivitySummary({
        postsToday: todayPosts.length,
        milestonesToday: todayPosts.filter(p => p.type === "challenge" || p.type === "streak").length,
      });
    }
    setFeedLoading(false);
  }

  useEffect(() => {
    fetchFeed();
    const channel = supabase
      .channel("coach_squad_feed_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function toggleLike(post) {
    const uid = currentUserId;
    if (!uid) return;
    const alreadyLiked = (post.likedBy || []).includes(uid);
    const newLikedBy = alreadyLiked ? post.likedBy.filter(id => id !== uid) : [...(post.likedBy || []), uid];
    const newLikes = newLikedBy.length;
    setFeedPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes, likedBy: newLikedBy } : p));
    try {
      await supabase.from("squad_feed").update({ likes: newLikes, liked_by: newLikedBy }).eq("id", post.id);
    } catch (_) {}
  }

  async function pinPost(postId, pinned) {
    setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, isPinned: !pinned } : p));
    try { await supabase.from("squad_feed").update({ is_pinned: !pinned }).eq("id", postId); } catch (_) {}
  }

  async function deletePost(postId) {
    setFeedPosts(prev => prev.filter(p => p.id !== postId));
    try { await supabase.from("squad_feed").update({ content: "[deleted]", emoji: "🗑️" }).eq("id", postId); } catch (_) {}
  }

  async function loadComments(postId) {
    try {
      const { data } = await supabase.from("squad_comments").select("*").eq("post_id", postId).order("created_at");
      if (data) setComments(prev => ({ ...prev, [postId]: data }));
    } catch (_) {}
  }

  async function submitComment(postId) {
    const text = commentInput.trim();
    if (!text) return;
    setCommentInput("");
    const newComment = { id: Date.now().toString(), post_id: postId, user_name: "Coach TinaBarks", user_initials: "CT", is_coach: true, content: text, created_at: new Date().toISOString() };
    setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), newComment] }));
    setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p));
    try {
      await supabase.from("squad_comments").insert({ post_id: postId, user_id: currentUserId, user_name: "Coach TinaBarks", user_initials: "CT", is_coach: true, content: text });
      await supabase.from("squad_feed").update({ comments: (feedPosts.find(p => p.id === postId)?.comments || 0) + 1 }).eq("id", postId);
    } catch (_) {}
  }

  const FILTERS = [
    { key: "all",        label: "All" },
    { key: "workout",    label: "Workouts" },
    { key: "meal",       label: "Meals" },
    { key: "challenge",  label: "Challenges" },
    { key: "streak",     label: "Milestones" },
  ];

  const filtered = feedFilter === "all" ? feedPosts
    : feedFilter === "streak" ? feedPosts.filter(p => p.type === "challenge" || p.type === "streak")
    : feedPosts.filter(p => p.type === feedFilter);

  function CoachFeedCard({ post }) {
    const isLiked = (post.likedBy || []).includes(currentUserId);
    return (
      <View style={{ backgroundColor: post.isPinned ? "rgba(255,107,53,0.08)" : "#111827",
        borderRadius: 16, marginBottom: 12, padding: 16,
        borderWidth: 1, borderColor: post.isPinned ? "rgba(255,107,53,0.35)" : "rgba(255,255,255,0.08)" }}>
        {post.isPinned && (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: ROSE, fontSize: 11, fontWeight: "700", marginLeft: 4 }}>📌 PINNED</Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20,
            backgroundColor: post.isCoach ? ROSE : "#1E2837",
            alignItems: "center", justifyContent: "center", marginRight: 10 }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 14 }}>{post.userInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>{post.userName}</Text>
              {post.isCoach && (
                <View style={{ backgroundColor: ROSE, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "800" }}>HEAD COACH</Text>
                </View>
              )}
            </View>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 1 }}>
              {post.postedAt ? new Date(post.postedAt).toLocaleString() : ""}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => pinPost(post.id, post.isPinned)}
              style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, padding: 6 }}>
              <Text style={{ fontSize: 14 }}>{post.isPinned ? "📌" : "📍"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deletePost(post.id)}
              style={{ backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 8, padding: 6 }}>
              <Text style={{ fontSize: 14 }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20, marginBottom: 10 }}>
          {post.emoji} {post.content}
        </Text>
        {post.stats && (
          <View style={{ backgroundColor: "#1E2837", borderRadius: 10, padding: 10, marginBottom: 10,
            flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {post.stats.distance && <Text style={{ color: ROSE, fontSize: 12, fontWeight: "700" }}>📍 {post.stats.distance}</Text>}
            {post.stats.duration && <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>⏱ {post.stats.duration}</Text>}
            {post.stats.calories && <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>🔥 {post.stats.calories} cal</Text>}
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingTop: 10 }}>
          <TouchableOpacity onPress={() => toggleLike(post)} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ fontSize: 16 }}>{isLiked ? "❤️" : "🤍"}</Text>
            <Text style={{ color: isLiked ? ROSE : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600" }}>{post.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setCommentPost(post); loadComments(post.id); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ fontSize: 16 }}>💬</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600" }}>{post.comments || 0}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0D1B2A" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#111827" }}>
        <View style={{ padding: 16, paddingBottom: 12 }}>
          <Text style={{ color: "#FFF", fontSize: 20, fontWeight: "800" }}>Squad Feed</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 }}>Full coach visibility — all member activity</Text>
        </View>
      </SafeAreaView>

      {/* Activity summary */}
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: "#111827", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
        <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 12, alignItems: "center",
          borderTopWidth: 2, borderTopColor: ROSE }}>
          <Text style={{ color: ROSE, fontSize: 22, fontWeight: "800" }}>{activitySummary.postsToday}</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>posts today</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 12, alignItems: "center",
          borderTopWidth: 2, borderTopColor: "#22C55E" }}>
          <Text style={{ color: "#22C55E", fontSize: 22, fontWeight: "800" }}>{activitySummary.milestonesToday}</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>milestones reached</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 12, alignItems: "center",
          borderTopWidth: 2, borderTopColor: "#60A5FA" }}>
          <Text style={{ color: "#60A5FA", fontSize: 22, fontWeight: "800" }}>{feedPosts.length}</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>total posts</Text>
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: "#111827" }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row" }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.key} onPress={() => setFeedFilter(f.key)}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
              backgroundColor: feedFilter === f.key ? ROSE : "#1E2837",
              borderWidth: 1, borderColor: feedFilter === f.key ? ROSE : "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: feedFilter === f.key ? "#FFF" : "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Feed */}
      {feedLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={ROSE} size="large" />
          <Text style={{ color: "rgba(255,255,255,0.4)", marginTop: 12, fontSize: 14 }}>Loading squad activity...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <CoachFeedCard post={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>👥</Text>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>No posts yet in the Squad feed</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Comments Modal */}
      <Modal visible={!!commentPost} transparent animationType="slide" onRequestClose={() => setCommentPost(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCommentPost(null)} />
          <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: "75%", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" }} />
            </View>
            <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700", paddingHorizontal: 20, paddingBottom: 12 }}>
              Comments on {commentPost?.userName}'s post
            </Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {(comments[commentPost?.id] || []).length === 0 ? (
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", paddingVertical: 20 }}>No comments yet</Text>
              ) : (
                (comments[commentPost?.id] || []).map(c => (
                  <View key={c.id} style={{ flexDirection: "row", marginBottom: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16,
                      backgroundColor: c.is_coach ? ROSE : "#1E2837",
                      alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                      <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 12 }}>{c.user_initials || "?"}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 10 }}>
                      <Text style={{ color: c.is_coach ? ROSE : "#FFF", fontSize: 12, fontWeight: "700", marginBottom: 3 }}>{c.user_name}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 18 }}>{c.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={{ flexDirection: "row", padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
              <TextInput
                style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                  color: "#FFF", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                placeholder="Reply as Coach TinaBarks..." placeholderTextColor="rgba(255,255,255,0.35)"
                value={commentInput} onChangeText={setCommentInput}
                returnKeyType="send" onSubmitEditing={() => submitComment(commentPost?.id)} />
              <TouchableOpacity onPress={() => submitComment(commentPost?.id)}
                style={{ backgroundColor: ROSE, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Coach Overview ────────────────────────────────────────────────────────────
export function CoachOverview() {
  const { logout, clients } = useContext(AuthCtx);
  const [realClients, setRealClients] = useState([]);

  useEffect(() => {
    async function loadClients() {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .neq("email", COACH_CREDENTIALS.email.toLowerCase())
          .order("created_at", { ascending: false });
        if (data && data.length > 0) setRealClients(data);
      } catch (_e) {}
    }
    loadClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayClients = realClients.length > 0 ? realClients : clients;

  const totalClients  = displayClients.length;
  const activeClients = displayClients.filter(c => !c.lastActive?.includes("day") || parseInt(c.lastActive) < 7).length;
  const newThisWeek   = 1; // demo
  const mrr           = planMRR(displayClients.map(c => ({ ...c, plan: c.subscription || c.plan || "free" })));
  const premium       = displayClients.filter(c => (c.subscription || c.plan) === "monthly" || (c.subscription || c.plan) === "annual").length;
  const annualRev     = displayClients.filter(c => (c.subscription || c.plan) === "annual").reduce((s) => s + 16, 0);
  const retention     = Math.round((activeClients / Math.max(totalClients, 1)) * 100);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const ACTIVITY = [
    { icon: "🟢", text: "Sarah K. logged breakfast",         time: "2m ago"   },
    { icon: "🏃", text: "John D. completed 5K run",          time: "15m ago"  },
    { icon: "💤", text: "Mary L. logged 8h sleep",           time: "1h ago"   },
    { icon: "🆕", text: "James M. joined WeGoFit",           time: "2h ago"   },
    { icon: "💳", text: "Anna B. upgraded to Annual",        time: "3h ago"   },
    { icon: "⚠️", text: "Mike R. hasn't logged in 5 days",   time: "—"        },
  ];

  const ALERTS = [
    { color: "#EF4444", text: "3 clients inactive 7+ days"          },
    { color: "#F59E0B", text: "2 subscriptions expiring this week"  },
    { color: "#EF4444", text: "1 client averaging <5h sleep"         },
    { color: "#F59E0B", text: "5 clients not hitting calorie goals"  },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ backgroundColor: "#111827", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
          borderBottomWidth: 1, borderBottomColor: ROSE_DIM }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", textAlign: "center" }}>{greeting}, TinaBarks 👋</Text>
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <View style={{ backgroundColor: "rgba(255,184,0,0.15)", borderRadius: 20, paddingHorizontal: 12,
              paddingVertical: 4, borderWidth: 1, borderColor: "#FFB800" }}>
              <Text style={{ color: "#FFB800", fontSize: 12, fontWeight: "700" }}>👑 HEAD COACH</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{COACH_CREDENTIALS.email}</Text>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>{new Date().toDateString()}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          {/* KPI Row 1 */}
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 10 }}>Overview</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <KpiCard value={totalClients}  label={"Total\nClients"}       color={ROSE}      />
            <KpiCard value={activeClients} label={"Active\n(30 days)"}    color={ROSE}      />
            <KpiCard value={newThisWeek}   label={"New\nThis Week"}        color="#10B981"   />
            <KpiCard value={`$${mrr}`}     label={"Monthly\nRevenue"}      color="#10B981"   />
            <KpiCard value={premium}       label={"Premium\nMembers"}      color={ROSE}      />
            <KpiCard value={`$${annualRev}`} label={"Annual\nRevenue"}     color="#10B981"   />
            <KpiCard value={`${retention}%`} label={"Retention\nRate"}    color="#F59E0B"   />
          </ScrollView>

          {/* Activity Feed */}
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>
              Recent Activity 🔔
            </Text>
            {ACTIVITY.map((a, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8,
                borderBottomWidth: i < ACTIVITY.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ fontSize: 18, marginRight: 10 }}>{a.icon}</Text>
                <Text style={{ color: "#FFFFFF", fontSize: 13, flex: 1 }}>{a.text}</Text>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{a.time}</Text>
              </View>
            ))}
          </View>

          {/* Alerts */}
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>
              ⚠️ Needs Attention
            </Text>
            {ALERTS.map((a, i) => (
              <TouchableOpacity key={i}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10,
                  borderBottomWidth: i < ALERTS.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: a.color, marginRight: 10 }} />
                <Text style={{ color: "#FFFFFF", fontSize: 13, flex: 1 }}>{a.text}</Text>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Client Detail Screen ──────────────────────────────────────────────────────
export function ClientDetail({ client: rawClient, onBack }) {
  const { saveCoachNote, loadCoachNote } = useContext(AuthCtx);
  const ctx = useContext(Ctx);
  const unlockBadge = ctx?.unlockBadge ?? (() => Promise.resolve(false));
  const awardPoints = ctx?.awardPoints ?? (() => Promise.resolve());
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [hasError, setHasError] = useState(false);

  // safe client object — every field has a fallback so nothing downstream can crash
  const client = {
    id:          rawClient?.id          ?? "unknown",
    name:        rawClient?.name        ?? "Unknown Client",
    email:       rawClient?.email       ?? "—",
    plan:        rawClient?.plan        ?? "free",
    goal:        rawClient?.goal        ?? "—",
    calories:    rawClient?.calories    ?? 0,
    target:      rawClient?.target      ?? 2000,
    sleep:       rawClient?.sleep       ?? 0,
    streak:      rawClient?.streak      ?? 0,
    weight:      rawClient?.weight      ?? null,
    goalWeight:  rawClient?.goalWeight  ?? null,
    age:         rawClient?.age         ?? null,
    gender:      rawClient?.gender      ?? "female",
    height:      rawClient?.height      ?? null,
    memberSince: rawClient?.memberSince ?? "—",
    lastActive:  rawClient?.lastActive  ?? "—",
    activity_level: rawClient?.activity_level ?? "moderate",
  };

  const loadNote = useCallback(() => {
    loadCoachNote(client.id).then(n => setNote(n ?? "")).catch(() => {});
  }, [client.id, loadCoachNote]);

  useEffect(() => {
    try { loadNote(); } catch (e) {}
  }, [loadNote]);

  async function handleSaveNote() {
    try {
      await saveCoachNote(client.id, note);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (e) {}
  }

  const planName = client.plan ? client.plan.charAt(0).toUpperCase() + client.plan.slice(1) : "Free";
  const calPct   = client.target > 0 ? Math.min(Math.round((client.calories / client.target) * 100), 100) : 0;

  const calHistory = [1650, 1820, 1550, 1780, client.calories || 0, 1690, 1720];
  const avgCal     = Math.round(calHistory.reduce((s, v) => s + (v || 0), 0) / calHistory.length);
  const adherence  = Math.round((calHistory.filter(v => Math.abs((v || 0) - client.target) < 200).length / 7) * 100);

  if (hasError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: ROSE, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Unable to load profile</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center", marginBottom: 24 }}>
          Unable to load profile. Try again.
        </Text>
        <TouchableOpacity onPress={onBack}
          style={{ backgroundColor: ROSE, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>← Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16,
        backgroundColor: "#111827", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
          <Text style={{ color: ROSE, fontSize: 16, fontWeight: "700" }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 17, flex: 1 }}>Client Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 16, padding: 20, marginBottom: 16,
          borderWidth: 1, borderColor: ROSE_DIM, alignItems: "center" }}>
          <CoachAvatar name={client.name} size={64} />
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 10 }}>{client.name}</Text>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 2 }}>{client.email}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <PlanBadge plan={client.plan} />
          </View>
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 6 }}>Member since {client.memberSince}</Text>
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Last active: {client.lastActive}</Text>
          <TouchableOpacity style={{ backgroundColor: ROSE, borderRadius: 10, paddingHorizontal: 20,
            paddingVertical: 10, marginTop: 14 }}>
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>💬 Message Client</Text>
          </TouchableOpacity>
        </View>

        {/* Vital stats */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          {[
            { l: "Age",    v: client.age    || "—" },
            { l: "Height", v: client.height ? `${client.height}cm` : "—" },
            { l: "Weight", v: client.weight ? `${client.weight}kg` : "—" },
            { l: "Goal Wt", v: client.goalWeight ? `${client.goalWeight}kg` : "—" },
          ].map(s => (
            <View key={s.l} style={{ flex: 1, backgroundColor: "#111827", borderRadius: 12, padding: 10,
              alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: ROSE, fontWeight: "800", fontSize: 16 }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Today's progress */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Today's Progress</Text>
          <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Calories</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>
              {client.calories} / {client.target} kcal
            </Text>
          </Row>
          <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, marginBottom: 12 }}>
            <View style={{ height: 8, borderRadius: 4, width: `${calPct}%`, backgroundColor: ROSE }} />
          </View>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Sleep last night</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>{client.sleep}h</Text>
          </Row>
        </View>

        {/* Health Metrics */}
        {client.weight && client.height && (
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Row style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>📊</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Health Metrics</Text>
            </Row>
            {(() => {
              const bmi       = calcBMI(client.weight, client.height);
              const bmiInfo   = getBMICategory(bmi);
              const clientBmr = calcBMR(client.gender || "female", client.weight, client.height, client.age || 30);
              const clientTdee = calcTDEE(clientBmr, client.activity_level || "moderate");
              const rawTarget = calcDailyTarget(clientTdee, (client.goal || "").toLowerCase().includes("lose") ? "lose"
                : (client.goal || "").toLowerCase().includes("muscle") ? "gain" : "maintain");
              const dailyTarget = getSafeCalorieTarget(rawTarget, client.gender || "female");
              const intakeStatus = getCalorieStatus(client.calories || 0, dailyTarget);
              const minCal = getMinimumCalories(client.gender || "female");
              const maxCal = client.gender === "male" ? 2200 : 1800;
              return (
                <>
                  {[
                    { l: "BMI",           v: `${bmi}  ${bmiInfo.emoji || ""}`, note: bmiInfo.label, col: bmiInfo.color },
                    { l: "Daily Target",  v: `${dailyTarget.toLocaleString()} kcal`, col: ROSE },
                    { l: "Formula",       v: "Mifflin-St Jeor + TDEE", col: "#888" },
                    { l: "Today's intake", v: `${client.calories || 0} kcal`, col: intakeStatus.color },
                  ].map(r => (
                    <Row key={r.l} style={{ justifyContent: "space-between", paddingVertical: 5,
                      borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{r.l}</Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: r.col, fontWeight: "600", fontSize: 13 }}>{r.v}</Text>
                        {r.note && <Text style={{ color: r.col, fontSize: 10 }}>{r.note}</Text>}
                      </View>
                    </Row>
                  ))}
                  <Row style={{ justifyContent: "space-between", paddingTop: 6 }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Status</Text>
                    <Text style={{ color: intakeStatus.color, fontWeight: "700", fontSize: 13 }}>
                      {intakeStatus.emoji} {intakeStatus.label} ({(client.calories || 0) - dailyTarget > 0 ? "+" : ""}{(client.calories || 0) - dailyTarget})
                    </Text>
                  </Row>
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 8 }}>
                    {client.gender === "male" ? "Men" : "Women"} reference: {minCal.toLocaleString()}–{maxCal.toLocaleString()} kcal
                  </Text>
                </>
              );
            })()}
          </View>
        )}

        {/* Nutrition history */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Nutrition (7 days)</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 12 }}>
            {calHistory.map((v, i) => {
              const h = Math.round((v / 2200) * 60);
              return (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ height: h, backgroundColor: i === 4 ? ROSE : "rgba(255,107,53,0.2)", borderRadius: 4, width: "100%" }} />
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 3 }}>
                    {["M","T","W","T","F","S","S"][i]}
                  </Text>
                </View>
              );
            })}
          </View>
          {[
            { l: "Avg cal/day",  v: `${avgCal} kcal` },
            { l: "Adherence",    v: `${adherence}%`   },
            { l: "Goal",         v: `${client.target} kcal` },
          ].map(r => (
            <Row key={r.l} style={{ justifyContent: "space-between", paddingVertical: 5,
              borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{r.l}</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{r.v}</Text>
            </Row>
          ))}
        </View>

        {/* Sleep history */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Sleep (7 days)</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 12 }}>
            {[7.2, 6.8, 8.0, 7.5, client.sleep || 0, 7.0, 6.5].map((v, i) => {
              const h = Math.round((v / 10) * 60);
              const col = v >= 7 ? "#10B981" : v >= 6 ? "#F59E0B" : "#EF4444";
              return (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ height: h, backgroundColor: col, borderRadius: 4, width: "100%", opacity: 0.7 }} />
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 3 }}>
                    {["M","T","W","T","F","S","S"][i]}
                  </Text>
                </View>
              );
            })}
          </View>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Avg sleep</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{client.sleep || "—"}h / night</Text>
          </Row>
        </View>

        {/* Coach notes */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 4 }}>Coach Notes</Text>
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginBottom: 10 }}>🔒 Private — only you can see these</Text>
          <TextInput
            style={[S.input, { height: 100, textAlignVertical: "top", fontSize: 14 }]}
            placeholder="Add private coaching notes..."
            placeholderTextColor="#BBB"
            value={note}
            onChangeText={setNote}
            multiline
          />
          <TouchableOpacity onPress={handleSaveNote}
            style={{ backgroundColor: noteSaved ? "#10B981" : ROSE, borderRadius: 10,
              paddingVertical: 10, alignItems: "center", marginTop: 10 }}>
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>
              {noteSaved ? "✅ Saved!" : "Save Notes"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subscription */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Subscription</Text>
          {[
            { l: "Plan",          v: planName },
            { l: "Member since",  v: client.memberSince },
            { l: "Monthly value", v: `$${PLAN_PRICE[client.plan] || 0}` },
          ].map(r => (
            <Row key={r.l} style={{ justifyContent: "space-between", paddingVertical: 6,
              borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{r.l}</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{r.v}</Text>
            </Row>
          ))}
        </View>

        {/* Meal Plan Summary */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Row style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>📋</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Current Meal Plan</Text>
          </Row>
          <Row style={{ justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Plan status</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>
              {client.plan !== "free" ? "Premium — can generate" : "Free plan"}
            </Text>
          </Row>
          <Row style={{ justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Calorie target</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{client.target} kcal / day</Text>
          </Row>
          <Row style={{ justifyContent: "space-between", paddingVertical: 6 }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Logging adherence</Text>
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{adherence}% this week</Text>
          </Row>
        </View>

        {/* TinaBarks Choice Badge Award */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1.5, borderColor: ROSE_DIM }}>
          <Row style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 22, marginRight: 8 }}>🌸</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: ROSE, fontWeight: "700", fontSize: 15 }}>TinaBarks Choice Award</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>Legendary badge · 500 pts · Awarded personally by you</Text>
            </View>
          </Row>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
            Award {client.name} this exclusive badge for outstanding dedication, consistency or transformation.
            This cannot be revoked once given.
          </Text>
          <TouchableOpacity
            onPress={() => Alert.alert(
              "Award TinaBarks Choice?",
              `This will award ${client.name} the legendary "TinaBarks Choice" badge (500 pts) and post a community announcement. This action cannot be undone.`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Award Badge 🌸", onPress: async () => {
                    const awarded = await unlockBadge("tinabarks_choice");
                    if (awarded) {
                      await awardPoints("badge_award", 500);
                      Alert.alert("Badge Awarded! 🌸", `${client.name} has been awarded the TinaBarks Choice badge. They'll receive 500 WeGoFit Points!`);
                    } else {
                      Alert.alert("Already Awarded", `${client.name} already has this badge.`);
                    }
                  }
                },
              ]
            )}
            style={{ backgroundColor: ROSE, borderRadius: 12, padding: 14, alignItems: "center",
              shadowColor: ROSE, shadowRadius: 8, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 0 } }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 14 }}>Award TinaBarks Choice Badge 🌸</Text>
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 8,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 14, marginBottom: 10 }}>Danger Zone</Text>
          <TouchableOpacity onPress={() => Alert.alert("Suspend Account", `Suspend ${client.name}?`, [{ text: "Cancel" }, { text: "Suspend", style: "destructive" }])}
            style={{ backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 10, padding: 12, alignItems: "center",
              borderWidth: 1, borderColor: "#F59E0B", marginBottom: 8 }}>
            <Text style={{ color: "#F59E0B", fontWeight: "700" }}>Suspend Account</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("Remove Client", `Permanently remove ${client.name}?`, [{ text: "Cancel" }, { text: "Remove", style: "destructive" }])}
            style={{ backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, padding: 12, alignItems: "center",
              borderWidth: 1, borderColor: "#EF4444" }}>
            <Text style={{ color: "#EF4444", fontWeight: "700" }}>Remove Client</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Coach Clients ─────────────────────────────────────────────────────────────
export function CoachClients() {
  const { clients } = useContext(AuthCtx);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("all");
  const [selected,    setSelected]    = useState(null);
  const [realClients, setRealClients] = useState([]);

  useEffect(() => {
    async function loadClients() {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .neq("email", COACH_CREDENTIALS.email.toLowerCase())
          .order("created_at", { ascending: false });
        if (data && data.length > 0) setRealClients(data);
      } catch (_e) {}
    }
    loadClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayClients = realClients.length > 0
    ? realClients.map(c => ({
        id:          c.id,
        name:        c.name || c.email,
        email:       c.email,
        plan:        c.subscription || "free",
        goal:        c.goal || "Improve Fitness",
        calories:    0,
        target:      c.calories || 2000,
        sleep:       0,
        streak:      0,
        weight:      c.weight_kg || 0,
        goalWeight:  c.goal_weight || 0,
        age:         c.age || 0,
        gender:      c.gender || "other",
        height:      c.height_cm || 0,
        memberSince: c.member_since || (c.created_at || "").split("T")[0],
        lastActive:  "recently",
        activity_level: c.activity || "sedentary",
      }))
    : clients;

  if (selected) return <ClientDetail client={selected} onBack={() => setSelected(null)} />;

  const filtered = displayClients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    const matchFilter = filter === "all"
      || (filter === "active"   && !c.lastActive?.includes("day"))
      || (filter === "inactive" && (c.lastActive?.includes("day") && parseInt(c.lastActive) >= 5))
      || (filter === "premium"  && (c.plan === "monthly" || c.plan === "annual"))
      || (filter === "free"     && c.plan === "free");
    return matchSearch && matchFilter;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: "#111827",
        borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 10 }}>Clients</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1E2837",
          borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "rgba(255,255,255,0.3)", marginRight: 8 }}>🔍</Text>
          <TextInput
            style={{ flex: 1, color: "#FFFFFF", fontSize: 14 }}
            placeholder="Search by name or email..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {["all","active","inactive","premium","free"].map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: filter === f ? ROSE : "#1E2837",
                borderWidth: 1, borderColor: filter === f ? ROSE : "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: filter === f ? "#FFF" : "rgba(255,255,255,0.45)", fontWeight: "600", fontSize: 13,
                textTransform: "capitalize" }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>No clients found.</Text>
          </View>
        )}
        {filtered.map((c, i) => {
          const calPct = c.target > 0 ? Math.min(Math.round((c.calories / c.target) * 100), 100) : 0;
          return (
            <View key={c.id} style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 12,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
              shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
              <Row style={{ marginBottom: 10 }}>
                <CoachAvatar name={c.name} size={44} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Row>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginRight: 8 }}>{c.name}</Text>
                    <PlanBadge plan={c.plan} />
                  </Row>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>{c.email}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Goal: {c.goal}</Text>
                </View>
              </Row>

              {/* Today's stats */}
              <Row style={{ gap: 10, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: "space-between", marginBottom: 3 }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>Calories today</Text>
                    <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 11 }}>
                      {c.calories}/{c.target}
                    </Text>
                  </Row>
                  <View style={{ height: 5, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                    <View style={{ height: 5, borderRadius: 3, width: `${calPct}%`, backgroundColor: calPct >= 90 ? "#10B981" : ROSE }} />
                  </View>
                </View>
              </Row>

              <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                  Sleep: <Text style={{ color: c.sleep >= 7 ? "#10B981" : c.sleep >= 6 ? "#F59E0B" : "#EF4444", fontWeight: "700" }}>{c.sleep}h</Text>
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                  Streak: <Text style={{ color: ROSE, fontWeight: "700" }}>🔥{c.streak} days</Text>
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Active: {c.lastActive}</Text>
              </Row>

              <TouchableOpacity onPress={() => setSelected(c)}
                style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 10, padding: 10,
                  alignItems: "center", borderWidth: 1, borderColor: ROSE_DIM }}>
                <Text style={{ color: ROSE, fontWeight: "700", fontSize: 13 }}>View Full Profile →</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Coach Messages ────────────────────────────────────────────────────────────
export function CoachMessages() {
  const { clients } = useContext(AuthCtx);
  const [selClient, setSelClient] = useState(null);
  const [threads,   setThreads]   = useState({});
  const [input,     setInput]     = useState("");
  const listRef = useRef(null);

  const QUICK = [
    "Great progress this week! Keep it up 💪",
    "Don't forget to log your meals today! 🥗",
    "How are you feeling after yesterday's workout?",
    "Your sleep has been low this week 😴 Try to get to bed earlier tonight.",
    "You're doing amazing — keep going! 🎯",
    "Reminder: hit your water goal today! 💧",
  ];

  function send(text) {
    if (!text?.trim() || !selClient) return;
    const msg = { id: `m${Date.now()}`, from: "coach", text: text.trim(), ts: new Date().toISOString() };
    setThreads(t => ({ ...t, [selClient.id]: [...(t[selClient.id] || []), msg] }));
    setInput("");
  }

  function broadcastAll() {
    Alert.alert(
      "Broadcast Message",
      `Send to all ${clients.length} clients?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send", onPress: () => {
          const msg = { id: `m${Date.now()}`, from: "coach", text: "Hello everyone! 👋 Keep up the great work!", ts: new Date().toISOString() };
          const newThreads = {};
          clients.forEach(c => { newThreads[c.id] = [...(threads[c.id] || []), msg]; });
          setThreads(prev => ({ ...prev, ...newThreads }));
          Alert.alert("Sent!", `Message sent to ${clients.length} clients.`);
        }},
      ]
    );
  }

  if (selClient) {
    const msgs = threads[selClient.id] || [];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
        <StatusBar style="light" backgroundColor="transparent" translucent={true} />
        <View style={{ flexDirection: "row", alignItems: "center", padding: 16,
          backgroundColor: "#111827", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
          <TouchableOpacity onPress={() => setSelClient(null)} style={{ marginRight: 12 }}>
            <Text style={{ color: ROSE, fontSize: 16, fontWeight: "700" }}>← Back</Text>
          </TouchableOpacity>
          <CoachAvatar name={selClient.name} size={34} />
          <View style={{ marginLeft: 8 }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{selClient.name}</Text>
            <Text style={{ color: "#10B981", fontSize: 11 }}>🟢 Active</Text>
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 14, gap: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isCoach = item.from === "coach";
              return (
                <View style={{ alignItems: isCoach ? "flex-end" : "flex-start" }}>
                  <View style={{ backgroundColor: isCoach ? ROSE : "#1E2837",
                    borderRadius: 16, padding: 12, maxWidth: SW * 0.72,
                    borderWidth: isCoach ? 0 : 1, borderColor: "rgba(255,255,255,0.08)" }}>
                    <Text style={{ color: isCoach ? "#FFF" : "#FFFFFF", fontSize: 14 }}>{item.text}</Text>
                    <Text style={{ color: isCoach ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 4 }}>
                      {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No messages yet. Say hello! 👋</Text>
              </View>
            }
          />

          {/* Quick replies */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}
            style={{ backgroundColor: "#111827", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
            {QUICK.map((q, i) => (
              <TouchableOpacity key={i} onPress={() => send(q)}
                style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                  borderWidth: 1, borderColor: ROSE_DIM }}>
                <Text style={{ color: ROSE, fontSize: 12, maxWidth: 160 }} numberOfLines={1}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", padding: 12, gap: 8, backgroundColor: "#111827",
            borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
            <TextInput
              style={[S.input, { flex: 1, paddingVertical: 10 }]}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={() => send(input)}
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: input.trim() ? ROSE : "rgba(255,255,255,0.08)",
                alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18 }}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
        backgroundColor: "#111827", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>Messages</Text>
          <TouchableOpacity onPress={broadcastAll}
            style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 10, paddingHorizontal: 12,
              paddingVertical: 6, borderWidth: 1, borderColor: ROSE_DIM }}>
            <Text style={{ color: ROSE, fontSize: 13, fontWeight: "700" }}>📢 Broadcast</Text>
          </TouchableOpacity>
        </Row>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {clients.map(c => {
          const last = (threads[c.id] || []).slice(-1)[0];
          const unread = (threads[c.id] || []).filter(m => m.from !== "coach").length;
          return (
            <TouchableOpacity key={c.id} onPress={() => setSelClient(c)}
              style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 10,
                flexDirection: "row", alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
              <View style={{ position: "relative", marginRight: 12 }}>
                <CoachAvatar name={c.name} size={44} />
                <View style={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 12,
                  borderRadius: 6, backgroundColor: "#10B981", borderWidth: 2, borderColor: "#111827" }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{c.name}</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {last ? last.text : "No messages yet"}
                </Text>
              </View>
              {unread > 0 && (
                <View style={{ backgroundColor: ROSE, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>{unread}</Text>
                </View>
              )}
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 18, marginLeft: 8 }}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Coach Revenue ─────────────────────────────────────────────────────────────
export function CoachRevenue() {
  const { clients } = useContext(AuthCtx);
  const monthly  = clients.filter(c => c.plan === "monthly");
  const annual   = clients.filter(c => c.plan === "annual");
  const mrr      = planMRR(clients);
  const monthRev = monthly.length * 20;
  const annRev   = annual.length * 16;
  const projected = mrr * 12;

  const paying = clients.filter(c => c.plan !== "free");

  async function exportAsPDF() {
    try {
      if (!Print) { Alert.alert("Error", "PDF export not available."); return; }
      const html = `
        <html>
          <body style="font-family:Arial; padding:40px; color:#1A1A2E;">
            <h1 style="color:#FF6B35;">WeGoFit Revenue Report</h1>
            <p>Generated: ${new Date().toDateString()}</p>
            <hr/>
            <h2>Summary</h2>
            <p>Total Monthly Revenue: $${mrr}</p>
            <p>Active Clients: ${clients.length}</p>
            <p>Monthly Subscribers: ${monthly.length}</p>
            <p>Annual Subscribers: ${annual.length}</p>
            <p>Projected Annual Revenue: $${projected.toLocaleString()}</p>
            <hr/>
            <p style="color:gray; font-size:12px;">WeGoFit — Better Habits. Better You.</p>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      if (Sharing) {
        await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
      } else {
        Alert.alert("PDF saved", uri);
      }
    } catch (_e) {
      Alert.alert("Error", "Could not export PDF.");
    }
  }

  async function exportAsCSV() {
    try {
      if (!FileSystem) { Alert.alert("Error", "CSV export not available."); return; }
      const rows = [
        "Date,Client,Plan,Amount,Status",
        ...paying.map(c =>
          `${new Date().toISOString().slice(0, 10)},${c.name},${c.plan},$${PLAN_PRICE[c.plan]},Paid`
        ),
      ];
      const csvContent = rows.join("\n");
      const fileUri = FileSystem.documentDirectory + "wegofit-revenue-report.csv";
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      if (Sharing) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "WeGoFit Revenue Report" });
      } else {
        Alert.alert("CSV saved", fileUri);
      }
    } catch (_e) {
      Alert.alert("Error", "Could not export CSV.");
    }
  }

  function handleExport() {
    Alert.alert(
      "Export Revenue Report",
      "Choose your preferred format:",
      [
        { text: "📄 Export as PDF",         onPress: exportAsPDF },
        { text: "📊 Export as CSV (Excel)", onPress: exportAsCSV },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  // mock 6-month history
  const months = ["Dec","Jan","Feb","Mar","Apr","May"];
  const barData = [58, 62, 68, 74, 80, mrr];
  const maxBar  = Math.max(...barData);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 16 }}>Revenue</Text>

        {/* Summary cards */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          {[
            { v: `$${mrr}`,      l: "Total MRR"       },
            { v: `$${monthRev}`, l: "Monthly plan"    },
            { v: `$${annRev}`,   l: "Annual plan"     },
          ].map(s => (
            <View key={s.l} style={{ flex: 1, backgroundColor: "#111827", borderRadius: 14, padding: 14,
              alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
              borderTopWidth: 3, borderTopColor: "#10B981" }}>
              <Text style={{ color: "#10B981", fontSize: 22, fontWeight: "800" }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2, textAlign: "center" }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Projected */}
        <View style={{ backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 14, padding: 14, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" }}>
          <Text style={{ color: "#10B981", fontWeight: "800", fontSize: 15 }}>
            📈 Projected Annual: ${projected.toLocaleString()}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 4 }}>Based on current MRR × 12</Text>
        </View>

        {/* Revenue chart */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 16 }}>
            Monthly Revenue (6 months)
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 80, marginBottom: 8 }}>
            {barData.map((v, i) => {
              const h = Math.max(4, Math.round((v / maxBar) * 80));
              return (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, marginBottom: 2 }}>${v}</Text>
                  <View style={{ height: h, backgroundColor: i === barData.length - 1 ? "#10B981" : "rgba(16,185,129,0.2)",
                    borderRadius: 4, width: "100%" }} />
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {months.map(m => (
              <Text key={m} style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, flex: 1, textAlign: "center" }}>{m}</Text>
            ))}
          </View>
        </View>

        {/* Subscription breakdown */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>
            Subscription Breakdown
          </Text>
          {[
            { label: "Free",    count: clients.filter(c=>c.plan==="free").length,    color: "rgba(255,255,255,0.2)", pct: Math.round(clients.filter(c=>c.plan==="free").length/clients.length*100)    },
            { label: "Monthly", count: monthly.length, color: ROSE,      pct: Math.round(monthly.length/clients.length*100)  },
            { label: "Annual",  count: annual.length,  color: "#F59E0B", pct: Math.round(annual.length/clients.length*100)   },
          ].map(row => (
            <View key={row.label} style={{ marginBottom: 10 }}>
              <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{row.label} ({row.count})</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{row.pct}%</Text>
              </Row>
              <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                <View style={{ height: 6, borderRadius: 3, width: `${row.pct}%`, backgroundColor: row.color }} />
              </View>
            </View>
          ))}
        </View>

        {/* Subscriber table */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 12 }}>
            Paying Subscribers
          </Text>
          {paying.map((c, i) => {
            const exp = c.plan === "monthly" ? "Monthly" : "Annual";
            return (
              <View key={c.id} style={{ paddingVertical: 10,
                borderBottomWidth: i < paying.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13, flex: 1 }}>{c.name}</Text>
                  <PlanBadge plan={c.plan} />
                  <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 13, marginLeft: 10 }}>
                    ${PLAN_PRICE[c.plan]}/mo
                  </Text>
                </Row>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 }}>
                  Since {c.memberSince} · {exp} · ✅ Active
                </Text>
              </View>
            );
          })}
          {paying.length === 0 && <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No paying subscribers yet.</Text>}
        </View>

        {/* Export button */}
        <TouchableOpacity onPress={handleExport}
          style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, alignItems: "center",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 14 }}>📥 Export Revenue Report</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Coach Settings ────────────────────────────────────────────────────────────
export function CoachSettings() {
  const { logout } = useContext(AuthCtx);
  const [notifClient,  setNotifClient]  = useState(true);
  const [dailySummary, setDailySummary] = useState(true);
  const [inactiveAlert,setInactiveAlert]= useState(true);
  const [paymentNotif, setPaymentNotif] = useState(true);
  const [showCoachPw,  setShowCoachPw]  = useState(false);
  const [newSignup,    setNewSignup]    = useState(true);

  function Toggle({ value, onToggle }) {
    return (
      <TouchableOpacity onPress={onToggle}
        style={{ width: 46, height: 26, borderRadius: 13,
          backgroundColor: value ? ROSE : "rgba(255,255,255,0.15)", justifyContent: "center", paddingHorizontal: 2 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFF",
          alignSelf: value ? "flex-end" : "flex-start" }} />
      </TouchableOpacity>
    );
  }

  function SettingRow({ label, value, onToggle, onPress }) {
    return (
      <TouchableOpacity onPress={onPress || undefined}
        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
        <Text style={{ flex: 1, color: "#FFFFFF", fontSize: 15 }}>{label}</Text>
        {onToggle
          ? <Toggle value={value} onToggle={onToggle} />
          : <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>›</Text>
        }
      </TouchableOpacity>
    );
  }

  function Section({ title, children }) {
    return (
      <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700", textTransform: "uppercase",
          letterSpacing: 1, marginBottom: 4 }}>{title}</Text>
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 16 }}>Settings</Text>

        {/* Profile */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 16, padding: 20, marginBottom: 16,
          borderWidth: 1, borderColor: ROSE_DIM, alignItems: "center" }}>
          <CoachAvatar name="TinaBarks" size={64} />
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 10 }}>TinaBarks</Text>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 2 }}>{COACH_CREDENTIALS.email}</Text>
          <View style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
            marginTop: 8, borderWidth: 1, borderColor: "#F59E0B40" }}>
            <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "700" }}>👑 Head Coach & Admin</Text>
          </View>
          <TouchableOpacity style={{ marginTop: 12, borderWidth: 1, borderColor: ROSE_DIM,
            borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 }}>
            <Text style={{ color: ROSE, fontWeight: "700", fontSize: 14 }}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <Section title="Notifications">
          <SettingRow label="🔔 Client activity"        value={notifClient}   onToggle={() => setNotifClient(v=>!v)}   />
          <SettingRow label="📧 Daily summary email"    value={dailySummary}  onToggle={() => setDailySummary(v=>!v)}  />
          <SettingRow label="⚠️ Inactive client alerts" value={inactiveAlert} onToggle={() => setInactiveAlert(v=>!v)} />
          <SettingRow label="💳 Payment notifications"  value={paymentNotif}  onToggle={() => setPaymentNotif(v=>!v)}  />
          <SettingRow label="🌙 New signup alerts"      value={newSignup}     onToggle={() => setNewSignup(v=>!v)}      />
        </Section>

        <Section title="Business Info">
          {[
            { l: "App Name",         v: "WeGoFit"                       },
            { l: "Coach",            v: "TinaBarks"                     },
            { l: "Email",            v: COACH_CREDENTIALS.email         },
            { l: "Monthly Price",    v: "$20 / month"                   },
            { l: "Annual Price",     v: "$16 / mo ($192/year)"          },
            { l: "Free Trial",       v: "7 days"                        },
          ].map(r => (
            <Row key={r.l} style={{ justifyContent: "space-between", paddingVertical: 8,
              borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{r.l}</Text>
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>{r.v}</Text>
            </Row>
          ))}
        </Section>

        <Section title="Security">
          <SettingRow label="Change Password" onPress={() => setShowCoachPw(true)} />
          <SettingRow label="Change Email"    onPress={() => Alert.alert("Change Email", "Feature coming soon.")}    />
          <Row style={{ paddingVertical: 8, justifyContent: "space-between" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Last login</Text>
            <Text style={{ color: "#FFFFFF", fontSize: 13 }}>{new Date().toLocaleString()}</Text>
          </Row>
        </Section>

        <Section title="Danger Zone">
          <TouchableOpacity onPress={() => Alert.alert("Export Data", "All client data export — coming soon.")}
            style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 15 }}>Export All Client Data</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("Reset Demo Data", "This will reset all demo data.", [{ text: "Cancel" }, { text: "Reset", style: "destructive" }])}
            style={{ paddingVertical: 12 }}>
            <Text style={{ color: "#EF4444", fontSize: 15 }}>Reset All Demo Data</Text>
          </TouchableOpacity>
        </Section>

        <TouchableOpacity onPress={() => Alert.alert("Sign Out", "Sign out of coach dashboard?",
          [{ text: "Cancel" }, { text: "Sign Out", style: "destructive", onPress: logout }])}
          style={{ backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 14, padding: 16, alignItems: "center",
            borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", marginBottom: 16 }}>
          <Text style={{ color: "#EF4444", fontWeight: "800", fontSize: 15 }}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", marginBottom: 4 }}>
          WeGoFit Coach Dashboard v1.0.0
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center" }}>© 2026 WeGoFit · TinaBarks</Text>
      </ScrollView>
      <CoachChangePwModal visible={showCoachPw} onClose={() => setShowCoachPw(false)} />
    </SafeAreaView>
  );
}

// ─── COACH CHANGE PASSWORD MODAL ──────────────────────────────────────────────
export function CoachChangePwModal({ visible, onClose }) {
  const [curPw,    setCurPw]    = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [confPw,   setConfPw]   = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [error,    setError]    = useState("");
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);

  const str    = pwStrengthFull(newPw);
  const match  = newPw && confPw && newPw === confPw;

  function reset() { setCurPw(""); setNewPw(""); setConfPw(""); setError(""); setDone(false); }

  async function handleUpdate() {
    setError("");
    if (!curPw) { setError("Enter your current password."); return; }
    if (btoa(curPw) !== COACH_CREDENTIALS.password) { setError("Current password is incorrect."); return; }
    if (!newPw || newPw.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (!match) { setError("New passwords do not match."); return; }
    setBusy(true);
    COACH_CREDENTIALS.password = btoa(newPw);
    await new Promise(r => setTimeout(r, 600));
    setBusy(false);
    setDone(true);
    setTimeout(() => { onClose(); reset(); }, 1800);
  }

  const coachNewPwRef  = useRef(null);
  const coachConfPwRef = useRef(null);
  const [focused, setFocused] = useState(null);

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableWithoutFeedback onPress={() => { onClose(); reset(); }} accessible={false}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} />
        </TouchableWithoutFeedback>
        <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 44 : 36, paddingTop: 16, maxHeight: "92%" }}>
          <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2,
            alignSelf: "center", marginBottom: 20 }} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {done ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Text style={{ fontSize: 48 }}>🎉</Text>
                <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 16 }}>Password Updated!</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginTop: 8, textAlign: "center" }}>Your coach password has been changed.</Text>
              </View>
            ) : (
              <>
                <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 20 }}>🔒 Change Coach Password</Text>
                {error ? (
                  <View style={{ backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, padding: 12, marginBottom: 14,
                    borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }}>
                    <Text style={{ color: "#EF4444", fontSize: 13 }}>{error}</Text>
                  </View>
                ) : null}

                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Current Password</Text>
                <View style={{ position: "relative", justifyContent: "center", marginBottom: 14 }}>
                  <TextInput style={[S.input, { paddingRight: 50 }, focused === "cur" && S.inputFocused]}
                    placeholder="Current password" placeholderTextColor="rgba(255,255,255,0.3)"
                    value={curPw} onChangeText={v => { setCurPw(v); setError(""); }}
                    secureTextEntry={!showCur} autoCapitalize="none" autoCorrect={false}
                    returnKeyType="next" onSubmitEditing={() => coachNewPwRef.current?.focus()} blurOnSubmit={false}
                    onFocus={() => setFocused("cur")} onBlur={() => setFocused(null)} />
                  <EyeBtn show={showCur} onToggle={() => setShowCur(v => !v)} />
                </View>

                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>New Password</Text>
                <View style={{ position: "relative", justifyContent: "center", marginBottom: 8 }}>
                  <TextInput ref={coachNewPwRef} style={[S.input, { paddingRight: 50 }, focused === "new" && S.inputFocused]}
                    placeholder="New password" placeholderTextColor="rgba(255,255,255,0.3)"
                    value={newPw} onChangeText={setNewPw}
                    secureTextEntry={!showNew} autoCapitalize="none" autoCorrect={false}
                    returnKeyType="next" onSubmitEditing={() => coachConfPwRef.current?.focus()} blurOnSubmit={false}
                    onFocus={() => setFocused("new")} onBlur={() => setFocused(null)} />
                  <EyeBtn show={showNew} onToggle={() => setShowNew(v => !v)} />
                </View>
                {newPw.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, marginBottom: 4 }}>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: str.color, width: `${str.pct * 100}%` }} />
                    </View>
                    <Text style={{ color: str.color, fontSize: 12, fontWeight: "600" }}>{str.level}</Text>
                  </View>
                )}

                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Confirm New Password</Text>
                <View style={{ position: "relative", justifyContent: "center", marginBottom: 8 }}>
                  <TextInput ref={coachConfPwRef} style={[S.input, { paddingRight: 50 }, focused === "conf" && S.inputFocused]}
                    placeholder="Repeat new password" placeholderTextColor="rgba(255,255,255,0.3)"
                    value={confPw} onChangeText={setConfPw}
                    secureTextEntry={!showConf} autoCapitalize="none" autoCorrect={false}
                    returnKeyType="done" onSubmitEditing={handleUpdate}
                    onFocus={() => setFocused("conf")} onBlur={() => setFocused(null)} />
                  <EyeBtn show={showConf} onToggle={() => setShowConf(v => !v)} />
                </View>
                {confPw.length > 0 && (
                  <Text style={{ color: match ? "#22C55E" : "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 16 }}>
                    {match ? "✅ Passwords match" : "❌ Passwords don't match"}
                  </Text>
                )}

                <TouchableOpacity onPress={handleUpdate} disabled={busy || !match || !curPw}
                  style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 16, alignItems: "center",
                    opacity: busy || !match || !curPw ? 0.5 : 1,
                    shadowColor: ROSE, shadowRadius: 8, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 3 } }}>
                  {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Update Password</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onClose(); reset(); }} style={{ alignItems: "center", marginTop: 16, padding: 8 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Coach Tab Navigator ───────────────────────────────────────────────────────
const CoachTab = createBottomTabNavigator();

export function CoachDashboard() {
  return (
    <CoachTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#111827", borderTopColor: "rgba(255,255,255,0.08)", height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   ROSE,
        tabBarInactiveTintColor: "rgba(255,255,255,0.45)",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <CoachTab.Screen name="COverview"    component={CoachOverview}    options={{ tabBarLabel: "Overview",   tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text> }} />
      <CoachTab.Screen name="CClients"     component={CoachClients}     options={{ tabBarLabel: "Clients",    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👥</Text> }} />
      <CoachTab.Screen name="CSquadFeed"   component={CoachSquadFeed}   options={{ tabBarLabel: "Squad",      tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏅</Text> }} />
      <CoachTab.Screen name="CChallenges"  component={CoachChallenges}  options={{ tabBarLabel: "Challenges", tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏆</Text> }} />
      <CoachTab.Screen name="CMessages"    component={CoachMessages}    options={{ tabBarLabel: "Messages",   tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💬</Text> }} />
      <CoachTab.Screen name="CRevenue"     component={CoachRevenue}     options={{ tabBarLabel: "Revenue",    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💰</Text> }} />
      <CoachTab.Screen name="CSettings"    component={CoachSettings}    options={{ tabBarLabel: "Settings",   tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text> }} />
    </CoachTab.Navigator>
  );
}
