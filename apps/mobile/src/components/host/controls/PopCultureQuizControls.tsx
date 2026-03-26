import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

interface Props { viewMode: "player" | "host"; onViewModeChange: (m: "player" | "host") => void; }

export function PopCultureQuizControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const members = state.members;
  function guestIds() { return members.map(m => m.guestId); }
  function memberName(gId: string) { return members.find(m => m.guestId === gId)?.displayName ?? gId.slice(0, 6); }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <Text style={s.phase}>{phase.replace(/_/g, " ").toUpperCase()} · Round {expState?.round ?? 0}/{expState?.totalRounds ?? "?"}</Text>

      {/* START */}
      {phase === "waiting" && (
        <TouchableOpacity style={s.btn} onPress={() => sendAction("start", { guestIds: guestIds() })}>
          <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.btnI}><Text style={s.btnT}>▶ START GAME</Text></LinearGradient>
        </TouchableOpacity>
      )}

      {/* GAME-SPECIFIC CONTROLS */}
      {phase === "question" && (
        <View style={s.card}>
          {expState?.currentQ?.category && (
            <View style={s.badge}>
              <Text style={s.badgeT}>{expState.currentQ.category.toUpperCase()}</Text>
            </View>
          )}
          <Text style={s.questionText}>{expState?.currentQ?.text ?? "—"}</Text>
          <Text style={s.info}>
            Answers: {Object.keys(expState?.answers ?? {}).length}/{members.length}
          </Text>
          <TouchableOpacity style={s.smBtn} onPress={() => sendAction("reveal")}>
            <Text style={s.smBtnT}>👁 REVEAL</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === "reveal" && (
        <View style={s.card}>
          <Text style={s.label}>CORRECT OPTION</Text>
          <Text style={s.correctIdx}>
            Option {(expState?.currentQ?.correctIndex ?? 0) + 1}
          </Text>
          {expState?.currentQ?.options && (
            <Text style={s.correctAnswer}>
              {expState.currentQ.options[expState.currentQ.correctIndex ?? 0]}
            </Text>
          )}
          <TouchableOpacity style={s.smBtn} onPress={() => sendAction("next")}>
            <Text style={s.smBtnT}>NEXT →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SCORES */}
      {Object.keys(scores).length > 0 && (
        <View style={s.scores}>
          <Text style={s.scoresH}>SCORES</Text>
          {Object.entries(scores).sort(([, a], [, b]) => (b as number) - (a as number)).map(([gId, pts]) => (
            <View key={gId} style={s.row}>
              <Text style={s.name}>{memberName(gId)}</Text>
              <Text style={s.pts}>{pts as number} pts</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.end} onPress={() => sendAction("end")}>
        <Text style={s.endT}>End Game</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 }, content: { padding: 16, gap: 10 },
  phase: { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  btn: { borderRadius: 12, overflow: "hidden" },
  btnI: { padding: 14, alignItems: "center" }, btnT: { color: "#fff", fontSize: 15, fontWeight: "900" },
  smBtn: { backgroundColor: "#1a1a2e", borderRadius: 10, padding: 12, alignItems: "center" },
  smBtnT: { color: "#a78bfa", fontSize: 13, fontWeight: "700" },
  scores: { backgroundColor: "#111", borderRadius: 12, padding: 12 },
  scoresH: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  name: { color: "#ccc", fontSize: 13 }, pts: { color: "#a78bfa", fontSize: 13, fontWeight: "700" },
  end: { padding: 12, alignItems: "center" }, endT: { color: "#444", fontSize: 12 },
  info: { color: "#666", fontSize: 12, textAlign: "center" },
  card: { backgroundColor: "#111", borderRadius: 12, padding: 14, gap: 10 },
  badge: { backgroundColor: "#1a1a2e", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  badgeT: { color: "#a78bfa", fontSize: 10, fontWeight: "900" },
  questionText: { color: "#fff", fontSize: 15, lineHeight: 22 },
  label: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  correctIdx: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
  correctAnswer: { color: "#4ade80", fontSize: 16, fontWeight: "900" },
});
