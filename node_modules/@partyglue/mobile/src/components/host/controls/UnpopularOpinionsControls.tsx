import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { HostActionButton } from "../HostActionButton";
import { JudgeView } from "../../experiences/unpopular-opinions/JudgeView";
import { GuessingView as OpinionsGuessing } from "../../experiences/unpopular-opinions/GuessingView";
import { RevealView as OpinionsReveal } from "../../experiences/unpopular-opinions/RevealView";

// ─────────────────────────────────────────────────────────────────────────────
// Content bank — 10 opinion prompts with preset judge scores
// ─────────────────────────────────────────────────────────────────────────────

interface Opinion {
  prompt: string;
  judgeScore: number; // 1–10 "unpopularity" rating
}

const OPINION_BANK: Opinion[] = [
  { prompt: "Pineapple on pizza is actually good",               judgeScore: 7 },
  { prompt: "Cats are better pets than dogs",                    judgeScore: 6 },
  { prompt: "Mondays aren't that bad",                           judgeScore: 3 },
  { prompt: "The sequel is better than the original movie",      judgeScore: 5 },
  { prompt: "Winter is the best season",                         judgeScore: 4 },
  { prompt: "Breakfast is overrated and should be skipped",      judgeScore: 6 },
  { prompt: "Open-plan offices are better for productivity",     judgeScore: 8 },
  { prompt: "Raisins in cookies are a welcome surprise",         judgeScore: 9 },
  { prompt: "Traffic isn't that stressful — it's thinking time", judgeScore: 2 },
  { prompt: "Cilantro makes everything taste better",            judgeScore: 5 },
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

type OpPhase = "idle" | "judging" | "guessing" | "reveal" | "final";

interface OpState {
  phase: OpPhase;
  opinions: Opinion[];
  idx: number;
  scores: Record<string, number>;
}

const IDLE_STATE: OpState = { phase: "idle", opinions: [], idx: 0, scores: {} };

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

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function scorePoints(guess: number, actual: number): number {
  const diff = Math.abs(guess - actual);
  if (diff === 0) return 300;
  if (diff === 1) return 200;
  if (diff === 2) return 100;
  return 0;
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

export function UnpopularOpinionsControls({ viewMode, onViewModeChange: setViewMode }: ViewModeProps) {
  const { dispatch } = useRoom();
  const [game, setGame]         = useState<OpState>(IDLE_STATE);

  const isActive = game.phase !== "idle";
  const current  = game.opinions[game.idx];

  useEffect(() => {
    if (game.phase !== "guessing") return;
    const t = setTimeout(() => {
      revealRound();
    }, 4000);
    return () => clearTimeout(t);
  }, [game.phase, game.idx]);

  // ── Start game ─────────────────────────────────────────────────────────────

  function startGame() {
    const opinions = shuffled(OPINION_BANK).slice(0, TOTAL_ROUNDS);
    const scores: Record<string, number> = { [MOCK_GUEST]: 0 };
    AI_PLAYERS.forEach(p => { scores[p.id] = 0; });

    setGame({ phase: "judging", opinions, idx: 0, scores });
    setViewMode("player");

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "unpopular_opinions",
      view: "opinions_judging",
      viewData: { prompt: opinions[0].prompt },
      expState: { phase: "judging", round: 1, totalRounds: TOTAL_ROUNDS, judgeId: MOCK_GUEST },
    });
  }

  // ── Start guessing ─────────────────────────────────────────────────────────

  function startGuessing() {
    if (!current) return;

    setGame(prev => ({ ...prev, phase: "guessing" }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "unpopular_opinions",
      view: "opinions_guessing",
      viewData: { prompt: current.prompt, isJudge: false },
      expState: { phase: "guessing", round: game.idx + 1, totalRounds: TOTAL_ROUNDS, judgeId: MOCK_GUEST },
    });
    setViewMode("player");
  }

  // ── Reveal round ───────────────────────────────────────────────────────────

  function revealRound() {
    if (!current) return;

    const { judgeScore } = current;
    const newScores = { ...game.scores };

    // Host guesses exactly judgeScore in demo
    const hostGuess = judgeScore;
    const hostPts   = scorePoints(hostGuess, judgeScore);
    newScores[MOCK_GUEST] = (newScores[MOCK_GUEST] ?? 0) + hostPts;

    const guesses: Record<string, number>    = { [MOCK_GUEST]: hostGuess };
    const pointsEarned: Record<string, number> = { [MOCK_GUEST]: hostPts };

    AI_PLAYERS.forEach(ai => {
      // Skill maps to noise: high skill = small noise
      const maxNoise = Math.round((1 - ai.skill) * 4);
      const noise    = Math.floor(Math.random() * (maxNoise + 1)) * (Math.random() < 0.5 ? 1 : -1);
      const aiGuess  = clamp(judgeScore + noise, 1, 10);
      const aiPts    = scorePoints(aiGuess, judgeScore);
      guesses[ai.id]      = aiGuess;
      pointsEarned[ai.id] = aiPts;
      newScores[ai.id]    = (newScores[ai.id] ?? 0) + aiPts;
    });

    const isLast    = game.idx + 1 >= TOTAL_ROUNDS;
    const newPhase: OpPhase = isLast ? "final" : "reveal";

    setGame(prev => ({ ...prev, phase: newPhase, scores: newScores }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "unpopular_opinions",
      view: "opinions_reveal",
      viewData: {
        prompt:      current.prompt,
        judgeId:     MOCK_GUEST,
        judgeScore,
        guesses,
        bets:        {},
        pointsEarned,
      },
      expState: { phase: "reveal", round: game.idx + 1, totalRounds: TOTAL_ROUNDS, scores: newScores },
    });
    setViewMode("player");
  }

  // ── Next round ─────────────────────────────────────────────────────────────

  function nextRound() {
    const nextIdx = game.idx + 1;
    const next    = game.opinions[nextIdx];
    if (!next) return;

    setGame(prev => ({ ...prev, phase: "judging", idx: nextIdx }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "unpopular_opinions",
      view: "opinions_judging",
      viewData: { prompt: next.prompt },
      expState: { phase: "judging", round: nextIdx + 1, totalRounds: TOTAL_ROUNDS, judgeId: MOCK_GUEST },
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
        {game.phase === "judging"  && <JudgeView />}
        {game.phase === "guessing" && <OpinionsGuessing />}
        {(game.phase === "reveal" || game.phase === "final") && <OpinionsReveal />}
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
              <Text style={s.pillText}>🎤  UNPOPULAR OPINIONS</Text>
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

        {/* Opinion card — judge score visible to host */}
        {current && (
          <View style={s.card}>
            <Text style={s.labelSmall}>CURRENT OPINION</Text>
            <Text style={s.opinionText}>"{current.prompt}"</Text>
            <View style={s.divider} />
            <View style={s.judgeRow}>
              <View style={s.judgeBadge}>
                <Text style={s.judgeBadgeLabel}>JUDGE SCORE</Text>
                <Text style={s.judgeBadgeValue}>{current.judgeScore} / 10</Text>
              </View>
              <View style={s.scaleRow}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <View
                    key={n}
                    style={[s.scaleDot, n <= current.judgeScore && s.scaleDotFilled]}
                  />
                ))}
              </View>
            </View>
            <Text style={s.judgeHint}>
              Points: exact = 300 · within 1 = 200 · within 2 = 100
            </Text>
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
          {game.phase === "judging" && (
            <HostActionButton label="💬  Start Guessing" onPress={startGuessing} />
          )}
          {game.phase === "guessing" && (
            <HostActionButton label="📊  Reveal Scores" onPress={revealRound} />
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
        <Text style={s.idleTitle}>🎤  Unpopular Opinions</Text>
        <Text style={s.idleSubtitle}>5 rounds · Judge scores opinions · Guess the score · 300 pts exact</Text>
        <View style={s.divider} />
        <Text style={s.labelSmall}>HOW IT WORKS</Text>
        <Text style={s.infoText}>
          Each round the host reads an opinion and secretly rates its "unpopularity" from 1 to 10.
          Everyone else guesses the score. The closer you are, the more points you earn.
        </Text>
      </View>
      <TouchableOpacity onPress={startGame} activeOpacity={0.85}>
        <LinearGradient colors={["#4c1d95", "#6c47ff"]} style={s.launchBtn}>
          <Text style={s.launchEmoji}>🎤</Text>
          <View>
            <Text style={s.launchLabel}>Start Unpopular Opinions</Text>
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
  opinionText:      { color: "#fff", fontSize: 16, fontWeight: "800", lineHeight: 24, fontStyle: "italic" },
  divider:          { height: 1, backgroundColor: "#222" },
  labelSmall:       { color: "#444", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  judgeRow:         { flexDirection: "row", alignItems: "center", gap: 12 },
  judgeBadge:       { backgroundColor: "#1a1040", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: ACCENT + "55", alignItems: "center" },
  judgeBadgeLabel:  { color: "#8b5cf6", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  judgeBadgeValue:  { color: "#fff", fontSize: 22, fontWeight: "900" },
  scaleRow:         { flexDirection: "row", gap: 4, flexWrap: "wrap", flex: 1 },
  scaleDot:         { width: 16, height: 16, borderRadius: 8, backgroundColor: "#222", borderWidth: 1, borderColor: "#333" },
  scaleDotFilled:   { backgroundColor: ACCENT, borderColor: ACCENT },
  judgeHint:        { color: "#444", fontSize: 11 },

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
