import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function AlibiView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase    = d?.phase ?? "waiting";
  const c        = d?.currentCase ?? null;
  const votes    = d?.votes ?? {};
  const round    = d?.round ?? 1;
  const total    = d?.totalRounds ?? 5;
  const guiltyIndex: number | null = d?.guiltyIndex ?? null; // only on reveal

  const myVote = votes[state.guestId ?? ""];
  const [picked, setPicked] = useState<number|null>(null);

  function vote(idx: number) {
    if (picked !== null || myVote !== undefined) return;
    setPicked(idx);
    sendAction("vote", { suspectIndex: idx });
  }

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>🔍</Text><Text style={s.title}>Alibi</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  const suspects: Array<{name:string; alibi:string}> = c?.suspects ?? [];
  const showReveal = phase === "reveal";
  const choice = picked ?? (myVote as number | undefined) ?? null;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0a14","#0d0820"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>CASE {round} / {total}</Text>
        <Text style={s.phaseLabel}>{phase === "reading" ? "📖 Study the case" : phase === "voting" ? "🗳️ Vote for the guilty suspect" : "🔓 Reveal"}</Text>
      </View>

      {c && (
        <View style={s.crimeCard}>
          <Text style={s.crimeLabel}>THE CRIME</Text>
          <Text style={s.crimeText}>{c.crime}</Text>
          {c.clue && <Text style={s.clueText}>🔎 Clue: {c.clue}</Text>}
        </View>
      )}

      <ScrollView style={s.suspects} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={s.suspectsTitle}>SUSPECTS</Text>
        {suspects.map((suspect, i) => {
          const isChoice  = choice === i;
          const isGuilty  = showReveal && guiltyIndex === i;
          const isWrong   = showReveal && isChoice && !isGuilty;

          return (
            <TouchableOpacity
              key={i}
              style={[s.suspect, isChoice && s.suspectSelected, isGuilty && s.suspectGuilty, isWrong && s.suspectWrong]}
              onPress={() => phase === "voting" && vote(i)}
              disabled={phase !== "voting" || choice !== null}
              activeOpacity={0.8}
            >
              <Text style={s.suspectName}>{suspect.name}</Text>
              <Text style={s.suspectAlibi}>{suspect.alibi}</Text>
              {isGuilty && <Text style={s.guiltyBadge}>GUILTY !</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {choice !== null && !showReveal && (
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
  header: { padding: 16, gap: 4 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  phaseLabel: { color: "#e5e7eb", fontSize: 15, fontWeight: "700" },
  crimeCard:  { marginHorizontal: 16, marginBottom: 12, backgroundColor: "rgba(220,38,38,0.1)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", gap: 6 },
  crimeLabel: { color: "#f87171", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  crimeText:  { color: "#fff", fontSize: 15, fontWeight: "700", lineHeight: 22 },
  clueText:   { color: "#fde68a", fontSize: 13, fontStyle: "italic" },
  suspects:   { flex: 1 },
  suspectsTitle: { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 4 },
  suspect:        { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)", gap: 4 },
  suspectSelected:{ borderColor: "#a78bfa", backgroundColor: "rgba(167,139,250,0.12)" },
  suspectGuilty:  { borderColor: "#f87171", backgroundColor: "rgba(239,68,68,0.15)" },
  suspectWrong:   { opacity: 0.5 },
  suspectName:  { color: "#fff", fontSize: 16, fontWeight: "800" },
  suspectAlibi: { color: "#9ca3af", fontSize: 13, lineHeight: 18 },
  guiltyBadge:  { color: "#f87171", fontSize: 13, fontWeight: "900", marginTop: 4 },
  locked: { margin: 16, backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 14, padding: 12, alignItems: "center" },
  lockedText: { color: "#818cf8", fontSize: 13, fontWeight: "700" },
});
