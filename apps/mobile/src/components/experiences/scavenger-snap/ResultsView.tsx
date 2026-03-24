import React from "react";
import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Scavenger Snap — ResultsView
// Winner's photo displayed large at the top, then challenge text and full
// leaderboard with vote counts.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#10b981";

interface WinnerData {
  guestId: string;
  photoUri: string;
  playerNum: number;
}

interface ResultEntry {
  guestId: string;
  votes: number;
  playerNum: number;
}

export function ResultsView() {
  const { state } = useRoom();
  const data = state.guestViewData as any;

  if (!data) return null;

  const challenge: string = data.challenge ?? "";
  const winner: WinnerData | undefined = data.winner;
  const entries: ResultEntry[] = data.entries ?? [];
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
      {/* Winner photo — displayed large */}
      {winner && (
        <View style={styles.winnerPhotoSection}>
          {winner.photoUri ? (
            <Image source={{ uri: winner.photoUri }} style={styles.winnerPhoto} />
          ) : (
            <View style={styles.winnerPhotoPlaceholder}>
              <Text style={styles.placeholderIcon}>📷</Text>
            </View>
          )}

          {/* Trophy overlay */}
          <View style={styles.trophyOverlay}>
            <Text style={styles.trophyEmoji}>🏆</Text>
            <View style={styles.trophyTextBlock}>
              <Text style={styles.trophyWinner}>WINNER!</Text>
              <Text style={styles.trophyPlayerName}>
                {winner.guestId === myId ? "You!" : `Player ${winner.playerNum}`}
              </Text>
            </View>
            <View style={styles.trophyVotes}>
              <Text style={styles.trophyVoteNum}>
                {entries.find(e => e.guestId === winner.guestId)?.votes ?? 0}
              </Text>
              <Text style={styles.trophyVoteLabel}>votes</Text>
            </View>
          </View>
        </View>
      )}

      {/* Challenge text */}
      <View style={styles.challengeCard}>
        <Text style={styles.challengeLabel}>THE CHALLENGE WAS</Text>
        <Text style={styles.challengeText}>{challenge}</Text>
      </View>

      {/* Leaderboard */}
      <Text style={styles.leaderboardHeader}>LEADERBOARD</Text>

      {sorted.map((entry, i) => {
        const isWinner = entry.guestId === winner?.guestId;
        const isMe = entry.guestId === myId;

        return (
          <View
            key={entry.guestId}
            style={[
              styles.entryRow,
              isWinner && styles.entryRowWinner,
              isMe && styles.entryRowMe,
            ]}
          >
            <Text style={[styles.rankNum, isWinner && styles.rankNumWinner]}>
              {rankLabel(i)}
            </Text>

            <View style={styles.entryInfo}>
              <Text style={styles.entryPlayer}>
                {isMe ? "You" : `Player ${entry.playerNum}`}
              </Text>
              {isWinner && <Text style={styles.winnerTag}>Winner</Text>}
            </View>

            <View style={[styles.votePill, isWinner && styles.votePillWinner]}>
              <Text style={[styles.votePillText, isWinner && styles.votePillTextWinner]}>
                {entry.votes} {entry.votes === 1 ? "vote" : "votes"}
              </Text>
            </View>
          </View>
        );
      })}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: "#08081a" },
  container:          { paddingBottom: 48 },

  // Winner photo
  winnerPhotoSection: { position: "relative", width: "100%", height: 300 },
  winnerPhoto:        { width: "100%", height: 300, backgroundColor: "#12122a" },
  winnerPhotoPlaceholder: {
    width: "100%",
    height: 300,
    backgroundColor: "#0f1a14",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderIcon:    { fontSize: 64 },

  trophyOverlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(8,8,26,0.85)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: 2,
    borderTopColor: ACCENT,
  },
  trophyEmoji:        { fontSize: 32 },
  trophyTextBlock:    { flex: 1 },
  trophyWinner:       { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  trophyPlayerName:   { color: "#fff", fontSize: 18, fontWeight: "900" },
  trophyVotes:        { alignItems: "center" },
  trophyVoteNum:      { color: ACCENT, fontSize: 26, fontWeight: "900", lineHeight: 28 },
  trophyVoteLabel:    { color: "#888", fontSize: 10 },

  // Challenge card
  challengeCard: {
    margin: 16,
    backgroundColor: "#12122a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e1e3a",
    padding: 16,
    gap: 6,
  },
  challengeLabel:     { color: "#888", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  challengeText:      { color: "#fff", fontSize: 18, fontWeight: "800", lineHeight: 24 },

  // Leaderboard
  leaderboardHeader:  { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2, paddingHorizontal: 20, marginBottom: 10 },

  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#12122a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e1e3a",
    padding: 14,
  },
  entryRowWinner:     { borderColor: ACCENT, backgroundColor: "#0a1a12" },
  entryRowMe:         { borderColor: "#1e2e1e" },
  rankNum:            { color: "#555", fontSize: 14, fontWeight: "800", minWidth: 32 },
  rankNumWinner:      { color: ACCENT },
  entryInfo:          { flex: 1, gap: 2 },
  entryPlayer:        { color: "#fff", fontSize: 15, fontWeight: "700" },
  winnerTag:          { color: ACCENT, fontSize: 11, fontWeight: "700" },
  votePill:           { backgroundColor: "#1e1e3a", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  votePillWinner:     { backgroundColor: ACCENT },
  votePillText:       { color: "#888", fontSize: 12, fontWeight: "700" },
  votePillTextWinner: { color: "#fff" },

  bottomSpacer:       { height: 32 },
});
