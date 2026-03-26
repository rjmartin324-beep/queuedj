import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRoom } from "../../../contexts/RoomContext";
import type { CopyrightState, DrawingData, DrawingPath } from "@queuedj/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// ResultsView — shows vote tallies, winner's drawing, updated scores
// ─────────────────────────────────────────────────────────────────────────────

const PREVIEW_SIZE = 180;

function pathToD(p: DrawingPath): string {
  if (p.points.length === 0) return "";
  const [first, ...rest] = p.points;
  let d = `M ${first.x} ${first.y}`;
  for (const pt of rest) d += ` L ${pt.x} ${pt.y}`;
  return d;
}

export function CopyrightResultsView() {
  const { state } = useRoom();
  const gameState = state.guestViewData as CopyrightState | undefined;

  if (!gameState) return null;

  const { drawings, votes, scores, voteCategory, currentPrompt } = gameState;
  const myId = state.guestId;

  // Tally votes
  const voteCounts: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    voteCounts[target] = (voteCounts[target] ?? 0) + 1;
  }
  const sorted = Object.entries(drawings).sort(([a], [b]) => (voteCounts[b] ?? 0) - (voteCounts[a] ?? 0));
  const [winnerId, winnerDrawing] = sorted[0] ?? [];

  const categoryLabel = voteCategory === "nailed_it" ? "Most Nailed It" : "Most Likely to Be Sued";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>RESULTS</Text>
      <Text style={styles.prompt}>{currentPrompt?.name}</Text>
      <Text style={styles.category}>{categoryLabel} winner:</Text>

      {/* Winner drawing */}
      {winnerDrawing && (
        <View style={styles.winnerBox}>
          <Svg
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            viewBox={`0 0 ${winnerDrawing.width || 300} ${winnerDrawing.height || 300}`}
            style={styles.svg}
          >
            {winnerDrawing.paths.map((p, i) => (
              <Path key={i} d={pathToD(p)} stroke={p.color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
          <Text style={styles.winnerLabel}>
            {winnerId === myId ? "Your drawing!" : "Guest's drawing"}
          </Text>
        </View>
      )}

      {/* All drawings with vote count */}
      <Text style={styles.sectionLabel}>All drawings</Text>
      {sorted.map(([gId, drawing], i) => {
        const vCount = voteCounts[gId] ?? 0;
        const isMe = gId === myId;
        return (
          <View key={gId} style={[styles.row, i === 0 && styles.rowWinner]}>
            <Svg
              width={64}
              height={64}
              viewBox={`0 0 ${drawing.width || 300} ${drawing.height || 300}`}
              style={styles.thumbSvg}
            >
              {drawing.paths.map((p, pi) => (
                <Path key={pi} d={pathToD(p)} stroke={p.color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </Svg>
            <View style={styles.rowInfo}>
              <Text style={styles.rowGuest}>{isMe ? "You" : "Guest"}</Text>
              <Text style={styles.rowVotes}>{vCount} vote{vCount !== 1 ? "s" : ""}</Text>
              {scores[gId] !== undefined && (
                <Text style={styles.rowScore}>{scores[gId]} pts total</Text>
              )}
            </View>
            {i === 0 && <Text style={styles.crownTag}>WINNER</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { padding: 24, paddingBottom: 48 },
  eyebrow:     { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  prompt:      { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  category:    { color: "#888", fontSize: 13, marginBottom: 20 },
  winnerBox:   { alignItems: "center", marginBottom: 24 },
  svg:         { backgroundColor: "#1a1a1a", borderRadius: 12 },
  winnerLabel: { color: "#f59e0b", fontWeight: "700", marginTop: 8 },
  sectionLabel:{ color: "#555", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  row:         { flexDirection: "row", alignItems: "center", backgroundColor: "#1a1a1a", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#333", gap: 14 },
  rowWinner:   { borderColor: "#f59e0b" },
  thumbSvg:    { backgroundColor: "#111", borderRadius: 8 },
  rowInfo:     { flex: 1, gap: 2 },
  rowGuest:    { color: "#fff", fontSize: 14, fontWeight: "600" },
  rowVotes:    { color: "#888", fontSize: 12 },
  rowScore:    { color: "#6c47ff", fontSize: 12, fontWeight: "600" },
  crownTag:    { color: "#f59e0b", fontSize: 11, fontWeight: "700" },
});
