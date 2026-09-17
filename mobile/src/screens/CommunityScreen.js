import React, { useState, useContext, useEffect, useRef } from "react"
import { View, Text, ScrollView, TouchableOpacity, FlatList, Modal, TextInput, Alert, Image, Linking, KeyboardAvoidingView, TouchableWithoutFeedback, Platform, ActivityIndicator, StyleSheet, Animated } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Circle } from "react-native-svg"
import S from "../lib/styles"
import { ROSE, C, SH, LOGO_URI } from "../lib/constants"
import { Ctx, useTheme } from "../contexts/AppContext"
import { AuthCtx } from "../contexts/AuthContext"
import { Card, PrimaryBtn, Row, Spacer } from "../components/shared"
import { BadgeCard } from "./MealPlannerScreen"
import { BADGES, BADGE_CATEGORIES, RARITY_CONFIG, MILESTONE_LEVELS, MOCK_LEADERBOARD, MOCK_FEED, PRESET_CHALLENGES, CHALLENGE_TYPE_COLORS, POINTS } from "../data/community"
import { timeAgo } from "../utils/mealPlan"
import { supabase } from "../lib/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"

// ─── BADGE UNLOCK OVERLAY ─────────────────────────────────────────────────────
export function BadgeUnlockOverlay({ badge, onClose, onShare, onViewAll }) {
  const scale    = useRef(new Animated.Value(0)).current;
  const rarity   = RARITY_CONFIG[badge?.rarity] || RARITY_CONFIG.common;
  useEffect(() => {
    if (!badge) return;
    scale.setValue(0);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 350, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [badge]);
  if (!badge) return null;
  return (
    <Modal visible={!!badge} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.82)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: "#FFF", fontSize: 28, fontWeight: "800", marginBottom: 16, textAlign: "center" }}>🎉 Badge Unlocked! 🎉</Text>
        <Animated.View style={{ transform: [{ scale }] }}>
          <BadgeCard badge={badge} size="large" unlocked showName={false} />
        </Animated.View>
        <Text style={{ color: "#FFF", fontSize: 22, fontWeight: "800", marginTop: 16, textAlign: "center" }}>{badge.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 }}>
          <View style={{ backgroundColor: rarity.color + "30", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: rarity.color, fontSize: 13, fontWeight: "700" }}>{rarity.label} Badge</Text>
          </View>
        </View>
        <Text style={{ color: "#DDD", fontSize: 14, textAlign: "center", marginTop: 8, fontStyle: "italic" }}>"{badge.tagline}"</Text>
        <View style={{ backgroundColor: "#F43F8E30", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 14 }}>
          <Text style={{ color: "#F43F8E", fontWeight: "800", fontSize: 18, textAlign: "center" }}>+{badge.points} WeGoFit Points</Text>
        </View>
        <TouchableOpacity onPress={onShare}
          style={{ backgroundColor: ROSE, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 20, width: "100%", alignItems: "center" }}>
          <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Share with Community 📢</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewAll}
          style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, marginTop: 10, width: "100%", alignItems: "center" }}>
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>View All Badges</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 14, padding: 10 }}>
          <Text style={{ color: "#AAA", fontSize: 14 }}>Continue</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── CHALLENGE PROGRESS SCREEN ────────────────────────────────────────────────
