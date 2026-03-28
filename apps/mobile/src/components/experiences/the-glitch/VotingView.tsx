import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";
import { WaitingForPlayersView } from "../shared/WaitingForPlayersView";

// ─────────────────────────────────────────────────────────────────────────────
// VotingView — all descriptions shown, vote for who you think is The Glitch
// ─────────────────────────────────────────────────────────────────────────────

export function GlitchVotingView() {
  const { state, sendAction } = useRoom();
  const [voted, setVoted] = useState<string | null>(null);

  const descriptions = (state.guestViewData as any)?.descriptions as Record<string, string> | undefined;
  const myId = state.guestId;

  function accuse(targetId: string) {
    if (voted || targetId === myId) return;
    setVoted(targetId);
    sendAction("submit_vote", { accusedGuestId: targetId });
  }

  const entries = Object.entries(descriptions ?? {});

  if (voted) {
    return (
      <WaitingForPlayersView
        emoji="🕵️"
        accent="#ef4444"
        gameName="The Glitch"
        title="Accused!"
        subtitle="Waiting for everyone to cast their accusation..."
        waitReason="votes"
        votedGuestIds={(state.experienceState as any)?.votedGuestIds}
        iSubmitted
        tips={[
          "The Glitch is sweating right now 😰",
          "Trust no one. Not even yourself. 👀",
          "Majority rules in this game 🗳️",
          "Justice will be served... probably 🔍",
          "May the real Glitch be found! 📺",
        ]}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>FIND THE GLITCH</Text>
      <Text style={styles.title}>Who described something different?</Text>
      <Text style={styles.hint}>One player saw a completely different prompt.</Text>

      {entries.map(([gId, text], i) => {
        const isMe    = gId === myId;
        const isVoted = voted === gId;

        return (
          <TouchableOpacity
            key={gId}
            style={[styles.card, isVoted && styles.cardAccused, isMe && styles.cardMe]}
            onPress={() => accuse(gId)}
            disabled={!!voted || isMe}
          >
            <Text style={styles.cardIndex}>{String.fromCharCode(65 + i)}</Text>
            <Text style={styles.cardText}>{text}</Text>
            {isMe && <Text style={styles.meTag}>Your description</Text>}
            {isVoted && <Text style={styles.accuseTag}>ACCUSED</Text>}
          </TouchableOpacity>
        );
      })}

      {voted && <Text style={styles.waiting}>Waiting for host to reveal...</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { padding: 24, paddingBottom: 48 },
  eyebrow:     { color: "#ef4444", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  title:       { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 6 },
  hint:        { color: "#888", fontSize: 13, marginBottom: 24 },
  card:        { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#333", gap: 6 },
  cardAccused: { borderColor: "#ef4444", backgroundColor: "#1e0e0e" },
  cardMe:      { opacity: 0.5 },
  cardIndex:   { color: "#ef4444", fontWeight: "700", fontSize: 13 },
  cardText:    { color: "#fff", fontSize: 15, lineHeight: 22 },
  meTag:       { color: "#555", fontSize: 11 },
  accuseTag:   { color: "#ef4444", fontSize: 11, fontWeight: "700" },
  waiting:     { color: "#555", textAlign: "center", marginTop: 16, fontSize: 14 },
});
