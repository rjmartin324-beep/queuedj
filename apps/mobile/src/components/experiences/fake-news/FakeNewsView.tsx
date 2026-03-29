import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function FakeNewsView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase      = d?.phase ?? "waiting";
  const headline   = d?.currentHeadline ?? null;
  const myVote     = d?.votes?.[state.guestId ?? ""];
  const round      = d?.round ?? 1;
  const total      = d?.totalRounds ?? 10;
  const scores     = d?.scores ?? {};
  const streaks    = d?.streaks ?? {};
  const isReal: boolean | null = d?.currentHeadline?.isReal ?? null; // only shown on reveal

  const [picked, setPicked] = useState<"real"|"fake"|null>(null);

  function vote(choice: "real"|"fake") {
    if (picked || myVote) return;
    setPicked(choice);
    sendAction("vote", { choice });
  }

  if (phase === "waiting") return (
    <View style={s.center}>
      <Text style={s.emoji}>📰</Text>
      <Text style={s.title}>Fake News</Text>
      <Text style={s.sub}>Waiting for the host...</Text>
    </View>
  );

  if (phase === "finished") return (
    <View style={s.center}>
      <Text style={s.emoji}>🏆</Text>
      <Text style={s.title}>Game Over!</Text>
    </View>
  );

  const choice = picked ?? myVote ?? null;
  const showReveal = phase === "reveal";
  const correctIsReal = showReveal && isReal === true;
  const correctIsFake = showReveal && isReal === false;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0c0820","#0a1020"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
        {streaks[state.guestId ?? ""] > 1 && (
          <Text style={s.streak}>🔥 {streaks[state.guestId ?? ""]}x streak</Text>
        )}
      </View>

      <View style={s.card}>
        {headline?.source && <Text style={s.source}>{headline.source}</Text>}
        <Text style={s.headlineText}>{headline?.text ?? "Loading headline..."}</Text>
        {showReveal && (
          <View style={[s.verdictBadge, { backgroundColor: isReal ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)" }]}>
            <Text style={[s.verdictText, { color: isReal ? "#4ade80" : "#f87171" }]}>
              {isReal ? "✓ REAL" : "✗ FAKE"}
            </Text>
          </View>
        )}
      </View>

      {!showReveal ? (
        <View style={s.buttons}>
          <TouchableOpacity
            style={[s.btn, choice === "real" && s.btnSelected, { borderColor: "#22c55e" }]}
            onPress={() => vote("real")}
            disabled={!!choice}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={choice === "real" ? ["#16a34a","#15803d"] : ["rgba(22,163,74,0.15)","rgba(21,128,61,0.08)"]}
              style={s.btnInner}
            >
              <Text style={s.btnEmoji}>✅</Text>
              <Text style={s.btnLabel}>REAL</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, choice === "fake" && s.btnSelected, { borderColor: "#ef4444" }]}
            onPress={() => vote("fake")}
            disabled={!!choice}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={choice === "fake" ? ["#dc2626","#b91c1c"] : ["rgba(220,38,38,0.15)","rgba(185,28,28,0.08)"]}
              style={s.btnInner}
            >
              <Text style={s.btnEmoji}>❌</Text>
              <Text style={s.btnLabel}>FAKE</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.resultRow}>
          <View style={[s.resultCard, choice === (isReal ? "real" : "fake") ? s.resultCorrect : s.resultWrong]}>
            <Text style={s.resultText}>
              {choice === (isReal ? "real" : "fake") ? "✓ You got it!" : "✗ Wrong"}
            </Text>
          </View>
        </View>
      )}

      {choice && !showReveal && (
        <View style={s.locked}>
          <Text style={s.lockedText}>Locked in — waiting for reveal</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  streak: { color: "#fb923c", fontSize: 13, fontWeight: "700" },
  card:   { margin: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", gap: 12 },
  source: { color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  headlineText: { color: "#fff", fontSize: 19, fontWeight: "800", lineHeight: 28 },
  verdictBadge: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  verdictText:  { fontSize: 14, fontWeight: "900" },
  buttons: { flexDirection: "row", paddingHorizontal: 16, gap: 12 },
  btn:     { flex: 1, borderRadius: 18, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  btnSelected: { borderWidth: 2 },
  btnInner:{ paddingVertical: 28, alignItems: "center", gap: 8 },
  btnEmoji:{ fontSize: 36 },
  btnLabel:{ color: "#fff", fontSize: 18, fontWeight: "900" },
  resultRow: { padding: 16 },
  resultCard: { borderRadius: 14, padding: 16, alignItems: "center" },
  resultCorrect: { backgroundColor: "rgba(34,197,94,0.2)", borderWidth: 1, borderColor: "rgba(34,197,94,0.4)" },
  resultWrong:   { backgroundColor: "rgba(239,68,68,0.2)", borderWidth: 1, borderColor: "rgba(239,68,68,0.4)" },
  resultText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  locked: { marginHorizontal: 16, backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 14, padding: 12, alignItems: "center" },
  lockedText: { color: "#818cf8", fontSize: 13, fontWeight: "700" },
});
