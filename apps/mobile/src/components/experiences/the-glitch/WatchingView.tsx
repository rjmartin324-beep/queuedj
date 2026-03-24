import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// WatchingView — guest sees their prompt for a 5-second window
// The Glitch sees a DIFFERENT prompt (handled server-side)
// ─────────────────────────────────────────────────────────────────────────────

export function WatchingView() {
  const { state } = useRoom();
  const data        = state.guestViewData as any;
  const revealedAt  = data?.revealedAt  as number | undefined;
  const viewingMs   = data?.viewingMs   as number | undefined ?? 5000;
  const myPrompt    = data?.myPrompt    as { description: string; category: string } | undefined;

  const [timeLeft, setTimeLeft] = useState(Math.ceil(viewingMs / 1000));

  useEffect(() => {
    if (!revealedAt) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - revealedAt;
      const remaining = Math.max(0, Math.ceil((viewingMs - elapsed) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [revealedAt, viewingMs]);

  const urgency = timeLeft <= 2;

  return (
    <View style={styles.container}>
      <Text style={styles.category}>{myPrompt?.category ?? "CATEGORY"}</Text>
      <Text style={styles.title}>YOUR PROMPT</Text>
      <Text style={styles.description}>{myPrompt?.description}</Text>
      <Text style={[styles.timer, urgency && styles.timerUrgent]}>
        {timeLeft}s
      </Text>
      <Text style={styles.hint}>Memorize it — you'll describe this to the group.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, padding: 32, alignItems: "center", justifyContent: "center" },
  category:    { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 2, marginBottom: 16 },
  title:       { color: "#666", fontSize: 13, marginBottom: 12 },
  description: { color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center", lineHeight: 32, marginBottom: 32 },
  timer:       { fontSize: 64, fontWeight: "900", color: "#fff", marginBottom: 16 },
  timerUrgent: { color: "#ef4444" },
  hint:        { color: "#555", fontSize: 13, textAlign: "center" },
});
