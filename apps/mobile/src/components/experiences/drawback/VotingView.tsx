import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Drawback — VotingView
// 2×2 grid of drawing cards. Tap to vote; can't vote your own.
// Drawings are shown as placeholder boxes with player numbers until real
// image data is available from the server.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#3b82f6";

interface DrawingEntry {
  guestId: string;
  isMe: boolean;
  playerNum?: number;
}

export function VotingView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any;
  const drawings: DrawingEntry[] = data?.drawings ?? [];
  const myId = state.guestId;

  const [voted, setVoted] = useState<string | null>(null);

  function vote(guestId: string) {
    if (voted || guestId === myId) return;
    setVoted(guestId);
    sendAction("vote_drawing", { winnerId: guestId });
  }

  const hasVoted = voted !== null;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DRAWBACK</Text>
        <Text style={styles.title}>Vote for the best drawing!</Text>
        {hasVoted && (
          <View style={styles.votedBanner}>
            <Text style={styles.votedBannerText}>Vote locked in — waiting for reveal</Text>
          </View>
        )}
      </View>

      {/* 2×2 Grid */}
      <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {drawings.map((entry) => {
            const isMe = entry.guestId === myId || entry.isMe;
            const isVoted = voted === entry.guestId;
            const canVote = !hasVoted && !isMe;

            return (
              <TouchableOpacity
                key={entry.guestId}
                style={[
                  styles.card,
                  isVoted && styles.cardVoted,
                  isMe && styles.cardMe,
                ]}
                onPress={() => vote(entry.guestId)}
                disabled={!canVote}
                activeOpacity={canVote ? 0.7 : 1}
              >
                {/* Drawing placeholder */}
                <View style={[styles.drawingBox, isVoted && styles.drawingBoxVoted]}>
                  <Text style={styles.drawingIcon}>✏️</Text>
                  <Text style={styles.playerNumLarge}>
                    {isMe ? "You" : `P${entry.playerNum ?? "?"}`}
                  </Text>
                </View>

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <Text style={styles.playerLabel}>
                    {isMe ? "Your drawing" : `Player ${entry.playerNum ?? "?"}`}
                  </Text>
                  {isMe && <Text style={styles.meBadge}>YOURS</Text>}
                  {isVoted && <Text style={styles.votedBadge}>✓ VOTED</Text>}
                  {!isMe && !isVoted && !hasVoted && (
                    <Text style={styles.tapHint}>Tap to vote</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Fill empty cells so the grid looks balanced */}
          {drawings.length % 2 !== 0 && <View style={styles.cardSpacer} />}
        </View>

        {drawings.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎨</Text>
            <Text style={styles.emptyText}>Waiting for drawings to roll in...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: "#08081a" },

  // Header
  header:          { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 6 },
  eyebrow:         { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title:           { color: "#fff", fontSize: 22, fontWeight: "900" },
  votedBanner:     { marginTop: 8, backgroundColor: ACCENT + "22", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: ACCENT + "55" },
  votedBannerText: { color: ACCENT, fontWeight: "700", fontSize: 13 },

  // Grid
  gridContainer:   { padding: 12, paddingBottom: 32 },
  grid:            { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  card: {
    width: "47%",
    backgroundColor: "#12122a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e1e3a",
    overflow: "hidden",
  },
  cardVoted:       { borderColor: ACCENT, borderWidth: 2 },
  cardMe:          { opacity: 0.45 },
  cardSpacer:      { width: "47%" },

  // Drawing area
  drawingBox:      { height: 140, alignItems: "center", justifyContent: "center", backgroundColor: "#0f0f24", gap: 8 },
  drawingBoxVoted: { backgroundColor: "#0d1a30" },
  drawingIcon:     { fontSize: 28 },
  playerNumLarge:  { color: "#2a2a5a", fontSize: 28, fontWeight: "900" },

  // Footer
  cardFooter:      { padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  playerLabel:     { color: "#888", fontSize: 12, fontWeight: "600", flex: 1 },
  meBadge:         { color: "#555", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  votedBadge:      { color: ACCENT, fontSize: 11, fontWeight: "800" },
  tapHint:         { color: "#444", fontSize: 10, fontWeight: "600" },

  // Empty state
  emptyState:      { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyIcon:       { fontSize: 48 },
  emptyText:       { color: "#555", fontSize: 15, textAlign: "center" },
});
