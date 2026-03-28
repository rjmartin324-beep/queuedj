import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { HostActionButton } from "../HostActionButton";
import { WordInputView } from "../../experiences/scrapbook-sabotage/WordInputView";
import { WordBankView } from "../../experiences/scrapbook-sabotage/WordBankView";
import { WritingView } from "../../experiences/scrapbook-sabotage/WritingView";
import { VotingView as ScrapVoting } from "../../experiences/scrapbook-sabotage/VotingView";
import { ScrapbookRevealView as ScrapReveal } from "../../experiences/scrapbook-sabotage/RevealView";

// ─────────────────────────────────────────────────────────────────────────────
// Content bank — 6 story prompts with word banks
// ─────────────────────────────────────────────────────────────────────────────

interface StoryPrompt {
  prompt: string;
  wordBank: string[];
}

const PROMPT_BANK: StoryPrompt[] = [
  {
    prompt: "A vacation that went completely wrong",
    wordBank: ["sunburn", "cancelled", "lost luggage", "food poisoning", "rainstorm", "no wifi", "flat tire", "wrong hotel"],
  },
  {
    prompt: "The worst first date imaginable",
    wordBank: ["awkward silence", "spilled drink", "wrong restaurant", "dead phone", "rain", "ex showed up", "forgot wallet", "wrong name"],
  },
  {
    prompt: "A birthday party nobody will forget",
    wordBank: ["caught fire", "surprise guest", "cake disaster", "wrong person", "confetti", "escaped animal", "power outage", "wrong song"],
  },
  {
    prompt: "What happened when the power went out for 24 hours",
    wordBank: ["candles", "board games", "melted ice cream", "ghost stories", "no charging", "blanket fort", "flashlight tag", "cold pizza"],
  },
  {
    prompt: "A job interview that could not have gone worse",
    wordBank: ["wrong floor", "spilled coffee", "forgot name", "phone rang", "fell asleep", "wrong company", "brought dog", "late"],
  },
  {
    prompt: "The day someone accidentally became internet famous",
    wordBank: ["viral video", "embarrassing", "comments section", "TV appearance", "paparazzi", "trending", "meme", "fan mail"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// AI story templates — one set per prompt index
// ─────────────────────────────────────────────────────────────────────────────

const AI_STORIES: Record<number, string[][]> = {
  0: [
    ["It started when our flight got cancelled, leaving us stranded with sunburn and lost luggage in the wrong hotel."],
    ["Day one: food poisoning. Day two: rainstorm. Day three: flat tire. At least there was no wifi to document the shame."],
    ["We arrived to a rainstorm, a wrong hotel booking, and somehow still got sunburned through the clouds."],
    ["Lost luggage on arrival, food poisoning by dinner, and a flat tire on the way back. Zero stars, would not recommend."],
    ["The no wifi situation was somehow the worst part of the sunburn, cancelled tour, wrong hotel disaster combo."],
  ],
  1: [
    ["I spilled my drink before we even sat down, then an awkward silence lasted fifteen minutes straight."],
    ["The wrong restaurant was fully booked, my phone died, and they kept calling me the wrong name all night."],
    ["My ex showed up at the wrong restaurant, my phone was dead, and I'd forgotten my wallet. Classic Tuesday."],
    ["An awkward silence so long the waiter checked if we were okay — then the ex walked in and the rain started."],
    ["Forgot my wallet. Wrong restaurant. Dead phone. When the ex showed up I just ordered another spilled drink."],
  ],
  2: [
    ["The cake disaster was fine until the escaped animal knocked everything into the confetti pile and the wrong song played."],
    ["Happy birthday — to the wrong person — while a power outage plunged us into darkness and the cake caught fire."],
    ["Surprise guest arrived just as the cake caught fire, the wrong song blasted, and an animal escaped its enclosure."],
    ["Nobody planned for the confetti cannon to malfunction, the wrong song to play, and the birthday cake to catch fire."],
    ["The escaped animal ate the cake while a power outage hit and we sang happy birthday to entirely the wrong person."],
  ],
  3: [
    ["We found every candle in the house and built a blanket fort to eat cold pizza by flashlight like kings."],
    ["Board games, ghost stories, and melted ice cream — the no charging situation hit hardest by hour three."],
    ["Flashlight tag in the blanket fort was incredible until someone knocked over all the candles near the cold pizza."],
    ["No charging meant no distractions. We played board games, told ghost stories, and ate cold pizza happily all night."],
    ["The melted ice cream was tragic, but the blanket fort ghost story session by candlelight was honestly perfect."],
  ],
  4: [
    ["I got off on the wrong floor, spilled coffee on reception, and then my phone rang mid-handshake playing baby shark."],
    ["I was late, brought the dog, forgot the interviewer's name, and fell asleep briefly during the salary discussion."],
    ["Wrong company, wrong floor, spilled coffee, and a phone that rang the entire time. Got the job somehow."],
    ["My dog came in, fell asleep under the desk, and snored through the entire wrong company interview I'd accidentally booked."],
    ["Forgot the name, spilled the coffee, sat in the wrong seat — the late arrival honestly improved things."],
  ],
  5: [
    ["The viral video was embarrassing, the comments section was worse, and suddenly there was fan mail at my door."],
    ["Trending by noon, TV appearance by 3pm, full meme status by midnight. I just wanted to eat lunch."],
    ["The paparazzi outside was surreal, but nothing topped opening the comments section on my accidental viral video."],
    ["Three days of fan mail, a trending meme, and a TV appearance — all because of one embarrassing Tuesday moment."],
    ["My meme was everywhere. The comments section was a disaster. The paparazzi outside my flat was the final straw."],
  ],
};

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
const TOTAL_ROUNDS = 3;

// ─────────────────────────────────────────────────────────────────────────────
// State types
// ─────────────────────────────────────────────────────────────────────────────

type ScrapPhase = "idle" | "word_input" | "writing_prep" | "writing" | "voting" | "reveal" | "final";

interface ScrapState {
  phase: ScrapPhase;
  prompts: StoryPrompt[];
  idx: number;
  scores: Record<string, number>;
}

const IDLE_STATE: ScrapState = { phase: "idle", prompts: [], idx: 0, scores: {} };

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

export function ScrapbookControls({ viewMode, onViewModeChange: setViewMode }: ViewModeProps) {
  const { dispatch } = useRoom();
  const [game, setGame]         = useState<ScrapState>(IDLE_STATE);

  const isActive      = game.phase !== "idle";
  const currentPrompt = game.prompts[game.idx];

  useEffect(() => {
    if (game.phase !== "word_input") return;
    const t = setTimeout(() => {
      openWordBank();
    }, 5000);
    return () => clearTimeout(t);
  }, [game.phase, game.idx]);

  // ── Start game ─────────────────────────────────────────────────────────────

  function startGame() {
    const prompts = shuffled(PROMPT_BANK).slice(0, TOTAL_ROUNDS);
    const scores: Record<string, number> = { [MOCK_GUEST]: 0 };
    AI_PLAYERS.forEach(p => { scores[p.id] = 0; });

    setGame({ phase: "word_input", prompts, idx: 0, scores });
    setViewMode("player");

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "scrapbook_sabotage",
      view: "scrapbook_word_input",
      viewData: { prompt: prompts[0].prompt, submittedCount: 0 },
      expState: { phase: "word_input", round: 1, totalRounds: TOTAL_ROUNDS },
    });
  }

  // ── Open word bank ─────────────────────────────────────────────────────────

  function openWordBank() {
    if (!currentPrompt) return;

    setGame(prev => ({ ...prev, phase: "writing_prep" }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "scrapbook_sabotage",
      view: "scrapbook_word_bank",
      viewData: { words: currentPrompt.wordBank },
      expState: { phase: "writing_prep", round: game.idx + 1, totalRounds: TOTAL_ROUNDS },
    });
    setViewMode("player");
  }

  // ── Start writing ──────────────────────────────────────────────────────────

  function startWriting() {
    if (!currentPrompt) return;

    setGame(prev => ({ ...prev, phase: "writing" }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "scrapbook_sabotage",
      view: "scrapbook_writing",
      viewData: { prompt: currentPrompt.prompt, wordBank: currentPrompt.wordBank, timeLimit: 60 },
      expState: { phase: "writing", round: game.idx + 1, totalRounds: TOTAL_ROUNDS },
    });
    setViewMode("player");
  }

  // ── Start voting ───────────────────────────────────────────────────────────

  function startVoting() {
    if (!currentPrompt) return;

    // Pick AI stories for this prompt index, falling back to index 0
    const storyBank = AI_STORIES[game.idx] ?? AI_STORIES[0];
    const aiEntries = AI_PLAYERS.map((ai, i) => ({
      guestId:   ai.id,
      playerNum: i + 2,
      text:      storyBank[i] ?? storyBank[0],
    }));

    const entries = [
      { guestId: MOCK_GUEST, playerNum: 1, text: "My story about the whole ordeal…" },
      ...aiEntries,
    ];

    const responses = entries.map(e => ({ id: e.guestId, text: e.text }));

    setGame(prev => ({ ...prev, phase: "voting" }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "scrapbook_sabotage",
      view: "scrapbook_voting",
      viewData: { responses },
      expState: { phase: "voting", round: game.idx + 1, totalRounds: TOTAL_ROUNDS },
    });
    setViewMode("player");
  }

  // ── Reveal round ───────────────────────────────────────────────────────────

  function revealRound() {
    if (!currentPrompt) return;

    const storyBank = AI_STORIES[game.idx] ?? AI_STORIES[0];

    const allPlayers = [MOCK_GUEST, ...AI_PLAYERS.map(ai => ai.id)];

    // Random vote distribution — weighted by skill
    const weights = [0.5, ...AI_PLAYERS.map(ai => ai.skill)];
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const totalVotes  = 10;

    const voteMap: Record<string, number> = {};
    let remaining = totalVotes;
    allPlayers.forEach((id, i) => {
      const raw = Math.round((weights[i] / totalWeight) * totalVotes);
      voteMap[id] = raw;
      remaining  -= raw;
    });
    // Give leftover votes to highest-skill player
    const topAi = AI_PLAYERS[0].id;
    voteMap[topAi] = (voteMap[topAi] ?? 0) + remaining;

    // Winner is the player with most votes
    const winnerId = allPlayers.reduce((best, id) =>
      (voteMap[id] ?? 0) > (voteMap[best] ?? 0) ? id : best
    , allPlayers[0]);

    const newScores = { ...game.scores };
    newScores[winnerId] = (newScores[winnerId] ?? 0) + 300;

    const entries = allPlayers.map((guestId, i) => ({
      guestId,
      playerNum: i + 1,
      text: guestId === MOCK_GUEST
        ? "My story about the whole ordeal…"
        : storyBank[i - 1] ?? storyBank[0],
      votes: voteMap[guestId] ?? 0,
    }));

    const isLast    = game.idx + 1 >= TOTAL_ROUNDS;
    const newPhase: ScrapPhase = isLast ? "final" : "reveal";

    setGame(prev => ({ ...prev, phase: newPhase, scores: newScores }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "scrapbook_sabotage",
      view: "scrapbook_reveal",
      viewData: { winner: { guestId: winnerId }, entries },
      expState: { phase: "reveal", round: game.idx + 1, totalRounds: TOTAL_ROUNDS, scores: newScores },
    });
    setViewMode("player");
  }

  // ── Next round ─────────────────────────────────────────────────────────────

  function nextRound() {
    const nextIdx = game.idx + 1;
    const next    = game.prompts[nextIdx];
    if (!next) return;

    setGame(prev => ({ ...prev, phase: "word_input", idx: nextIdx }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "scrapbook_sabotage",
      view: "scrapbook_word_input",
      viewData: { prompt: next.prompt, submittedCount: 0 },
      expState: { phase: "word_input", round: nextIdx + 1, totalRounds: TOTAL_ROUNDS },
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
        {game.phase === "word_input"    && <WordInputView />}
        {game.phase === "writing_prep"  && <WordBankView />}
        {game.phase === "writing"       && <WritingView />}
        {game.phase === "voting"        && <ScrapVoting />}
        {(game.phase === "reveal" || game.phase === "final") && <ScrapReveal />}
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Host controls — active game
  // ─────────────────────────────────────────────────────────────────────────

  if (isActive) {
    const score   = game.scores[MOCK_GUEST] ?? 0;
    const isFinal = game.phase === "final";

    const phaseLabel: Record<ScrapPhase, string> = {
      idle:         "",
      word_input:   "📝  Players submitting words…",
      writing_prep: "📚  Word bank revealed",
      writing:      "✍️  Writing in progress…",
      voting:       "🗳  Voting in progress…",
      reveal:       "🎉  Round revealed!",
      final:        "🏁  Game over!",
    };

    return (
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#1a0840", "#2a1060"]} style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.pill}>
              <Text style={s.pillText}>📖  SCRAPBOOK SABOTAGE</Text>
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

        {/* Prompt card */}
        {currentPrompt && (
          <View style={s.card}>
            <Text style={s.labelSmall}>CURRENT PROMPT</Text>
            <Text style={s.promptText}>"{currentPrompt.prompt}"</Text>
            <View style={s.phaseBadge}>
              <Text style={s.phaseText}>{phaseLabel[game.phase]}</Text>
            </View>
            <View style={s.divider} />
            <Text style={s.labelSmall}>WORD BANK</Text>
            <View style={s.wordBankRow}>
              {currentPrompt.wordBank.map(word => (
                <View key={word} style={s.wordChip}>
                  <Text style={s.wordChipText}>{word}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Mini leaderboard on reveal + final */}
        {(game.phase === "reveal" || isFinal) && (
          <View style={s.lbMini}>
            <Text style={s.lbTitle}>
              {isFinal ? "🏆  Final Standings" : `📊  After Round ${game.idx + 1}`}
            </Text>
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
          {game.phase === "word_input" && (
            <HostActionButton label="📚  Open Word Bank" onPress={openWordBank} />
          )}
          {game.phase === "writing_prep" && (
            <HostActionButton label="✍️  Start Writing" onPress={startWriting} />
          )}
          {game.phase === "writing" && (
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
          {(game.phase === "word_bank" || game.phase === "writing" || game.phase === "voting") && (
            <TouchableOpacity style={s.skipBtn} onPress={() => sendAction("skip_round", {})}>
              <Text style={s.skipBtnText}>⏭  Skip Phase (server)</Text>
            </TouchableOpacity>
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
        <Text style={s.idleTitle}>📖  Scrapbook Sabotage</Text>
        <Text style={s.idleSubtitle}>3 rounds · Write a story · Vote for the best · 300 pts for winner</Text>
        <View style={s.divider} />
        <Text style={s.labelSmall}>HOW IT WORKS</Text>
        <Text style={s.infoText}>
          Each round players get a story prompt and a bank of funny words they must use.
          Everyone writes a short story, then votes for their favourite. Best story wins 300 points.
        </Text>
      </View>
      <TouchableOpacity onPress={startGame} activeOpacity={0.85}>
        <LinearGradient colors={["#4c1d95", "#6c47ff"]} style={s.launchBtn}>
          <Text style={s.launchEmoji}>📖</Text>
          <View>
            <Text style={s.launchLabel}>Start Scrapbook Sabotage</Text>
            <Text style={s.launchSub}>Offline · 3 rounds · 6 players</Text>
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
  promptText:       { color: "#fff", fontSize: 16, fontWeight: "800", lineHeight: 24, fontStyle: "italic" },
  phaseBadge:       { backgroundColor: "#1a1040", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: ACCENT + "33" },
  phaseText:        { color: "#c4b5fd", fontSize: 13, fontWeight: "700" },
  divider:          { height: 1, backgroundColor: "#222" },
  labelSmall:       { color: "#444", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  wordBankRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  wordChip:         { backgroundColor: "#1a1040", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: ACCENT + "44" },
  wordChipText:     { color: "#c4b5fd", fontSize: 12, fontWeight: "700" },

  lbMini:           { backgroundColor: "#111", borderRadius: 14, borderWidth: 1, borderColor: "#222", padding: 14, gap: 8 },
  lbTitle:          { color: "#fff", fontSize: 15, fontWeight: "900", marginBottom: 4 },
  lbRow:            { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  lbRowMe:          { backgroundColor: "rgba(108,71,255,0.1)", borderRadius: 8, paddingHorizontal: 8 },
  lbRank:           { color: "#555", fontSize: 14, fontWeight: "800", minWidth: 32 },
  lbName:           { flex: 1, color: "#ccc", fontSize: 14, fontWeight: "600" },
  lbScore:          { color: "#888", fontSize: 16, fontWeight: "900" },

  controls:         { gap: 8, borderTopWidth: 1, borderTopColor: "#1a1a1a", paddingTop: 12, marginTop: 4 },
  skipBtn:          { alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#f59e0b44", backgroundColor: "#f59e0b11" },
  skipBtnText:      { color: "#f59e0b", fontSize: 12, fontWeight: "700" },
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
