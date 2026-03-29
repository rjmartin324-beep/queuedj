import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function WordAssociationView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase       = d?.phase ?? "waiting";
  const chain       = d?.chain ?? [];
  const currentTurn = d?.currentTurn ?? "";
  const round       = d?.round ?? 1;
  const total       = d?.totalRounds ?? 10;
  const scores      = d?.scores ?? {};

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
    <View style={s.center}><Text style={s.emoji}>🔗</Text><Text style={s.title}>Word Association</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  const lastWord = chain[chain.length - 1] ?? null;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d0a1a"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
        <Text style={s.turnLabel}>
          {isMyTurn ? "🎯 Your turn!" : `${memberName(currentTurn)}'s turn`}
        </Text>
      </View>

      {lastWord && (
        <View style={s.lastWordCard}>
          <Text style={s.lastWordLabel}>LAST WORD</Text>
          <Text style={s.lastWordText}>{lastWord}</Text>
        </View>
      )}

      <ScrollView style={s.chain} contentContainerStyle={s.chainContent}>
        {chain.slice(-8).map((w: string, i: number) => (
          <Text key={i} style={[s.chainWord, i === chain.slice(-8).length - 1 && s.chainWordLast]}>
            {w}
          </Text>
        ))}
      </ScrollView>

      {isMyTurn ? (
        <View style={s.inputArea}>
          <Text style={s.inputLabel}>Say a word associated with: <Text style={s.inputHighlight}>{lastWord ?? "start"}</Text></Text>
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
              <Text style={s.sendBtnText}>→</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={s.waiting}>
          <Text style={s.waitingText}>Waiting for {memberName(currentTurn)}...</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  turnLabel: { color: "#a78bfa", fontSize: 14, fontWeight: "700" },
  lastWordCard: { margin: 16, backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 20, padding: 24, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  lastWordLabel:{ color: "#9ca3af", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  lastWordText: { color: "#fff", fontSize: 36, fontWeight: "900" },
  chain:   { flex: 1, paddingHorizontal: 16 },
  chainContent: { gap: 6, paddingVertical: 8 },
  chainWord:     { color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center" },
  chainWordLast: { color: "#fff", fontSize: 18, fontWeight: "700" },
  inputArea: { padding: 16, gap: 8 },
  inputLabel:    { color: "#9ca3af", fontSize: 14 },
  inputHighlight:{ color: "#a78bfa", fontWeight: "800" },
  row:     { flexDirection: "row", gap: 10 },
  input:   { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 18, fontWeight: "700", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sendBtn: { backgroundColor: "#7c3aed", borderRadius: 14, width: 52, justifyContent: "center", alignItems: "center" },
  sendBtnText: { color: "#fff", fontSize: 22, fontWeight: "900" },
  waiting: { margin: 16, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, alignItems: "center" },
  waitingText: { color: "#6b7280", fontSize: 14 },
});
