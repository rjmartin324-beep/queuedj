import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function NeverHaveIEverView() {
  const { state, sendAction } = useRoom();
  const expState = state.guestViewData as any ?? state.experienceState as any;

  const phase: string    = expState?.phase ?? "waiting";
  const prompt: string   = expState?.currentPrompt ?? "";
  const round: number    = expState?.round ?? 1;
  const total: number    = expState?.totalRounds ?? 10;
  const haveCount: number  = expState?.haveCount ?? 0;
  const neverCount: number = expState?.neverCount ?? 0;
  const responses: Record<string, string> = expState?.responses ?? {};
  const myResponse: string | undefined = responses[state.guestId ?? ""];

  const [responded, setResponded] = useState(false);

  function handleRespond(choice: "have" | "never") {
    if (responded || myResponse) return;
    setResponded(true);
    sendAction("respond", { choice });
  }

  const showResults = phase === "reveal";
  const totalResponses = haveCount + neverCount;

  if (phase === "waiting") {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>✋</Text>
        <Text style={styles.title}>Never Have I Ever</Text>
        <Text style={styles.sub}>Waiting for the host to start...</Text>
      </View>
    );
  }

  if (!prompt) {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>⏳</Text>
        <Text style={styles.sub}>Loading next prompt...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0a1628", "#0d0820"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.roundLabel}>Round {round} / {total}</Text>
        <Text style={styles.never}>Never have I ever...</Text>
      </View>

      <View style={styles.promptCard}>
        <LinearGradient colors={["rgba(99,102,241,0.2)", "rgba(139,92,246,0.1)"]} style={styles.promptGrad}>
          <Text style={styles.promptText}>{prompt}</Text>
        </LinearGradient>
      </View>

      {!myResponse && !responded ? (
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.haveBtn} onPress={() => handleRespond("have")} activeOpacity={0.8}>
            <LinearGradient colors={["#dc2626", "#b91c1c"]} style={styles.btnInner}>
              <Text style={styles.btnEmoji}>🙋</Text>
              <Text style={styles.btnText}>I HAVE</Text>
              <Text style={styles.btnSub}>spill the tea</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.neverBtn} onPress={() => handleRespond("never")} activeOpacity={0.8}>
            <LinearGradient colors={["#16a34a", "#15803d"]} style={styles.btnInner}>
              <Text style={styles.btnEmoji}>🙅</Text>
              <Text style={styles.btnText}>NEVER</Text>
              <Text style={styles.btnSub}>+100 pts</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.waitBanner}>
          <Text style={styles.waitText}>
            {myResponse === "have" || responded ? "Locked in" : "Locked in"} — waiting for others
          </Text>
        </View>
      )}

      {(showResults || totalResponses > 0) && (
        <View style={styles.results}>
          <View style={styles.resultRow}>
            <Text style={styles.resultEmoji}>🙋</Text>
            <Text style={styles.resultLabel}>Have</Text>
            <Text style={styles.resultCount}>{haveCount}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultEmoji}>🙅</Text>
            <Text style={styles.resultLabel}>Never</Text>
            <Text style={styles.resultCount}>{neverCount}</Text>
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
  never:     { color: "#e5e7eb", fontSize: 22, fontWeight: "800" },

  promptCard: { marginHorizontal: 16, marginVertical: 12, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(167,139,250,0.25)" },
  promptGrad: { padding: 24, minHeight: 120, justifyContent: "center" },
  promptText: { color: "#fff", fontSize: 20, fontWeight: "800", lineHeight: 28, textAlign: "center" },

  buttons: { flexDirection: "row", paddingHorizontal: 16, gap: 12, marginTop: 8 },
  haveBtn:  { flex: 1, borderRadius: 20, overflow: "hidden" },
  neverBtn: { flex: 1, borderRadius: 20, overflow: "hidden" },
  btnInner: { paddingVertical: 24, alignItems: "center", gap: 6 },
  btnEmoji: { fontSize: 36 },
  btnText:  { color: "#fff", fontSize: 18, fontWeight: "900" },
  btnSub:   { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" },

  waitBanner: { marginHorizontal: 16, marginTop: 8, backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(99,102,241,0.35)" },
  waitText:   { color: "#818cf8", fontSize: 14, fontWeight: "700" },

  results: { padding: 16, gap: 10 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14 },
  resultEmoji: { fontSize: 24 },
  resultLabel: { flex: 1, color: "#e5e7eb", fontSize: 15, fontWeight: "700" },
  resultCount: { color: "#fff", fontSize: 24, fontWeight: "900" },
});
