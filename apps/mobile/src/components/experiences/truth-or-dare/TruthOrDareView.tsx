import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function TruthOrDareView() {
  const { state, sendAction } = useRoom();
  const expState = state.guestViewData as any ?? state.experienceState as any;

  const phase: string           = expState?.phase ?? "waiting";
  const currentPlayer: string   = expState?.currentPlayer ?? "";
  const currentType: string     = expState?.currentType ?? "";
  const challenge: string       = expState?.currentChallenge ?? "";
  const round: number           = expState?.round ?? 1;
  const total: number           = expState?.totalRounds ?? 8;
  const passesUsed: Record<string, number> = expState?.passesUsed ?? {};

  const isMe = state.guestId === currentPlayer;
  const myPasses = passesUsed[state.guestId ?? ""] ?? 0;
  const canPass = isMe && myPasses < 1;

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>🎭</Text>
        <Text style={styles.title}>Truth or Dare</Text>
        <Text style={styles.sub}>Waiting for the host to start...</Text>
      </View>
    );
  }

  if (phase === "spinning") {
    return (
      <View style={styles.center}>
        <Text style={styles.spinEmoji}>🎰</Text>
        <Text style={styles.spinText}>Spinning...</Text>
        <Text style={styles.roundLabel}>Round {round} of {total}</Text>
      </View>
    );
  }

  if (phase === "finished") {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>🏆</Text>
        <Text style={styles.title}>Game Over!</Text>
      </View>
    );
  }

  const isTruth = currentType === "truth";
  const gradColors: [string, string] = isTruth
    ? ["#1d4ed8", "#1e40af"]
    : ["#b91c1c", "#991b1b"];

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0a0818", "#0d0820"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.roundLabel}>Round {round} / {total}</Text>
      </View>

      <View style={styles.playerBadge}>
        <Text style={styles.playerName}>{memberName(currentPlayer)}</Text>
        <Text style={styles.playerLabel}>{isMe ? "That's you!" : "is in the hot seat"}</Text>
      </View>

      <View style={styles.challengeCard}>
        <LinearGradient colors={gradColors} style={styles.challengeGrad}>
          <View style={styles.typeRow}>
            <Text style={styles.typeEmoji}>{isTruth ? "🤫" : "💥"}</Text>
            <Text style={styles.typeLabel}>{isTruth ? "TRUTH" : "DARE"}</Text>
          </View>
          <Text style={styles.challengeText}>{challenge}</Text>
        </LinearGradient>
      </View>

      {isMe && (
        <View style={styles.myActions}>
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={() => sendAction("complete", {})}
            activeOpacity={0.8}
          >
            <LinearGradient colors={["#16a34a", "#15803d"]} style={styles.actionInner}>
              <Text style={styles.actionText}>✓ Done (+300 pts)</Text>
            </LinearGradient>
          </TouchableOpacity>
          {canPass && (
            <TouchableOpacity
              style={styles.passBtn}
              onPress={() => sendAction("pass", {})}
              activeOpacity={0.8}
            >
              <Text style={styles.passText}>Pass (1 left)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!isMe && (
        <View style={styles.watchBanner}>
          <Text style={styles.watchText}>Waiting for {memberName(currentPlayer)}...</Text>
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
  spinEmoji: { fontSize: 64 },
  spinText:  { color: "#fff", fontSize: 22, fontWeight: "800" },

  header:     { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  roundLabel: { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },

  playerBadge: { alignItems: "center", paddingVertical: 16, gap: 4 },
  playerName:  { color: "#fff", fontSize: 26, fontWeight: "900" },
  playerLabel: { color: "#a78bfa", fontSize: 14, fontWeight: "600" },

  challengeCard: { marginHorizontal: 16, borderRadius: 20, overflow: "hidden" },
  challengeGrad: { padding: 24, gap: 14, minHeight: 160 },
  typeRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  typeEmoji:     { fontSize: 28 },
  typeLabel:     { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  challengeText: { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 26 },

  myActions: { padding: 16, gap: 10, marginTop: 8 },
  completeBtn: { borderRadius: 16, overflow: "hidden" },
  actionInner: { padding: 16, alignItems: "center" },
  actionText:  { color: "#fff", fontSize: 16, fontWeight: "900" },
  passBtn:     { padding: 14, alignItems: "center" },
  passText:    { color: "#6b7280", fontSize: 14, fontWeight: "600" },

  watchBanner: { marginHorizontal: 16, marginTop: 16, backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(99,102,241,0.3)" },
  watchText:   { color: "#818cf8", fontSize: 14, fontWeight: "700" },
});
