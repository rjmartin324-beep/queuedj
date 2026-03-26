import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const ACCENT = "#6366f1";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function MindReadingControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const members = state.members;

  const sequence: number[] = expState?.currentPuzzle?.sequence ?? [];
  const answerCount: number = Object.keys(expState?.answers ?? {}).length;
  const puzzleRule: string = expState?.currentPuzzle?.rule ?? "—";

  function memberName(guestId: string) {
    return members.find((m) => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>MIND READING — {phase.toUpperCase()}</Text>

      {/* Waiting */}
      {phase === "waiting" && (
        <TouchableOpacity
          style={s.btn}
          onPress={() => sendAction("start", { guestIds: members.map((m) => m.guestId) })}
        >
          <LinearGradient colors={["#6366f1", "#4338ca"]} style={s.btnInner}>
            <Text style={s.btnText}>▶ START GAME</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Question phase */}
      {phase === "question" && (
        <View style={s.card}>
          <Text style={s.roundLabel}>SEQUENCE</Text>
          <Text style={s.questionText}>{sequence.join(", ") || "—"}</Text>
          <Text style={s.subText}>
            {answerCount} / {members.length} answers submitted
          </Text>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("reveal")}>
            <LinearGradient colors={["#6366f1", "#4338ca"]} style={s.btnInner}>
              <Text style={s.btnText}>REVEAL ANSWER</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Reveal phase */}
      {phase === "reveal" && (
        <View style={s.card}>
          <Text style={s.roundLabel}>THE RULE</Text>
          <Text style={s.questionText}>{puzzleRule}</Text>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("next")}>
            <LinearGradient colors={["#6366f1", "#4338ca"]} style={s.btnInner}>
              <Text style={s.btnText}>NEXT ROUND ▶</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Finished */}
      {phase === "finished" && (
        <View style={s.card}>
          <Text style={s.finishedTitle}>GAME OVER</Text>
          <Text style={s.subText} style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>
            Final standings below
          </Text>
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

      {/* End game */}
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
  roundLabel: { color: ACCENT, fontSize: 12, fontWeight: "700" },
  questionText: { color: "#e5e7eb", fontSize: 15, fontWeight: "600", lineHeight: 22 },
  subText: { color: "#6b7280", fontSize: 13 },
  finishedTitle: { color: "#f9fafb", fontSize: 22, fontWeight: "900", textAlign: "center" },
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
