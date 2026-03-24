import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// WordInputView — guests describe a topic freely
// Their words become the word bank everyone must write with
// ─────────────────────────────────────────────────────────────────────────────

export function WordInputView() {
  const { state, sendAction } = useRoom();
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const prompt         = (state.guestViewData as any)?.prompt as string | undefined;
  const submittedCount = (state.guestViewData as any)?.submittedCount as number | undefined;

  function submit() {
    if (!text.trim() || submitted) return;
    setSubmitted(true);
    sendAction("submit_word_bank", { text: text.trim() });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>BUILD THE WORD BANK</Text>
      <Text style={styles.prompt}>{prompt}</Text>
      <Text style={styles.hint}>
        Describe it freely — your words become everyone's writing palette.
      </Text>

      <TextInput
        style={[styles.input, submitted && styles.inputDisabled]}
        value={text}
        onChangeText={setText}
        placeholder="Type your description..."
        placeholderTextColor="#555"
        multiline
        maxLength={300}
        editable={!submitted}
      />
      <Text style={styles.charCount}>{text.length}/300</Text>

      <TouchableOpacity
        style={[styles.submitBtn, (submitted || !text.trim()) && styles.submitBtnDisabled]}
        onPress={submit}
        disabled={submitted || !text.trim()}
      >
        <Text style={styles.submitBtnText}>
          {submitted ? `Submitted! (${submittedCount ?? "?"} so far)` : "Submit"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, padding: 24, justifyContent: "center" },
  eyebrow:           { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  prompt:            { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 8, lineHeight: 30 },
  hint:              { color: "#888", fontSize: 13, marginBottom: 24 },
  input:             { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, color: "#fff", fontSize: 16, minHeight: 120, textAlignVertical: "top", borderWidth: 1, borderColor: "#333" },
  inputDisabled:     { opacity: 0.5 },
  charCount:         { color: "#555", fontSize: 11, textAlign: "right", marginTop: 4, marginBottom: 24 },
  submitBtn:         { backgroundColor: "#6c47ff", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700" },
});
