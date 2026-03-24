import React, { useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const SW = Dimensions.get("window").width;
const ORBIT_R   = Math.min(SW * 0.30, 120); // orbit radius
const BADGE_SZ  = 40;

const ORBIT_ITEMS = [
  { emoji: "🧬", angle: 0   },
  { emoji: "🌍", angle: 60  },
  { emoji: "🏛️", angle: 120 },
  { emoji: "🎬", angle: 180 },
  { emoji: "🎵", angle: 240 },
  { emoji: "⚡", angle: 300 },
];

export function TriviaWaitingView() {
  const { state } = useRoom();

  const pulse    = useRef(new Animated.Value(1)).current;
  const glow     = useRef(new Animated.Value(0.35)).current;
  const ring1    = useRef(new Animated.Value(0.55)).current;
  const ring2    = useRef(new Animated.Value(0.30)).current;
  const orbit    = useRef(new Animated.Value(0)).current;
  const qY       = useRef(new Animated.Value(0)).current;
  const qOp      = useRef(new Animated.Value(0)).current;

  // Pre-compute shared interpolations once — not inside render
  const orbitDeg   = useMemo(() => orbit.interpolate({ inputRange: [0,1], outputRange: ["0deg","360deg"] }), []);
  const counterDeg = useMemo(() => orbit.interpolate({ inputRange: [0,1], outputRange: ["0deg","-360deg"] }), []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.07, duration: 860, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0,  duration: 860, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1,    duration: 1100, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.35, duration: 1100, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(ring1, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      Animated.timing(ring1, { toValue: 0.45, duration: 1000, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.delay(500),
      Animated.timing(ring2, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      Animated.timing(ring2, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
    ])).start();

    Animated.loop(
      Animated.timing(orbit, { toValue: 1, duration: 11000, useNativeDriver: true })
    ).start();

    function floatQ() {
      qY.setValue(0); qOp.setValue(0);
      Animated.sequence([
        Animated.delay(1000 + Math.random() * 2000),
        Animated.parallel([
          Animated.timing(qY,  { toValue: -55, duration: 1400, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(qOp, { toValue: 1,  duration: 280, useNativeDriver: true }),
            Animated.timing(qOp, { toValue: 0,  duration: 1120, useNativeDriver: true }),
          ]),
        ]),
      ]).start(floatQ);
    }
    floatQ();
  }, []);

  return (
    <LinearGradient colors={["#06020f","#0e0530","#06020f"]} style={styles.root}>

      {/* Background glow */}
      <Animated.View style={[styles.bgOrb, { opacity: glow }]} />

      {/* Pulsing rings */}
      <Animated.View style={[styles.ring, styles.ring1, { opacity: ring1 }]} />
      <Animated.View style={[styles.ring, styles.ring2, { opacity: ring2 }]} />

      {/* Orbit system — properly sized container centered on screen */}
      <View style={styles.orbitContainer} pointerEvents="none">
        {/* Rotating wrapper */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: orbitDeg }] }]}>
          {ORBIT_ITEMS.map((item, i) => {
            const rad = (item.angle * Math.PI) / 180;
            // Position badge center within the container
            const cx = ORBIT_R + Math.cos(rad) * ORBIT_R - BADGE_SZ / 2;
            const cy = ORBIT_R + Math.sin(rad) * ORBIT_R - BADGE_SZ / 2;
            return (
              <Animated.View
                key={i}
                style={[styles.orbitBadge, {
                  left: cx, top: cy,
                  transform: [{ rotate: counterDeg }],
                }]}
              >
                <LinearGradient
                  colors={["rgba(108,71,255,0.45)","rgba(168,85,247,0.28)"]}
                  style={styles.orbitBadgeGrad}
                >
                  <Text style={styles.orbitEmoji}>{item.emoji}</Text>
                </LinearGradient>
              </Animated.View>
            );
          })}
        </Animated.View>
      </View>

      {/* Brain in glowing pill */}
      <Animated.View style={[styles.brainWrap, { transform: [{ scale: pulse }] }]}>
        <LinearGradient colors={["#2e1080","#1a0840","#0e0530"]} style={styles.brainGrad}>
          <Text style={styles.brainEmoji}>🧠</Text>
          <View style={styles.qBubble}>
            <Text style={styles.qBubbleText}>?</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Floating ? */}
      <Animated.Text style={[styles.floatQ, { opacity: qOp, transform: [{ translateY: qY }] }]}>
        ?
      </Animated.Text>

      <Text style={styles.title}>Trivia Time!</Text>
      <Text style={styles.subtitle}>Get ready — the host is starting the round</Text>

      <View style={styles.dotsRow}>
        {[0,1,2].map(i => <PulseDot key={i} delay={i * 260} />)}
      </View>

      <View style={styles.badge}>
        <LinearGradient
          colors={["rgba(108,71,255,0.35)","rgba(168,85,247,0.25)"]}
          style={styles.badgeGrad}
        >
          <Text style={styles.badgeEmoji}>👥</Text>
          <Text style={styles.badgeText}>
            {state.members.length} {state.members.length === 1 ? "player" : "players"} ready
          </Text>
        </LinearGradient>
      </View>

      <Text style={styles.tip}>Tip: Answer faster for bonus points ⚡</Text>
    </LinearGradient>
  );
}

