import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function ThumbWarView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase     = d?.phase ?? "waiting";
  const challenge = d?.currentChallenge ?? null;
  const ready     = d?.ready ?? {};
  const scores    = d?.scores ?? {};
  const round     = d?.round ?? 1;
  const total     = d?.totalRounds ?? 5;
  // Server field is `winner`, not `roundWinner`
  const winner = d?.winner ?? null;

  const myId = state.guestId ?? "";
  const isReady = ready[myId];
  // Server stores playerA / playerB — derive opponent from guest's own ID
  const opponent: string | null =
    myId === d?.playerA ? (d?.playerB ?? null)
    : myId === d?.playerB ? (d?.playerA ?? null)
    : null;

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>👍</Text><Text style={s.title}>Thumb War</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d1020"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
        {scores[myId] !== undefined && (
          <Text style={s.score}>Your score: {scores[myId]}</Text>
        )}
      </View>

      {opponent && (
        <View style={s.vsCard}>
          <Text style={s.vsLabel}>VS</Text>
          <Text style={s.vsName}>{memberName(opponent)}</Text>
        </View>
      )}

      {phase === "challenge" && challenge && (
        <View style={s.challengeCard}>
          <Text style={s.challengeEmoji}>{challenge.emoji ?? "👍"}</Text>
          <Text style={s.challengeText}>{challenge.description ?? challenge.text}</Text>
          {challenge.hint && <Text style={s.hint}>💡 {challenge.hint}</Text>}
        </View>
      )}

      {phase === "duel" && (
        <View style={s.duelArea}>
          {winner ? (
            <View style={s.resultCard}>
              <Text style={s.resultEmoji}>{winner === myId ? "🏆" : "💔"}</Text>
              <Text style={s.resultText}>{winner === myId ? "You win this round!" : `${memberName(winner)} wins!`}</Text>
            </View>
          ) : (
            <>
              <Text style={s.duelLabel}>Both players ready up to duel!</Text>
              {!isReady ? (
                <TouchableOpacity style={s.readyBtn} onPress={() => sendAction("ready", {})} activeOpacity={0.8}>
                  <LinearGradient colors={["#7c3aed","#6d28d9"]} style={s.readyInner}>
                    <Text style={s.readyEmoji}>👍</Text>
                    <Text style={s.readyText}>I'm Ready!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={s.waitingCard}>
                  <Text style={s.waitingText}>✓ Ready! Waiting for opponent...</Text>
                  <Text style={s.readyCount}>{Object.keys(ready).length} / 2 ready</Text>
                </View>
              )}
            </>
          )}
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  score:  { color: "#a78bfa", fontSize: 13, fontWeight: "700" },
  vsCard: { marginHorizontal: 16, backgroundColor: "rgba(124,58,237,0.15)", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(167,139,250,0.3)", marginBottom: 8 },
  vsLabel:{ color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  vsName: { color: "#a78bfa", fontSize: 20, fontWeight: "900" },
  challengeCard: { margin: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 24, padding: 28, alignItems: "center", gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  challengeEmoji: { fontSize: 56 },
  challengeText:  { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center", lineHeight: 26 },
  hint:   { color: "#fde68a", fontSize: 13, fontStyle: "italic" },
  duelArea: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center", gap: 16 },
  duelLabel:{ color: "#9ca3af", fontSize: 15, textAlign: "center" },
  readyBtn: { borderRadius: 24, overflow: "hidden", width: "100%" },
  readyInner: { padding: 32, alignItems: "center", gap: 10 },
  readyEmoji: { fontSize: 56 },
  readyText:  { color: "#fff", fontSize: 22, fontWeight: "900" },
  waitingCard: { backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 16, padding: 20, alignItems: "center", gap: 8, width: "100%", borderWidth: 1, borderColor: "rgba(74,222,128,0.3)" },
  waitingText: { color: "#4ade80", fontSize: 16, fontWeight: "800" },
  readyCount:  { color: "#6b7280", fontSize: 13 },
  resultCard:  { alignItems: "center", gap: 12 },
  resultEmoji: { fontSize: 72 },
  resultText:  { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" },
});
