import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Geo Guesser — RevealView
// Reveals the actual location, shows each player's region guess with their
// points (exact = 100, adjacent = 50, wrong = 0). Fun travel-themed reveal.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#22c55e";

interface GuessEntry {
  guestId: string;
  region: string;
  points: number;
  isMe: boolean;
  playerNum: number;
}

const ADJACENT_REGIONS: Record<string, string[]> = {
  "North America":  ["South America", "Europe"],
  "South America":  ["North America", "Africa"],
  "Europe":         ["North America", "Africa", "Asia", "Middle East"],
  "Asia":           ["Europe", "Oceania", "Middle East"],
  "Africa":         ["Europe", "South America", "Middle East"],
  "Oceania":        ["Asia"],
  "Middle East":    ["Europe", "Asia", "Africa"],
};

const REGION_EMOJIS: Record<string, string> = {
  "North America": "🌎",
  "South America": "🌎",
  "Europe":        "🌍",
  "Asia":          "🌏",
  "Africa":        "🌍",
  "Oceania":       "🌏",
  "Middle East":   "🌍",
};

function pointsLabel(pts: number, region: string, actual: string): string {
  if (region === actual)       return "Exact match!";
  if (ADJACENT_REGIONS[actual]?.includes(region)) return "Adjacent region";
  return "Wrong region";
}

function pointsColor(pts: number): string {
  if (pts >= 100) return ACCENT;
  if (pts >= 50)  return "#f59e0b";
  return "#ef4444";
}

function pointsEmoji(pts: number): string {
  if (pts >= 100) return "🎯";
  if (pts >= 50)  return "📍";
  return "❌";
}

