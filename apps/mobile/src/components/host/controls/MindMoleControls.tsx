import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const ACCENT = "#10b981";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function MindMoleControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const round = expState?.round ?? 1;
  const currentClue: string = expState?.currentClue ?? "";
  const members = state.members.filter(m => !m.isWorkerNode);

  function memberName(guestId: string) {
    return members.find(m => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number),
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>MIND MOLE — {phase.toUpperCase()} · ROUND {round}</Text>

      {/* waiting: start the first clue round */}
      {phase === "waiting" && (
        <TouchableOpacity style={s.btn} onPress={() => sendAction("start_clue_round")}>
          <LinearGradient colors={["#10b981", "#059669"]} style={s.btnInner}>
            <Text style={s.btnText}>▶ START CLUE ROUND</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* cluing: 30s auto-timeout exists on server, but host can open voting early */}
      {phase === "cluing" && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Clue phase — 30s auto-timeout</Text>
          {currentClue ? (
            <View style={s.clueBox}>
              <Text style={s.clueLabel}>CURRENT CLUE</Text>
              <Text style={s.clueText}>"{currentClue}"</Text>
            </View>
          ) : (
            <Text style={s.cardSub}>Waiting for clue givers…</Text>
          )}
          <TouchableOpacity style={s.btn} onPress={() => sendAction("open_voting")}>
            <LinearGradient colors={["#f59e0b", "#d97706"]} style={s.btnInner}>
              <Text style={s.btnText}>OPEN VOTING EARLY</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* voting: guesses coming in, host reveals */}
      {phase === "voting" && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Voting in progress</Text>
          <Text style={s.cardSub}>Players are submitting guesses. Reveal when ready.</Text>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("reveal")}>
            <LinearGradient colors={["#8b5cf6", "#7c3aed"]} style={s.btnInner}>
              <Text style={s.btnText}>🔍 REVEAL ANSWERS</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* revealed: show scores, start next round */}
      {phase === "revealed" && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Round {round} complete</Text>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("start_clue_round")}>
            <LinearGradient colors={["#10b981", "#059669"]} style={s.btnInner}>
              <Text style={s.btnText}>▶ NEXT ROUND</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Scores */}
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
  cardTitle: { color: "#e5e7eb", fontSize: 15, fontWeight: "700" },
  cardSub: { color: "#6b7280", fontSize: 13, lineHeight: 18 },
  clueBox: { backgroundColor: "#051a0f", borderRadius: 8, padding: 12, alignItems: "center", gap: 4 },
  clueLabel: { color: "#10b981", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  clueText: { color: "#6ee7b7", fontSize: 16, fontStyle: "italic", textAlign: "center" },
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
