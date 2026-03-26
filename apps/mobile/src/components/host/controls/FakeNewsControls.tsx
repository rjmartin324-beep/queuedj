import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function FakeNewsControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores: Record<string, number> = expState?.scores ?? {};
  const headline: string = expState?.headline ?? "";
  const voteCount: number = expState?.voteCount ?? 0;
  const totalPlayers: number = state.members.length;
  const correctAnswer: string = expState?.correctAnswer ?? "";
  const streak: number = expState?.streak ?? 0;
  const round: number = expState?.round ?? 1;
  const totalRounds: number = expState?.totalRounds ?? 10;
  const members = state.members;

  function memberName(gId: string) {
    return members.find((m) => m.guestId === gId)?.displayName ?? gId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.headerRow}>
        <Text style={s.title}>FAKE NEWS</Text>
        <View style={s.phaseBadge}>
          <Text style={s.phaseText}>{phase.toUpperCase()}</Text>
        </View>
      </View>

      {/* View mode toggle */}
      <View style={s.toggleRow}>
        <TouchableOpacity
          style={[s.toggleBtn, viewMode === "host" && s.toggleBtnActive]}
          onPress={() => onViewModeChange("host")}
        >
          <Text style={[s.toggleText, viewMode === "host" && s.toggleTextActive]}>
            Host
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, viewMode === "player" && s.toggleBtnActive]}
          onPress={() => onViewModeChange("player")}
        >
          <Text style={[s.toggleText, viewMode === "player" && s.toggleTextActive]}>
            Player
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── WAITING ── */}
      {phase === "waiting" && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>READY TO START</Text>
          <Text style={s.infoText}>
            {members.length} player{members.length !== 1 ? "s" : ""} in room
          </Text>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => sendAction("start")}
          >
            <Text style={s.primaryBtnText}>START GAME</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── QUESTION ── */}
      {phase === "question" && (
        <>
          <View style={s.section}>
            <View style={s.roundBadgeRow}>
              <Text style={s.sectionLabel}>HEADLINE</Text>
              <Text style={s.roundInfo}>
                Round {round}/{totalRounds}
              </Text>
            </View>
            <View style={s.headlineCard}>
              <Text style={s.headlineEmoji}>📰</Text>
              <Text style={s.headlineText}>
                {headline !== "" ? headline : "Loading headline…"}
              </Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>VOTES</Text>
            <View style={s.voteRow}>
              <View style={s.voteBarWrap}>
                <View
                  style={[
                    s.voteBar,
                    {
                      width: totalPlayers > 0
                        ? `${Math.round((voteCount / totalPlayers) * 100)}%` as any
                        : "0%",
                    },
                  ]}
                />
              </View>
              <Text style={s.voteCount}>
                {voteCount} / {totalPlayers}
              </Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>CONTROLS</Text>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => sendAction("reveal")}
            >
              <Text style={s.primaryBtnText}>REVEAL ANSWER</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── REVEAL ── */}
      {phase === "reveal" && (
        <>
          <View style={s.section}>
            <Text style={s.sectionLabel}>CORRECT ANSWER</Text>
            <View style={s.answerCard}>
              <Text style={s.answerEmoji}>
                {correctAnswer.toLowerCase() === "real" ? "✅" : "🚫"}
              </Text>
              <View style={s.answerTextWrap}>
                <Text style={s.answerLabel}>
                  {correctAnswer.toLowerCase() === "real" ? "REAL NEWS" : "FAKE NEWS"}
                </Text>
                <Text style={s.answerValue}>{correctAnswer}</Text>
              </View>
            </View>
          </View>

          {streak > 1 && (
            <View style={s.streakCard}>
              <Text style={s.streakEmoji}>🔥</Text>
              <Text style={s.streakText}>Streak: {streak} in a row</Text>
            </View>
          )}

          <View style={s.section}>
            <Text style={s.sectionLabel}>CONTROLS</Text>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => sendAction("next_round")}
            >
              <Text style={s.primaryBtnText}>NEXT ROUND</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── FINISHED ── */}
      {phase === "finished" && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>GAME OVER</Text>
          <Text style={s.infoText}>Final standings:</Text>
        </View>
      )}

      {/* ── SCORES — shown in reveal + finished ── */}
      {(phase === "reveal" || phase === "finished") && sortedScores.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>SCORES</Text>
          {sortedScores.map(([gId, pts], i) => (
            <View key={gId} style={s.scoreRow}>
              <Text style={s.scoreRank}>#{i + 1}</Text>
              <Text style={s.scoreName}>{memberName(gId)}</Text>
              <View style={s.scorePtsBadge}>
                <Text style={s.scorePts}>{pts} pts</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const ACCENT = "#f59e0b";
const GREEN = "#22c55e";

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  phaseBadge: {
    backgroundColor: "#1a1a1a",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#333",
  },
  phaseText: { color: ACCENT, fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  toggleBtnActive: { backgroundColor: ACCENT },
  toggleText: { color: "#666", fontSize: 13, fontWeight: "700" },
  toggleTextActive: { color: "#fff" },

  section: {
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#1e1e1e",
  },
  sectionLabel: { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  infoText: { color: "#666", fontSize: 13 },

  roundBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roundInfo: { color: "#555", fontSize: 12 },

  headlineCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#1a1500",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: ACCENT + "44",
  },
  headlineEmoji: { fontSize: 22, marginTop: 2 },
  headlineText: { color: "#fff", fontSize: 14, fontWeight: "600", flex: 1, lineHeight: 20 },

  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  voteBarWrap: {
    flex: 1,
    height: 8,
    backgroundColor: "#1a1a1a",
    borderRadius: 4,
    overflow: "hidden",
  },
  voteBar: {
    height: 8,
    backgroundColor: GREEN,
    borderRadius: 4,
  },
  voteCount: { color: "#aaa", fontSize: 13, fontWeight: "700", minWidth: 40, textAlign: "right" },

  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#000", fontSize: 15, fontWeight: "900", letterSpacing: 1 },

  answerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0a1a0a",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: GREEN + "55",
  },
  answerEmoji: { fontSize: 28 },
  answerTextWrap: { flex: 1, gap: 2 },
  answerLabel: { color: GREEN, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  answerValue: { color: "#fff", fontSize: 15, fontWeight: "700" },

  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1c0d00",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f97316" + "55",
  },
  streakEmoji: { fontSize: 20 },
  streakText: { color: "#fb923c", fontSize: 14, fontWeight: "700" },

  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  scoreRank: { color: "#555", fontSize: 13, fontWeight: "700", width: 28 },
  scoreName: { color: "#fff", fontSize: 14, fontWeight: "600", flex: 1 },
  scorePtsBadge: {
    backgroundColor: "#1a1200",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: ACCENT + "55",
  },
  scorePts: { color: ACCENT, fontSize: 13, fontWeight: "700" },
});
