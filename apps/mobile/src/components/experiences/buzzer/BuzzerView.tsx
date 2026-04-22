import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function BuzzerView() {
  const { state, sendAction } = useRoom();
  const d      = state.guestViewData as any ?? state.experienceState as any;
  const phase  = d?.phase ?? "waiting";
  const order: Array<{ guestId: string; ts: number }> = d?.buzzOrder ?? [];
  const scores: Record<string, number> = d?.scores ?? {};
  const round  = d?.roundNumber ?? 0;
  const target = d?.winTarget ?? 5;

  const myId = state.guestId ?? "";
  const myPos = order.findIndex(b => b.guestId === myId);

  const memberName = useCallback((id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6),
  [state.members]);

  const handleBuzz = () => {
    sendAction("buzz", { ts: Date.now() });
  };

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);

  if (phase === "finished") {
    return (
      <View style={s.center}>
        <LinearGradient colors={["#0a0820", "#0d1020"]} style={StyleSheet.absoluteFill} />
        <Text style={s.finishEmoji}>🏆</Text>
        <Text style={s.finishTitle}>Game Over!</Text>
        <View style={s.scoreList}>
          {sorted.map(([id, pts], i) => (
            <View key={id} style={s.scoreRow}>
              <Text style={s.scoreRank}>#{i + 1}</Text>
              <Text style={[s.scoreName, id === myId && s.me]}>{memberName(id)}</Text>
              <Text style={s.scorePts}>{pts} pts</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820", "#0d1020"]} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Text style={s.roundLabel}>ROUND {round}</Text>
        <Text style={s.targetLabel}>First to {target} wins</Text>
        {scores[myId] !== undefined && (
          <Text style={s.myScore}>You: {scores[myId]} pt{scores[myId] !== 1 ? "s" : ""}</Text>
        )}
      </View>

      {/* Main buzzer button */}
      <View style={s.buttonArea}>
        {phase === "armed" ? (
          <TouchableOpacity
            style={s.buzzBtn}
            onPress={handleBuzz}
            activeOpacity={0.7}
          >
            <Text style={s.buzzText}>BUZZ!</Text>
          </TouchableOpacity>
        ) : phase === "waiting" ? (
          <View style={s.waitCircle}>
            <Text style={s.waitEmoji}>🎯</Text>
            <Text style={s.waitText}>Waiting for host...</Text>
          </View>
        ) : (
          <View style={[s.waitCircle, s.lockedCircle]}>
            <Text style={s.waitEmoji}>{myPos === 0 ? "⚡" : myPos > 0 ? `#${myPos + 1}` : "⏱️"}</Text>
            <Text style={s.waitText}>
              {myPos === 0 ? "You buzzed first!" : myPos > 0 ? `You were #${myPos + 1}` : "Too slow this round"}
            </Text>
          </View>
        )}
      </View>

      {/* Buzz order */}
      {phase === "locked" && order.length > 0 && (
        <View style={s.orderCard}>
          <Text style={s.orderTitle}>Buzz Order</Text>
          {order.slice(0, 5).map((b, i) => (
            <View key={b.guestId} style={s.orderRow}>
              <Text style={[s.orderRank, i === 0 && s.first]}>#{i + 1}</Text>
              <Text style={[s.orderName, b.guestId === myId && s.me]}>{memberName(b.guestId)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Scores */}
      {sorted.length > 0 && (
        <ScrollView style={s.scores} contentContainerStyle={s.scoresContent}>
          {sorted.map(([id, pts]) => (
            <View key={id} style={s.scoreRow}>
              <Text style={[s.scoreName, id === myId && s.me]}>{memberName(id)}</Text>
              <View style={s.ptBar}>
                <View style={[s.ptFill, { width: `${Math.min(100, (pts / target) * 100)}%` as any }]} />
              </View>
              <Text style={s.scorePts}>{pts}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#08081a" },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header:       { alignItems: "center", paddingTop: 24, paddingBottom: 8, gap: 4 },
  roundLabel:   { color: "#6b7280", fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  targetLabel:  { color: "#4b5563", fontSize: 12 },
  myScore:      { color: "#a78bfa", fontSize: 18, fontWeight: "900", marginTop: 4 },

  buttonArea:   { flex: 1, alignItems: "center", justifyContent: "center" },
  buzzBtn:      { width: 220, height: 220, borderRadius: 110, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center", shadowColor: "#ef4444", shadowRadius: 40, shadowOpacity: 0.6, elevation: 20 },
  buzzText:     { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: 2 },

  waitCircle:   { width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 2, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", gap: 12 },
  lockedCircle: { borderColor: "rgba(167,139,250,0.3)", backgroundColor: "rgba(124,58,237,0.08)" },
  waitEmoji:    { fontSize: 48 },
  waitText:     { color: "#9ca3af", fontSize: 14, fontWeight: "600", textAlign: "center" },

  orderCard:    { marginHorizontal: 24, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, gap: 8 },
  orderTitle:   { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  orderRow:     { flexDirection: "row", alignItems: "center", gap: 12 },
  orderRank:    { color: "#4b5563", fontSize: 13, fontWeight: "700", width: 28 },
  first:        { color: "#fbbf24" },
  orderName:    { color: "#e5e7eb", fontSize: 15, fontWeight: "600" },

  scores:       { maxHeight: 140, marginHorizontal: 24, marginBottom: 16 },
  scoresContent:{ gap: 8 },
  scoreRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreRank:    { color: "#6b7280", fontSize: 12, fontWeight: "700", width: 28 },
  scoreName:    { flex: 1, color: "#e5e7eb", fontSize: 14, fontWeight: "600" },
  scorePts:     { color: "#a78bfa", fontSize: 14, fontWeight: "900", width: 30, textAlign: "right" },
  me:           { color: "#a78bfa" },

  ptBar:        { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" },
  ptFill:       { height: "100%", backgroundColor: "#a78bfa", borderRadius: 2 },

  finishEmoji:  { fontSize: 64 },
  finishTitle:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  scoreList:    { gap: 10, marginTop: 16, width: "80%" },
});