export function RevealView() {
  const { state } = useRoom();
  const data = state.guestViewData as any;

  if (!data) return null;

  const actualLocation: string = data.actualLocation ?? "Unknown";
  const actualRegion: string   = data.actualRegion ?? "";
  const clue: string           = data.clue ?? "";
  const guesses: GuessEntry[]  = data.guesses ?? [];
  const myId = state.guestId;

  const sorted = [...guesses].sort((a, b) => b.points - a.points);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={styles.eyebrow}>GEO GUESSER · REVEAL</Text>

      {/* Location reveal card */}
      <View style={styles.locationCard}>
        <View style={styles.locationTop}>
          <Text style={styles.globeEmoji}>🌍</Text>
          <View style={styles.locationTextBlock}>
            <Text style={styles.locationRevealLabel}>THE LOCATION WAS</Text>
            <Text style={styles.locationName}>{actualLocation}</Text>
            <View style={styles.regionPill}>
              <Text style={styles.regionPillText}>
                {REGION_EMOJIS[actualRegion] ?? "🗺️"}  {actualRegion}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.clueRow}>
          <Text style={styles.clueIcon}>🔍</Text>
          <Text style={styles.clueText}>{clue}</Text>
        </View>
      </View>

      {/* Scoring legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>🎯</Text>
          <Text style={styles.legendText}>Exact = 100 pts</Text>
        </View>
        <View style={styles.legendDivider} />
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>📍</Text>
          <Text style={styles.legendText}>Adjacent = 50 pts</Text>
        </View>
        <View style={styles.legendDivider} />
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>❌</Text>
          <Text style={styles.legendText}>Wrong = 0 pts</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>RESULTS</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Player guess rows */}
      {sorted.map((entry, i) => {
        const isMe = entry.isMe || entry.guestId === myId;
        const isExact = entry.region === actualRegion;
        const color = pointsColor(entry.points);
        const emoji = pointsEmoji(entry.points);

        return (
          <View
            key={entry.guestId}
            style={[
              styles.guessRow,
              isMe && styles.guessRowMe,
              isExact && styles.guessRowExact,
            ]}
          >
            {/* Rank */}
            <Text style={[styles.rank, { color: i === 0 ? ACCENT : "#555" }]}>
              #{i + 1}
            </Text>

            {/* Player info */}
            <View style={styles.guessInfo}>
              <Text style={styles.guestName}>
                {isMe ? "You" : `Player ${entry.playerNum}`}
              </Text>
              <View style={styles.regionGuessRow}>
                <Text style={styles.regionGuessEmoji}>
                  {REGION_EMOJIS[entry.region] ?? "🗺️"}
                </Text>
                <Text style={styles.regionGuessText}>{entry.region}</Text>
              </View>
              <Text style={[styles.guessResultLabel, { color }]}>
                {emoji}  {pointsLabel(entry.points, entry.region, actualRegion)}
              </Text>
            </View>

            {/* Points */}
            <View style={[styles.pointsBubble, { borderColor: color }]}>
              <Text style={[styles.pointsNum, { color }]}>+{entry.points}</Text>
              <Text style={styles.pointsLabel}>pts</Text>
            </View>
          </View>
        );
      })}

      {guesses.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No guesses were submitted.</Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: "#08081a" },
  container:          { padding: 20, paddingTop: 24 },

  eyebrow:            { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 16 },

  // Location card
  locationCard: {
    backgroundColor: "#12122a",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: ACCENT,
    padding: 20,
    marginBottom: 16,
    gap: 14,
  },
  locationTop:        { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  globeEmoji:         { fontSize: 42 },
  locationTextBlock:  { flex: 1, gap: 6 },
  locationRevealLabel:{ color: "#888", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  locationName:       { color: "#fff", fontSize: 22, fontWeight: "900", lineHeight: 26 },
  regionPill: {
    alignSelf: "flex-start",
    backgroundColor: ACCENT + "22",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: ACCENT + "55",
  },
  regionPillText:     { color: ACCENT, fontWeight: "700", fontSize: 13 },
  clueRow:            { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#0f0f20", borderRadius: 10, padding: 10 },
  clueIcon:           { fontSize: 16 },
  clueText:           { color: "#888", fontSize: 13, flex: 1, lineHeight: 18 },

  // Legend
  legendRow:          { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#12122a", borderRadius: 12, borderWidth: 1, borderColor: "#1e1e3a", padding: 12, marginBottom: 20, gap: 10 },
  legendItem:         { flexDirection: "row", alignItems: "center", gap: 5 },
  legendEmoji:        { fontSize: 14 },
  legendText:         { color: "#888", fontSize: 11, fontWeight: "600" },
  legendDivider:      { width: 1, height: 14, backgroundColor: "#1e1e3a" },

  // Divider
  divider:            { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  dividerLine:        { flex: 1, height: 1, backgroundColor: "#1e1e3a" },
  dividerLabel:       { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 2 },

  // Guess rows
  guessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#12122a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e1e3a",
    padding: 14,
    marginBottom: 8,
  },
  guessRowMe:         { borderColor: "#2a3a2a" },
  guessRowExact:      { borderColor: ACCENT, backgroundColor: "#0a1a0f" },
  rank:               { fontSize: 13, fontWeight: "800", minWidth: 28 },
  guessInfo:          { flex: 1, gap: 3 },
  guestName:          { color: "#fff", fontSize: 15, fontWeight: "700" },
  regionGuessRow:     { flexDirection: "row", alignItems: "center", gap: 5 },
  regionGuessEmoji:   { fontSize: 13 },
  regionGuessText:    { color: "#ccc", fontSize: 13, fontWeight: "600" },
  guessResultLabel:   { fontSize: 12, fontWeight: "700" },

  pointsBubble:       { alignItems: "center", borderWidth: 2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  pointsNum:          { fontSize: 20, fontWeight: "900", lineHeight: 22 },
  pointsLabel:        { color: "#888", fontSize: 10 },

  emptyState:         { alignItems: "center", paddingVertical: 40 },
  emptyText:          { color: "#555", fontSize: 15 },

  bottomSpacer:       { height: 32 },
});
