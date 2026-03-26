import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Animated, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// WaitingForPlayersView — animated waiting screen shown after a player submits,
// while waiting for the rest of the room to catch up.
//
// Props:
//   emoji       — game emoji shown large in the center ring
//   accent      — game accent color (border, progress, dots)
//   title       — primary heading e.g. "Drawing Locked!"
//   subtitle    — secondary line e.g. "Waiting for everyone to finish..."
//   tips        — optional array of rotating tip strings
//   submittedCount — how many players have submitted (from guestViewData)
//   totalCount     — total player count (defaults to state.members.length)
// ─────────────────────────────────────────────────────────────────────────────

const SW = Dimensions.get("window").width;

const DEFAULT_TIPS = [
  "The fastest finger doesn't always win 😏",
  "Lag is just the universe saying slow down ⏳",
  "Someone out there is really thinking hard 🤔",
  "Good things come to those who wait 🎉",
  "This is your moment to breathe 🧘",
  "Patience is a superpower 💪",
];

interface Props {
  emoji:          string;
  accent:         string;
  title:          string;
  subtitle:       string;
  tips?:          string[];
  submittedCount?: number;
  totalCount?:    number;
}

export function WaitingForPlayersView({
  emoji, accent, title, subtitle,
  tips = DEFAULT_TIPS,
  submittedCount,
  totalCount,
}: Props) {
  const { state } = useRoom();
  const total     = totalCount ?? state.members.length;
  const submitted = submittedCount ?? 1; // this player at minimum

  // Animations
  const pulse  = useRef(new Animated.Value(1)).current;
  const ring1  = useRef(new Animated.Value(0.4)).current;
  const ring2  = useRef(new Animated.Value(0.2)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const barW   = useRef(new Animated.Value(0)).current;

  // Rotating tip
  const [tipIdx, setTipIdx] = useState(Math.floor(Math.random() * tips.length));
  const tipOp = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Mount fade
    Animated.timing(fadeIn, { toValue: 1, duration: 450, useNativeDriver: true }).start();

    // Emoji pulse
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.10, duration: 950, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0,  duration: 950, useNativeDriver: true }),
    ])).start();

    // Pulsing rings
    Animated.loop(Animated.sequence([
      Animated.timing(ring1, { toValue: 0.9, duration: 1100, useNativeDriver: true }),
      Animated.timing(ring1, { toValue: 0.4, duration: 1100, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.delay(550),
      Animated.timing(ring2, { toValue: 0.7, duration: 1100, useNativeDriver: true }),
      Animated.timing(ring2, { toValue: 0.2, duration: 1100, useNativeDriver: true }),
    ])).start();

    // Tip rotation every 4s
    const interval = setInterval(() => {
      Animated.timing(tipOp, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
        setTipIdx(i => (i + 1) % tips.length);
        Animated.timing(tipOp, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Animate progress bar when submittedCount changes
  useEffect(() => {
    const pct = total > 0 ? Math.min(1, submitted / total) : 0;
    Animated.spring(barW, { toValue: pct, useNativeDriver: false, tension: 60, friction: 12 }).start();
  }, [submitted, total]);

  const barColor  = barW.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["#555", accent, accent] });
  const remaining = Math.max(0, total - submitted);

  return (
    <Animated.View style={[styles.root, { opacity: fadeIn }]}>
      <LinearGradient colors={["#06020f", "#0d0428", "#06020f"]} style={StyleSheet.absoluteFill} />

      {/* Glow orb */}
      <View style={[styles.glowOrb, { backgroundColor: accent + "20" }]} />

      {/* Pulsing rings */}
      <Animated.View style={[styles.ring, styles.ring1, { borderColor: accent + "88", opacity: ring1 }]} />
      <Animated.View style={[styles.ring, styles.ring2, { borderColor: accent + "55", opacity: ring2 }]} />

      {/* Emoji badge */}
      <Animated.View style={[styles.badge, { borderColor: accent + "aa", transform: [{ scale: pulse }] }]}>
        <LinearGradient
          colors={[accent + "40", accent + "18"]}
          style={styles.badgeGrad}
        >
          <Text style={styles.badgeEmoji}>{emoji}</Text>
        </LinearGradient>
      </Animated.View>

      {/* Text */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {/* Player dots progress */}
      {total > 1 && (
        <View style={styles.dotsSection}>
          <View style={styles.dotsRow}>
            {Array.from({ length: total }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.playerDot,
                  i < submitted
                    ? { backgroundColor: accent }
                    : { backgroundColor: "#2a2a4a" },
                ]}
              />
            ))}
          </View>
          <Text style={styles.dotsLabel}>
            {submitted === total
              ? "Everyone's in! 🎉"
              : `${remaining} ${remaining === 1 ? "player" : "players"} still going...`
            }
          </Text>
        </View>
      )}

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, {
          width: barW.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          backgroundColor: barColor,
        }]} />
      </View>

      {/* Pulsing dots */}
      <View style={styles.pulseDotsRow}>
        {[0, 1, 2].map(i => <PulseDot key={i} delay={i * 280} accent={accent} />)}
      </View>

      {/* Rotating tip */}
      <Animated.View style={[styles.tipCard, { opacity: tipOp }]}>
        <Text style={styles.tipText}>{tips[tipIdx]}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function PulseDot({ delay, accent }: { delay: number; accent: string }) {
  const op = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(op, { toValue: 1,   duration: 420, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.2, duration: 420, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[styles.pulseDot, { backgroundColor: accent, opacity: op }]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#06020f",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },

  glowOrb: {
    position: "absolute",
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: SW * 0.45,
  },

  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1.5,
  },
  ring1: { width: 240, height: 240 },
  ring2: { width: 300, height: 300 },

  badge: {
    width: 100, height: 100, borderRadius: 50,
    overflow: "hidden",
    borderWidth: 2,
    marginBottom: 28,
    shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
  },
  badgeGrad: {
    flex: 1, alignItems: "center", justifyContent: "center",
  },
  badgeEmoji: { fontSize: 48 },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },

  dotsSection: {
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  dotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    maxWidth: SW * 0.75,
  },
  playerDot: {
    width: 18, height: 18, borderRadius: 9,
  },
  dotsLabel: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 12,
    fontWeight: "600",
  },

  barTrack: {
    width: SW * 0.65,
    height: 4,
    backgroundColor: "#1e1e3a",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 24,
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },

  pulseDotsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 32,
  },
  pulseDot: {
    width: 10, height: 10, borderRadius: 5,
  },

  tipCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxWidth: SW * 0.80,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  tipText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 18,
  },
});
