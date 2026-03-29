import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const CHOICE_A = { color: "#f97316", bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.4)" };
const CHOICE_B = { color: "#3b82f6", bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.4)" };

export function FightOrFlightView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase: string = d?.phase ?? "waiting";
  const round: number = d?.round ?? 1;
  const total: number = d?.totalRounds ?? 8;
  const scenario: { text: string; a: string; b: string } | null = d?.currentScenario ?? null;
  const choices: Record<string, "a" | "b"> = d?.choices ?? {};
  const scores: Record<string, number> = d?.scores ?? {};
  const myId = state.guestId ?? "";

  const [chosen, setChosen] = useState<"a" | "b" | null>(null);

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  function pick(choice: "a" | "b") {
    if (chosen || phase !== "question") return;
    setChosen(choice);
    sendAction("choose", { choice });
  }

  if (phase === "waiting") return (
    <View style={s.center}>
      <Text style={s.emoji}>⚔️</Text>
      <Text style={s.title}>Fight or Flight</Text>
      <Text style={s.sub}>Waiting for host to start...</Text>
    </View>
  );

  if (phase === "finished") {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    return (
      <View style={s.root}>
        <LinearGradient colors={["#0a0820","#0d1020"]} style={StyleSheet.absoluteFill} />
        <View style={s.center}>
          <Text style={s.emoji}>🏆</Text>
          <Text style={s.title}>Game Over!</Text>
          <ScrollView style={s.scoreList}>
            {sorted.map(([id, pts], i) => (
              <View key={id} style={s.scoreRow}>
                <Text style={s.scoreRank}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</Text>
                <Text style={s.scoreName}>{id === myId ? "You" : memberName(id)}</Text>
                <Text style={s.scorePts}>{pts} pts</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  const isReveal = phase === "reveal";
  const allChoices = Object.entries(choices);
  const aVoters = allChoices.filter(([, c]) => c === "a").map(([id]) => id);
  const bVoters = allChoices.filter(([, c]) => c === "b").map(([id]) => id);
  const aCount = aVoters.length;
  const bCount = bVoters.length;
  const majority: "a" | "b" | "tie" = aCount > bCount ? "a" : bCount > aCount ? "b" : "tie";
  const myChoice = chosen ?? (choices[myId] ?? null);
  const iMajority = isReveal && myChoice !== null && majority !== "tie" && myChoice === majority;
  const iMinority = isReveal && myChoice !== null && majority !== "tie" && myChoice !== majority;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d1020"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.eyebrow}>FIGHT OR FLIGHT</Text>
        <Text style={s.roundLabel}>ROUND {round} / {total}</Text>
      </View>

      {scenario && (
        <View style={s.scenarioCard}>
          <Text style={s.scenarioText}>{scenario.text}</Text>
        </View>
      )}

      {isReveal && (
        <View style={s.resultBanner}>
          {majority === "tie" ? (
            <Text style={s.resultTie}>🤝 Tie! Everyone gets consolation points</Text>
          ) : iMajority ? (
            <Text style={s.resultWin}>✅ With the majority! +200 pts</Text>
          ) : iMinority ? (
            <Text style={s.resultLoss}>🔥 Rebel minority! +50 pts</Text>
          ) : (
            <Text style={s.resultNeutral}>Results are in!</Text>
          )}
        </View>
      )}

      <View style={s.choicesArea}>
        {(["a", "b"] as const).map(choice => {
          const cfg = choice === "a" ? CHOICE_A : CHOICE_B;
          const label = scenario?.[choice] ?? "";
          const voters = choice === "a" ? aVoters : bVoters;
          const iSelected = myChoice === choice;
          const isMajority = isReveal && majority === choice;
          const pct = isReveal && (aCount + bCount) > 0
            ? Math.round((voters.length / (aCount + bCount)) * 100)
            : null;

          return (
            <TouchableOpacity
              key={choice}
              style={[
                s.choiceBtn,
                { borderColor: iSelected ? cfg.color : "rgba(255,255,255,0.1)", backgroundColor: iSelected ? cfg.bg : "rgba(255,255,255,0.06)" },
                isReveal && isMajority && s.choiceMajority,
              ]}
              onPress={() => pick(choice)}
              activeOpacity={0.8}
              disabled={!!chosen || isReveal}
            >
              <View style={s.choiceRow}>
                <View style={[s.choiceBadge, { backgroundColor: cfg.color }]}>
                  <Text style={s.choiceBadgeText}>{choice.toUpperCase()}</Text>
                </View>
                <Text style={[s.choiceLabel, iSelected && { color: cfg.color }]}>{label}</Text>
              </View>
              {isReveal && (
                <View style={s.voteBar}>
                  <View style={[s.voteBarFill, { width: `${pct ?? 0}%`, backgroundColor: cfg.color }]} />
                  <Text style={[s.votePct, { color: cfg.color }]}>
                    {pct}% ({voters.length})
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {!isReveal && !chosen && (
        <View style={s.hint}><Text style={s.hintText}>Choose your side — majority earns +200 pts</Text></View>
      )}
      {!isReveal && chosen && (
        <View style={s.locked}><Text style={s.lockedText}>Locked in! Waiting for host to reveal...</Text></View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  eyebrow:    { color: "#f97316", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  roundLabel: { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  scenarioCard: { margin: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  scenarioText: { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 26, textAlign: "center" },

  resultBanner: { marginHorizontal: 16, marginBottom: 4, borderRadius: 12, padding: 12, alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)" },
  resultWin:    { color: "#4ade80", fontSize: 15, fontWeight: "800" },
  resultLoss:   { color: "#f97316", fontSize: 15, fontWeight: "800" },
  resultTie:    { color: "#fbbf24", fontSize: 15, fontWeight: "800" },
  resultNeutral:{ color: "#9ca3af", fontSize: 15, fontWeight: "700" },

  choicesArea: { flex: 1, padding: 16, gap: 12 },
  choiceBtn:   { borderRadius: 18, padding: 18, borderWidth: 2, gap: 10 },
  choiceMajority: { borderWidth: 2 },
  choiceRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
  choiceBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  choiceBadgeText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  choiceLabel: { flex: 1, color: "#e5e7eb", fontSize: 16, fontWeight: "700", lineHeight: 22 },
  voteBar:     { height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, position: "relative", overflow: "hidden" },
  voteBarFill: { height: "100%", borderRadius: 3 },
  votePct:     { fontSize: 12, fontWeight: "700", marginTop: 4, textAlign: "right" },

  hint:       { padding: 16, alignItems: "center" },
  hintText:   { color: "#6b7280", fontSize: 13 },
  locked:     { padding: 16, alignItems: "center" },
  lockedText: { color: "#818cf8", fontSize: 13, fontWeight: "700" },

  scoreList: { width: "100%", marginTop: 12 },
  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  scoreRank: { fontSize: 22, minWidth: 36 },
  scoreName: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "700" },
  scorePts:  { color: "#f97316", fontSize: 16, fontWeight: "900" },
});
