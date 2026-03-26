import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const ACCENT = "#f97316";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function ImprovChallengeControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const members = state.members;

  const currentPerformerId: string = expState?.currentPerformer ?? "";
  const currentPerformerName =
    members.find((m) => m.guestId === currentPerformerId)?.displayName ??
    currentPerformerId.slice(0, 6);
  const currentScene = expState?.currentScene;
  const ratingCount: number = Object.keys(expState?.ratings ?? {}).length;

  function memberName(guestId: string) {
    return members.find((m) => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>IMPROV CHALLENGE — {phase.toUpperCase()}</Text>

      {/* Waiting */}
      {phase === "waiting" && (
        <TouchableOpacity
          style={s.btn}
          onPress={() => sendAction("start", { guestIds: members.map((m) => m.guestId) })}
        >
          <LinearGradient colors={["#f97316", "#ea580c"]} style={s.btnInner}>
            <Text style={s.btnText}>▶ START GAME</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Performing phase */}
      {phase === "performing" && (
        <View style={s.card}>
          <Text style={s.roundLabel}>CURRENT PERFORMER</Text>
          <Text style={s.questionText}>{currentPerformerName}</Text>
          {currentScene && (
            <View style={s.sceneBox}>
              {currentScene.who ? (
                <View style={s.sceneRow}>
                  <Text style={s.sceneKey}>WHO</Text>
                  <Text style={s.sceneVal}>{currentScene.who}</Text>
                </View>
              ) : null}
              {currentScene.where ? (
                <View style={s.sceneRow}>
                  <Text style={s.sceneKey}>WHERE</Text>
                  <Text style={s.sceneVal}>{currentScene.where}</Text>
                </View>
              ) : null}
              {currentScene.what ? (
                <View style={s.sceneRow}>
                  <Text style={s.sceneKey}>WHAT</Text>
                  <Text style={s.sceneVal}>{currentScene.what}</Text>
                </View>
              ) : null}
            </View>
          )}
          <TouchableOpacity style={s.btn} onPress={() => sendAction("start_rating")}>
            <LinearGradient colors={["#f97316", "#ea580c"]} style={s.btnInner}>
              <Text style={s.btnText}>START RATING</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Rating phase */}
      {phase === "rating" && (
        <View style={s.card}>
          <Text style={s.roundLabel}>RATING</Text>
          <Text style={s.subText}>
            {ratingCount} / {Math.max(members.length - 1, 1)} ratings received
          </Text>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("next")}>
            <LinearGradient colors={["#f97316", "#ea580c"]} style={s.btnInner}>
              <Text style={s.btnText}>NEXT PERFORMER ▶</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Finished */}
      {phase === "finished" && (
        <View style={s.card}>
          <Text style={s.finishedTitle}>SHOW OVER</Text>
          <Text style={s.subText} style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>
            Final standings below
          </Text>
        </View>
      )}

      {/* Scores */}
      {sortedScores.length > 0 && (
        <View style={s.scores}>
          <Text style={s.scoresTitle}>SCORES</Text>
          {sortedScores.map(([gId, pts], i) => (
            <View key={gId} style={s.scoreRow}>
              <Text style={s.scoreRank}>#{i + 1}</Text>
              <Text style={s.scoreName}>{memberName(gId)}</Text>
              <Text style={s.scorePts}>{pts as number} pts</Text>
            </View>
          ))}
        </View>
      )}

      {/* End game */}
      <TouchableOpacity style={s.endBtn} onPress={() => sendAction("end")}>
        <Text style={s.endBtnText}>End Game</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },
  phaseLabel: { color: "#666", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  card: { backgroundColor: "#111", borderRadius: 12, padding: 14, gap: 10 },
  roundLabel: { color: ACCENT, fontSize: 12, fontWeight: "700" },
  questionText: { color: "#e5e7eb", fontSize: 15, fontWeight: "600", lineHeight: 22 },
  subText: { color: "#6b7280", fontSize: 13 },
  finishedTitle: { color: "#f9fafb", fontSize: 22, fontWeight: "900", textAlign: "center" },
  sceneBox: { backgroundColor: "#0a0a0a", borderRadius: 8, padding: 10, gap: 6 },
  sceneRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  sceneKey: { color: "#f97316", fontSize: 9, fontWeight: "900", letterSpacing: 1, width: 44, paddingTop: 2 },
  sceneVal: { color: "#ccc", fontSize: 13, flex: 1 },
  btn: { borderRadius: 12, overflow: "hidden" },
  btnInner: { padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  scores: { backgroundColor: "#111", borderRadius: 12, padding: 12 },
  scoresTitle: { color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, gap: 8 },
  scoreRank: { color: "#4b5563", fontSize: 12, fontWeight: "700", width: 24 },
  scoreName: { flex: 1, color: "#ccc", fontSize: 14 },
  scorePts: { color: "#a78bfa", fontSize: 14, fontWeight: "700" },
  endBtn: { padding: 12, alignItems: "center" },
  endBtnText: { color: "#555", fontSize: 13 },
});
