import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Easing, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { socketManager } from "../../../lib/socket";
import { tapMedium, notifySuccess } from "../../../lib/haptics";

// ─────────────────────────────────────────────────────────────────────────────
// PollView — polished voting poll with animated result bars
// ─────────────────────────────────────────────────────────────────────────────

interface PollOption { id: string; label: string; emoji?: string; votes?: number; }
interface Poll       { id: string; question: string; options: PollOption[]; totalVotes?: number; }

function OptionBar({
  opt, voted, selected, totalVotes, onVote, index,
}: {
  opt:        PollOption;
  voted:      boolean;
  selected:   boolean;
  totalVotes: number;
  onVote:     () => void;
  index:      number;
}) {
  const widthAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;
  const opacAnim   = useRef(new Animated.Value(0)).current;

  const pct = totalVotes > 0 ? Math.round(((opt.votes ?? 0) / totalVotes) * 100) : 0;

  // Slide-in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, delay: index * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 250, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  // Bar fill when voted
  useEffect(() => {
    if (!voted) return;
    Animated.timing(widthAnim, {
      toValue: pct / 100,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [voted, pct]);

  const barWidth = widthAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  const ACCENT_COLORS = ["#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#9333ea"];
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <Animated.View
      style={[
        styles.optionWrapper,
        { transform: [{ translateY: slideAnim }], opacity: opacAnim },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.option,
          selected && { borderColor: accent, borderWidth: 2 },
        ]}
        onPress={onVote}
        disabled={voted}
        activeOpacity={0.7}
      >
        {/* Result bar (behind content) */}
        {voted && (
          <Animated.View
            style={[styles.resultBar, { width: barWidth, backgroundColor: accent + "33" }]}
          />
        )}

        <View style={styles.optionContent}>
          {opt.emoji ? (
            <Text style={styles.optionEmoji}>{opt.emoji}</Text>
          ) : null}
          <Text style={[styles.optionLabel, selected && { color: "#fff" }]}>
            {opt.label}
          </Text>
        </View>

        {voted && (
          <View style={styles.pctCol}>
            <Text style={[styles.pctText, { color: accent }]}>{pct}%</Text>
            {selected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function PollView() {
  const { state } = useRoom();
  const [voted, setVoted]       = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const poll = (state as any).activePoll as Poll | undefined;

  const titleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!poll) return;
    setVoted(false);
    setSelectedId(null);
    titleAnim.setValue(0);
    Animated.timing(titleAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [poll?.id]);

  if (!poll) return null;

  function vote(optionId: string) {
    if (voted || !state.room) return;
    tapMedium();
    setSelectedId(optionId);
    setVoted(true);
    notifySuccess();
    const socket = socketManager.getSocket();
    socket?.emit("poll:respond" as any, {
      roomId: state.room.id,
      pollId: poll!.id,
      optionId,
    });
  }

  const totalVotes = (poll.totalVotes ?? 0) + (voted ? 0 : 0);

  const titleOpacity = titleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const titleTransY  = titleAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });

  return (
    <LinearGradient colors={["#0a0a1a", "#0d0520"]} style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: titleOpacity, transform: [{ translateY: titleTransY }] }]}>
        <View style={styles.labelPill}>
          <Text style={styles.label}>QUICK POLL</Text>
        </View>
        <Text style={styles.question}>{poll.question}</Text>
        {voted && (
          <Text style={styles.totalVotes}>
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"} cast
          </Text>
        )}
      </Animated.View>

      {/* Options */}
      <View style={styles.options}>
        {poll.options?.map((opt, i) => (
          <OptionBar
            key={opt.id}
            opt={opt}
            voted={voted}
            selected={selectedId === opt.id}
            totalVotes={totalVotes}
            onVote={() => vote(opt.id)}
            index={i}
          />
        ))}
      </View>

      {voted && (
        <View style={styles.thanks}>
          <Text style={styles.thanksEmoji}>✓</Text>
          <Text style={styles.thanksText}>Your vote is in!</Text>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },

  header: { marginBottom: 32, alignItems: "center" },
  labelPill: {
    backgroundColor: "rgba(124,58,237,0.2)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
  },
  label: { color: "#a78bfa", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  question: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 30,
  },
  totalVotes: { color: "#6b7280", fontSize: 12, marginTop: 8 },

  options: { gap: 10 },

  optionWrapper: {},
  option: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  resultBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 16,
  },
  optionContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionEmoji: { fontSize: 26 },
  optionLabel: { color: "#d1d5db", fontSize: 18, fontWeight: "700" },

  pctCol: { alignItems: "flex-end", gap: 2 },
  pctText:   { fontSize: 16, fontWeight: "900" },
  checkmark: { color: "#22c55e", fontSize: 12, fontWeight: "900" },

  thanks: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  thanksEmoji: { fontSize: 20, color: "#22c55e" },
  thanksText:  { color: "#22c55e", fontWeight: "800", fontSize: 16 },
});
