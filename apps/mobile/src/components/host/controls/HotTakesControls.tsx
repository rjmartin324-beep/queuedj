import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function HotTakesControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase: string = expState?.phase ?? "waiting";
  const scores: Record<string, number> = expState?.scores ?? {};
  const takes: any[] = expState?.takes ?? [];
  const submittedIds: string[] = expState?.submittedIds ?? [];
  const topic: string | null = expState?.currentTopic ?? null;
  const round: number = expState?.round ?? 0;
  const members = state.members.filter(m => !m.isWorkerNode && m.role !== "HOST" && m.role !== "CO_HOST");

  const [topicInput, setTopicInput] = useState("");

  function memberName(guestId: string) {
    return state.members.find(m => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(([, a], [, b]) => (b as number) - (a as number));

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>HOT TAKES — {phase.toUpperCase()}{round > 0 ? ` — ROUND ${round}` : ""}</Text>

      {/* ── waiting: enter topic + start ───────────────────────────────────── */}
      {(phase === "waiting" || phase === "topic") && (
        <View style={s.card}>
          <Text style={s.cardTitle}>SET TOPIC</Text>
          <TextInput
            style={s.topicInput}
            placeholder='e.g. "The best decade for music"'
            placeholderTextColor="#555"
            value={topicInput}
            onChangeText={setTopicInput}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={s.btn}
            onPress={() => {
              const t = topicInput.trim();
              if (!t) return;
              sendAction("start", { topic: t });
              setTopicInput("");
            }}
            disabled={!topicInput.trim()}
          >
            <LinearGradient colors={["#f97316", "#ea580c"]} style={s.btnInner}>
              <Text style={s.btnText}>▶ START ROUND</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* ── submitting: show who's submitted + open voting ─────────────────── */}
      {phase === "submitting" && (
        <View style={s.card}>
          {topic && <Text style={s.topicDisplay}>{topic}</Text>}
          <View style={s.statRow}>
            <Text style={s.statLabel}>TAKES IN</Text>
            <Text style={s.statValue}>{submittedIds.length} / {members.length}</Text>
          </View>
          <View style={s.submittedNames}>
            {submittedIds.map(id => (
              <View key={id} style={s.namePill}>
                <Text style={s.namePillText}>{memberName(id)}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("open_voting")} disabled={takes.length === 0}>
            <LinearGradient colors={["#7c3aed", "#6d28d9"]} style={s.btnInner}>
              <Text style={s.btnText}>OPEN VOTING</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* ── voting: takes list ─────────────────────────────────────────────── */}
      {phase === "voting" && (
        <View style={s.card}>
          {topic && <Text style={s.topicDisplay}>{topic}</Text>}
          <Text style={s.cardTitle}>TAKES ({takes.length})</Text>
          {takes.map((t: any) => (
            <View key={t.id} style={s.takeRow}>
              <Text style={s.takeName}>{memberName(t.guestId)}</Text>
              <Text style={s.takeText} numberOfLines={2}>{t.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── reveal ─────────────────────────────────────────────────────────── */}
      {phase === "reveal" && (
        <View style={s.card}>
          {topic && <Text style={s.topicDisplay}>{topic}</Text>}
          <Text style={s.cardTitle}>RESULTS</Text>
          {takes.map((t: any, i: number) => (
            <View key={t.id} style={s.revealRow}>
              <Text style={s.revealRank}>#{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.takeName}>{memberName(t.guestId)}</Text>
                <Text style={s.takeText} numberOfLines={2}>{t.text}</Text>
                <Text style={s.votesSummary}>
                  👍{t.votes.agree} 👎{t.votes.disagree} 🌶️{t.votes.spicy} 😐{t.votes.boring}
                </Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={s.btn} onPress={() => sendAction("next_round")}>
            <LinearGradient colors={["#10b981", "#059669"]} style={s.btnInner}>
              <Text style={s.btnText}>NEXT ROUND ▶</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* ── finished ───────────────────────────────────────────────────────── */}
      {phase === "finished" && (
        <View style={s.card}>
          <Text style={s.finishedTitle}>GAME OVER</Text>
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
  content:   { padding: 16, gap: 10 },
  phaseLabel:{ color: "#666", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  card:      { backgroundColor: "#111", borderRadius: 12, padding: 14, gap: 10 },
  cardTitle: { color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  topicDisplay: { color: "#e5e7eb", fontSize: 16, fontWeight: "800", lineHeight: 22 },

  topicInput: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    padding: 12, color: "#fff", fontSize: 14,
  },

  statRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel:{ color: "#6b7280", fontSize: 11, fontWeight: "700" },
  statValue:{ color: "#f97316", fontSize: 18, fontWeight: "900" },

  submittedNames: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  namePill: { backgroundColor: "rgba(74,222,128,0.1)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(74,222,128,0.3)", paddingHorizontal: 10, paddingVertical: 4 },
  namePillText: { color: "#4ade80", fontSize: 12, fontWeight: "700" },

  takeRow:   { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 10, gap: 3 },
  revealRow: { flexDirection: "row", gap: 10, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 10 },
  revealRank:{ color: "#6b7280", fontSize: 16, fontWeight: "900", width: 28 },
  takeName:  { color: "#9ca3af", fontSize: 11, fontWeight: "700" },
  takeText:  { color: "#e5e7eb", fontSize: 13, lineHeight: 18 },
  votesSummary: { color: "#6b7280", fontSize: 11, marginTop: 3 },

  btn:     { borderRadius: 12, overflow: "hidden" },
  btnInner:{ padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  finishedTitle: { color: "#f9fafb", fontSize: 22, fontWeight: "900", textAlign: "center" },

  scores:     { backgroundColor: "#111", borderRadius: 12, padding: 12 },
  scoresTitle:{ color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
  scoreRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 4, gap: 8 },
  scoreRank:  { color: "#4b5563", fontSize: 12, fontWeight: "700", width: 24 },
  scoreName:  { flex: 1, color: "#ccc", fontSize: 14 },
  scorePts:   { color: "#a78bfa", fontSize: 14, fontWeight: "700" },

  endBtn:    { padding: 12, alignItems: "center" },
  endBtnText:{ color: "#555", fontSize: 13 },
});
