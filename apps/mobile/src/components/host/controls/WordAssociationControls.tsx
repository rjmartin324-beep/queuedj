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

export function WordAssociationControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores: Record<string, number> = expState?.scores ?? {};
  const chain: string[] = expState?.chain ?? [];
  const currentTurnGuestId: string = expState?.currentTurnGuestId ?? "";
  const wordCount: number = expState?.wordCount ?? 0;
  const members = state.members;

  function memberName(gId: string) {
    return members.find((m) => m.guestId === gId)?.displayName ?? gId.slice(0, 6);
  }

  function handleStart() {
    const guestIds = members.map((m) => m.guestId);
    sendAction("start", { guestIds, seedWord: "Music" });
  }

  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const lastFiveWords = chain.slice(-5);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.headerRow}>
        <Text style={s.title}>WORD ASSOCIATION</Text>
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
          <Text style={s.seedText}>Seed word: "Music"</Text>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={handleStart}
            disabled={members.length < 1}
          >
            <Text style={s.primaryBtnText}>START GAME</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── PLAYING ── */}
      {phase === "playing" && (
        <>
          <View style={s.section}>
            <Text style={s.sectionLabel}>CURRENT CHAIN</Text>
            <View style={s.chainRow}>
              {lastFiveWords.map((word, i) => (
                <View
                  key={i}
                  style={[s.chainWord, i === lastFiveWords.length - 1 && s.chainWordLast]}
                >
                  <Text
                    style={[
                      s.chainWordText,
                      i === lastFiveWords.length - 1 && s.chainWordTextLast,
                    ]}
                  >
                    {word}
                  </Text>
                </View>
              ))}
              {lastFiveWords.length === 0 && (
                <Text style={s.infoText}>No words yet</Text>
              )}
            </View>
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statValue}>{wordCount}</Text>
                <Text style={s.statLabel}>WORDS</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statValue}>{members.length}</Text>
                <Text style={s.statLabel}>PLAYERS</Text>
              </View>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>CURRENT TURN</Text>
            <View style={s.turnCard}>
              <Text style={s.turnEmoji}>🎙</Text>
              <Text style={s.turnName}>
                {currentTurnGuestId ? memberName(currentTurnGuestId) : "—"}
              </Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>CONTROLS</Text>
            <TouchableOpacity
              style={s.warningBtn}
              onPress={() => sendAction("timeout")}
            >
              <Text style={s.warningBtnText}>TIMEOUT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.dangerBtn, { marginTop: 8 }]}
              onPress={() => sendAction("end_game")}
            >
              <Text style={s.dangerBtnText}>END GAME</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── FINISHED / always show scores when available ── */}
      {sortedScores.length > 0 && (
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

      {/* End game always available while playing */}
      {phase !== "waiting" && phase !== "playing" && (
        <View style={s.section}>
          <Text style={s.infoText}>Game over. Check scores above.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const ACCENT = "#6c47ff";
const WARN = "#f59e0b";
const DANGER = "#ef4444";

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
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
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
  sectionLabel: {
    color: "#555",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  infoText: { color: "#666", fontSize: 13 },
  seedText: { color: "#aaa", fontSize: 14, fontWeight: "600" },

  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 1 },

  chainRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    minHeight: 36,
    alignItems: "center",
  },
  chainWord: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  chainWordLast: { borderColor: ACCENT, backgroundColor: "#1e1a2e" },
  chainWordText: { color: "#888", fontSize: 13, fontWeight: "600" },
  chainWordTextLast: { color: "#a78bfa" },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  statBox: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: "#222",
  },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "900" },
  statLabel: { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  turnCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  turnEmoji: { fontSize: 20 },
  turnName: { color: "#fff", fontSize: 15, fontWeight: "700" },

  warningBtn: {
    backgroundColor: "#1c1500",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: WARN,
  },
  warningBtnText: { color: WARN, fontSize: 14, fontWeight: "900", letterSpacing: 1 },

  dangerBtn: {
    backgroundColor: "#1a0808",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: DANGER,
  },
  dangerBtnText: { color: DANGER, fontSize: 14, fontWeight: "900", letterSpacing: 1 },

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
    backgroundColor: "#1a1a2e",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: ACCENT + "55",
  },
  scorePts: { color: "#a78bfa", fontSize: 13, fontWeight: "700" },
});