function PulseDot({ delay }: { delay: number }) {
  const op = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(op, { toValue: 1,   duration: 400, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.2, duration: 400, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[styles.dot, { opacity: op }]} />;
}

const CONTAINER_SZ = ORBIT_R * 2 + BADGE_SZ;

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },

  bgOrb: {
    position: "absolute", width: 340, height: 340, borderRadius: 170,
    backgroundColor: "rgba(108,71,255,0.20)",
  },

  ring: { position: "absolute", borderRadius: 999, borderWidth: 1.5 },
  ring1: { width: 250, height: 250, borderColor: "rgba(168,85,247,0.55)" },
  ring2: { width: 305, height: 305, borderColor: "rgba(99,102,241,0.38)" },

  // Sized container so children are never clipped
  orbitContainer: {
    position: "absolute",
    width: CONTAINER_SZ,
    height: CONTAINER_SZ,
  },
  orbitBadge: {
    position: "absolute",
    width: BADGE_SZ, height: BADGE_SZ, borderRadius: BADGE_SZ / 2,
    overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.5)",
  },
  orbitBadgeGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  orbitEmoji: { fontSize: 18 },

  brainWrap: {
    width: 96, height: 96, borderRadius: 48,
    overflow: "hidden",
    borderWidth: 2, borderColor: "rgba(168,85,247,0.65)",
    shadowColor: "#a855f7", shadowOpacity: 0.9, shadowRadius: 22,
    marginBottom: 26,
  },
  brainGrad:  { flex: 1, alignItems: "center", justifyContent: "center" },
  brainEmoji: { fontSize: 48 },
  qBubble: {
    position: "absolute", top: 5, right: 5,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#6c47ff",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },
  qBubbleText: { color: "#fff", fontWeight: "900", fontSize: 13 },

  floatQ: {
    position: "absolute",
    fontSize: 30, fontWeight: "900", color: "#a855f7",
    shadowColor: "#a855f7", shadowOpacity: 0.9, shadowRadius: 12,
  },

  title:    { fontSize: 34, fontWeight: "900", color: "#fff", letterSpacing: -0.5, marginBottom: 10 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.50)", textAlign: "center", marginBottom: 26, lineHeight: 21 },

  dotsRow: { flexDirection: "row", gap: 10, marginBottom: 26 },
  dot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: "#a855f7" },

  badge:     { borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(168,85,247,0.4)", marginBottom: 20 },
  badgeGrad: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  badgeEmoji:{ fontSize: 18 },
  badgeText: { color: "#c4b5fd", fontWeight: "700", fontSize: 15 },

  tip: { color: "rgba(255,255,255,0.28)", fontSize: 12, textAlign: "center", fontStyle: "italic" },
});
