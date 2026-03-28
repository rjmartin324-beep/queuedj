import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from "react-native";
import { useRoom } from "../../../contexts/RoomContext";
import { WaitingForPlayersView } from "../shared/WaitingForPlayersView";

const ACCENT = "#3b82f6";

interface ParsedDrawing {
  dots: { x: number; y: number; color: string; size: number }[];
  width: number;
  height: number;
}

function parseStrokes(json: string): ParsedDrawing | null {
  try { return JSON.parse(json); }
  catch { return null; }
}

function DotsCanvas({ strokes, displayW, displayH, bg = "#0f0f24" }: {
  strokes: string; displayW: number; displayH: number; bg?: string;
}) {
  const parsed = parseStrokes(strokes);
  if (!parsed || parsed.dots.length === 0) {
    return (
      <View style={[{ width: displayW, height: displayH, backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ fontSize: 22, opacity: 0.3 }}>✏️</Text>
      </View>
    );
  }
  const sx = displayW / parsed.width;
  const sy = displayH / parsed.height;
  return (
    <View style={{ width: displayW, height: displayH, backgroundColor: bg, overflow: "hidden", position: "relative" }}>
      {parsed.dots.map((dot, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: dot.x * sx - (dot.size * sx) / 2,
            top: dot.y * sy - (dot.size * sy) / 2,
            width: Math.max(2, dot.size * sx),
            height: Math.max(2, dot.size * sy),
            borderRadius: Math.max(1, (dot.size * sx) / 2),
            backgroundColor: dot.color,
          }}
        />
      ))}
    </View>
  );
}

export function VotingView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any;
  const myId = state.guestId;

  // Server sends drawings as Record<guestId, strokesJson>
  const drawingsRecord: Record<string, string> = data?.drawings ?? {};
  const entries = Object.entries(drawingsRecord).map(([guestId, strokes]) => ({
    guestId,
    strokes,
    isMe: guestId === myId,
    playerNum: (state.members.findIndex(m => m.guestId === guestId) + 1) || undefined,
  }));

  const [voted, setVoted] = useState<string | null>(null);
  const hasVoted = voted !== null;

  if (hasVoted) {
    return (
      <WaitingForPlayersView
        emoji="🗳️"
        accent={ACCENT}
        gameName="Drawback"
        title="Vote Locked In!"
        subtitle="Waiting for everyone to cast their vote..."
        waitReason="votes"
        votedGuestIds={(state.experienceState as any)?.votedGuestIds}
        iSubmitted
        tips={[
          "Your vote is safe with us 🤫",
          "Someone is definitely voting strategically 🤔",
          "The winner is already nervous 😅",
          "Democracy at its finest 🗳️",
          "May the best drawing win! 🎨",
        ]}
      />
    );
  }

  function vote(guestId: string) {
    if (voted || guestId === myId) return;
    setVoted(guestId);
    sendAction("cast_vote", { targetGuestId: guestId });
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DRAWBACK</Text>
        <Text style={styles.title}>Vote for the best drawing!</Text>
        {hasVoted && (
          <View style={styles.votedBanner}>
            <Text style={styles.votedBannerText}>Vote locked in — waiting for reveal</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {entries.map((entry) => {
            const isVoted = voted === entry.guestId;
            const canVote = !hasVoted && !entry.isMe;

            return (
              <TouchableOpacity
                key={entry.guestId}
                style={[
                  styles.card,
                  isVoted && styles.cardVoted,
                  entry.isMe && styles.cardMe,
                ]}
                onPress={() => vote(entry.guestId)}
                disabled={!canVote}
                activeOpacity={canVote ? 0.7 : 1}
              >
                <View style={[styles.drawingBox, isVoted && styles.drawingBoxVoted]}>
                  <DotsCanvas strokes={entry.strokes} displayW={140} displayH={140} bg={isVoted ? "#0d1a30" : "#0f0f24"} />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.playerLabel}>
                    {entry.isMe ? "Your drawing" : `Player ${entry.playerNum ?? "?"}`}
                  </Text>
                  {entry.isMe && <Text style={styles.meBadge}>YOURS</Text>}
                  {isVoted && <Text style={styles.votedBadge}>✓ VOTED</Text>}
                  {!entry.isMe && !isVoted && !hasVoted && (
                    <Text style={styles.tapHint}>Tap to vote</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          {entries.length % 2 !== 0 && <View style={styles.cardSpacer} />}
        </View>

        {entries.length === 0 && (
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
  header:          { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 6 },
  eyebrow:         { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title:           { color: "#fff", fontSize: 22, fontWeight: "900" },
  votedBanner:     { marginTop: 8, backgroundColor: ACCENT + "22", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: ACCENT + "55" },
  votedBannerText: { color: ACCENT, fontWeight: "700", fontSize: 13 },
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
  drawingBox:      { height: 140, overflow: "hidden", backgroundColor: "#0f0f24" },
  drawingBoxVoted: { backgroundColor: "#0d1a30" },
  cardFooter:      { padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  playerLabel:     { color: "#888", fontSize: 12, fontWeight: "600", flex: 1 },
  meBadge:         { color: "#555", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  votedBadge:      { color: ACCENT, fontSize: 11, fontWeight: "800" },
  tapHint:         { color: "#444", fontSize: 10, fontWeight: "600" },
  emptyState:      { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyIcon:       { fontSize: 48 },
  emptyText:       { color: "#555", fontSize: 15, textAlign: "center" },
});
