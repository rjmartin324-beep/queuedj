import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function RankItView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase    = d?.phase ?? "waiting";
  const challenge = d?.currentChallenge ?? null;
  const round    = d?.round ?? 1;
  const total    = d?.totalRounds ?? 5;
  const scores   = d?.scores ?? {};
  const myRanking: Record<string, number[]> = d?.rankings ?? {};
  const hasSubmitted = !!myRanking[state.guestId ?? ""];

  const [order, setOrder] = useState<number[]>([]);

  function init(items: string[]) {
    if (order.length === 0 && items.length > 0) setOrder(items.map((_, i) => i));
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const n = [...order];
    [n[i - 1], n[i]] = [n[i], n[i - 1]];
    setOrder(n);
  }
  function moveDown(i: number) {
    if (i === order.length - 1) return;
    const n = [...order];
    [n[i], n[i + 1]] = [n[i + 1], n[i]];
    setOrder(n);
  }

  function submit() {
    if (hasSubmitted) return;
    sendAction("submit_ranking", { order });
  }

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Rank It</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );

  if (phase === "finished") {
    const sorted = Object.entries(scores as Record<string,number>).sort(([,a],[,b]) => b-a);
    return (
      <ScrollView style={s.root} contentContainerStyle={s.finishContent}>
        <Text style={s.finishTitle}>Game Over!</Text>
        {sorted.map(([id, pts], i) => (
          <View key={id} style={s.scoreRow}>
            <Text style={s.scoreRank}>#{i+1}</Text>
            <Text style={s.scoreName}>{memberName(id)}</Text>
            <Text style={s.scorePts}>{pts} pts</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  const items: string[] = challenge?.items ?? [];
  if (order.length !== items.length && items.length > 0) init(items);

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d0a20"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
        <Text style={s.prompt}>{challenge?.prompt ?? ""}</Text>
      </View>

      {phase === "question" && (
        <ScrollView style={s.list} contentContainerStyle={{ gap: 8, padding: 16 }}>
          <Text style={s.hint}>Drag to rank — #1 = highest</Text>
          {order.map((itemIdx, pos) => (
            <View key={itemIdx} style={s.item}>
              <Text style={s.itemPos}>#{pos + 1}</Text>
              <Text style={s.itemText}>{items[itemIdx]}</Text>
              <View style={s.arrows}>
                <TouchableOpacity onPress={() => moveUp(pos)} style={s.arrowBtn}>
                  <Text style={s.arrowTxt}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveDown(pos)} style={s.arrowBtn}>
                  <Text style={s.arrowTxt}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {!hasSubmitted ? (
            <TouchableOpacity style={s.submitBtn} onPress={submit} activeOpacity={0.8}>
              <LinearGradient colors={["#7c3aed","#6d28d9"]} style={s.submitInner}>
                <Text style={s.submitText}>Lock In Ranking</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={s.locked}><Text style={s.lockedText}>Locked in ✓</Text></View>
          )}
        </ScrollView>
      )}

      {phase === "reveal" && (
        <ScrollView style={s.list} contentContainerStyle={{ gap: 8, padding: 16 }}>
          <Text style={s.hint}>Correct order:</Text>
          {(challenge?.correctOrder ?? []).map((itemIdx: number, pos: number) => (
            <View key={itemIdx} style={[s.item, s.itemReveal]}>
              <Text style={s.itemPos}>#{pos + 1}</Text>
              <Text style={s.itemText}>{items[itemIdx]}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1 },
  center:{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emoji: { fontSize: 64 },
  title: { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:   { color: "#6b7280", fontSize: 15 },
  header:{ padding: 16, gap: 4 },
  round: { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  prompt:{ color: "#fff", fontSize: 18, fontWeight: "800", lineHeight: 26 },
  hint:  { color: "#6b7280", fontSize: 13, marginBottom: 4 },
  list:  { flex: 1 },
  item:  { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  itemReveal: { backgroundColor: "rgba(124,58,237,0.15)", borderColor: "rgba(167,139,250,0.3)" },
  itemPos:  { color: "#a78bfa", fontWeight: "900", fontSize: 16, width: 28 },
  itemText: { flex: 1, color: "#e5e7eb", fontSize: 15, fontWeight: "600" },
  arrows:   { flexDirection: "column", gap: 2 },
  arrowBtn: { padding: 4 },
  arrowTxt: { color: "#6b7280", fontSize: 12 },
  submitBtn:   { borderRadius: 14, overflow: "hidden", marginTop: 8 },
  submitInner: { padding: 16, alignItems: "center" },
  submitText:  { color: "#fff", fontSize: 16, fontWeight: "900" },
  locked:      { backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 14, padding: 14, alignItems: "center" },
  lockedText:  { color: "#4ade80", fontSize: 14, fontWeight: "700" },
  finishContent:{ padding: 24, gap: 10 },
  finishTitle:  { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 16 },
  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreRank: { color: "#6b7280", fontSize: 13, fontWeight: "700", width: 32 },
  scoreName: { flex: 1, color: "#e5e7eb", fontSize: 15 },
  scorePts:  { color: "#a78bfa", fontSize: 15, fontWeight: "900" },
});
