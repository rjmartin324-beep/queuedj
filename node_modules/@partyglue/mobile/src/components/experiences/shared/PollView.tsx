import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";
import { socketManager } from "../../../lib/socket";

export function PollView() {
  const { state } = useRoom();
  const [voted, setVoted] = useState(false);
  const poll = (state as any).activePoll;

  if (!poll) return null;

  function vote(optionId: string) {
    if (voted || !state.room) return;
    const socket = socketManager.get();
    socket?.emit("poll:respond" as any, {
      roomId: state.room.id,
      pollId: poll.id,
      optionId,
    });
    setVoted(true);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>QUICK POLL</Text>
      <Text style={styles.question}>{poll.question}</Text>
      <View style={styles.options}>
        {poll.options?.map((opt: any) => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.option, voted && styles.optionVoted]}
            onPress={() => vote(opt.id)}
            disabled={voted}
          >
            <Text style={styles.emoji}>{opt.emoji}</Text>
            <Text style={styles.optionText}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {voted && <Text style={styles.thanks}>Vote counted!</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: "center", padding: 32, backgroundColor: "#0a0a0a" },
  label:      { fontSize: 10, color: "#6c47ff", fontWeight: "700", letterSpacing: 2, textAlign: "center", marginBottom: 16 },
  question:   { fontSize: 22, color: "#fff", fontWeight: "700", textAlign: "center", marginBottom: 32, lineHeight: 30 },
  options:    { gap: 12 },
  option:     { backgroundColor: "#111", borderRadius: 14, padding: 20, borderWidth: 1, borderColor: "#222", flexDirection: "row", alignItems: "center", gap: 12 },
  optionVoted: { opacity: 0.5 },
  emoji:      { fontSize: 24 },
  optionText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  thanks:     { color: "#6c47ff", textAlign: "center", marginTop: 24, fontWeight: "600" },
});
