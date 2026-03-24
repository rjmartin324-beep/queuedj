import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// VotingView — anonymized responses shown, guests vote for funniest
// ─────────────────────────────────────────────────────────────────────────────

export function VotingView() {
  const { state, sendAction } = useRoom();
  const [voted, setVoted] = useState<string | null>(null);

  const responses = (state.guestViewData as any)?.responses as Array<{ id: string; text: string }> | undefined;
  const myId      = state.guestId;

  function vote(targetId: string) {
    if (voted || targetId === myId) return;
    setVoted(targetId);
    sendAction("submit_vote", { targetGuestId: targetId });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>VOTE FOR THE BEST</Text>
      <Text style={styles.title}>Which response is funniest?</Text>

      {(responses ?? []).map((r, i) => {
        const isMe    = r.id === myId;
        const isVoted = voted === r.id;

        return (
          <TouchableOpacity
            key={r.id}
            style={[
              styles.card,
              isVoted && styles.cardVoted,
              isMe    && styles.cardMe,
            ]}
            onPress={() => vote(r.id)}
            disabled={!!voted || isMe}
          >
            <Text style={styles.cardIndex}>{String.fromCharCode(65 + i)}</Text>
            <Text style={styles.cardText}>{r.text}</Text>
            {isMe   && <Text style={styles.cardTag}>Your response</Text>}
            {isVoted && <Text style={styles.votedTag}>Voted</Text>}
          </TouchableOpacity>
        );
      })}

      {voted && <Text style={styles.waiting}>Waiting for host to reveal results...</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  eyebrow:   { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  title:     { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 24 },
  card:      { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#333", gap: 8 },
  cardVoted: { borderColor: "#6c47ff", backgroundColor: "#1e1e2e" },
  cardMe:    { opacity: 0.5 },
  cardIndex: { color: "#6c47ff", fontWeight: "700", fontSize: 13 },
  cardText:  { color: "#fff", fontSize: 15, lineHeight: 22 },
  cardTag:   { color: "#555", fontSize: 11 },
  votedTag:  { color: "#6c47ff", fontSize: 11, fontWeight: "700" },
  waiting:   { color: "#555", textAlign: "center", marginTop: 24, fontSize: 14 },
});
