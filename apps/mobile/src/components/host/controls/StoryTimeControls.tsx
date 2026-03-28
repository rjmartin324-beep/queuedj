import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function StoryTimeControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const members = state.members;

  const story: string[] = expState?.story ?? [];
  const currentTurn: string | null = expState?.currentTurn ?? null;
  const wordCount: number = expState?.wordCount ?? 0;
  const totalRounds: number = expState?.totalRounds ?? 20;

  function memberName(guestId: string) {
    return members.find((m) => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>STORY TIME — {phase.toUpperCase()}</Text>

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

      {phase === "playing" && (
        <View style={s.card}>
          <View style={s.roundRow}>
            <Text style={s.roundLabel}>WORD {wordCount} / {totalRounds}</Text>
            {currentTurn && (
              <Text style={s.voteCount}>Turn: {memberName(currentTurn)}</Text>
            )}
          </View>
          {story.length > 0 && (
            <View style={s.storyBox}>
              <Text style={s.sectionTitle}>STORY SO FAR</Text>
              <Text style={s.storyText}>{story.join(" ")}</Text>
            </View>
          )}
          <TouchableOpacity style={s.btn} onPress={() => sendAction("timeout")}>
            <LinearGradient colors={["#f59e0b", "#d97706"]} style={s.btnInner}>
              <Text style={s.btnText}>⏩ TIMEOUT (SKIP)</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {phase === "finished" && (
        <View style={s.card}>
          <Text style={s.finishedTitle}>GAME OVER</Text>
          {story.length > 0 && (
            <View style={s.storyBox}>
              <Text style={s.sectionTitle}>THE FULL STORY</Text>
              <Text style={s.storyText}>{story.join(" ")}</Text>
            </View>
          )}
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
  storyBox: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12, gap: 6 },
  sectionTitle: { color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  storyText: { color: "#e5e7eb", fontSize: 14, lineHeight: 22 },
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
