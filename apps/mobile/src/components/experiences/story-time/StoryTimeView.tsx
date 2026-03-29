import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function StoryTimeView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase: string = d?.phase ?? "waiting";
  const story: string[] = d?.story ?? [];
  const currentTurn: string | null = d?.currentTurn ?? null;
  const wordCount: number = d?.wordCount ?? 0;
  const totalRounds: number = d?.totalRounds ?? 20;
  const scores: Record<string, number> = d?.scores ?? {};
  const myId = state.guestId ?? "";
  const isMyTurn = currentTurn === myId;

  const [word, setWord] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  // Clear input whenever the turn changes
  useEffect(() => {
    setWord("");
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [currentTurn, story.length]);

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  function submitWord() {
    const trimmed = word.trim();
    if (!trimmed || !isMyTurn || phase !== "playing") return;
    sendAction("add_word", { word: trimmed });
    setWord("");
  }

  if (phase === "waiting") return (
    <View style={s.center}>
      <Text style={s.emoji}>📖</Text>
      <Text style={s.title}>Story Time</Text>
      <Text style={s.sub}>Waiting for host to start...</Text>
    </View>
  );

  if (phase === "finished") {
    const storyText = story.join(" ");
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    return (
      <View style={s.root}>
        <LinearGradient colors={["#0a0820","#0d1020"]} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={s.finishedContent}>
          <Text style={s.finishedEmoji}>📖</Text>
          <Text style={s.finishedTitle}>Our Story</Text>
          <View style={s.storyFinal}>
            <Text style={s.storyFinalText}>{storyText}</Text>
          </View>
          <Text style={s.scoresTitle}>Word Contributors</Text>
          {sorted.map(([id, pts], i) => (
            <View key={id} style={s.scoreRow}>
              <Text style={s.scoreRank}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</Text>
              <Text style={s.scoreName}>{id === myId ? "You" : memberName(id)}</Text>
              <Text style={s.scorePts}>{pts} pts</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Build annotated story: last word highlighted
  const storyWithoutLast = story.slice(0, -1);
  const lastWord = story[story.length - 1] ?? null;

  const nextPlayer = currentTurn ? memberName(currentTurn) : null;
  const progress = totalRounds > 0 ? wordCount / totalRounds : 0;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","0d1020"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.eyebrow}>STORY TIME</Text>
        <Text style={s.wordCount}>{wordCount} / {totalRounds} words</Text>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Story so far */}
      <ScrollView
        ref={scrollRef}
        style={s.storyScroll}
        contentContainerStyle={s.storyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.storyBubble}>
          <Text style={s.storyText}>
            {storyWithoutLast.join(" ")}
            {storyWithoutLast.length > 0 ? " " : ""}
            {lastWord && (
              <Text style={s.lastWordHighlight}>{lastWord}</Text>
            )}
          </Text>
          {story.length === 0 && (
            <Text style={s.storyPlaceholder}>The story starts here...</Text>
          )}
        </View>
      </ScrollView>

      {/* Turn indicator */}
      <View style={[s.turnCard, isMyTurn && s.turnCardMe]}>
        {isMyTurn ? (
          <>
            <Text style={s.turnEmoji}>✍️</Text>
            <Text style={s.turnTextMe}>Your turn — add the next word!</Text>
          </>
        ) : (
          <>
            <Text style={s.turnEmoji}>⏳</Text>
            <Text style={s.turnText}>{nextPlayer ? `${nextPlayer}'s turn` : "Waiting for next turn..."}</Text>
          </>
        )}
      </View>

      {/* Input — only shown on your turn */}
      {isMyTurn && phase === "playing" && (
        <View style={s.inputArea}>
          <TextInput
            style={s.input}
            value={word}
            onChangeText={setWord}
            placeholder="One word only..."
            placeholderTextColor="#555"
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={submitWord}
            maxLength={30}
          />
          <TouchableOpacity style={s.sendBtn} onPress={submitWord} activeOpacity={0.8}>
            <LinearGradient colors={["#7c3aed","#6d28d9"]} style={s.sendInner}>
              <Text style={s.sendText}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  eyebrow:   { color: "#a78bfa", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  wordCount: { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  progressTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.08)", marginHorizontal: 16, borderRadius: 2 },
  progressFill:  { height: "100%", backgroundColor: "#a78bfa", borderRadius: 2 },

  storyScroll: { flex: 1, marginTop: 12 },
  storyContent:{ padding: 16, paddingBottom: 8 },
  storyBubble: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", minHeight: 100 },
  storyText:   { color: "#e5e7eb", fontSize: 18, lineHeight: 28, fontWeight: "600" },
  lastWordHighlight: { color: "#a78bfa", fontWeight: "900" },
  storyPlaceholder:  { color: "#374151", fontSize: 16, fontStyle: "italic" },

  turnCard:   { margin: 16, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  turnCardMe: { backgroundColor: "rgba(124,58,237,0.2)", borderColor: "rgba(167,139,250,0.4)" },
  turnEmoji:  { fontSize: 22 },
  turnText:   { color: "#9ca3af", fontSize: 15, fontWeight: "700", flex: 1 },
  turnTextMe: { color: "#a78bfa", fontSize: 15, fontWeight: "900", flex: 1 },

  inputArea: { flexDirection: "row", padding: 16, paddingTop: 0, gap: 10 },
  input:     { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 18, fontWeight: "700", borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  sendBtn:   { borderRadius: 14, overflow: "hidden", width: 52, justifyContent: "center" },
  sendInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  sendText:  { color: "#fff", fontSize: 22, fontWeight: "900" },

  // Finished screen
  finishedContent: { padding: 24, gap: 16, paddingBottom: 48 },
  finishedEmoji:   { fontSize: 56, textAlign: "center" },
  finishedTitle:   { color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center" },
  storyFinal:      { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  storyFinalText:  { color: "#e5e7eb", fontSize: 17, lineHeight: 26, fontWeight: "600" },
  scoresTitle:     { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginTop: 8 },
  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  scoreRank: { fontSize: 22, minWidth: 36 },
  scoreName: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "700" },
  scorePts:  { color: "#a78bfa", fontSize: 16, fontWeight: "900" },
});
