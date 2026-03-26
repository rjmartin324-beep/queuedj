import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Name That Genre — Guest View
// ─────────────────────────────────────────────────────────────────────────────

const GENRE_COLORS: Record<string, [string, string]> = {
  "Hip-Hop":    ["#7c3aed", "#5b21b6"],
  "Pop":        ["#db2777", "#be185d"],
  "R&B":        ["#c2410c", "#9a3412"],
  "Rock":       ["#374151", "#1f2937"],
  "Electronic": ["#0891b2", "#0e7490"],
  "Jazz":       ["#92400e", "#78350f"],
  "Country":    ["#15803d", "#166534"],
  "Reggae":     ["#065f46", "#064e3b"],
  "Metal":      ["#1f2937", "#111827"],
  "Classical":  ["#4338ca", "#3730a3"],
  "Latin":      ["#b45309", "#92400e"],
  "Soul":       ["#7e22ce", "#6b21a8"],
  "Funk":       ["#b45309", "#a16207"],
  "Disco":      ["#a21caf", "#86198f"],
  "Afrobeats":  ["#c2410c", "#b45309"],
  "K-Pop":      ["#ec4899", "#db2777"],
};
const DEFAULT_COLORS: [string, string] = ["#4f46e5", "#4338ca"];

export function NameGenreView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any ?? {};

  const [selected, setSelected] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const flipAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const timerAnim = useRef(new Animated.Value(1)).current;

  const phase = data.phase ?? "waiting";
  const options = (data.options ?? []) as string[];
  const correctGenre = data.correctGenre as string | null;
  const answerCount = data.answerCount ?? 0;

  useEffect(() => {
    if (phase === "guessing") {
      setSelected(null);
      setTimeLeft(20);
      // Flip cards in
      flipAnims.forEach((a, i) => {
        a.setValue(0);
        Animated.timing(a, {
          toValue: 1, duration: 400, delay: i * 80,
          easing: Easing.out(Easing.back(1.1)), useNativeDriver: true,
        }).start();
      });
      // Timer
      timerAnim.setValue(1);
      Animated.timing(timerAnim, {
        toValue: 0, duration: 20000, easing: Easing.linear, useNativeDriver: false,
      }).start();
    }
  }, [phase, data.roundNumber]);

  useEffect(() => {
    if (phase !== "guessing" || !data.roundStartedAt) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - data.roundStartedAt) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(20 - elapsed)));
    }, 500);
    return () => clearInterval(interval);
  }, [phase, data.roundStartedAt]);

  function submitAnswer(genre: string) {
    if (selected || phase !== "guessing") return;
    setSelected(genre);
    sendAction("submit_answer", { genre });
  }

  const timerColor = timerAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: ["#ef4444", "#f97316", "#22c55e"] });
  const timerWidth = timerAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  // ── WAITING ────────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <LinearGradient colors={["#0a0a1a", "#111130"]} style={styles.center}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🎸</Text>
        <Text style={styles.bigTitle}>Name That Genre</Text>
        <Text style={styles.subtitle}>Host is loading the next track…</Text>
      </LinearGradient>
    );
  }

  // ── GAME OVER ──────────────────────────────────────────────────────────────
  if (phase === "game_over") {
    const sorted = Object.entries(data.scores ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number));
    return (
      <LinearGradient colors={["#0a0a1a", "#111130"]} style={styles.center}>
        <Text style={{ fontSize: 56 }}>🏆</Text>
        <Text style={[styles.bigTitle, { marginTop: 12 }]}>Game Over!</Text>
        {sorted.slice(0, 3).map(([gid, pts], i) => (
          <Text key={gid} style={styles.finalScore}>{["🥇","🥈","🥉"][i]} {gid} — {String(pts)}pts</Text>
        ))}
      </LinearGradient>
    );
  }

  // ── REVEALED ───────────────────────────────────────────────────────────────
  if (phase === "revealed") {
    return (
      <LinearGradient colors={["#0a0a1a", "#111130"]} style={styles.root}>
        <View style={styles.revealTrack}>
          <Text style={styles.revealTrackTitle}>{data.trackTitle}</Text>
          <Text style={styles.revealTrackArtist}>{data.trackArtist}</Text>
        </View>

        <View style={styles.correctBanner}>
          <LinearGradient colors={GENRE_COLORS[correctGenre ?? ""] ?? DEFAULT_COLORS} style={styles.correctInner}>
            <Text style={styles.correctLabel}>THE GENRE</Text>
            <Text style={styles.correctGenre}>{correctGenre}</Text>
          </LinearGradient>
        </View>

        <View style={styles.optionsGrid}>
          {options.map((opt) => {
            const isCorrect = opt === correctGenre;
            const isWrong = selected === opt && !isCorrect;
            return (
              <View key={opt} style={[
                styles.resultOption,
                isCorrect && styles.resultCorrect,
                isWrong && styles.resultWrong,
              ]}>
                <Text style={styles.resultOptionText}>{opt}</Text>
                {isCorrect && <Text style={styles.resultMark}>✓</Text>}
                {isWrong && <Text style={styles.resultMark}>✗</Text>}
              </View>
            );
          })}
        </View>

        {selected === correctGenre && (
          <View style={styles.correctMsg}>
            <Text style={styles.correctMsgText}>🎯 You got it! Points added.</Text>
          </View>
        )}
      </LinearGradient>
    );
  }

  // ── GUESSING ───────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={["#0a0a1a", "#111130"]} style={styles.root}>
      {/* Timer bar */}
      <View style={styles.timerTrack}>
        <Animated.View style={[styles.timerFill, { width: timerWidth, backgroundColor: timerColor }]} />
      </View>

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.roundText}>ROUND {data.roundNumber} / {data.totalRounds}</Text>
        <Text style={[styles.timerText, timeLeft <= 5 && { color: "#ef4444" }]}>{timeLeft}s</Text>
      </View>

      {/* Hidden track */}
      <View style={styles.hiddenTrack}>
        <Text style={styles.hiddenIcon}>🎵</Text>
        <Text style={styles.hiddenLabel}>WHAT GENRE IS THIS?</Text>
        <Text style={styles.hiddenSub}>{answerCount} answers in</Text>
      </View>

      {/* Options grid */}
      <View style={styles.optionsGrid}>
        {options.map((opt, i) => {
          const colors = GENRE_COLORS[opt] ?? DEFAULT_COLORS;
          const isSelected = selected === opt;
          const rotY = flipAnims[i].interpolate({ inputRange: [0, 1], outputRange: ["90deg", "0deg"] });
          return (
            <Animated.View key={opt} style={{ transform: [{ perspective: 1000 }, { rotateY: rotY }], flex: 1 }}>
              <TouchableOpacity
                onPress={() => submitAnswer(opt)}
                disabled={!!selected || timeLeft === 0}
                style={{ flex: 1 }}
              >
                <LinearGradient colors={colors} style={[styles.optionCard, isSelected && styles.optionSelected]}>
                  <Text style={styles.optionText}>{opt}</Text>
                  {isSelected && <Text style={styles.optionCheck}>✓</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {selected && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedText}>"{selected}" locked in — waiting for reveal</Text>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },

  bigTitle: { color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.4)", fontSize: 15, marginTop: 8, textAlign: "center" },
  finalScore: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 10 },

  timerTrack: { height: 5, backgroundColor: "#111" },
  timerFill:  { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 2 },

  topBar:     { flexDirection: "row", justifyContent: "space-between", padding: 16 },
  roundText:  { color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  timerText:  { color: "#22c55e", fontSize: 18, fontWeight: "900" },

  hiddenTrack: { alignItems: "center", paddingVertical: 24 },
  hiddenIcon:  { fontSize: 48, marginBottom: 8 },
  hiddenLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "800", letterSpacing: 3 },
  hiddenSub:   { color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 6 },

  optionsGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  optionCard: {
    flex: 1, minWidth: "45%", borderRadius: 20, padding: 20,
    justifyContent: "center", alignItems: "center", minHeight: 80,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)",
  },
  optionSelected: { borderColor: "#fff", borderWidth: 2.5 },
  optionText:  { color: "#fff", fontSize: 15, fontWeight: "900", textAlign: "center" },
  optionCheck: { color: "#fff", fontSize: 20, marginTop: 6 },

  lockedBanner: { backgroundColor: "rgba(255,255,255,0.06)", margin: 16, borderRadius: 14, padding: 14, alignItems: "center" },
  lockedText:   { color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: "700" },

  revealTrack:       { alignItems: "center", padding: 24 },
  revealTrackTitle:  { color: "#fff", fontSize: 22, fontWeight: "900" },
  revealTrackArtist: { color: "rgba(255,255,255,0.5)", fontSize: 15, marginTop: 4 },

  correctBanner: { marginHorizontal: 16, borderRadius: 20, overflow: "hidden", marginBottom: 16 },
  correctInner:  { padding: 24, alignItems: "center" },
  correctLabel:  { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 3, marginBottom: 8 },
  correctGenre:  { color: "#fff", fontSize: 28, fontWeight: "900" },

  resultOption: {
    flex: 1, minWidth: "45%", borderRadius: 14, padding: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  resultCorrect: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.4)" },
  resultWrong:   { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" },
  resultOptionText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  resultMark: { fontSize: 18, fontWeight: "900", color: "#fff" },

  correctMsg:     { margin: 16, backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 14, padding: 14, alignItems: "center" },
  correctMsgText: { color: "#86efac", fontWeight: "800", fontSize: 15 },
});
