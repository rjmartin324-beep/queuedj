import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function EmojiStoryView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase   = d?.phase ?? "waiting";
  const puzzle  = d?.currentPuzzle ?? null;
  const winner  = d?.winner ?? null;
  const round   = d?.round ?? 1;
  const total   = d?.totalRounds ?? 8;
  const guesses = d?.guesses ?? {};
  const hintUsed= d?.hintUsed ?? {};
  const scores  = d?.scores ?? {};

  const myGuess    = guesses[state.guestId ?? ""];
  const myHintUsed = hintUsed[state.guestId ?? ""];
  const [text, setText] = useState("");
  const [sent, setSent]  = useState(false);

  function guess() {
    const t = text.trim();
    if (!t || sent) return;
    setSent(true);
    sendAction("guess", { text: t });
    setText("");
  }

  function useHint() {
    if (myHintUsed) return;
    sendAction("use_hint", {});
  }

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>🎭</Text><Text style={s.title}>Emoji Story</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );

  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  const showReveal = phase === "reveal";

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d1020"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
        <Text style={s.hint}>What movie / song / show do these emojis describe?</Text>
      </View>

      <View style={s.emojiCard}>
        <Text style={s.emojiText}>{puzzle?.emojis ?? "🤔"}</Text>
      </View>

      {puzzle?.hint && myHintUsed && (
        <View style={s.hintCard}>
          <Text style={s.hintText}>💡 {puzzle.hint}</Text>
        </View>
      )}

      {showReveal ? (
        <View style={s.revealCard}>
          <Text style={s.revealLabel}>The answer was:</Text>
          <Text style={s.revealAnswer}>{puzzle?.answer}</Text>
          {winner && <Text style={s.winnerText}>🎉 {memberName(winner)} got it first!</Text>}
        </View>
      ) : (
        <View style={s.inputArea}>
          {myGuess || sent ? (
            <View style={s.locked}>
              <Text style={s.lockedText}>Locked in — waiting for reveal</Text>
            </View>
          ) : (
            <>
              <View style={s.guessRow}>
                <TextInput
                  style={s.input}
                  value={text}
                  onChangeText={setText}
                  placeholder="Your answer..."
                  placeholderTextColor="#555"
                  onSubmitEditing={guess}
                  returnKeyType="send"
                />
                <TouchableOpacity style={s.guessBtn} onPress={guess} activeOpacity={0.8}>
                  <Text style={s.guessBtnText}>Send</Text>
                </TouchableOpacity>
              </View>
              {puzzle?.hint && !myHintUsed && (
                <TouchableOpacity style={s.hintBtn} onPress={useHint} activeOpacity={0.7}>
                  <Text style={s.hintBtnText}>💡 Reveal Hint</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15 },
  header: { padding: 16, gap: 4 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  hint:   { color: "#9ca3af", fontSize: 14 },
  emojiCard: { margin: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 24, padding: 32, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  emojiText: { fontSize: 52, letterSpacing: 8, textAlign: "center" },
  hintCard:  { marginHorizontal: 16, backgroundColor: "rgba(234,179,8,0.15)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(234,179,8,0.3)" },
  hintText:  { color: "#fde68a", fontSize: 14, fontWeight: "600" },
  inputArea: { padding: 16, gap: 10 },
  guessRow:  { flexDirection: "row", gap: 10 },
  input:     { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  guessBtn:  { backgroundColor: "#7c3aed", borderRadius: 14, paddingHorizontal: 18, justifyContent: "center" },
  guessBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  hintBtn:   { backgroundColor: "rgba(234,179,8,0.15)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(234,179,8,0.3)" },
  hintBtnText: { color: "#fde68a", fontWeight: "700", fontSize: 14 },
  locked:    { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 14, padding: 14, alignItems: "center" },
  lockedText:{ color: "#818cf8", fontSize: 14, fontWeight: "700" },
  revealCard:{ margin: 16, backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 20, padding: 24, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  revealLabel: { color: "#9ca3af", fontSize: 13, fontWeight: "700" },
  revealAnswer:{ color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center" },
  winnerText:  { color: "#a78bfa", fontSize: 14, fontWeight: "700" },
});
