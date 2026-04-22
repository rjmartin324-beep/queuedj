import React, { useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function ReflexView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;

  const phase: string  = d?.phase ?? "waiting";
  const order: Array<{ guestId: string; serverTs: number; clientTs?: number }> = d?.buzzOrder ?? [];
  const scores: Record<string, number> = d?.scores ?? {};
  const round: number  = d?.roundNumber ?? 0;
  const target: number = d?.winTarget ?? 5;
  const lastWinner: string | undefined = d?.lastWinner;
  const goServerTs: number = d?.goServerTs ?? 0;

  const myId = state.guestId ?? "";
  const myPos = order.findIndex(b => b.guestId === myId);
  const myReactionMs = (myPos >= 0 && goServerTs > 0 && order[myPos]?.clientTs)
    ? order[myPos].clientTs! - goServerTs
    : null;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (phase === "go") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 120, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]),
        { iterations: 3 }
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [phase]);

  const handleTap = () => {
    if (phase === "go") {
      sendAction("tap", { ts: Date.now() });
    }
  };

  const memberName = useCallback((id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6),
  [state.members]);

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);

  if (phase === "finished") {
    return (
      <View style={s.center}>
        <LinearGradient colors={["#0a0820", "#030810"]} style={StyleSheet.absoluteFill} />
        <Text style={s.finishEmoji}>⚡</Text>
        <Text style={s.finishTitle}>Game Over!</Text>
        <View style={s.scoreList}>
          {sorted.map(([id, pts], i) => (
            <View key={id} style={s.scoreRow}>
              <Text style={s.scoreRank}>#{i + 1}</Text>
              <Text style={[s.scoreName, id === myId && s.me]}>{memberName(id)}</Text>
              <Text style={s.scorePts}>{pts}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const isGo = phase === "go";
  const isCountdown = phase === "countdown";

  return (
    <View style={s.root}>
      <LinearGradient
        colors={isGo ? ["#1a0000", "#3a0000"] : ["#0a0820", "#030810"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.header}>
        <Text style={s.roundLabel}>ROUND {round}</Text>
        <Text style={s.targetLabel}>First to {target} pts</Text>
        {scores[myId] !== undefined && (
          <Text style={s.myScore}>{scores[myId]} / {target}</Text>
        )}
      </View>

      {/* Main tap zone */}
      <View style={s.tapArea}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[
              s.tapCircle,
              isGo && s.tapCircleGo,
              isCountdown && s.tapCircleCountdown,
              phase === "locked" && s.tapCircleLocked,
            ]}
            onPress={handleTap}
            activeOpacity={isGo ? 0.6 : 1}
          >
            {phase === "waiting" && (
              <>
                <Text style={s.tapEmoji}>⚡</Text>
                <Text style={s.tapLabel}>Reflex</Text>
                <Text style={s.tapSub}>Waiting for host...</Text>
              </>
            )}
            {isCountdown && (
              <>
                <Text style={s.tapEmoji}>🟡</Text>
                <Text style={s.tapLabel}>Get ready...</Text>
              </>
            )}
            {isGo && (
              <>
                <Text style={[s.tapEmoji, { fontSize: 56 }]}>TAP!</Text>
              </>
            )}
            {phase === "locked" && (
              <>
                {myPos === 0 ? (
                  <>
                    <Text style={s.tapEmoji}>⚡</Text>
                    <Text style={s.winText}>You got it!</Text>
                    {myReactionMs !== null && myReactionMs > 0 && (
                      <Text style={s.reactionTime}>{myReactionMs}ms</Text>
                    )}
                  </>
                ) : myPos > 0 ? (
                  <>
                    <Text style={s.tapEmoji}>#{myPos + 1}</Text>
                    <Text style={s.tapLabel}>Not fast enough</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.tapEmoji}>⏱️</Text>
                    <Text style={s.tapLabel}>Missed it</Text>
                  </>
                )}
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Round result */}
      {phase === "locked" && lastWinner && (
        <View style={s.resultCard}>
          <Text style={s.resultText}>
            {lastWinner === myId
              ? "You were fastest!"
              : `${memberName(lastWinner)} was fastest`}
          </Text>
        </View>
      )}

      {/* Leaderboard strip */}
      {sorted.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.leaderStrip} contentContainerStyle={s.leaderContent}>
          {sorted.map(([id, pts]) => (
            <View key={id} style={s.leaderItem}>
              <Text style={[s.leaderName, id === myId && s.me]}>{memberName(id)}</Text>
              <View style={s.leaderBarBg}>
                <View style={[s.leaderBarFill, { width: Math.max(4, (pts / target) * 100) }]} />
              </View>
              <Text style={[s.leaderPts, id === myId && s.me]}>{pts}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: "#08081a" },
  center:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },

  header:       { alignItems: "center", paddingTop: 24, gap: 4 },
  roundLabel:   { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  targetLabel:  { color: "#4b5563", fontSize: 12 },
  myScore:      { color: "#60a5fa", fontSize: 20, fontWeight: "900", marginTop: 4 },

  tapArea:  { flex: 1, alignItems: "center", justifyContent: "center" },
  tapCircle: {
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  tapCircleGo: {
    backgroundColor: "rgba(239,68,68,0.2)",
    borderColor: "#ef4444",
    shadowColor: "#ef4444", shadowRadius: 30, shadowOpacity: 0.7, elevation: 20,
  },
  tapCircleCountdown: {
    backgroundColor: "rgba(234,179,8,0.1)",
    borderColor: "rgba(234,179,8,0.3)",
  },
  tapCircleLocked: {
    backgroundColor: "rgba(124,58,237,0.1)",
    borderColor: "rgba(124,58,237,0.3)",
  },
  tapEmoji: { fontSize: 48 },
  tapLabel: { color: "#9ca3af", fontSize: 16, fontWeight: "700", textAlign: "center" },
  tapSub:   { color: "#4b5563", fontSize: 12, textAlign: "center" },

  winText:     { color: "#34d399", fontSize: 20, fontWeight: "900" },
  reactionTime:{ color: "#60a5fa", fontSize: 14, fontWeight: "700" },

  resultCard: { marginHorizontal: 24, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, alignItems: "center" },
  resultText: { color: "#e5e7eb", fontSize: 15, fontWeight: "700" },

  leaderStrip:   { maxHeight: 80, marginBottom: 16 },
  leaderContent: { paddingHorizontal: 20, gap: 16, alignItems: "center" },
  leaderItem:    { alignItems: "center", gap: 4 },
  leaderName:    { color: "#6b7280", fontSize: 11, fontWeight: "700" },
  leaderBarBg:   { width: 60, height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" },
  leaderBarFill: { height: 4, backgroundColor: "#60a5fa", borderRadius: 2 },
  leaderPts:     { color: "#6b7280", fontSize: 12, fontWeight: "900" },

  finishEmoji:  { fontSize: 64 },
  finishTitle:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  scoreList:    { gap: 10, marginTop: 16, width: "80%" },
  scoreRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreRank:    { color: "#6b7280", fontSize: 12, width: 28 },
  scoreName:    { flex: 1, color: "#e5e7eb", fontSize: 15, fontWeight: "600" },
  scorePts:     { color: "#60a5fa", fontSize: 15, fontWeight: "900" },
  me:           { color: "#a78bfa" },
});
