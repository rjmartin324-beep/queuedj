import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

interface Props { viewMode: "player" | "host"; onViewModeChange: (m: "player" | "host") => void; }

export function ConnectionsControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const members = state.members;
  function guestIds() { return members.map(m => m.guestId); }
  function memberName(gId: string) { return members.find(m => m.guestId === gId)?.displayName ?? gId.slice(0, 6); }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <Text style={s.phase}>{phase.replace(/_/g, " ").toUpperCase()} · Round {expState?.round ?? 0}/{expState?.totalRounds ?? "?"}</Text>

      {/* START */}
      {phase === "waiting" && (
        <TouchableOpacity style={s.btn} onPress={() => sendAction("start", { guestIds: guestIds() })}>
          <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.btnI}><Text style={s.btnT}>▶ START GAME</Text></LinearGradient>
        </TouchableOpacity>
      )}

      {/* GAME-SPECIFIC CONTROLS */}
      {phase === "playing" && (
        <View style={s.card}>
          <Text style={s.label}>PUZZLE {(expState?.puzzleIndex ?? 0) + 1}</Text>
          <View style={s.divider} />
          <Text style={s.subLabel}>SOLVED GROUPS PER PLAYER</Text>
          {members.map(m => {
            const memberScores = expState?.scores ?? {};
            const solved = memberScores[m.guestId] ?? 0;
            return (
              <View key={m.guestId} style={s.row}>
                <Text style={s.name}>{memberName(m.guestId)}</Text>
                <View style={s.groupDots}>
                  {[0, 1, 2, 3].map(i => (
                    <View key={i} style={[s.dot, i < solved ? s.dotFilled : s.dotEmpty]} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* SCORES */}
      {Object.keys(scores).length > 0 && (
        <View style={s.scores}>
          <Text style={s.scoresH}>SCORES</Text>
          {Object.entries(scores).sort(([, a], [, b]) => (b as number) - (a as number)).map(([gId, pts]) => (
            <View key={gId} style={s.row}>
              <Text style={s.name}>{memberName(gId)}</Text>
              <Text style={s.pts}>{pts as number} pts</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.end} onPress={() => sendAction("end")}>
        <Text style={s.endT}>End Game</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 }, content: { padding: 16, gap: 10 },
  phase: { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  btn: { borderRadius: 12, overflow: "hidden" },
  btnI: { padding: 14, alignItems: "center" }, btnT: { color: "#fff", fontSize: 15, fontWeight: "900" },
  smBtn: { backgroundColor: "#1a1a2e", borderRadius: 10, padding: 12, alignItems: "center" },
  smBtnT: { color: "#a78bfa", fontSize: 13, fontWeight: "700" },
  scores: { backgroundColor: "#111", borderRadius: 12, padding: 12 },
  scoresH: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, alignItems: "center" },
  name: { color: "#ccc", fontSize: 13 }, pts: { color: "#a78bfa", fontSize: 13, fontWeight: "700" },
  end: { padding: 12, alignItems: "center" }, endT: { color: "#444", fontSize: 12 },
  info: { color: "#666", fontSize: 12, textAlign: "center" },
  card: { backgroundColor: "#111", borderRadius: 12, padding: 14, gap: 8 },
  label: { color: "#a78bfa", fontSize: 14, fontWeight: "900" },
  subLabel: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginTop: 4 },
  divider: { height: 1, backgroundColor: "#222" },
  groupDots: { flexDirection: "row", gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotFilled: { backgroundColor: "#a78bfa" },
  dotEmpty: { backgroundColor: "#333" },
});
