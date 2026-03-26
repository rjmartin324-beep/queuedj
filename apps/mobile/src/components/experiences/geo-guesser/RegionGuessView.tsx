import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { WaitingForPlayersView } from "../shared/WaitingForPlayersView";

// ─────────────────────────────────────────────────────────────────────────────
// Geo Guesser — RegionGuessView
// Shows the clue photo + a grid of region buttons instead of a map.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#22c55e";
const TIMER_TOTAL = 30;

const ALL_REGIONS = [
  { label: "Africa",        emoji: "🌍" },
  { label: "Asia",          emoji: "🌏" },
  { label: "Europe",        emoji: "🏰" },
  { label: "North America", emoji: "🗽" },
  { label: "South America", emoji: "🌎" },
  { label: "Oceania",       emoji: "🦘" },
  { label: "Middle East",   emoji: "🕌" },
];

export function RegionGuessView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any;

  const clue: string             = data?.clue ?? "Where in the world is this place?";
  const imageUrl: string | undefined = data?.imageUrl;

  const [selected, setSelected]   = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft]   = useState(TIMER_TOTAL);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed   = (Date.now() - startedAt.current) / 1000;
      const remaining = Math.max(0, TIMER_TOTAL - Math.floor(elapsed));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const timerPct   = timeLeft / TIMER_TOTAL;
  const timerColor = timerPct > 0.5 ? ACCENT : timerPct > 0.2 ? "#f59e0b" : "#ef4444";
  const isUrgent   = timeLeft <= 8;

  function handleSelect(region: string) {
    if (submitted) return;
    setSelected(region);
    setSubmitted(true);
    sendAction("submit_guess", { region });
  }

  if (submitted) {
    return (
      <WaitingForPlayersView
        emoji="🌍"
        accent={ACCENT}
        title="Region Locked!"
        subtitle="Waiting for everyone to guess..."
        submittedCount={(state.guestViewData as any)?.submittedCount}
        tips={[
          "Geography class is paying off right now 📚",
          "Someone definitely guessed Antarctica 🧊",
          "The reveal is going to be spicy 🔥",
          "Confidence is half the battle 💪",
          "Was that Europe or Asia though? 🤔",
        ]}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* Timer bar */}
      <View style={styles.timerTrack}>
        <View style={[styles.timerFill, { width: `${timerPct * 100}%`, backgroundColor: timerColor }]} />
      </View>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>GEO GUESSER</Text>
        <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
          {timeLeft}s
        </Text>
      </View>

      {/* Location image + clue */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.locationImage} resizeMode="cover" />
        ) : (
          <View style={[styles.locationImage, styles.imagePlaceholder]} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.82)"]}
          style={styles.imageGradient}
        />
        <View style={styles.mysteryBadge}>
          <Text style={styles.mysteryText}>MYSTERY LOCATION</Text>
        </View>
        <View style={styles.clueOverlay}>
          <Text style={styles.clueLabel}>LOCATION CLUE</Text>
          <Text style={styles.clueText}>{clue}</Text>
        </View>
      </View>

      {/* Instruction */}
      <View style={styles.instructionRow}>
        <Text style={styles.instruction}>Which region of the world is this?</Text>
      </View>

      {/* Region buttons */}
      <View style={styles.grid}>
        {ALL_REGIONS.map(({ label, emoji }) => (
          <TouchableOpacity
            key={label}
            style={[styles.regionBtn, selected === label && styles.regionBtnSelected]}
            onPress={() => handleSelect(label)}
            activeOpacity={0.75}
          >
            <Text style={styles.regionEmoji}>{emoji}</Text>
            <Text style={[styles.regionLabel, selected === label && styles.regionLabelSelected]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#08081a" },

  // Timer
  timerTrack: { height: 5, backgroundColor: "#1e1e3a" },
  timerFill:  { height: "100%", borderRadius: 2 },

  // Header
  headerRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  eyebrow:         { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  timerText:       { color: "#fff", fontSize: 26, fontWeight: "900" },
  timerTextUrgent: { color: "#ef4444" },

  // Image
  imageContainer:   { height: 150, position: "relative" },
  locationImage:    { width: "100%", height: 150 },
  imagePlaceholder: { backgroundColor: "#0f2027" },
  imageGradient:    { position: "absolute", bottom: 0, left: 0, right: 0, height: 90 },
  mysteryBadge: {
    position: "absolute",
    top: 10, left: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.4)",
  },
  mysteryText:  { color: ACCENT, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  clueOverlay:  { position: "absolute", bottom: 10, left: 12, right: 12, gap: 2 },
  clueLabel:    { color: "rgba(34,197,94,0.9)", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  clueText:     { color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 18 },

  // Instruction
  instructionRow: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#0d0d20" },
  instruction:    { color: "#888", fontSize: 12, textAlign: "center" },

  // Grid
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
    gap: 8,
    alignContent: "flex-start",
  },
  regionBtn: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "#111",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#222",
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 6,
  },
  regionBtnSelected: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderColor: ACCENT,
  },
  regionEmoji: { fontSize: 26 },
  regionLabel: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  regionLabelSelected: { color: ACCENT },
});
