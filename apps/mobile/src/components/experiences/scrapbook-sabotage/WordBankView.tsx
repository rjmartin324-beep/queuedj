import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// WordBankView — shows the combined word bank extracted from all submissions
// Everyone reads it before the writing phase begins
// ─────────────────────────────────────────────────────────────────────────────

export function WordBankView() {
  const { state } = useRoom();
  const wordBank = (state.guestViewData as any)?.wordBank as string[] | undefined;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>YOUR WORD BANK</Text>
      <Text style={styles.title}>These are the only words you can use</Text>
      <Text style={styles.hint}>Your response must be built entirely from these words.</Text>

      <View style={styles.pills}>
        {(wordBank ?? []).map((word) => (
          <View key={word} style={styles.pill}>
            <Text style={styles.pillText}>{word}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.waiting}>Waiting for host to start writing...</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  eyebrow:   { color: "#6c47ff", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  title:     { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  hint:      { color: "#888", fontSize: 13, marginBottom: 24 },
  pills:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 32 },
  pill:      { backgroundColor: "#1e1e2e", borderWidth: 1, borderColor: "#6c47ff44", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  pillText:  { color: "#c4b5fd", fontSize: 14, fontWeight: "500" },
  waiting:   { color: "#555", fontSize: 14, textAlign: "center" },
});
