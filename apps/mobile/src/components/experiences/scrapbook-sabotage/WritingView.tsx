import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";
import { WaitingForPlayersView } from "../shared/WaitingForPlayersView";

// ─────────────────────────────────────────────────────────────────────────────
// WritingView — guests write a response using ONLY words from the word bank
// Invalid words are highlighted; submit is blocked if any invalid words present
// ─────────────────────────────────────────────────────────────────────────────

export function WritingView() {
  const { state, sendAction } = useRoom();
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const data     = state.guestViewData as any;
  const prompt   = data?.prompt   as string   | undefined;
  const wordBank = data?.wordBank  as string[] | undefined;

  const bank = new Set(wordBank ?? []);

  // Validate words in real-time
  const words        = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  const invalidWords = words.filter((w) => !bank.has(w));
  const isValid      = text.trim().length > 0 && invalidWords.length === 0;

  function submit() {
    if (!isValid || submitted) return;
    setSubmitted(true);
    sendAction("submit_response", { text: text.trim() });
  }

  // Render text with invalid words highlighted
  function renderHighlighted() {
    if (!text) return null;
    return text.split(/(\s+)/).map((token, i) => {
      const clean = token.toLowerCase().replace(/[^a-z]/g, "");
      const bad   = clean.length > 0 && !bank.has(clean);
      return (
        <Text key={i} style={bad ? styles.badWord : styles.goodWord}>
          {token}
        </Text>
      );
    });
  }

  if (submitted) {
    return (
      <WaitingForPlayersView
        emoji="📖"
        accent="#6c47ff"
        title="Chapter Submitted!"
        subtitle="Waiting for all writers to finish their chapter..."
        submittedCount={(state.guestViewData as any)?.submittedCount}
        tips={[
          "Great authors know when to stop writing ✍️",
          "Saboteurs are watching every word 👀",
          "The story is getting weird in the best way 🌀",
          "Your chapter might just be the plot twist 🎭",
          "Literary masterpiece incoming 📚",
        ]}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>SCRAPBOOK SABOTAGE</Text>
      <Text style={styles.prompt}>{prompt}</Text>

      {/* Word bank reminder */}
      <View style={styles.bankRow}>
        {(wordBank ?? []).slice(0, 12).map((w) => (
          <Text key={w} style={styles.bankChip}>{w}</Text>
        ))}
        {(wordBank?.length ?? 0) > 12 && (
          <Text style={styles.bankMore}>+{(wordBank?.length ?? 0) - 12} more</Text>
        )}
      </View>

      <TextInput
        style={[styles.input, submitted && styles.inputDisabled]}
        value={text}
        onChangeText={setText}
        placeholder="Write your response using only bank words..."
        placeholderTextColor="#555"
        multiline
        maxLength={500}
        editable={!submitted}
      />

      {/* Live preview with highlighting */}
      {text.length > 0 && (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Preview:</Text>
          <Text style={styles.previewText}>{renderHighlighted()}</Text>
        </View>
      )}

      {invalidWords.length > 0 && (
        <Text style={styles.errorText}>
          Not in bank: {invalidWords.slice(0, 5).join(", ")}
          {invalidWords.length > 5 ? ` +${invalidWords.length - 5} more` : ""}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, (!isValid || submitted) && styles.submitBtnDisabled]}
        onPress={submit}
        disabled={!isValid || submitted}
      >
        <Text style={styles.submitBtnText}>Submit Response</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:         { padding: 24, paddingBottom: 48 },
  eyebrow:           { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  prompt:            { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16, lineHeight: 28 },
  bankRow:           { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  bankChip:          { backgroundColor: "#1e1e2e", color: "#c4b5fd", fontSize: 11, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bankMore:          { color: "#555", fontSize: 11, paddingVertical: 4 },
  input:             { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, color: "#fff", fontSize: 15, minHeight: 100, textAlignVertical: "top", borderWidth: 1, borderColor: "#333", marginBottom: 12 },
  inputDisabled:     { opacity: 0.5 },
  preview:           { backgroundColor: "#111", borderRadius: 10, padding: 14, marginBottom: 8 },
  previewLabel:      { color: "#555", fontSize: 11, marginBottom: 4 },
  previewText:       { fontSize: 15, lineHeight: 22, flexWrap: "wrap" },
  goodWord:          { color: "#fff" },
  badWord:           { color: "#ef4444", textDecorationLine: "underline" },
  errorText:         { color: "#ef4444", fontSize: 12, marginBottom: 12 },
  submitBtn:         { backgroundColor: "#6c47ff", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700" },
});
