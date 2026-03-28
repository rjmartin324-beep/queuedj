import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function TriviaCountdownView() {
  const { state } = useRoom();
  const endsAt: number = (state.guestViewData as any)?.endsAt ?? Date.now() + 3500;

  const [count, setCount] = useState(() => {
    const remaining = Math.ceil((endsAt - Date.now()) / 1000);
    return Math.max(1, Math.min(3, remaining));
  });

  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  function pulse() {
    scale.setValue(0.4);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }

  useEffect(() => {
    pulse();
    const remaining = endsAt - Date.now();
    const ticks = [
      { n: 3, delay: 0 },
      { n: 2, delay: 1000 },
      { n: 1, delay: 2000 },
    ].filter(t => t.delay < remaining);

    const timers = ticks.map(({ n, delay }) =>
      setTimeout(() => { setCount(n); pulse(); }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [endsAt]);

  return (
    <LinearGradient colors={["#06020f", "#0e0530", "#06020f"]} style={styles.root}>
      <Text style={styles.label}>GET READY</Text>
      <Animated.Text style={[styles.number, { transform: [{ scale }], opacity }]}>
        {count}
      </Animated.Text>
      <Text style={styles.sub}>Question incoming...</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, justifyContent: "center", alignItems: "center", gap: 24 },
  label:  { color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "900", letterSpacing: 4 },
  number: {
    fontSize: 140, fontWeight: "900", color: "#a855f7",
    textShadowColor: "#a855f7", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 40,
  },
  sub:    { color: "rgba(255,255,255,0.35)", fontSize: 14 },
});
