import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// RevealView — shows the judge's real score vs everyone's guesses
// ─────────────────────────────────────────────────────────────────────────────

export function RevealView() {
  const { state } = useRoom();
  const data = state.guestViewData as any;

  if (!data) return null;

  const { prompt, judgeId, judgeScore, guesses, bets, pointsEarned } = data;
  const myId = state.guestId;

  const sorted = Object.entries(guesses as Record<string, number>)
    .sort(([, a], [, b]) => {
      const diffA = Math.abs((a as number) - judgeScore);
      const diffB = Math.abs((b as number) - judgeScore);
      return diffA - diffB;
    });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.prompt}>{prompt}</Text>
      <View style={styles.answerBox}>
        <Text style={styles.answerLabel}>Judge's real score</Text>
        <Text style={styles.answerScore}>{judgeScore}</Text>
        <Text style={styles.answerSub}>out of 10</Text>
      </View>

      <Text style={styles.sectionLabel}>Results</Text>
      {sorted.map(([gId, guess]) => {
        const pts    = (pointsEarned as Record<string, number>)[gId] ?? 0;
        const hasBet = (bets as Record<string, boolean>)[gId];
        const diff   = Math.abs((guess as number) - judgeScore);
        const isMe   = gId === myId;
        const isJudge = gId === judgeId;

        return (
          <View key={gId} style={[styles.row, isMe && styles.rowMe]}>
            <View style={styles.rowLeft}>
              <Text style={styles.guestLabel}>
                {isMe ? "You" : isJudge ? "Judge" : `Guest`}
                {hasBet ? " ⚡" : ""}
              </Text>
              <Text style={styles.guess}>Guessed {isJudge ? "—" : guess}</Text>
            </View>
            <View style={styles.rowRight}>
              {diff === 0 && !isJudge && <Text style={styles.exactTag}>EXACT</Text>}
              {diff === 1 && !isJudge && <Text style={styles.closeTag}>CLOSE</Text>}
              <Text style={[styles.pts, pts > 0 ? styles.ptsPos : styles.ptsZero]}>
                {pts > 0 ? `+${pts}` : "0"} pts
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { padding: 24, paddingBottom: 48 },
  prompt:       { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 24, lineHeight: 26 },
  answerBox:    { backgroundColor: "#6c47ff", borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 32 },
  answerLabel:  { color: "#c4b5fd", fontSize: 12, fontWeight: "600", letterSpacing: 1 },
  answerScore:  { color: "#fff", fontSize: 64, fontWeight: "900", lineHeight: 72 },
  answerSub:    { color: "#c4b5fd", fontSize: 14 },
  sectionLabel: { color: "#666", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  row:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, backgroundColor: "#1a1a1a", borderRadius: 10, marginBottom: 8 },
  rowMe:        { borderWidth: 1, borderColor: "#6c47ff" },
  rowLeft:      { gap: 2 },
  rowRight:     { alignItems: "flex-end", gap: 4 },
  guestLabel:   { color: "#fff", fontSize: 14, fontWeight: "600" },
  guess:        { color: "#888", fontSize: 12 },
  exactTag:     { color: "#22c55e", fontSize: 11, fontWeight: "700" },
  closeTag:     { color: "#f59e0b", fontSize: 11, fontWeight: "700" },
  pts:          { fontSize: 16, fontWeight: "700" },
  ptsPos:       { color: "#22c55e" },
  ptsZero:      { color: "#555" },
});
