import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Animated, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const PUZZLES = [
  { emojis: "🦁👑🐾🌅", answer: "The Lion King", hint: "Disney animated film about a prince and his destiny" },
  { emojis: "🕷️🕸️👦🏙️", answer: "Spider-Man", hint: "Marvel superhero who got bitten by a radioactive spider" },
  { emojis: "🧊❄️👸💙", answer: "Frozen", hint: "Disney film with 'Let It Go'" },
  { emojis: "🐟🔍🌊", answer: "Finding Nemo", hint: "Pixar film about a father searching the ocean" },
  { emojis: "🤖❤️🌿🌍", answer: "WALL-E", hint: "Pixar film about a robot on Earth" },
  { emojis: "🧙‍♂️💍🔥🌋", answer: "Lord of the Rings", hint: "Fantasy epic trilogy about a ring that must be destroyed" },
  { emojis: "🎪🐘🐘✈️", answer: "Dumbo", hint: "Disney film about a flying elephant" },
  { emojis: "🏴‍☠️💀⚓🌊", answer: "Pirates of the Caribbean", hint: "Swashbuckling adventure with Captain Jack Sparrow" },
  { emojis: "🦸‍♀️✈️⚡🌩️", answer: "Captain Marvel", hint: "Marvel superheroine film set in the 1990s" },
  { emojis: "🧸🧒❤️🎠", answer: "Toy Story", hint: "Pixar film where toys come to life when humans leave" },
];

type Phase = "lobby" | "playing" | "results";

