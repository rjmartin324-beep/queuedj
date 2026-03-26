import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const ACCENT = "#ef4444";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function FightOrFlightControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const members = state.members;

  const currentScenario = expState?.currentScenario;
  const choiceCount: number = Object.keys(expState?.choices ?? {}).length;
  const choicesA: number = expState?.choicesA ?? 0;
  const choicesB: number = expState?.choicesB ?? 0;

  function memberName(guestId: string) {
    return members.find((m) => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>FIGHT OR FLIGHT — {phase.toUpperCase()}</Text>

      {/* Waiting */}
      {phase === "waiting" && (
        <TouchableOpacity
          style={s.btn}
          onPress={() => sendAction("start", { guestIds: members.map((m) => m.guestId) })}
        >
          <LinearGradient colors={["#ef4444", "#dc2626"]} style={s.btnInner}>
            <Text style={s.btnText}>▶ START GAME</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Question phase */}
      {phase === "question" && (
        <View style={s.card}>
          <Text style={s.roundLabel}>SCENARIO</Text>
          <Text style={s.questionText}>{currentScenario?.text ?? "—"}</Text>
          <View style={s.optionRow}>
            <View style={s.optionBadge}>
              <Text style={s.optionLabel}>A</Text>
              <Text style={s.optionText} numberOfLines={2}>{currentScenario?.a ?? "Option A"}</Text>
            </View>
            <Text style={s.vsText}>VS</Text>
            <View style={s.optionBadge}>
              <Text style={s.optionLabel}>B</Text>
              <Text style={s.optionText} numberOfLines={2}>{currentScenario?.b ?? "Option B"}</Text>
            </View>
          </View>
          <Text style={s.subText}>
            {choiceCount} / {members.length} choices received
          </Text>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("reveal")}>
            <LinearGradient colors={["#ef4444", "#dc2626"]} style={s.btnInner}>
              <Text style={s.btnText}>REVEAL VOTES</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Reveal phase */}
      {phase === "reveal" && (
        <View style={s.card}>
          <Text style={s.roundLabel}>VOTE SPLIT</Text>
          <View style={s.splitRow}>
            <View style={s.splitSide}>
              <Text style={s.splitLabel}>A</Text>
              <Text style={s.splitCount}>{choicesA}</Text>
            </View>
            <View style={s.splitDivider} />
            <View style={s.splitSide}>
              <Text style={s.splitLabel}>B</Text>
              <Text style={s.splitCount}>{choicesB}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("next")}>
            <LinearGradient colors={["#ef4444", "#dc2626"]} style={s.btnInner}>
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
  optionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionBadge: { flex: 1, backgroundColor: "#1a0000", borderRadius: 10, padding: 10, alignItems: "center", gap: 4 },
  optionLabel: { color: "#ef4444", fontSize: 16, fontWeight: "900" },
  optionText: { color: "#e2e8f0", fontSize: 12, textAlign: "center" },
  vsText: { color: "#4b5563", fontSize: 11, fontWeight: "900" },
  splitRow: { flexDirection: "row", alignItems: "center" },
  splitSide: { flex: 1, alignItems: "center", gap: 4 },
  splitLabel: { color: "#9ca3af", fontSize: 13, fontWeight: "700" },
  splitCount: { color: "#ef4444", fontSize: 36, fontWeight: "900" },
  splitDivider: { width: 1, backgroundColor: "#222", alignSelf: "stretch", marginHorizontal: 8 },
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
