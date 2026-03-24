import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// RevealView — the Glitch is exposed, both prompts shown, round scores
// ─────────────────────────────────────────────────────────────────────────────

export function GlitchRevealView() {
  const { state } = useRoom();
  const data = state.guestViewData as any;

  if (!data) return null;

  const {
    state: gameState,
    realPrompt,
    glitchPrompt,
  } = data;

  const { glitchGuestId, glitchWon, descriptions, votes, scores, roundScores } = gameState ?? {};
  const myId = state.guestId;
  const amIGlitch = myId === glitchGuestId;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Identity reveal */}
      <View style={[styles.revealBox, glitchWon ? styles.revealBoxGlitchWon : styles.revealBoxCaught]}>
        <Text style={styles.revealLabel}>
          {glitchWon ? "THE GLITCH ESCAPED!" : "THE GLITCH IS CAUGHT!"}
        </Text>
        <Text style={styles.revealSub}>
          {amIGlitch ? "You were the Glitch." : `A player among you was the Glitch.`}
        </Text>
      </View>

      {/* Both prompts */}
      <View style={styles.promptRow}>
        <View style={[styles.promptBox, styles.realBox]}>
          <Text style={styles.promptLabel}>REAL PROMPT</Text>
          <Text style={styles.promptText}>{realPrompt?.realDescription}</Text>
        </View>
        <View style={[styles.promptBox, styles.glitchBox]}>
          <Text style={styles.promptLabel}>GLITCH PROMPT</Text>
          <Text style={styles.promptText}>{glitchPrompt?.glitchDescription}</Text>
        </View>
      </View>

      {/* Descriptions recap */}
      <Text style={styles.sectionLabel}>What everyone said</Text>
      {Object.entries(descriptions as Record<string, string> ?? {}).map(([gId, text]) => {
        const isGlitch = gId === glitchGuestId;
        const isMe     = gId === myId;
        return (
          <View key={gId} style={[styles.descCard, isGlitch && styles.descCardGlitch]}>
            <Text style={styles.descAuthor}>
              {isMe ? "You" : "Guest"} {isGlitch ? "— THE GLITCH" : ""}
            </Text>
            <Text style={styles.descText}>{text}</Text>
          </View>
        );
      })}

      {/* Round scores */}
      {roundScores && (
        <>
          <Text style={styles.sectionLabel}>Round scores</Text>
          {Object.entries(roundScores as Record<string, number>)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([gId, pts]) => (
              <View key={gId} style={styles.scoreRow}>
                <Text style={styles.scoreGuest}>{gId === myId ? "You" : "Guest"}</Text>
                <Text style={[styles.scorePts, (pts as number) > 0 ? styles.ptsPos : styles.ptsZero]}>
                  {(pts as number) > 0 ? `+${pts}` : "0"} pts
                </Text>
              </View>
            ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:          { padding: 24, paddingBottom: 48 },
  revealBox:          { borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 24 },
  revealBoxGlitchWon: { backgroundColor: "#ef444422", borderWidth: 1, borderColor: "#ef4444" },
  revealBoxCaught:    { backgroundColor: "#22c55e22", borderWidth: 1, borderColor: "#22c55e" },
  revealLabel:        { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center" },
  revealSub:          { color: "#aaa", fontSize: 14, marginTop: 8, textAlign: "center" },
  promptRow:          { flexDirection: "row", gap: 12, marginBottom: 24 },
  promptBox:          { flex: 1, borderRadius: 12, padding: 14 },
  realBox:            { backgroundColor: "#1e2e1e", borderWidth: 1, borderColor: "#22c55e44" },
  glitchBox:          { backgroundColor: "#2e1e1e", borderWidth: 1, borderColor: "#ef444444" },
  promptLabel:        { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 6, color: "#888" },
  promptText:         { color: "#fff", fontSize: 13, lineHeight: 18 },
  sectionLabel:       { color: "#555", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 10 },
  descCard:           { backgroundColor: "#1a1a1a", borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#333" },
  descCardGlitch:     { borderColor: "#ef4444" },
  descAuthor:         { color: "#ef4444", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  descText:           { color: "#fff", fontSize: 14, lineHeight: 20 },
  scoreRow:           { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#222" },
  scoreGuest:         { color: "#fff", fontSize: 14 },
  scorePts:           { fontSize: 14, fontWeight: "700" },
  ptsPos:             { color: "#22c55e" },
  ptsZero:            { color: "#555" },
});
