import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

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

function DotsCanvas({ strokes, displayW, displayH, bg = "#0a0f1e" }: {
  strokes: string; displayW: number; displayH: number; bg?: string;
}) {
  const parsed = parseStrokes(strokes);
  if (!parsed || parsed.dots.length === 0) {
    return (
      <View style={{ width: displayW, height: displayH, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 28, opacity: 0.25 }}>✏️</Text>
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

export function RevealView() {
  const { state } = useRoom();
  const data = state.guestViewData as any;

  if (!data) return null;

  const prompt: string = data.prompt ?? "???";
  const myId = state.guestId;

  // Server sends: scores: Record<guestId, voteCount>, drawings: Record<guestId, strokesJson>
  const scores: Record<string, number> = data.scores ?? {};
  const drawings: Record<string, string> = data.drawings ?? {};

  // Build sorted entries from scores
  const entries = Object.entries(scores)
    .map(([guestId, votes]) => ({
      guestId,
      votes,
      playerNum: (state.members.findIndex(m => m.guestId === guestId) + 1) || 1,
      strokes: drawings[guestId] ?? "",
    }))
    .sort((a, b) => b.votes - a.votes);

  // Also include drawers with 0 votes
  Object.entries(drawings).forEach(([guestId, strokes]) => {
    if (!entries.find(e => e.guestId === guestId)) {
      entries.push({
        guestId,
        votes: 0,
        playerNum: (state.members.findIndex(m => m.guestId === guestId) + 1) || 1,
        strokes,
      });
    }
  });

  const winner = entries[0];

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
      <Text style={styles.eyebrow}>DRAWBACK · RESULTS</Text>

      <View style={styles.promptRevealCard}>
        <Text style={styles.promptRevealLabel}>The prompt was</Text>
        <Text style={styles.promptRevealText}>"{prompt}"</Text>
      </View>

      {winner && (
        <View style={styles.winnerSection}>
          <View style={styles.winnerHeader}>
            <Text style={styles.trophyEmoji}>🏆</Text>
            <View>
              <Text style={styles.winnerLabel}>BEST DRAWING</Text>
              <Text style={styles.winnerName}>
                {winner.guestId === myId
                  ? "Your drawing won!"
                  : `Player ${winner.playerNum}`}
              </Text>
            </View>
            <View style={styles.winnerVotes}>
              <Text style={styles.winnerVoteNum}>{winner.votes}</Text>
              <Text style={styles.winnerVoteLabel}>votes</Text>
            </View>
          </View>

          <View style={styles.winnerCanvas}>
            <DotsCanvas strokes={winner.strokes} displayW={300} displayH={200} bg="#0a0f1e" />
          </View>
        </View>
      )}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>ALL DRAWINGS</Text>
        <View style={styles.dividerLine} />
      </View>

      {entries.map((entry, i) => {
        const isWinner = i === 0;
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
            <View style={[styles.miniCanvas, isWinner && styles.miniCanvasWinner]}>
              <DotsCanvas strokes={entry.strokes} displayW={56} displayH={56} bg={isWinner ? "#0a1428" : "#0f0f24"} />
            </View>

            <View style={styles.entryInfo}>
              <Text style={styles.entryRank}>
                {rankLabel(i)} {isWinner && "👑"}
              </Text>
              <Text style={styles.entryPlayer}>
                {isMe ? "You" : `Player ${entry.playerNum}`}
                {isMe && <Text style={styles.meTag}> · you</Text>}
              </Text>
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
  container:          { padding: 20, paddingTop: 24 },
  eyebrow:            { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 16 },
  promptRevealCard: {
    backgroundColor: "#12122a", borderRadius: 16, borderWidth: 1,
    borderColor: "#1e1e3a", padding: 18, marginBottom: 20,
  },
  promptRevealLabel:  { color: "#888", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  promptRevealText:   { color: "#fff", fontSize: 20, fontWeight: "900", lineHeight: 26 },
  winnerSection: {
    backgroundColor: "#0d1a30", borderRadius: 20, borderWidth: 2,
    borderColor: ACCENT, overflow: "hidden", marginBottom: 24,
  },
  winnerHeader:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  trophyEmoji:        { fontSize: 32 },
  winnerLabel:        { color: ACCENT, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  winnerName:         { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 2 },
  winnerVotes:        { marginLeft: "auto", alignItems: "center" },
  winnerVoteNum:      { color: ACCENT, fontSize: 24, fontWeight: "900", lineHeight: 26 },
  winnerVoteLabel:    { color: "#888", fontSize: 10 },
  winnerCanvas:       { overflow: "hidden", alignItems: "center" },
  divider:            { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  dividerLine:        { flex: 1, height: 1, backgroundColor: "#1e1e3a" },
  dividerLabel:       { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  entryRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#12122a", borderRadius: 14, borderWidth: 1,
    borderColor: "#1e1e3a", padding: 12, marginBottom: 8,
  },
  entryRowWinner:     { borderColor: ACCENT, backgroundColor: "#0d1a30" },
  entryRowMe:         { borderColor: "#2a2a5a" },
  miniCanvas:         { borderRadius: 10, overflow: "hidden" },
  miniCanvasWinner:   {},
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
