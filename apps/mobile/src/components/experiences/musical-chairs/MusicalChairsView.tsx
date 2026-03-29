import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function MusicalChairsView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase    = d?.phase ?? "waiting";
  // Server sends currentQ: { q: string; a: string } during freeze phase
  const currentQ = d?.currentQ ?? null;
  // Server uses activePlayers / eliminatedPlayers — no separate "seated" or "chairs" field
  const activePlayers: string[]    = d?.activePlayers ?? [];
  const eliminatedPlayers: string[] = d?.eliminatedPlayers ?? [];
  // chairs = one fewer than active players (classic musical chairs rule)
  const chairs = Math.max(0, activePlayers.length - 1);
  const round  = d?.round ?? 1;

  const myId = state.guestId ?? "";
  // Server doesn't broadcast individual chair grabs — track locally
  const [hasAnswered, setHasAnswered] = useState(false);
  useEffect(() => { setHasAnswered(false); }, [phase]);

  const isEliminated = eliminatedPlayers.includes(myId);
  const alreadyAnswered = hasAnswered;

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>🪑</Text><Text style={s.title}>Musical Chairs</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  if (isEliminated) return (
    <View style={s.center}>
      <Text style={s.emoji}>😵</Text>
      <Text style={s.title}>Eliminated!</Text>
      <Text style={s.sub}>Better luck next game!</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a1020","#0a0820"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round}</Text>
        <Text style={s.chairCount}>🪑 {chairs} chair{chairs !== 1 ? "s" : ""} left</Text>
      </View>

      {phase === "music" && (
        <View style={s.musicArea}>
          <Text style={s.musicEmoji}>🎵</Text>
          <Text style={s.musicText}>Music is playing...</Text>
          <Text style={s.musicSub}>Get ready to grab a chair!</Text>
        </View>
      )}

      {phase === "freeze" && !alreadyAnswered && (
        <View style={s.freezeArea}>
          <Text style={s.freezeLabel}>QUICK! Grab a chair:</Text>
          {currentQ && (
            <View style={s.challengeCard}>
              <Text style={s.challengeText}>{currentQ.q}</Text>
            </View>
          )}
          <TouchableOpacity style={s.grabBtn} onPress={() => { setHasAnswered(true); sendAction("answer", {}); }} activeOpacity={0.8}>
            <LinearGradient colors={["#dc2626","#b91c1c"]} style={s.grabInner}>
              <Text style={s.grabText}>🪑 GRAB A CHAIR!</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {phase === "freeze" && alreadyAnswered && (
        <View style={s.safeArea}>
          <Text style={s.safeEmoji}>🎉</Text>
          <Text style={s.safeText}>You got a chair!</Text>
          <Text style={s.safeSub}>{chairs} chair{chairs !== 1 ? "s" : ""} remaining</Text>
        </View>
      )}

      {phase === "elimination" && (
        <View style={s.eliminationArea}>
          <Text style={s.elimEmoji}>😬</Text>
          <Text style={s.elimText}>
            {eliminatedPlayers.length > 0
              ? `${eliminatedPlayers.map(memberName).join(", ")} ${eliminatedPlayers.length === 1 ? "is" : "are"} out!`
              : "Checking who's out..."}
          </Text>
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
  chairCount: { color: "#fbbf24", fontSize: 13, fontWeight: "700" },
  musicArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  musicEmoji:{ fontSize: 80 },
  musicText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  musicSub:  { color: "#9ca3af", fontSize: 15 },
  freezeArea: { flex: 1, padding: 16, gap: 16 },
  freezeLabel:{ color: "#fbbf24", fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  challengeCard: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  challengeText: { color: "#fff", fontSize: 20, fontWeight: "800", lineHeight: 28 },
  grabBtn:   { borderRadius: 20, overflow: "hidden" },
  grabInner: { padding: 24, alignItems: "center" },
  grabText:  { color: "#fff", fontSize: 22, fontWeight: "900" },
  safeArea:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  safeEmoji: { fontSize: 72 },
  safeText:  { color: "#4ade80", fontSize: 24, fontWeight: "900" },
  safeSub:   { color: "#9ca3af", fontSize: 15 },
  eliminationArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  elimEmoji: { fontSize: 64 },
  elimText:  { color: "#f87171", fontSize: 18, fontWeight: "800", textAlign: "center", paddingHorizontal: 24 },
});
