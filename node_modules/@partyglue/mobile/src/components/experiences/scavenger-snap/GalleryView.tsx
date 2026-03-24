import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, Image, ScrollView, StyleSheet,
} from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Scavenger Snap — GalleryView
// Scrollable grid of submitted photos. Each card shows the photo (or a green
// placeholder), a player number badge, and a vote button.
// You cannot vote for your own photo.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#10b981";

interface SnapEntry {
  guestId: string;
  photoUri: string;
  isMe: boolean;
  playerNum?: number;
}

export function GalleryView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any;
  const snaps: SnapEntry[] = data?.snaps ?? [];
  const myId = state.guestId;

  const [voted, setVoted] = useState<string | null>(null);

  function vote(guestId: string) {
    if (voted || guestId === myId) return;
    setVoted(guestId);
    sendAction("vote_snap", { winnerId: guestId });
  }

  const hasVoted = voted !== null;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SCAVENGER SNAP</Text>
        <Text style={styles.title}>Vote for the best snap!</Text>
        {hasVoted && (
          <View style={styles.votedBanner}>
            <Text style={styles.votedBannerText}>✓ Vote locked in — waiting for the reveal</Text>
          </View>
        )}
      </View>

      {/* Photo grid */}
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {snaps.map((snap) => {
          const isMe = snap.isMe || snap.guestId === myId;
          const isVoted = voted === snap.guestId;
          const canVote = !hasVoted && !isMe;
          const hasPhoto = !!snap.photoUri;

          return (
            <TouchableOpacity
              key={snap.guestId}
              style={[
                styles.card,
                isVoted && styles.cardVoted,
                isMe && styles.cardMe,
              ]}
              onPress={() => vote(snap.guestId)}
              disabled={!canVote}
              activeOpacity={canVote ? 0.75 : 1}
            >
              {/* Photo or placeholder */}
              {hasPhoto ? (
                <Image source={{ uri: snap.photoUri }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.placeholderIcon}>📷</Text>
                  <Text style={styles.placeholderText}>No photo</Text>
                </View>
              )}

              {/* Player badge */}
              <View style={[styles.playerBadge, isVoted && styles.playerBadgeVoted]}>
                <Text style={[styles.playerBadgeText, isVoted && styles.playerBadgeTextVoted]}>
                  {isMe ? "YOU" : `P${snap.playerNum ?? "?"}`}
                </Text>
              </View>

              {/* Vote overlay if voted for this */}
              {isVoted && (
                <View style={styles.votedOverlay}>
                  <Text style={styles.votedOverlayText}>✓</Text>
                </View>
              )}

              {/* Vote button (only visible when not yet voted, not own) */}
              {canVote && (
                <View style={styles.voteBtn}>
                  <Text style={styles.voteBtnText}>Tap to Vote</Text>
                </View>
              )}

              {isMe && (
                <View style={styles.ownLabel}>
                  <Text style={styles.ownLabelText}>Your snap</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {snaps.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={styles.emptyText}>Waiting for snaps to come in...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:                  { flex: 1, backgroundColor: "#08081a" },

  // Header
  header:                { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 6 },
  eyebrow:               { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title:                 { color: "#fff", fontSize: 22, fontWeight: "900" },
  votedBanner:           { marginTop: 8, backgroundColor: ACCENT + "22", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: ACCENT + "55" },
  votedBannerText:       { color: ACCENT, fontWeight: "700", fontSize: 13 },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingBottom: 36,
    gap: 12,
  },

  // Photo card
  card: {
    width: "47%",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#1e1e3a",
    backgroundColor: "#12122a",
    position: "relative",
  },
  cardVoted:             { borderColor: ACCENT, borderWidth: 3 },
  cardMe:                { opacity: 0.5 },
  photo:                 { width: "100%", height: 160, backgroundColor: "#1a1a3a" },
  photoPlaceholder:      { width: "100%", height: 160, backgroundColor: "#0f1a14", alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderIcon:       { fontSize: 32 },
  placeholderText:       { color: "#2a5a3a", fontSize: 13, fontWeight: "600" },

  // Player badge (top-left overlay)
  playerBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(8,8,26,0.85)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#1e1e3a",
  },
  playerBadgeVoted:      { backgroundColor: ACCENT, borderColor: ACCENT },
  playerBadgeText:       { color: "#fff", fontSize: 11, fontWeight: "800" },
  playerBadgeTextVoted:  { color: "#fff" },

  // Voted overlay (checkmark)
  votedOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: ACCENT + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  votedOverlayText:      { color: "#fff", fontSize: 48, fontWeight: "900" },

  // Vote button (bottom)
  voteBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 8,
    alignItems: "center",
  },
  voteBtnText:           { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },

  // Own label
  ownLabel: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 7,
    alignItems: "center",
  },
  ownLabelText:          { color: "#888", fontWeight: "700", fontSize: 12 },

  // Empty state
  emptyState:            { width: "100%", alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIcon:             { fontSize: 48 },
  emptyText:             { color: "#555", fontSize: 15, textAlign: "center" },
});
