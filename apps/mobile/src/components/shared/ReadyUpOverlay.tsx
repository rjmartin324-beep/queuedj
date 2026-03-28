import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, StyleSheet as RNStyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../contexts/RoomContext";

export function ReadyUpOverlay() {
  const { state, sendReadyUp } = useRoom();
  const { active, readyCount, totalCount, iHaveReadied } = state.readyUp;

  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [active]);

  if (!active || state.role !== "GUEST") return null;

  const progress = totalCount > 0 ? readyCount / totalCount : 0;

  if (iHaveReadied) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={["#06020f", "#0d0428", "#06020f"]} style={StyleSheet.absoluteFill} />
        <Text style={styles.emoji}>✅</Text>
        <Text style={styles.title}>You're Ready!</Text>
        <Text style={styles.sub}>Waiting for everyone else...</Text>
        <View style={styles.countRow}>
          <Text style={styles.countText}>{readyCount} / {totalCount} ready</Text>
        </View>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` as any }]} />
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.root, { opacity, transform: [{ scale }] }]}>
      <LinearGradient colors={["#06020f", "#0d0428", "#06020f"]} style={StyleSheet.absoluteFill} />

      <Text style={styles.emoji}>🎮</Text>
      <Text style={styles.title}>Get Ready!</Text>
      <Text style={styles.sub}>Tap when you're ready to play</Text>

      {totalCount > 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>{readyCount} / {totalCount} ready</Text>
        </View>
      )}

      <TouchableOpacity onPress={sendReadyUp} activeOpacity={0.85} style={styles.btnWrap}>
        <LinearGradient colors={["#7c3aed", "#a855f7"]} style={styles.btn}>
          <Text style={styles.btnText}>I'm Ready! 🙋</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...RNStyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    padding: 32,
  },
  emoji:  { fontSize: 72, marginBottom: 8 },
  title:  { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  sub:    { fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center" },
  countRow: {
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: "rgba(168,85,247,0.18)",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.35)",
  },
  countText: { color: "#c4b5fd", fontWeight: "800", fontSize: 16 },
  barTrack: {
    width: "80%", height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden",
  },
  barFill: {
    height: "100%", borderRadius: 3,
    backgroundColor: "#a855f7",
  },
  btnWrap: { borderRadius: 24, overflow: "hidden", marginTop: 8, width: "80%" },
  btn:    { paddingVertical: 18, alignItems: "center", borderRadius: 24 },
  btnText: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 0.3 },
});
