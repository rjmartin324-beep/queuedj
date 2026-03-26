import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// RateLimitBadge — shows a countdown when user hits a server rate limit
// Slide-in from top, auto-dismiss on expiry
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** Total cooldown seconds */
  seconds: number;
  /** Label — e.g. "Track request" */
  label?: string;
  onDone?: () => void;
}

export function RateLimitBadge({ seconds, label = "Action", onDone }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const slideY  = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Slide in
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(interval);
          // Slide out
          Animated.parallel([
            Animated.timing(slideY,  { toValue: -60, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0,   duration: 300, useNativeDriver: true }),
          ]).start(() => onDone?.());
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const pct = remaining / seconds;

  return (
    <Animated.View style={[styles.badge, { transform: [{ translateY: slideY }], opacity }]}>
      <Text style={styles.icon}>⏳</Text>
      <View style={styles.textCol}>
        <Text style={styles.label}>{label} on cooldown</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct * 100}%` as any }]} />
        </View>
      </View>
      <Text style={styles.countdown}>{remaining}s</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position:        "absolute",
    top:             10,
    left:            12,
    right:           12,
    backgroundColor: "rgba(30,15,60,0.97)",
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     "rgba(251,146,60,0.4)",
    padding:         12,
    flexDirection:   "row",
    alignItems:      "center",
    gap:             10,
    zIndex:          100,
    elevation:       8,
  },
  icon:      { fontSize: 20 },
  textCol:   { flex: 1, gap: 4 },
  label:     { color: "#fb923c", fontWeight: "700", fontSize: 13 },
  barTrack:  { height: 4, backgroundColor: "#1f2937", borderRadius: 2, overflow: "hidden" },
  barFill:   { height: 4, backgroundColor: "#f97316", borderRadius: 2 },
  countdown: { color: "#fb923c", fontWeight: "900", fontSize: 18, width: 32, textAlign: "right" },
});
