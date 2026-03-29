import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function WhoKnowsWhoView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase  = d?.phase ?? "waiting";
  const q      = d?.currentQ ?? null;
  const votes  = d?.votes ?? {};
  const tally  = d?.tally ?? {};
  const correctAnswer = d?.correctAnswer ?? null;
  const round  = d?.round ?? 1;
  const total  = d?.totalRounds ?? 8;

  const myVote = votes[state.guestId ?? ""];
  const [picked, setPicked] = useState<string|null>(null);

  function vote(targetId: string) {
    if (picked || myVote) return;
    setPicked(targetId);
    sendAction("vote", { targetGuestId: targetId });
  }

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>👥</Text><Text style={s.title}>Who Knows Who</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  const options: string[] = q?.options ?? [];
  const showReveal = phase === "reveal";
  const choice = picked ?? myVote ?? null;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d0a1a"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
      </View>

      {q && (
        <View style={s.qCard}>
          <Text style={s.qText}>{q.text}</Text>
        </View>
      )}

      <ScrollView style={s.list} contentContainerStyle={{ gap: 10, padding: 16 }}>
        {options.map((guestId: string) => {
          const isChoice = choice === guestId;
          const isCorrect = showReveal && correctAnswer === guestId;
          const isWrong   = showReveal && isChoice && !isCorrect;
          const count     = tally[guestId] ?? 0;

          return (
            <TouchableOpacity
              key={guestId}
              style={[s.option, isChoice && s.optionSelected, isCorrect && s.optionCorrect, isWrong && s.optionWrong]}
              onPress={() => vote(guestId)}
              disabled={!!choice || showReveal}
              activeOpacity={0.8}
            >
              <Text style={s.optionName}>{memberName(guestId)}</Text>
              {showReveal && count > 0 && <Text style={s.optionCount}>{count} votes</Text>}
              {isCorrect && <Text style={s.correctMark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {choice && !showReveal && (
        <View style={s.locked}><Text style={s.lockedText}>Locked in — waiting for reveal</Text></View>
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
  header: { padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  qCard:  { marginHorizontal: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  qText:  { color: "#fff", fontSize: 19, fontWeight: "800", lineHeight: 26, textAlign: "center" },
  list:   { flex: 1 },
  option: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)" },
  optionSelected: { borderColor: "#a78bfa", backgroundColor: "rgba(167,139,250,0.15)" },
  optionCorrect:  { borderColor: "#4ade80", backgroundColor: "rgba(34,197,94,0.15)" },
  optionWrong:    { borderColor: "#f87171", backgroundColor: "rgba(239,68,68,0.15)" },
  optionName:  { flex: 1, color: "#e5e7eb", fontSize: 16, fontWeight: "700" },
  optionCount: { color: "#9ca3af", fontSize: 13 },
  correctMark: { color: "#4ade80", fontSize: 20, fontWeight: "900" },
  locked: { margin: 16, backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 14, padding: 12, alignItems: "center" },
  lockedText: { color: "#818cf8", fontSize: 13, fontWeight: "700" },
});
