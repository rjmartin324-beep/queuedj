import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// CroppedLookView — Guest view for the Cropped Look experience
//
// Server sends state with:
//   phase: "waiting" | "question" | "reveal" | "finished"
//   currentPuzzle: { emojis: string[] }  (answer hidden, sliced to revealLevel+1)
//   correctGuessers: string[]
//   revealLevel: number (0–3)
//   round / totalRounds / scores
// ─────────────────────────────────────────────────────────────────────────────

export function CroppedLookView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any;
  const myGuestId = state.guestId;
  const [guess, setGuess] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Reset submitted state when round changes
  const round = data?.round;
  React.useEffect(() => { setGuess(""); setSubmitted(false); }, [round]);

  if (!data) {
    return (
      <LinearGradient colors={["#03001c", "#001020"]} style={s.flex}>
        <View style={s.center}><Text style={s.waiting}>🔍 Waiting for host…</Text></View>
      </LinearGradient>
    );
  }

  const { phase, currentPuzzle, correctGuessers = [], revealLevel = 0, scores = {}, totalRounds } = data;
  const alreadyCorrect = correctGuessers.includes(myGuestId);
  const myPoints = scores[myGuestId ?? ""] ?? 0;

  function submitGuess() {
    const trimmed = guess.trim();
    if (!trimmed) return;
    setSubmitted(true);
    sendAction("guess", { text: trimmed });
  }

  // ── Waiting ──────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <LinearGradient colors={["#03001c", "#001020"]} style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 56 }}>🔍</Text>
          <Text style={s.title}>Cropped Look</Text>
          <Text style={s.sub}>Guess what the emojis are depicting. More hints = fewer points.</Text>
        </View>
      </LinearGradient>
    );
  }

  // ── Finished ─────────────────────────────────────────────────────────────
  if (phase === "finished") {
    const sorted = Object.entries(scores as Record<string, number>)
      .sort(([, a], [, b]) => b - a);
    return (
      <LinearGradient colors={["#03001c", "#001020"]} style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🏆</Text>
          <Text style={s.title}>Final Scores</Text>
          {sorted.map(([gId, pts], i) => {
            const name = state.members.find(m => m.guestId === gId)?.displayName ?? gId.slice(0, 8);
            return (
              <View key={gId} style={s.scoreRow}>
                <Text style={s.scoreName}>{i + 1}. {name}</Text>
                <Text style={s.scorePts}>{pts} pts</Text>
              </View>
            );
          })}
        </View>
      </LinearGradient>
    );
  }

  // ── Question ─────────────────────────────────────────────────────────────
  const visibleEmojis: string[] = currentPuzzle?.emojis ?? [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <LinearGradient colors={["#03001c", "#001020"]} style={s.flex}>
        <View style={s.header}>
          <Text style={s.roundLabel}>Round {round}/{totalRounds}</Text>
          <Text style={s.pts}>{myPoints} pts</Text>
        </View>

        <View style={s.emojiSection}>
          <View style={s.emojiBox}>
            <Text style={s.emojiText}>{visibleEmojis.join("  ")}</Text>
          </View>
          <Text style={s.hint}>
            {revealLevel === 0 ? "First hint only — more coming if you need them" :
             revealLevel === 1 ? "Hint 2 revealed" :
             revealLevel === 2 ? "Hint 3 revealed" :
             "All hints shown"}
          </Text>
        </View>

        {alreadyCorrect ? (
          <View style={s.correctBanner}>
            <Text style={s.correctText}>✓ You got it! Waiting for others…</Text>
          </View>
        ) : submitted ? (
          <View style={s.waitBanner}>
            <Text style={s.waitText}>⏳ Answer submitted — waiting for reveal…</Text>
          </View>
        ) : (
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={guess}
              onChangeText={setGuess}
              placeholder="What is it?"
              placeholderTextColor="#333"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={submitGuess}
            />
            <TouchableOpacity onPress={submitGuess} style={s.sendBtn}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.sendBtnInner}>
                <Text style={s.sendArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {correctGuessers.length > 0 && (
          <Text style={s.guessedCount}>
            {correctGuessers.length} {correctGuessers.length === 1 ? "person has" : "people have"} guessed correctly
          </Text>
        )}
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:         { flex: 1 },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  title:        { color: "#fff", fontSize: 26, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  sub:          { color: "#888", fontSize: 13, textAlign: "center" },
  waiting:      { color: "#666", fontSize: 16 },
  header:       { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  roundLabel:   { color: "#888", fontSize: 14, fontWeight: "700" },
  pts:          { color: "#a78bfa", fontSize: 14, fontWeight: "800" },
  emojiSection: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emojiBox:     { backgroundColor: "#111", borderRadius: 20, padding: 24, marginBottom: 16 },
  emojiText:    { fontSize: 40, textAlign: "center", lineHeight: 60 },
  hint:         { color: "#555", fontSize: 12, textAlign: "center" },
  correctBanner:{ marginHorizontal: 20, marginBottom: 16, backgroundColor: "rgba(22,163,74,0.15)", borderRadius: 14, padding: 14 },
  correctText:  { color: "#4ade80", fontSize: 15, fontWeight: "700", textAlign: "center" },
  waitBanner:   { marginHorizontal: 20, marginBottom: 16, backgroundColor: "rgba(167,139,250,0.1)", borderRadius: 14, padding: 14 },
  waitText:     { color: "#a78bfa", fontSize: 14, textAlign: "center" },
  inputRow:     { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  input:        { flex: 1, backgroundColor: "#1a1a3a", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 16 },
  sendBtn:      { borderRadius: 14, overflow: "hidden" },
  sendBtnInner: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  sendArrow:    { color: "#fff", fontSize: 18, fontWeight: "900" },
  guessedCount: { color: "#555", fontSize: 12, textAlign: "center", paddingBottom: 12 },
  scoreRow:     { flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 8, paddingHorizontal: 8 },
  scoreName:    { color: "#ccc", fontSize: 16 },
  scorePts:     { color: "#a78bfa", fontSize: 16, fontWeight: "700" },
});
