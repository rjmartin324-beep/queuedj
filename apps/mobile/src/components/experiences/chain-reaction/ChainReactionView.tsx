import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function ChainReactionView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase       = d?.phase ?? "waiting";
  const chain       = d?.chain ?? [];
  const category    = d?.category ?? "";
  const currentTurn = d?.currentTurn ?? "";
  const round       = d?.round ?? 1;
  const total       = d?.totalRounds ?? 8;

  const isMyTurn = state.guestId === currentTurn;
  const [word, setWord] = useState("");

  function submit() {
    const w = word.trim();
    if (!w || !isMyTurn) return;
    sendAction("submit_word", { word: w });
    setWord("");
  }

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>⚡</Text><Text style={s.title}>Chain Reaction</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  const lastWord = chain[chain.length - 1] ?? null;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d1020"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
        <View style={s.categoryBadge}><Text style={s.categoryText}>{category}</Text></View>
      </View>

      <Text style={s.turnLabel}>
        {isMyTurn ? "🎯 Your turn!" : `Waiting for ${memberName(currentTurn)}...`}
      </Text>

      {lastWord && (
        <View style={s.lastCard}>
          <Text style={s.lastLabel}>LAST WORD</Text>
          <Text style={s.lastWord}>{lastWord}</Text>
        </View>
      )}

      <ScrollView style={s.chain} contentContainerStyle={s.chainContent} horizontal showsHorizontalScrollIndicator={false}>
        {chain.slice(-6).map((w: string, i: number, arr: string[]) => (
          <React.Fragment key={i}>
            <Text style={[s.chainWord, i === arr.length - 1 && s.chainWordLast]}>{w}</Text>
            {i < arr.length - 1 && <Text style={s.arrow}>→</Text>}
          </React.Fragment>
        ))}
      </ScrollView>

      {isMyTurn && (
        <View style={s.inputArea}>
          <Text style={s.prompt}>Must be in category: <Text style={s.promptHighlight}>{category}</Text></Text>
          <View style={s.row}>
            <TextInput
              style={s.input}
              value={word}
              onChangeText={setWord}
              placeholder="Your word..."
              placeholderTextColor="#555"
              autoFocus
              onSubmitEditing={submit}
              returnKeyType="send"
            />
            <TouchableOpacity style={s.sendBtn} onPress={submit} activeOpacity={0.8}>
              <Text style={s.sendText}>→</Text>
            </TouchableOpacity>
          </View>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  categoryBadge: { backgroundColor: "rgba(124,58,237,0.25)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  categoryText:  { color: "#a78bfa", fontSize: 13, fontWeight: "700" },
  turnLabel: { textAlign: "center", color: "#e5e7eb", fontSize: 15, fontWeight: "700", paddingHorizontal: 16 },
  lastCard:  { margin: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 24, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  lastLabel: { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  lastWord:  { color: "#fff", fontSize: 36, fontWeight: "900" },
  chain:     { flexGrow: 0, paddingHorizontal: 16, marginBottom: 8 },
  chainContent: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  chainWord:     { color: "rgba(255,255,255,0.4)", fontSize: 14 },
  chainWordLast: { color: "#a78bfa", fontWeight: "700" },
  arrow:     { color: "#374151", fontSize: 14 },
  inputArea: { padding: 16, gap: 8 },
  prompt:    { color: "#9ca3af", fontSize: 14 },
  promptHighlight: { color: "#a78bfa", fontWeight: "800" },
  row:       { flexDirection: "row", gap: 10 },
  input:     { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 18, fontWeight: "700", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sendBtn:   { backgroundColor: "#7c3aed", borderRadius: 14, width: 52, justifyContent: "center", alignItems: "center" },
  sendText:  { color: "#fff", fontSize: 22, fontWeight: "900" },
});
