import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { HostActionButton } from "../HostActionButton";
import { DrawingView } from "../../experiences/drawback/DrawingView";
import { VotingView as DrawVoting } from "../../experiences/drawback/VotingView";
import { RevealView as DrawReveal } from "../../experiences/drawback/RevealView";

// ─────────────────────────────────────────────────────────────────────────────
// Content bank — 10 drawing prompts
// ─────────────────────────────────────────────────────────────────────────────

const PROMPT_BANK: string[] = [
  "A dragon eating sushi at a fancy restaurant",
  "A cat teaching yoga to confused penguins",
  "A wizard stuck in a traffic jam on a broomstick",
  "An astronaut trying to eat a giant sandwich in zero gravity",
  "A dog running for president giving a speech",
  "A vampire trying to order a coffee at Starbucks",
  "Bigfoot competing in a ballroom dancing competition",
  "A pirate who is also a barista working the morning rush",
  "A T-Rex attempting to do push-ups",
  "A ghost haunting a smart home that won't obey any commands",
];

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AI_PLAYERS = [
  { id: "ai_becca",  name: "Becca",  skill: 0.88 },
  { id: "ai_tim",    name: "Tim",    skill: 0.74 },
  { id: "ai_mazsle", name: "Mazsle", skill: 0.62 },
  { id: "ai_banks",  name: "Banks",  skill: 0.50 },
  { id: "ai_mel",    name: "Mel",    skill: 0.80 },
];

const MOCK_GUEST   = "host-player";
const ACCENT       = "#6c47ff";
const TOTAL_ROUNDS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// State types
// ─────────────────────────────────────────────────────────────────────────────

type DrawPhase = "idle" | "drawing" | "voting" | "reveal" | "final";

interface DrawState {
  phase: DrawPhase;
  prompts: string[];
  idx: number;
  scores: Record<string, number>;
}