export function ChallengeProgressScreen({ challenge, progress, onBack }) {
  const pct = Math.min(progress / challenge.goal.target, 1);
  const typeColor = CHALLENGE_TYPE_COLORS[challenge.type] || ROSE;
  const today = new Date();
  const dayOfChallenge = Math.min(challenge.durationDays, Math.max(1,
    Math.ceil((today - new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)) / 86400000)
  ));

  // Build daily breakdown for day-by-day challenges
  const isNutritionChallenge = challenge.type === "nutrition";
  const isRunChallenge       = challenge.type === "workout";
  const dailyTarget          = isNutritionChallenge ? 4 : null; // meals per day

  const days = Array.from({ length: challenge.durationDays }, (_, i) => {
    const dayNum  = i + 1;
    const isDone  = isNutritionChallenge
      ? (progress / challenge.durationDays) >= dayNum - 1 + 1
      : false;
    const isCurrent = dayNum === dayOfChallenge;
    const isFuture  = dayNum > dayOfChallenge;
    return { dayNum, isDone, isCurrent, isFuture };
  });

  const myRank = MOCK_LEADERBOARD.filter(u => u.points > (progress * 10)).length + 1;
  const top3   = MOCK_LEADERBOARD.slice(0, 3);

  // SVG ring params
  const R = 70, CIRC = 2 * Math.PI * R;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#070B14" }}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}>
      <SafeAreaView>
        <TouchableOpacity onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <Text style={{ color: "#FF6B35", fontSize: 16, fontWeight: "700" }}>‹ Back</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <View style={{ paddingHorizontal: 16 }}>
        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 24, marginBottom: 6 }}>{challenge.emoji}</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#FFFFFF", lineHeight: 26 }}>{challenge.title}</Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            {challenge.durationDays}-day challenge · {challenge.participants} participants
          </Text>
        </View>

        {/* Progress ring */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 20, marginBottom: 16,
          alignItems: "center" }}>
          <View style={{ position: "relative", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Svg width={160} height={160} style={{ transform: [{ rotate: "-90deg" }] }}>
              <Circle cx={80} cy={80} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={12} />
              <Circle cx={80} cy={80} r={R} fill="none" stroke="#FF6B35" strokeWidth={12}
                strokeDasharray={`${pct * CIRC} ${CIRC - pct * CIRC}`}
                strokeLinecap="round" />
            </Svg>
            <View style={{ position: "absolute", alignItems: "center" }}>
              <Text style={{ fontSize: 32, fontWeight: "800", color: "#FFFFFF" }}>{Math.round(pct * 100)}%</Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>complete</Text>
            </View>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FF6B35" }}>
            {progress} / {challenge.goal.target} {challenge.goal.unit}
          </Text>
        </View>

        {/* Daily breakdown */}
        {(isNutritionChallenge || challenge.durationDays <= 14) && (
          <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 }}>
              📅 Daily Breakdown
            </Text>
            {isRunChallenge ? (
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Distance covered</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF6B35" }}>
                    {Number(progress).toFixed(1)} km / {challenge.goal.target} km
                  </Text>
                </View>
                <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                  <View style={{ height: 8, borderRadius: 4, width: `${pct * 100}%`, backgroundColor: "#FF6B35" }} />
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {days.map(({ dayNum, isDone, isCurrent, isFuture }) => (
                  <View key={dayNum} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                    backgroundColor: isCurrent ? "rgba(255,107,53,0.1)" : "transparent",
                    borderRadius: 10, padding: isCurrent ? 8 : 0,
                    borderWidth: isCurrent ? 1 : 0, borderColor: isCurrent ? "rgba(255,107,53,0.3)" : "transparent" }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14,
                      backgroundColor: isDone ? "rgba(16,185,129,0.15)" : isCurrent ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.06)",
                      alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 12 }}>{isDone ? "✅" : isCurrent ? "⏳" : isFuture ? "○" : "—"}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: isDone ? "#10B981" : isCurrent ? "#FF6B35" : isFuture ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)",
                      fontWeight: isCurrent ? "700" : "400" }}>
                      Day {dayNum}
                    </Text>
                    {!isFuture && dailyTarget && (
                      <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: "auto" }}>
                        {isDone ? dailyTarget : isCurrent ? Math.round(progress % dailyTarget || 0) : "—"} / {dailyTarget} meals
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Badge & reward */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16, alignItems: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12, alignSelf: "flex-start" }}>
            🏅 Reward
          </Text>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>{challenge.emoji}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: typeColor, textAlign: "center", lineHeight: 18 }}>
            {challenge.reward}
          </Text>
          {pct < 1 && (
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 6, textAlign: "center" }}>
              {challenge.goal.target - progress} {challenge.goal.unit} more to unlock
            </Text>
          )}
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4, textAlign: "center" }}>
            🎁 Prize: {challenge.prize}
          </Text>
        </View>

        {/* Motivation */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 12, padding: 14,
          marginBottom: 16, borderLeftWidth: 3, borderLeftColor: "#FF6B35" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF6B35", marginBottom: 4 }}>
            Coach TinaBarks 🌸
          </Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 18 }}>
            Keep going! You're {Math.round(pct * 100)}% there! 💪 Every step counts — show the Squad what you're made of!
          </Text>
        </View>

        {/* Leaderboard position */}
        <View style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 }}>
            🏆 Leaderboard
          </Text>
          <View style={{ backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 10, padding: 10, marginBottom: 12,
            borderWidth: 1, borderColor: "rgba(255,107,53,0.3)", alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Your position</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#FF6B35" }}>#{myRank}</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>out of {challenge.participants} participants</Text>
          </View>
          {top3.map((u, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10,
              paddingVertical: 8, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ fontSize: 16, width: 24 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
              </Text>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: u.color,
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 12 }}>{u.initials}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>{u.name}</Text>
              <Text style={{ fontSize: 12, color: "#FF6B35", fontWeight: "700" }}>{u.points} pts</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── COMMUNITY SCREEN ─────────────────────────────────────────────────────────
export function CommunityScreen({ navigation }) {
  const { userPoints, unlockedBadges, awardPoints, unlockBadge, profile, dayLog } = useContext(Ctx);
  const { session } = useContext(AuthCtx);
  const { theme } = useTheme();

  const [activeTab,       setActiveTab]       = useState("challenges");
  const [joinedChs,       setJoinedChs]       = useState({});
  const [chProgress,      setChProgress]      = useState({});
  const [feedPosts,       setFeedPosts]        = useState([]);
  const [feedLoading,     setFeedLoading]      = useState(false);
  const [lbFilter,        setLbFilter]         = useState("week");
  const [showPostModal,   setShowPostModal]    = useState(false);
  const [postType,        setPostType]         = useState(null);
  const [customText,      setCustomText]       = useState("");
  const [unlockBadgeData, setUnlockBadgeData] = useState(null);
  const [viewingChallenge,setViewingChallenge] = useState(null);
  const [commentPost,     setCommentPost]      = useState(null); // post being commented on
  const [comments,        setComments]         = useState({});   // { postId: [comment,...] }
  const [commentInput,    setCommentInput]     = useState("");
  const [feedFilter,      setFeedFilter]       = useState("all"); // all|workout|meal|challenge|streak
  const [editingPost,     setEditingPost]      = useState(null);  // { id, content } being edited
  const [editText,        setEditText]         = useState("");
  const [postMenuId,      setPostMenuId]       = useState(null);  // post id with open ⋮ menu
  const [showStandards,   setShowStandards]    = useState(false);
  const [postSubmitting,  setPostSubmitting]   = useState(false);
  const [postToast,       setPostToast]        = useState(null);  // success message string

  const currentUserId   = session?.userId || null;
  const currentEmail    = session?.email  || null;
  const isCoachSession  = session?.userType === "coach";
  const COACH_EMAILS    = ["gofit.fitnessapp@gmail.com", "arintina77@gmail.com"];
  const isCoach         = isCoachSession || COACH_EMAILS.includes((currentEmail || "").toLowerCase());

  // Show community standards once per device
  useEffect(() => {
    (async () => {
      const seen = await AsyncStorage.getItem("hasSeenSquadStandards");
      if (!seen) {
        setShowStandards(true);
        await AsyncStorage.setItem("hasSeenSquadStandards", "true");
      }
    })();
  }, []);

  // ── helpers ──────────────────────────────────────────────────────────────────
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
      edited:       row.edited || false,
      editedAt:     row.edited_at || null,
    };
  }

  function formatTimestamp(ts) {
    if (!ts) return "";
    const diff = Date.now() - new Date(ts).getTime();
    const sec  = Math.floor(diff / 1000);
    const min  = Math.floor(sec / 60);
    const hr   = Math.floor(min / 60);
    const day  = Math.floor(hr / 24);
    if (sec < 60)  return "Just now";
    if (min < 60)  return `${min}m ago`;
    if (hr < 24)   return `${hr}h ago`;
    if (day === 1) return "Yesterday";
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  // ── load feed from Supabase ───────────────────────────────────────────────────
  async function fetchFeed() {
    setFeedLoading(true);
    const { data, error } = await supabase
      .from("squad_feed")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setFeedPosts(data.map(mapDbPost));
    setFeedLoading(false);
  }

  useEffect(() => {
    fetchFeed();
    const channel = supabase
      .channel("squad_feed_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "squad_feed" }, () => fetchFeed())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── load challenge join/progress state ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // local fallback
      const [jc, cp] = await Promise.all([
        AsyncStorage.getItem("gofit_joined_challenges"),
        AsyncStorage.getItem("gofit_ch_progress"),
      ]);
      if (jc) setJoinedChs(JSON.parse(jc));
      if (cp) setChProgress(JSON.parse(cp));

      // sync from Supabase if logged in
      if (!currentUserId) return;
      try {
        const { data } = await supabase
          .from("challenge_participants")
          .select("challenge_id, progress, is_active")
          .eq("user_id", currentUserId);
        if (data && data.length > 0) {
          const jMap = {}, pMap = {};
          data.forEach(r => { jMap[r.challenge_id] = r.is_active; pMap[r.challenge_id] = r.progress; });
          setJoinedChs(jMap);
          setChProgress(pMap);
        }
      } catch (_) {}
    })();
  }, [currentUserId]);

  // ── join challenge ────────────────────────────────────────────────────────────
  async function joinChallenge(chId) {
    const next = { ...joinedChs, [chId]: true };
    setJoinedChs(next);
    await AsyncStorage.setItem("gofit_joined_challenges", JSON.stringify(next));
    setChProgress(prev => ({ ...prev, [chId]: prev[chId] || 0 }));
    if (currentUserId) {
      await supabase.from("challenge_participants").upsert(
        { challenge_id: chId, user_id: currentUserId, progress: 0, is_active: true },
        { onConflict: "challenge_id,user_id" }
      );
    }
  }

  // ── like / unlike a post ──────────────────────────────────────────────────────
  async function toggleLike(post) {
    if (!currentUserId) return;
    const uid = currentUserId;
    const alreadyLiked = (post.likedBy || []).includes(uid);
    const newLikedBy   = alreadyLiked
      ? (post.likedBy || []).filter(id => id !== uid)
      : [...(post.likedBy || []), uid];
    const newLikes = Math.max(0, alreadyLiked ? post.likes - 1 : post.likes + 1);

    // optimistic update
    setFeedPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, likes: newLikes, likedBy: newLikedBy } : p));

    await supabase.from("squad_feed")
      .update({ likes: newLikes, liked_by: newLikedBy })
      .eq("id", post.id);
  }

  // ── load comments for a post ──────────────────────────────────────────────────
  async function loadComments(postId) {
    try {
      const { data } = await supabase
        .from("squad_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (data) setComments(prev => ({ ...prev, [postId]: data }));
    } catch (_) {}
  }

  async function submitComment(postId) {
    if (!commentInput.trim()) return;
    const text     = commentInput.trim();
    const initials = (profile?.name || session?.name || "M").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
    const row = {
      post_id:       postId,
      user_id:       currentUserId || null,
      user_name:     profile?.name || session?.name || "Member",
      user_initials: initials,
      is_coach:      isCoachSession,
      content:       text,
    };
    setCommentInput("");
    // optimistic
    const optimistic = { ...row, id: `tmp_${Date.now()}`, created_at: new Date().toISOString() };
    setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), optimistic] }));
    // update comment count optimistically
    setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments + 1 } : p));

    try {
      const { data: inserted } = await supabase.from("squad_comments").insert(row).select().maybeSingle();
      if (inserted) {
        setComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(c => c.id === optimistic.id ? inserted : c),
        }));
        await supabase.from("squad_feed").update({ comments: (feedPosts.find(p=>p.id===postId)?.comments||0)+1 }).eq("id", postId);
      }
    } catch (_) {}
  }

  // ── pin / delete / edit ───────────────────────────────────────────────────────
  async function pinPost(postId, pinned) {
    setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, isPinned: !pinned } : p));
    await supabase.from("squad_feed").update({ is_pinned: !pinned }).eq("id", postId);
  }

  async function deletePost(postId, isCoachAction = false) {
    setFeedPosts(prev => prev.filter(p => p.id !== postId));
    try {
      await supabase.from("squad_feed").delete().eq("id", postId);
    } catch (_) {}
  }

  async function saveEditPost() {
    if (!editingPost || !editText.trim()) return;
    const { id } = editingPost;
    const content = editText.trim();
    setFeedPosts(prev => prev.map(p => p.id === id ? { ...p, content, edited: true } : p));
    setEditingPost(null);
    setEditText("");
    try {
      await supabase.from("squad_feed")
        .update({ content, edited: true, edited_at: new Date().toISOString() })
        .eq("id", id);
    } catch (_) {}
  }

  // ── helpers ──────────────────────────────────────────────────────────────────
  function getInitials(nameOrEmail) {
    if (!nameOrEmail) return "M";
    const parts = nameOrEmail.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nameOrEmail.substring(0, 2).toUpperCase();
  }

  // ── create post ───────────────────────────────────────────────────────────────
  async function handlePost() {
    if (!customText.trim() || !postType) return;
    if (postSubmitting) return;

    const TYPE_EMOJIS = { thought:"💬", workout:"🏃", meal:"🍽️", challenge:"🏆", water:"💧" };
    const em       = TYPE_EMOJIS[postType] || "✨";
    const rawName  = profile?.name || session?.name || session?.email?.split("@")[0] || "Member";
    const initials = getInitials(rawName);

    const row = {
      user_id:       currentUserId?.toString() || "anonymous",
      user_name:     rawName,
      user_initials: initials,
      content:       customText.trim(),
      post_type:     postType || "thought",
      likes:         0,
      liked_by:      [],
    };

    setPostSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from("squad_feed")
        .insert([row])
        .select()
        .maybeSingle();

      if (error) {
        console.log("SUPABASE ERROR:", JSON.stringify(error));
        Alert.alert("Could not post", error.message);
        setPostSubmitting(false);
        return;
      }

      // Close and reset
      setShowPostModal(false);
      setCustomText("");
      setPostType(null);
      setPostSubmitting(false);

      // Refresh feed from Supabase
      fetchFeed();

      // Success toast
      setPostToast("Posted to Squad! 🎉");
      setTimeout(() => setPostToast(null), 2500);

      await awardPoints("share_achievement", POINTS.share_achievement);
      const unlocked = await unlockBadge("community_spark");
      if (unlocked) setUnlockBadgeData(BADGES.find(b => b.id === "community_spark"));
    } catch (err) {
      console.log("SUPABASE CATCH:", err?.message || err);
      Alert.alert("Could not post", err?.message || "Please check your connection and try again.");
      setPostSubmitting(false);
    }
  }

  // My rank on leaderboard (mock: append current user if points available)
  const myPoints = userPoints || 0;
  const myRank   = MOCK_LEADERBOARD.filter(u => u.points > myPoints).length + 1;
  const aheadOf  = MOCK_LEADERBOARD.find(u => u.rank === myRank - 1);

  const CHALLENGE_TYPE_ICONS = { nutrition:"🥗", workout:"🏃", water:"💧", weight_loss:"⚖️", sleep:"😴" };

  // ── CHALLENGES TAB ──
  function ChallengesTab() {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        <Text style={[S.heading, { marginBottom: 4 }]}>Squad Challenges 🏆</Text>
        <Text style={{ color: C.grey, fontSize: 13, marginBottom: 4 }}>Compete. Sweat. Win.</Text>
        <Text style={{ color: ROSE, fontSize: 13, fontWeight: "600", marginBottom: 20 }}>Set by Coach TinaBarks 🌸</Text>

        <Text style={{ color: C.text, fontSize: 15, fontWeight: "700", marginBottom: 12 }}>🔥 Active This Week</Text>

        {PRESET_CHALLENGES.map(ch => {
          const joined   = joinedChs[ch.id];
          const progress = chProgress[ch.id] || 0;
          const pct      = Math.min(progress / ch.goal.target, 1);
          const typeColor = CHALLENGE_TYPE_COLORS[ch.type] || ROSE;
          return (
            <View key={ch.id} style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 14,
              borderLeftWidth: 4, borderLeftColor: typeColor,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1, marginRight: joined ? 8 : 0 }}>
                  <Text style={{ fontSize: 24, marginRight: 10 }}>{ch.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 14 }} numberOfLines={2}>{ch.title}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>👥 {ch.participants} participants · ⏰ {ch.durationDays}d</Text>
                  </View>
                </View>
                {joined && (
                  <View style={{ backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 }}>
                    <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "700" }}>JOINED ✅</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18, marginBottom: 10 }}>{ch.description}</Text>
              {joined && (
                <View style={{ marginBottom: 10 }}>
                  <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{progress} / {ch.goal.target} {ch.goal.unit}</Text>
                    <Text style={{ color: typeColor, fontSize: 12, fontWeight: "700" }}>{Math.round(pct * 100)}%</Text>
                  </Row>
                  <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                    <View style={{ height: 8, borderRadius: 4, width: `${pct * 100}%`, backgroundColor: typeColor }} />
                  </View>
                </View>
              )}
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 8 }}>🎁 Prize: {ch.prize}</Text>
              <Text style={{ color: typeColor, fontSize: 12, fontWeight: "600", marginBottom: 10 }}>🏅 {ch.reward}</Text>
              {!joined ? (
                <TouchableOpacity onPress={() => joinChallenge(ch.id)}
                  style={{ backgroundColor: "#FF6B35", borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14,
                    alignItems: "center", alignSelf: "stretch" }}>
                  <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Join</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setViewingChallenge({ challenge: ch, progress })}
                  style={{ borderWidth: 1.5, borderColor: typeColor, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
                  <Text style={{ color: typeColor, fontWeight: "700", fontSize: 14 }}>View My Progress</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // ── LEADERBOARD TAB ──
  function LeaderboardTab() {
    const top3  = MOCK_LEADERBOARD.slice(0, 3);
    const rest  = MOCK_LEADERBOARD.slice(3);
    const podiumColors = [
      { bg: "rgba(245,158,11,0.12)", border: "#F59E0B", medal: "🥇", label: "1st" },
      { bg: "#1E2837", border: "#9CA3AF", medal: "🥈", label: "2nd" },
      { bg: "rgba(180,83,9,0.12)", border: "#B45309", medal: "🥉", label: "3rd" },
    ];
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Text style={[S.heading, { marginBottom: 4 }]}>Squad Leaderboard 🏆</Text>

        {/* Stats row */}
        <Row style={{ gap: 8, marginBottom: 20 }}>
          {[{ v: "47", l: "Active Members" }, { v: "12,840", l: "Total Points" }, { v: "284", l: "Challenges Done" }].map(s => (
            <View key={s.l} style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 12,
              alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: ROSE, fontWeight: "800", fontSize: 18 }}>{s.v}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, textAlign: "center", marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </Row>

        {/* Time filter */}
        <Row style={{ gap: 8, marginBottom: 20 }}>
          {[["week","This Week"],["month","This Month"],["all","All Time"]].map(([k,l]) => (
            <TouchableOpacity key={k} onPress={() => setLbFilter(k)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10,
                backgroundColor: lbFilter === k ? ROSE : "#1E2837",
                alignItems: "center", borderWidth: 1,
                borderColor: lbFilter === k ? ROSE : "rgba(255,255,255,0.12)" }}>
              <Text style={{ color: lbFilter === k ? "#FFF" : "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 12 }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </Row>

        {/* Top 3 podium */}
        <View style={{ marginBottom: 20 }}>
          {/* 1st place */}
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 28 }}>🥇</Text>
            <View style={{ backgroundColor: podiumColors[0].bg, borderRadius: 16, padding: 16,
              borderWidth: 2, borderColor: podiumColors[0].border, alignItems: "center", width: "70%" }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: top3[0].color,
                alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>{top3[0].initials}</Text>
              </View>
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>{top3[0].name}</Text>
              <Text style={{ color: podiumColors[0].border, fontWeight: "700", fontSize: 14 }}>{top3[0].points.toLocaleString()} pts</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>🔥 {top3[0].streak}d streak</Text>
            </View>
          </View>
          {/* 2nd + 3rd */}
          <Row style={{ gap: 10, justifyContent: "center" }}>
            {[1, 2].map(i => (
              <View key={i} style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 24 }}>{podiumColors[i].medal}</Text>
                <View style={{ backgroundColor: podiumColors[i].bg, borderRadius: 14, padding: 12,
                  borderWidth: 1.5, borderColor: podiumColors[i].border, alignItems: "center", width: 130 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: top3[i].color,
                    alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                    <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 14 }}>{top3[i].initials}</Text>
                  </View>
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>{top3[i].name}</Text>
                  <Text style={{ color: podiumColors[i].border, fontWeight: "700", fontSize: 13 }}>{top3[i].points.toLocaleString()} pts</Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>🔥 {top3[i].streak}d</Text>
                </View>
              </View>
            ))}
          </Row>
        </View>

        {/* Rank 4-10 */}
        {rest.map(u => (
          <View key={u.rank} style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 8,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 16, width: 28 }}>#{u.rank}</Text>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: u.color,
              alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 13 }}>{u.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{u.name}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{u.plan} · 🔥 {u.streak}d streak</Text>
            </View>
            <Text style={{ color: ROSE, fontWeight: "800", fontSize: 14 }}>{u.points.toLocaleString()}</Text>
          </View>
        ))}

        {/* My position */}
        <View style={{ backgroundColor: "rgba(255,107,53,0.12)", borderRadius: 16, padding: 16, marginTop: 8,
          borderWidth: 1.5, borderColor: "rgba(255,107,53,0.35)" }}>
          <Text style={{ color: ROSE, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>YOUR POSITION</Text>
          <Row style={{ justifyContent: "space-between" }}>
            <Row>
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>#{myRank}</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginLeft: 8 }}>You · {myPoints.toLocaleString()} pts</Text>
            </Row>
            <Text style={{ color: ROSE, fontWeight: "800", fontSize: 15 }}>{myPoints.toLocaleString()}</Text>
          </Row>
          {aheadOf && (
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 6 }}>
              {aheadOf.points - myPoints} points behind #{aheadOf.rank} — keep going! 💪
            </Text>
          )}
        </View>
      </ScrollView>
    );
  }

  // ── FEED POST CARD ────────────────────────────────────────────────────────────
  function FeedPostCard({ post }) {
    const isLiked   = (post.likedBy || []).includes(currentUserId);
    const isOwner   = post.userId === currentUserId;
    const menuOpen  = postMenuId === post.id;

    function openMenu() { setPostMenuId(menuOpen ? null : post.id); }
    function closeMenu() { setPostMenuId(null); }

    function handleEdit() {
      closeMenu();
      setEditingPost(post);
      setEditText(post.content);
    }

    function handleDeleteOwn() {
      closeMenu();
      Alert.alert(
        "Delete this post?",
        "This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => deletePost(post.id) },
        ]
      );
    }

    function handleCoachRemove() {
      closeMenu();
      Alert.alert(
        "Remove post?",
        "Remove this post for violating community standards?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove Post", style: "destructive", onPress: () => deletePost(post.id, true) },
        ]
      );
    }

    const showMenu = isOwner || isCoach;

    return (
      <View style={{
        backgroundColor: post.isPinned ? "rgba(255,107,53,0.08)" : "#111827",
        borderRadius: 16, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: post.isPinned ? "rgba(255,107,53,0.3)" : "rgba(255,255,255,0.06)",
        ...(post.isPinned ? { borderLeftWidth: 4, borderLeftColor: ROSE } : {}),
      }}>
        {post.isPinned && (
          <Text style={{ color: ROSE, fontSize: 11, fontWeight: "700", marginBottom: 6 }}>📌 PINNED</Text>
        )}
        <Row style={{ marginBottom: 8, alignItems: "flex-start" }}>
          <View style={{ width: 36, height: 36, borderRadius: 18,
            backgroundColor: post.isCoach ? ROSE : "#1E6091",
            alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 12 }}>{post.userInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 14 }}>{post.userName}</Text>
              {post.isCoach && (
                <View style={{ backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: ROSE, fontSize: 9, fontWeight: "800" }}>HEAD COACH</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: C.grey, fontSize: 12 }}>{formatTimestamp(post.postedAt)}</Text>
              {post.edited && (
                <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>· edited</Text>
              )}
            </View>
          </View>
          {/* Three-dot menu */}
          {showMenu && (
            <View style={{ position: "relative" }}>
              <TouchableOpacity onPress={openMenu}
                style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center",
                  borderRadius: 8, backgroundColor: menuOpen ? "rgba(255,255,255,0.08)" : "transparent" }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 18, lineHeight: 20 }}>⋮</Text>
              </TouchableOpacity>
              {menuOpen && (
                <View style={{ position: "absolute", right: 0, top: 36, zIndex: 999,
                  backgroundColor: "#1E2837", borderRadius: 12, minWidth: 180,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                  shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10 }}>
                  {isOwner && (
                    <TouchableOpacity onPress={handleEdit}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
                        borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                      <Text style={{ fontSize: 16 }}>✏️</Text>
                      <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>Edit Post</Text>
                    </TouchableOpacity>
                  )}
                  {isOwner && (
                    <TouchableOpacity onPress={handleDeleteOwn}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
                        borderBottomWidth: isCoach ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                      <Text style={{ fontSize: 16 }}>🗑️</Text>
                      <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 14 }}>Delete Post</Text>
                    </TouchableOpacity>
                  )}
                  {isCoach && (
                    <TouchableOpacity onPress={handleCoachRemove}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14 }}>
                      <Text style={{ fontSize: 16 }}>🚫</Text>
                      <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 14 }}>Remove Post</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </Row>
        <Text style={{ color: C.text, fontSize: 14, lineHeight: 20,
          marginBottom: post.stats && Object.keys(post.stats).length > 0 ? 10 : 8 }}>
          {post.emoji} {post.content}
        </Text>
        {post.stats && Object.keys(post.stats).length > 0 && (
          <View style={{ backgroundColor: C.bgSecondary, borderRadius: 10, padding: 10, marginBottom: 10 }}>
            {Object.entries(post.stats).map(([k, v]) => (
              <Text key={k} style={{ color: C.grey, fontSize: 12 }}>
                {k === "distance" ? "📍 " : k === "duration" ? "⏱ " : k === "calories" ? "🔥 " : k === "points" ? "🏆 " : k === "streak" ? "🔥 " : k === "lost" ? "⚖️ " : k === "days" ? "💧 " : "📊 "}{v}
              </Text>
            ))}
          </View>
        )}
        <Row style={{ gap: 16 }}>
          <TouchableOpacity onPress={() => toggleLike(post)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 16 }}>{isLiked ? "❤️" : "🤍"}</Text>
            <Text style={{ color: isLiked ? ROSE : C.grey, fontSize: 13, fontWeight: "600" }}>{post.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { closeMenu(); setCommentPost(post); loadComments(post.id); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 16 }}>💬</Text>
            <Text style={{ color: C.grey, fontSize: 13 }}>{post.comments}</Text>
          </TouchableOpacity>
        </Row>
      </View>
    );
  }

  // ── FEED TAB ──
  function FeedTab() {
    const FILTERS = [
      { key: "all", label: "All" },
      { key: "workout", label: "🏃 Workouts" },
      { key: "meal", label: "🥗 Meals" },
      { key: "challenge", label: "🏆 Challenges" },
      { key: "streak", label: "🔥 Milestones" },
    ];
    const filtered = feedFilter === "all"
      ? feedPosts
      : feedPosts.filter(p => p.type === feedFilter);

    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
          <View>
            <Text style={[S.heading, { marginBottom: 2 }]}>Squad Feed 📢</Text>
            <Text style={{ color: C.grey, fontSize: 13 }}>
              {feedLoading ? "Loading..." : `${feedPosts.length} posts · celebrating every win 🌸`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowPostModal(true)}
            style={{ backgroundColor: ROSE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 13 }}>+ Share</Text>
          </TouchableOpacity>
        </Row>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.key} onPress={() => setFeedFilter(f.key)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: feedFilter === f.key ? ROSE : "#1E2837",
                borderWidth: 1, borderColor: feedFilter === f.key ? ROSE : "rgba(255,255,255,0.1)" }}>
              <Text style={{ color: feedFilter === f.key ? "#FFF" : "rgba(255,255,255,0.6)", fontWeight: "600", fontSize: 12 }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {feedLoading && (
          <View style={{ alignItems: "center", padding: 40 }}>
            <ActivityIndicator size="large" color={ROSE} />
          </View>
        )}
        {!feedLoading && filtered.map(post => (
          <FeedPostCard key={post.id} post={post} />
        ))}
        {!feedLoading && filtered.length === 0 && (
          <View style={{ alignItems: "center", padding: 40 }}>
            <Text style={{ fontSize: 36 }}>📢</Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 12, textAlign: "center" }}>
              No posts yet. Be the first to share!
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  const TABS = [
    { key: "challenges", label: "🏆 Challenges" },
    { key: "leaderboard", label: "📊 Leaderboard" },
    { key: "feed",        label: "📢 Feed" },
  ];

  if (viewingChallenge) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#070B14" }}>
        <ChallengeProgressScreen
          challenge={viewingChallenge.challenge}
          progress={viewingChallenge.progress}
          onBack={() => setViewingChallenge(null)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.screen}>
      {/* Squad header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>WeGoFit Squad 🏆</Text>
          <Text style={{ color: theme.textSub, fontSize: 13, marginTop: 2 }}>Challenges · Leaderboard · Feed</Text>
        </View>
        <Image source={LOGO_URI} style={{ width: 80, height: 40, resizeMode: "contain" }} />
      </View>

      {/* Tab bar */}
      <View style={{ backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border, paddingTop: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: activeTab === t.key ? ROSE : theme.cardLight,
                borderWidth: 1, borderColor: activeTab === t.key ? ROSE : theme.border }}>
              <Text style={{ color: activeTab === t.key ? "#FFF" : theme.text, fontWeight: "700", fontSize: 13 }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeTab === "challenges"  && <ChallengesTab />}
      {activeTab === "leaderboard" && <LeaderboardTab />}
      {activeTab === "feed"        && <FeedTab />}

      {/* Post creation modal */}
      <Modal visible={showPostModal} animationType="slide" transparent presentationStyle="overFullScreen"
        onRequestClose={() => { if (!postSubmitting) { setShowPostModal(false); setPostType(null); setCustomText(""); } }}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => { if (!postSubmitting) { setShowPostModal(false); setPostType(null); setCustomText(""); } }} accessible={false}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} />
          </TouchableWithoutFeedback>
          <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 44 : 28 }}>
            {/* drag handle */}
            <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />

            {/* STEP 1 — type not yet selected */}
            {!postType && (
              <>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 18, marginBottom: 4 }}>Share with the Squad</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 16 }}>What would you like to share today?</Text>
                {[
                  { t: "thought",   l: "💬 Share a thought",             sub: "What's on your mind today?" },
                  { t: "workout",   l: "🏃 Share a workout",             sub: "How did your workout go?" },
                  { t: "meal",      l: "🍽️ Share a meal win",            sub: "What did you eat well today?" },
                  { t: "challenge", l: "🏆 Share a challenge milestone",  sub: "Share your challenge progress!" },
                  { t: "water",     l: "💧 Share a water goal",           sub: "How much water did you drink?" },
                ].map(o => (
                  <TouchableOpacity key={o.t} onPress={() => setPostType(o.t)}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1E2837",
                      borderRadius: 12, padding: 14, marginBottom: 8,
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{o.l}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{o.sub}</Text>
                    </View>
                    <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 18 }}>›</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* STEP 2 — type selected, show text input */}
            {!!postType && (
              <>
                {/* Back + type label header */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 10 }}>
                  <TouchableOpacity onPress={() => { setPostType(null); setCustomText(""); }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: "rgba(255,255,255,0.07)" }}>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>‹ Back</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>
                      {{ thought:"💬 Share a thought", workout:"🏃 Share a workout",
                         meal:"🍽️ Share a meal win", challenge:"🏆 Challenge milestone",
                         water:"💧 Water goal" }[postType]}
                    </Text>
                  </View>
                </View>

                {/* Required text input */}
                <TextInput
                  style={{ backgroundColor: "#1E2837", borderColor: ROSE, borderWidth: 1.5,
                    borderRadius: 12, color: "#FFFFFF", fontSize: 15, padding: 14,
                    minHeight: 100, textAlignVertical: "top", marginBottom: 16 }}
                  placeholder={
                    { thought: "What's on your mind today?",
                      workout: "How did your workout go?",
                      meal:    "What did you eat well today?",
                      challenge: "Share your challenge progress!",
                      water:   "How much water did you drink?" }[postType]
                  }
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={customText}
                  onChangeText={setCustomText}
                  multiline
                  autoFocus
                />

                {/* Post button — disabled when empty */}
                <TouchableOpacity
                  onPress={handlePost}
                  disabled={!customText.trim() || postSubmitting}
                  style={{ borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center",
                    backgroundColor: customText.trim() && !postSubmitting ? ROSE : "rgba(255,255,255,0.1)" }}>
                  {postSubmitting
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={{ fontWeight: "800", fontSize: 16,
                        color: customText.trim() ? "#FFFFFF" : "rgba(255,255,255,0.3)" }}>
                        Post to Community 📢
                      </Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments modal */}
      <Modal visible={!!commentPost} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => setCommentPost(null)} accessible={false}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
          </TouchableWithoutFeedback>
          <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: "70%", paddingBottom: Platform.OS === "ios" ? 36 : 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 12 }} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>
                💬 Comments ({commentPost ? (comments[commentPost.id] || []).length : 0})
              </Text>
              {commentPost && (
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {commentPost.emoji} {commentPost.content}
                </Text>
              )}
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
              {commentPost && (comments[commentPost.id] || []).length === 0 && (
                <Text style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 20, fontSize: 13 }}>
                  No comments yet. Be the first!
                </Text>
              )}
              {commentPost && (comments[commentPost.id] || []).map((c, i) => (
                <View key={c.id || i} style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, flexShrink: 0,
                    backgroundColor: c.is_coach ? ROSE : "#6366F1",
                    alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 10 }}>{c.user_initials || "?"}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: "#1E2837", borderRadius: 12, padding: 10,
                    borderWidth: c.is_coach ? 1 : 0, borderColor: c.is_coach ? "rgba(255,107,53,0.4)" : "transparent" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <Text style={{ color: c.is_coach ? ROSE : "#FFFFFF", fontWeight: "700", fontSize: 12 }}>
                        {c.user_name || "Member"}
                      </Text>
                      {c.is_coach && (
                        <View style={{ backgroundColor: "rgba(255,107,53,0.15)", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                          <Text style={{ color: ROSE, fontSize: 8, fontWeight: "800" }}>COACH</Text>
                        </View>
                      )}
                      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginLeft: "auto" }}>
                        {timeAgo(c.created_at)}
                      </Text>
                    </View>
                    <Text style={{ color: c.is_coach ? "rgba(255,200,150,0.9)" : "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 18 }}>
                      {c.content}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10,
              borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
              <TextInput
                style={[S.input, { flex: 1, minHeight: 40, paddingVertical: 10 }]}
                placeholder="Write a comment..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={commentInput}
                onChangeText={setCommentInput}
                returnKeyType="send"
                onSubmitEditing={() => commentPost && submitComment(commentPost.id)}
              />
              <TouchableOpacity
                onPress={() => commentPost && submitComment(commentPost.id)}
                style={{ backgroundColor: commentInput.trim() ? ROSE : "rgba(255,107,53,0.3)",
                  borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Success toast */}
      {!!postToast && (
        <View style={{ position: "absolute", bottom: 100, left: 20, right: 20, zIndex: 9999,
          backgroundColor: "#22C55E", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
          flexDirection: "row", alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>{postToast}</Text>
        </View>
      )}

      {/* Edit post modal */}
      <Modal visible={!!editingPost} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => { setEditingPost(null); setEditText(""); }} accessible={false}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
          </TouchableWithoutFeedback>
          <View style={{ backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 32 }}>
            <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 18, marginBottom: 4 }}>Edit Post</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 16 }}>Update your message to the Squad</Text>
            <TextInput
              style={[S.input, { minHeight: 100, textAlignVertical: "top", marginBottom: 16 }]}
              placeholder="What's on your mind?"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => { setEditingPost(null); setEditText(""); }}
                style={{ flex: 1, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)", borderRadius: 14,
                  paddingVertical: 14, alignItems: "center" }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontWeight: "700", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEditPost}
                style={{ flex: 2, backgroundColor: editText.trim() ? ROSE : "rgba(255,107,53,0.4)",
                  borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Community standards modal — shown once */}
      <Modal visible={showStandards} animationType="fade" transparent presentationStyle="overFullScreen">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#111827", borderRadius: 20, padding: 24, width: "90%" }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 24 }}>🧡</Text>
              <Text style={{ flex: 1, color: "#FFFFFF", fontWeight: "800", fontSize: 18, textAlign: "center" }}>
                WeGoFit Squad Standards
              </Text>
              <TouchableOpacity onPress={() => setShowStandards(false)} style={{ padding: 4 }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 20, lineHeight: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {/* Divider */}
            <View style={{ height: 2, backgroundColor: ROSE, borderRadius: 1, marginBottom: 16 }} />
            {/* Body */}
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 22, marginBottom: 20 }}>
              {"WeGoFit Squad is a safe space to celebrate wins, share progress and lift each other up. 💪\n\n✅ Be kind and encouraging\n✅ Celebrate each other's wins\n✅ Share your real journey\n✅ Motivate — never criticise\n\n❌ No negativity or put-downs\n❌ No disrespectful language\n❌ No content that tears others down\n\nWe're all on this journey together. Let's grow stronger as one Squad! 🧡"}
            </Text>
            {/* CTA */}
            <TouchableOpacity onPress={() => setShowStandards(false)}
              style={{ backgroundColor: ROSE, borderRadius: 12, height: 50, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>I Understand — Let's Go! 💪</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Badge unlock overlay */}
      {unlockBadgeData && (
        <BadgeUnlockOverlay
          badge={unlockBadgeData}
          onClose={() => setUnlockBadgeData(null)}
          onShare={() => { setUnlockBadgeData(null); setShowPostModal(true); }}
          onViewAll={() => { setUnlockBadgeData(null); navigation?.navigate("Profile"); }}
        />
      )}
    </SafeAreaView>
  );
}
