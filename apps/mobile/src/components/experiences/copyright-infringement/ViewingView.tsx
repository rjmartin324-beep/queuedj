import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// ViewingView — guests see the prompt name/description for 3 seconds
// After that, the drawing phase begins automatically
// ─────────────────────────────────────────────────────────────────────────────

export function ViewingView() {
  const { state } = useRoom();
  const data       = state.guestViewData as any;
  const prompt     = data?.prompt as { name: string; description?: string; category?: string } | undefined;
  const revealedAt = data?.revealedAt as number | undefined;
  const viewMs     = data?.viewMs     as number ?? 3000;

  const [timeLeft, setTimeLeft] = useState(Math.ceil(viewMs / 1000));

  useEffect(() => {
    if (!revealedAt) return;
    const interval = setInterval(() => {
      const elapsed   = Date.now() - revealedAt;
      const remaining = Math.max(0, Math.ceil((viewMs - elapsed) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [revealedAt, viewMs]);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{prompt?.category ?? "DRAW THIS"}</Text>
      <Text style={styles.name}>{prompt?.name}</Text>
      {prompt?.description && (
        <Text style={styles.description}>{prompt.description}</Text>
      )}
      <Text style={[styles.timer, timeLeft <= 1 && styles.timerUrgent]}>{timeLeft}</Text>
      <Text style={styles.hint}>Drawing begins in {timeLeft}s — memorize it!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  eyebrow:     { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 2, marginBottom: 16 },
  name:        { color: "#fff", fontSize: 36, fontWeight: "900", textAlign: "center", marginBottom: 12 },
  description: { color: "#aaa", fontSize: 15, textAlign: "center", marginBottom: 32, lineHeight: 22 },
  timer:       { fontSize: 80, fontWeight: "900", color: "#fff", lineHeight: 88 },
  timerUrgent: { color: "#ef4444" },
  hint:        { color: "#555", fontSize: 13, marginTop: 16, textAlign: "center" },
});