export default function EmojiStoryScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;

  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(20);
  const [hintUsed, setHintUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;
  const emojiAnim = useRef(new Animated.Value(0)).current;
  const revealAnim = useRef(new Animated.Value(0)).current;

  function startGame() {
    setPhase("playing");
    setIdx(0);
    setScore(0);
    startRound(0);
  }

  function startRound(roundIdx: number) {
    setGuess("");
    setRevealed(false);
    setCorrect(false);
    setTimer(20);
    setHintUsed(false);
    setShowHint(false);
    barAnim.setValue(1);
    emojiAnim.setValue(0);

    clearInterval(timerRef.current!);
    Animated.timing(barAnim, { toValue: 0, duration: 20000, useNativeDriver: false }).start();
    Animated.spring(emojiAnim, { toValue: 1, useNativeDriver: true, damping: 12 }).start();

    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          doReveal(roundIdx, false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function checkGuess(roundIdx: number) {
    clearInterval(timerRef.current!);
    barAnim.stopAnimation();
    const puzzle = PUZZLES[roundIdx];
    const isCorrect = guess.trim().toLowerCase() === puzzle.answer.toLowerCase();
    doReveal(roundIdx, isCorrect);
  }

  function doReveal(roundIdx: number, isCorrect: boolean) {
    setCorrect(isCorrect);
    setRevealed(true);
    if (isCorrect) {
      const pts = (hintUsed ? 150 : 300) + timer * 10;
      setScore((s) => s + pts);
    }
    revealAnim.setValue(0);
    Animated.spring(revealAnim, { toValue: 1, useNativeDriver: true, damping: 10 }).start();
    setTimeout(() => {
      if (roundIdx + 1 >= PUZZLES.length) setPhase("results");
      else { setIdx(roundIdx + 1); startRound(roundIdx + 1); }
    }, 1800);
  }

  function useHint() {
    setHintUsed(true);
    setShowHint(true);
  }

  useEffect(() => () => clearInterval(timerRef.current!), []);

  const [mpGuess, setMpGuess] = React.useState("");
  const [mpSubmitted, setMpSubmitted] = React.useState(false);

  // ─── Multiplayer block ────────────────────────────────────────────────────
  if (inRoom && mpState) {
    const mpPhase: string = mpState.phase ?? "waiting";
    const round: number = mpState.round ?? 1;
    const totalRounds: number = mpState.totalRounds ?? PUZZLES.length;
    const currentPuzzle: { emojis: string; answer: string } = mpState.currentPuzzle ?? { emojis: "", answer: "" };
    const guesses: Record<string, string> = mpState.guesses ?? {};
    const scores: Record<string, number> = mpState.scores ?? {};
    const myGuestId = state.guestId ?? "";
    const guessCount = Object.keys(guesses).length;

    if (mpPhase === "waiting") {
      return (
        <LinearGradient colors={["#03001c", "#200a00"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 72, marginBottom: 16 }}>😀🎬</Text>
              <Text style={s.title}>Emoji Story</Text>
              <Text style={s.sub}>Waiting for the host to start…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "finished") {
      const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
      return (
        <LinearGradient colors={["#03001c", "#200a00"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 64 }}>🏆</Text>
              <Text style={s.title}>Emoji Master!</Text>
              <View style={{ width: "100%", marginTop: 16 }}>
                {sortedScores.map(([id, pts], i) => (
                  <View key={id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1e1e3a" }}>
                    <Text style={{ color: id === myGuestId ? "#b5179e" : "#ccc", fontSize: 15, fontWeight: "700" }}>
                      {i + 1}. {id === myGuestId ? "You" : id}
                    </Text>
                    <Text style={{ color: "#a78bfa", fontWeight: "800" }}>{pts} pts</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}>
                <Text style={s.homeBtnText}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "reveal") {
      const myGuessVal = guesses[myGuestId];
      const isCorrect = myGuessVal?.toLowerCase() === currentPuzzle.answer.toLowerCase();
      return (
        <LinearGradient colors={["#03001c", "#200a00"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topRow}>
              <Text style={s.progress}>{round}/{totalRounds}</Text>
            </View>
            <View style={s.emojiSection}>
              <Text style={s.emojiText}>{currentPuzzle.emojis}</Text>
            </View>
            <View style={[s.revealBox, { backgroundColor: isCorrect ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)" }]}>
              <Text style={[s.revealText, { color: isCorrect ? "#4ade80" : "#f87171" }]}>
                Answer: {currentPuzzle.answer}
              </Text>
            </View>
            <View style={{ padding: 20, alignItems: "center" }}>
              {Object.entries(scores).sort(([, a], [, b]) => b - a).map(([id, pts], i) => (
                <Text key={id} style={{ color: id === myGuestId ? "#b5179e" : "#888", fontSize: 13, marginBottom: 4 }}>
                  {i + 1}. {id === myGuestId ? "You" : id}: {pts} pts
                </Text>
              ))}
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    // question phase
    const submitted = mpSubmitted || !!guesses[myGuestId];
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <LinearGradient colors={["#03001c", "#200a00"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topRow}>
              <Text style={s.progress}>{round}/{totalRounds}</Text>
              <Text style={{ color: "#888", fontSize: 13 }}>{guessCount} guessed</Text>
            </View>
            <View style={s.emojiSection}>
              <Text style={s.emojiText}>{currentPuzzle.emojis}</Text>
              <Text style={s.emojiLabel}>What movie / show is this?</Text>
            </View>
            {submitted ? (
              <View style={[s.revealBox, { backgroundColor: "rgba(167,139,250,0.1)" }]}>
                <Text style={[s.revealText, { color: "#a78bfa" }]}>
                  ✓ Guess submitted! {guessCount} player{guessCount !== 1 ? "s" : ""} answered
                </Text>
              </View>
            ) : (
              <View style={s.inputSection}>
                <TextInput
                  style={s.input}
                  value={mpGuess}
                  onChangeText={setMpGuess}
                  placeholder="Guess the movie/show…"
                  placeholderTextColor="#444"
                  autoCapitalize="words"
                  autoCorrect={false}
                  onSubmitEditing={() => {
                    if (!mpGuess.trim()) return;
                    sendAction("guess", { guess: mpGuess.trim() });
                    setMpSubmitted(true);
                  }}
                />
                <View style={s.btnRow}>
                  <TouchableOpacity
                    style={[s.guessBtn, { flex: 1 }]}
                    onPress={() => {
                      if (!mpGuess.trim()) return;
                      sendAction("guess", { guess: mpGuess.trim() });
                      setMpSubmitted(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.guessBtnInner}>
                      <Text style={s.guessBtnText}>GUESS →</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={s.scoreBar}>
              <Text style={s.scoreText}>Score: {scores[myGuestId] ?? 0}</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }
  // ─── End multiplayer block ────────────────────────────────────────────────

  if (phase === "lobby") {
    return (
      <LinearGradient colors={["#03001c", "#200a00"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={{ fontSize: 72, marginBottom: 16 }}>😀🎬</Text>
            <Text style={s.title}>Emoji Story</Text>
            <Text style={s.sub}>A sequence of emojis tells a story. Guess the movie or TV show!</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• 20 seconds per puzzle</Text>
              <Text style={s.ruleItem}>• Use a hint for fewer points</Text>
              <Text style={s.ruleItem}>• Exact match required</Text>
              <Text style={s.ruleItem}>• {PUZZLES.length} puzzles to solve</Text>
            </View>
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>START</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === "results") {
    const pct = Math.round((score / (PUZZLES.length * 500)) * 100);
    return (
      <LinearGradient colors={["#03001c", "#200a00"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>🏆</Text>
            <Text style={s.title}>Emoji Master!</Text>
            <Text style={s.bigScore}>{score}</Text>
            <Text style={s.scoreLabel}>POINTS EARNED</Text>
            <Text style={s.verdict}>
              {pct >= 80 ? "🎬 Film Buff!" : pct >= 50 ? "🎥 Movie Watcher" : "📺 Casual Viewer"}
            </Text>
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>PLAY AGAIN</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}>
              <Text style={s.homeBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const puzzle = PUZZLES[idx];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <LinearGradient colors={["#03001c", "#200a00"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topRow}>
            <Text style={s.progress}>{idx + 1}/{PUZZLES.length}</Text>
            <View style={s.timerTrack}>
              <Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
            </View>
            <Text style={s.timerNum}>{timer}s</Text>
          </View>

          <View style={s.emojiSection}>
            <Animated.View style={{
              transform: [{ scale: emojiAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
              opacity: emojiAnim,
            }}>
              <Text style={s.emojiText}>{puzzle.emojis}</Text>
            </Animated.View>
            <Text style={s.emojiLabel}>What movie / show is this?</Text>
          </View>

          {showHint && (
            <View style={s.hintBox}>
              <Text style={s.hintText}>💡 {puzzle.hint}</Text>
            </View>
          )}

          {revealed && (
            <Animated.View style={[s.revealBox, {
              transform: [{ scale: revealAnim }],
              backgroundColor: correct ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)",
            }]}>
              <Text style={[s.revealText, { color: correct ? "#4ade80" : "#f87171" }]}>
                {correct ? "✓ Correct!" : `✗ It was: ${puzzle.answer}`}
              </Text>
            </Animated.View>
          )}

          {!revealed && (
            <View style={s.inputSection}>
              <TextInput
                style={s.input}
                value={guess}
                onChangeText={setGuess}
                placeholder="Guess the movie/show…"
                placeholderTextColor="#444"
                autoCapitalize="words"
                autoCorrect={false}
                onSubmitEditing={() => checkGuess(idx)}
              />
              <View style={s.btnRow}>
                {!hintUsed && (
                  <TouchableOpacity style={s.hintBtn} onPress={useHint} activeOpacity={0.8}>
                    <Text style={s.hintBtnText}>💡 Hint (-100pts)</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.guessBtn, { flex: 1 }]} onPress={() => checkGuess(idx)} activeOpacity={0.85}>
                  <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.guessBtnInner}>
                    <Text style={s.guessBtnText}>GUESS →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={s.scoreBar}>
            <Text style={s.scoreText}>Score: {score}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  back: { padding: 16, paddingTop: 8 },
  backText: { color: "#a78bfa", fontSize: 16, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  title: { color: "#fff", fontSize: 32, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  sub: { color: "#888", fontSize: 13, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12 },
  homeBtnText: { color: "#666", fontSize: 15 },

  topRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, gap: 10 },
  progress: { color: "#888", fontSize: 13, fontWeight: "700", width: 50 },
  timerTrack: { flex: 1, height: 6, backgroundColor: "#1e1e3a", borderRadius: 3, overflow: "hidden" },
  timerFill: { height: "100%", backgroundColor: "#f97316", borderRadius: 3 },
  timerNum: { color: "#fff", fontSize: 15, fontWeight: "900", width: 32, textAlign: "right" },

  emojiSection: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emojiText: { fontSize: 56, textAlign: "center", marginBottom: 20, letterSpacing: 8 },
  emojiLabel: { color: "#666", fontSize: 14, fontWeight: "700" },

  hintBox: { marginHorizontal: 20, backgroundColor: "rgba(251,191,36,0.1)", borderRadius: 12, padding: 14, marginBottom: 12 },
  hintText: { color: "#fbbf24", fontSize: 14, textAlign: "center" },

  revealBox: { marginHorizontal: 20, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 12 },
  revealText: { fontSize: 18, fontWeight: "800" },

  inputSection: { paddingHorizontal: 20, paddingBottom: 8 },
  input: { backgroundColor: "#1a1a3a", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 16, marginBottom: 10 },
  btnRow: { flexDirection: "row", gap: 10 },
  hintBtn: { backgroundColor: "rgba(251,191,36,0.12)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, justifyContent: "center" },
  hintBtnText: { color: "#fbbf24", fontSize: 13, fontWeight: "700" },
  guessBtn: { borderRadius: 14, overflow: "hidden" },
  guessBtnInner: { padding: 14, alignItems: "center" },
  guessBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  scoreBar: { padding: 16, alignItems: "center" },
  scoreText: { color: "#a78bfa", fontSize: 15, fontWeight: "800" },

  bigScore: { color: "#b5179e", fontSize: 72, fontWeight: "900" },
  scoreLabel: { color: "#555", fontSize: 12, letterSpacing: 2, marginBottom: 12 },
  verdict: { color: "#a78bfa", fontSize: 18, fontWeight: "800", marginBottom: 32 },
});
