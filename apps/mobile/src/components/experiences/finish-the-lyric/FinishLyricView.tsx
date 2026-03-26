import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Finish The Lyric — Guest View
// ─────────────────────────────────────────────────────────────────────────────

export function FinishLyricView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any ?? {};
  const [answer, setAnswer] = useState("");
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const phase = data.phase ?? "waiting";

  useEffect(() => {
    if (phase === "answering") {
      setLocked(false);
      setAnswer("");
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [phase, data.roundNumber]);

  useEffect(() => {
    if (phase !== "answering" || !data.roundStartedAt) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - data.roundStartedAt) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(25 - elapsed)));
      if (elapsed >= 25) clearInterval(interval);
    }, 500);
    return () => clearInterval(interval);
  }, [phase, data.roundStartedAt]);

  function submit() {
    if (!answer.trim() || locked) return;
    setLocked(true);
    sendAction("submit_answer", { answer: answer.trim(), guestName: state.guestId });
  }

  if (phase === "waiting") {
    return (
      <LinearGradient colors={["#0c0a1e", "#1a1040"]} style={styles.center}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🎤</Text>
        <Text style={styles.waitTitle}>Finish The Lyric</Text>
        <Text style={styles.waitSub}>Get ready to fill in the blank…</Text>
      </LinearGradient>
    );
  }

  if (phase === "revealed") {
    const submissions = data.revealedAnswer ? Object.entries(data.submissions ?? {}) : [];
    return (
      <LinearGradient colors={["#0c0a1e", "#1a1040"]} style={styles.root}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.revealLabel}>THE ANSWER</Text>
          <View style={styles.answerBox}>
            <Text style={styles.lyricFull}>{data.lyricPrompt?.replace("___", `"${data.revealedAnswer}"`) ?? data.revealedAnswer}</Text>
          </View>
          <Text style={styles.trackCredit}>{data.revealedTitle} — {data.revealedArtist}</Text>

          {submissions.length > 0 && (
            <>
              <Text style={[styles.revealLabel, { marginTop: 24 }]}>WHAT EVERYONE SAID</Text>
              {submissions.map(([guestId, ans], i) => (
                <View key={i} style={[styles.subRow, (ans as string).toLowerCase() === data.revealedAnswer?.toLowerCase() && styles.subRowCorrect]}>
                  <Text style={styles.subText}>"{ans}"</Text>
                  {(ans as string).toLowerCase() === data.revealedAnswer?.toLowerCase() && (
                    <Text style={styles.subCorrect}>✓ correct</Text>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </LinearGradient>
    );
  }

  // Answering phase
  const timerColor = timeLeft <= 5 ? "#ef4444" : timeLeft <= 10 ? "#f97316" : "#22c55e";
  const lyric = data.lyricPrompt ?? "";
  const parts = lyric.split("___");

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={["#0c0a1e", "#1a1040"]} style={styles.root}>

        <View style={styles.topBar}>
          <Text style={styles.roundText}>ROUND {data.roundNumber} / {data.totalRounds}</Text>
          <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}s</Text>
        </View>

        <Animated.View style={[styles.lyricCard, { opacity: fadeAnim }]}>
          <LinearGradient colors={["#1e1b4b", "#312e81"]} style={styles.lyricInner}>
            <Text style={styles.lyricLabel}>FINISH THE LYRIC</Text>
            <Text style={styles.lyricText}>
              {parts[0]}
              <Text style={styles.blankText}>____________</Text>
              {parts[1] ?? ""}
            </Text>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.submitCount}>{data.submissionCount ?? 0} answers submitted</Text>

        <View style={styles.inputArea}>
          {locked ? (
            <View style={styles.lockedBox}>
              <Text style={styles.lockedEmoji}>🎤</Text>
              <Text style={styles.lockedText}>"{answer}" — locked in!</Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Fill in the blank…"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
                returnKeyType="send"
                onSubmitEditing={submit}
                editable={timeLeft > 0}
              />
              <TouchableOpacity
                style={[styles.submitBtn, (!answer.trim() || timeLeft === 0) && { opacity: 0.4 }]}
                onPress={submit}
                disabled={!answer.trim() || timeLeft === 0}
              >
                <LinearGradient colors={["#4f46e5", "#7c3aed"]} style={styles.submitInner}>
                  <Text style={styles.submitText}>LOCK IT IN 🎤</Text>
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
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  waitTitle: { color: "#fff", fontSize: 28, fontWeight: "900" },
  waitSub:   { color: "rgba(255,255,255,0.4)", fontSize: 15, marginTop: 8 },

  topBar:    { flexDirection: "row", justifyContent: "space-between", padding: 20 },
  roundText: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  timerText: { fontSize: 18, fontWeight: "900" },

  lyricCard:  { marginHorizontal: 20, borderRadius: 24, overflow: "hidden", marginBottom: 20 },
  lyricInner: { padding: 28 },
  lyricLabel: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "800", letterSpacing: 3, marginBottom: 16 },
  lyricText:  { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 32 },
  blankText:  { color: "#818cf8", fontWeight: "900" },

  submitCount: { color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center", marginBottom: 16 },

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
  submitBtn:   { borderRadius: 16, overflow: "hidden" },
  submitInner: { paddingVertical: 16, alignItems: "center" },
  submitText:  { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 1 },

  lockedBox: {
    backgroundColor: "rgba(79,70,229,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.4)",
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lockedEmoji: { fontSize: 22 },
  lockedText:  { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "700", flex: 1 },

  revealLabel:  { color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "800", letterSpacing: 3, marginBottom: 12 },
  answerBox:    { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 24, marginBottom: 8 },
  lyricFull:    { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 28 },
  trackCredit:  { color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 20 },
  subRow:       { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subRowCorrect:{ backgroundColor: "rgba(34,197,94,0.08)", borderWidth: 1, borderColor: "rgba(34,197,94,0.25)" },
  subText:      { color: "#fff", fontSize: 15, fontWeight: "600" },
  subCorrect:   { color: "#86efac", fontWeight: "800", fontSize: 12 },
});
