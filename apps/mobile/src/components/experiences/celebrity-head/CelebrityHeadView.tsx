import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function CelebrityHeadView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase           = d?.phase ?? "waiting";
  const currentGuestId  = d?.currentGuestId ?? "";
  const celebrity       = d?.celebrity ?? "";
  const lastAnswer      = d?.lastAnswer ?? null;
  const questionsAsked  = d?.questionsAsked ?? 0;
  const round           = d?.round ?? 1;
  const total           = d?.totalRounds ?? 5;
  const scores          = d?.scores ?? {};
  const passesLeft      = d?.passesLeft ?? 1;

  const isMe = state.guestId === currentGuestId;

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>🤩</Text><Text style={s.title}>Celebrity Head</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );

  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#1a0840"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
        <Text style={s.qCount}>{questionsAsked} questions asked</Text>
      </View>

      {/* Celebrity display — hidden from the hot-seat player */}
      <View style={s.celebCard}>
        {isMe ? (
          <View style={s.hiddenCard}>
            <Text style={s.hiddenEmoji}>🙈</Text>
            <Text style={s.hiddenTitle}>You're in the hot seat!</Text>
            <Text style={s.hiddenSub}>Ask yes/no questions to guess who you are</Text>
            <Text style={s.questionsTip}>The host will answer YES or NO</Text>
          </View>
        ) : (
          <View style={s.celebReveal}>
            <Text style={s.celebLabel}>{memberName(currentGuestId)} IS:</Text>
            <Text style={s.celebName}>{celebrity}</Text>
          </View>
        )}
      </View>

      {lastAnswer && (
        <View style={[s.answerBadge, { backgroundColor: lastAnswer === "yes" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)" }]}>
          <Text style={[s.answerText, { color: lastAnswer === "yes" ? "#4ade80" : "#f87171" }]}>
            Last answer: {lastAnswer.toUpperCase()}
          </Text>
        </View>
      )}

      {phase === "reveal" && (
        <View style={s.revealCard}>
          <Text style={s.revealLabel}>The celebrity was:</Text>
          <Text style={s.revealName}>{celebrity}</Text>
        </View>
      )}

      {isMe && phase === "playing" && (
        <View style={s.myActions}>
          <TouchableOpacity style={s.gotItBtn} onPress={() => sendAction("got_it", {})} activeOpacity={0.8}>
            <LinearGradient colors={["#16a34a","#15803d"]} style={s.actionInner}>
              <Text style={s.actionText}>✓ I know who I am! (+400 pts)</Text>
            </LinearGradient>
          </TouchableOpacity>
          {passesLeft > 0 && (
            <TouchableOpacity style={s.passBtn} onPress={() => sendAction("pass", {})} activeOpacity={0.8}>
              <Text style={s.passText}>Pass ({passesLeft} left)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!isMe && phase === "playing" && (
        <View style={s.watching}>
          <Text style={s.watchingText}>Shh! Don't give it away 🤫</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  qCount: { color: "#6b7280", fontSize: 12 },
  celebCard: { margin: 16 },
  hiddenCard: { backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 24, padding: 32, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  hiddenEmoji:  { fontSize: 56 },
  hiddenTitle:  { color: "#fff", fontSize: 20, fontWeight: "900" },
  hiddenSub:    { color: "#a78bfa", fontSize: 15, textAlign: "center" },
  questionsTip: { color: "#6b7280", fontSize: 13, textAlign: "center" },
  celebReveal:  { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 24, padding: 32, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  celebLabel:   { color: "#6b7280", fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  celebName:    { color: "#fff", fontSize: 32, fontWeight: "900", textAlign: "center" },
  answerBadge:  { marginHorizontal: 16, borderRadius: 14, padding: 14, alignItems: "center" },
  answerText:   { fontSize: 20, fontWeight: "900" },
  revealCard:   { margin: 16, backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 20, padding: 24, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  revealLabel:  { color: "#9ca3af", fontSize: 13, fontWeight: "700" },
  revealName:   { color: "#fff", fontSize: 28, fontWeight: "900" },
  myActions:    { padding: 16, gap: 10 },
  gotItBtn:     { borderRadius: 16, overflow: "hidden" },
  actionInner:  { padding: 16, alignItems: "center" },
  actionText:   { color: "#fff", fontSize: 16, fontWeight: "900" },
  passBtn:      { padding: 14, alignItems: "center" },
  passText:     { color: "#6b7280", fontSize: 14 },
  watching:     { margin: 16, backgroundColor: "rgba(234,179,8,0.15)", borderRadius: 14, padding: 14, alignItems: "center" },
  watchingText: { color: "#fde68a", fontSize: 14, fontWeight: "700" },
});
