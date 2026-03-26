import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// CrowdGauge — animated crowd-energy bar visualization
// Shows a labeled level indicator that smoothly transitions between crowd states
// ─────────────────────────────────────────────────────────────────────────────

const STATES: Record<string, { level: number; color: string; label: string; emoji: string }> = {
  WARMUP:   { level: 0.15, color: "#3b82f6", label: "Warming Up",  emoji: "🌅" },
  RISING:   { level: 0.45, color: "#f59e0b", label: "Rising",      emoji: "📈" },
  PEAK:     { level: 0.90, color: "#ef4444", label: "Peak",        emoji: "🔥" },
  FATIGUE:  { level: 0.65, color: "#f97316", label: "Fatigued",    emoji: "😤" },
  RECOVERY: { level: 0.35, color: "#8b5cf6", label: "Recovering",  emoji: "🌊" },
  COOLDOWN: { level: 0.10, color: "#6b7280", label: "Cooling Down", emoji: "❄️" },
};

const DEFAULT = { level: 0.1, color: "#555", label: "Idle", emoji: "😴" };

interface Props {
  crowdState: string;
  /** Show the label text — default true */
  showLabel?: boolean;
  /** Bar width — defaults to fill container */
  width?: number;
}

export function CrowdGauge({ crowdState, showLabel = true, width }: Props) {
  const info      = STATES[crowdState] ?? DEFAULT;
  const barAnim   = useRef(new Animated.Value(info.level)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const prevState = useRef(crowdState);

  // Animate bar fill when crowd state changes
  useEffect(() => {
    if (prevState.current === crowdState) return;
    prevState.current = crowdState;

    const newInfo = STATES[crowdState] ?? DEFAULT;

    // Pulse the glow on transition
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
    ]).start();

    Animated.timing(barAnim, {
      toValue: newInfo.level,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [crowdState]);

  // Subtle idle pulse at peak state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (crowdState !== "PEAK") {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [crowdState]);

  const barColor     = info.color;
  const barWidthPct  = barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const glowOpacity  = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: pulseAnim }] }, width ? { width } : undefined]}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.emoji}>{info.emoji}</Text>
          <Text style={styles.label}>{info.label.toUpperCase()}</Text>
        </View>
      )}

      {/* Track */}
      <View style={styles.track}>
        {/* Filled bar */}
        <Animated.View
          style={[
            styles.fill,
            {
              width: barWidthPct,
              backgroundColor: barColor,
            },
          ]}
        />

        {/* Glow flash on transition */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: barColor, opacity: glowOpacity, borderRadius: 6 },
          ]}
        />

        {/* Segment ticks */}
        {[0.25, 0.5, 0.75].map((pos) => (
          <View
            key={pos}
            style={[styles.tick, { left: `${pos * 100}%` as any }]}
          />
        ))}
      </View>

      {/* Level dots */}
      <View style={styles.dotRow}>
        {[...Array(5)].map((_, i) => {
          const threshold = (i + 1) / 5;
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: barAnim.interpolate({
                    inputRange: [threshold - 0.2, threshold],
                    outputRange: ["#333", barColor],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingVertical: 4 },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  emoji:  { fontSize: 12 },
  label:  { color: "#9ca3af", fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  track: {
    height: 8,
    backgroundColor: "#1f2937",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 6,
  },
  tick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  dotRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 5,
    justifyContent: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
