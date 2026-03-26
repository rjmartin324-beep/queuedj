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

const CATEGORIES = ["Animals", "Countries", "Foods", "Movies", "Cities", "Sports", "Colors"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_EMOJI: Record<Category, string> = {
  Animals: "🐾",
  Countries: "🌍",
  Foods: "🍕",
  Movies: "🎬",
  Cities: "🏙",
  Sports: "⚽",
  Colors: "🎨",
};

export function ChainReactionControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores: Record<string, number> = expState?.scores ?? {};
  const wordCount: number = expState?.wordCount ?? 0;
  const maxWords = 12;
  const requiredLetter: string = expState?.requiredLetter ?? "?";
  const currentTurnGuestId: string = expState?.currentTurnGuestId ?? "";
  const category: string = expState?.category ?? "";
  const members = state.members;

  function memberName(gId: string) {
    return members.find((m) => m.guestId === gId)?.displayName ?? gId.slice(0, 6);
  }

  function handleStart(cat: Category) {
    const guestIds = members.map((m) => m.guestId);
    sendAction("start", { category: cat, guestIds });
  }

  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const progressPct = Math.min((wordCount / maxWords) * 100, 100);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.headerRow}>
        <Text style={s.title}>CHAIN REACTION</Text>
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

      {/* ── WAITING: category selection ── */}
      {phase === "waiting" && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>SELECT CATEGORY TO START</Text>
          <Text style={s.infoText}>
            {members.length} player{members.length !== 1 ? "s" : ""} in room
          </Text>
          <View style={s.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={s.categoryBtn}
                onPress={() => handleStart(cat)}
              >
                <Text style={s.categoryEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                <Text style={s.categoryLabel}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── PLAYING ── */}
      {phase === "playing" && (
        <>
          <View style={s.section}>
            <Text style={s.sectionLabel}>CHAIN PROGRESS</Text>

            {category !== "" && (
              <View style={s.categoryActiveRow}>
                <Text style={s.categoryActiveEmoji}>
                  {CATEGORY_EMOJI[category as Category] ?? "🔗"}
                </Text>
                <Text style={s.categoryActiveText}>{category}</Text>
              </View>
            )}

            {/* Progress bar */}
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progressPct}%` as any }]} />
            </View>
            <View style={s.progressLabels}>
              <Text style={s.progressCount}>
                {wordCount} / {maxWords} words
              </Text>
              <Text style={s.progressPct}>{Math.round(progressPct)}%</Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>REQUIRED LETTER</Text>
            <View style={s.letterBox}>
              <Text style={s.letterText}>{requiredLetter.toUpperCase()}</Text>
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

      {/* ── SCORES ── */}
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
    </ScrollView>
  );
}

const ACCENT = "#06b6d4";
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

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  categoryBtn: {
    width: "30%",
    flexGrow: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  categoryEmoji: { fontSize: 22 },
  categoryLabel: { color: "#ccc", fontSize: 12, fontWeight: "700" },

  categoryActiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0a1a1f",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: ACCENT + "44",
  },
  categoryActiveEmoji: { fontSize: 18 },
  categoryActiveText: { color: ACCENT, fontSize: 14, fontWeight: "700" },

  progressTrack: {
    height: 8,
    backgroundColor: "#1a1a1a",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: ACCENT,
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressCount: { color: "#aaa", fontSize: 12, fontWeight: "600" },
  progressPct: { color: "#555", fontSize: 12 },

  letterBox: {
    backgroundColor: "#0a1a1f",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: ACCENT,
  },
  letterText: {
    color: ACCENT,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 4,
  },

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
    backgroundColor: "#041a1f",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: ACCENT + "55",
  },
  scorePts: { color: ACCENT, fontSize: 13, fontWeight: "700" },
});
