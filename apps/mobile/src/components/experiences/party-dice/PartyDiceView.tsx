import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function PartyDiceView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase    = d?.phase ?? "waiting";
  const roller   = d?.currentRoller ?? "";
  const dice     = d?.diceValue ?? null;
  const action   = d?.currentAction ?? null;
  const round    = d?.round ?? 1;
  const total    = d?.totalRounds ?? 6;

  const isRoller = state.guestId === roller;

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>🎲</Text><Text style={s.title}>Party Dice</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d0a20"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
        <Text style={s.rollerLabel}>{isRoller ? "🎲 Your roll!" : `${memberName(roller)}'s roll`}</Text>
      </View>

      {phase === "rolling" && (
        <View style={s.diceArea}>
          {isRoller ? (
            <TouchableOpacity style={s.rollBtn} onPress={() => sendAction("roll", {})} activeOpacity={0.8}>
              <LinearGradient colors={["#7c3aed","#6d28d9"]} style={s.rollInner}>
                <Text style={s.rollEmoji}>🎲</Text>
                <Text style={s.rollText}>Roll the Dice!</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={s.waitingRoll}>
              <Text style={s.waitEmoji}>🎲</Text>
              <Text style={s.waitText}>{memberName(roller)} is rolling...</Text>
            </View>
          )}
        </View>
      )}

      {phase === "action" && dice !== null && action && (
        <View style={s.actionArea}>
          <Text style={s.diceFace}>{DICE_FACES[dice] ?? "🎲"}</Text>
          <Text style={s.diceNum}>Rolled a {dice}</Text>
          <View style={s.actionCard}>
            <Text style={s.actionEmoji}>{action.emoji}</Text>
            <Text style={s.actionText}>{action.desc}</Text>
            <Text style={s.actionPts}>+{action.pts} pts if completed</Text>
          </View>
          {isRoller && (
            <TouchableOpacity style={s.doneBtn} onPress={() => sendAction("complete", {})} activeOpacity={0.8}>
              <LinearGradient colors={["#16a34a","#15803d"]} style={s.doneInner}>
                <Text style={s.doneText}>✓ Done!</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {!isRoller && (
            <Text style={s.watchText}>Watching {memberName(roller)} complete the action...</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  rollerLabel: { color: "#a78bfa", fontSize: 14, fontWeight: "700" },
  diceArea: { flex: 1, justifyContent: "center", padding: 24 },
  rollBtn:  { borderRadius: 24, overflow: "hidden" },
  rollInner:{ padding: 40, alignItems: "center", gap: 12 },
  rollEmoji:{ fontSize: 64 },
  rollText: { color: "#fff", fontSize: 22, fontWeight: "900" },
  waitingRoll: { alignItems: "center", gap: 16 },
  waitEmoji:  { fontSize: 72 },
  waitText:   { color: "#9ca3af", fontSize: 16 },
  actionArea: { flex: 1, padding: 16, alignItems: "center", gap: 12 },
  diceFace:  { fontSize: 72 },
  diceNum:   { color: "#9ca3af", fontSize: 14, fontWeight: "700" },
  actionCard: { backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 20, padding: 24, alignItems: "center", gap: 10, width: "100%", borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  actionEmoji:{ fontSize: 48 },
  actionText: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center", lineHeight: 26 },
  actionPts:  { color: "#a78bfa", fontSize: 13, fontWeight: "700" },
  doneBtn:   { borderRadius: 16, overflow: "hidden", width: "100%" },
  doneInner: { padding: 16, alignItems: "center" },
  doneText:  { color: "#fff", fontSize: 18, fontWeight: "900" },
  watchText: { color: "#6b7280", fontSize: 14, textAlign: "center" },
});
