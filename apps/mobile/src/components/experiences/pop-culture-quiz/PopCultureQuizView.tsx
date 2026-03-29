import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Pop Culture Quiz — Guest View
//
// Phases:
//   waiting  → waiting for host to start
//   question → 4-option MC with 12s speed-bonus timer
//   reveal   → options light up correct/wrong
//   finished → final scores
//
// The server auto-advances: reveal → leaderboard view (4s) → next question (3s)
// "leaderboard" view type is handled by the shared LeaderboardView.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  TV:     "#3b82f6",
  Film:   "#ec4899",
  Music:  "#a855f7",
  Social: "#22c55e",
};

const OPTION_LABELS = ["A", "B", "C", "D"];

export function PopCultureQuizView() {
  const { state, sendAction } = useRoom();
  const data = (state.guestViewData ?? state.experienceState) as any;

  const phase: string                      = data?.phase ?? "waiting";
  const round: number                      = data?.round ?? 1;
  const totalRounds: number                = data?.totalRounds ?? 10;
  const scores: Record<string, number>     = data?.scores ?? {};
  const questionStartedAt: number          = data?.questionStartedAt ?? 0;
  const currentQ = data?.currentQ as {
    text: string;
    options: [string, string, string, string];
    category: string;
    correct?: number; // only present during reveal
  } | null | undefined;

  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(12);

  // Reset selection when the question changes
  useEffect(() => {
    setSelected(null);
    setTimeLeft(12);
  }, [currentQ?.text]);

  // Countdown — sync to server questionStartedAt so reconnects show correct time
  useEffect(() => {
    if (phase !== "question" || !questionStartedAt) return;
    const elapsed = Math.floor((Date.now() - questionStartedAt) / 1000);
    setTimeLeft(Math.max(0, 12 - elapsed));
    const iv = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(iv);
  }, [phase, questionStartedAt]);

  function handleAnswer(index: number) {
    if (selected !== null || phase !== "question") return;
    setSelected(index);
    sendAction("answer", { index });
  }

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  // ─── Waiting ─────────────────────────────────────────────────────────────

  if (phase === "waiting") {
    return (
      <View style={s.center}>
        <Text style={s.waitEmoji}>🎬</Text>
        <Text style={s.waitTitle}>Pop Culture Quiz</Text>
        <Text style={s.waitSub}>Waiting for the host to start…</Text>
      </View>
    );
  }

  // ─── Finished ────────────────────────────────────────────────────────────

  if (phase === "finished") {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const RANK_ICONS = ["🥇", "🥈", "🥉"];
    return (
      <ScrollView style={s.root} contentContainerStyle={s.finishContent}>
        <Text style={s.finishTitle}>Quiz Over! 🎉</Text>
        {sorted.map(([id, pts], i) => (
          <View key={id} style={s.scoreRow}>
            <Text style={s.scoreRank}>{RANK_ICONS[i] ?? `#${i + 1}`}</Text>
            <Text style={s.scoreName}>{memberName(id)}</Text>
            <Text style={s.scorePts}>{pts} pts</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  if (!currentQ) return null;

  const catColor   = CATEGORY_COLORS[currentQ.category] ?? "#7c3aed";
  const isReveal   = phase === "reveal";
  const isUrgent   = !isReveal && timeLeft <= 3;

  // ─── Question / Reveal ───────────────────────────────────────────────────

  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.roundLabel}>Q {round} / {totalRounds}</Text>
        <View style={[s.catBadge, { backgroundColor: `${catColor}22`, borderColor: catColor }]}>
          <Text style={[s.catText, { color: catColor }]}>{currentQ.category}</Text>
        </View>
        {!isReveal && (
          <View style={[s.timerPill, isUrgent && s.timerUrgent]}>
            <Text style={[s.timerText, isUrgent && s.timerTextUrgent]}>{timeLeft}s</Text>
          </View>
        )}
      </View>

      {/* ── Question ── */}
      <View style={s.questionBox}>
        <Text style={s.questionText}>{currentQ.text}</Text>
      </View>

      {/* ── Options ── */}
      <View style={s.optionsGrid}>
        {currentQ.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect  = isReveal && currentQ.correct === i;
          const isWrong    = isReveal && isSelected && currentQ.correct !== i;

          let bg     = "rgba(255,255,255,0.06)";
          let border = "rgba(255,255,255,0.10)";
          let tColor = "#e5e7eb";
          let dotBg  = "rgba(255,255,255,0.10)";

          if (isCorrect)               { bg = "rgba(34,197,94,0.18)";  border = "#22c55e"; tColor = "#4ade80"; dotBg = "#22c55e"; }
          else if (isWrong)            { bg = "rgba(239,68,68,0.18)";  border = "#ef4444"; tColor = "#f87171"; dotBg = "#ef4444"; }
          else if (isSelected)         { bg = "rgba(124,58,237,0.25)"; border = "#a78bfa"; tColor = "#fff";    dotBg = "#7c3aed"; }

          return (
            <TouchableOpacity
              key={i}
              style={[s.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => handleAnswer(i)}
              disabled={selected !== null || isReveal}
              activeOpacity={0.75}
            >
              <View style={[s.optionDot, { backgroundColor: dotBg }]}>
                <Text style={s.optionDotText}>{OPTION_LABELS[i]}</Text>
              </View>
              <Text style={[s.optionText, { color: tColor }]} numberOfLines={3}>{opt}</Text>
              {isCorrect && <Text style={s.checkmark}>✓</Text>}
              {isWrong   && <Text style={s.cross}>✗</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Locked-in banner ── */}
      {selected !== null && !isReveal && (
        <View style={s.lockedBanner}>
          <Text style={s.lockedText}>Answer locked in — waiting for reveal…</Text>
        </View>
      )}

      {/* ── Speed bonus hint ── */}
      {isReveal && selected !== null && currentQ.correct === selected && (
        <View style={s.correctBanner}>
          <Text style={s.correctText}>✓ Correct! Speed bonus applied.</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#08081a" },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },

  waitEmoji: { fontSize: 64 },
  waitTitle: { color: "#fff", fontSize: 28, fontWeight: "900" },
  waitSub:   { color: "#6b7280", fontSize: 15 },

  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  roundLabel: { color: "#6b7280", fontSize: 12, fontWeight: "800", letterSpacing: 1 },

  catBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  catText:  { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

  timerPill:       { marginLeft: "auto", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  timerUrgent:     { backgroundColor: "rgba(239,68,68,0.2)", borderColor: "#ef4444" },
  timerText:       { color: "#9ca3af", fontSize: 13, fontWeight: "800" },
  timerTextUrgent: { color: "#f87171" },

  questionBox: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 20,
  },
  questionText: { color: "#fff", fontSize: 17, fontWeight: "700", lineHeight: 26, textAlign: "center" },

  optionsGrid: { gap: 10 },
  option: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  optionDot: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  optionDotText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  optionText:    { flex: 1, fontSize: 15, fontWeight: "600", lineHeight: 20, color: "#e5e7eb" },
  checkmark:     { color: "#4ade80", fontSize: 18, fontWeight: "900" },
  cross:         { color: "#f87171", fontSize: 18, fontWeight: "900" },

  lockedBanner: {
    backgroundColor: "rgba(124,58,237,0.15)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(167,139,250,0.3)", padding: 14, alignItems: "center",
  },
  lockedText: { color: "#a78bfa", fontSize: 14, fontWeight: "600" },

  correctBanner: {
    backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.35)", padding: 14, alignItems: "center",
  },
  correctText: { color: "#4ade80", fontSize: 14, fontWeight: "700" },

  finishContent: { padding: 24, gap: 10 },
  finishTitle:   { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 16 },
  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreRank: { color: "#6b7280", fontSize: 14, fontWeight: "700", width: 36 },
  scoreName: { flex: 1, color: "#e5e7eb", fontSize: 15, fontWeight: "600" },
  scorePts:  { color: "#a78bfa", fontSize: 15, fontWeight: "900" },
});
