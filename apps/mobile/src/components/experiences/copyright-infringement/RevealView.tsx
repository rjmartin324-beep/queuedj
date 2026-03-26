import React from "react";
import { View, Text, Image, StyleSheet, ScrollView } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRoom } from "../../../contexts/RoomContext";
import type { CopyrightState, DrawingData, DrawingPath } from "@queuedj/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// RevealView — shown after a round ends; displays the prompt name, the winner's
// drawing, and (if the prompt carries an imageUrl) the real reference image so
// players can compare their art against the original.
// ─────────────────────────────────────────────────────────────────────────────

const PREVIEW_SIZE = 180;

function pathToD(p: DrawingPath): string {
  if (p.points.length === 0) return "";
  const [first, ...rest] = p.points;
  let d = `M ${first.x} ${first.y}`;
  for (const pt of rest) d += ` L ${pt.x} ${pt.y}`;
  return d;
}

export function CopyrightRevealView() {
  const { state } = useRoom();
  const gameState = state.guestViewData as CopyrightState | undefined;

  if (!gameState) return null;

  const { drawings, votes, currentPrompt, voteCategory } = gameState;
  const myId = state.guestId;

  // Tally votes to find winner
  const voteCounts: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    voteCounts[target] = (voteCounts[target] ?? 0) + 1;
  }
  const sorted = Object.entries(drawings ?? {}).sort(
    ([a], [b]) => (voteCounts[b] ?? 0) - (voteCounts[a] ?? 0),
  );
  const [winnerId, winnerDrawing] = sorted[0] ?? [];

  const categoryLabel =
    voteCategory === "nailed_it" ? "Most Nailed It" : "Most Likely to Be Sued";

  // The reference image URL lives on the prompt object (optional field added in Phase 2)
  const referenceImageUrl = currentPrompt?.imageUrl;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>REVEAL</Text>
      <Text style={styles.promptName}>{currentPrompt?.name}</Text>
      <Text style={styles.categoryLabel}>{categoryLabel} winner:</Text>

      {/* Winner's drawing */}
      {winnerDrawing && (
        <View style={styles.winnerBox}>
          <Svg
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            viewBox={`0 0 ${(winnerDrawing as DrawingData).width || 300} ${(winnerDrawing as DrawingData).height || 300}`}
            style={styles.svg}
          >
            {(winnerDrawing as DrawingData).paths.map((p, i) => (
              <Path
                key={i}
                d={pathToD(p)}
                stroke={p.color}
                strokeWidth={p.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
          <Text style={styles.winnerLabel}>
            {winnerId === myId ? "Your drawing!" : "Guest's drawing"}
          </Text>
        </View>
      )}

      {/* Reference image — only shown when the prompt carries an imageUrl */}
      {referenceImageUrl ? (
        <View style={styles.referenceSection}>
          <Text style={styles.referenceSectionTitle}>The Real Thing</Text>
          <View style={styles.referenceImageWrapper}>
            <Image
              source={{ uri: referenceImageUrl }}
              style={styles.referenceImage}
              resizeMode="contain"
              accessibilityLabel={`Reference image for ${currentPrompt?.name}`}
            />
          </View>
          <Text style={styles.referenceCaption}>{currentPrompt?.name}</Text>
        </View>
      ) : null}

      {/* Hint if available */}
      {currentPrompt?.hint ? (
        <Text style={styles.hint}>Hint: {currentPrompt.hint}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:             { padding: 24, paddingBottom: 48 },
  eyebrow:               { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  promptName:            { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  categoryLabel:         { color: "#888", fontSize: 13, marginBottom: 20 },
  winnerBox:             { alignItems: "center", marginBottom: 28 },
  svg:                   { backgroundColor: "#1a1a1a", borderRadius: 12 },
  winnerLabel:           { color: "#f59e0b", fontWeight: "700", marginTop: 8, fontSize: 14 },
  // ── reference image section ──────────────────────────────────────────────
  referenceSection:      { marginTop: 8, marginBottom: 20 },
  referenceSectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 12, letterSpacing: 0.5 },
  referenceImageWrapper: {
    width: "100%",
    height: 200,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  referenceImage:        { width: "100%", height: 200 },
  referenceCaption:      { color: "#555", fontSize: 12, textAlign: "center", marginTop: 8 },
  hint:                  { color: "#888", fontSize: 13, textAlign: "center", marginTop: 4, fontStyle: "italic" },
});
