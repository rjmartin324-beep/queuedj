import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const TIPS = [
  "The host is picking the next game 🎮",
  "Get ready — things are about to heat up 🔥",
  "Host is setting the vibe ✨",
  "Stand by for the next round 🎯",
  "Something fun is coming 🎉",
];

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
  codeWrap:  { marginTop: 40, alignItems: "center" },
  codeLabel: { color: "#4a5568", fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 6 },
  code:      { color: "rgba(167,139,250,0.6)", fontSize: 28, fontWeight: "900", letterSpacing: 6 },
});
