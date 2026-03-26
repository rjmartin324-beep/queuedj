import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Vibe Check — Guest View
// Drag the slider to rate the current track 1–10 live.
// ─────────────────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get("window");
const SLIDER_WIDTH = SW - 48;

const VIBE_LABELS: Record<number, { label: string; emoji: string; color: string }> = {
  1:  { label: "No vibes", emoji: "💀", color: "#ef4444" },
  2:  { label: "Rough",    emoji: "😬", color: "#f97316" },
  3:  { label: "Meh",      emoji: "😐", color: "#f97316" },
  4:  { label: "Okay",     emoji: "🙂", color: "#eab308" },
  5:  { label: "Mid",      emoji: "😏", color: "#eab308" },
  6:  { label: "Good",     emoji: "😎", color: "#84cc16" },
  7:  { label: "Vibing",   emoji: "🕺", color: "#22c55e" },
  8:  { label: "Slaps",    emoji: "🔥", color: "#22c55e" },
  9:  { label: "Banger",   emoji: "💥", color: "#06b6d4" },
  10: { label: "PEAK",     emoji: "🤯", color: "#a855f7" },
};

export function VibeCheckView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any ?? {};

  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const thumbX = useRef(new Animated.Value((4 / 9) * SLIDER_WIDTH)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const phase = data.phase ?? "rating";
  const average = data.average ?? 0;
  const distribution = (data.distribution ?? new Array(10).fill(0)) as number[];
  const ratingCount = data.ratingCount ?? 0;

  useEffect(() => {
    if (phase === "rating") setSubmitted(false);
  }, [phase, data.trackTitle]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: true }).start();
    },
    onPanResponderMove: (_, gesture) => {
      const clamped = Math.max(0, Math.min(SLIDER_WIDTH, gesture.moveX - 24));
      thumbX.setValue(clamped);
      const newRating = Math.max(1, Math.min(10, Math.round((clamped / SLIDER_WIDTH) * 9) + 1));
      setRating(newRating);
    },
    onPanResponderRelease: () => {
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
      setSubmitted(true);
      sendAction("submit_rating", { rating });
    },
  })).current;

  const vibe = VIBE_LABELS[rating] ?? VIBE_LABELS[5];
  const maxDist = Math.max(...distribution, 1);

  if (phase === "revealed" || ratingCount > 0) {
    return (
      <LinearGradient colors={["#0a0a1a", "#111130"]} style={styles.root}>
        <View style={styles.trackCard}>
          <Text style={styles.trackLabel}>VIBE CHECK</Text>
          <Text style={styles.trackTitle}>{data.trackTitle ?? "Current Track"}</Text>
          <Text style={styles.trackArtist}>{data.trackArtist ?? ""}</Text>
        </View>

        {/* Average */}
        <View style={styles.averageRow}>
          <Text style={styles.averageNum}>{average.toFixed(1)}</Text>
          <Text style={styles.averageSlash}>/10</Text>
          <Text style={styles.averageEmoji}>
            {VIBE_LABELS[Math.round(average)]?.emoji ?? "🎵"}
          </Text>
          <Text style={[styles.averageLabel, { color: VIBE_LABELS[Math.round(average)]?.color ?? "#fff" }]}>
            {VIBE_LABELS[Math.round(average)]?.label ?? ""}
          </Text>
        </View>

        <Text style={styles.countText}>{ratingCount} ratings</Text>

        {/* Distribution bars */}
        <View style={styles.distWrap}>
          {distribution.map((count, i) => (
            <View key={i} style={styles.distCol}>
              <View style={styles.distBarTrack}>
                <Animated.View
                  style={[styles.distBar, {
                    height: `${(count / maxDist) * 100}%`,
                    backgroundColor: VIBE_LABELS[i + 1]?.color ?? "#6366f1",
                  }]}
                />
              </View>
              <Text style={styles.distLabel}>{i + 1}</Text>
            </View>
          ))}
        </View>

        {submitted && phase === "rating" && (
          <View style={styles.myRating}>
            <Text style={styles.myRatingText}>Your rating: {rating}/10 {VIBE_LABELS[rating]?.emoji}</Text>
          </View>
        )}
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#0a0a1a", "#111130"]} style={styles.root}>
      <View style={styles.trackCard}>
        <Text style={styles.trackLabel}>VIBE CHECK</Text>
        <Text style={styles.trackTitle}>{data.trackTitle ?? "Current Track"}</Text>
        <Text style={styles.trackArtist}>{data.trackArtist ?? ""}</Text>
      </View>

      {/* Rating display */}
      <View style={styles.ratingDisplay}>
        <Text style={styles.ratingEmoji}>{vibe.emoji}</Text>
        <Text style={[styles.ratingNum, { color: vibe.color }]}>{rating}</Text>
        <Text style={[styles.ratingLabel, { color: vibe.color }]}>{vibe.label}</Text>
      </View>

      {/* Slider */}
      <View style={styles.sliderWrap} {...(submitted ? {} : panResponder.panHandlers)}>
        <View style={styles.sliderTrack}>
          <LinearGradient
            colors={["#ef4444", "#eab308", "#22c55e", "#a855f7"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <Animated.View style={[styles.thumb, {
          transform: [{ translateX: thumbX }, { scale: scaleAnim }],
          backgroundColor: vibe.color,
        }]} />
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabelLeft}>💀 No vibes</Text>
        <Text style={styles.sliderLabelRight}>Peak 🤯</Text>
      </View>

      {submitted && (
        <View style={styles.submittedBox}>
          <Text style={styles.submittedText}>✓ Vibe submitted — see live results above</Text>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 24 },

  trackCard:   { marginHorizontal: 20, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 20, alignItems: "center", marginBottom: 28 },
  trackLabel:  { color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "800", letterSpacing: 3, marginBottom: 8 },
  trackTitle:  { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  trackArtist: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 4 },

  ratingDisplay: { alignItems: "center", marginBottom: 32 },
  ratingEmoji:   { fontSize: 64, marginBottom: 8 },
  ratingNum:     { fontSize: 72, fontWeight: "900", lineHeight: 80 },
  ratingLabel:   { fontSize: 20, fontWeight: "800", letterSpacing: 1 },

  sliderWrap:  { paddingHorizontal: 24, marginBottom: 10, position: "relative" },
  sliderTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  thumb: {
    position: "absolute",
    top: -12,
    width: 32, height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  sliderLabels:     { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24 },
  sliderLabelLeft:  { color: "rgba(255,255,255,0.3)", fontSize: 12 },
  sliderLabelRight: { color: "rgba(255,255,255,0.3)", fontSize: 12 },

  submittedBox:  { margin: 20, backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", padding: 14, alignItems: "center" },
  submittedText: { color: "#86efac", fontWeight: "700", fontSize: 14 },

  averageRow:    { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 8, marginBottom: 4 },
  averageNum:    { color: "#fff", fontSize: 64, fontWeight: "900" },
  averageSlash:  { color: "rgba(255,255,255,0.3)", fontSize: 24, fontWeight: "700" },
  averageEmoji:  { fontSize: 32 },
  averageLabel:  { fontSize: 18, fontWeight: "800" },
  countText:     { color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", marginBottom: 24 },

  distWrap: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 20, height: 80, gap: 4, marginBottom: 8 },
  distCol:  { flex: 1, alignItems: "center", height: "100%" },
  distBarTrack: { flex: 1, width: "100%", justifyContent: "flex-end", borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)" },
  distBar:  { width: "100%", borderRadius: 3 },
  distLabel:{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 4 },

  myRating:     { margin: 20, backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 16, padding: 14, alignItems: "center" },
  myRatingText: { color: "#a78bfa", fontWeight: "700", fontSize: 14 },
});
