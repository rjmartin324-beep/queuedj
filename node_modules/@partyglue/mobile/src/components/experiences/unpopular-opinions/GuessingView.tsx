import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// GuessingView — everyone except the judge
// Guess the judge's secret score + optional double-down bet
// ─────────────────────────────────────────────────────────────────────────────

export function GuessingView() {
  const { state, sendAction } = useRoom();
  const [selected, setSelected] = useState<number | null>(null);
  const [bet, setBet] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const data     = state.guestViewData as any;
  const prompt   = data?.prompt   as string  | undefined;
  const isJudge  = data?.isJudge  as boolean | undefined;

  function submit() {
    if (selected === null || submitted) return;
    setSubmitted(true);
    sendAction("submit_guess", { guess: selected, bet });
  }

  if (isJudge) {
    return (
      <View style={styles.container}>
        <Text style={styles.waiting}>You're the Judge — your score is locked in.</Text>
        <Text style={styles.subtext}>Waiting for everyone else to guess...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>GUESS THE JUDGE'S SCORE</Text>
      <Text style={styles.prompt}>{prompt}</Text>
      <Text style={styles.label}>How much do you think the judge agreed? (1–10)</Text>

      <View style={styles.grid}>
        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.scoreBtn, selected === n && styles.scoreBtnSelected]}
            onPress={() => !submitted && setSelected(n)}
          >
            <Text style={[styles.scoreBtnText, selected === n && styles.scoreBtnTextSelected]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.betBtn, bet && styles.betBtnActive]}
        onPress={() => !submitted && setBet((b) => !b)}
      >
        <Text style={styles.betBtnText}>
          {bet ? "⚡ Bet ON — Double or nothing!" : "Bet? (doubles your points if exact)"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitBtn, (selected === null || submitted) && styles.submitBtnDisabled]}
        onPress={submit}
        disabled={selected === null || submitted}
      >
        <Text style={styles.submitBtnText}>
          {submitted ? "Waiting for others..." : "Submit Guess"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  waiting:              { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  subtext:              { color: "#888", fontSize: 14, marginTop: 12, textAlign: "center" },
  eyebrow:              { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 16 },
  prompt:               { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 24, lineHeight: 28 },
  label:                { color: "#888", fontSize: 12, textAlign: "center", marginBottom: 16 },
  grid:                 { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 24 },
  scoreBtn:             { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#333", alignItems: "center", justifyContent: "center" },
  scoreBtnSelected:     { borderColor: "#6c47ff", backgroundColor: "#6c47ff" },
  scoreBtnText:         { color: "#fff", fontSize: 18, fontWeight: "600" },
  scoreBtnTextSelected: { color: "#fff" },
  betBtn:               { borderWidth: 1, borderColor: "#555", borderRadius: 10, padding: 14, width: "100%", alignItems: "center", marginBottom: 16 },
  betBtnActive:         { borderColor: "#f59e0b", backgroundColor: "#f59e0b22" },
  betBtnText:           { color: "#fff", fontSize: 14 },
  submitBtn:            { backgroundColor: "#6c47ff", paddingVertical: 16, borderRadius: 12, width: "100%" },
  submitBtnDisabled:    { opacity: 0.4 },
  submitBtnText:        { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" },
});
