import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function RoastmasterView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;

  const phase: string                  = d?.phase ?? "waiting";
  const targetId: string               = d?.targetGuestId ?? "";
  const submitted: string[]            = d?.submittedGuestIds ?? Object.keys(d?.roasts ?? {});
  const voted: string[]                = d?.votedGuestIds ?? Object.keys(d?.votes ?? {});
  const anonymized: Array<{ id: string; text: string }> = d?.anonymizedRoasts ?? [];
  const roasts: Record<string, string> = d?.roasts ?? {};
  const roundResults                   = d?.roundResults;
  const scores: Record<string, number> = d?.scores ?? {};
  const round: number                  = d?.roundNumber ?? 0;

  const myId = state.guestId ?? "";
  const amTarget = myId === targetId;
  const hasSubmitted = submitted.includes(myId);
  const hasVoted     = voted.includes(myId);

  const [roastText, setRoastText] = useState("");
  const [submitted_, setSubmitted_] = useState(false);

  const memberName = useCallback((id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6),
  [state.members]);

  const handleSubmitRoast = () => {
    const t = roastText.trim();
    if (!t) return;
    sendAction("submit_roast", { text: t });
    setSubmitted_(true);
  };

  const handleVote = (id: string) => {
    sendAction("cast_vote", { authorGuestId: id });
  };

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);

  if (phase === "waiting") {
    return (
      <View style={s.center}>
        <LinearGradient colors={["#0a0820", "#120820"]} style={StyleSheet.absoluteFill} />
        <Text style={s.emoji}>🔥</Text>
        <Text style={s.title}>Roastmaster</Text>
        <Text style={s.sub}>Waiting for host to pick a target...</Text>
        {sorted.length > 0 && (
          <View style={s.scoreSnippet}>
            {sorted.slice(0, 3).map(([id, pts]) => (
              <Text key={id} style={s.snippetRow}>
                {memberName(id)} — {pts} pts
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  }

  if (phase === "finished") {
    return (
      <ScrollView style={s.root} contentContainerStyle={s.finishContent}>
        <LinearGradient colors={["#0a0820", "#120820"]} style={StyleSheet.absoluteFill} />
        <Text style={s.finishEmoji}>🏆</Text>
        <Text style={s.finishTitle}>Roast Complete!</Text>
        {sorted.map(([id, pts], i) => (
          <View key={id} style={s.scoreRow}>
            <Text style={s.scoreRank}>#{i + 1}</Text>
            <Text style={[s.scoreName, id === myId && s.me]}>{memberName(id)}</Text>
            <Text style={s.scorePts}>{pts} vote{pts !== 1 ? "s" : ""}</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={["#0a0820", "#120820"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.roundLabel}>ROUND {round}</Text>
        <View style={s.targetPill}>
          <Text style={s.targetPre}>Target: </Text>
          <Text style={s.targetName}>{memberName(targetId)}</Text>
          {amTarget && <Text style={s.youLabel}> (you!)</Text>}
        </View>
      </View>

      {/* Roasting phase */}
      {phase === "roasting" && (
        <View style={s.body}>
          {amTarget ? (
            <View style={s.targetCard}>
              <Text style={s.targetCardEmoji}>🎯</Text>
              <Text style={s.targetCardTitle}>You're the target!</Text>
              <Text style={s.targetCardSub}>Sit back and see what they come up with...</Text>
              <Text style={s.submittedCount}>{submitted.length} roast{submitted.length !== 1 ? "s" : ""} submitted</Text>
            </View>
          ) : submitted_ || hasSubmitted ? (
            <View style={s.doneCard}>
              <Text style={s.doneEmoji}>✅</Text>
              <Text style={s.doneText}>Roast submitted!</Text>
              <Text style={s.doneSub}>{submitted.length} of {state.members.length - 1} submitted</Text>
            </View>
          ) : (
            <View style={s.inputArea}>
              <Text style={s.prompt}>Roast {memberName(targetId)} in 280 chars or less:</Text>
              <TextInput
                style={s.textInput}
                value={roastText}
                onChangeText={setRoastText}
                placeholder="Keep it fun, keep it creative..."
                placeholderTextColor="#4b5563"
                multiline
                maxLength={280}
                returnKeyType="done"
              />
              <View style={s.inputFooter}>
                <Text style={s.charCount}>{roastText.length}/280</Text>
                <TouchableOpacity
                  style={[s.submitBtn, !roastText.trim() && s.submitBtnDisabled]}
                  onPress={handleSubmitRoast}
                  disabled={!roastText.trim()}
                >
                  <Text style={s.submitBtnText}>Submit Roast</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Voting phase */}
      {phase === "voting" && (
        <ScrollView style={s.voteList} contentContainerStyle={s.voteListContent}>
          <Text style={s.votePrompt}>Vote for the funniest roast:</Text>
          {hasVoted ? (
            <View style={s.doneCard}>
              <Text style={s.doneEmoji}>✅</Text>
              <Text style={s.doneText}>Vote cast!</Text>
              <Text style={s.doneText}>{voted.length}/{state.members.length} voted</Text>
            </View>
          ) : (
            anonymized.map((item) => (
              item.id === myId ? null : (
                <TouchableOpacity
                  key={item.id}
                  style={s.roastCard}
                  onPress={() => handleVote(item.id)}
                >
                  <Text style={s.roastText}>{item.text}</Text>
                  <Text style={s.voteHint}>Tap to vote</Text>
                </TouchableOpacity>
              )
            ))
          )}
        </ScrollView>
      )}

      {/* Reveal phase */}
      {phase === "reveal" && roundResults && (
        <ScrollView style={s.voteList} contentContainerStyle={s.voteListContent}>
          <Text style={s.revealTitle}>The Roasts</Text>
          {Object.entries(roundResults.roasts as Record<string, string>).map(([id, text]) => {
            const voteCount = Object.values(roundResults.votes as Record<string, string>).filter(v => v === id).length;
            const isWinner = id === roundResults.winner;
            return (
              <View key={id} style={[s.revealCard, isWinner && s.winnerCard]}>
                {isWinner && <Text style={s.winnerBadge}>👑 Winner</Text>}
                <Text style={s.revealText}>{text}</Text>
                <View style={s.revealFooter}>
                  <Text style={s.revealAuthor}>— {memberName(id)}</Text>
                  <Text style={s.revealVotes}>{voteCount} vote{voteCount !== 1 ? "s" : ""}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: "#08081a" },
  center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emoji:      { fontSize: 64 },
  title:      { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:        { color: "#6b7280", fontSize: 15, textAlign: "center" },
  scoreSnippet: { marginTop: 16, gap: 4 },
  snippetRow: { color: "#6b7280", fontSize: 13, textAlign: "center" },

  header:     { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 8 },
  roundLabel: { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  targetPill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", alignSelf: "flex-start" },
  targetPre:  { color: "#9ca3af", fontSize: 14, fontWeight: "600" },
  targetName: { color: "#fca5a5", fontSize: 15, fontWeight: "900" },
  youLabel:   { color: "#ef4444", fontSize: 14, fontWeight: "700" },

  body:           { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  targetCard:     { backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 20, padding: 24, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  targetCardEmoji:{ fontSize: 48 },
  targetCardTitle:{ color: "#fca5a5", fontSize: 22, fontWeight: "900" },
  targetCardSub:  { color: "#6b7280", fontSize: 14, textAlign: "center" },
  submittedCount: { color: "#a78bfa", fontSize: 14, fontWeight: "700", marginTop: 4 },

  doneCard: { backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 20, padding: 24, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(34,197,94,0.2)" },
  doneEmoji:{ fontSize: 36 },
  doneText: { color: "#4ade80", fontSize: 18, fontWeight: "900" },
  doneSub:  { color: "#6b7280", fontSize: 13 },

  inputArea:  { gap: 12 },
  prompt:     { color: "#e5e7eb", fontSize: 16, fontWeight: "700" },
  textInput:  { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, color: "#fff", fontSize: 16, minHeight: 120, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", textAlignVertical: "top" },
  inputFooter:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  charCount:  { color: "#4b5563", fontSize: 12 },
  submitBtn:  { backgroundColor: "#ef4444", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  voteList:        { flex: 1 },
  voteListContent: { padding: 20, gap: 12 },
  votePrompt:      { color: "#9ca3af", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  roastCard:       { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  roastText:       { color: "#e5e7eb", fontSize: 16, lineHeight: 22 },
  voteHint:        { color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  revealTitle: { color: "#fff", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  revealCard:  { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  winnerCard:  { backgroundColor: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.3)" },
  winnerBadge: { color: "#fbbf24", fontSize: 13, fontWeight: "800" },
  revealText:  { color: "#e5e7eb", fontSize: 16, lineHeight: 22 },
  revealFooter:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  revealAuthor:{ color: "#6b7280", fontSize: 13, fontWeight: "600" },
  revealVotes: { color: "#a78bfa", fontSize: 13, fontWeight: "800" },

  finishContent: { padding: 24, gap: 10 },
  finishEmoji:   { fontSize: 64, textAlign: "center" },
  finishTitle:   { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  scoreRow:      { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreRank:     { color: "#6b7280", fontSize: 13, width: 32 },
  scoreName:     { flex: 1, color: "#e5e7eb", fontSize: 15, fontWeight: "600" },
  scorePts:      { color: "#ef4444", fontSize: 15, fontWeight: "900" },
  me:            { color: "#a78bfa" },
});
