import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Drawback — RevealView
// Reveals the drawing prompt, showcases the winner's drawing (placeholder),
// then lists all entries with player names and vote counts.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#3b82f6";

interface RevealEntry {
  guestId: string;
  votes: number;
  playerNum: number;
}

interface WinnerData {
  guestId: string;
}

export function RevealView() {
  const { state } = useRoom();
  const data = state.guestViewData as any;

  if (!data) return null;

  const prompt: string = data.prompt ?? "???";
  const winner: WinnerData | undefined = data.winner;
  const entries: RevealEntry[] = data.entries ?? [];
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
      {/* Eyebrow + prompt reveal */}
      <Text style={styles.eyebrow}>DRAWBACK · RESULTS</Text>
      <View style={styles.promptRevealCard}>
        <Text style={styles.promptRevealLabel}>The prompt was</Text>
        <Text style={styles.promptRevealText}>"{prompt}"</Text>
      </View>

      {/* Winner showcase */}
      {winner && (
        <View style={styles.winnerSection}>
          <View style={styles.winnerHeader}>
            <Text style={styles.trophyEmoji}>🏆</Text>
            <View>
              <Text style={styles.winnerLabel}>BEST DRAWING</Text>
              <Text style={styles.winnerName}>
                {winner.guestId === myId
                  ? "Your drawing won!"
                  : `Player ${entries.find(e => e.guestId === winner.guestId)?.playerNum ?? "?"}`}
              </Text>
            </View>
            <View style={styles.winnerVotes}>
              <Text style={styles.winnerVoteNum}>
                {entries.find(e => e.guestId === winner.guestId)?.votes ?? 0}
              </Text>
              <Text style={styles.winnerVoteLabel}>votes</Text>
            </View>
          </View>

          {/* Winner drawing placeholder */}
          <View style={styles.winnerCanvas}>
            <Text style={styles.winnerCanvasIcon}>✏️</Text>
            <Text style={styles.winnerCanvasText}>
              {winner.guestId === myId ? "Your Masterpiece" : `Player ${entries.find(e => e.guestId === winner.guestId)?.playerNum ?? "?"}'s Drawing`}
            </Text>
          </View>
        </View>
      )}

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>ALL DRAWINGS</Text>
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
              styles.entryRow,
              isWinner && styles.entryRowWinner,
              isMe && styles.entryRowMe,
            ]}
          >
            {/* Mini drawing placeholder */}
            <View style={[styles.miniCanvas, isWinner && styles.miniCanvasWinner]}>
              <Text style={styles.miniCanvasIcon}>✏️</Text>
              <Text style={styles.miniPlayerNum}>P{entry.playerNum}</Text>
            </View>

            {/* Info */}
            <View style={styles.entryInfo}>
              <Text style={styles.entryRank}>
                {rankLabel(i)} {isWinner && "👑"}
              </Text>
              <Text style={styles.entryPlayer}>
                {isMe ? "You" : `Player ${entry.playerNum}`}
                {isMe && <Text style={styles.meTag}> · you</Text>}
              </Text>
            </View>

            {/* Votes */}
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
  container:          { padding: 20, paddingTop: 24 },

  // Header
  eyebrow:            { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 16 },

  // Prompt reveal
  promptRevealCard: {
    backgroundColor: "#12122a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e1e3a",
    padding: 18,
    marginBottom: 20,
  },
  promptRevealLabel:  { color: "#888", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  promptRevealText:   { color: "#fff", fontSize: 20, fontWeight: "900", lineHeight: 26 },

  // Winner section
  winnerSection: {
    backgroundColor: "#0d1a30",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: ACCENT,
    overflow: "hidden",
    marginBottom: 24,
  },
  winnerHeader:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  trophyEmoji:        { fontSize: 32 },
  winnerLabel:        { color: ACCENT, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  winnerName:         { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 2 },
  winnerVotes:        { marginLeft: "auto", alignItems: "center" },
  winnerVoteNum:      { color: ACCENT, fontSize: 24, fontWeight: "900", lineHeight: 26 },
  winnerVoteLabel:    { color: "#888", fontSize: 10 },
  winnerCanvas:       { height: 160, backgroundColor: "#0a0f1e", alignItems: "center", justifyContent: "center", gap: 8 },
  winnerCanvasIcon:   { fontSize: 36 },
  winnerCanvasText:   { color: "#2a3a5a", fontSize: 14, fontWeight: "700" },

  // Divider
  divider:            { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  dividerLine:        { flex: 1, height: 1, backgroundColor: "#1e1e3a" },
  dividerLabel:       { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 2 },

  // Entry rows
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#12122a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e1e3a",
    padding: 12,
    marginBottom: 8,
  },
  entryRowWinner:     { borderColor: ACCENT, backgroundColor: "#0d1a30" },
  entryRowMe:         { borderColor: "#2a2a5a" },
  miniCanvas:         { width: 56, height: 56, backgroundColor: "#0f0f24", borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 2 },
  miniCanvasWinner:   { backgroundColor: "#0a1428" },
  miniCanvasIcon:     { fontSize: 18 },
  miniPlayerNum:      { color: "#2a2a5a", fontSize: 11, fontWeight: "900" },
  entryInfo:          { flex: 1, gap: 3 },
  entryRank:          { color: "#888", fontSize: 12, fontWeight: "700" },
  entryPlayer:        { color: "#fff", fontSize: 15, fontWeight: "700" },
  meTag:              { color: "#888", fontWeight: "400" },
  votePill:           { backgroundColor: "#1e1e3a", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  votePillWinner:     { backgroundColor: ACCENT },
  votePillText:       { color: "#888", fontSize: 12, fontWeight: "700" },
  votePillTextWinner: { color: "#fff" },

  bottomSpacer:       { height: 32 },
});
