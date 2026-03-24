import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// JudgeView — shown only to the current judge
// They see the prompt and secretly rate it 1–10
// ─────────────────────────────────────────────────────────────────────────────

export function JudgeView() {
  const { state, sendAction } = useRoom();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const prompt = (state.guestViewData as any)?.prompt as string | undefined;

  function submit() {
    if (selected === null || submitted) return;
    setSubmitted(true);
    sendAction("submit_judge_score", { score: selected });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.badge}>YOU ARE THE JUDGE</Text>
      <Text style={styles.title}>How much do you agree?</Text>
      <Text style={styles.prompt}>{prompt}</Text>

      <Text style={styles.label}>Your secret score (1 = strongly disagree, 10 = strongly agree)</Text>

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
        style={[styles.submitBtn, (selected === null || submitted) && styles.submitBtnDisabled]}
        onPress={submit}
        disabled={selected === null || submitted}
      >
        <Text style={styles.submitBtnText}>
          {submitted ? "Waiting for guesses..." : "Lock In Score"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  badge:                { backgroundColor: "#6c47ff", color: "#fff", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 24 },
  title:                { color: "#aaa", fontSize: 14, marginBottom: 12 },
  prompt:               { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 32, lineHeight: 30 },
  label:                { color: "#888", fontSize: 12, textAlign: "center", marginBottom: 16 },
  grid:                 { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 32 },
  scoreBtn:             { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#333", alignItems: "center", justifyContent: "center" },
  scoreBtnSelected:     { borderColor: "#6c47ff", backgroundColor: "#6c47ff" },
  scoreBtnText:         { color: "#fff", fontSize: 18, fontWeight: "600" },
  scoreBtnTextSelected: { color: "#fff" },
  submitBtn:            { backgroundColor: "#6c47ff", paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, width: "100%" },
  submitBtnDisabled:    { opacity: 0.4 },
  submitBtnText:        { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" },
});
