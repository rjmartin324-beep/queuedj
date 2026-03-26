import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function NeverHaveIEverControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const members = state.members;

  const currentRound: number = expState?.currentRound ?? 1;
  const totalRounds: number = expState?.totalRounds ?? 10;
  const prompt: string = expState?.currentPrompt ?? "";
  const responses: Record<string, "have" | "never"> = expState?.responses ?? {};
  const responseCount = Object.keys(responses).length;
  const haveCount = Object.values(responses).filter((r) => r === "have").length;
  const neverCount = Object.values(responses).filter((r) => r === "never").length;

  function memberName(guestId: string) {
    return members.find((m) => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>NEVER HAVE I EVER — {phase.toUpperCase()}</Text>

      {/* Waiting */}
      {phase === "waiting" && (
        <TouchableOpacity
          style={s.btn}
          onPress={() =>
            sendAction("start", { guestIds: members.map((m) => m.guestId) })
          }
        >
          <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.btnInner}>
            <Text style={s.btnText}>▶ START GAME</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Question phase */}
      {phase === "question" && (
        <View style={s.card}>
          <View style={s.roundRow}>
            <Text style={s.roundLabel}>
              ROUND {currentRound} / {totalRounds}
            </Text>
            <Text style={s.responseCount}>
              {responseCount} / {members.length} responded
            </Text>
          </View>
          {prompt ? (
            <View style={s.promptBox}>
              <Text style={s.promptPrefix}>Never have I ever...</Text>
              <Text style={s.promptText}>{prompt}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={s.btn} onPress={() => sendAction("reveal")}>
            <LinearGradient colors={["#f59e0b", "#d97706"]} style={s.btnInner}>
              <Text style={s.btnText}>REVEAL RESPONSES</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Reveal phase */}
      {phase === "reveal" && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>RESPONSE BREAKDOWN</Text>
          <View style={s.breakdownRow}>
            <View style={s.breakdownItem}>
              <Text style={[s.breakdownCount, { color: "#f87171" }]}>{haveCount}</Text>
              <Text style={s.breakdownLabel}>HAVE DONE IT</Text>
            </View>
            <View style={s.breakdownDivider} />
            <View style={s.breakdownItem}>
              <Text style={[s.breakdownCount, { color: "#34d399" }]}>{neverCount}</Text>
              <Text style={s.breakdownLabel}>NEVER DONE IT</Text>
            </View>
          </View>
          {/* Bar visual */}
          {responseCount > 0 && (
            <View style={s.barTrack}>
              <View style={[s.barHave, { flex: haveCount || 0.01 }]} />
              <View style={[s.barNever, { flex: neverCount || 0.01 }]} />
            </View>
          )}
          {/* Who responded what */}
          {Object.entries(responses).length > 0 && (
            <View style={s.responseList}>
              {Object.entries(responses).map(([gId, answer]) => (
                <View key={gId} style={s.responseListRow}>
                  <Text style={s.responseListName}>{memberName(gId)}</Text>
                  <View
                    style={[
                      s.responseBadge,
                      answer === "have" ? s.responseBadgeHave : s.responseBadgeNever,
                    ]}
                  >
                    <Text style={s.responseBadgeText}>
                      {answer === "have" ? "HAVE" : "NEVER"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={s.btn} onPress={() => sendAction("next")}>
            <LinearGradient colors={["#10b981", "#059669"]} style={s.btnInner}>
              <Text style={s.btnText}>NEXT ROUND ▶</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Finished */}
      {phase === "finished" && (
        <View style={s.card}>
          <Text style={s.finishedTitle}>GAME OVER</Text>
          <Text style={s.finishedSub}>Final standings below</Text>
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
  roundRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roundLabel: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },
  responseCount: { color: "#6b7280", fontSize: 12 },
  promptBox: { backgroundColor: "#0d0d0d", borderRadius: 10, padding: 12, gap: 4, borderLeftWidth: 3, borderLeftColor: "#7209b7" },
  promptPrefix: { color: "#6b7280", fontSize: 11, fontWeight: "600", fontStyle: "italic" },
  promptText: { color: "#e5e7eb", fontSize: 16, fontWeight: "700", lineHeight: 24 },
  sectionTitle: { color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  breakdownRow: { flexDirection: "row", alignItems: "center" },
  breakdownItem: { flex: 1, alignItems: "center", gap: 4 },
  breakdownCount: { fontSize: 36, fontWeight: "900" },
  breakdownLabel: { color: "#6b7280", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  breakdownDivider: { width: 1, height: 50, backgroundColor: "#222" },
  barTrack: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden" },
  barHave: { backgroundColor: "#ef4444" },
  barNever: { backgroundColor: "#10b981" },
  responseList: { gap: 6 },
  responseListRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  responseListName: { color: "#9ca3af", fontSize: 13 },
  responseBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  responseBadgeHave: { backgroundColor: "#7f1d1d" },
  responseBadgeNever: { backgroundColor: "#064e3b" },
  responseBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
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
