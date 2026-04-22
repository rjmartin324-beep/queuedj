import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function WouldYouRatherView() {
  const { state, sendAction } = useRoom();
  const expState = state.guestViewData as any ?? state.experienceState as any;

  const phase: string  = expState?.phase ?? "waiting";
  const optionA: string = expState?.currentQ?.a ?? "";
  const optionB: string = expState?.currentQ?.b ?? "";
  const round: number   = expState?.round ?? 1;
  const total: number   = expState?.totalRounds ?? 10;
  const myVote: string | undefined = expState?.votes?.[state.guestId ?? ""];
  const votesA = Object.values(expState?.votes ?? {}).filter(v => v === "a").length;
  const votesB = Object.values(expState?.votes ?? {}).filter(v => v === "b").length;
  const totalVotes = votesA + votesB;

  const [voted, setVoted] = useState<"a" | "b" | null>(null);

  function handleVote(choice: "a" | "b") {
    if (voted || phase !== "question") return;
    setVoted(choice);
    sendAction("vote", { choice });
  }

  if (phase === "waiting") {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>🤔</Text>
        <Text style={styles.title}>Would You Rather</Text>
        <Text style={styles.sub}>Waiting for the host to start...</Text>
      </View>
    );
  }

  const showResult = phase === "reveal";
  const pctA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0d0820", "#1a0840"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.roundLabel}>Round {round} / {total}</Text>
        <Text style={styles.wouldYou}>Would you rather...</Text>
      </View>

      <View style={styles.optionsWrap}>
        {/* Option A */}
        <TouchableOpacity
          style={[styles.option, voted === "a" && styles.optionSelected, showResult && styles.optionResult]}
          onPress={() => handleVote("a")}
          disabled={!!voted || showResult}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={voted === "a" || showResult ? ["#1d4ed8", "#1e40af"] : ["rgba(30,64,175,0.3)", "rgba(29,78,216,0.15)"]}
            style={styles.optionGrad}
          >
            <Text style={styles.optionLetter}>A</Text>
            <Text style={styles.optionText}>{optionA}</Text>
            {showResult && <Text style={styles.optionPct}>{pctA}%</Text>}
            {voted === "a" && !showResult && <Text style={styles.myVoteBadge}>✓ Your pick</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>OR</Text>
        </View>

        {/* Option B */}
        <TouchableOpacity
          style={[styles.option, voted === "b" && styles.optionSelected, showResult && styles.optionResult]}
          onPress={() => handleVote("b")}
          disabled={!!voted || showResult}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={voted === "b" || showResult ? ["#7e22ce", "#6b21a8"] : ["rgba(126,34,206,0.3)", "rgba(107,33,168,0.15)"]}
            style={styles.optionGrad}
          >
            <Text style={styles.optionLetter}>B</Text>
            <Text style={styles.optionText}>{optionB}</Text>
            {showResult && <Text style={styles.optionPct}>{pctB}%</Text>}
            {voted === "b" && !showResult && <Text style={styles.myVoteBadge}>✓ Your pick</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {voted && !showResult && (
        <View style={styles.waitBanner}>
          <Text style={styles.waitText}>Locked in — waiting for reveal</Text>
        </View>
      )}

      {showResult && (
        <View style={styles.barWrap}>
          <View style={styles.barTrack}>
            <View style={[styles.barA, { flex: votesA || 1 }]} />
            <View style={[styles.barB, { flex: votesB || 1 }]} />
          </View>
          <View style={styles.barLabels}>
            <Text style={styles.barLabel}>{votesA} votes</Text>
            <Text style={styles.barLabel}>{votesB} votes</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15 },

  header:    { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 4 },
  roundLabel:{ color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  wouldYou:  { color: "#e5e7eb", fontSize: 22, fontWeight: "800" },

  optionsWrap: { flex: 1, padding: 16, gap: 12 },
  option: { flex: 1, borderRadius: 20, overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.08)" },
  optionSelected: { borderColor: "#a78bfa" },
  optionResult:   { borderColor: "rgba(255,255,255,0.15)" },
  optionGrad: { flex: 1, padding: 20, justifyContent: "center", gap: 10 },
  optionLetter: { color: "rgba(255,255,255,0.5)", fontSize: 40, fontWeight: "900" },
  optionText:   { color: "#fff", fontSize: 18, fontWeight: "800", lineHeight: 26 },
  optionPct:    { color: "#fff", fontSize: 32, fontWeight: "900" },
  myVoteBadge:  { color: "#a78bfa", fontSize: 13, fontWeight: "700" },

  vsContainer: { alignItems: "center" },
  vsText:      { color: "#4b5563", fontSize: 14, fontWeight: "900", letterSpacing: 2 },

  waitBanner: { marginHorizontal: 16, marginBottom: 16, backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(99,102,241,0.35)" },
  waitText:   { color: "#818cf8", fontSize: 14, fontWeight: "700" },

  barWrap:   { paddingHorizontal: 16, paddingBottom: 24, gap: 6 },
  barTrack:  { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden" },
  barA:      { backgroundColor: "#3b82f6" },
  barB:      { backgroundColor: "#a855f7" },
  barLabels: { flexDirection: "row", justifyContent: "space-between" },
  barLabel:  { color: "#6b7280", fontSize: 12 },
});
