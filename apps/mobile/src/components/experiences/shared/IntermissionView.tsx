import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const TIPS = [
  "The host is picking the next game 🎮",
  "Get ready — things are about to heat up 🔥",
  "Host is setting the vibe ✨",
  "Stand by for the next round 🎯",
  "Something fun is coming 🎉",
];

const AVATAR_COLORS = [
  "#7c3aed","#a855f7","#ec4899","#f97316","#22c55e","#06b6d4","#3b82f6","#eab308",
];

function avatarColor(guestId: string) {
  let hash = 0;
  for (let i = 0; i < guestId.length; i++) hash = (hash * 31 + guestId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function IntermissionView() {
  const { state } = useRoom();
  const pulse = useRef(new Animated.Value(1)).current;
  const tip   = TIPS[Math.floor(Math.random() * TIPS.length)];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900,  useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900,  useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const roomCode = state.room?.code ?? "";
  const guests = state.members.filter(m => !m.isWorkerNode && m.role !== "HOST" && m.role !== "CO_HOST");
  const myId = state.guestId;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#03001c", "#07001a", "#0f0028"]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["transparent", "rgba(181,23,158,0.10)", "rgba(114,9,183,0.22)"]}
        style={[StyleSheet.absoluteFill, { top: "50%" }]}
        pointerEvents="none"
      />

      <Animated.Text style={[styles.emoji, { transform: [{ scale: pulse }] }]}>⏳</Animated.Text>
      <Text style={styles.heading}>Hang tight…</Text>
      <Text style={styles.tip}>{tip}</Text>

      {/* Party members */}
      {guests.length > 0 && (
        <View style={styles.partyBox}>
          <Text style={styles.partyLabel}>IN THE PARTY — {guests.length}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.partyRow}
          >
            {guests.map(m => {
              const isMe = m.guestId === myId;
              const name = m.displayName ?? m.guestId.slice(0, 8);
              const color = avatarColor(m.guestId);
              return (
                <View key={m.guestId} style={styles.chip}>
                  <View style={[styles.chipDot, { backgroundColor: color }]} />
                  <Text style={[styles.chipName, isMe && styles.chipNameMe]} numberOfLines={1}>
                    {name}{isMe ? " (you)" : ""}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {roomCode ? (
        <View style={styles.codeWrap}>
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.code}>{roomCode}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#03001c" },
  emoji:     { fontSize: 56, marginBottom: 20 },
  heading:   { color: "#fff", fontSize: 26, fontWeight: "900", marginBottom: 10 },
  tip:       { color: "#6b7fa0", fontSize: 15, textAlign: "center", paddingHorizontal: 40, lineHeight: 22 },

  partyBox: {
    marginTop: 28, width: "100%", paddingHorizontal: 20, gap: 10,
  },
  partyLabel: {
    color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: "800", letterSpacing: 2, textAlign: "center",
  },
  partyRow: { gap: 8, paddingHorizontal: 4, flexDirection: "row" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  chipDot:    { width: 8, height: 8, borderRadius: 4 },
  chipName:   { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700", maxWidth: 120 },
  chipNameMe: { color: "#a78bfa" },

  codeWrap:  { marginTop: 32, alignItems: "center" },
  codeLabel: { color: "#4a5568", fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 6 },
  code:      { color: "rgba(167,139,250,0.6)", fontSize: 28, fontWeight: "900", letterSpacing: 6 },
});
