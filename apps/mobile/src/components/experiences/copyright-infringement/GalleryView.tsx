import React, { useState } from "react";
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRoom } from "../../../contexts/RoomContext";
import type { CopyrightState, DrawingData, DrawingPath } from "@queuedj/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// GalleryView — see all drawings, vote for best/worst depending on category
// ─────────────────────────────────────────────────────────────────────────────

const CARD_SIZE = (Dimensions.get("window").width - 48 - 12) / 2;

function pathToD(p: DrawingPath): string {
  if (p.points.length === 0) return "";
  const [first, ...rest] = p.points;
  let d = `M ${first.x} ${first.y}`;
  for (const pt of rest) d += ` L ${pt.x} ${pt.y}`;
  return d;
}

export function GalleryView() {
  const { state, sendAction } = useRoom();
  const [voted, setVoted] = useState<string | null>(null);

  const data           = state.guestViewData as CopyrightState | undefined;
  const drawings       = data?.drawings     as Record<string, DrawingData> | undefined;
  const voteCategory   = data?.voteCategory as "most_sued" | "nailed_it" | undefined;
  const currentPrompt  = data?.currentPrompt;
  const myId           = state.guestId;

  function vote(targetId: string) {
    if (voted || targetId === myId) return;
    setVoted(targetId);
    sendAction("submit_vote", { targetGuestId: targetId });
  }

  const label = voteCategory === "nailed_it" ? "Vote: Best Recreation" : "Vote: Most Likely to Be Sued";
  const emoji = voteCategory === "nailed_it" ? "🎨" : "⚖️";

  const entries = Object.entries(drawings ?? {});

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>GALLERY {emoji}</Text>

      {/* Prompt header — shows name + reference thumbnail if imageUrl is available */}
      <View style={styles.promptRow}>
        {currentPrompt?.imageUrl ? (
          <Image
            source={{ uri: currentPrompt.imageUrl }}
            style={styles.promptThumb}
            resizeMode="contain"
            accessibilityLabel={`Reference thumbnail for ${currentPrompt.name}`}
          />
        ) : null}
        <Text style={styles.label}>{label}</Text>
      </View>

      <View style={styles.grid}>
        {entries.map(([gId, drawing]) => {
          const isMe    = gId === myId;
          const isVoted = voted === gId;

          return (
            <TouchableOpacity
              key={gId}
              style={[styles.card, isVoted && styles.cardVoted, isMe && styles.cardMe]}
              onPress={() => vote(gId)}
              disabled={!!voted || isMe}
            >
              <View style={styles.svgContainer}>
                <Svg
                  width={CARD_SIZE - 16}
                  height={CARD_SIZE - 16}
                  viewBox={`0 0 ${drawing.width || 300} ${drawing.height || 300}`}
                  style={{ backgroundColor: "#1a1a1a" }}
                >
                  {drawing.paths.map((p, i) => (
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
              </View>
              {isMe    && <Text style={styles.meTag}>Your drawing</Text>}
              {isVoted && <Text style={styles.votedTag}>Voted!</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {voted && <Text style={styles.waiting}>Waiting for host to reveal results...</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { padding: 24, paddingBottom: 48 },
  eyebrow:      { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  promptRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  promptThumb:  { width: 60, height: 60, borderRadius: 8, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#333" },
  label:        { color: "#fff", fontSize: 16, fontWeight: "700", flex: 1 },
  grid:         { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card:         { width: CARD_SIZE, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: "#333", backgroundColor: "#111" },
  cardVoted:    { borderColor: "#6c47ff" },
  cardMe:       { opacity: 0.6 },
  svgContainer: { padding: 8 },
  meTag:        { color: "#888", fontSize: 11, textAlign: "center", paddingBottom: 6 },
  votedTag:     { color: "#6c47ff", fontSize: 11, fontWeight: "700", textAlign: "center", paddingBottom: 6 },
  waiting:      { color: "#555", textAlign: "center", marginTop: 24, fontSize: 14 },
});
