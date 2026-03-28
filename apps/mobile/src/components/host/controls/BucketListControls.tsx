import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function BucketListControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const members = state.members;

  const submissions: Record<string, string> = expState?.submissions ?? {};
  const currentItem: { text: string; authorId: string } | null = expState?.currentItem ?? null;
  const guesses: Record<string, string> = expState?.guesses ?? {};
  const submissionCount = Object.keys(submissions).length;
  const guessCount = Object.keys(guesses).length;

  function memberName(guestId: string) {
    return members.find((m) => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>BUCKET LIST — {phase.toUpperCase()}</Text>

      {phase === "waiting" && (
        <TouchableOpacity
          style={s.btn}
          onPress={() => sendAction("start", { guestIds: members.map((m) => m.guestId) })}
        >
          <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.btnInner}>
            <Text style={s.btnText}>▶ START GAME</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {phase === "submitting" && (
        <View style={s.card}>
          <View style={s.roundRow}>
            <Text style={s.roundLabel}>SUBMISSIONS</Text>
            <Text style={s.voteCount}>{submissionCount} / {members.length} submitted</Text>
          </View>
          <Text style={s.questionText}>Waiting for players to submit their bucket list items…</Text>
        </View>
      )}

      {phase === "guessing" && (
        <View style={s.card}>
          <View style={s.roundRow}>
            <Text style={s.roundLabel}>GUESSING</Text>
            <Text style={s.voteCount}>{guessCount} guesses</Text>
          </View>
          {currentItem && (
            <View style={s.storyBox}>
              <Text style={s.sectionTitle}>CURRENT ITEM</Text>
              <Text style={s.questionText}>{currentItem.text}</Text>
            </View>
          )}
          <TouchableOpacity style={s.btn} onPress={() => sendAction("reveal")}>
            <LinearGradient colors={["#f59e0b", "#d97706"]} style={s.btnInner}>
              <Text style={s.btnText}>REVEAL AUTHOR</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {phase === "reveal" && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>REVEAL</Text>
          {currentItem && (
            <>
              <Text style={s.questionText}>{currentItem.text}</Text>
              <Text style={s.voteCount}>Written by: {memberName(currentItem.authorId)}</Text>
            </>
          )}
          <TouchableOpacity style={s.btn} onPress={() => sendAction("next_item")}>
            <LinearGradient colors={["#10b981", "#059669"]} style={s.btnInner}>
              <Text style={s.btnText}>NEXT ITEM ▶</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {phase === "finished" && (
        <View style={s.card}>
          <Text style={s.finishedTitle}>GAME OVER</Text>
          <Text style={s.finishedSub}>Final standings below</Text>
        </View>
      )}

      {sortedScores.length > 0 && (
        <View style={s.scores}>
          <Text style={s.scoresTitle}>SCORES</Text>
          {sortedScores.map(([gId, pts], i) => (
            <View key={gId} style={s.scoreRow}>
              <Text style={s.scoreRank}>#{i + 1}</Text>
              <Text style={s.scoreName}>{memberName(gId)}</Text>
              <Text style={s.scorePts}>{pts as number} pts</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.endBtn} onPress={() => sendAction("end")}>
        <Text style={s.endBtnText}>End Game</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },
  phaseLabel: { color: "#666", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  card: { backgroundColor: "#111", borderRadius: 12, padding: 14, gap: 10 },
  roundRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roundLabel: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },
  voteCount: { color: "#6b7280", fontSize: 12 },
  questionText: { color: "#e5e7eb", fontSize: 15, fontWeight: "600", lineHeight: 22 },
  storyBox: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12, gap: 6 },
  sectionTitle: { color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  splitRow: { flexDirection: "row", alignItems: "flex-start" },
  splitSide: { flex: 1, alignItems: "center", gap: 4 },
  splitCount: { fontSize: 32, fontWeight: "900" },
  splitPct: { color: "#6b7280", fontSize: 12 },
  splitDivider: { width: 1, backgroundColor: "#222", alignSelf: "stretch", marginHorizontal: 8 },
  finishedTitle: { color: "#f9fafb", fontSize: 22, fontWeight: "900", textAlign: "center" },
  finishedSub: { color: "#6b7280", fontSize: 13, textAlign: "center" },
  btn: { borderRadius: 12, overflow: "hidden" },
  btnInner: { padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  scores: { backgroundColor: "#111", borderRadius: 12, padding: 12 },
  scoresTitle: { color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, gap: 8 },
  scoreRank: { color: "#4b5563", fontSize: 12, fontWeight: "700", width: 24 },
  scoreName: { flex: 1, color: "#ccc", fontSize: 14 },
  scorePts: { color: "#a78bfa", fontSize: 14, fontWeight: "700" },
  endBtn: { padding: 12, alignItems: "center" },
  endBtnText: { color: "#555", fontSize: 13 },
});
