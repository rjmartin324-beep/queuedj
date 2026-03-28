import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const ACCENT = "#f59e0b";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function NightShiftControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const members = state.members.filter(m => !m.isWorkerNode);

  function memberName(guestId: string) {
    return members.find(m => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number),
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>NIGHT SHIFT — {phase.toUpperCase()}</Text>

      {/* waiting: assign roles to kick off */}
      {phase === "waiting" && (
        <TouchableOpacity
          style={s.btn}
          onPress={() => sendAction("assign_roles", { guestIds: members.map(m => m.guestId) })}
        >
          <LinearGradient colors={["#f59e0b", "#d97706"]} style={s.btnInner}>
            <Text style={s.btnText}>🎭 ASSIGN ROLES</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* role_reveal: roles assigned, host opens the scene */}
      {phase === "role_reveal" && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Roles revealed to players</Text>
          <Text style={s.cardSub}>Give players a moment to read their role, then open the scene.</Text>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("open_scene")}>
            <LinearGradient colors={["#f59e0b", "#d97706"]} style={s.btnInner}>
              <Text style={s.btnText}>▶ OPEN SCENE</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* scene: discussion happening, host opens accusations */}
      {phase === "scene" && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Scene in progress</Text>
          <Text style={s.cardSub}>Players are acting out the scenario. Open accusations when ready.</Text>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("open_accusations")}>
            <LinearGradient colors={["#ef4444", "#dc2626"]} style={s.btnInner}>
              <Text style={s.btnText}>⚠️ OPEN ACCUSATIONS</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* accuse: voting happening, host reveals verdict */}
      {phase === "accuse" && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Accusations in progress</Text>
          <Text style={s.cardSub}>Players are voting. Reveal the verdict when all votes are in.</Text>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("reveal_verdict")}>
            <LinearGradient colors={["#8b5cf6", "#7c3aed"]} style={s.btnInner}>
              <Text style={s.btnText}>🔍 REVEAL VERDICT</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* verdict: game over */}
      {phase === "verdict" && (
        <View style={s.card}>
          <Text style={s.finishedTitle}>VERDICT REVEALED</Text>
          <Text style={s.cardSub}>Round complete. End or replay.</Text>
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
