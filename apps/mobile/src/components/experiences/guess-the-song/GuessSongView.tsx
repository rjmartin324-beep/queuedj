import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Keyboard, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { tapHeavy, tapLight } from "../../../lib/haptics";
import { ConfettiBlast } from "../../shared/ConfettiBlast";
import { ServerTimer } from "../../shared/ServerTimer";

// ─────────────────────────────────────────────────────────────────────────────
// Guess The Song — Guest View
// ─────────────────────────────────────────────────────────────────────────────

const PODIUM_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const PODIUM_EMOJIS = ["🥇", "🥈", "🥉"];

export function GuessSongView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any ?? {};
  const [guess, setGuess] = useState("");
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const phase = data.phase ?? "waiting";
  const winners = (data.winners ?? []) as string[];
  const guessCount = data.guessCount ?? 0;
  const [confetti, setConfetti] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (phase !== "guessing" || !data.roundStartedAt) return;
    setLocked(false);
    setGuess("");
    const interval = setInterval(() => {
      const elapsed = (Date.now() - data.roundStartedAt) / 1000;
      const left = Math.max(0, 30 - elapsed);
      setTimeLeft(Math.ceil(left));
      if (left <= 0) clearInterval(interval);
    }, 500);
    return () => clearInterval(interval);
  }, [phase, data.roundStartedAt]);

  // Slide in on new round
  useEffect(() => {
    if (phase === "guessing") {
      slideAnim.setValue(60);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    }
  }, [data.roundNumber]);

  // Pulse + haptic + confetti when someone gets it right
  useEffect(() => {
    if (winners.length > 0) {
      tapHeavy();
      setConfetti(true);
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [winners.length]);

  function submitGuess() {
    if (!guess.trim() || locked) return;
    tapLight();
    Keyboard.dismiss();
    setLocked(true);
    sendAction("submit_guess", { guess: guess.trim(), guestName: state.guestId });
  }

  const timerColor = timeLeft <= 5 ? "#ef4444" : timeLeft <= 10 ? "#f97316" : "#22c55e";

  // ── WAITING ────────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <LinearGradient colors={["#0a0a1a", "#111130"]} style={styles.center}>
        <Text style={styles.waitEmoji}>🎵</Text>
        <Text style={styles.waitTitle}>Get Ready</Text>
        <Text style={styles.waitSub}>Host is picking the next song…</Text>
      </LinearGradient>
    );
  }

  // ── GAME OVER ──────────────────────────────────────────────────────────────
  if (phase === "game_over") {
    return (
      <LinearGradient colors={["#0a0a1a", "#111130"]} style={styles.center}>
        <Text style={{ fontSize: 56 }}>🏆</Text>
        <Text style={[styles.waitTitle, { marginTop: 12 }]}>Game Over!</Text>
      </LinearGradient>
    );
  }

  // ── REVEALED ───────────────────────────────────────────────────────────────
  if (phase === "revealed") {
    return (
      <LinearGradient colors={["#0a0a1a", "#111130"]} style={styles.root}>
        <View style={styles.revealBox}>
          <Text style={styles.revealLabel}>THE SONG WAS</Text>
          <Text style={styles.revealTitle}>{data.revealedTitle ?? "?"}</Text>
          <Text style={styles.revealArtist}>{data.revealedArtist ?? ""}</Text>
        </View>

        {winners.length > 0 && (
          <View style={styles.podium}>
            <Text style={styles.sectionLabel}>WINNERS</Text>
            {winners.slice(0, 3).map((name, i) => (
              <View key={i} style={[styles.winnerRow, { borderColor: PODIUM_COLORS[i] + "55" }]}>
                <Text style={styles.winnerEmoji}>{PODIUM_EMOJIS[i]}</Text>
                <Text style={styles.winnerName}>{name}</Text>
                <Text style={[styles.winnerPts, { color: PODIUM_COLORS[i] }]}>
                  +{[500, 300, 150][i]}pts
                </Text>
              </View>
            ))}
          </View>
        )}

        {winners.length === 0 && (
          <View style={styles.noWinners}>
            <Text style={styles.noWinnersText}>Nobody got it! 😅</Text>
          </View>
        )}
      </LinearGradient>
    );
  }

  // ── GUESSING ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={["#0a0a1a", "#111130"]} style={styles.root}>
        <ConfettiBlast active={confetti} onDone={() => setConfetti(false)} />

        {/* Timer + round */}
        <View style={styles.topBar}>
          <View style={styles.roundPill}>
            <Text style={styles.roundText}>ROUND {data.roundNumber} / {data.totalRounds}</Text>
          </View>
          {data.roundStartedAt ? (
            <ServerTimer startedAt={data.roundStartedAt} durationSec={30} onExpiry={() => setLocked(true)} />
          ) : (
            <View style={[styles.timerPill, { borderColor: timerColor + "55" }]}>
              <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}s</Text>
            </View>
          )}
        </View>

        {/* Hidden track area */}
        <Animated.View style={[styles.hiddenCard, { transform: [{ translateY: slideAnim }, { scale: pulseAnim }] }]}>
          <LinearGradient colors={["#1a1040", "#2d1b69"]} style={styles.hiddenInner}>
            <Text style={styles.hiddenEmoji}>🎵</Text>
            <Text style={styles.hiddenLabel}>NOW PLAYING</Text>
            <View style={styles.hiddenBars}>
              {[0.4, 0.8, 0.6, 1.0, 0.7, 0.9, 0.5, 0.8, 0.6, 0.7].map((h, i) => (
                <Animated.View
                  key={i}
                  style={[styles.bar, { height: `${h * 60}%`, opacity: 0.6 + h * 0.4 }]}
                />
              ))}
            </View>
            <Text style={styles.hiddenSub}>Type the song title below</Text>
          </LinearGradient>
        </Animated.View>

        {/* Winner feed */}
        {winners.length > 0 && (
          <View style={styles.winnerFeed}>
            {winners.map((name, i) => (
              <View key={i} style={styles.winnerChip}>
                <Text style={styles.winnerChipText}>{PODIUM_EMOJIS[i]} {name} got it!</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.guessCount}>{guessCount} guesses submitted</Text>

        {/* Input */}
        <View style={styles.inputArea}>
          {locked ? (
            <View style={styles.lockedBox}>
              <Text style={styles.lockedEmoji}>⏳</Text>
              <Text style={styles.lockedText}>"{guess}" — waiting for reveal</Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={guess}
                onChangeText={setGuess}
                placeholder="Type song title…"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
                returnKeyType="send"
                onSubmitEditing={submitGuess}
                editable={timeLeft > 0}
              />
              <TouchableOpacity
                style={[styles.submitBtn, (!guess.trim() || timeLeft === 0) && styles.submitBtnDisabled]}
                onPress={submitGuess}
                disabled={!guess.trim() || timeLeft === 0}
              >
                <LinearGradient colors={["#7c3aed", "#6d28d9"]} style={styles.submitInner}>
                  <Text style={styles.submitText}>SUBMIT</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, paddingTop: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  waitEmoji: { fontSize: 64, marginBottom: 16 },
  waitTitle: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  waitSub:   { color: "rgba(255,255,255,0.4)", fontSize: 15, marginTop: 8 },

  topBar:     { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 20 },
  roundPill:  { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  roundText:  { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  timerPill:  { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  timerText:  { fontSize: 16, fontWeight: "900" },

  hiddenCard:  { marginHorizontal: 20, borderRadius: 24, overflow: "hidden", marginBottom: 16 },
  hiddenInner: { padding: 32, alignItems: "center" },
  hiddenEmoji: { fontSize: 40, marginBottom: 8 },
  hiddenLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 3, marginBottom: 20 },
  hiddenBars:  { flexDirection: "row", alignItems: "flex-end", height: 50, gap: 4, marginBottom: 16 },
  bar:         { width: 6, backgroundColor: "#a78bfa", borderRadius: 3 },
  hiddenSub:   { color: "rgba(255,255,255,0.3)", fontSize: 13 },

  winnerFeed: { paddingHorizontal: 20, gap: 6, marginBottom: 8 },
  winnerChip: { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(99,102,241,0.4)", alignSelf: "flex-start" },
  winnerChipText: { color: "#a78bfa", fontWeight: "800", fontSize: 13 },

  guessCount: { color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center", marginBottom: 16 },

  inputArea: { paddingHorizontal: 20, gap: 10 },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  submitBtn:         { borderRadius: 16, overflow: "hidden" },
  submitBtnDisabled: { opacity: 0.4 },
  submitInner:       { paddingVertical: 16, alignItems: "center" },
  submitText:        { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 2 },

  lockedBox: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.35)",
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lockedEmoji: { fontSize: 20 },
  lockedText:  { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "700", flex: 1 },

  revealBox:   { margin: 20, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 24, padding: 28, alignItems: "center" },
  revealLabel: { color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "800", letterSpacing: 3, marginBottom: 12 },
  revealTitle: { color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 },
  revealArtist:{ color: "rgba(255,255,255,0.5)", fontSize: 16, marginTop: 6 },

  podium:       { paddingHorizontal: 20, gap: 8 },
  sectionLabel: { color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "800", letterSpacing: 3, marginBottom: 4 },
  winnerRow:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, borderWidth: 1 },
  winnerEmoji:  { fontSize: 22 },
  winnerName:   { flex: 1, color: "#fff", fontWeight: "800", fontSize: 15 },
  winnerPts:    { fontWeight: "900", fontSize: 16 },

  noWinners:     { margin: 20, alignItems: "center" },
  noWinnersText: { color: "rgba(255,255,255,0.4)", fontSize: 16 },
});
