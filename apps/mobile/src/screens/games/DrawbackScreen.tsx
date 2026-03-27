import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { PostGameCard } from "../../components/shared/PostGameCard";
import { StandaloneDrawingPad, DrawingDisplay } from "../../components/shared/StandaloneDrawingPad";
import type { DrawPath } from "../../components/shared/StandaloneDrawingPad";

const ACCENT      = "#c084fc";
const TOTAL_ROUNDS = 5;

const ALL_PROMPTS = [
  "A very confused penguin", "SpongeBob having a bad day", "A cat riding a bicycle",
  "The Eiffel Tower on fire", "A dog wearing sunglasses", "An astronaut eating pizza",
  "A grumpy old wizard", "A dinosaur in a business suit", "A mermaid playing guitar",
  "A ghost going grocery shopping", "A robot having feelings", "A pirate at the beach",
  "A kangaroo in a suit", "A hamster DJ", "A chicken crossing the road",
  "A vampire at the dentist", "A bear eating sushi", "A dragon afraid of fire",
  "Two aliens playing chess", "A snail winning a race", "A superhero stuck in traffic",
  "A mummy doing yoga", "A shark on a skateboard", "A witch baking cookies",
  "A gorilla playing piano", "A snowman at the beach", "A zombie chef",
  "A unicorn at the gym", "A spy in a tutu", "A toaster with legs",
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type Phase = "welcome" | "drawing" | "guessing" | "reveal" | "results";

export default function DrawbackScreen() {
  const router = useRouter();
  const [phase, setPhase]   = useState<Phase>("welcome");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [round, setRound]   = useState(0);
  const [score, setScore]   = useState(0);
  const [guess, setGuess]   = useState("");
  const [drawing, setDrawing] = useState<DrawPath[]>([]);
  const [roundResults, setRoundResults] = useState<{ prompt: string; guess: string; correct: boolean }[]>([]);

  const drawerName  = round % 2 === 0 ? "Player 1" : "Player 2";
  const guesserName = round % 2 === 0 ? "Player 2" : "Player 1";

  function startGame() {
    setPrompts(pickRandom(ALL_PROMPTS, TOTAL_ROUNDS));
    setRound(0);
    setScore(0);
    setGuess("");
    setDrawing([]);
    setRoundResults([]);
    setPhase("drawing");
  }

  function doneDrawing(paths: DrawPath[]) {
    setDrawing(paths);
    setGuess("");
    setPhase("guessing");
  }

  function submitGuess() {
    if (!guess.trim()) return;
    const prompt  = prompts[round];
    const correct = guess.trim().toLowerCase() === prompt.toLowerCase();
    if (correct) setScore(s => s + 100);
    setRoundResults(r => [...r, { prompt, guess: guess.trim(), correct }]);
    setPhase("reveal");
  }

  function nextRound() {
    const next = round + 1;
    if (next >= TOTAL_ROUNDS) {
      setPhase("results");
    } else {
      setRound(next);
      setGuess("");
      setDrawing([]);
      setPhase("drawing");
    }
  }

  // ── Welcome ──────────────────────────────────────────────────────────────────

  if (phase === "welcome") {
    return (
      <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={s.emoji}>🎨</Text>
            <Text style={s.title}>Drawback</Text>
            <Text style={s.sub}>Pass & play drawing game for 2 players</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• {TOTAL_ROUNDS} rounds — players alternate drawing</Text>
              <Text style={s.ruleItem}>• Draw the prompt on your phone</Text>
              <Text style={s.ruleItem}>• Pass to the other player to guess</Text>
              <Text style={s.ruleItem}>• Exact match = +100 pts per round</Text>
            </View>
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#7c3aed", ACCENT]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>START GAME</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Drawing ───────────────────────────────────────────────────────────────────

  if (phase === "drawing") {
    return (
      <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.roundPill}>Round {round + 1} / {TOTAL_ROUNDS}</Text>
            <Text style={s.scoreChip}>Score: {score}</Text>
          </View>
          <View style={s.playerBadgeWrap}>
            <View style={s.playerBadge}>
              <Text style={s.playerBadgeText}>✏️  {drawerName} — draw this!</Text>
            </View>
            <Text style={s.hint}>{guesserName} — look away!</Text>
          </View>
          <StandaloneDrawingPad
            prompt={prompts[round]}
            onDone={doneDrawing}
            accentColor={ACCENT}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Guessing ─────────────────────────────────────────────────────────────────

  if (phase === "guessing") {
    return (
      <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={s.topBar}>
              <Text style={s.roundPill}>Round {round + 1} / {TOTAL_ROUNDS}</Text>
              <Text style={s.scoreChip}>Score: {score}</Text>
            </View>
            <View style={s.playerBadgeWrap}>
              <View style={s.playerBadge}>
                <Text style={s.playerBadgeText}>🔍  {guesserName} — what did they draw?</Text>
              </View>
            </View>
            {/* Show the drawing */}
            <DrawingDisplay paths={drawing} style={s.drawingDisplay} />
            {/* Guess input */}
            <View style={s.guessPad}>
              <TextInput
                style={s.input}
                value={guess}
                onChangeText={setGuess}
                placeholder="Type your guess…"
                placeholderTextColor="#555"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submitGuess}
              />
              <TouchableOpacity
                style={[s.actionBtn, !guess.trim() && s.actionBtnDisabled]}
                onPress={submitGuess}
                disabled={!guess.trim()}
              >
                <LinearGradient
                  colors={guess.trim() ? ["#7c3aed", ACCENT] : ["#333", "#444"]}
                  style={s.actionBtnInner}
                >
                  <Text style={s.actionBtnText}>Submit Guess</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Reveal ────────────────────────────────────────────────────────────────────

  if (phase === "reveal") {
    const last = roundResults[roundResults.length - 1];
    return (
      <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.roundPill}>Round {round + 1} / {TOTAL_ROUNDS}</Text>
            <Text style={s.scoreChip}>Score: {score}</Text>
          </View>
          <View style={s.center}>
            <Text style={s.revealEmoji}>{last.correct ? "🎉" : "😅"}</Text>
            <Text style={[s.revealVerdict, { color: last.correct ? "#4ade80" : "#f87171" }]}>
              {last.correct ? "Correct! +100" : "Close… no points"}
            </Text>
            <View style={s.revealCard}>
              <View style={s.revealRow}>
                <Text style={s.revealLabel}>The prompt was:</Text>
                <Text style={s.revealValue}>"{last.prompt}"</Text>
              </View>
              <View style={s.divider} />
              <View style={s.revealRow}>
                <Text style={s.revealLabel}>The guess was:</Text>
                <Text style={[s.revealValue, { color: last.correct ? "#4ade80" : "#f87171" }]}>
                  "{last.guess}"
                </Text>
              </View>
            </View>
            <TouchableOpacity style={s.actionBtn} onPress={nextRound}>
              <LinearGradient colors={["#7c3aed", ACCENT]} style={s.actionBtnInner}>
                <Text style={s.actionBtnText}>
                  {round + 1 >= TOTAL_ROUNDS ? "See Results" : "Next Round →"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────────

  if (phase === "results") {
    return (
      <PostGameCard
        score={score}
        maxScore={TOTAL_ROUNDS * 100}
        gameEmoji="🎨"
        gameTitle="Drawback"
        onPlayAgain={startGame}
      />
    );
  }

  return null;
}

const s = StyleSheet.create({
  flex:            { flex: 1 },
  back:            { padding: 16, paddingTop: 8 },
  backText:        { color: ACCENT, fontSize: 16, fontWeight: "700" },
  center:          { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emoji:           { fontSize: 64, marginBottom: 16, textAlign: "center" },
  title:           { color: "#fff", fontSize: 30, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  sub:             { color: "#888", fontSize: 14, textAlign: "center", marginBottom: 24 },
  rulesBox:        { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem:        { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn:        { width: "100%", borderRadius: 14, overflow: "hidden" },
  startBtnInner:   { padding: 18, alignItems: "center" },
  startBtnText:    { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },

  topBar:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10 },
  roundPill:       { color: "#888", fontWeight: "700", fontSize: 13 },
  scoreChip:       { color: ACCENT, fontWeight: "800", fontSize: 14 },

  playerBadgeWrap: { paddingHorizontal: 16, marginBottom: 4 },
  playerBadge:     { backgroundColor: "rgba(192,132,252,0.12)", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7, alignSelf: "flex-start", borderWidth: 1, borderColor: "rgba(192,132,252,0.25)", marginBottom: 4 },
  playerBadgeText: { color: ACCENT, fontSize: 13, fontWeight: "800" },
  hint:            { color: "#555", fontSize: 12 },

  drawingDisplay:  { flex: 1, marginHorizontal: 10, marginVertical: 8, minHeight: 220 },
  guessPad:        { paddingHorizontal: 16, paddingBottom: 16 },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.3)",
    borderRadius: 14,
    padding: 16,
    color: "#fff",
    fontSize: 18,
    marginBottom: 12,
    textAlign: "center",
  },
  actionBtn:       { borderRadius: 14, overflow: "hidden" },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnInner:  { padding: 18, alignItems: "center" },
  actionBtnText:   { color: "#fff", fontSize: 17, fontWeight: "900" },

  revealEmoji:   { fontSize: 64, marginBottom: 12, textAlign: "center" },
  revealVerdict: { fontSize: 24, fontWeight: "900", marginBottom: 24 },
  revealCard:    { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 24, width: "100%", marginBottom: 28 },
  revealRow:     { paddingVertical: 8 },
  revealLabel:   { color: "#666", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  revealValue:   { color: "#fff", fontSize: 18, fontWeight: "700" },
  divider:       { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 8 },
});
