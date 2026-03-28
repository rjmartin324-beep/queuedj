import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

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

  const round: number = expState?.round ?? 0;
  const totalRounds: number = expState?.totalRounds ?? 8;
  const currentScenario: { text: string; a: string; b: string } | null = expState?.currentScenario ?? null;
  const choices: Record<string, "a" | "b"> = expState?.choices ?? {};
  const choicesA = Object.values(choices).filter((c) => c === "a").length;
  const choicesB = Object.values(choices).filter((c) => c === "b").length;
  const totalChoices = choicesA + choicesB;

  function memberName(guestId: string) {
    return members.find((m) => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>FIGHT OR FLIGHT — {phase.toUpperCase()}</Text>

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

      {phase === "question" && (
        <View style={s.card}>
          <View style={s.roundRow}>
            <Text style={s.roundLabel}>ROUND {round} / {totalRounds}</Text>
            <Text style={s.voteCount}>{totalChoices} / {members.length} chose</Text>
          </View>
          {currentScenario && (
            <>
              <Text style={s.questionText}>{currentScenario.text}</Text>
              <View style={s.optionRow}>
                <View style={[s.optionBadge, { backgroundColor: "#dc2626" }]}>
                  <Text style={s.optionBadgeText}>A</Text>
                  <Text style={s.optionBadgeLabel} numberOfLines={2}>{currentScenario.a}</Text>
                </View>
                <Text style={s.optionVs}>VS</Text>
                <View style={[s.optionBadge, { backgroundColor: "#7e22ce" }]}>
                  <Text style={s.optionBadgeText}>B</Text>
                  <Text style={s.optionBadgeLabel} numberOfLines={2}>{currentScenario.b}</Text>
                </View>
              </View>
            </>
          )}
          <TouchableOpacity style={s.btn} onPress={() => sendAction("reveal")}>
            <LinearGradient colors={["#f59e0b", "#d97706"]} style={s.btnInner}>
              <Text style={s.btnText}>REVEAL CHOICES</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {phase === "reveal" && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>CHOICE SPLIT</Text>
          <View style={s.splitRow}>
            <View style={s.splitSide}>
              {currentScenario && <Text style={s.splitOption} numberOfLines={2}>{currentScenario.a}</Text>}
              <Text style={[s.splitCount, { color: "#ef4444" }]}>{choicesA}</Text>
              <Text style={s.splitPct}>
                {totalChoices > 0 ? Math.round((choicesA / totalChoices) * 100) : 0}%
              </Text>
            </View>
            <View style={s.splitDivider} />
            <View style={s.splitSide}>
              {currentScenario && <Text style={s.splitOption} numberOfLines={2}>{currentScenario.b}</Text>}
              <Text style={[s.splitCount, { color: "#c084fc" }]}>{choicesB}</Text>
              <Text style={s.splitPct}>
                {totalChoices > 0 ? Math.round((choicesB / totalChoices) * 100) : 0}%
              </Text>
            </View>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFillA, { flex: totalChoices > 0 ? choicesA : 1 }]} />
            <View style={[s.barFillB, { flex: totalChoices > 0 ? choicesB : 1 }]} />
          </View>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("next")}>
            <LinearGradient colors={["#10b981", "#059669"]} style={s.btnInner}>
              <Text style={s.btnText}>NEXT ROUND ▶</Text>
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
  optionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionBadge: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center", gap: 4 },
  optionBadgeText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  optionBadgeLabel: { color: "#e2e8f0", fontSize: 12, textAlign: "center" },
  optionVs: { color: "#4b5563", fontSize: 11, fontWeight: "900" },
  sectionTitle: { color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  splitRow: { flexDirection: "row", alignItems: "flex-start" },
  splitSide: { flex: 1, alignItems: "center", gap: 4 },
  splitOption: { color: "#9ca3af", fontSize: 12, textAlign: "center" },
  splitCount: { fontSize: 32, fontWeight: "900" },
  splitPct: { color: "#6b7280", fontSize: 12 },
  splitDivider: { width: 1, backgroundColor: "#222", alignSelf: "stretch", marginHorizontal: 8 },
  barTrack: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden" },
  barFillA: { backgroundColor: "#ef4444" },
  barFillB: { backgroundColor: "#a855f7" },
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
