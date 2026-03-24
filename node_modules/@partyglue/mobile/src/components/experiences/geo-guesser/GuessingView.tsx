import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Geo Guesser — GuessingView
// Shows a text clue about the location, then a grid of world region buttons
// to pick from. 30s countdown. After submission shows a locked-in state.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#22c55e";
const TIMER_TOTAL = 30;

interface Region {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

const REGIONS: Region[] = [
  { id: "North America",  label: "North America",  emoji: "🌎", color: "#3b82f6" },
  { id: "South America",  label: "South America",  emoji: "🌎", color: "#f59e0b" },
  { id: "Europe",         label: "Europe",          emoji: "🌍", color: "#a855f7" },
  { id: "Asia",           label: "Asia",            emoji: "🌏", color: "#ef4444" },
  { id: "Africa",         label: "Africa",          emoji: "🌍", color: "#10b981" },
  { id: "Oceania",        label: "Oceania",         emoji: "🌏", color: "#06b6d4" },
  { id: "Middle East",    label: "Middle East",     emoji: "🌍", color: "#f97316" },
];

// ─── Location Photo Card ──────────────────────────────────────────────────────

function LocationPhotoCard({ locationName, locationEmoji, clue }: {
  locationName?: string;
  locationEmoji?: string;
  clue: string;
}) {
  const emoji = locationEmoji ?? "🌍";

  return (
    <View style={photoStyles.card}>
      {/* Polaroid-style photo area */}
      <View style={photoStyles.photoFrame}>
        <LinearGradient
          colors={["#0f2027", "#203a43", "#2c5364"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={photoStyles.photoGradient}
        >
          {/* Decorative horizon line */}
          <View style={photoStyles.horizon} />
          {/* Main emoji landmark */}
          <Text style={photoStyles.landmarkEmoji}>{emoji}</Text>
          {/* Decorative stars */}
          <Text style={photoStyles.starRow}>✦  ·  ✦  ·  ✦</Text>
          {/* Scan lines effect */}
          {[0,1,2,3,4,5,6,7].map(i => (
            <View key={i} style={[photoStyles.scanLine, { top: 14 + i * 20 }]} />
          ))}
        </LinearGradient>
        {/* Photo overlay gradient at bottom */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.75)"]}
          style={photoStyles.photoBottomFade}
        />
        {/* MYSTERY badge */}
        <View style={photoStyles.mysteryBadge}>
          <Text style={photoStyles.mysteryText}>📍 MYSTERY LOCATION</Text>
        </View>
      </View>

      {/* Clue section below photo */}
      <View style={photoStyles.clueSection}>
        <Text style={photoStyles.clueLabel}>🔍  LOCATION CLUE</Text>
        <Text style={photoStyles.clueText}>{clue}</Text>
      </View>
    </View>
  );
}

const photoStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#1e3a3a",
    marginBottom: 20,
    backgroundColor: "#0a1a1a",
  },
  photoFrame:       { height: 180, position: "relative" },
  photoGradient:    { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  horizon: {
    position: "absolute",
    bottom: "35%",
    left: 0, right: 0,
    height: 1,
    backgroundColor: "rgba(34,197,94,0.15)",
  },
  landmarkEmoji:    { fontSize: 72, textAlign: "center" },
  starRow:          { color: "rgba(34,197,94,0.4)", fontSize: 12, letterSpacing: 4, marginTop: 8 },
  scanLine: {
    position: "absolute",
    left: 0, right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  photoBottomFade:  { position: "absolute", bottom: 0, left: 0, right: 0, height: 60 },
  mysteryBadge: {
    position: "absolute",
    bottom: 12, left: 14,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
  },
  mysteryText:      { color: "#22c55e", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  clueSection:      { padding: 16, gap: 6, backgroundColor: "#0d1f1f" },
  clueLabel:        { color: "#22c55e", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  clueText:         { color: "#fff", fontSize: 15, fontWeight: "600", lineHeight: 22 },
});

// ─────────────────────────────────────────────────────────────────────────────

export function GuessingView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any;
  const clue: string = data?.clue ?? "Where in the world is this place?";
  const locationName: string | undefined = data?.locationName;
  const locationEmoji: string | undefined = data?.locationEmoji;

  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_TOTAL);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const remaining = Math.max(0, TIMER_TOTAL - Math.floor(elapsed));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const timerPct = timeLeft / TIMER_TOTAL;
  const timerColor =
    timerPct > 0.5 ? ACCENT : timerPct > 0.2 ? "#f59e0b" : "#ef4444";
  const isUrgent = timeLeft <= 8;

  function pickRegion(regionId: string) {
    if (submitted) return;
    setSelected(regionId);
  }

  function submit() {
    if (!selected || submitted) return;
    setSubmitted(true);
    sendAction("submit_guess", { region: selected });
  }

  if (submitted) {
    const region = REGIONS.find(r => r.id === selected);
    return (
      <View style={styles.root}>
        <View style={styles.submittedScreen}>
          <Text style={styles.submittedEmoji}>{region?.emoji ?? "📍"}</Text>
          <Text style={styles.submittedRegion}>{selected}</Text>
          <Text style={styles.submittedTitle}>Guess Locked!</Text>
          <Text style={styles.submittedSub}>Waiting for the reveal...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Timer bar */}
      <View style={styles.timerTrack}>
        <View style={[styles.timerFill, { width: `${timerPct * 100}%`, backgroundColor: timerColor }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>GEO GUESSER</Text>
          <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
            {timeLeft}s
          </Text>
        </View>
        <Text style={styles.title}>Where in the world?</Text>

        {/* Location photo + clue card */}
        <LocationPhotoCard
          locationName={locationName}
          locationEmoji={locationEmoji}
          clue={clue}
        />

        {/* Region buttons */}
        <Text style={styles.regionInstructions}>Pick a region:</Text>
        <View style={styles.regionGrid}>
          {REGIONS.map((region) => {
            const isSelected = selected === region.id;
            return (
              <TouchableOpacity
                key={region.id}
                style={[
                  styles.regionBtn,
                  { borderColor: isSelected ? region.color : "#1e1e3a" },
                  isSelected && { backgroundColor: region.color + "33" },
                ]}
                onPress={() => pickRegion(region.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.regionEmoji}>{region.emoji}</Text>
                <Text style={[styles.regionLabel, isSelected && { color: region.color }]}>
                  {region.label}
                </Text>
                {isSelected && (
                  <View style={[styles.selectedDot, { backgroundColor: region.color }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !selected && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!selected}
        >
          <Text style={styles.submitBtnText}>
            {selected ? `Lock in: ${selected}` : "Select a region first"}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: "#08081a" },

  // Timer
  timerTrack:        { height: 5, backgroundColor: "#1e1e3a", overflow: "hidden" },
  timerFill:         { height: "100%", borderRadius: 2 },

  content:           { padding: 20 },

  // Header
  headerRow:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  eyebrow:           { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  timerText:         { color: "#fff", fontSize: 28, fontWeight: "900" },
  timerTextUrgent:   { color: "#ef4444" },
  title:             { color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 20 },

  // Regions
  regionInstructions: { color: "#888", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  regionGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },

  regionBtn: {
    width: "47%",
    backgroundColor: "#12122a",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#1e1e3a",
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    position: "relative",
  },
  regionEmoji:       { fontSize: 22 },
  regionLabel:       { color: "#ccc", fontWeight: "700", fontSize: 14, flex: 1 },
  selectedDot:       { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },

  // Submit
  submitBtn:         { paddingVertical: 18, backgroundColor: ACCENT, borderRadius: 16, alignItems: "center" },
  submitBtnDisabled: { backgroundColor: "#1e1e3a", opacity: 0.7 },
  submitBtnText:     { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },

  // Submitted
  submittedScreen:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  submittedEmoji:    { fontSize: 64 },
  submittedRegion:   { color: ACCENT, fontSize: 22, fontWeight: "900" },
  submittedTitle:    { color: "#fff", fontSize: 28, fontWeight: "900" },
  submittedSub:      { color: "#888", fontSize: 15, textAlign: "center" },

  bottomSpacer:      { height: 32 },
});
