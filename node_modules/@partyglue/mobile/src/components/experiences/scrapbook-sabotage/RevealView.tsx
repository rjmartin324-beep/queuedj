import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Scrapbook Sabotage — RevealView
// Shows the winner card at top with crown + their writing, then all entries
// with vote counts and authorship now fully revealed.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#a855f7";

interface Entry {
  guestId: string;
  text: string;
  votes: number;
  playerNum: number;
}

interface WinnerData {
  guestId: string;
  text: string;
  votes: number;
}

export function ScrapbookRevealView() {
  const { state } = useRoom();
  const data = state.guestViewData as any;

  if (!data) return null;

  const winner: WinnerData | undefined = data.winner;
  const entries: Entry[] = data.entries ?? [];
  const myId = state.guestId;

  const sorted = [...entries].sort((a, b) => b.votes - a.votes);

  function rankLabel(i: number) {
    if (i === 0) return "1st";
    if (i === 1) return "2nd";
    if (i === 2) return "3rd";
    return `${i + 1}th`;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={styles.eyebrow}>SCRAPBOOK SABOTAGE</Text>
      <Text style={styles.title}>The Verdict Is In</Text>

      {/* Winner card */}
      {winner && (
        <View style={styles.winnerCard}>
          <View style={styles.winnerHeader}>
            <Text style={styles.crown}>👑</Text>
            <View style={styles.winnerMeta}>
              <Text style={styles.winnerLabel}>WINNER</Text>
              <Text style={styles.winnerName}>
                {winner.guestId === myId ? "You!" : `Player ${entries.find(e => e.guestId === winner.guestId)?.playerNum ?? "?"}`}
              </Text>
            </View>
            <View style={styles.winnerVoteBubble}>
              <Text style={styles.winnerVoteNum}>{winner.votes}</Text>
              <Text style={styles.winnerVoteLabel}>votes</Text>
            </View>
          </View>
          <Text style={styles.winnerText}>{winner.text}</Text>
          <View style={styles.winnerGlow} />
        </View>
      )}

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ALL ENTRIES</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* All entries */}
      {sorted.map((entry, i) => {
        const isWinner = entry.guestId === winner?.guestId;
        const isMe = entry.guestId === myId;

        return (
          <View
            key={entry.guestId}
            style={[
              styles.entryCard,
              isWinner && styles.entryCardWinner,
              isMe && styles.entryCardMe,
            ]}
          >
            <View style={styles.entryTop}>
              <Text style={[styles.entryRank, isWinner && styles.entryRankWinner]}>
                {rankLabel(i)}
              </Text>
              <Text style={styles.entryPlayer}>
                {isMe ? "You" : `Player ${entry.playerNum}`}
                {isMe && <Text style={styles.meTag}> · your entry</Text>}
              </Text>
              <View style={[styles.voteBadge, isWinner && styles.voteBadgeWinner]}>
                <Text style={[styles.voteBadgeText, isWinner && styles.voteBadgeTextWinner]}>
                  {entry.votes} {entry.votes === 1 ? "vote" : "votes"}
                </Text>
              </View>
            </View>
            <Text style={styles.entryText}>{entry.text}</Text>
            {isWinner && <Text style={styles.winnerTag}>👑 WINNER</Text>}
          </View>
        );
      })}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: "#08081a" },
  container:        { padding: 20, paddingTop: 24 },

  eyebrow:          { color: ACCENT, fontSize: 11, fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  title:            { color: "#fff", fontSize: 26, fontWeight: "900", marginBottom: 24, lineHeight: 32 },

  // Winner card
  winnerCard: {
    backgroundColor: "#1e0f2e",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: ACCENT,
    padding: 20,
    marginBottom: 28,
    overflow: "hidden",
  },
  winnerHeader:     { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  crown:            { fontSize: 36 },
  winnerMeta:       { flex: 1 },
  winnerLabel:      { color: ACCENT, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 2 },
  winnerName:       { color: "#fff", fontSize: 18, fontWeight: "900" },
  winnerVoteBubble: { backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  winnerVoteNum:    { color: "#fff", fontSize: 20, fontWeight: "900", lineHeight: 22 },
  winnerVoteLabel:  { color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: "700" },
  winnerText:       { color: "#fff", fontSize: 17, lineHeight: 26, fontStyle: "italic" },
  winnerGlow:       { position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: ACCENT, opacity: 0.08 },

  // Divider
  divider:          { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  dividerLine:      { flex: 1, height: 1, backgroundColor: "#1e1e3a" },
  dividerText:      { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 2 },

  // Entry cards
  entryCard: {
    backgroundColor: "#12122a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e1e3a",
    padding: 16,
    marginBottom: 10,
    gap: 10,
  },
  entryCardWinner:  { borderColor: ACCENT, backgroundColor: "#1a0f28" },
  entryCardMe:      { borderColor: "#3a2a5a" },
  entryTop:         { flexDirection: "row", alignItems: "center", gap: 8 },
  entryRank:        { color: "#555", fontSize: 13, fontWeight: "700", minWidth: 28 },
  entryRankWinner:  { color: ACCENT },
  entryPlayer:      { flex: 1, color: "#ccc", fontSize: 13, fontWeight: "600" },
  meTag:            { color: "#888", fontWeight: "400" },
  voteBadge:        { backgroundColor: "#1e1e3a", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  voteBadgeWinner:  { backgroundColor: ACCENT },
  voteBadgeText:    { color: "#888", fontSize: 12, fontWeight: "700" },
  voteBadgeTextWinner: { color: "#fff" },
  entryText:        { color: "#fff", fontSize: 15, lineHeight: 22 },
  winnerTag:        { color: ACCENT, fontSize: 11, fontWeight: "800" },

  bottomSpacer:     { height: 32 },
});