const IDLE_STATE: DrawState = { phase: "idle", prompts: [], idx: 0, scores: {} };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildLbData(scores: Record<string, number>) {
  return [
    { guestId: MOCK_GUEST, score: scores[MOCK_GUEST] ?? 0, playerNum: 1, isMe: true, displayName: "You" },
    ...AI_PLAYERS.map((ai, i) => ({
      guestId: ai.id, score: scores[ai.id] ?? 0, playerNum: i + 2, isMe: false, displayName: ai.name,
    })),
  ].sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────────────────
// View mode props
// ─────────────────────────────────────────────────────────────────────────────

interface ViewModeProps {
  viewMode: "player" | "host";
  onViewModeChange: (mode: "player" | "host") => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DrawbackControls({ viewMode, onViewModeChange: setViewMode }: ViewModeProps) {
  const { dispatch } = useRoom();
  const [game, setGame]         = useState<DrawState>(IDLE_STATE);

  const isActive      = game.phase !== "idle";
  const currentPrompt = game.prompts[game.idx];

  // ── Start game ─────────────────────────────────────────────────────────────

  function startGame() {
    const prompts = shuffled(PROMPT_BANK).slice(0, TOTAL_ROUNDS);
    const scores: Record<string, number> = { [MOCK_GUEST]: 0 };
    AI_PLAYERS.forEach(p => { scores[p.id] = 0; });

    setGame({ phase: "drawing", prompts, idx: 0, scores });
    setViewMode("player");

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "drawback",
      view: "drawback_drawing",
      viewData: { prompt: prompts[0] },
      expState: { phase: "drawing", round: 1, totalRounds: TOTAL_ROUNDS },
    });
  }

  // ── Start voting ───────────────────────────────────────────────────────────

  function startVoting() {
    const drawings = [
      { guestId: MOCK_GUEST, playerNum: 1, isMe: true },
      ...AI_PLAYERS.map((ai, i) => ({ guestId: ai.id, playerNum: i + 2, isMe: false })),
    ];

    setGame(prev => ({ ...prev, phase: "voting" }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "drawback",
      view: "drawback_voting",
      viewData: { drawings },
      expState: { phase: "voting", round: game.idx + 1, totalRounds: TOTAL_ROUNDS },
    });
    setViewMode("player");
  }

  // ── Reveal round ───────────────────────────────────────────────────────────

  function revealRound() {
    const newScores = { ...game.scores };

    // Pick winner — first AI player whose random() < skill, fallback to MOCK_GUEST
    let winnerId = MOCK_GUEST;
    for (const ai of AI_PLAYERS) {
      if (Math.random() < ai.skill) {
        winnerId = ai.id;
        break;
      }
    }

    newScores[winnerId] = (newScores[winnerId] ?? 0) + 300;

    // Build vote distribution — winner gets ~half the votes, spread rest
    const totalVotes = 6;
    const winnerVotes = 3;
    const otherVotes  = totalVotes - winnerVotes;

    const allPlayers = [MOCK_GUEST, ...AI_PLAYERS.map(ai => ai.id)];
    const entries = allPlayers.map((guestId, i) => ({
      guestId,
      playerNum: i + 1,
      votes: guestId === winnerId ? winnerVotes : Math.floor(otherVotes / (allPlayers.length - 1)),
    }));

    const isLast    = game.idx + 1 >= TOTAL_ROUNDS;
    const newPhase: DrawPhase = isLast ? "final" : "reveal";

    setGame(prev => ({ ...prev, phase: newPhase, scores: newScores }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "drawback",
      view: "drawback_reveal",
      viewData: { prompt: currentPrompt, winner: { guestId: winnerId }, entries },
      expState: { phase: "reveal", round: game.idx + 1, totalRounds: TOTAL_ROUNDS, scores: newScores },
    });
    setViewMode("player");
  }

  // ── Next round ─────────────────────────────────────────────────────────────

  function nextRound() {
    const nextIdx = game.idx + 1;
    const next    = game.prompts[nextIdx];
    if (!next) return;

    setGame(prev => ({ ...prev, phase: "drawing", idx: nextIdx }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "drawback",
      view: "drawback_drawing",
      viewData: { prompt: next },
      expState: { phase: "drawing", round: nextIdx + 1, totalRounds: TOTAL_ROUNDS },
    });
    setViewMode("player");
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function resetGame() {
    setGame(IDLE_STATE);
    setViewMode("player");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Player view
  // ─────────────────────────────────────────────────────────────────────────

  if (isActive && viewMode === "player") {
    return (
      <View style={{ flex: 1, minHeight: 500 }}>
        {game.phase === "drawing" && <DrawingView />}
        {game.phase === "voting"  && <DrawVoting />}
        {(game.phase === "reveal" || game.phase === "final") && <DrawReveal />}
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Host controls — active game
  // ─────────────────────────────────────────────────────────────────────────

  if (isActive) {
    const score   = game.scores[MOCK_GUEST] ?? 0;
    const isFinal = game.phase === "final";

    return (
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#1a0840", "#2a1060"]} style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.pill}>
              <Text style={s.pillText}>🎨  DRAWBACK</Text>
            </View>
            <Text style={s.headerRound}>Round {game.idx + 1} / {TOTAL_ROUNDS}</Text>
          </View>
          <View style={s.headerRight}>
            <View style={s.scoreChip}>
              <Text style={s.scoreEmoji}>⭐</Text>
              <Text style={s.scoreVal}>{score}</Text>
            </View>
            <TouchableOpacity style={s.playerViewBtn} onPress={() => setViewMode("player")}>
              <Text style={s.playerViewBtnText}>👁  Player View</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Current prompt */}
        {currentPrompt && (
          <View style={s.card}>
            <Text style={s.labelSmall}>CURRENT PROMPT</Text>
            <Text style={s.promptText}>"{currentPrompt}"</Text>
            <View style={s.phaseBadge}>
              <Text style={s.phaseText}>
                {game.phase === "drawing" ? "✏️  Players are drawing…" :
                 game.phase === "voting"  ? "🗳  Voting in progress…" :
                 isFinal ? "🏁  Game over!" : "🎉  Round revealed!"}
              </Text>
            </View>
          </View>
        )}

        {/* Mini leaderboard on final */}
        {isFinal && (
          <View style={s.lbMini}>
            <Text style={s.lbTitle}>🏆  Final Standings</Text>
            {buildLbData(game.scores).map((e, i) => (
              <View key={e.guestId} style={[s.lbRow, e.isMe && s.lbRowMe]}>
                <Text style={[s.lbRank, i === 0 && { color: "#FFD700" }]}>#{i + 1}</Text>
                <Text style={[s.lbName, e.isMe && { color: "#c4b5fd" }]}>{e.displayName}</Text>
                <Text style={[s.lbScore, e.isMe && { color: ACCENT }]}>{e.score} pts</Text>
              </View>
            ))}
          </View>
        )}

        {/* Controls */}
        <View style={s.controls}>
          {game.phase === "drawing" && (
            <HostActionButton label="🗳  Start Voting" onPress={startVoting} />
          )}
          {game.phase === "voting" && (
            <HostActionButton label="🏆  Reveal Winner" onPress={revealRound} />
          )}
          {game.phase === "reveal" && (
            <HostActionButton label={`▶  Next Round (${game.idx + 2}/${TOTAL_ROUNDS})`} onPress={nextRound} />
          )}
          {game.phase === "final" && (
            <HostActionButton label="🔄  Play Again" onPress={startGame} />
          )}
          <TouchableOpacity style={s.stopBtn} onPress={resetGame}>
            <Text style={s.stopBtnText}>⏹  Stop Game</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Idle — launch screen
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.card}>
        <Text style={s.idleTitle}>🎨  Drawback</Text>
        <Text style={s.idleSubtitle}>5 rounds · Draw a prompt · Vote for the best · 300 pts for winner</Text>
        <View style={s.divider} />
        <Text style={s.labelSmall}>HOW IT WORKS</Text>
        <Text style={s.infoText}>
          Each round players are given a funny prompt and must draw it as best they can.
          Then everyone votes for their favourite drawing. The most-voted drawing wins 300 points.
        </Text>
      </View>
      <TouchableOpacity onPress={startGame} activeOpacity={0.85}>
        <LinearGradient colors={["#4c1d95", "#6c47ff"]} style={s.launchBtn}>
          <Text style={s.launchEmoji}>🎨</Text>
          <View>
            <Text style={s.launchLabel}>Start Drawback</Text>
            <Text style={s.launchSub}>Offline · 5 rounds · 6 players</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────


const s = StyleSheet.create({
  container:        { gap: 14, paddingBottom: 20 },

  header:           { borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  headerLeft:       { gap: 6 },
  headerRight:      { alignItems: "flex-end", gap: 8 },
  pill:             { alignSelf: "flex-start", backgroundColor: "rgba(108,71,255,0.25)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: ACCENT + "55" },
  pillText:         { color: "#c4b5fd", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  headerRound:      { color: "#fff", fontSize: 20, fontWeight: "900" },
  scoreChip:        { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(99,102,241,0.25)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)" },
  scoreEmoji:       { fontSize: 14 },
  scoreVal:         { color: "#fff", fontWeight: "900", fontSize: 16 },
  playerViewBtn:    { backgroundColor: "#1a1040", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: ACCENT + "44" },
  playerViewBtnText:{ color: "#8b5cf6", fontSize: 11, fontWeight: "700" },

  card:             { backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#222", gap: 10 },
  promptText:       { color: "#fff", fontSize: 17, fontWeight: "800", lineHeight: 25, fontStyle: "italic" },
  phaseBadge:       { backgroundColor: "#1a1040", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: ACCENT + "33" },
  phaseText:        { color: "#c4b5fd", fontSize: 13, fontWeight: "700" },
  divider:          { height: 1, backgroundColor: "#222" },
  labelSmall:       { color: "#444", fontSize: 9, fontWeight: "800", letterSpacing: 2 },

  lbMini:           { backgroundColor: "#111", borderRadius: 14, borderWidth: 1, borderColor: "#222", padding: 14, gap: 8 },
  lbTitle:          { color: "#fff", fontSize: 15, fontWeight: "900", marginBottom: 4 },
  lbRow:            { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  lbRowMe:          { backgroundColor: "rgba(108,71,255,0.1)", borderRadius: 8, paddingHorizontal: 8 },
  lbRank:           { color: "#555", fontSize: 14, fontWeight: "800", minWidth: 32 },
  lbName:           { flex: 1, color: "#ccc", fontSize: 14, fontWeight: "600" },
  lbScore:          { color: "#888", fontSize: 16, fontWeight: "900" },

  controls:         { gap: 8, borderTopWidth: 1, borderTopColor: "#1a1a1a", paddingTop: 12, marginTop: 4 },
  stopBtn:          { alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#1e1e1e" },
  stopBtnText:      { color: "#444", fontSize: 13, fontWeight: "700" },

  idleTitle:        { color: "#fff", fontSize: 22, fontWeight: "900" },
  idleSubtitle:     { color: "#666", fontSize: 13 },
  infoText:         { color: "#777", fontSize: 13, lineHeight: 20 },
  launchBtn:        { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16 },
  launchEmoji:      { fontSize: 28 },
  launchLabel:      { color: "#fff", fontSize: 16, fontWeight: "800" },
  launchSub:        { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },
});
