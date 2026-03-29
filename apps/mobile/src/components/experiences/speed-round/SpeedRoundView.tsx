import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function SpeedRoundView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase     = d?.phase ?? "waiting";
  const challenge = d?.currentChallenge ?? null;
  const completions = d?.completions ?? {};
  const skipped   = d?.skipped ?? {};
  const round     = d?.round ?? 1;
  const total     = d?.totalRounds ?? 10;
  const scores    = d?.scores ?? {};

  const isDone = completions[state.guestId ?? ""] || skipped[state.guestId ?? ""];

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>⚡</Text><Text style={s.title}>Speed Round</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a1020","#0a0820"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
      </View>

      {challenge && (
        <View style={s.card}>
          <Text style={s.typeLabel}>{challenge.type?.toUpperCase() ?? "CHALLENGE"}</Text>
          <Text style={s.challengeText}>{challenge.description ?? challenge.text}</Text>
          {challenge.hint && <Text style={s.hintText}>💡 {challenge.hint}</Text>}
        </View>
      )}

      {!isDone ? (
        <View style={s.actions}>
          <TouchableOpacity style={s.doneBtn} onPress={() => sendAction("complete", {})} activeOpacity={0.8}>
            <LinearGradient colors={["#16a34a","#15803d"]} style={s.btnInner}>
              <Text style={s.btnText}>✓ Done! (+pts)</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.skipBtn} onPress={() => sendAction("skip", {})} activeOpacity={0.7}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.locked}>
          <Text style={s.lockedText}>{completions[state.guestId ?? ""] ? "✓ Completed!" : "Skipped"}</Text>
        </View>
      )}

      <Text style={s.countText}>
        {Object.keys(completions).length} completed · {Object.keys(skipped).length} skipped
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15 },
  header: { padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  card:   { margin: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 24, padding: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", gap: 12, minHeight: 160, justifyContent: "center" },
  typeLabel:     { color: "#f97316", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  challengeText: { color: "#fff", fontSize: 22, fontWeight: "800", lineHeight: 30 },
  hintText:      { color: "#fde68a", fontSize: 13, fontStyle: "italic" },
  actions:  { padding: 16, gap: 10 },
  doneBtn:  { borderRadius: 16, overflow: "hidden" },
  btnInner: { padding: 18, alignItems: "center" },
  btnText:  { color: "#fff", fontSize: 18, fontWeight: "900" },
  skipBtn:  { padding: 14, alignItems: "center" },
  skipText: { color: "#6b7280", fontSize: 14 },
  locked:   { margin: 16, backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 14, padding: 16, alignItems: "center" },
  lockedText: { color: "#4ade80", fontSize: 16, fontWeight: "800" },
  countText: { color: "#4b5563", fontSize: 12, textAlign: "center", paddingBottom: 16 },
});
