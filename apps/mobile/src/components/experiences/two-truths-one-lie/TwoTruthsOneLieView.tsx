import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function TwoTruthsOneLieView() {
  const { state, sendAction } = useRoom();
  const expState = state.guestViewData as any ?? state.experienceState as any;

  const phase: string              = expState?.phase ?? "waiting";
  const currentSubmitter: string   = expState?.currentSubmitter ?? "";
  const facts: string[]            = expState?.facts ?? [];
  const voteCount: number          = expState?.voteCount ?? 0;
  const lieIndex: number | null    = expState?.lieIndex ?? null;
  const myVote: number | undefined = expState?.votes?.[state.guestId ?? ""];
  const round: number              = expState?.round ?? 1;
  const total: number              = expState?.totalRounds ?? 4;

  const isSubmitter = state.guestId === currentSubmitter;

  const [myFacts, setMyFacts] = useState(["", "", ""]);
  const [submitted, setSubmitted] = useState(false);
  const [myVoteIdx, setMyVoteIdx] = useState<number | null>(null);

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>🕵️</Text>
        <Text style={styles.title}>Two Truths One Lie</Text>
        <Text style={styles.sub}>Waiting for the host to start...</Text>
      </View>
    );
  }

  if (phase === "submitting" && isSubmitter) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={["#0a0818", "#0d0820"]} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <Text style={styles.roundLabel}>Round {round} / {total}</Text>
          <Text style={styles.submitTitle}>Enter 2 Truths + 1 Lie</Text>
          <Text style={styles.submitSub}>Make the lie convincing — others will try to spot it</Text>
        </View>
        <View style={styles.inputList}>
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.inputRow}>
              <Text style={styles.inputNum}>{i + 1}</Text>
              <TextInput
                style={styles.input}
                value={myFacts[i]}
                onChangeText={t => setMyFacts(prev => { const n = [...prev]; n[i] = t; return n; })}
                placeholder={`Fact ${i + 1}`}
                placeholderTextColor="#555"
                maxLength={100}
              />
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, (myFacts.some(f => !f.trim()) || submitted) && styles.submitBtnDisabled]}
          onPress={() => {
            if (myFacts.some(f => !f.trim()) || submitted) return;
            setSubmitted(true);
            sendAction("submit_facts", { facts: myFacts });
          }}
          activeOpacity={0.8}
        >
          <LinearGradient colors={["#7c3aed", "#6d28d9"]} style={styles.submitInner}>
            <Text style={styles.submitText}>{submitted ? "Submitted ✓" : "Submit Facts"}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === "submitting" && !isSubmitter) {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>⌛</Text>
        <Text style={styles.waitTitle}>{memberName(currentSubmitter)}</Text>
        <Text style={styles.waitSub}>is writing their facts...</Text>
      </View>
    );
  }

  if (phase === "voting" || phase === "reveal") {
    const showReveal = phase === "reveal" && lieIndex !== null;

    return (
      <View style={styles.root}>
        <LinearGradient colors={["#0a0818", "#0d0820"]} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <Text style={styles.roundLabel}>Round {round} / {total}</Text>
          <Text style={styles.voteTitle}>
            {showReveal ? "The lie was..." : `Which is ${memberName(currentSubmitter)}'s lie?`}
          </Text>
        </View>
        <View style={styles.factsList}>
          {facts.map((fact, i) => {
            const isLie       = showReveal && lieIndex === i;
            const isMyPick    = myVoteIdx === i;
            const gotItRight  = showReveal && isMyPick && lieIndex === i;
            const gotItWrong  = showReveal && isMyPick && lieIndex !== i;

            return (
              <TouchableOpacity
                key={i}
                style={[styles.factCard,
                  isMyPick && !showReveal && styles.factSelected,
                  showReveal && isLie && styles.factLie,
                  showReveal && gotItRight && styles.factCorrect,
                  showReveal && gotItWrong && styles.factWrong,
                ]}
                onPress={() => {
                  if (isSubmitter || myVoteIdx !== null || showReveal) return;
                  setMyVoteIdx(i);
                  sendAction("vote", { index: i });
                }}
                disabled={isSubmitter || myVoteIdx !== null || showReveal}
                activeOpacity={0.8}
              >
                <Text style={styles.factNum}>{i + 1}</Text>
                <Text style={styles.factText}>{fact}</Text>
                {showReveal && isLie && <Text style={styles.lieBadge}>🤥 LIE</Text>}
                {showReveal && !isLie && <Text style={styles.truthBadge}>✓ TRUTH</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        {!isSubmitter && !myVoteIdx && phase === "voting" && (
          <Text style={styles.voteHint}>Tap the statement you think is the lie</Text>
        )}
        {!isSubmitter && myVoteIdx !== null && phase === "voting" && (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedText}>Locked in — waiting for reveal · {voteCount} voted</Text>
          </View>
        )}
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

  return null;
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15 },

  header:      { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, gap: 4 },
  roundLabel:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  submitTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  submitSub:   { color: "#9ca3af", fontSize: 13, lineHeight: 18 },
  voteTitle:   { color: "#fff", fontSize: 19, fontWeight: "800" },

  waitTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  waitSub:   { color: "#6b7280", fontSize: 15 },

  inputList: { padding: 16, gap: 12 },
  inputRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  inputNum:  { color: "#6b7280", fontSize: 16, fontWeight: "800", width: 24, textAlign: "center" },
  input:     { flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },

  submitBtn:         { marginHorizontal: 16, marginTop: 8, borderRadius: 16, overflow: "hidden" },
  submitBtnDisabled: { opacity: 0.4 },
  submitInner:       { padding: 16, alignItems: "center" },
  submitText:        { color: "#fff", fontSize: 16, fontWeight: "900" },

  factsList: { padding: 16, gap: 10 },
  factCard:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)" },
  factSelected: { borderColor: "#a78bfa", backgroundColor: "rgba(167,139,250,0.12)" },
  factLie:      { backgroundColor: "rgba(220,38,38,0.15)", borderColor: "#f87171" },
  factCorrect:  { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "#4ade80" },
  factWrong:    { backgroundColor: "rgba(220,38,38,0.15)", borderColor: "#f87171" },
  factNum:      { color: "#6b7280", fontSize: 16, fontWeight: "800", width: 20 },
  factText:     { flex: 1, color: "#e5e7eb", fontSize: 15, lineHeight: 22 },
  lieBadge:     { color: "#f87171", fontSize: 12, fontWeight: "800" },
  truthBadge:   { color: "#4ade80", fontSize: 12, fontWeight: "800" },

  voteHint:     { color: "#6b7280", fontSize: 13, textAlign: "center", paddingHorizontal: 20 },
  lockedBanner: { marginHorizontal: 16, marginTop: 8, backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(99,102,241,0.35)" },
  lockedText:   { color: "#818cf8", fontSize: 13, fontWeight: "700" },
});
