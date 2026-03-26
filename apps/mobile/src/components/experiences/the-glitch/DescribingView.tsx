import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";
import { WaitingForPlayersView } from "../shared/WaitingForPlayersView";

// ─────────────────────────────────────────────────────────────────────────────
// DescribingView — everyone types (or says out loud) their description
// The Glitch must be vague enough to blend in without revealing they saw
// a different prompt
// ─────────────────────────────────────────────────────────────────────────────

export function DescribingView() {
  const { state, sendAction } = useRoom();
  const [text, setText]         = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (!text.trim() || submitted) return;
    setSubmitted(true);
    sendAction("submit_description", { text: text.trim() });
  }

  if (submitted) {
    return (
      <WaitingForPlayersView
        emoji="📺"
        accent="#818cf8"
        title="Description Sent!"
        subtitle="Waiting for all players to submit their description..."
        submittedCount={(state.guestViewData as any)?.submittedCount}
        tips={[
          "The Glitch is hiding in plain sight 🕵️",
          "Everyone thinks their description is unique 😅",
          "Someone just described the wrong show entirely 💀",
          "Voting is going to be heated 🔥",
          "Trust no one. Not even yourself. 👀",
        ]}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>DESCRIBE YOUR PROMPT</Text>
      <Text style={styles.title}>Write one sentence describing what you saw.</Text>
      <Text style={styles.hint}>Don't reveal too much — there's a Glitch among you.</Text>

      <TextInput
        style={[styles.input, submitted && styles.inputDisabled]}
        value={text}
        onChangeText={setText}
        placeholder="My description..."
        placeholderTextColor="#555"
        maxLength={200}
        editable={!submitted}
      />
      <Text style={styles.charCount}>{text.length}/200</Text>

      <TouchableOpacity
        style={[styles.submitBtn, (submitted || !text.trim()) && styles.submitBtnDisabled]}
        onPress={submit}
        disabled={submitted || !text.trim()}
      >
        <Text style={styles.submitBtnText}>Submit</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, padding: 24, justifyContent: "center" },
  eyebrow:           { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  title:             { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  hint:              { color: "#f59e0b", fontSize: 13, marginBottom: 28 },
  input:             { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, color: "#fff", fontSize: 16, borderWidth: 1, borderColor: "#333" },
  inputDisabled:     { opacity: 0.5 },
  charCount:         { color: "#555", fontSize: 11, textAlign: "right", marginTop: 4, marginBottom: 24 },
  submitBtn:         { backgroundColor: "#6c47ff", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700" },
});
