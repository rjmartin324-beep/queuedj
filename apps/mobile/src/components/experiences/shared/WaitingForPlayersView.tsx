import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Animated, Dimensions, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// WaitingForPlayersView — shown after a player submits, while waiting for others.
//
// Props:
//   emoji             — game emoji shown large in the center ring
//   accent            — game accent color (border, progress, dots)
//   gameName          — full game name e.g. "Scrapbook Sabotage"
//   title             — primary heading e.g. "Story Locked In!"
//   subtitle          — secondary line e.g. "Waiting for everyone to write..."
//   waitReason        — "submissions" | "votes" | "host" — flavours the list label
//   tips              — optional rotating tip strings
//   submittedGuestIds — array of guestIds who have submitted (server-provided)
//   votedGuestIds     — array of guestIds who have voted (server-provided)
//   iSubmitted        — true if this guest already submitted (show ✓ badge)
//   totalCount        — overrides state.members.length
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
  emoji:              string;
  accent:             string;
  gameName?:          string;
  title:              string;
  subtitle:           string;
  waitReason?:        "submissions" | "votes" | "host";
  tips?:              string[];
  submittedGuestIds?: string[];
  votedGuestIds?:     string[];
  iSubmitted?:        boolean;
  totalCount?:        number;
}

export function WaitingForPlayersView({
  emoji, accent, gameName, title, subtitle,
  waitReason = "submissions",
  tips = DEFAULT_TIPS,
  submittedGuestIds,
  votedGuestIds,
  iSubmitted,
  totalCount,
}: Props) {
  const { state } = useRoom();
  const members   = state.members;
  const myId      = state.guestId;
  const total     = totalCount ?? members.length;

  // Resolve which IDs have acted
  const activeIds: string[] = waitReason === "votes"
    ? (votedGuestIds ?? [])
    : (submittedGuestIds ?? []);

  const submitted  = activeIds.length || 1; // at minimum this player
  const iAmDone    = iSubmitted ?? activeIds.includes(myId ?? "");

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
    Animated.timing(fadeIn, { toValue: 1, duration: 450, useNativeDriver: true }).start();

    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.10, duration: 950, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0,  duration: 950, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(ring1, { toValue: 0.9, duration: 1100, useNativeDriver: true }),
      Animated.timing(ring1, { toValue: 0.4, duration: 1100, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.delay(550),
      Animated.timing(ring2, { toValue: 0.7, duration: 1100, useNativeDriver: true }),
      Animated.timing(ring2, { toValue: 0.2, duration: 1100, useNativeDriver: true }),
    ])).start();

    const interval = setInterval(() => {
      Animated.timing(tipOp, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
        setTipIdx(i => (i + 1) % tips.length);
        Animated.timing(tipOp, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pct = total > 0 ? Math.min(1, submitted / total) : 0;
    Animated.spring(barW, { toValue: pct, useNativeDriver: false, tension: 60, friction: 12 }).start();
  }, [submitted, total]);

  const barColor  = barW.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["#555", accent, accent] });
  const remaining = Math.max(0, total - submitted);
  const allDone   = remaining === 0;

  // Resolve member names
  const getMemberName = (guestId: string) => {
    const m = members.find(x => x.guestId === guestId);
    return m?.displayName ?? "Player";
  };

  // Split members into done / pending
  const doneMembers    = members.filter(m => activeIds.includes(m.guestId));
  const pendingMembers = members.filter(m => !activeIds.includes(m.guestId));
  const showPlayerList = members.length > 1 && activeIds.length > 0;

  const waitLabel = waitReason === "votes"
    ? "VOTED"
    : waitReason === "host"
    ? "READY"
    : "SUBMITTED";

  return (
    <Animated.View style={[styles.root, { opacity: fadeIn }]}>
      <LinearGradient colors={["#06020f", "#0d0428", "#06020f"]} style={StyleSheet.absoluteFill} />

      {/* Glow orb */}
      <View style={[styles.glowOrb, { backgroundColor: accent + "20" }]} />

      {/* Pulsing rings */}
      <Animated.View style={[styles.ring, styles.ring1, { borderColor: accent + "88", opacity: ring1 }]} />
      <Animated.View style={[styles.ring, styles.ring2, { borderColor: accent + "55", opacity: ring2 }]} />

      <ScrollView
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        {/* Game name badge */}
        {gameName && (
          <View style={[styles.gameNameBadge, { borderColor: accent + "44" }]}>
            <Text style={[styles.gameNameText, { color: accent }]}>{gameName.toUpperCase()}</Text>
          </View>
        )}

        {/* Emoji badge */}
        <Animated.View style={[styles.badge, { borderColor: accent + "aa", transform: [{ scale: pulse }] }]}>
          <LinearGradient colors={[accent + "40", accent + "18"]} style={styles.badgeGrad}>
            <Text style={styles.badgeEmoji}>{emoji}</Text>
          </LinearGradient>
        </Animated.View>

        {/* "You submitted ✓" banner */}
        {iAmDone && (
          <View style={[styles.submittedBadge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
            <Text style={[styles.submittedBadgeText, { color: accent }]}>✓  You {waitLabel.toLowerCase()}</Text>
          </View>
        )}

        {/* Title + subtitle */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Progress bar */}
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, {
            width: barW.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            backgroundColor: barColor,
          }]} />
        </View>
        <Text style={styles.countLabel}>
          {allDone ? "Everyone's in! 🎉" : `${submitted} of ${total} ${waitLabel.toLowerCase()}`}
        </Text>

        {/* Player name list */}
        {showPlayerList && (
          <View style={styles.playerList}>
            {/* Done players */}
            {doneMembers.map(m => {
              const isMe = m.guestId === myId;
              return (
                <View key={m.guestId} style={styles.playerRow}>
                  <View style={[styles.playerDot, { backgroundColor: accent }]}>
                    <Text style={styles.playerDotIcon}>✓</Text>
                  </View>
                  <Text style={[styles.playerName, isMe && { color: accent, fontWeight: "800" }]}>
                    {isMe ? "You" : getMemberName(m.guestId)}
                  </Text>
                  <Text style={[styles.playerStatus, { color: accent + "bb" }]}>{waitLabel.toLowerCase()}</Text>
                </View>
              );
            })}

            {/* Pending players */}
            {pendingMembers.map(m => {
              const isMe = m.guestId === myId;
              return (
                <View key={m.guestId} style={styles.playerRow}>
                  <View style={[styles.playerDot, { backgroundColor: "#2a2a4a" }]}>
                    <Text style={styles.playerDotIcon}>·</Text>
                  </View>
                  <Text style={[styles.playerName, styles.playerNamePending, isMe && { color: "#f59e0b", fontWeight: "800" }]}>
                    {isMe ? "You (still going)" : getMemberName(m.guestId)}
                  </Text>
                  <Text style={styles.playerStatusPending}>still going…</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Pulsing dots */}
        <View style={styles.pulseDotsRow}>
          {[0, 1, 2].map(i => <PulseDot key={i} delay={i * 280} accent={accent} />)}
        </View>

        {/* Rotating tip */}
        <Animated.View style={[styles.tipCard, { opacity: tipOp }]}>
          <Text style={styles.tipText}>{tips[tipIdx]}</Text>
        </Animated.View>
      </ScrollView>
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
  },
  inner: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 0,
  },

  glowOrb: {
    position: "absolute",
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: SW * 0.45,
    top: "15%",
    alignSelf: "center",
  },

  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1.5,
    alignSelf: "center",
    top: "18%",
  },
  ring1: { width: 200, height: 200 },
  ring2: { width: 260, height: 260 },

  gameNameBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  gameNameText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },

  badge: {
    width: 88, height: 88, borderRadius: 44,
    overflow: "hidden",
    borderWidth: 2,
    marginBottom: 16,
    shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
  },
  badgeGrad: {
    flex: 1, alignItems: "center", justifyContent: "center",
  },
  badgeEmoji: { fontSize: 42 },

  submittedBadge: {
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 16,
  },
  submittedBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 24,
  },

  barTrack: {
    width: SW * 0.65,
    height: 4,
    backgroundColor: "#1e1e3a",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
  countLabel: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 20,
  },

  // Player name list
  playerList: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 8,
    marginBottom: 20,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  playerDot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  playerDotIcon: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  playerName: {
    flex: 1,
    color: "rgba(255,255,255,0.80)",
    fontSize: 14,
    fontWeight: "600",
  },
  playerNamePending: {
    color: "rgba(255,255,255,0.35)",
  },
  playerStatus: {
    fontSize: 11,
    fontWeight: "700",
  },
  playerStatusPending: {
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    fontStyle: "italic",
  },

  pulseDotsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  pulseDot: {
    width: 9, height: 9, borderRadius: 5,
  },

  tipCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
    maxWidth: SW * 0.82,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  tipText: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 17,
  },
});
