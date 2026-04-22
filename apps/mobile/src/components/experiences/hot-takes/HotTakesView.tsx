import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

type VoteCategory = "agree" | "disagree" | "spicy" | "boring";

const VOTE_LABELS: Record<VoteCategory, { emoji: string; color: string }> = {
  agree:    { emoji: "👍", color: "#4ade80" },
  disagree: { emoji: "👎", color: "#f87171" },
  spicy:    { emoji: "🌶️", color: "#f97316" },
  boring:   { emoji: "😐", color: "#6b7280" },
};

interface Take {
  id: string;
  guestId: string;
  text: string;
  votes: Record<VoteCategory, number>;
}

export function HotTakesView() {
  const { state, sendAction } = useRoom();
  const d = (state.guestViewData ?? state.experienceState) as any;
  const phase: string = d?.phase ?? "waiting";
  const topic: string | null = d?.currentTopic ?? null;
  const takes: Take[] = d?.takes ?? [];
  const scores: Record<string, number> = d?.scores ?? {};
  const submittedIds: string[] = d?.submittedIds ?? [];
  const myId = state.guestId ?? "";

  const [takeText, setTakeText] = useState("");
  // takeId → category voted by me this session
  const [myVotes, setMyVotes] = useState<Record<string, VoteCategory>>({});

  const alreadySubmitted = submittedIds.includes(myId);

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  function submitTake() {
    const text = takeText.trim();
    if (!text) return;
    sendAction("submit_take", { text });
    setTakeText("");
  }

  function vote(takeId: string, category: VoteCategory) {
    if (myVotes[takeId]) return; // already voted on this take
    setMyVotes(prev => ({ ...prev, [takeId]: category }));
    sendAction("vote", { takeId, category });
  }

  // ── waiting ────────────────────────────────────────────────────────────────
  if (phase === "waiting" || phase === "topic") return (
    <View style={s.center}>
      <Text style={s.bigEmoji}>🌶️</Text>
      <Text style={s.title}>Hot Takes</Text>
      <Text style={s.sub}>Waiting for the host to start...</Text>
    </View>
  );

  // ── finished ────────────────────────────────────────────────────────────────
  if (phase === "finished") {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    return (
      <View style={s.root}>
        <LinearGradient colors={["#0a0820", "#0d1020"]} style={StyleSheet.absoluteFill} />
        <View style={s.center}>
          <Text style={s.bigEmoji}>🏆</Text>
          <Text style={s.title}>Game Over!</Text>
          <ScrollView style={{ width: "100%", marginTop: 16 }} showsVerticalScrollIndicator={false}>
            {sorted.map(([id, pts], i) => (
              <View key={id} style={s.scoreRow}>
                <Text style={s.scoreRank}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</Text>
                <Text style={s.scoreName}>{id === myId ? "You" : memberName(id)}</Text>
                <Text style={s.scorePts}>{pts} pts</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  // ── submitting ──────────────────────────────────────────────────────────────
  if (phase === "submitting") {
    return (
      <View style={s.root}>
        <LinearGradient colors={["#0a0820", "#0d1020"]} style={StyleSheet.absoluteFill} />
        <View style={s.header}>
          <Text style={s.eyebrow}>HOT TAKES</Text>
          <Text style={s.phaseChip}>SUBMITTING</Text>
        </View>
        {topic && (
          <View style={s.topicCard}>
            <Text style={s.topicLabel}>TOPIC</Text>
            <Text style={s.topicText}>{topic}</Text>
          </View>
        )}
        {alreadySubmitted ? (
          <View style={s.center}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={s.sub}>Take submitted! Waiting for others...</Text>
            <Text style={s.submittedCount}>{submittedIds.length} / {state.members.filter(m => !m.isWorkerNode && m.role !== "HOST" && m.role !== "CO_HOST").length} submitted</Text>
          </View>
        ) : (
          <View style={s.inputArea}>
            <Text style={s.inputLabel}>YOUR HOT TAKE</Text>
            <TextInput
              style={s.input}
              placeholder="Type your hot take..."
              placeholderTextColor="#555"
              value={takeText}
              onChangeText={setTakeText}
              multiline
              maxLength={200}
              returnKeyType="done"
              blurOnSubmit
            />
            <Text style={s.charCount}>{takeText.length}/200</Text>
            <TouchableOpacity
              style={[s.submitBtn, !takeText.trim() && s.submitBtnDisabled]}
              onPress={submitTake}
              disabled={!takeText.trim()}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={takeText.trim() ? ["#f97316", "#ea580c"] : ["#222", "#1a1a1a"]}
                style={s.submitBtnInner}
              >
                <Text style={s.submitBtnText}>Submit Take 🌶️</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── voting ──────────────────────────────────────────────────────────────────
  if (phase === "voting") {
    const votableTakes = takes.filter(t => t.guestId !== myId);
    const allVoted = votableTakes.every(t => !!myVotes[t.id]);
    return (
      <View style={s.root}>
        <LinearGradient colors={["#0a0820", "#0d1020"]} style={StyleSheet.absoluteFill} />
        <View style={s.header}>
          <Text style={s.eyebrow}>HOT TAKES</Text>
          <Text style={s.phaseChip}>VOTING</Text>
        </View>
        {topic && <View style={s.topicCard}><Text style={s.topicLabel}>TOPIC</Text><Text style={s.topicText}>{topic}</Text></View>}
        {allVoted && (
          <View style={s.allVotedBanner}>
            <Text style={s.allVotedText}>All votes in! Waiting for others...</Text>
          </View>
        )}
        <ScrollView contentContainerStyle={s.takesList} showsVerticalScrollIndicator={false}>
          {takes.map(take => {
            const isMyTake = take.guestId === myId;
            const myVote = myVotes[take.id];
            return (
              <View key={take.id} style={[s.takeCard, isMyTake && s.takeCardMine]}>
                <Text style={s.takeAuthor}>{isMyTake ? "Your take" : memberName(take.guestId)}</Text>
                <Text style={s.takeText}>{take.text}</Text>
                {!isMyTake && (
                  <View style={s.voteRow}>
                    {(Object.keys(VOTE_LABELS) as VoteCategory[]).map(cat => {
                      const { emoji, color } = VOTE_LABELS[cat];
                      const selected = myVote === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[s.voteBtn, selected && { borderColor: color, backgroundColor: color + "22" }]}
                          onPress={() => vote(take.id, cat)}
                          disabled={!!myVote}
                          activeOpacity={0.7}
                        >
                          <Text style={s.voteBtnEmoji}>{emoji}</Text>
                          <Text style={[s.voteBtnLabel, { color: selected ? color : "#6b7280" }]}>{cat}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ── reveal ──────────────────────────────────────────────────────────────────
  if (phase === "reveal") {
    const sorted = [...takes].sort((a, b) => {
      const totalA = Object.values(a.votes).reduce((s, v) => s + v, 0);
      const totalB = Object.values(b.votes).reduce((s, v) => s + v, 0);
      return totalB - totalA;
    });
    return (
      <View style={s.root}>
        <LinearGradient colors={["#0a0820", "#0d1020"]} style={StyleSheet.absoluteFill} />
        <View style={s.header}>
          <Text style={s.eyebrow}>HOT TAKES</Text>
          <Text style={s.phaseChip}>RESULTS</Text>
        </View>
        {topic && <View style={s.topicCard}><Text style={s.topicLabel}>TOPIC</Text><Text style={s.topicText}>{topic}</Text></View>}
        <ScrollView contentContainerStyle={s.takesList} showsVerticalScrollIndicator={false}>
          {sorted.map((take, i) => {
            const isMe = take.guestId === myId;
            const myPts = (scores[take.guestId] ?? 0);
            return (
              <View key={take.id} style={[s.revealCard, isMe && s.revealCardMe]}>
                <View style={s.revealHeader}>
                  <Text style={s.revealRank}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</Text>
                  <Text style={s.revealAuthor}>{isMe ? "You" : memberName(take.guestId)}</Text>
                  {isMe && <Text style={s.revealPts}>+{myPts} pts</Text>}
                </View>
                <Text style={s.revealTakeText}>{take.text}</Text>
                <View style={s.revealVotes}>
                  {(Object.entries(VOTE_LABELS) as [VoteCategory, { emoji: string; color: string }][]).map(([cat, { emoji, color }]) => (
                    <View key={cat} style={s.revealVoteBadge}>
                      <Text style={s.revealVoteEmoji}>{emoji}</Text>
                      <Text style={[s.revealVoteCount, { color }]}>{take.votes[cat]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return null;
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  bigEmoji:{ fontSize: 64 },
  title:   { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:     { color: "#6b7280", fontSize: 15, textAlign: "center" },
  submittedCount: { color: "#4ade80", fontSize: 14, fontWeight: "700", marginTop: 8 },

  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  eyebrow:   { color: "#f97316", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  phaseChip: { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  topicCard:  { marginHorizontal: 16, marginBottom: 12, backgroundColor: "rgba(249,115,22,0.1)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(249,115,22,0.25)" },
  topicLabel: { color: "#f97316", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 6 },
  topicText:  { color: "#fff", fontSize: 18, fontWeight: "800", lineHeight: 25 },

  inputArea:  { padding: 16, gap: 10 },
  inputLabel: { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 14,
    color: "#fff",
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount:  { color: "#4b5563", fontSize: 12, textAlign: "right" },
  submitBtn:  { borderRadius: 16, overflow: "hidden" },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnInner:    { padding: 16, alignItems: "center" },
  submitBtnText:     { color: "#fff", fontSize: 16, fontWeight: "900" },

  allVotedBanner: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: "rgba(74,222,128,0.1)",
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "rgba(74,222,128,0.3)",
    alignItems: "center",
  },
  allVotedText: { color: "#4ade80", fontSize: 13, fontWeight: "700" },

  takesList: { padding: 16, gap: 12, paddingBottom: 32 },
  takeCard:  {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16, padding: 16, gap: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  takeCardMine: {
    borderColor: "rgba(249,115,22,0.3)",
    backgroundColor: "rgba(249,115,22,0.06)",
  },
  takeAuthor: { color: "#9ca3af", fontSize: 12, fontWeight: "700" },
  takeText:   { color: "#fff", fontSize: 16, fontWeight: "700", lineHeight: 22 },
  voteRow:    { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  voteBtn:    {
    flex: 1, minWidth: "22%",
    borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)",
    padding: 10, alignItems: "center", gap: 3,
  },
  voteBtnEmoji: { fontSize: 18 },
  voteBtnLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  revealCard:   {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16, padding: 16, gap: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  revealCardMe: { borderColor: "rgba(249,115,22,0.35)", backgroundColor: "rgba(249,115,22,0.07)" },
  revealHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  revealRank:   { fontSize: 22 },
  revealAuthor: { flex: 1, color: "#e5e7eb", fontSize: 14, fontWeight: "800" },
  revealPts:    { color: "#f97316", fontSize: 16, fontWeight: "900" },
  revealTakeText: { color: "#fff", fontSize: 15, fontWeight: "700", lineHeight: 21 },
  revealVotes:    { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  revealVoteBadge:{ flexDirection: "row", alignItems: "center", gap: 4 },
  revealVoteEmoji:{ fontSize: 16 },
  revealVoteCount:{ fontSize: 15, fontWeight: "900" },

  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  scoreRank: { fontSize: 22, minWidth: 36 },
  scoreName: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "700" },
  scorePts:  { color: "#f97316", fontSize: 16, fontWeight: "900" },
});
