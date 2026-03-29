import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function MindReadingView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase   = d?.phase ?? "waiting";
  const puzzle  = d?.currentPuzzle ?? null;
  const answers = d?.answers ?? {};
  const round   = d?.round ?? 1;
  const total   = d?.totalRounds ?? 8;
  const correct = d?.currentPuzzle?.correct ?? null; // only on reveal

  const myAnswer = answers[state.guestId ?? ""];
  const [picked, setPicked] = useState<number|null>(null);

  function answer(idx: number) {
    if (picked !== null || myAnswer !== undefined) return;
    setPicked(idx);
    sendAction("answer", { optionIndex: idx });
  }

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>🧠</Text><Text style={s.title}>Mind Reading</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  const options: string[] = puzzle?.options ?? [];
  const showReveal = phase === "reveal";
  const choice = picked ?? (myAnswer as number | undefined) ?? null;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d1020"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>PUZZLE {round} / {total}</Text>
      </View>

      {puzzle && (
        <View style={s.puzzleCard}>
          {puzzle.setup && <Text style={s.setup}>{puzzle.setup}</Text>}
          <Text style={s.question}>{puzzle.question}</Text>
        </View>
      )}

      <View style={s.options}>
        {options.map((opt: string, i: number) => {
          const isChoice  = choice === i;
          const isCorrect = showReveal && correct === i;
          const isWrong   = showReveal && isChoice && !isCorrect;

          return (
            <TouchableOpacity
              key={i}
              style={[s.option, isChoice && s.optionSelected, isCorrect && s.optionCorrect, isWrong && s.optionWrong]}
              onPress={() => answer(i)}
              disabled={choice !== null || showReveal}
              activeOpacity={0.8}
            >
              <Text style={s.optionLetter}>{String.fromCharCode(65+i)}</Text>
              <Text style={s.optionText}>{opt}</Text>
              {isCorrect && <Text style={s.mark}>✓</Text>}
              {isWrong   && <Text style={s.mark}>✗</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {choice !== null && !showReveal && (
        <View style={s.locked}><Text style={s.lockedText}>Locked in — waiting for reveal</Text></View>
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
  header: { padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  puzzleCard: { margin: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", gap: 8 },
  setup:    { color: "#9ca3af", fontSize: 14, fontStyle: "italic", lineHeight: 20 },
  question: { color: "#fff", fontSize: 19, fontWeight: "800", lineHeight: 26 },
  options:  { paddingHorizontal: 16, gap: 10 },
  option:   { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, padding: 16, gap: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)" },
  optionSelected: { borderColor: "#a78bfa", backgroundColor: "rgba(167,139,250,0.15)" },
  optionCorrect:  { borderColor: "#4ade80", backgroundColor: "rgba(34,197,94,0.15)" },
  optionWrong:    { borderColor: "#f87171", backgroundColor: "rgba(239,68,68,0.15)" },
  optionLetter: { color: "#a78bfa", fontWeight: "900", fontSize: 16, width: 24 },
  optionText:   { flex: 1, color: "#e5e7eb", fontSize: 15 },
  mark:         { fontSize: 20, fontWeight: "900", color: "#fff" },
  locked: { margin: 16, backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 14, padding: 12, alignItems: "center" },
  lockedText: { color: "#818cf8", fontSize: 13, fontWeight: "700" },
});
